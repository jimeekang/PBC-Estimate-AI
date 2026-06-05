'use server';

import { generatePaintingEstimate } from '@/domains/estimate/application/generation/generate-painting-estimate';
import type { GeneratePaintingEstimateOutput } from '@/domains/estimate/application/generation/generate-painting-estimate';
import {
  buildEstimateCreatePayload,
  buildEstimateDraftPayload,
  buildEstimateUpdatePayload,
  buildRateLimitReleasePatch,
  canMutateEstimate,
  isEstimateRateLimitReservation,
  type EstimateRateLimitReservation,
  type ExistingEstimateSnapshot,
} from '@/domains/estimate/application/lifecycle/estimate-lifecycle';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { normalizeEstimateRequest } from '@/domains/estimate/application/normalization/normalize-estimate-request';
import {
  estimateRequestSchema,
  estimateSubmissionSchema,
  type EstimateRequest,
} from '@/domains/estimate/domain/schemas/estimate-request';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

const MIN_SUBMIT_INTERVAL_MS = 30 * 1000;
const MAX_SUBMITS_PER_HOUR = 5;
const MAX_SUBMITS_PER_DAY = 10;

type SubmitEstimateSuccess = {
  error?: undefined;
  data: GeneratePaintingEstimateOutput;
  sanitizedOptions: EstimateRequest;
  estimateId: string;
  revision: number;
  estimateCount?: number;
  limitReached?: boolean;
};

type SubmitEstimateError = {
  error: string;
  limitReached?: boolean;
  data?: undefined;
  sanitizedOptions?: undefined;
  estimateId?: undefined;
  revision?: undefined;
  estimateCount?: undefined;
};

type SubmitEstimateResult = SubmitEstimateSuccess | SubmitEstimateError;

type CreateEstimateDraftSuccess = {
  error?: undefined;
  estimateId: string;
  revision: number;
  estimateCount: number;
  limitReached: boolean;
};

type CreateEstimateDraftError = {
  error: string;
  limitReached?: boolean;
  estimateId?: undefined;
  revision?: undefined;
  estimateCount?: undefined;
};

type CreateEstimateDraftResult = CreateEstimateDraftSuccess | CreateEstimateDraftError;

type CleanupEstimateDraftResult =
  | {
      error?: undefined;
      deleted: boolean;
      released: boolean;
    }
  | {
      error: string;
      deleted?: undefined;
      released?: undefined;
    };

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefined(v))
      .filter((v) => v !== undefined) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      const cleaned = stripUndefined(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out as T;
  }

  return value;
}

async function enforceEstimateRateLimit(
  uid: string,
  realEstimateCount: number
): Promise<EstimateRateLimitReservation> {
  const adminDb = getAdminDb();
  const now = new Date();
  const reservedAt = now.getTime();
  const currentHour = now.toISOString().slice(0, 13);
  const currentDay = now.toISOString().slice(0, 10);
  const rateLimitRef = adminDb.collection('estimateRateLimits').doc(uid);

  return adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const data = snapshot.data() as
      | {
          lastSubmitAt?: number;
          hourlyBucket?: string;
          hourlyCount?: number;
          dailyBucket?: string;
          dailyCount?: number;
          estimateCount?: number;
        }
      | undefined;

    const lastSubmitAt = data?.lastSubmitAt ?? 0;
    const hourlyCount = data?.hourlyBucket === currentHour ? data?.hourlyCount ?? 0 : 0;
    const dailyCount = data?.dailyBucket === currentDay ? data?.dailyCount ?? 0 : 0;
    // Use the higher of the stored counter and the real collection count to prevent drift
    const estimateCount = Math.max(data?.estimateCount ?? 0, realEstimateCount);

    if (estimateCount >= 2) {
      throw new Error('You have already used your 2 free estimates.');
    }

    if (lastSubmitAt && now.getTime() - lastSubmitAt < MIN_SUBMIT_INTERVAL_MS) {
      throw new Error('Please wait at least 30 seconds before requesting another estimate.');
    }

    if (hourlyCount >= MAX_SUBMITS_PER_HOUR) {
      throw new Error('Too many estimate requests this hour. Please try again later.');
    }

    if (dailyCount >= MAX_SUBMITS_PER_DAY) {
      throw new Error('Daily estimate request limit reached. Please try again tomorrow.');
    }

    transaction.set(
      rateLimitRef,
      {
        lastSubmitAt: reservedAt,
        hourlyBucket: currentHour,
        hourlyCount: hourlyCount + 1,
        dailyBucket: currentDay,
        dailyCount: dailyCount + 1,
        estimateCount: estimateCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return {
      reservedAt,
      previousLastSubmitAt: lastSubmitAt,
      hourlyBucket: currentHour,
      dailyBucket: currentDay,
    };
  });
}

