import { z } from 'zod';

import { EXTERIOR_RESTRICTED_PROPERTY_TYPES } from '@/lib/estimate-constants';
import {
  InteriorRoomItemSchema,
  SkirtingCalculatorRoomSchema,
} from '@/schemas/estimate';

const EstimateWorkTypeSchema = z.enum(['Interior Painting', 'Exterior Painting']);
const EstimateScopeSchema = z.enum(['Entire property', 'Specific areas only']);
const EstimateHouseStoriesSchema = z.enum([
  '1 storey',
  '2 storey',
  '3 storey',
  'Single story',
  'Double story or more',
]);
const EstimatePaintConditionSchema = z.enum(['Excellent', 'Fair', 'Poor']);
const EstimateDifficultySchema = z.enum([
  'Stairs',
  'High ceilings',
  'Extensive mouldings or trims',
  'Difficult access areas',
]);
const EstimateWallFinishSchema = z.enum(['cladding', 'rendered', 'brick']);
const EstimateExteriorTrimItemSchema = z.enum([
  'Doors',
  'Window Frames',
  'Architraves',
  'Front Door',
]);
const EstimateTrimPaintTypeSchema = z.enum(['Oil-based', 'Water-based']);
const EstimateTrimScopeSchema = z.enum(['Door & Frame', 'Door only', 'Frame only']);
const EstimateInteriorDoorTypeSchema = z.enum(['flush', 'sliding', 'panelled', 'french', 'bi_folding']);
const EstimateWindowTypeSchema = z.enum(['Normal', 'Awning', 'Double Hung', 'French']);
const EstimateWindowScopeSchema = z.enum(['Window & Frame', 'Window only', 'Frame only']);
const EstimateItemSystemSchema = z.enum(['oil_2coat', 'water_3coat_white_finish']);
const AU_PHONE_ERROR = 'Enter a valid Australian phone number.';

function isValidAustralianPhoneNumber(phone: string) {
  const normalized = phone.replace(/[^\d+]/g, '');
  const digitsOnly = normalized.replace(/^\+/, '');

  return (
    /^04\d{8}$/.test(digitsOnly) ||
    /^614\d{8}$/.test(digitsOnly) ||
    /^0[2378]\d{8}$/.test(digitsOnly) ||
    /^61[2378]\d{8}$/.test(digitsOnly) ||
    /^1300\d{6}$/.test(digitsOnly) ||
    /^1800\d{6}$/.test(digitsOnly)
  );
}

function shouldRequireApproxSize(data: {
  typeOfWork: readonly z.infer<typeof EstimateWorkTypeSchema>[];
  scopeOfPainting: z.infer<typeof EstimateScopeSchema>;
  exteriorAreas?: string[];
}) {
  return (
    data.scopeOfPainting === 'Entire property' ||
    (hasExteriorWork(data.typeOfWork) &&
      data.scopeOfPainting === 'Specific areas only' &&
      (data.exteriorAreas ?? []).includes('Wall'))
  );
}

function hasInteriorWork(typeOfWork: readonly z.infer<typeof EstimateWorkTypeSchema>[]) {
  return typeOfWork.includes('Interior Painting');
}

function hasExteriorWork(typeOfWork: readonly z.infer<typeof EstimateWorkTypeSchema>[]) {
  return typeOfWork.includes('Exterior Painting');
}

