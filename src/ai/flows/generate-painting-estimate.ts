'use server';

/**
 * @fileOverview Data-driven AI agent to estimate painting price range.
 *
 * Anchors are calibrated to Sydney averages.
 * - Apartment interior uses apartment anchors + room scoring model.
 * - House interior uses HOUSE anchors (bed/bath-based) + calibrated whole-house band + modifiers.
 *
 * Exterior model (updated):
 * - Uses Sydney house exterior refresh anchors (typical full exterior < $30k)
 * - Applies storey modifier properly
 * - Avoids double-counting “Difficult access areas” on double-storey jobs
 * - Uses area uplifts as % of base (more stable than fixed sums)
 * - Enforces realistic floors for “full exterior” and “wall+eaves” cases
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// -----------------------------
// Anchors (Sydney averages)
// -----------------------------
const APARTMENT_ANCHORS_OIL = {
  Studio: { min: 2700, max: 3300, median: 2900 },
  OneBed: { min: 3200, max: 3900, median: 3400 },
  TwoBed: { min: 4000, max: 5200, median: 4350 },
  ThreeBed: { min: 5200, max: 6800, median: 5500 },
} as const;

const HOUSE_INTERIOR_ANCHORS = {
  '2B1B': { min: 6200, max: 8500, median: 7200 },
  '3B2B': { min: 7800, max: 10200, median: 8900 },
  '4B2B': { min: 9500, max: 12500, median: 10800 },
  '5B3B': { min: 12500, max: 16500, median: 14200 },
} as const;

/**
 * Exterior anchor updated to match Sydney “full exterior refresh” reality.
 * Typical band is roughly 6.5k–30k depending on size/height/condition/access.
 */
const EXTERIOR_ANCHOR = { min: 6500, max: 26000, median: 14000 } as const;

const COMBINED_ANCHOR = { min: 12000, max: 30000, median: 19000 } as const;

const MAX_PRICE_CAP = 35000;

// -----------------------------
// Interior modelling
// -----------------------------
const ROOM_WEIGHT: Record<string, number> = {
  'Master Bedroom': 1.15,
  'Bedroom 1': 1.0,
  'Bedroom 2': 1.0,
  'Bedroom 3': 1.0,
  Bathroom: 1.1,
  'Living Room': 1.35,
  Kitchen: 1.3,
  Laundry: 0.7,
  Hallway: 0.45,
  Foyer: 0.4,
  Handrail: 0.6,
  Dining: 1.0,
  'Study / Office': 1.0,
  Stairwell: 1.2,
  'Walk-in robe': 0.5,
  Etc: 0.6,
};

const BASE_FULL_APT_SCORE = 6.3;
const BASE_FULL_HOUSE_SCORE = 8.8;

const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.20,
  ensuitePaint: 0.12,
};

const CONDITION_MULTIPLIER = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 1.08, max: 1.22 },
  Poor: { min: 1.22, max: 1.55 },
} as const;

const HOUSE_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.00, max: 1.08 },
  Fair: { min: 1.10, max: 1.24 },
  Poor: { min: 1.22, max: 1.40 },
} as const;

const ENTIRE_HOUSE_BAND = {
  Excellent: { min: 0.96, max: 1.04 },
  Fair: { min: 0.97, max: 1.06 },
  Poor: { min: 0.97, max: 1.10 },
} as const;

const STORY_MODIFIER = {
  'Single story': 1.0,
  'Double story or more': 1.18,
};

const DIFFICULTY_ADDON = {
  Stairs: { min: 300, max: 900 },
  'High ceilings': { min: 300, max: 1200 },
  'Extensive mouldings or trims': { min: 250, max: 900 },
  'Difficult access areas': { min: 400, max: 1500 },
} as const;

const WATER_BASED_UPLIFT = { minPct: 0.08, maxPct: 0.12 } as const;
const TRIM_PREMIUM_ENTIRE_WATER_PER_ITEM = { min: 80, max: 180 } as const;
const TRIM_PREMIUM_SPECIFIC_PER_ROOM = {
  'Oil-based': { min: 120, max: 260 },
  'Water-based': { min: 180, max: 380 },
} as const;

const ENTIRE_APT_BAND = {
  Excellent: { min: 0.96, max: 1.10 },
  Fair: { min: 0.97, max: 1.16 },
  Poor: { min: 0.98, max: 1.24 },
} as const;

// -----------------------------
// Exterior modelling (UPDATED)
// -----------------------------

