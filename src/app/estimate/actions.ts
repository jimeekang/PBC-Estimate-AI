'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { EXTERIOR_RESTRICTED_PROPERTY_TYPES } from '@/lib/estimate-constants';
import {
  InteriorHandrailDetailsSchema,
  InteriorRoomItemSchema,
  SkirtingCalculatorRoomSchema,
} from '@/schemas/estimate';
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
  specificInteriorTrimOnly: z.boolean().optional(),
  exteriorAreas: z.array(z.string().max(80)).max(20).optional(),
  otherExteriorArea: z.string().trim().max(120).optional(),
  exteriorTrimItems: z.array(z.string().max(40)).max(10).optional(),
  exteriorFrontDoor: z.boolean().optional(),
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
  apartmentStructure: z.enum(['Studio', '1Bed', '2Bed2Bath', '3Bed2Bath']).optional(),
  wallType: z.enum(['cladding', 'rendered', 'brick']).optional(),
  wallFinishes: z.array(z.enum(['cladding', 'rendered', 'brick'])).max(3).optional(),
  wallHeight: z.coerce.number().positive().optional().nullable(),
  approxSize: z.coerce.number().positive().optional().nullable(),
  interiorWallHeight: z.coerce.number().positive().optional().nullable(),
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
  skirtingPricingMode: z.enum(['linear_metres', 'room_calculator']).optional(),
  skirtingLinearMetres: z.coerce.number().positive().optional().nullable(),
  skirtingCalculatorRooms: z.array(SkirtingCalculatorRoomSchema).max(20).optional(),
  ceilingOptions: z
    .object({
      ceilingType: z.enum(['Flat', 'Decorative']),
    })
    .optional(),
  interiorDoorItems: z
    .array(
      z.object({
        scope: z.enum(['Door & Frame', 'Door only', 'Frame only']),
        system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
        quantity: z.number().min(1).max(50),
      })
    )
    .max(30)
    .optional(),
  interiorWindowItems: z
    .array(
      z.object({
        type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']),
        scope: z.enum(['Window & Frame', 'Window only', 'Frame only']),
        system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
        quantity: z.number().min(1).max(50),
      })
    )
    .max(50)
    .optional(),
}).refine(
  (data) => {
    const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
    if (!hasExterior) return true;
    return !EXTERIOR_RESTRICTED_PROPERTY_TYPES.includes(
      data.propertyType as (typeof EXTERIOR_RESTRICTED_PROPERTY_TYPES)[number]
    );
  },
  { path: ['typeOfWork'], message: 'Exterior painting is only available for house-style properties.' }
).refine(
  (data) => {
    const hasExterior = (data.typeOfWork ?? []).includes('Exterior Painting');
    if (!hasExterior) return true;
    return (data.exteriorAreas ?? []).length > 0;
  },
  { path: ['exteriorAreas'], message: 'Please select at least one exterior area.' }
).refine(
  (data) => {
    const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
    if (!hasInterior || data.scopeOfPainting !== 'Entire property') return true;
    return !!(
      data.paintAreas?.ceilingPaint ||
      data.paintAreas?.wallPaint ||
      data.paintAreas?.trimPaint ||
      data.paintAreas?.ensuitePaint
    );
  },
  { path: ['paintAreas'], message: 'Please select at least one interior surface.' }
).refine(
  (data) => {
    const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
    const needsApartmentSizing =
      hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType === 'Apartment';
    if (!needsApartmentSizing) return true;
    return !!data.apartmentStructure || typeof data.approxSize === 'number';
  },
  { path: ['apartmentStructure'], message: 'Select an apartment structure or enter an approximate size.' }
).refine(
  (data) => {
    const hasInterior = (data.typeOfWork ?? []).includes('Interior Painting');
    const needsWholePropertySizing =
      hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType !== 'Apartment';
    if (!needsWholePropertySizing) return true;
    const hasCounts =
      typeof data.bedroomCount === 'number' && typeof data.bathroomCount === 'number';
    return hasCounts || typeof data.approxSize === 'number';
  },
  {
    path: ['bedroomCount'],
    message: 'Enter bedroom and bathroom counts or provide an approximate size for a whole-property estimate.',
  }
).refine(
  (data) => {
    const selectedMeasuredRooms =
      data.scopeOfPainting === 'Specific areas only'
        ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
        : [];
    if (!selectedMeasuredRooms.length) return true;
    return typeof data.interiorWallHeight === 'number';
  },
  { path: ['interiorWallHeight'], message: 'Enter the interior wall height for specific-area pricing.' }
).refine(
  (data) => {
    const selectedMeasuredRooms =
      data.scopeOfPainting === 'Specific areas only'
        ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
        : [];
    if (!selectedMeasuredRooms.length) return true;
    return selectedMeasuredRooms.every((room) => typeof room.approxRoomSize === 'number' && room.approxRoomSize > 0);
  },
  { path: ['interiorRooms'], message: 'Enter an approximate room size for each selected room.' }
).refine(
  (data) => {
    const trimOnly = (data.typeOfWork ?? []).includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      !!data.specificInteriorTrimOnly;
    if (!trimOnly) return true;
    return (data.trimPaintOptions?.trimItems ?? []).length > 0;
  },
  { path: ['trimPaintOptions', 'trimItems'], message: 'Please select at least one trim item.' }
).refine(
  (data) => {
    const needsSkirtingRoom =
      (data.typeOfWork ?? []).includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      !data.specificInteriorTrimOnly &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
    if (!needsSkirtingRoom) return true;
    return (data.interiorRooms ?? []).some((room) => room.paintAreas?.trimPaint);
  },
  { path: ['interiorRooms'], message: 'Select at least one trim room when including skirting boards.' }
).refine(
  (data) => {
    const needsTrimOnlySkirting =
      (data.typeOfWork ?? []).includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      !!data.specificInteriorTrimOnly &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
    if (!needsTrimOnlySkirting) return true;

    if ((data.skirtingPricingMode ?? 'linear_metres') === 'linear_metres') {
      return typeof data.skirtingLinearMetres === 'number' && data.skirtingLinearMetres > 0;
    }

    return (data.skirtingCalculatorRooms ?? []).some(
      (room) => typeof room.length === 'number' && room.length > 0 && typeof room.width === 'number' && room.width > 0
    );
  },
  { path: ['skirtingLinearMetres'], message: 'Enter skirting length or add room dimensions for skirting-only pricing.' }
).refine(
  (data) => {
    const needsDoorItems = (data.typeOfWork ?? []).includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Doors');
    if (!needsDoorItems) return true;
    return (data.interiorDoorItems ?? []).length > 0;
  },
  { path: ['interiorDoorItems'], message: 'Please add at least one door quantity.' }
).refine(
  (data) => {
    const needsWindowItems = (data.typeOfWork ?? []).includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Window Frames');
    if (!needsWindowItems) return true;
    return (data.interiorWindowItems ?? []).length > 0;
  },
  { path: ['interiorWindowItems'], message: 'Please add at least one window quantity.' }
);

const saveEstimateSchema = z.object({
  idToken: z.string().min(1, 'Authentication is required.'),
  formData: estimateFormSchema,
  photoUrls: z.array(z.string().url()).max(10).optional(),
});

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

    if (!isAdmin) {
      // enforceEstimateRateLimit atomically checks and reserves the 2-estimate cap
      // along with rate limits, preventing race conditions.
      await enforceEstimateRateLimit(decodedToken.uid, estimateCount);
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
      photoUrls: validatedPayload.data.photoUrls ?? [],
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
    const msg: string = error?.message ?? '';
    if (msg.includes('2 free estimates')) {
      return { error: msg, limitReached: true };
    }
    return { error: 'Failed to generate estimate. ' + (msg || 'Please try again later.') };
  }
}
