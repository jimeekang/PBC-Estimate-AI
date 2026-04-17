import { z } from 'zod';

export const liteEstimateWorkTypeSchema = z.enum([
  'Interior Painting',
  'Exterior Painting',
  'Interior + Exterior',
]);

export const liteEstimatePropertyTypeSchema = z.enum([
  'Apartment',
  'House / Townhouse',
]);

export const liteEstimateHouseStoriesSchema = z.enum([
  '1 storey',
  '2 storey',
  '3 storey',
]);

export const liteEstimateWallTypeSchema = z.enum(['cladding', 'rendered', 'brick']);
export const liteEstimatePaintConditionSchema = z.enum(['Excellent', 'Fair', 'Poor']);
export const liteEstimateApartmentStructureSchema = z.enum([
  'Studio',
  '1Bed',
  '2Bed2Bath',
  '3Bed2Bath',
]);

export const liteEstimateSchema = z
  .object({
    workType: liteEstimateWorkTypeSchema,
    propertyType: liteEstimatePropertyTypeSchema,
    approxSize: z.coerce.number().min(30, 'Enter at least 30 sqm.').max(1200, 'Enter a valid size.'),
    bedroomCount: z.coerce.number().int().min(1).max(8).optional(),
    bathroomCount: z.coerce.number().int().min(1).max(6).optional(),
    apartmentStructure: liteEstimateApartmentStructureSchema.optional(),
    houseStories: liteEstimateHouseStoriesSchema.optional(),
    wallType: liteEstimateWallTypeSchema.optional(),
    paintCondition: liteEstimatePaintConditionSchema.default('Fair'),
    location: z.string().trim().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const hasExterior =
      data.workType === 'Exterior Painting' || data.workType === 'Interior + Exterior';

    if (hasExterior && data.propertyType === 'Apartment') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['propertyType'],
        message: 'Exterior quick estimates are available for house-style properties only.',
      });
    }

    if (hasExterior && !data.houseStories) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['houseStories'],
        message: 'Select how many storeys the property has.',
      });
    }

    if (hasExterior && !data.wallType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['wallType'],
        message: 'Select the main exterior wall finish.',
      });
    }
  });

export type LiteEstimateRequest = z.infer<typeof liteEstimateSchema>;