/**
 * Exterior condition multipliers: prep-heavy, so Fair/Poor can lift more.
 * We deliberately keep this tighter than interior “Poor” to avoid extreme outputs.
 */
const EXTERIOR_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.00, max: 1.08 },
  Fair: { min: 1.10, max: 1.24 },
  Poor: { min: 1.22, max: 1.40 },
} as const;

/**
 * Size bands apply a gentle multiplier to the exterior anchor.
 * NOTE: approxSize here is “whole house sqm”, which is imperfect for exterior,
 * so we keep the effect moderate.
 */
const EXTERIOR_SIZE_BANDS = [
  { minSqm: 0, maxSqm: 120, minMult: 0.95, maxMult: 1.05 },
  { minSqm: 121, maxSqm: 200, minMult: 1.00, maxMult: 1.15 },
  { minSqm: 201, maxSqm: 1000, minMult: 1.10, maxMult: 1.30 },
] as const;

/**
 * Exterior area uplifts as % of base exterior cost.
 * This stabilises pricing and reflects that most cost drivers scale with access/setup.
 */
const EXTERIOR_AREA_UPLIFT_PCT: Record<
  string,
  { minPct: number; maxPct: number; notes?: string }
> = {
  Wall: { minPct: 0.0, maxPct: 0.0, notes: 'Base includes walls for typical full exterior scope.' },

  // common add-ons
  Eaves: { minPct: 0.07, maxPct: 0.11 },
  Gutter: { minPct: 0.04, maxPct: 0.07 },
  Fascia: { minPct: 0.05, maxPct: 0.08 },
  'Exterior Trim': { minPct: 0.06, maxPct: 0.10 },
  Pipes: { minPct: 0.02, maxPct: 0.04 },

  // optional larger scope items (treat as “scope changer”)
  Deck: { minPct: 0.06, maxPct: 0.12 },
  Paving: { minPct: 0.04, maxPct: 0.09 },
  Roof: { minPct: 0.18, maxPct: 0.32 }, // big uplift, often requires different access/approach

  Etc: { minPct: 0.04, maxPct: 0.10 },
};

/**
 * Floors to stop nonsense-low outputs:
 * - Wall+Eaves is a very common “minimum real job” for exterior refresh.
 * - Full exterior (walls + eaves + fascia + gutter + trim) has a higher floor.
 */
const EXTERIOR_FLOORS = {
  wallOnly: 6500,
  wallPlusEaves: 9000,
  fullExterior: 12000,
  doubleStoreyFullExterior: 14000,
} as const;

// -----------------------------
// Helpers
// -----------------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toNumberOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

function pickExteriorBand(sqm?: number) {
  if (!sqm) return EXTERIOR_SIZE_BANDS[0];
  return (
    EXTERIOR_SIZE_BANDS.find((b) => sqm >= b.minSqm && sqm <= b.maxSqm) ??
    EXTERIOR_SIZE_BANDS[EXTERIOR_SIZE_BANDS.length - 1]
  );
}

function formatMoney(n: number) {
  return n.toLocaleString('en-AU');
}

function inferApartmentClassFromSqm(sqm?: number) {
  if (!sqm) return undefined;
  if (sqm <= 45) return 'Studio' as const;
  if (sqm <= 70) return 'OneBed' as const;
  if (sqm <= 110) return 'TwoBed' as const;
  return 'ThreeBed' as const;
}

function isApartmentLike(propertyType?: string) {
  const p = (propertyType ?? '').toLowerCase();
  return p.includes('apartment') || p.includes('unit') || p.includes('flat');
}

function roomScore(roomName: string) {
  return ROOM_WEIGHT[roomName] ?? 0.6;
}

function pseudoSqmFromRooms(selectedRooms: string[]) {
  const base = selectedRooms.length * 8;
  const bonus =
    (selectedRooms.includes('Bathroom') ? 4 : 0) +
    (selectedRooms.includes('Kitchen') ? 3 : 0) +
    (selectedRooms.includes('Living Room') ? 3 : 0);
  return base + bonus;
}

function sumAreaFactor(flags: {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
}) {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  if (flags.ensuitePaint) f += AREA_SHARE.ensuitePaint;
  return f > 0 ? f : 1.0;
}

function sumAreaFactorWholeApartment(flags: {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
}) {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  if (flags.ensuitePaint) f += AREA_SHARE.ensuitePaint;
  return f > 0 ? f : 1.0;
}

