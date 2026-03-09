'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { z } from 'zod';

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
  roomName: z.string(),
  otherRoomName: z.string().optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
    ensuitePaint: z.boolean().optional().default(false),
  }),
  approxRoomSize: z.number().optional(),
});

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(1, 'Phone number is required.'),
  typeOfWork: z
    .array(z.enum(['Interior Painting', 'Exterior Painting']))
    .min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string().min(1, 'Property type is required.'),
  houseStories: z.enum(['Single story', 'Double story or more']).optional(),
  bedroomCount: z.coerce.number().min(0).optional(),
  bathroomCount: z.coerce.number().min(0).optional(),
  roomsToPaint: z.array(z.string()).optional(),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  otherExteriorArea: z.string().optional(),
  otherInteriorArea: z.string().optional(),
  wallType: z.enum(['cladding', 'rendered', 'brick']).optional(),
  wallFinishes: z.array(z.enum(['cladding', 'rendered', 'brick'])).optional(),
  wallHeight: z.coerce.number().positive().optional().nullable(),
  approxSize: z.coerce.number().positive().optional().nullable(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z
    .array(
      z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])
    )
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
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
    .optional(),
  ceilingOptions: z
    .object({
      ceilingType: z.enum(['Flat', 'Decorative']),
    })
    .optional(),
});

export async function submitEstimate(formData: any) {
  try {
    const validatedFields = estimateFormSchema.safeParse(formData);

    if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return { error: 'Invalid form data. Please check all required fields.' };
    }

    const rawData = validatedFields.data;
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

    return { data: estimate, sanitizedOptions };
  } catch (error: any) {
    console.error('Error generating estimate:', error);
    return { error: 'Failed to generate estimate. ' + (error.message || 'Please try again later.') };
  }
}