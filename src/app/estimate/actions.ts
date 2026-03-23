'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  estimateRequestSchema,
  estimateSubmissionSchema,
} from '@/schemas/estimate-request';
import { FieldValue } from 'firebase-admin/firestore';

const MIN_SUBMIT_INTERVAL_MS = 30 * 1000;
const MAX_SUBMITS_PER_HOUR = 5;
const MAX_SUBMITS_PER_DAY = 10;

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .map((v) => stripUndefined(v))
      .filter((v) => v !== undefined) as unknown as T;
  }

  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) {
      if (v === undefined) continue;
      const cleaned = stripUndefined(v);
      if (cleaned === undefined) continue;
      out[k] = cleaned;
    }
    return out;
  }

  return value;
}

async function enforceEstimateRateLimit(uid: string, realEstimateCount: number) {
  const adminDb = getAdminDb();
  const now = new Date();
  const currentHour = now.toISOString().slice(0, 13);
  const currentDay = now.toISOString().slice(0, 10);
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
        lastSubmitAt: now.getTime(),
        hourlyBucket: currentHour,
        hourlyCount: hourlyCount + 1,
        dailyBucket: currentDay,
        dailyCount: dailyCount + 1,
        estimateCount: estimateCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

async function releaseEstimateReservation(uid: string) {
  const adminDb = getAdminDb();
  const rateLimitRef = adminDb.collection('estimateRateLimits').doc(uid);

  await adminDb.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(rateLimitRef);
    const data = snapshot.data() as { estimateCount?: number } | undefined;
    const nextEstimateCount = Math.max(0, (data?.estimateCount ?? 0) - 1);

    transaction.set(
      rateLimitRef,
      {
        estimateCount: nextEstimateCount,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
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

  const estimatesSnapshot = await adminDb
    .collection('estimates')
    .where('userId', '==', decodedToken.uid)
    .count()
    .get();

  const estimateCount = estimatesSnapshot.data().count;
  return {
    estimateCount,
    limitReached: estimateCount >= 2,
  };
}

export async function submitEstimate(payload: unknown) {
  let reservedUid: string | null = null;
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

    if (!decodedToken.email || !decodedToken.email_verified) {
      return { error: 'A verified email address is required.' };
    }

    const validatedFields = estimateRequestSchema.safeParse(validatedPayload.data.formData);

    if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return { error: 'Invalid form data. Please check all required fields.' };
    }

    const rawData = validatedFields.data;

    if (rawData.email.toLowerCase() !== decodedToken.email.toLowerCase()) {
      return { error: 'The submitted email does not match the signed-in account.' };
    }

    const estimatesSnapshot = await adminDb
      .collection('estimates')
      .where('userId', '==', decodedToken.uid)
      .count()
      .get();
    const estimateCount = estimatesSnapshot.data().count;
    const isAdmin = decodedToken.admin === true;

    if (!isAdmin) {
      // enforceEstimateRateLimit atomically checks and reserves the 2-estimate cap
      // along with rate limits, preventing race conditions.
      await enforceEstimateRateLimit(decodedToken.uid, estimateCount);
      reservedUid = decodedToken.uid;
    }

    const approxSize = rawData.approxSize || undefined;
    const wallHeight = rawData.wallHeight || undefined;

    // wallFinishes (multi) → wallType (single): pick most expensive for anchor
    const WALL_TYPE_PRIORITY: Record<string, number> = { brick: 3, rendered: 2, cladding: 1 };
    const wallFinishes = rawData.wallFinishes ?? [];
    const wallType = wallFinishes.length
      ? wallFinishes.sort((a, b) => (WALL_TYPE_PRIORITY[b] ?? 0) - (WALL_TYPE_PRIORITY[a] ?? 0))[0]
      : undefined;

    const aiPayload: any = stripUndefined({
      ...rawData,
      approxSize,
      wallHeight,
      wallType,
      ceilingType: rawData.ceilingOptions?.ceilingType,
    });

    if (aiPayload.scopeOfPainting === 'Entire property' && !aiPayload.paintAreas?.trimPaint) {
      delete aiPayload.trimPaintOptions;
    }
    
    if (!aiPayload.paintAreas?.ceilingPaint && !rawData.interiorRooms?.some(r => r.paintAreas?.ceilingPaint)) {
      delete aiPayload.ceilingType;
    }

    const estimate = stripUndefined(await generatePaintingEstimate(aiPayload));
    const sanitizedOptions = stripUndefined(rawData);

    await adminDb.collection('estimates').add({
      userId: decodedToken.uid,
      options: sanitizedOptions,
      estimate,
      photoPaths: validatedPayload.data.photoPaths ?? [],
      createdAt: FieldValue.serverTimestamp(),
    });
    estimatePersisted = true;

    return {
      data: estimate,
      sanitizedOptions,
      estimateCount: isAdmin ? estimateCount : estimateCount + 1,
      limitReached: !isAdmin && estimateCount + 1 >= 2,
    };
  } catch (error: any) {
    if (reservedUid && !estimatePersisted) {
      try {
        await releaseEstimateReservation(reservedUid);
      } catch (releaseError) {
        console.error('Failed to release estimate reservation:', releaseError);
      }
    }

    console.error('Error generating estimate:', error);
    const msg: string = error?.message ?? '';
    if (msg.includes('2 free estimates')) {
      return { error: msg, limitReached: true };
    }
    return { error: 'Failed to generate estimate. ' + (msg || 'Please try again later.') };
  }
}
