'use server';

/**
 * @fileOverview Data-driven AI agent to estimate the painting price range.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ---------------------------------------------
// Anchors (replace/tune with your 1-year data)
// ---------------------------------------------
const ANCHORS = {
  Interior: { min: 2500, max: 8000, median: 3000 },
  Exterior: { min: 6500, max: 16000, median: 10650 },
  InteriorExterior: { min: 12000, max: 30000, median: 19000 },
};

const MAX_PRICE_CAP = 35000;

// ---------------------------------------------
// Interior constants
// ---------------------------------------------
const ROOM_WEIGHT: Record<string, number> = {
  'Master Bedroom': 1.2,
  'Bedroom 1': 1.0,
  'Bedroom 2': 1.0,
  'Bedroom 3': 1.0,
  'Bathroom': 1.1,
  'Kitchen': 1.3,
  'Living Room': 1.4,
  'Lounge': 1.2,
  'Laundry': 0.7,
  'Hallway': 0.8,
  'Foyer': 0.9,
  'Handrail': 0.5,
  'Etc': 0.6,
};

const BASE_ROOM_SCORE = 3.0; // baseline of ~2-3 rooms

// Fraction of total labour/cost for each area
const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.2,
  ensuitePaint: 0.4, // Add-on for ensuite
};

const TRIM_TYPE_MULTIPLIER = {
  'Oil-based': { min: 1.0, max: 1.05 },
  'Water-based': { min: 1.1, max: 1.25 },
};

const TRIM_ITEM_RATES = {
  Doors: { min: 120, max: 220 },
  'Window Frames': { min: 90, max: 180 },
  'Skirting Boards': { min: 6 * 16, max: 12 * 16 },
};

const INTERIOR_SIZE_BANDS = [
  { minSqm: 0, maxSqm: 60, minMult: 0.95, maxMult: 1.1 },
  { minSqm: 61, maxSqm: 120, minMult: 1.05, maxMult: 1.3 },
  { minSqm: 121, maxSqm: 200, minMult: 1.15, maxMult: 1.45 },
  { minSqm: 201, maxSqm: 1000, minMult: 1.3, maxMult: 1.7 },
];

// ---------------------------------------------
// Exterior constants
// ---------------------------------------------
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
];

// ---------------------------------------------
// Common adjustments
// ---------------------------------------------
const CONDITION_MULTIPLIER = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 1.1, max: 1.25 },
  Poor: { min: 1.25, max: 1.6 },
};

const DIFFICULTY_ADDON = {
  Stairs: { min: 300, max: 900 },
  'High ceilings': { min: 300, max: 1200 },
  'Extensive mouldings or trims': { min: 250, max: 900 },
  'Difficult access areas': { min: 400, max: 1500 },
};

// ---------------------------------------------
// Helpers
// ---------------------------------------------
function getSizeBand(
  sqm: number | undefined,
  bands: { minSqm: number; maxSqm: number; minMult: number; maxMult: number }[]
) {
  if (!sqm) return null;
  return bands.find((b) => sqm >= b.minSqm && sqm <= b.maxSqm) ?? bands[bands.length - 1];
}

function calcAreaFactor(paintAreas: { ceilingPaint: boolean; wallPaint: boolean; trimPaint: boolean; ensuitePaint?: boolean }) {
  let f = 0;
  if (paintAreas.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (paintAreas.wallPaint) f += AREA_SHARE.wallPaint;
  if (paintAreas.trimPaint) f += AREA_SHARE.trimPaint;
  
  let factor = f > 0 ? f : 0.1; // minimum factor if nothing selected but room exists
  
  if (paintAreas.ensuitePaint) {
    factor += AREA_SHARE.ensuitePaint;
  }
  
  return factor;
}

function clampRange(min: number, max: number) {
  const mid = (min + max) / 2;
  const width = max - min;
  const minWidthAbs = 1200;
  const maxWidthAbs = 6500;
  const minWidthPct = 0.15;
  const maxWidthPct = 0.35;
  const minWidth = Math.max(minWidthAbs, mid * minWidthPct);
  const maxWidth = Math.min(maxWidthAbs, mid * maxWidthPct);
  let nextWidth = width;
  nextWidth = Math.max(nextWidth, minWidth);
  nextWidth = Math.min(nextWidth, maxWidth);

  return {
    min: Math.round(mid - nextWidth / 2),
    max: Math.round(mid + nextWidth / 2),
  };
}

// ---------------------------------------------
// NEW: room line-item calculator (Specific scope)
// ---------------------------------------------
function calcInteriorSpecificFromRooms(input: GeneratePaintingEstimateInput) {
  const rooms = input.interiorRooms ?? [];
  if (!rooms.length) return { min: 0, max: 0 };

  const anchor = ANCHORS.Interior;
  const unitMin = anchor.min / BASE_ROOM_SCORE;
  const unitMax = anchor.max / BASE_ROOM_SCORE;

  let sumMin = 0;
  let sumMax = 0;

  for (const r of rooms) {
    const w = ROOM_WEIGHT[r.roomName] ?? 0.6;
    let roomMin = unitMin * w;
    let roomMax = unitMax * w;
    const areaFactor = calcAreaFactor(r.paintAreas);
    roomMin *= areaFactor;
    roomMax *= areaFactor;

    if (r.paintAreas.trimPaint && r.trimPaintOptions) {
      const { paintType, trimItems } = r.trimPaintOptions;
      let itemsBaseMin = 0;
      let itemsBaseMax = 0;
      (trimItems ?? []).forEach((item) => {
        const rate = TRIM_ITEM_RATES[item];
        if (rate) {
          itemsBaseMin += rate.min;
          itemsBaseMax += rate.max;
        }
      });
      const m = TRIM_TYPE_MULTIPLIER[paintType];
      roomMin += itemsBaseMin * (m?.min ?? 1.0);
      roomMax += itemsBaseMax * (m?.max ?? 1.1);
    }
    sumMin += roomMin;
    sumMax += roomMax;
  }

  const callOutMin = 1200;
  sumMin = Math.max(sumMin, callOutMin);
  sumMax = Math.max(sumMax, callOutMin * 1.6);

  return { min: sumMin, max: sumMax };
}

function calcInteriorWholeProperty(input: GeneratePaintingEstimateInput) {
  const anchor = ANCHORS.Interior;
  let baseMin = anchor.min;
  let baseMax = anchor.max;
  const rooms = input.roomsToPaint || [];
  const roomCount = rooms.length;
  let roomFactor = 1.0;
  if (roomCount <= 1) roomFactor = 1.15;
  else if (roomCount <= 3) roomFactor = 1.05;
  else roomFactor = 1.0;
  baseMin *= roomFactor;
  baseMax *= roomFactor;
  const areaFactor = calcAreaFactor(input.paintAreas);
  const iBand = getSizeBand(input.approxSize, INTERIOR_SIZE_BANDS);
  if (iBand) {
    baseMin *= iBand.minMult;
    baseMax *= iBand.maxMult;
  } else {
    baseMin *= 1.1;
    baseMax *= 1.2;
  }
  let intMin = baseMin * areaFactor;
  let intMax = baseMax * areaFactor;
  const sqm = input.approxSize;
  const minFloor = sqm ? (sqm >= 40 ? 3200 : 2800) : 3800;
  intMin = Math.max(intMin, minFloor);
  intMax = Math.max(intMax, minFloor * 1.6);
  return { min: intMin, max: intMax };
}

function calcExterior(input: GeneratePaintingEstimateInput) {
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
  if (input.approxSize) {
    const band = EXTERIOR_SIZE_BANDS.find((b) => input.approxSize! >= b.minSqm && input.approxSize! <= b.maxSqm) || EXTERIOR_SIZE_BANDS[EXTERIOR_SIZE_BANDS.length - 1];
    extMin *= band.minMult;
    extMax *= band.maxMult;
  }
  const requiredItems = ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'];
  const isFullExt = requiredItems.every((item) => (input.exteriorAreas || []).includes(item));
  if (isFullExt) {
    extMin = Math.max(extMin, ANCHORS.Exterior.min);
    extMax = Math.max(extMax, ANCHORS.Exterior.min * 1.3);
  }
  return { min: extMin, max: extMax };
}

// ---------------------------------------------
// Schema
// ---------------------------------------------
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
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }),
  approxRoomSize: z.number().optional(),
  trimPaintOptions: z
    .object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
    .optional(),
});

const GeneratePaintingEstimateInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string(),
  roomsToPaint: z.array(z.string()).optional(),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.number().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
  }),
  trimPaintOptions: z.optional(
    z.object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
  ),
});

const GeneratePaintingEstimateOutputSchema = z.object({
  priceRange: z.string(),
  explanation: z.string(),
  details: z.array(z.string()).optional(),
});

export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

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

# CONTEXT
- Property type: {{input.propertyType}}
- Scope: {{input.scopeOfPainting}}
- Work type: {{#each input.typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Approx Size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Not specified{{/if}}
- Paint Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}

# GENERATED PRICE DATA (AUD)
Min: {{priceMin}}
Max: {{priceMax}}

# INSTRUCTIONS
1. explanation: Professional summary (3-5 sentences). Mention cost drivers (scope, size, condition, access).
2. priceRange: Format numbers with commas. If priceMax >= 35,000, "From AUD {{priceMin}}+ (Site Inspection Required)".
3. details: Bulleted list of 3-5 key factors.
`,
});

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
    let intMin = 0;
    let intMax = 0;
    let extMin = 0;
    let extMax = 0;

    if (isInt) {
      const isWhole = input.scopeOfPainting === 'Entire property';
      if (!isWhole && input.interiorRooms?.length) {
        const r = calcInteriorSpecificFromRooms(input);
        intMin = r.min;
        intMax = r.max;
      } else {
        const r = calcInteriorWholeProperty(input);
        intMin = r.min;
        intMax = r.max;
      }
    }

    if (isExt) {
      const r = calcExterior(input);
      extMin = r.min;
      extMax = r.max;
    }

    let totalMin = intMin + extMin;
    let totalMax = intMax + extMax;

    if (isBoth) {
      totalMin = Math.max(totalMin, ANCHORS.InteriorExterior.min);
      if (totalMax < ANCHORS.InteriorExterior.median) {
        totalMax = ANCHORS.InteriorExterior.median * 1.2;
      }
    }

    const isWhole = input.scopeOfPainting === 'Entire property';
    if (isWhole && input.paintAreas.trimPaint && input.trimPaintOptions) {
      const { paintType } = input.trimPaintOptions;
      const baseTrimPremium = paintType === 'Water-based' ? { min: 500, max: 1400 } : { min: 300, max: 900 };
      totalMin += baseTrimPremium.min;
      totalMax += baseTrimPremium.max;
    }

    const cond = CONDITION_MULTIPLIER[input.paintCondition || 'Fair'];
    totalMin *= cond.min;
    totalMax *= cond.max;

    if (input.jobDifficulty) {
      input.jobDifficulty.forEach((diff) => {
        const addon = DIFFICULTY_ADDON[diff as keyof typeof DIFFICULTY_ADDON];
        if (addon) {
          totalMin += addon.min;
          totalMax += addon.max;
        }
      });
    }

    const clamped = clampRange(totalMin, totalMax);
    totalMin = clamped.min;
    totalMax = clamped.max;
    totalMin = Math.round(totalMin);
    totalMax = Math.round(totalMax);

    if (totalMax > MAX_PRICE_CAP) totalMax = MAX_PRICE_CAP;
    if (totalMin > MAX_PRICE_CAP - 1000) totalMin = MAX_PRICE_CAP - 5000;

    const { output } = await explanationPrompt({
      input,
      priceMin: totalMin,
      priceMax: totalMax,
    });
    return output!;
  }
);
