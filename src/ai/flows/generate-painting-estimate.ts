'use server';

/**
 * @fileOverview Data-driven AI agent to estimate painting price range.
 *
 * Anchors are calibrated to Sydney averages.
 * Includes house-specific modifiers for room counts and condition.
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

const EXTERIOR_ANCHOR = { min: 6500, max: 16000, median: 10650 } as const;
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
  Livingroom: 1.35,
  Lounge: 1.2,
  Kitchen: 1.3,
  Laundry: 0.7,
  Hallway: 0.6,
  Foyer: 0.6,
  Handrail: 0.6,
  Dining: 1.0,
  'Study / Office': 1.0,
  Stairwell: 1.2,
  'Walk-in robe': 0.5,
  Etc: 0.6,
};

const BASE_FULL_APT_SCORE = 6.3;

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
// Exterior modelling
// -----------------------------
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

function roomScore(roomName: string) {
  return ROOM_WEIGHT[roomName] ?? 0.6;
}

function pseudoSqmFromRooms(selectedRooms: string[]) {
  const base = selectedRooms.length * 8;
  const bonus =
    (selectedRooms.includes('Bathroom') ? 4 : 0) +
    (selectedRooms.includes('Kitchen') ? 3 : 0) +
    (selectedRooms.includes('Living Room') || selectedRooms.includes('Livingroom') ? 3 : 0);
  return base + bonus;
}

function isApartmentLike(propertyType?: string) {
  const p = (propertyType ?? '').toLowerCase();
  return p.includes('apartment') || p.includes('unit') || p.includes('flat');
}

function sumAreaFactor(flags: { ceilingPaint?: boolean; wallPaint?: boolean; trimPaint?: boolean; ensuitePaint?: boolean }) {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  if (flags.ensuitePaint) f += AREA_SHARE.ensuitePaint;
  return f > 0 ? f : 1.0;
}

function sumAreaFactorWholeApartment(flags: { ceilingPaint?: boolean; wallPaint?: boolean; trimPaint?: boolean; ensuitePaint?: boolean }) {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  if (flags.ensuitePaint) f += AREA_SHARE.ensuitePaint;
  return f > 0 ? f : 1.0;
}

function inferApartmentClassFromBedroomNumbers(bedroomCountInput?: number, hasMasterBedroom?: boolean) {
  const extra = typeof bedroomCountInput === 'number' && Number.isFinite(bedroomCountInput) ? bedroomCountInput : 0;
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
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
    ensuitePaint: z.boolean().optional(),
  }).optional(),
  interiorRooms: z.array(InteriorRoomItemSchema).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.number().optional(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),
  trimPaintOptions: z.object({
    paintType: z.enum(['Oil-based', 'Water-based']),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
  }).optional(),
  ceilingType: z.enum(['Flat', 'Decorative']).optional(),
});

const GeneratePaintingEstimateOutputSchema = z.object({
  priceRange: z.string(),
  explanation: z.string(),
  details: z.array(z.string()).optional(),
});

export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

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
- Approx Size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Calculated from room selections{{/if}}
- Paint Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}
- Ceiling Style: {{#if input.ceilingType}}{{input.ceilingType}}{{else}}Flat{{/if}}

GENERATED PRICE DATA (AUD)
Min: {{priceMin}}
Max: {{priceMax}}

INSTRUCTIONS
1) explanation: 3–5 sentences, Australian English, professional tone.
   Focus on the main cost drivers: scope, condition, selected areas, stories, and complexity factors (like decorative ceilings or trim).
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
    const storyMult = input.houseStories ? (STORY_MODIFIER[input.houseStories] || 1.0) : 1.0;

    // -------------------------
    // 1) Interior
    // -------------------------
    let intMin = 0;
    let intMax = 0;

    if (isInt) {
      const isWhole = input.scopeOfPainting === 'Entire property';
      const aptLike = isApartmentLike(input.propertyType);

      let selectedRooms: string[] = [];
      let areaFactor = 1.0;

      if (isWhole) {
        selectedRooms = (input.roomsToPaint ?? []).length ? (input.roomsToPaint ?? []) : [];
        const globalAreas = input.paintAreas ?? { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false };

        if (aptLike) {
          areaFactor = sumAreaFactorWholeApartment(globalAreas);
        } else {
          areaFactor = sumAreaFactor(globalAreas);
        }
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
        selectedRooms = isWhole ? ['Bedroom 1', 'Bathroom', 'Living Room', 'Kitchen'] : ['Bedroom 1'];
      }

      const hasMaster = selectedRooms.includes('Master Bedroom');
      const classFromBedrooms = inferApartmentClassFromBedroomNumbers(input.bedroomCount, hasMaster);

      const aptClass =
        (typeof input.bedroomCount === 'number' ? classFromBedrooms : undefined) ??
        inferApartmentClassFromSqm(toNumberOrUndefined(input.approxSize)) ??
        classFromBedrooms;

      const anchor = APARTMENT_ANCHORS_OIL[aptClass];

      if (isWhole && aptLike) {
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
      } else if (isWhole) {
        intMin = anchor.min * areaFactor;
        intMax = anchor.max * areaFactor;
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
          roomCount <= 1 ? 1100 :
          roomCount === 2 ? 1700 :
          roomCount === 3 ? 2300 :
          2900;

        intMin = Math.max(Math.round(baseMin), hardFloor);
        intMax = Math.max(Math.round(baseMax), Math.round(hardFloor * 1.55));

        intMin = Math.round(intMin * condMult.min);
        intMax = Math.round(intMax * condMult.max);
      }

      const diffs = input.jobDifficulty ?? [];
      for (const d of diffs) {
        const a = DIFFICULTY_ADDON[d];
        if (a) {
          intMin += a.min;
          intMax += a.max;
        }
      }

      // Apply story uplift for interior (stairs/voids)
      intMin = Math.round(intMin * storyMult);
      intMax = Math.round(intMax * storyMult);

      // Decorative ceiling modifier
      if (input.ceilingType === 'Decorative') {
        intMin = Math.round(intMin * 1.10);
        intMax = Math.round(intMax * 1.10);
      }

      if (input.trimPaintOptions) {
        const paintType = input.trimPaintOptions.paintType;

        if (isWhole) {
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

      intMin = clamp(intMin, 800, MAX_PRICE_CAP);
      intMax = clamp(intMax, 1200, MAX_PRICE_CAP);
      if (intMax < intMin) intMax = Math.round(intMin * 1.18);

      if (isWhole && aptLike) {
        const maxAllowed = Math.round(intMin * 1.18);
        if (intMax > maxAllowed) intMax = maxAllowed;
      }
    }

    // -------------------------
    // 2) Exterior
    // -------------------------
    let extMin = 0;
    let extMax = 0;

    if (isExt) {
      let sumMin = 0;
      let sumMax = 0;

      (input.exteriorAreas ?? []).forEach((area) => {
        const base = EXTERIOR_ITEM_BASE[area];
        if (base) {
          sumMin += base.min;
          sumMax += base.max;
        }
      });

      if (sumMin === 0 && sumMax === 0) {
        sumMin = 1800;
        sumMax = 5200;
      }

      let rMin = sumMin * EXTERIOR_RISK_MULTIPLIER.min;
      let rMax = sumMax * EXTERIOR_RISK_MULTIPLIER.max;

      const band = pickExteriorBand(toNumberOrUndefined(input.approxSize));
      rMin *= band.minMult;
      rMax *= band.maxMult;

      const requiredItems = ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'];
      const isFullExt = requiredItems.every((it) => (input.exteriorAreas ?? []).includes(it));
      if (isFullExt) {
        rMin = Math.max(rMin, EXTERIOR_ANCHOR.min);
        rMax = Math.max(rMax, Math.round(EXTERIOR_ANCHOR.min * 1.3));
      }

      rMin = rMin * condMult.min;
      rMax = rMax * condMult.max;
      
      // Apply story uplift for exterior (scaffolding/ladders)
      rMin = rMin * storyMult;
      rMax = rMax * storyMult;

      const diffs = input.jobDifficulty ?? [];
      for (const d of diffs) {
        const a = DIFFICULTY_ADDON[d];
        if (a) {
          rMin += a.min;
          rMax += a.max;
        }
      }

      extMin = Math.round(rMin);
      extMax = Math.round(rMax);
      extMin = clamp(extMin, 900, MAX_PRICE_CAP);
      extMax = clamp(extMax, 1500, MAX_PRICE_CAP);
      if (extMax < extMin) extMax = Math.round(extMin * 1.25);
    }

    // -------------------------
    // 3) Combine + cap
    // -------------------------
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

    // -------------------------
    // 4) Explanation
    // -------------------------
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
