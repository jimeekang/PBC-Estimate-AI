'use server';

/**
 * @fileOverview Data-driven estimate engine (Paint Buddy & Co)
 *
 * Core anchors are based on approved historical averages (Sydney):
 * - Studio: 2,900
 * - 1 Bed: 3,400
 * - 2 Bed: 4,350
 * - 3 Bed: 5,500
 *
 * Range rule (Oil): Low = Base - 8%, High = Base + 18%
 * Water-based premium: +8% ~ +12%
 *
 * Supports:
 * - Entire property: uses property sqm + room selections + area selections
 * - Specific areas only: uses interiorRooms[] (room-level selections)
 *
 * Hard cap: $35,000
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// -----------------------------
// Core Anchors (Approved averages)
// -----------------------------
const APARTMENT_OIL_ANCHORS = {
  Studio: 2900,
  '1Bed': 3400,
  '2Bed': 4350,
  '3Bed': 5500,
} as const;

type AptTier = keyof typeof APARTMENT_OIL_ANCHORS;

const RANGE_OIL = { lowPct: 0.08, highPct: 0.18 }; // Low = -8%, High = +18%
const WATER_PREMIUM = { minPct: 0.08, maxPct: 0.12 }; // +8% ~ +12%
const MAX_PRICE_CAP = 35000;

// -----------------------------
// Interior modelling constants
// -----------------------------
const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.2,
} as const;

const CONDITION_MULTIPLIER = {
  Excellent: { min: 0.98, max: 1.03 },
  Fair: { min: 1.0, max: 1.07 },
  Poor: { min: 1.07, max: 1.18 },
} as const;

// Room weights (relative complexity)
const ROOM_WEIGHT: Record<string, number> = {
  'Master Bedroom': 1.15,
  'Bedroom 1': 1.0,
  'Bedroom 2': 1.0,
  'Bedroom 3': 1.0,
  Bathroom: 1.15,
  'Living Room': 1.35,
  Lounge: 1.2,
  Kitchen: 1.35,
  Laundry: 0.7,
  Hallway: 0.7,
  Foyer: 0.7,
  Handrail: 0.9,
  Etc: 0.8,
};

// For “specific areas”, we need a per-room baseline.
const TIER_TYPICAL_ROOM_UNITS: Record<AptTier, number> = {
  Studio: 2.6,
  '1Bed': 3.6,
  '2Bed': 5.0,
  '3Bed': 6.8,
};

// Room size scaling
const STANDARD_ROOM_SQM = 8; // User requested 8sqm as base reference for bedrooms/rooms
const ROOM_SIZE_SCALE = { min: 0.7, max: 1.6 };

// Trim item add-ons
const TRIM_ITEM_RATES = {
  Doors: { min: 80, max: 160 },
  'Window Frames': { min: 70, max: 150 },
  'Skirting Boards': { min: 120, max: 260 },
} as const;

// Exterior module
const EXTERIOR_ITEM_BASE: Record<string, { min: number; max: number }> = {
  Wall: { min: 2500, max: 9000 },
  Eaves: { min: 1200, max: 3500 },
  Gutter: { min: 600, max: 1800 },
  Fascia: { min: 900, max: 2600 },
  'Exterior Trim': { min: 700, max: 2400 },
};

const EXTERIOR_RISK_MULTIPLIER = { min: 1.1, max: 1.3 };

const EXTERIOR_SIZE_BANDS = [
  { minSqm: 0, maxSqm: 120, minMult: 0.95, maxMult: 1.05 },
  { minSqm: 121, maxSqm: 200, minMult: 1.0, maxMult: 1.15 },
  { minSqm: 201, maxSqm: 1000, minMult: 1.1, maxMult: 1.3 },
] as const;

const DIFFICULTY_ADDON = {
  Stairs: { min: 300, max: 900 },
  'High ceilings': { min: 300, max: 1200 },
  'Extensive mouldings or trims': { min: 250, max: 900 },
  'Difficult access areas': { min: 400, max: 1500 },
} as const;

// -----------------------------
// Helpers
// -----------------------------
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getSizeBand(
  sqm: number | undefined,
  bands: readonly { minSqm: number; maxSqm: number; minMult: number; maxMult: number }[]
) {
  if (!sqm || sqm <= 0) return null;
  return bands.find((b) => sqm >= b.minSqm && sqm <= b.maxSqm) ?? bands[bands.length - 1];
}

function inferApartmentTier(sqm?: number, roomsToPaint?: string[]): AptTier {
  if (sqm && sqm > 0) {
    if (sqm <= 35) return 'Studio';
    if (sqm <= 55) return '1Bed';
    if (sqm <= 85) return '2Bed';
    return '3Bed';
  }

  const rooms = roomsToPaint || [];
  const hasBed2 = rooms.includes('Bedroom 2');
  const hasBed3 = rooms.includes('Bedroom 3');
  const hasMaster = rooms.includes('Master Bedroom');

  if (hasBed3) return '3Bed';
  if (hasBed2) return '2Bed';
  if (hasMaster || rooms.includes('Bedroom 1')) return '1Bed';
  return 'Studio';
}

function computeAreaFactor(area: { ceilingPaint: boolean; wallPaint: boolean; trimPaint: boolean }) {
  let f = 0;
  if (area.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (area.wallPaint) f += AREA_SHARE.wallPaint;
  if (area.trimPaint) f += AREA_SHARE.trimPaint;
  return f > 0 ? f : AREA_SHARE.wallPaint;
}

function applyRangeFromBase(base: number) {
  const low = Math.round(base * (1 - RANGE_OIL.lowPct));
  const high = Math.round(base * (1 + RANGE_OIL.highPct));
  return { min: low, max: high };
}

// -----------------------------
// Schema
// -----------------------------
const InteriorRoomItemSchema = z.object({
  roomName: z.enum([
    'Master Bedroom',
    'Bedroom 1',
    'Bedroom 2',
    'Bedroom 3',
    'Bathroom',
    'Living Room',
    'Lounge',
    'Kitchen',
    'Laundry',
    'Hallway',
    'Foyer',
    'Handrail',
    'Etc',
  ]),
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
  roomsToPaint: z.array(z.string()).optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.number().optional(),
  location: z.string().optional(),
  existingWallColour: z.string().optional(),
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
});

const GeneratePaintingEstimateOutputSchema = z.object({
  priceRange: z.string(),
  explanation: z.string(),
  details: z.array(z.string()).optional(),
});

export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

// -----------------------------
// Explanation prompt
// -----------------------------
const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  input: {
    schema: z.object({
      input: GeneratePaintingEstimateInputSchema,
      priceMin: z.number(),
      priceMax: z.number(),
      internalNotes: z.array(z.string()).optional(),
    }),
  },
  output: { schema: GeneratePaintingEstimateOutputSchema },
  prompt: `
You are a professional painting estimator in Australia for "Paint Buddy & Co".

Your role is to clearly explain why a specific price range was generated.
Write in Australian English. Do NOT mention internal multipliers.

# CONTEXT
- Property: {{input.propertyType}}
- Scope: {{input.scopeOfPainting}}
- Work: {{#each input.typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Approx size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}N/A (Individual room-based logic used){{/if}}
- Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}

# GENERATED PRICE (AUD)
Min: {{priceMin}}
Max: {{priceMax}}

# NOTES (internal)
{{#if internalNotes}}
{{#each internalNotes}}- {{this}}
{{/each}}
{{/if}}

# INSTRUCTIONS
1) explanation: Professional summary focusing on main cost drivers.
2) priceRange formatting: AUD [Min] - [Max] (with commas).
3) details: 3–5 bullet points.
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
    const isWhole = input.scopeOfPainting === 'Entire property';

    let totalMin = 0;
    let totalMax = 0;
    const notes: string[] = [];

    if (isInt) {
      // Tier inferred from sqm for whole property, or fallback to rooms for specific areas
      const tier = inferApartmentTier(isWhole ? input.approxSize : undefined, input.roomsToPaint);
      const tierBaseOil = APARTMENT_OIL_ANCHORS[tier];
      notes.push(`Interior anchor tier: ${tier}`);

      if (isWhole) {
        const { min: baseMin, max: baseMax } = applyRangeFromBase(tierBaseOil);
        const areaFactor = computeAreaFactor(input.paintAreas);

        let intMin = baseMin * areaFactor;
        let intMax = baseMax * areaFactor;

        if (input.paintAreas.ensuitePaint) {
          intMin += 300;
          intMax += 700;
          notes.push('Included master ensuite (global)');
        }

        const trimType = input.trimPaintOptions?.paintType;
        if (input.paintAreas.trimPaint && trimType === 'Water-based') {
          intMin *= 1 + WATER_PREMIUM.minPct;
          intMax *= 1 + WATER_PREMIUM.maxPct;
        }

        const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
        intMin *= cond.min;
        intMax *= cond.max;

        if (input.jobDifficulty?.length) {
          input.jobDifficulty.forEach((d) => {
            const add = DIFFICULTY_ADDON[d];
            if (add) {
              intMin += add.min;
              intMax += add.max;
            }
          });
        }

        totalMin += Math.max(intMin, 950);
        totalMax += Math.max(intMax, intMin * 1.2);
      } else {
        const rooms = input.interiorRooms || [];
        const perUnit = tierBaseOil / TIER_TYPICAL_ROOM_UNITS[tier];
        let intMin = 0;
        let intMax = 0;

        rooms.forEach((r) => {
          const w = ROOM_WEIGHT[r.roomName] ?? 1.0;
          const areaFactor = computeAreaFactor(r.paintAreas);

          // If no specific room size is provided, the scale is 1.0 (based on STANDARD_ROOM_SQM=8)
          let sizeScale = 1.0;
          if (r.approxRoomSize && r.approxRoomSize > 0) {
            sizeScale = Math.sqrt(r.approxRoomSize / STANDARD_ROOM_SQM);
            sizeScale = clamp(sizeScale, ROOM_SIZE_SCALE.min, ROOM_SIZE_SCALE.max);
          }

          const roomBase = perUnit * w * areaFactor * sizeScale;
          let roomMin = roomBase * 0.88;
          let roomMax = roomBase * 1.22;

          if (r.roomName === 'Master Bedroom' && r.paintAreas.ensuitePaint) {
            roomMin += 250;
            roomMax += 550;
          }

          // Global trim settings apply if trimPaint is checked for this room
          if (r.paintAreas.trimPaint) {
            const items = input.trimPaintOptions?.trimItems || [];
            items.forEach((it) => {
              const rate = TRIM_ITEM_RATES[it];
              if (rate) {
                roomMin += rate.min;
                roomMax += rate.max;
              }
            });

            if (input.trimPaintOptions?.paintType === 'Water-based') {
              roomMin *= 1 + WATER_PREMIUM.minPct;
              roomMax *= 1 + WATER_PREMIUM.maxPct;
            }
          }

          intMin += roomMin;
          intMax += roomMax;
        });

        const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
        intMin *= cond.min;
        intMax *= cond.max;

        if (input.jobDifficulty?.length) {
          input.jobDifficulty.forEach((d) => {
            const add = DIFFICULTY_ADDON[d];
            if (add) {
              intMin += add.min;
              intMax += add.max;
            }
          });
        }

        totalMin += Math.max(intMin, 650);
        totalMax += Math.max(intMax, intMin * 1.25);
      }
    }

    if (isExt) {
      let extSumMin = 0;
      let extSumMax = 0;
      (input.exteriorAreas || []).forEach((area) => {
        const base = EXTERIOR_ITEM_BASE[area];
        if (base) {
          extSumMin += base.min;
          extSumMax += base.max;
        }
      });

      let extMin = extSumMin * EXTERIOR_RISK_MULTIPLIER.min;
      let extMax = extSumMax * EXTERIOR_RISK_MULTIPLIER.max;

      const band = getSizeBand(input.approxSize, EXTERIOR_SIZE_BANDS);
      if (band) {
        extMin *= band.minMult;
        extMax *= band.maxMult;
      }

      totalMin += extMin;
      totalMax += extMax;
    }

    totalMin = Math.round(totalMin);
    totalMax = Math.round(totalMax);

    if (totalMax > MAX_PRICE_CAP) totalMax = MAX_PRICE_CAP;

    const { output } = await explanationPrompt({
      input,
      priceMin: totalMin,
      priceMax: totalMax,
      internalNotes: notes.slice(0, 5),
    });

    return output!;
  }
);
