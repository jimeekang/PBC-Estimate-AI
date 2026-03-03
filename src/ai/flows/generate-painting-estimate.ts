'use server';

/**
 * @fileOverview Data-driven AI agent to estimate painting price range.
 *
 * Anchors are calibrated to Sydney averages.
 * - Apartment interior (Entire property): uses CONTINUOUS SQM CURVE for smooth pricing.
 *   No more class-based cliffs (e.g. 110→111sqm jump removed).
 *   Calibrated so that 90sqm TwoBed + Excellent + Ensuite + Oil = $4,100~$4,500.
 * - Apartment interior (Specific areas): still uses class-based anchor + room scoring.
 * - House interior uses HOUSE anchors (bed/bath-based) + calibrated whole-house band + modifiers.
 *
 * Exterior model (updated):
 * - Uses Sydney house exterior refresh anchors (typical full exterior < $30k)
 * - Applies storey modifier properly
 * - Avoids double-counting "Difficult access areas" on double-storey jobs
 * - Uses area uplifts as % of base (more stable than fixed sums)
 * - Enforces realistic floors for "full exterior" and "wall+eaves" cases
 *
 * IMPORTANT UI FEATURE:
 * - When both Interior + Exterior are selected, output includes:
 *   Interior range, Exterior range, and Total range (breakdown).
 *
 * RANGE POLICY:
 * - Apartment: range gap capped at 1,200
 * - House / Townhouse: range gap capped at 2,000
 *
 * SPECIAL CALIBRATION:
 * - House 3B2B + Fair + Single story uses a sqm-based curve (with 135sqm smoothing point)
 * - House 3B2B + Fair + Double story applies extra uplift with overlap controls:
 *   - If Stairwell not selected: +1%
 *   - If High ceilings selected: reduce extra uplift (avoid double counting)
 *
 * DIFFICULT ACCESS (OVERLAP CONTROL):
 * - Interior (Double storey + Difficult access): only +0.5% ~ +1%
 * - Exterior: Difficult access handled strongly in exterior section only
 *
 * SQM CURVE (Apartment, Entire property):
 * - Continuous interpolation across sqm range — no class boundary cliffs
 * - rawMedian values calibrated so 90sqm + Excellent + Ensuite(af=1.12) + Oil → $4,100~$4,500
 * - ENTIRE_APT_BAND updated: Excellent {0.94, 1.06}, Fair {0.93, 1.10}, Poor {0.90, 1.25}
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// -----------------------------
// Anchors (Sydney averages)
// -----------------------------

// NOTE: APARTMENT_ANCHORS_OIL is still used for "Specific areas only" mode.
// For "Entire property" mode, the SQM_CURVE below is used instead.
const APARTMENT_ANCHORS_OIL = {
  Studio: { min: 2700, max: 3300, median: 2900 },
  OneBed: { min: 3200, max: 3900, median: 3400 },
  TwoBed: { min: 3700, max: 5000, median: 3650 },
  ThreeBed: { min: 5200, max: 6800, median: 5500 },
} as const;

// -----------------------------
// SQM CURVE (Apartment, Entire property mode only)
// -----------------------------
// rawMedian = price before areaFactor is applied.
// Calibrated so that:
//   90sqm × af(1.12 ensuite) × Excellent band(0.94~1.06) → $4,061 ~ $4,579 ✅
// Interpolates smoothly — no class boundary cliffs.
const APARTMENT_SQM_CURVE: readonly { sqm: number; rawMedian: number }[] = [
  { sqm: 35,  rawMedian: 2200 },
  { sqm: 45,  rawMedian: 2589 },
  { sqm: 55,  rawMedian: 2900 },
  { sqm: 65,  rawMedian: 3125 },
  { sqm: 80,  rawMedian: 3500 },
  { sqm: 90,  rawMedian: 3857 },  // TwoBed avg ← key calibration point
  { sqm: 105, rawMedian: 4286 },
  { sqm: 120, rawMedian: 4900 },  // smooth transition (no cliff at 110→111)
  { sqm: 140, rawMedian: 5800 },
  { sqm: 160, rawMedian: 6700 },
  { sqm: 200, rawMedian: 8000 },
] as const;

function getRawMedianFromSqm(sqmInput: number | undefined | null): number {
  // Guard: if sqm is missing, NaN, or not a finite number → use default 90sqm
  const sqm =
    sqmInput == null || !Number.isFinite(sqmInput) || isNaN(sqmInput)
      ? 90
      : sqmInput;

  const curve = APARTMENT_SQM_CURVE;
  if (sqm <= curve[0].sqm) return curve[0].rawMedian;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (sqm >= a.sqm && sqm <= b.sqm) {
      const t = (sqm - a.sqm) / (b.sqm - a.sqm);
      return a.rawMedian + (b.rawMedian - a.rawMedian) * t;
    }
  }
  // Beyond last point: linear extrapolation
  const a = curve[curve.length - 2];
  const b = curve[curve.length - 1];
  const t = (sqm - a.sqm) / (b.sqm - a.sqm);
  return a.rawMedian + (b.rawMedian - a.rawMedian) * t;
}

const HOUSE_INTERIOR_ANCHORS = {
  '2B1B': { min: 6200, max: 8500, median: 7200 },
  '3B2B': { min: 7800, max: 10200, median: 8900 },
  '4B2B': { min: 9500, max: 12500, median: 10800 },
  '5B3B': { min: 12500, max: 16500, median: 14200 },
} as const;

/**
 * Exterior anchor updated to match Sydney "full exterior refresh" reality.
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
  trimPaint: 0.2,
  ensuitePaint: 0.12,
};

const CONDITION_MULTIPLIER = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 1.08, max: 1.22 },
  Poor: { min: 1.22, max: 1.55 },
} as const;

const HOUSE_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.0, max: 1.08 },
  Fair: { min: 1.1, max: 1.24 },
  Poor: { min: 1.22, max: 1.4 },
} as const;

const ENTIRE_HOUSE_BAND = {
  Excellent: { min: 0.96, max: 1.04 },
  Fair: { min: 0.97, max: 1.06 },
  Poor: { min: 0.97, max: 1.1 },
} as const;

// UPDATED: tighter bands calibrated for sqm-curve approach
// Excellent: narrower range (high confidence)
// Fair: moderate range
// Poor: wider range (more uncertainty)
const ENTIRE_APT_BAND = {
  Excellent: { min: 0.94, max: 1.06 },
  Fair:      { min: 0.93, max: 1.10 },
  Poor:      { min: 0.90, max: 1.25 },
} as const;

const STORY_MODIFIER = {
  'Single story': 1.0,
  'Double story or more': 1.18,
};

const WATER_BASED_UPLIFT = { minPct: 0.08, maxPct: 0.12 } as const;
const TRIM_PREMIUM_ENTIRE_WATER_PER_ITEM = { min: 80, max: 180 } as const;
const TRIM_PREMIUM_SPECIFIC_PER_ROOM = {
  'Oil-based': { min: 120, max: 260 },
  'Water-based': { min: 180, max: 380 },
} as const;

// -----------------------------
// Exterior modelling (UPDATED)
// -----------------------------
const EXTERIOR_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.0, max: 1.08 },
  Fair: { min: 1.1, max: 1.24 },
  Poor: { min: 1.22, max: 1.4 },
} as const;

const EXTERIOR_SIZE_BANDS = [
  { minSqm: 0, maxSqm: 120, minMult: 0.95, maxMult: 1.05 },
  { minSqm: 121, maxSqm: 200, minMult: 1.0, maxMult: 1.15 },
  { minSqm: 201, maxSqm: 1000, minMult: 1.1, maxMult: 1.3 },
] as const;

const EXTERIOR_AREA_UPLIFT_PCT: Record<string, { minPct: number; maxPct: number; notes?: string }> = {
  Wall: { minPct: 0.0, maxPct: 0.0, notes: 'Base includes walls for typical full exterior scope.' },
  Eaves: { minPct: 0.07, maxPct: 0.11 },
  Gutter: { minPct: 0.04, maxPct: 0.07 },
  Fascia: { minPct: 0.05, maxPct: 0.08 },
  'Exterior Trim': { minPct: 0.06, maxPct: 0.1 },
  Pipes: { minPct: 0.02, maxPct: 0.04 },
  Deck: { minPct: 0.06, maxPct: 0.12 },
  Paving: { minPct: 0.04, maxPct: 0.09 },
  Roof: { minPct: 0.18, maxPct: 0.32 },
  Etc: { minPct: 0.04, maxPct: 0.1 },
};

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
// RANGE CAP POLICY
// -----------------------------
function capRangeWidthSmart(
  minVal: number,
  maxVal: number,
  input: GeneratePaintingEstimateInput,
  _houseKey?: keyof typeof HOUSE_INTERIOR_ANCHORS
) {
  const gap = maxVal - minVal;
  let cap = 1200; // Apartment default
  const isHouse = input.propertyType === 'House / Townhouse';
  if (isHouse) cap = 2000;
  if (gap <= cap) return { min: minVal, max: maxVal };
  return { min: minVal, max: Math.round(minVal + cap) };
}

// -----------------------------
// 3B2B FAIR (House) curve with 135sqm smoothing point
// -----------------------------
const CAL_3B2B_FAIR_SINGLE_POINTS = [
  { sqm: 120, min: 6500, max: 8000 },
  { sqm: 135, min: 7800, max: 10000 },
  { sqm: 150, min: 9500, max: 12000 },
  { sqm: 180, min: 13000, max: 15500 },
] as const;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function interpolateBySqm(
  points: readonly { sqm: number; min: number; max: number }[],
  sqm: number
) {
  if (sqm <= points[0].sqm) {
    const p = points[0];
    const scale = sqm / p.sqm;
    return { min: p.min * scale, max: p.max * scale };
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (sqm >= a.sqm && sqm <= b.sqm) {
      const t = (sqm - a.sqm) / (b.sqm - a.sqm);
      return { min: lerp(a.min, b.min, t), max: lerp(a.max, b.max, t) };
    }
  }
  const last = points[points.length - 1];
  const scaleUp = sqm / last.sqm;
  return { min: last.min * scaleUp, max: last.max * scaleUp };
}

function shouldApply3B2BFairSingleHouseCalibration(
  input: GeneratePaintingEstimateInput,
  houseKey?: keyof typeof HOUSE_INTERIOR_ANCHORS
) {
  const isHouse = input.propertyType === 'House / Townhouse';
  const condition = input.paintCondition ?? 'Fair';
  const story = input.houseStories ?? 'Single story';
  return isHouse && houseKey === '3B2B' && condition === 'Fair' && story === 'Single story';
}

function calibrate3B2BFairSingleHouse(
  input: GeneratePaintingEstimateInput,
  houseKey: keyof typeof HOUSE_INTERIOR_ANCHORS,
  currentMin: number,
  currentMax: number
) {
  if (!shouldApply3B2BFairSingleHouseCalibration(input, houseKey)) {
    return { min: currentMin, max: currentMax };
  }
  const sqm = input.approxSize ?? 135;
  const target = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, sqm);
  let min = clamp(target.min, 5000, 26000);
  let max = clamp(target.max, 6500, 30000);
  if (max < min) max = min + 800;
  return { min: Math.round(min), max: Math.round(max) };
}

// -----------------------------
// Double storey 3B2B uplift with overlap control
// -----------------------------
const DOUBLE_STOREY_3B2B_UPLIFT = {
  baseMinPct: 0.03,
  baseMaxPct: 0.05,
  autoStairwellPct: 0.01,
  highCeilingReductionPct: 0.02,
};

function applyDoubleStorey3B2BUplift(
  input: GeneratePaintingEstimateInput,
  houseKey: keyof typeof HOUSE_INTERIOR_ANCHORS,
  minVal: number,
  maxVal: number
) {
  const isHouse = input.propertyType === 'House / Townhouse';
  const condition = input.paintCondition ?? 'Fair';
  const story = input.houseStories ?? 'Single story';

  if (!isHouse || houseKey !== '3B2B' || condition !== 'Fair' || story !== 'Double story or more') {
    return { min: minVal, max: maxVal };
  }

  const diffs = input.jobDifficulty ?? [];
  const hasHighCeilings = diffs.includes('High ceilings');

  const stairwellSelectedInEntire = (input.roomsToPaint ?? []).includes('Stairwell');
  const stairwellSelectedInSpecific = (input.interiorRooms ?? []).some(
    (r) => r.roomName === 'Stairwell'
  );
  const hasStairwellSelected = stairwellSelectedInEntire || stairwellSelectedInSpecific;

  let minPct = DOUBLE_STOREY_3B2B_UPLIFT.baseMinPct;
  let maxPct = DOUBLE_STOREY_3B2B_UPLIFT.baseMaxPct;

  if (hasHighCeilings) {
    minPct = Math.max(0.01, minPct - DOUBLE_STOREY_3B2B_UPLIFT.highCeilingReductionPct);
    maxPct = Math.max(0.02, maxPct - DOUBLE_STOREY_3B2B_UPLIFT.highCeilingReductionPct);
  }

  const autoStairPct = hasStairwellSelected ? 0 : DOUBLE_STOREY_3B2B_UPLIFT.autoStairwellPct;

  return {
    min: Math.round(minVal * (1 + minPct + autoStairPct)),
    max: Math.round(maxVal * (1 + maxPct + autoStairPct)),
  };
}

// -----------------------------
// Complexity uplift (%)
// -----------------------------
function applyInteriorComplexityUpliftPct(
  input: GeneratePaintingEstimateInput,
  minVal: number,
  maxVal: number
) {
  const factors = input.jobDifficulty ?? [];
  const story = input.houseStories ?? 'Single story';
  const isDouble = story === 'Double story or more';

  let minPct = 0;
  let maxPct = 0;

  for (const f of factors) {
    if (f === 'Difficult access areas') {
      if (isDouble) {
        minPct += 0.005;
        maxPct += 0.01;
      } else {
        minPct += 0.01;
        maxPct += 0.03;
      }
      continue;
    }
    if (f === 'Stairs') {
      minPct += 0.01;
      maxPct += 0.02;
      continue;
    }
    if (f === 'High ceilings') {
      minPct += 0.01;
      maxPct += 0.02;
      continue;
    }
    if (f === 'Extensive mouldings or trims') {
      minPct += 0.02;
      maxPct += 0.04;
      continue;
    }
  }

  minPct = clamp(minPct, 0, 0.18);
  maxPct = clamp(maxPct, 0, 0.25);

  return {
    min: Math.round(minVal * (1 + minPct)),
    max: Math.round(maxVal * (1 + maxPct)),
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
    .array(
      z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])
    )
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

  breakdown: z
    .object({
      interior: z
        .object({
          min: z.number(),
          max: z.number(),
          priceRange: z.string(),
        })
        .optional(),
      exterior: z
        .object({
          min: z.number(),
          max: z.number(),
          priceRange: z.string(),
        })
        .optional(),
      total: z.object({
        min: z.number(),
        max: z.number(),
        priceRange: z.string(),
      }),
    })
    .optional(),
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
      intMin: z.number(),
      intMax: z.number(),
      extMin: z.number(),
      extMax: z.number(),
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
Interior: {{intMin}} - {{intMax}}
Exterior: {{extMin}} - {{extMax}}
Total: {{priceMin}} - {{priceMax}}

INSTRUCTIONS
1) explanation: 3–5 sentences, Australian English, professional tone.
   Focus on the main cost drivers: scope, condition, selected areas, stories, wall finish (if exterior), and complexity factors.
2) priceRange:
   - Use commas as thousands separators.
   - If Total priceMax >= 35,000 format: "From AUD {{priceMin}}+ (Site Inspection Required)"
   - Else: "AUD {{priceMin}} - {{priceMax}}"
3) details: 4–7 bullet points.
   - MUST include a clear breakdown line if both Interior and Exterior are selected:
     "Interior: AUD X - Y"
     "Exterior: AUD X - Y"
     "Total: AUD X - Y"
4) breakdown:
   - Return breakdown object with interior/exterior/total (min, max, priceRange).
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
    // 1) Interior
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

      // -----------------------------------------------
      // Apartment interior
      // -----------------------------------------------
      if (aptLike) {

        // ── ENTIRE PROPERTY: use SQM CURVE ──────────────────────────────────
        if (isWhole) {
          // Guard: approxSize may be undefined, NaN, or empty string from form
          const sqmRaw = toNumberOrUndefined(input.approxSize);
          const rawMedian = getRawMedianFromSqm(sqmRaw); // handles undefined/NaN internally
          const median = rawMedian * areaFactor;
          const band = ENTIRE_APT_BAND[condition];

          const computedMin = Math.round(median * band.min);
          const computedMax = Math.round(median * band.max);
          const absoluteFloor = Math.round(rawMedian * 0.7);
          intMin = Number.isFinite(computedMin) ? Math.max(computedMin, absoluteFloor) : absoluteFloor;
          intMax = Number.isFinite(computedMax) ? Math.max(computedMax, Math.round(absoluteFloor * 1.2)) : Math.round(absoluteFloor * 1.2);
        }

        // ── SPECIFIC AREAS: use class-based anchor + room scoring ────────────
        else {
          const classFromBedrooms = inferApartmentClassFromBedroomNumbers(
            input.bedroomCount,
            hasMaster
          );
          const aptClass =
            (typeof input.bedroomCount === 'number' ? classFromBedrooms : undefined) ??
            inferApartmentClassFromSqm(toNumberOrUndefined(input.approxSize)) ??
            classFromBedrooms;

          const anchor = APARTMENT_ANCHORS_OIL[aptClass];

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
            baseMax *= 1.1;
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

      // -----------------------------------------------
      // House interior
      // -----------------------------------------------
      let computedHouseKey: keyof typeof HOUSE_INTERIOR_ANCHORS | undefined;

      if (!aptLike) {
        const bedroomsTotal =
          (typeof input.bedroomCount === 'number' && Number.isFinite(input.bedroomCount)
            ? input.bedroomCount
            : 0) + (hasMaster ? 1 : 0);

        const bathroomsTotal =
          (selectedRooms.includes('Bathroom') ? 1 : 0) +
          (input.paintAreas?.ensuitePaint ? 1 : 0);

        computedHouseKey = inferHouseKey({
          bedroomsTotal,
          bathroomsTotal,
          approxSizeSqm: toNumberOrUndefined(input.approxSize),
        });

        const houseAnchor = HOUSE_INTERIOR_ANCHORS[computedHouseKey];

        if (isWhole) {
          const band = ENTIRE_HOUSE_BAND[condition];
          const mid = houseAnchor.median * areaFactor;

          intMin = Math.round(mid * band.min);
          intMax = Math.round(mid * band.max);

          const floorMin = Math.round(houseAnchor.min * areaFactor * 0.98);
          const ceilMax = Math.round(houseAnchor.max * areaFactor * 1.02);

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
            baseMax *= 1.1;
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
          intMax = Math.max(Math.round(baseMax), Math.round(hardFloor * 1.6));

          intMin = Math.round(intMin * houseCondMult.min);
          intMax = Math.round(intMax * houseCondMult.max);
        }
      }

      // storey modifier (interior)
      intMin = Math.round(intMin * storyMult);
      intMax = Math.round(intMax * storyMult);

      // decorative ceiling modifier
      if (input.ceilingType === 'Decorative') {
        intMin = Math.round(intMin * 1.1);
        intMax = Math.round(intMax * 1.1);
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

      // % complexity uplift (interior)
      {
        const uplifted = applyInteriorComplexityUpliftPct(input, intMin, intMax);
        intMin = uplifted.min;
        intMax = uplifted.max;
      }

      // 3B2B + Fair curve calibration (House / Townhouse)
      let finalHouseKey: keyof typeof HOUSE_INTERIOR_ANCHORS | undefined;

      if (!isApartmentLike(input.propertyType)) {
        const bedroomsTotal =
          (typeof input.bedroomCount === 'number' && Number.isFinite(input.bedroomCount)
            ? input.bedroomCount
            : 0) + ((selectedRooms ?? []).includes('Master Bedroom') ? 1 : 0);

        const bathroomsTotal =
          ((selectedRooms ?? []).includes('Bathroom') ? 1 : 0) +
          (input.paintAreas?.ensuitePaint ? 1 : 0);

        finalHouseKey = inferHouseKey({
          bedroomsTotal,
          bathroomsTotal,
          approxSizeSqm: toNumberOrUndefined(input.approxSize),
        });

        const calibrated = calibrate3B2BFairSingleHouse(input, finalHouseKey, intMin, intMax);
        intMin = calibrated.min;
        intMax = calibrated.max;

        const upliftedDouble = applyDoubleStorey3B2BUplift(input, finalHouseKey, intMin, intMax);
        intMin = upliftedDouble.min;
        intMax = upliftedDouble.max;
      }

      intMin = clamp(intMin, 800, MAX_PRICE_CAP);
      intMax = clamp(intMax, 1200, MAX_PRICE_CAP);
      if (intMax < intMin) intMax = Math.round(intMin * 1.18);

      // Range cap (Apt 1200 / House 2000)
      {
        const capped = capRangeWidthSmart(intMin, intMax, input, finalHouseKey);
        intMin = capped.min;
        intMax = capped.max;
      }
    }

    // -----------------------------
    // 2) Exterior (UPDATED)
    // -----------------------------
    let extMin = 0;
    let extMax = 0;

    if (isExt) {
      let areas = (input.exteriorAreas ?? []).slice();

      if (!areas.length) areas = ['Wall', 'Eaves'];
      if (!areas.includes('Wall')) areas = ['Wall', ...areas];

      const band = pickExteriorBand(toNumberOrUndefined(input.approxSize));
      const baseMid = EXTERIOR_ANCHOR.median;

      let baseMin = baseMid * band.minMult;
      let baseMax = baseMid * band.maxMult;

      baseMin = Math.max(baseMin, EXTERIOR_ANCHOR.min * band.minMult);
      baseMax = Math.min(
        Math.max(baseMax, EXTERIOR_ANCHOR.min * 1.25),
        EXTERIOR_ANCHOR.max * band.maxMult
      );

      let upliftMinPct = 0;
      let upliftMaxPct = 0;

      for (const a of areas) {
        const u = EXTERIOR_AREA_UPLIFT_PCT[a];
        if (!u) continue;
        upliftMinPct += u.minPct;
        upliftMaxPct += u.maxPct;
      }

      upliftMinPct = clamp(upliftMinPct, 0, 0.95);
      upliftMaxPct = clamp(upliftMaxPct, 0, 1.2);

      let rMin = baseMin * (1 + upliftMinPct);
      let rMax = baseMax * (1 + upliftMaxPct);

      rMin *= exteriorCondMult.min;
      rMax *= exteriorCondMult.max;

      rMin *= storyMult;
      rMax *= storyMult;

      const diffs = input.jobDifficulty ?? [];
      const hasDifficultAccess = diffs.includes('Difficult access areas');

      if (hasDifficultAccess) {
        if (isDouble) {
          rMin *= 1.03;
          rMax *= 1.06;
        } else {
          rMin *= 1.08;
          rMax *= 1.12;
        }
      }

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

      extMin = Math.round(rMin);
      extMax = Math.round(rMax);

      extMin = clamp(extMin, 1200, MAX_PRICE_CAP);
      extMax = clamp(extMax, 1800, MAX_PRICE_CAP);
      if (extMax < extMin) extMax = Math.round(extMin * 1.25);

      const selectedRoof = areas.includes('Roof');
      if (!selectedRoof && extMax > 30000) extMax = 30000;
      if (!selectedRoof && extMin > 28000) extMin = 28000;

      {
        const capped = capRangeWidthSmart(extMin, extMax, input);
        extMin = capped.min;
        extMax = capped.max;
      }
    }

    // -----------------------------
    // 3) Combine
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

    {
      const capped = capRangeWidthSmart(totalMin, totalMax, input);
      totalMin = capped.min;
      totalMax = capped.max;
    }

    // -----------------------------
    // 4) Build UI-friendly breakdown
    // -----------------------------
    const interiorPriceRange =
      intMax >= MAX_PRICE_CAP
        ? `From AUD ${formatMoney(intMin)}+ (Site Inspection Required)`
        : `AUD ${formatMoney(intMin)} - ${formatMoney(intMax)}`;

    const exteriorPriceRange =
      extMax >= MAX_PRICE_CAP
        ? `From AUD ${formatMoney(extMin)}+ (Site Inspection Required)`
        : `AUD ${formatMoney(extMin)} - ${formatMoney(extMax)}`;

    const totalPriceRange =
      totalMax >= MAX_PRICE_CAP
        ? `From AUD ${formatMoney(totalMin)}+ (Site Inspection Required)`
        : `AUD ${formatMoney(totalMin)} - ${formatMoney(totalMax)}`;

    const breakdown: GeneratePaintingEstimateOutput['breakdown'] = {
      total: { min: totalMin, max: totalMax, priceRange: totalPriceRange },
    };

    if (isInt) breakdown.interior = { min: intMin, max: intMax, priceRange: interiorPriceRange };
    if (isExt) breakdown.exterior = { min: extMin, max: extMax, priceRange: exteriorPriceRange };

    // -----------------------------
    // 5) AI Explanation
    // -----------------------------
    const { output } = await explanationPrompt({
      input,
      intMin,
      intMax,
      extMin,
      extMax,
      priceMin: totalMin,
      priceMax: totalMax,
    });

    if (output?.priceRange) {
      return {
        ...output,
        breakdown: output.breakdown ?? breakdown,
        details:
          output.details && output.details.length
            ? output.details
            : [
                ...(isInt ? [`Interior: ${interiorPriceRange}`] : []),
                ...(isExt ? [`Exterior: ${exteriorPriceRange}`] : []),
                `Total: ${totalPriceRange}`,
              ],
      };
    }

    return {
      priceRange: totalPriceRange,
      explanation:
        'This is an indicative estimate based on the information provided and is subject to site inspection for a final quote.',
      details: [
        ...(isInt ? [`Interior: ${interiorPriceRange}`] : []),
        ...(isExt ? [`Exterior: ${exteriorPriceRange}`] : []),
        `Total: ${totalPriceRange}`,
      ],
      breakdown,
    };
  }
);