async function releaseEstimateReservation(
  uid: string,
  reservation?: EstimateRateLimitReservation
) {
  const adminDb = getAdminDb();
  const rateLimitRef = adminDb.collection('estimateRateLimits').doc(uid);

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const data = snapshot.data() as
      | {
          lastSubmitAt?: number;
          hourlyBucket?: string;
          hourlyCount?: number;
          dailyBucket?: string;
          dailyCount?: number;
          estimateCount?: number;
        }
      | undefined;

    transaction.set(
      rateLimitRef,
      {
        ...buildRateLimitReleasePatch(data, reservation),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function getUserEstimateCount(adminDb: Firestore, uid: string) {
  const estimatesSnapshot = await adminDb
    .collection('estimates')
    .where('userId', '==', uid)
    .count()
    .get();

  return estimatesSnapshot.data().count;
}

async function getMutableEstimateSnapshot(args: {
  adminDb: Firestore;
  estimateId: string;
  requesterUid: string;
  isAdmin: boolean;
}): Promise<ExistingEstimateSnapshot> {
  const estimateRef = args.adminDb.collection('estimates').doc(args.estimateId);
  const snapshot = await estimateRef.get();

  if (!snapshot.exists) {
    throw new Error('Estimate not found.');
  }

  const existing = snapshot.data() as ExistingEstimateSnapshot | undefined;
  if (!existing || !canMutateEstimate(existing, args.requesterUid, args.isAdmin)) {
    throw new Error('You do not have permission to update this estimate.');
  }

  return existing;
}

function buildPaintingEstimatePayload(rawData: EstimateRequest) {
  const approxSize = rawData.approxSize ?? undefined;
  const wallHeight = rawData.wallHeight ?? undefined;

  const wallFinishes = rawData.wallFinishes ?? [];
  const wallType = wallFinishes[0];

  const aiPayload = stripUndefined({
    ...rawData,
    approxSize,
    wallHeight,
    wallType,
    ceilingType: rawData.ceilingOptions?.ceilingType,
  }) as Exclude<Parameters<typeof generatePaintingEstimate>[0], undefined>;

  if (aiPayload.scopeOfPainting === 'Entire property' && !aiPayload.paintAreas?.trimPaint) {
    delete aiPayload.trimPaintOptions;
  }

  if (!aiPayload.paintAreas?.ceilingPaint && !rawData.interiorRooms?.some(r => r.paintAreas?.ceilingPaint)) {
    delete aiPayload.ceilingType;
  }

  return aiPayload;
}

async function createEstimateDocument(args: {
  adminDb: Firestore;
  userId: string;
  inputSnapshot: unknown;
  estimate: unknown;
  photoPaths: string[];
}) {
  const payload = buildEstimateCreatePayload({
    userId: args.userId,
    inputSnapshot: args.inputSnapshot,
    estimate: args.estimate,
    photoPaths: args.photoPaths,
    timestamp: FieldValue.serverTimestamp(),
  });
  const estimateRef = await args.adminDb.collection('estimates').add(payload);

  return {
    estimateId: estimateRef.id,
    revision: payload.revision,
  };
}

async function createEstimateDraftDocument(args: {
  adminDb: Firestore;
  userId: string;
  rateLimitReservation?: EstimateRateLimitReservation;
}) {
  const payload = buildEstimateDraftPayload({
    userId: args.userId,
    rateLimitReservation: args.rateLimitReservation,
    timestamp: FieldValue.serverTimestamp(),
  });
  const estimateRef = await args.adminDb.collection('estimates').add(payload);

  return {
    estimateId: estimateRef.id,
    revision: payload.revision,
  };
}

async function updateEstimateDocument(args: {
  adminDb: Firestore;
  estimateId: string;
  requesterUid: string;
  isAdmin: boolean;
  inputSnapshot: unknown;
  estimate: unknown;
  photoPaths: string[];
}) {
  const estimateRef = args.adminDb.collection('estimates').doc(args.estimateId);

  return args.adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(estimateRef);

    if (!snapshot.exists) {
      throw new Error('Estimate not found.');
    }

    const existing = snapshot.data() as ExistingEstimateSnapshot | undefined;
    if (!existing || !canMutateEstimate(existing, args.requesterUid, args.isAdmin)) {
      throw new Error('You do not have permission to update this estimate.');
    }

    const payload = buildEstimateUpdatePayload({
      existing,
      inputSnapshot: args.inputSnapshot,
      estimate: args.estimate,
      photoPaths: args.photoPaths,
      timestamp: FieldValue.serverTimestamp(),
    });

    transaction.set(
      estimateRef.collection('versions').doc(payload.versionId),
      stripUndefined(payload.previousVersion)
    );
    transaction.set(estimateRef, stripUndefined(payload.update), { merge: true });

    return {
      estimateId: args.estimateId,
      revision: payload.update.revision,
    };
  });
}

export async function getEstimateQuotaStatus(payload: unknown) {
  const validatedPayload = estimateSubmissionSchema.pick({ idToken: true }).safeParse(payload);

  if (!validatedPayload.success) {
    return { error: 'Authentication is required.' };
  }

  const adminAuth = getAdminAuth();
  const adminDb = getAdminDb();
  const decodedToken = await adminAuth.verifyIdToken(validatedPayload.data.idToken);
  const isAdmin = decodedToken.admin === true;

  if (isAdmin) {
    return { estimateCount: 0, limitReached: false };
  }

  const estimateCount = await getUserEstimateCount(adminDb, decodedToken.uid);
  return {
    estimateCount,
    limitReached: estimateCount >= 2,
  };
}

export async function createEstimateDraft(payload: unknown): Promise<CreateEstimateDraftResult> {
  let reservedUid: string | null = null;
  let rateLimitReservation: EstimateRateLimitReservation | undefined;
  let draftCreated = false;

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const validatedPayload = estimateSubmissionSchema.pick({ idToken: true }).safeParse(payload);

    if (!validatedPayload.success) {
      return { error: 'Authentication is required.' };
    }

    const decodedToken = await adminAuth.verifyIdToken(validatedPayload.data.idToken);
    const isAdmin = decodedToken.admin === true;

    if (!decodedToken.email || !decodedToken.email_verified) {
      return { error: 'A verified email address is required.' };
    }

    const estimateCount = isAdmin ? 0 : await getUserEstimateCount(adminDb, decodedToken.uid);

    if (!isAdmin) {
      rateLimitReservation = await enforceEstimateRateLimit(decodedToken.uid, estimateCount);
      reservedUid = decodedToken.uid;
    }

    const draft = await createEstimateDraftDocument({
      adminDb,
      userId: decodedToken.uid,
      rateLimitReservation,
    });
    draftCreated = true;

    return {
      estimateId: draft.estimateId,
      revision: draft.revision,
      estimateCount: isAdmin ? 0 : estimateCount + 1,
      limitReached: !isAdmin && estimateCount + 1 >= 2,
    };
  } catch (error: unknown) {
    if (reservedUid && !draftCreated) {
      try {
        await releaseEstimateReservation(reservedUid, rateLimitReservation);
      } catch (releaseError) {
        console.error('Failed to release estimate draft reservation:', releaseError);
      }
    }

    console.error('Error creating estimate draft:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('2 free estimates')) {
      return { error: msg, limitReached: true };
    }
    return { error: msg || 'Failed to create estimate draft. Please try again later.' };
  }
}