function inferApartmentClassFromBedroomNumbers(
  bedroomCountInput?: number,
  hasMasterBedroom?: boolean
) {
  const extra =
    typeof bedroomCountInput === 'number' && Number.isFinite(bedroomCountInput)
      ? bedroomCountInput
      : 0;
  const totalBedrooms = extra + (hasMasterBedroom ? 1 : 0);
  if (totalBedrooms <= 0) return 'Studio' as const;
  if (totalBedrooms === 1) return 'OneBed' as const;
  if (totalBedrooms === 2) return 'TwoBed' as const;
  return 'ThreeBed' as const;
}

function applyWaterBasedUpliftTrimShareWholeJob(minVal: number, maxVal: number) {
  const minMult = 1 + WATER_BASED_UPLIFT.minPct * AREA_SHARE.trimPaint;
  const maxMult = 1 + WATER_BASED_UPLIFT.maxPct * AREA_SHARE.trimPaint;
  return {
    min: Math.round(minVal * minMult),
    max: Math.round(maxVal * maxMult),
  };
}

function widenRangeByComplexity(
  minVal: number,
  maxVal: number,
  complexityCount: number
) {
  if (complexityCount <= 0) return { minVal, maxVal };
  const gap = Math.max(0, maxVal - minVal);
  const widenFactor = 1 + 0.03 * complexityCount;
  const widenedMax = Math.round(minVal + gap * widenFactor);
  return { minVal, maxVal: widenedMax };
}

function inferHouseKey(opts: {
  bedroomsTotal?: number;
  bathroomsTotal?: number;
  approxSizeSqm?: number;
}): keyof typeof HOUSE_INTERIOR_ANCHORS {
  const b = opts.bedroomsTotal ?? 0;
  const ba = opts.bathroomsTotal ?? 0;
  const sqm = opts.approxSizeSqm;

  if (b >= 5 || ba >= 3) return '5B3B';
  if (b === 4) return '4B2B';
  if (b === 3) return '3B2B';
  if (b === 2) return '2B1B';

  if (sqm) {
    if (sqm <= 105) return '2B1B';
    if (sqm <= 140) return '3B2B';
    if (sqm <= 190) return '4B2B';
    return '5B3B';
  }
  return '3B2B';
}

// -----------------------------
// Schemas
// -----------------------------
const InteriorRoomItemSchema = z.object({
  roomName: z.string(),
  otherRoomName: z.string().optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }),
  approxRoomSize: z.number().optional(),
});

const GeneratePaintingEstimateInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),

  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string(),

  houseStories: z.enum(['Single story', 'Double story or more']).optional(),
  bedroomCount: z.number().optional(),

  roomsToPaint: z.array(z.string()).optional(),
  paintAreas: z
    .object({
      ceilingPaint: z.boolean(),
      wallPaint: z.boolean(),
      trimPaint: z.boolean(),
      ensuitePaint: z.boolean().optional(),
    })
    .optional(),

  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  otherInteriorArea: z.string().optional(),

  exteriorAreas: z.array(z.string()).optional(),
  otherExteriorArea: z.string().optional(),
  wallType: z.enum(['cladding', 'rendered', 'brick']).optional(),

  approxSize: z.number().optional(),
  location: z.string().optional(),

  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),

  jobDifficulty: z
    .array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas']))
    .optional(),

  trimPaintOptions: z
    .object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
    .optional(),

  ceilingType: z.enum(['Flat', 'Decorative']).optional(),
});

const GeneratePaintingEstimateOutputSchema = z.object({
  priceRange: z.string(),
  explanation: z.string(),
  details: z.array(z.string()).optional(),
});

export type GeneratePaintingEstimateInput = z.infer<
  typeof GeneratePaintingEstimateInputSchema
>;
export type GeneratePaintingEstimateOutput = z.infer<
  typeof GeneratePaintingEstimateOutputSchema
>;

