'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

/**
 * Marketing-range estimator (Sydney, approved historical averages)
 *
 * Base package definition (Oil-based):
 * - Ceiling + Walls + Trim (doors/frames/skirting 포함)
 * - Sydney market
 * - Approved historical averages
 *
 * Anchors (approved averages, Oil):
 * Studio: 2,900
 * 1 Bed: 3,400
 * 2 Bed: 4,350
 * 3 Bed: 5,500
 *
 * Range rule:
 * Low = Base - 8%  (0.92)
 * High = Base + 18% (1.18)
 *
 * Water-based uplift (only when Trim selected):
 * +8% ~ +12%
 *
 * sqm adjustment (ONLY for Entire property):
 * small controlled adjustment (max about +7%)
 *
 * Condition/Difficulty:
 * small controlled adjustments (avoid wide ranges)
 */

// --------------------
// Anchors (Oil-based)
// --------------------
const APARTMENT_OIL_BASE = {
  Studio: 2900,
  Bed1: 3400,
  Bed2: 4350,
  Bed3: 5500,
} as const;

type AptBand = keyof typeof APARTMENT_OIL_BASE;

const RANGE = {
  lowPct: 0.92, // -8%
  highPct: 1.18, // +18%
} as const;

// Water-based uplift (min/max) - apply only if trim selected
const WATER_UPLIFT = { min: 1.08, max: 1.12 } as const;
const OIL_UPLIFT = { min: 1.0, max: 1.02 } as const; // optional small spread

// --------------------
// Room weights (relative effort)
// --------------------
const ROOM_WEIGHT: Record<string, number> = {
  'Master Bedroom': 1.15,
  'Bedroom 1': 1.0,
  'Bedroom 2': 1.0,
  'Bedroom 3': 1.0,

  Ensuite: 0.9,
  Bathroom: 1.05,

  'Living Room': 1.25,
  Livingroom: 1.25, // legacy
  Lounge: 1.1,

  Kitchen: 1.15,
  Laundry: 0.6,
  Hallway: 0.6,
  Foyer: 0.5,
  Handrail: 0.45,
  Etc: 0.5,
};

// Base package area shares (Ceiling/Walls/Trim)
const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.20,
} as const;

// --------------------
// sqm adjustment bands (small, controlled)
// Entire property ONLY
// --------------------
const APT_SQM_BANDS: Record<
  AptBand,
  Array<{ min: number; max: number; minMult: number; maxMult: number }>
> = {
  Studio: [
    { min: 0, max: 35, minMult: 0.97, maxMult: 1.02 },
    { min: 36, max: 55, minMult: 1.0, maxMult: 1.05 },
    { min: 56, max: 1000, minMult: 1.03, maxMult: 1.07 },
  ],
  Bed1: [
    { min: 0, max: 45, minMult: 0.97, maxMult: 1.02 },
    { min: 46, max: 70, minMult: 1.0, maxMult: 1.05 },
    { min: 71, max: 1000, minMult: 1.03, maxMult: 1.07 },
  ],
  Bed2: [
    { min: 0, max: 60, minMult: 0.97, maxMult: 1.02 },
    { min: 61, max: 95, minMult: 1.0, maxMult: 1.05 },
    { min: 96, max: 1000, minMult: 1.03, maxMult: 1.07 },
  ],
  Bed3: [
    { min: 0, max: 90, minMult: 0.97, maxMult: 1.02 },
    { min: 91, max: 130, minMult: 1.0, maxMult: 1.05 },
    { min: 131, max: 1000, minMult: 1.03, maxMult: 1.07 },
  ],
};

// --------------------
// small, controlled adjustments (avoid big range expansion)
// --------------------
const CONDITION_BUMP = {
  Excellent: { min: 0.98, max: 1.03 },
  Fair: { min: 1.0, max: 1.06 },
  Poor: { min: 1.05, max: 1.14 },
} as const;

const DIFFICULTY_ADDON = {
  Stairs: { min: 120, max: 400 },
  'High ceilings': { min: 120, max: 500 },
  'Extensive mouldings or trims': { min: 120, max: 450 },
  'Difficult access areas': { min: 150, max: 650 },
} as const;

// --------------------
// Schema
// --------------------
const GeneratePaintingEstimateInputSchema = z.object({
  name: z.string(),
  email: z.string(),
  phone: z.string().optional(),

  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string(),

  roomsToPaint: z.array(z.string()).optional(),
  exteriorAreas: z.array(z.string()).optional(),

  approxSize: z.number().optional(),
  location: z.string().optional(),
  existingWallColour: z.string().optional(),

  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z
    .array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas']))
    .optional(),

  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
  }),

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