export async function cleanupEstimateDraft(payload: unknown): Promise<CleanupEstimateDraftResult> {
  try {
    const validatedPayload = estimateSubmissionSchema
      .pick({ idToken: true, estimateId: true })
      .required({ estimateId: true })
      .safeParse(payload);

    if (!validatedPayload.success) {
      return { error: 'Authentication and estimate ID are required.' };
    }

    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decodedToken = await adminAuth.verifyIdToken(validatedPayload.data.idToken);
    const isAdmin = decodedToken.admin === true;
    const estimateRef = adminDb.collection('estimates').doc(validatedPayload.data.estimateId);

    const deletedReservation = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(estimateRef);

      if (!snapshot.exists) {
        return null;
      }

      const existing = snapshot.data() as ExistingEstimateSnapshot | undefined;
      if (!existing || !canMutateEstimate(existing, decodedToken.uid, isAdmin)) {
        throw new Error('You do not have permission to delete this draft.');
      }

      if (existing.status !== 'draft' || existing.revision !== 0) {
        return null;
      }

      transaction.delete(estimateRef);
      return {
        ownerUid: typeof existing.userId === 'string' ? existing.userId : null,
        rateLimitReservation: isEstimateRateLimitReservation(existing.rateLimitReservation)
          ? existing.rateLimitReservation
          : undefined,
      };
    });

    if (deletedReservation?.ownerUid && !isAdmin) {
      await releaseEstimateReservation(
        deletedReservation.ownerUid,
        deletedReservation.rateLimitReservation
      );
    }

    return {
      deleted: Boolean(deletedReservation?.ownerUid),
      released: Boolean(deletedReservation?.ownerUid && !isAdmin),
    };
  } catch (error: unknown) {
    console.error('Error cleaning up estimate draft:', error);
    const msg = error instanceof Error ? error.message : '';
    return { error: msg || 'Failed to clean up estimate draft.' };
  }
}

