'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

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

const InteriorRoomItemSchema = z.object({
  roomName: z.string().min(1).max(100),
  otherRoomName: z.string().trim().max(120).optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
    ensuitePaint: z.boolean().optional().default(false),
  }),
  approxRoomSize: z.number().optional(),
});

const estimateFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(100),
  email: z.string().email('Invalid email address.'),
  phone: z.string().trim().min(1, 'Phone number is required.').max(40),
  typeOfWork: z
    .array(z.enum(['Interior Painting', 'Exterior Painting']))
    .min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string().trim().min(1, 'Property type is required.').max(80),
  houseStories: z.enum(['1 storey', '2 storey', '3 storey', 'Single story', 'Double story or more']).optional(),
  bedroomCount: z.coerce.number().min(0).optional(),
  bathroomCount: z.coerce.number().min(0).optional(),
  roomsToPaint: z.array(z.string().max(80)).max(20).optional(),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string().max(80)).max(20).optional(),
  otherExteriorArea: z.string().trim().max(120).optional(),
  exteriorTrimItems: z.array(z.string().max(40)).max(10).optional(),
  exteriorDoors: z
    .array(z.object({ style: z.enum(['Simple', 'Standard', 'Complex']), quantity: z.number().min(0).max(20) }))
    .max(3)
    .optional(),
  exteriorWindows: z
    .array(z.object({ type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']), quantity: z.number().min(0).max(30) }))
    .max(4)
    .optional(),
  exteriorArchitraves: z
    .array(z.object({ style: z.enum(['Simple', 'Standard', 'Complex']), quantity: z.number().min(0).max(50) }))
    .max(3)
    .optional(),
  otherInteriorArea: z.string().trim().max(120).optional(),
  wallType: z.enum(['cladding', 'rendered', 'brick']).optional(),
  wallFinishes: z.array(z.enum(['cladding', 'rendered', 'brick'])).max(3).optional(),
  wallHeight: z.coerce.number().positive().optional().nullable(),
  approxSize: z.coerce.number().positive().optional().nullable(),
  location: z.string().trim().max(200).optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z
    .array(
      z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])
    )
    .max(4)
    .optional(),
  paintAreas: z
    .object({
      ceilingPaint: z.boolean().default(false),
      wallPaint: z.boolean().default(false),
      trimPaint: z.boolean().default(false),
      ensuitePaint: z.boolean().optional().default(false),
    })
    .default({}),
  trimPaintOptions: z
    .object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])).max(3),
      interiorWindowFrameTypes: z.array(z.enum(['Normal', 'Awning', 'Double Hung', 'French'])).max(4).optional(),
    })
    .optional(),
  ceilingOptions: z
    .object({
      ceilingType: z.enum(['Flat', 'Decorative']),
    })
    .optional(),
});

const saveEstimateSchema = z.object({
  idToken: z.string().min(1, 'Authentication is required.'),
  formData: estimateFormSchema,
});

async function enforceEstimateRateLimit(uid: string) {
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
        }
      | undefined;

    const lastSubmitAt = data?.lastSubmitAt ?? 0;
    const hourlyCount = data?.hourlyBucket === currentHour ? data?.hourlyCount ?? 0 : 0;
    const dailyCount = data?.dailyBucket === currentDay ? data?.dailyCount ?? 0 : 0;

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
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
}

export async function submitEstimate(payload: unknown) {
  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const validatedPayload = saveEstimateSchema.safeParse(payload);

    if (!validatedPayload.success) {
      console.error('Validation Error:', validatedPayload.error.flatten().fieldErrors);
      return { error: 'Invalid request payload.' };
    }

    const decodedToken = await adminAuth.verifyIdToken(validatedPayload.data.idToken);

    if (!decodedToken.email || !decodedToken.email_verified) {
      return { error: 'A verified email address is required.' };
    }

    const validatedFields = estimateFormSchema.safeParse(validatedPayload.data.formData);

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

    if (!isAdmin && estimateCount >= 2) {
      return {
        error: 'You have already used your 2 free estimates.',
        limitReached: true,
        estimateCount,
      };
    }

    if (!isAdmin) {
      await enforceEstimateRateLimit(decodedToken.uid);
    }

    const approxSize = rawData.approxSize || undefined;
    const wallHeight = rawData.wallHeight || undefined;

    // wallFinishes (multi) → wallType (single): pick most expensive for anchor
    const WALL_TYPE_PRIORITY: Record<string, number> = { rendered: 3, brick: 2, cladding: 1 };
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

    const estimate = await generatePaintingEstimate(aiPayload);
    const sanitizedOptions = stripUndefined(rawData);

    await adminDb.collection('estimates').add({
      userId: decodedToken.uid,
      options: sanitizedOptions,
      estimate,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      data: estimate,
      sanitizedOptions,
      estimateCount: isAdmin ? estimateCount : estimateCount + 1,
      limitReached: !isAdmin && estimateCount + 1 >= 2,
    };
  } catch (error: any) {
    console.error('Error generating estimate:', error);
    return { error: 'Failed to generate estimate. ' + (error.message || 'Please try again later.') };
  }
}
