import type { GeneratePaintingEstimateOutput } from '@/ai/flows/generate-painting-estimate';
import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';
import {
  HOUSE_INTERIOR_ANCHORS,
  MAX_PRICE_CAP,
  STORY_MODIFIER,
  capRangeWidthSmart,
  clamp,
  getRawMedianFromSqm,
  inferHouseKey,
  sumAreaFactor,
  sumAreaFactorWholeApartment,
} from '@/lib/pricing-engine';
import type { LiteEstimateRequest } from '@/schemas/estimate-lite';

const INTERIOR_AREAS = {
  ceilingPaint: true,
  wallPaint: true,
  trimPaint: false,
  ensuitePaint: false,
} as const;

const ENTIRE_HOUSE_BAND = {
  Excellent: { min: 0.96, max: 1.04 },
  Fair: { min: 0.97, max: 1.06 },
  Poor: { min: 0.97, max: 1.1 },
} as const;

const ENTIRE_APT_BAND = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 0.92, max: 1.08 },
  Poor: { min: 0.9, max: 1.25 },
} as const;
const ENTIRE_APT_POOR_PREP_UPLIFT = { min: 1.06, max: 1.12 } as const;

const DEFAULT_EXTERIOR_AREAS = ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'];

function formatMoney(value: number) {
  return value.toLocaleString('en-AU');
}

function formatEstimateRange(min: number, max: number) {
  if (max >= MAX_PRICE_CAP) {
    return `From AUD ${formatMoney(min)}+ (Site Inspection Required)`;
  }

  return `AUD ${formatMoney(min)} - ${formatMoney(max)}`;
}

function calculateLiteInterior(
  input: LiteEstimateRequest
): { min: number; max: number; details: string[] } {
  const areaFactor =
    input.propertyType === 'Apartment'
      ? sumAreaFactorWholeApartment(INTERIOR_AREAS)
      : sumAreaFactor(INTERIOR_AREAS);
  const condition = input.paintCondition;
  const details = [
    `Quick guide assumes whole-property walls and ceilings for ${input.propertyType.toLowerCase()} pricing.`,
  ];

  if (input.propertyType === 'Apartment') {
    const rawMedian = getRawMedianFromSqm(input.approxSize);
    const median = rawMedian * areaFactor;
    const band = ENTIRE_APT_BAND[condition];
    const computedMin = Math.round(median * band.min);
    const computedMax = Math.round(median * band.max);
    const absoluteFloor = Math.round(rawMedian * 0.78);
    let min = Math.max(computedMin, absoluteFloor);
    let max = Math.max(computedMax, Math.round(absoluteFloor * 1.2));

    if (condition === 'Poor') {
      min = Math.round(min * ENTIRE_APT_POOR_PREP_UPLIFT.min);
      max = Math.round(max * ENTIRE_APT_POOR_PREP_UPLIFT.max);
    }

    min = clamp(min, 800, MAX_PRICE_CAP);
    max = clamp(max, 1200, MAX_PRICE_CAP);
    if (max < min) max = Math.round(min * 1.18);

    const capped = capRangeWidthSmart(min, max, input, 'interior');
    details.push(`Apartment size guide: ${input.approxSize} sqm.`);
    if (input.apartmentStructure) {
      details.push(`Apartment layout: ${input.apartmentStructure}.`);
    }
    details.push(`Condition: ${condition}.`);
    return { min: capped.min, max: capped.max, details };
  }

  const houseKey = inferHouseKey({
    bedroomsTotal: input.bedroomCount,
    bathroomsTotal: input.bathroomCount,
    approxSizeSqm: input.approxSize,
  });
  const anchor = HOUSE_INTERIOR_ANCHORS[houseKey];
  const band = ENTIRE_HOUSE_BAND[condition];
  const storyMult = STORY_MODIFIER[input.houseStories ?? '1 storey'] ?? 1;

  let min = Math.round(anchor.median * areaFactor * band.min);
  let max = Math.round(anchor.median * areaFactor * band.max);

  const floorMin = Math.round(anchor.min * areaFactor * 0.98);
  const ceilMax = Math.round(anchor.max * areaFactor * 1.02);

  min = Math.max(min, floorMin);
  max = Math.min(max, ceilMax);

  min = Math.round(min * storyMult);
  max = Math.round(max * storyMult);

  min = clamp(min, 800, MAX_PRICE_CAP);
  max = clamp(max, 1200, MAX_PRICE_CAP);
  if (max < min) max = Math.round(min * 1.18);

  const capped = capRangeWidthSmart(min, max, input, 'interior');
  details.push(`House guide: ${input.approxSize} sqm, ${houseKey}.`);
  if (input.bedroomCount && input.bathroomCount) {
    details.push(`Counts used: ${input.bedroomCount} bed / ${input.bathroomCount} bath.`);
  }
  details.push(`Condition: ${condition}.`);
  return { min: capped.min, max: capped.max, details };
}

export function calculateLiteEstimate(
  input: LiteEstimateRequest
): GeneratePaintingEstimateOutput {
  const wantsInterior =
    input.workType === 'Interior Painting' || input.workType === 'Interior + Exterior';
  const wantsExterior =
    input.workType === 'Exterior Painting' || input.workType === 'Interior + Exterior';

  let interior: { min: number; max: number; details: string[] } | null = null;
  let exterior: { min: number; max: number; details: string[] } | null = null;

  if (wantsInterior) {
    interior = calculateLiteInterior(input);
  }

  if (wantsExterior) {
    const exteriorResult = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: input.paintCondition,
      houseStories: input.houseStories,
      exteriorAreas: DEFAULT_EXTERIOR_AREAS,
      wallType: input.wallType,
      approxSize: input.approxSize,
    });

    exterior = {
      min: exteriorResult.extMin,
      max: exteriorResult.extMax,
      details: [
        `Quick guide assumes a full exterior scope with walls, eaves, gutters, fascia, and trim.`,
        `Main wall finish: ${input.wallType}.`,
        `Storeys: ${input.houseStories}.`,
        `Condition: ${input.paintCondition}.`,
      ],
    };
  }

  const totalMin = (interior?.min ?? 0) + (exterior?.min ?? 0);
  const totalMax = (interior?.max ?? 0) + (exterior?.max ?? 0);
  const totalRange = formatEstimateRange(totalMin, totalMax);

  const details = [
    ...(interior?.details ?? []),
    ...(exterior?.details ?? []),
  ];

  if (input.location?.trim()) {
    details.push(`Location hint: ${input.location.trim()}.`);
  }

  return {
    priceRange: totalRange,
    explanation:
      'This quick price guide uses your property type, approximate size, selected work scope, and current paint condition to give you a fast starting range. Book online when you want to move from guide pricing to a firm written quote.',
    details,
    breakdown: {
      ...(interior
        ? {
            interior: {
              min: interior.min,
              max: interior.max,
              priceRange: formatEstimateRange(interior.min, interior.max),
            },
          }
        : {}),
      ...(exterior
        ? {
            exterior: {
              min: exterior.min,
              max: exterior.max,
              priceRange: formatEstimateRange(exterior.min, exterior.max),
            },
          }
        : {}),
      total: {
        min: totalMin,
        max: totalMax,
        priceRange: totalRange,
      },
    },
  };
}