export async function submitEstimate(payload: unknown): Promise<SubmitEstimateResult> {
  let reservedUid: string | null = null;
  let rateLimitReservation: EstimateRateLimitReservation | undefined;
  let estimatePersisted = false;

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const validatedPayload = estimateSubmissionSchema.safeParse(payload);

    if (!validatedPayload.success) {
      console.error('Validation Error:', validatedPayload.error.flatten().fieldErrors);
      return { error: 'Invalid request payload.' };
    }

    const decodedToken = await adminAuth.verifyIdToken(validatedPayload.data.idToken);
    const isAdmin = decodedToken.admin === true;
    const estimateId = validatedPayload.data.estimateId;
    const photoPaths = validatedPayload.data.photoPaths ?? [];

    if (!decodedToken.email || !decodedToken.email_verified) {
      return { error: 'A verified email address is required.' };
    }

    const validatedFields = estimateRequestSchema.safeParse(validatedPayload.data.formData);

    if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return { error: 'Invalid form data. Please check all required fields.' };
    }

    const rawData = normalizeEstimateRequest(validatedFields.data);

    let existingEstimate: ExistingEstimateSnapshot | null = null;
    if (estimateId) {
      existingEstimate = await getMutableEstimateSnapshot({
        adminDb,
        estimateId,
        requesterUid: decodedToken.uid,
        isAdmin,
      });
    }

    const submittedEmailMatchesAuth =
      rawData.email.toLowerCase() === decodedToken.email.toLowerCase();
    const submittedEmailMatchesExisting =
      typeof existingEstimate?.options === 'object' &&
      existingEstimate.options !== null &&
      'email' in existingEstimate.options &&
      typeof existingEstimate.options.email === 'string' &&
      rawData.email.toLowerCase() === existingEstimate.options.email.toLowerCase();

    if (!submittedEmailMatchesAuth && !(isAdmin && estimateId && submittedEmailMatchesExisting)) {
      return { error: 'The submitted email does not match the signed-in account.' };
    }

    let estimateCount = 0;
    if (!estimateId) {
      estimateCount = await getUserEstimateCount(adminDb, decodedToken.uid);
    }

    if (!estimateId && !isAdmin) {
      // enforceEstimateRateLimit atomically checks and reserves the 2-estimate cap
      // along with rate limits, preventing race conditions.
      rateLimitReservation = await enforceEstimateRateLimit(decodedToken.uid, estimateCount);
      reservedUid = decodedToken.uid;
    }

    const aiPayload = buildPaintingEstimatePayload(rawData);
    const estimate = stripUndefined(await generatePaintingEstimate(aiPayload));
    const sanitizedOptions = stripUndefined(rawData);

    const lifecycleResult = estimateId
      ? await updateEstimateDocument({
          adminDb,
          estimateId,
          requesterUid: decodedToken.uid,
          isAdmin,
          inputSnapshot: sanitizedOptions,
          estimate,
          photoPaths,
        })
      : await createEstimateDocument({
          adminDb,
          userId: decodedToken.uid,
          inputSnapshot: sanitizedOptions,
          estimate,
          photoPaths,
        });
    estimatePersisted = true;

    return {
      data: estimate,
      sanitizedOptions,
      estimateId: lifecycleResult.estimateId,
      revision: lifecycleResult.revision,
      ...(!estimateId
        ? {
            estimateCount: isAdmin ? estimateCount : estimateCount + 1,
            limitReached: !isAdmin && estimateCount + 1 >= 2,
          }
        : {}),
    };
  } catch (error: unknown) {
    if (reservedUid && !estimatePersisted) {
      try {
        await releaseEstimateReservation(reservedUid, rateLimitReservation);
      } catch (releaseError) {
        console.error('Failed to release estimate reservation:', releaseError);
      }
    }

    console.error('Error generating estimate:', error);
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('2 free estimates')) {
      return { error: msg, limitReached: true };
    }
    if (msg === 'Estimate not found.' || msg === 'You do not have permission to update this estimate.') {
      return { error: msg };
    }
    return { error: 'Failed to generate estimate. ' + (msg || 'Please try again later.') };
  }
}