export const estimateRequestSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required.').max(100),
    email: z.string().email('Invalid email address.'),
    phone: z
      .string()
      .trim()
      .min(1, 'Phone number is required.')
      .max(40)
      .refine(isValidAustralianPhoneNumber, AU_PHONE_ERROR),
    typeOfWork: z
      .array(EstimateWorkTypeSchema)
      .min(1, 'Please select at least one type of work.'),
    scopeOfPainting: EstimateScopeSchema,
    propertyType: z.string().trim().min(1, 'Property type is required.').max(80),
    houseStories: EstimateHouseStoriesSchema.optional(),
    bedroomCount: z.coerce.number().min(0).optional(),
    bathroomCount: z.coerce.number().min(0).optional(),
    roomsToPaint: z.array(z.string().max(80)).max(20).optional(),
    interiorRooms: z.array(InteriorRoomItemSchema).max(20).optional(),
    specificInteriorTrimOnly: z.boolean().optional(),
    exteriorAreas: z.array(z.string().max(80)).max(20).optional(),
    otherExteriorArea: z.string().trim().max(120).optional(),
    exteriorTrimItems: z.array(EstimateExteriorTrimItemSchema).max(10).optional(),
    exteriorFrontDoor: z.boolean().optional(),
    exteriorDoors: z
      .array(
        z.object({
          style: z.enum(['Simple', 'Standard', 'Complex']),
          quantity: z.number().min(0).max(20),
        })
      )
      .max(3)
      .optional(),
    exteriorWindows: z
      .array(
        z.object({
          type: EstimateWindowTypeSchema,
          quantity: z.number().min(0).max(30),
        })
      )
      .max(4)
      .optional(),
    exteriorArchitraves: z
      .array(
        z.object({
          style: z.enum(['Simple', 'Standard', 'Complex']),
          quantity: z.number().min(0).max(50),
        })
      )
      .max(3)
      .optional(),
    deckArea: z.coerce.number().positive().optional().nullable(),
    deckServiceType: z.enum(['stain', 'clear', 'paint-conversion', 'paint-recoat']).optional(),
    deckProductType: z.enum(['oil', 'water']).optional(),
    deckCondition: z.enum(['good', 'weathered', 'damaged']).optional(),
    pavingArea: z.coerce.number().positive().optional().nullable(),
    pavingCondition: z.enum(['good', 'fair', 'poor']).optional(),
    otherInteriorArea: z.string().trim().max(120).optional(),
    apartmentStructure: z.enum(['Studio', '1Bed', '2Bed2Bath', '3Bed2Bath']).optional(),
    wallType: EstimateWallFinishSchema.optional(),
    wallFinishes: z.array(EstimateWallFinishSchema).max(1, 'Select one main wall finish.').optional(),
    wallHeight: z.coerce.number().positive().optional().nullable(),
    approxSize: z.coerce.number().positive().optional().nullable(),
    interiorWallHeight: z.coerce.number().positive().optional().nullable(),
    location: z.string().trim().max(200).optional(),
    timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
    paintCondition: EstimatePaintConditionSchema.optional(),
    jobDifficulty: z.array(EstimateDifficultySchema).max(4).optional(),
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
        paintType: EstimateTrimPaintTypeSchema,
        trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])).max(3),
        interiorDoorTypes: z.array(EstimateInteriorDoorTypeSchema).max(5).optional(),
        interiorWindowFrameTypes: z.array(EstimateWindowTypeSchema).max(4).optional(),
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
    ceilingType: z.enum(['Flat', 'Decorative']).optional(),
    interiorDoorItems: z
      .array(
        z.object({
          doorType: EstimateInteriorDoorTypeSchema,
          scope: EstimateTrimScopeSchema,
          system: EstimateItemSystemSchema,
          quantity: z.number().min(1).max(50),
        })
      )
      .max(30)
      .optional(),
    interiorWindowItems: z
      .array(
        z.object({
          type: EstimateWindowTypeSchema,
          scope: EstimateWindowScopeSchema,
          system: EstimateItemSystemSchema,
          quantity: z.number().min(1).max(50),
        })
      )
      .max(50)
      .optional(),
  })
  .refine(
    (data) => {
      if (!hasExteriorWork(data.typeOfWork)) return true;
      return !EXTERIOR_RESTRICTED_PROPERTY_TYPES.includes(
        data.propertyType as (typeof EXTERIOR_RESTRICTED_PROPERTY_TYPES)[number]
      );
    },
    { path: ['typeOfWork'], message: 'Exterior painting is only available for house-style properties.' }
  )
  .refine(
    (data) => {
      const needsCustomInteriorArea =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Entire property' &&
        (data.roomsToPaint ?? []).includes('Etc');
      if (!needsCustomInteriorArea) return true;
      return !!data.otherInteriorArea?.trim();
    },
    { path: ['otherInteriorArea'], message: "Please specify the 'Etc' interior area." }
  )
  .refine(
    (data) => {
      const needsCustomExteriorArea =
        hasExteriorWork(data.typeOfWork) && (data.exteriorAreas ?? []).includes('Etc');
      if (!needsCustomExteriorArea) return true;
      return !!data.otherExteriorArea?.trim();
    },
    { path: ['otherExteriorArea'], message: "Please specify the 'Etc' exterior area." }
  )
  .refine(
    (data) => {
      if (!hasExteriorWork(data.typeOfWork)) return true;
      return (data.exteriorAreas ?? []).length > 0;
    },
    { path: ['exteriorAreas'], message: 'Please select at least one exterior area.' }
  )
  .refine(
    (data) => {
      if (!shouldRequireApproxSize(data)) return true;
      return typeof data.approxSize === 'number' && data.approxSize > 0;
    },
    { path: ['approxSize'], message: 'Enter the approximate size in sqm.' }
  )
  .refine(
    (data) => {
      const needsDeckArea =
        hasExteriorWork(data.typeOfWork) && (data.exteriorAreas ?? []).includes('Deck');
      if (!needsDeckArea) return true;
      return typeof data.deckArea === 'number' && data.deckArea > 0;
    },
    { path: ['deckArea'], message: 'Enter the deck area in sqm when Deck is selected.' }
  )
  .refine(
    (data) => {
      const needsPavingArea =
        hasExteriorWork(data.typeOfWork) && (data.exteriorAreas ?? []).includes('Paving');
      if (!needsPavingArea) return true;
      return typeof data.pavingArea === 'number' && data.pavingArea > 0;
    },
    { path: ['pavingArea'], message: 'Enter the paving area in sqm when Paving is selected.' }
  )
  .refine(
    (data) => {
      if (!hasInteriorWork(data.typeOfWork) || data.scopeOfPainting !== 'Entire property') return true;
      return !!(
        data.paintAreas?.ceilingPaint ||
        data.paintAreas?.wallPaint ||
        data.paintAreas?.trimPaint
      );
    },
    { path: ['paintAreas'], message: 'Please select at least one interior surface.' }
  )
  .refine(
    (data) => {
      const selectedMeasuredRooms =
        data.scopeOfPainting === 'Specific areas only'
          ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
          : [];
      if (!selectedMeasuredRooms.length) return true;
      return typeof data.interiorWallHeight === 'number';
    },
    { path: ['interiorWallHeight'], message: 'Enter the interior wall height for specific-area pricing.' }
  )
  .refine(
    (data) => {
      const needsWallFinish =
        hasExteriorWork(data.typeOfWork) && (data.exteriorAreas ?? []).includes('Wall');
      if (!needsWallFinish) return true;
      return (data.wallFinishes ?? []).length > 0;
    },
    { path: ['wallFinishes'], message: 'Please select at least one wall finish.' }
  )
  .refine(
    (data) => {
      const needsExteriorTrimItems =
        hasExteriorWork(data.typeOfWork) && (data.exteriorAreas ?? []).includes('Exterior Trim');
      if (!needsExteriorTrimItems) return true;
      return (data.exteriorTrimItems ?? []).length > 0;
    },
    { path: ['exteriorTrimItems'], message: 'Please select at least one exterior trim item.' }
  )
  .refine(
    (data) => {
      if (!hasExteriorWork(data.typeOfWork)) return true;
      return !!data.houseStories;
    },
    { path: ['houseStories'], message: 'Please select the number of stories for exterior painting.' }
  )
  .refine(
    (data) => {
      const trimOnly =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Specific areas only' &&
        !!data.specificInteriorTrimOnly;
      if (!trimOnly) return true;
      return (data.trimPaintOptions?.trimItems ?? []).length > 0;
    },
    { path: ['trimPaintOptions', 'trimItems'], message: 'Please select at least one trim item.' }
  )
  .refine(
    (data) => {
      const needsSkirtingRoom =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Specific areas only' &&
        !data.specificInteriorTrimOnly &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
      if (!needsSkirtingRoom) return true;
      return (data.interiorRooms ?? []).some((room) => room.paintAreas?.trimPaint);
    },
    { path: ['interiorRooms'], message: 'Select at least one trim room when including skirting boards.' }
  )
  .refine(
    (data) => {
      const needsTrimOnlySkirting =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Specific areas only' &&
        !!data.specificInteriorTrimOnly &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
      if (!needsTrimOnlySkirting) return true;

      if ((data.skirtingPricingMode ?? 'linear_metres') === 'linear_metres') {
        return typeof data.skirtingLinearMetres === 'number' && data.skirtingLinearMetres > 0;
      }

      return (data.skirtingCalculatorRooms ?? []).some(
        (room) =>
          typeof room.length === 'number' &&
          room.length > 0 &&
          typeof room.width === 'number' &&
          room.width > 0
      );
    },
    { path: ['skirtingLinearMetres'], message: 'Enter skirting length or add room dimensions for skirting-only pricing.' }
  )
  .refine(
    (data) => {
      const needsDoorItems =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Specific areas only' &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Doors');
      if (!needsDoorItems) return true;
      return (data.interiorDoorItems ?? []).length > 0;
    },
    { path: ['interiorDoorItems'], message: 'Please add at least one door quantity.' }
  )
  .refine(
    (data) => {
      const needsWindowItems =
        hasInteriorWork(data.typeOfWork) &&
        data.scopeOfPainting === 'Specific areas only' &&
        (data.trimPaintOptions?.trimItems ?? []).includes('Window Frames');
      if (!needsWindowItems) return true;
      return (data.interiorWindowItems ?? []).length > 0;
    },
    { path: ['interiorWindowItems'], message: 'Please add at least one window quantity.' }
  )
  .superRefine((data, ctx) => {
    if (data.scopeOfPainting !== 'Specific areas only') return;

    const selectedRooms = data.interiorRooms ?? [];
    selectedRooms.forEach((room, index) => {
      if (room.roomName === 'Handrail') return;
      if (typeof room.approxRoomSize === 'number' && room.approxRoomSize > 0) return;

      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['interiorRooms', index, 'approxRoomSize'],
        message: 'Enter the approximate room size in sqm.',
      });
    });
  });

export const estimateSubmissionSchema = z.object({
  idToken: z.string().min(1, 'Authentication is required.'),
  formData: estimateRequestSchema,
  photoPaths: z.array(z.string().trim().min(1)).max(10).optional(),
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
export type EstimateSubmission = z.infer<typeof estimateSubmissionSchema>;