// -----------------------------
// AI explanation prompt
// -----------------------------
const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  input: {
    schema: z.object({
      input: GeneratePaintingEstimateInputSchema,
      priceMin: z.number(),
      priceMax: z.number(),
    }),
  },
  output: { schema: GeneratePaintingEstimateOutputSchema },
  prompt: `
You are a professional painting estimator in Australia for "Paint Buddy & Co".
Your role is to clearly explain why a specific price range was generated.

CONTEXT
- Property type: {{input.propertyType}}
- Stories: {{#if input.houseStories}}{{input.houseStories}}{{else}}N/A{{/if}}
- Scope: {{input.scopeOfPainting}}
- Work type: {{#each input.typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Wall Type: {{#if input.wallType}}{{input.wallType}}{{else}}N/A{{/if}}
- Approx Size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Calculated from room selections{{/if}}
- Paint Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}
- Ceiling Style: {{#if input.ceilingType}}{{input.ceilingType}}{{else}}Flat{{/if}}
- Custom Interior Area (if selected 'Etc'): {{#if input.otherInteriorArea}}{{input.otherInteriorArea}}{{else}}N/A{{/if}}
- Custom Exterior Area (if selected 'Etc'): {{#if input.otherExteriorArea}}{{input.otherExteriorArea}}{{else}}N/A{{/if}}

GENERATED PRICE DATA (AUD)
Min: {{priceMin}}
Max: {{priceMax}}

INSTRUCTIONS
1) explanation: 3–5 sentences, Australian English, professional tone.
   Focus on the main cost drivers: scope, condition, selected areas, stories, wall finish (if exterior), and complexity factors (like decorative ceilings or trim).
2) priceRange:
   - Use commas as thousands separators.
   - If priceMax >= 35,000 format: "From AUD {{priceMin}}+ (Site Inspection Required)"
   - Else: "AUD {{priceMin}} - {{priceMax}}"
3) details: 3–5 bullet points, specific to this job.
`,
});