// --------------------
// Helpers
// --------------------
function formatAud(n: number) {
  return n.toLocaleString('en-AU');
}

function areaFactorFromGlobal(paintAreas: GeneratePaintingEstimateInput['paintAreas']) {
  let f = 0;
  if (paintAreas.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (paintAreas.wallPaint) f += AREA_SHARE.wallPaint;
  if (paintAreas.trimPaint) f += AREA_SHARE.trimPaint;
  return f > 0 ? f : 1.0;
}

// bedroom count inference from selected rooms
function inferApartmentBand(roomsToPaint: string[] | undefined): AptBand {
  const rooms = roomsToPaint ?? [];
  const bedroomCount = rooms.filter((r) => r.includes('Bedroom') || r === 'Master Bedroom').length;

  if (bedroomCount <= 0) return 'Studio';
  if (bedroomCount === 1) return 'Bed1';
  if (bedroomCount === 2) return 'Bed2';
  return 'Bed3';
}

// expected full-scope score by band (used for coverage scaling)
function expectedFullScore(band: AptBand) {
  // Typical room composition assumptions (tune later with your real dataset)
  const baseRooms: Record<AptBand, string[]> = {
    Studio: ['Living Room', 'Bathroom', 'Kitchen'],
    Bed1: ['Bedroom 1', 'Living Room', 'Bathroom', 'Kitchen', 'Laundry'],
    Bed2: ['Bedroom 1', 'Bedroom 2', 'Living Room', 'Bathroom', 'Kitchen', 'Laundry', 'Hallway'],
    Bed3: ['Bedroom 1', 'Bedroom 2', 'Bedroom 3', 'Living Room', 'Bathroom', 'Kitchen', 'Laundry', 'Hallway'],
  };

  const list = baseRooms[band];
  return list.reduce((sum, r) => sum + (ROOM_WEIGHT[r] ?? 0.7), 0);
}

function selectedRoomsScore(rooms: string[]) {
  if (!rooms.length) return 0;
  return rooms.reduce((sum, r) => sum + (ROOM_WEIGHT[r] ?? 0.7), 0);
}

// coverage factor for "Specific areas only"
function coverageFactor(input: GeneratePaintingEstimateInput, band: AptBand) {
  const rooms = input.roomsToPaint ?? [];
  const roomsScore = selectedRoomsScore(rooms);
  const fullScore = expectedFullScore(band);

  // area share (global selection)
  const aFactor = areaFactorFromGlobal(input.paintAreas);

  // coverage = (selected room effort / typical full effort) * areaShare
  // clamp to prevent extreme results
  const raw = fullScore > 0 ? (roomsScore / fullScore) * aFactor : aFactor;
  return Math.max(0.22, Math.min(1.0, raw));
}

function applySqmAdjustment(band: AptBand, sqm: number | undefined, min: number, max: number) {
  if (!sqm) return { min, max };

  const bands = APT_SQM_BANDS[band];
  const b = bands.find((x) => sqm >= x.min && sqm <= x.max) ?? bands[bands.length - 1];

  return {
    min: min * b.minMult,
    max: max * b.maxMult,
  };
}

function applyTrimPaintTypeUplift(input: GeneratePaintingEstimateInput, min: number, max: number) {
  // Uplift only if trim is selected
  if (!input.paintAreas.trimPaint) return { min, max };

  const type = input.trimPaintOptions?.paintType ?? 'Oil-based';
  const uplift = type === 'Water-based' ? WATER_UPLIFT : OIL_UPLIFT;

  return { min: min * uplift.min, max: max * uplift.max };
}

function applyConditionAndDifficulty(input: GeneratePaintingEstimateInput, min: number, max: number) {
  const condKey = input.paintCondition ?? 'Fair';
  const cond = CONDITION_BUMP[condKey];

  let outMin = min * cond.min;
  let outMax = max * cond.max;

  (input.jobDifficulty ?? []).forEach((d) => {
    const add = DIFFICULTY_ADDON[d as keyof typeof DIFFICULTY_ADDON];
    if (add) {
      outMin += add.min;
      outMax += add.max;
    }
  });

  return { min: outMin, max: outMax };
}

// keep range not too wide (recommended)
function clampRangeAroundBase(base: number, min: number, max: number) {
  // prevent extreme spread vs base
  const desiredMin = base * 0.88;
  const desiredMax = base * 1.35;

  return {
    min: Math.max(min, desiredMin),
    max: Math.min(max, desiredMax),
  };
}

// --------------------
// Genkit explanation prompt
// --------------------
const explanationPrompt = ai.definePrompt({
  name: 'explanationPrompt',
  input: {
    schema: z.object({
      input: GeneratePaintingEstimateInputSchema,
      priceMin: z.number(),
      priceMax: z.number(),
      band: z.string(),
    }),
  },
  output: { schema: GeneratePaintingEstimateOutputSchema },
  prompt: `
You are a professional painting estimator in Australia for "Paint Buddy & Co".

# CONTEXT
- Property type: {{input.propertyType}}
- Scope: {{input.scopeOfPainting}}
- Work type: {{#each input.typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
- Apartment band (auto): {{band}}
- Approx size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Not specified{{/if}}
- Rooms selected: {{#if input.roomsToPaint}}{{#each input.roomsToPaint}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}Not specified{{/if}}
- Paint areas: {{#if input.paintAreas.ceilingPaint}}Ceiling{{/if}} {{#if input.paintAreas.wallPaint}}Walls{{/if}} {{#if input.paintAreas.trimPaint}}Trim{{/if}}
- Paint condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}

# GENERATED PRICE DATA (AUD)
Min: {{priceMin}}
Max: {{priceMax}}

# INSTRUCTIONS
1) explanation: 3-5 sentences. Australian English. Mention scope/rooms, selected paint areas, condition, and access complexity.
   Do NOT mention formulas or internal weights. State it is an indicative estimate subject to inspection.
2) priceRange:
   - If priceMax is 0, show "Contact us for a tailored quote".
   - Otherwise format "AUD X - Y" with commas.
3) details: 3-5 bullets, specific to this job.
`,
});

// --------------------
// Flow
// --------------------
export const generatePaintingEstimate = ai.defineFlow(
  {
    name: 'generatePaintingEstimateFlow',
    inputSchema: GeneratePaintingEstimateInputSchema,
    outputSchema: GeneratePaintingEstimateOutputSchema,
  },
  async (input) => {
    const isInt = input.typeOfWork.includes('Interior Painting');

    if (!isInt) {
      const { output } = await explanationPrompt({
        input,
        priceMin: 0,
        priceMax: 0,
        band: 'N/A',
      });
      return output!;
    }

    // ✅ Apartment band inference (Studio/1/2/3)
    const band = inferApartmentBand(input.roomsToPaint);
    const baseOil = APARTMENT_OIL_BASE[band];

    // ✅ Base marketing range rule
    let min = baseOil * RANGE.lowPct;
    let max = baseOil * RANGE.highPct;

    // ✅ sqm adjustment (ONLY for Entire property)
    if (input.scopeOfPainting === 'Entire property') {
      const adj = applySqmAdjustment(band, input.approxSize, min, max);
      min = adj.min;
      max = adj.max;
    }

    // ✅ Coverage scaling for Specific scope
    if (input.scopeOfPainting === 'Specific areas only') {
      const cov = coverageFactor(input, band);
      min *= cov;
      max *= cov;

      // Minimum charge floor for small jobs (tune as you like)
      const smallJobMin = 1200;
      min = Math.max(min, smallJobMin);
      max = Math.max(max, smallJobMin * 1.6);
    }

    // ✅ Trim paint type uplift (Water-based)
    const afterUplift = applyTrimPaintTypeUplift(input, min, max);
    min = afterUplift.min;
    max = afterUplift.max;

    // ✅ Condition & difficulty (small controlled adjustments)
    const afterAdj = applyConditionAndDifficulty(input, min, max);
    min = afterAdj.min;
    max = afterAdj.max;

    // ✅ Range sanity clamp (avoid over-wide results)
    const clamped = clampRangeAroundBase(baseOil, min, max);
    min = clamped.min;
    max = clamped.max;

    // rounding
    min = Math.round(min);
    max = Math.round(max);

    // AI explanation
    const { output } = await explanationPrompt({
      input,
      priceMin: min,
      priceMax: max,
      band,
    });

    // Safe guard formatting
    if (output && min > 0 && max > 0) {
      output.priceRange = `AUD ${formatAud(min)} - ${formatAud(max)}`;
    } else if (output && max === 0) {
      output.priceRange = 'Contact us for a tailored quote';
    }

    return output!;
  }
);