// -----------------------------
// Core flow
// -----------------------------
export const generatePaintingEstimate = ai.defineFlow(
  {
    name: 'generatePaintingEstimateFlow',
    inputSchema: GeneratePaintingEstimateInputSchema,
    outputSchema: GeneratePaintingEstimateOutputSchema,
  },
  async (input) => {
    const isInt = input.typeOfWork.includes('Interior Painting');
    const isExt = input.typeOfWork.includes('Exterior Painting');
    const isBoth = isInt && isExt;

    const condition = input.paintCondition ?? 'Fair';
    const condMult = CONDITION_MULTIPLIER[condition];
    const houseCondMult = HOUSE_CONDITION_MULTIPLIER[condition];
    const exteriorCondMult = EXTERIOR_CONDITION_MULTIPLIER[condition];

    const story = input.houseStories ?? 'Single story';
    const storyMult = STORY_MODIFIER[story] || 1.0;
    const isDouble = story === 'Double story or more';

    // -----------------------------
    // Interior
    // -----------------------------
    let intMin = 0;
    let intMax = 0;

    if (isInt) {
      const isWhole = input.scopeOfPainting === 'Entire property';
      const aptLike = isApartmentLike(input.propertyType);

      let selectedRooms: string[] = [];
      let areaFactor = 1.0;

      if (isWhole) {
        selectedRooms = (input.roomsToPaint ?? []).length ? (input.roomsToPaint ?? []) : [];
        const globalAreas = input.paintAreas ?? {
          ceilingPaint: true,
          wallPaint: true,
          trimPaint: false,
          ensuitePaint: false,
        };
        areaFactor = aptLike
          ? sumAreaFactorWholeApartment(globalAreas)
          : sumAreaFactor(globalAreas);
      } else {
        const rooms = input.interiorRooms ?? [];
        selectedRooms = rooms.map((r) => r.roomName);
        const scored = rooms.map((r) => ({
          score: roomScore(r.roomName),
          af: sumAreaFactor(r.paintAreas),
        }));
        const denom = scored.reduce((a, b) => a + b.score, 0) || 1;
        areaFactor = scored.reduce((a, b) => a + b.score * b.af, 0) / denom;
      }

      if (!selectedRooms.length) {
        selectedRooms = isWhole
          ? ['Bedroom 1', 'Bathroom', 'Living Room', 'Kitchen']
          : ['Bedroom 1'];
      }

      const hasMaster = selectedRooms.includes('Master Bedroom');

      // Apartment-like interior
      if (aptLike) {
        const classFromBedrooms = inferApartmentClassFromBedroomNumbers(
          input.bedroomCount,
          hasMaster
        );
        const aptClass =
          (typeof input.bedroomCount === 'number' ? classFromBedrooms : undefined) ??
          inferApartmentClassFromSqm(toNumberOrUndefined(input.approxSize)) ??
          classFromBedrooms;

        const anchor = APARTMENT_ANCHORS_OIL[aptClass];

        if (isWhole) {
          const band = ENTIRE_APT_BAND[condition];
          const mid = anchor.median * areaFactor;

          let baseMin = mid * band.min;
          let baseMax = mid * band.max;

          const scaledAnchorMin = anchor.min * areaFactor;
          const scaledAnchorMax = anchor.max * areaFactor;

          baseMin = Math.max(baseMin, scaledAnchorMin);
          baseMax = Math.min(baseMax, scaledAnchorMax);

          intMin = Math.round(baseMin);
          intMax = Math.round(baseMax);
        } else {
          const totalRoomScore = selectedRooms.reduce((sum, r) => sum + roomScore(r), 0);
          const partialRatio = clamp(totalRoomScore / BASE_FULL_APT_SCORE, 0.22, 0.9);

          const baseMid = anchor.median * partialRatio;

          let baseMin = baseMid * 0.88;
          let baseMax = baseMid * 1.22;

          baseMin *= areaFactor;
          baseMax *= areaFactor;

          const pseudoSqm = pseudoSqmFromRooms(selectedRooms);
          if (pseudoSqm >= 24) {
            baseMin *= 1.08;
            baseMax *= 1.15;
          } else if (pseudoSqm >= 16) {
            baseMin *= 1.04;
            baseMax *= 1.10;
          }

          const roomCount = selectedRooms.length;
          const hardFloor =
            roomCount <= 1 ? 1100 : roomCount === 2 ? 1700 : roomCount === 3 ? 2300 : 2900;

          intMin = Math.max(Math.round(baseMin), hardFloor);
          intMax = Math.max(Math.round(baseMax), Math.round(hardFloor * 1.55));

          intMin = Math.round(intMin * condMult.min);
          intMax = Math.round(intMax * condMult.max);
        }
      }

      // House interior
      if (!aptLike) {
        const bedroomsTotal =
          (typeof input.bedroomCount === 'number' && Number.isFinite(input.bedroomCount)
            ? input.bedroomCount
            : 0) + (hasMaster ? 1 : 0);

        const bathroomsTotal =
          (selectedRooms.includes('Bathroom') ? 1 : 0) + (input.paintAreas?.ensuitePaint ? 1 : 0);

        const houseKey = inferHouseKey({
          bedroomsTotal,
          bathroomsTotal,
          approxSizeSqm: toNumberOrUndefined(input.approxSize),
        });

        const houseAnchor = HOUSE_INTERIOR_ANCHORS[houseKey];

        if (isWhole) {
          const band = ENTIRE_HOUSE_BAND[condition];
          const mid = houseAnchor.median * areaFactor;

          intMin = Math.round(mid * band.min);
          intMax = Math.round(mid * band.max);

          const floorMin = Math.round((houseAnchor.min * areaFactor) * 0.98);
          const ceilMax = Math.round((houseAnchor.max * areaFactor) * 1.02);

          intMin = Math.max(intMin, floorMin);
          intMax = Math.min(intMax, ceilMax);
        } else {
          const totalRoomScore = selectedRooms.reduce((sum, r) => sum + roomScore(r), 0);
          const partialRatio = clamp(totalRoomScore / BASE_FULL_HOUSE_SCORE, 0.18, 0.85);

          const baseMid = houseAnchor.median * partialRatio;

          let baseMin = baseMid * 0.86;
          let baseMax = baseMid * 1.24;

          baseMin *= areaFactor;
          baseMax *= areaFactor;

          const pseudoSqm = pseudoSqmFromRooms(selectedRooms);
          if (pseudoSqm >= 28) {
            baseMin *= 1.08;
            baseMax *= 1.16;
          } else if (pseudoSqm >= 18) {
            baseMin *= 1.04;
            baseMax *= 1.10;
          }

          const roomCount = selectedRooms.length;
          const hardFloor =
            roomCount <= 1
              ? 1400
              : roomCount === 2
                ? 2200
                : roomCount === 3
                  ? 3000
                  : roomCount === 4
                    ? 3600
                    : 4200;

          intMin = Math.max(Math.round(baseMin), hardFloor);
          intMax = Math.max(Math.round(baseMax), Math.round(hardFloor * 1.60));

          intMin = Math.round(intMin * houseCondMult.min);
          intMax = Math.round(intMax * houseCondMult.max);
        }
      }

      // difficulty add-ons (interior)
      const diffs = input.jobDifficulty ?? [];
      for (const d of diffs) {
        const a = DIFFICULTY_ADDON[d];
        if (a) {
          intMin += a.min;
          intMax += a.max;
        }
      }

      // storey modifier (interior)
      intMin = Math.round(intMin * storyMult);
      intMax = Math.round(intMax * storyMult);

      if (input.ceilingType === 'Decorative') {
        intMin = Math.round(intMin * 1.10);
        intMax = Math.round(intMax * 1.10);
      }

      // trim options
      if (input.trimPaintOptions) {
        const paintType = input.trimPaintOptions.paintType;
        if (input.scopeOfPainting === 'Entire property') {
          const globalTrimOn = !!input.paintAreas?.trimPaint;
          if (globalTrimOn && paintType === 'Water-based') {
            const itemCount = input.trimPaintOptions.trimItems?.length ?? 0;
            if (itemCount > 0) {
              intMin += TRIM_PREMIUM_ENTIRE_WATER_PER_ITEM.min * itemCount;
              intMax += TRIM_PREMIUM_ENTIRE_WATER_PER_ITEM.max * itemCount;
            }
            const uplifted = applyWaterBasedUpliftTrimShareWholeJob(intMin, intMax);
            intMin = uplifted.min;
            intMax = uplifted.max;
          }
        } else {
          const rooms = input.interiorRooms ?? [];
          const roomsWithTrim = rooms.filter((r) => r.paintAreas?.trimPaint).length;
          const scale = clamp(roomsWithTrim || 0, 0, 10);
          if (scale > 0) {
            const p = TRIM_PREMIUM_SPECIFIC_PER_ROOM[paintType];
            intMin += p.min * scale;
            intMax += p.max * scale;
            if (paintType === 'Water-based') {
              const premMin = p.min * scale;
              const premMax = p.max * scale;
              intMin += Math.round(premMin * WATER_BASED_UPLIFT.minPct);
              intMax += Math.round(premMax * WATER_BASED_UPLIFT.maxPct);
            }
          }
        }
      }

      // widen range by complexity count
      {
        const complexityCount = (input.jobDifficulty ?? []).length;
        const widened = widenRangeByComplexity(intMin, intMax, complexityCount);
        intMin = widened.minVal;
        intMax = widened.maxVal;
      }

      intMin = clamp(intMin, 800, MAX_PRICE_CAP);
      intMax = clamp(intMax, 1200, MAX_PRICE_CAP);

      if (intMax < intMin) intMax = Math.round(intMin * 1.18);

      if (input.scopeOfPainting === 'Entire property' && isApartmentLike(input.propertyType)) {
        const maxAllowed = Math.round(intMin * 1.18);
        if (intMax > maxAllowed) intMax = maxAllowed;
      }
    }

    // -----------------------------
    // Exterior (UPDATED)
    // -----------------------------
    let extMin = 0;
    let extMax = 0;

    if (isExt) {
      // Normalise exterior selections
      let areas = (input.exteriorAreas ?? []).slice();

      // If nothing selected, assume typical minimum exterior scope
      // (Wall + Eaves is the common baseline you mentioned)
      if (!areas.length) areas = ['Wall', 'Eaves'];

      // Always treat Wall as base in exterior refresh model.
      // If user didn’t tick it (edge case), add it so the model remains stable.
      if (!areas.includes('Wall')) areas = ['Wall', ...areas];

      // Base derived from anchor median and size band (gentle)
      const band = pickExteriorBand(toNumberOrUndefined(input.approxSize));
      const baseMid = EXTERIOR_ANCHOR.median;

      let baseMin = baseMid * band.minMult;
      let baseMax = baseMid * band.maxMult;

      // Convert base mid-band into a range around anchor
      // (keeps output stable even if user selects weird combinations)
      baseMin = Math.max(baseMin, EXTERIOR_ANCHOR.min * band.minMult);
      baseMax = Math.min(
        Math.max(baseMax, EXTERIOR_ANCHOR.min * 1.25),
        EXTERIOR_ANCHOR.max * band.maxMult
      );

      // Area uplifts (as % of base)
      let upliftMinPct = 0;
      let upliftMaxPct = 0;

      for (const a of areas) {
        const u = EXTERIOR_AREA_UPLIFT_PCT[a];
        if (!u) continue;
        upliftMinPct += u.minPct;
        upliftMaxPct += u.maxPct;
      }

      // cap uplifts so selecting everything doesn’t explode
      upliftMinPct = clamp(upliftMinPct, 0, 0.95);
      upliftMaxPct = clamp(upliftMaxPct, 0, 1.20);

      let rMin = baseMin * (1 + upliftMinPct);
      let rMax = baseMax * (1 + upliftMaxPct);

      // Condition (exterior-specific)
      rMin *= exteriorCondMult.min;
      rMax *= exteriorCondMult.max;

      // Storey multiplier
      rMin *= storyMult;
      rMax *= storyMult;

      // Difficulty: avoid double counting difficult access on double-storey
      const diffs = input.jobDifficulty ?? [];
      const hasDifficultAccess = diffs.includes('Difficult access areas');

      for (const d of diffs) {
        if (d === 'Difficult access areas') continue; // handle separately below
        const add = DIFFICULTY_ADDON[d];
        if (add) {
          rMin += add.min;
          rMax += add.max;
        }
      }

      // Difficult access handling (key change)
      if (hasDifficultAccess) {
        if (isDouble) {
          // double-storey already captures “access complexity”,
          // so only add a small premium
          rMin *= 1.03;
          rMax *= 1.06;
        } else {
          // single storey can still have steep blocks / limited access etc.
          rMin *= 1.08;
          rMax *= 1.12;
        }
      }

      // Floors for realism
      const hasEaves = areas.includes('Eaves');
      const isWallOnly = areas.length === 1 && areas.includes('Wall');

      const isFullExterior =
        areas.includes('Wall') &&
        areas.includes('Eaves') &&
        areas.includes('Gutter') &&
        areas.includes('Fascia') &&
        areas.includes('Exterior Trim');

      const floor =
        isFullExterior && isDouble
          ? EXTERIOR_FLOORS.doubleStoreyFullExterior
          : isFullExterior
            ? EXTERIOR_FLOORS.fullExterior
            : hasEaves
              ? EXTERIOR_FLOORS.wallPlusEaves
              : isWallOnly
                ? EXTERIOR_FLOORS.wallOnly
                : EXTERIOR_FLOORS.wallOnly;

      rMin = Math.max(rMin, floor);
      rMax = Math.max(rMax, Math.round(floor * 1.25));

      // widen by complexity count
      extMin = Math.round(rMin);
      extMax = Math.round(rMax);

      {
        const complexityCount = (input.jobDifficulty ?? []).length;
        const widened = widenRangeByComplexity(extMin, extMax, complexityCount);
        extMin = widened.minVal;
        extMax = widened.maxVal;
      }

      // clamp
      extMin = clamp(extMin, 1200, MAX_PRICE_CAP);
      extMax = clamp(extMax, 1800, MAX_PRICE_CAP);

      if (extMax < extMin) extMax = Math.round(extMin * 1.25);

      // If it looks like a true “full exterior”, keep under typical cap unless condition is poor + roof etc
      // (still allow combined to reach MAX_PRICE_CAP when both int+ext)
      const selectedRoof = areas.includes('Roof');
      if (!selectedRoof && extMax > 30000) extMax = 30000;
      if (!selectedRoof && extMin > 28000) extMin = 28000;
    }

    // -----------------------------
    // Combine
    // -----------------------------
    let totalMin = intMin + extMin;
    let totalMax = intMax + extMax;

    if (isBoth) {
      totalMin = Math.max(totalMin, COMBINED_ANCHOR.min);
      if (totalMax < COMBINED_ANCHOR.median) totalMax = Math.round(COMBINED_ANCHOR.median * 1.2);
    }

    totalMin = Math.round(totalMin);
    totalMax = Math.round(totalMax);

    if (totalMax > MAX_PRICE_CAP) totalMax = MAX_PRICE_CAP;
    if (totalMin > MAX_PRICE_CAP - 1000) totalMin = MAX_PRICE_CAP - 5000;

    // -----------------------------
    // AI Explanation
    // -----------------------------
    const { output } = await explanationPrompt({
      input,
      priceMin: totalMin,
      priceMax: totalMax,
    });

    if (output?.priceRange) return output;

    const priceRange =
      totalMax >= MAX_PRICE_CAP
        ? `From AUD ${formatMoney(totalMin)}+ (Site Inspection Required)`
        : `AUD ${formatMoney(totalMin)} - ${formatMoney(totalMax)}`;

    return {
      priceRange,
      explanation:
        'This is an indicative estimate based on the information provided and is subject to site inspection for a final quote.',
      details: [],
    };
  }
);