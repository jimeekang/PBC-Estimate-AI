'use server';

/**
 * @fileOverview Data-driven AI agent to estimate painting price range.
 *
 * Anchors calibrated to Northern Beaches, Sydney (premium market).
 * Base price = wall + ceiling + trim oil-based (all included).
 *
 * - Apartment interior (Entire property): uses CONTINUOUS SQM CURVE for smooth pricing.
 *   No class-based cliffs. 90sqm rawMedian $4,500 is the key calibration point.
 *   Trim water-based upgrade and complexity factors add on top.
 * - Apartment interior (Specific areas): class-based anchor + room scoring.
 *   TwoBed split: TwoBedStd (≤90sqm) / TwoBedLg (91~110sqm).
 * - House interior uses HOUSE anchors (bed/bath-based) + calibrated whole-house band + modifiers.
 *
 * Exterior model (updated):
 * - wallType (cladding / rendered / brick) drives the base anchor selection.
 *   cladding = cheapest base; rendered = mid-range (prep + high paint absorption);
 *   brick = most expensive (labour intensive, mortar joints, highest material consumption).
 * - All types use 3-coat system (BASE_COAT_COUNT=3): 1 undercoat + 2 finish coats.
 * - houseStories: '1 storey' / '2 storey' / '3 storey' (3 tiers).
 * - 5-band size multiplier for finer granularity (≤100 / 101~150 / 151~220 / 221~350 / 350+)
 * - Applies storey modifier properly
 * - Avoids double-counting "Difficult access areas" on double-storey jobs
 * - Uses area uplifts as % of base (more stable than fixed sums)
 * - Enforces wall-type-aware floor prices for scope categories
 *
 * IMPORTANT UI FEATURE:
 * - When both Interior + Exterior are selected, output includes:
 *   Interior range, Exterior range, and Total range (breakdown).
 *
 * RANGE POLICY (dynamic):
 * - Interior/Total: $0~5k→cap 1,200 / $5k~10k→1,800 / $10k~18k→2,500 / $18k+→3,500
 * - Exterior:       $0~10k→cap 1,500 / $10k~20k→2,500 / $20k+→4,000
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
 * - rawMedian values: 90sqm → $4,500 (key point). Water-based / complexity uplift on top.
 * - ENTIRE_APT_BAND: Excellent {0.94, 1.06}, Fair {0.93, 1.10}, Poor {0.90, 1.25}
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// -----------------------------
// Anchors (Sydney averages)
// -----------------------------

// NOTE: APARTMENT_ANCHORS_OIL is still used for "Specific areas only" mode.
// For "Entire property" mode, the SQM_CURVE below is used instead.
// Base = wall + ceiling + trim oil-based. Northern Beaches, Sydney.
// TwoBed split: TwoBedStd (≤90sqm) / TwoBedLg (91~110sqm)
const APARTMENT_ANCHORS_OIL = {
  Studio:    { min: 2200, max: 3500, median: 2700 },
  OneBed:    { min: 2800, max: 4200, median: 3300 },
  TwoBedStd: { min: 3800, max: 5500, median: 4400 },
  TwoBedLg:  { min: 5000, max: 7500, median: 6000 },
  ThreeBed:  { min: 6500, max: 9500, median: 7500 },
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

// Base = wall + ceiling + trim oil-based. Northern Beaches, Sydney.
const HOUSE_INTERIOR_ANCHORS = {
  '2B1B': { min: 7500,  max: 11000, median: 9000  },
  '3B2B': { min: 9500,  max: 14000, median: 11500 },
  '4B2B': { min: 13000, max: 18500, median: 15500 },
  '5B3B': { min: 17000, max: 25000, median: 20000 },
} as const;

/**
 * Exterior anchors by wall type (Northern Beaches, Sydney).
 * All use 3-coat system (1 undercoat + 2 finish coats).
 * cladding = cheapest (standard prep, normal absorption)
 * rendered = mid-range (high absorption, textured/porous finish, more prep)
 * brick    = most expensive (mortar joint labour, highest material consumption)
 * default  = fallback when wallType not specified
 */
const EXTERIOR_WALL_TYPE_ANCHOR = {
  cladding: { min: 3500, max: 16000, median: 7000 },
  rendered:  { min: 5000, max: 21000, median: 10500 },
  brick:     { min: 6000, max: 24000, median: 13000 },
  default:   { min: 4000, max: 18000, median: 8500 },
} as const;

/** Wall-type-aware minimum floor prices per scope category.
 *  Brick is highest due to mortar joint labour and material consumption.
 *  All types use 3-coat system (BASE_COAT_COUNT): 1 undercoat + 2 finish coats.
 *  tripleStoreyFullExterior added for 3-storey support.
 */
const EXTERIOR_WALL_TYPE_FLOORS = {
  cladding: { wallOnly: 4000, wallPlusEaves: 5500, fullExterior: 7000, doubleStoreyFullExterior: 10000, tripleStoreyFullExterior: 13500 },
  rendered:  { wallOnly: 5000, wallPlusEaves: 7000, fullExterior: 9000, doubleStoreyFullExterior: 13000, tripleStoreyFullExterior: 17000 },
  brick:     { wallOnly: 6000, wallPlusEaves: 8000, fullExterior: 10500, doubleStoreyFullExterior: 15000, tripleStoreyFullExterior: 19500 },
  default:   { wallOnly: 4500, wallPlusEaves: 6000, fullExterior: 8000, doubleStoreyFullExterior: 11000, tripleStoreyFullExterior: 14500 },
} as const;

const COMBINED_ANCHOR = { min: 15000, max: 35000, median: 22000 } as const;

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

const STORY_MODIFIER: Record<string, number> = {
  '1 storey': 1.0,
  '2 storey': 1.18,
  '3 storey': 1.35,
  // Legacy aliases for backward compatibility
  'Single story': 1.0,
  'Double story or more': 1.18,
};

/** Standard coat system: 1 undercoat + 2 finish coats */
const BASE_COAT_COUNT = 3;

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

/**
 * Exterior wall-area bands (m²).
 * wallArea = estimatedPerimeter × wallHeight
 * perimeter ≈ 4.2 × √(floorSqm)  (rectangular adjustment)
 *
 * Reference points:
 * - 100sqm single(2.7m) → wallArea ≈ 113m²
 * - 150sqm single(2.7m) → wallArea ≈ 139m²
 * - 200sqm single(2.7m) → wallArea ≈ 161m²
 * - 150sqm double(5.4m) → wallArea ≈ 278m²
 * - 250sqm double(5.4m) → wallArea ≈ 359m²
 */
/**
 * Exterior wall-area bands — 10 bands for finer sqm sensitivity.
 * Linear interpolation is applied within each band (see pickExteriorBand).
 *
 * Approx sqm → wallArea mapping (perimeter = 4.2×√sqm, height 2.7m single / 5.4m double):
 *  50sqm single  →  ~64m²   |  80sqm single  → ~101m²
 * 100sqm single  → ~113m²   | 120sqm single  → ~124m²
 * 150sqm single  → ~139m²   | 180sqm single  → ~152m²
 * 200sqm single  → ~161m²   | 100sqm double  → ~227m²
 * 150sqm double  → ~278m²   | 200sqm double  → ~321m²
 * 250sqm double  → ~359m²
 */
const EXTERIOR_WALL_AREA_BANDS = [
  { minArea: 0,   maxArea: 75,   minMult: 0.45, maxMult: 0.58 }, // ~50sqm 단층
  { minArea: 76,  maxArea: 108,  minMult: 0.58, maxMult: 0.73 }, // ~80sqm 단층
  { minArea: 109, maxArea: 128,  minMult: 0.73, maxMult: 0.86 }, // ~100sqm 단층
  { minArea: 129, maxArea: 144,  minMult: 0.86, maxMult: 0.97 }, // ~120sqm 단층
  { minArea: 145, maxArea: 158,  minMult: 0.97, maxMult: 1.08 }, // ~150sqm 단층
  { minArea: 159, maxArea: 175,  minMult: 1.08, maxMult: 1.20 }, // ~180sqm 단층
  { minArea: 176, maxArea: 220,  minMult: 1.20, maxMult: 1.38 }, // ~200-250sqm 단층 / 소형 복층
  { minArea: 221, maxArea: 290,  minMult: 1.38, maxMult: 1.58 }, // ~100sqm 복층
  { minArea: 291, maxArea: 345,  minMult: 1.58, maxMult: 1.76 }, // ~150-200sqm 복층
  { minArea: 346, maxArea: 9999, minMult: 1.76, maxMult: 1.98 }, // ~250sqm+ 복층
] as const;

const DEFAULT_WALL_HEIGHT: Record<string, number> = {
  '1 storey': 2.7,
  '2 storey': 5.4,
  '3 storey': 8.1,
  // Legacy aliases
  'Single story': 2.7,
  'Double story or more': 5.4,
};

const EXTERIOR_AREA_UPLIFT_PCT: Record<string, { minPct: number; maxPct: number; notes?: string }> = {
  Wall: { minPct: 0.0, maxPct: 0.0, notes: 'Base includes walls for typical full exterior scope.' },
  Eaves: { minPct: 0.09, maxPct: 0.14 },
  Gutter: { minPct: 0.05, maxPct: 0.08 },
  Fascia: { minPct: 0.05, maxPct: 0.08 },
  'Exterior Trim': { minPct: 0.06, maxPct: 0.1 },
  Pipes: { minPct: 0.02, maxPct: 0.04 },
  Deck: { minPct: 0.06, maxPct: 0.12 },
  Paving: { minPct: 0.04, maxPct: 0.09 },
  Roof: { minPct: 0.18, maxPct: 0.32 },
  Etc: { minPct: 0.04, maxPct: 0.1 },
};

// EXTERIOR_FLOORS kept for backward-compat; actual floors resolved via EXTERIOR_WALL_TYPE_FLOORS

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

/**
 * Estimate exterior wall area from floor sqm and wall height.
 * perimeter ≈ 4.2 × √(sqm), then wallArea = perimeter × height
 */
function estimateWallArea(sqm: number, wallHeight: number): number {
  const perimeter = 4.2 * Math.sqrt(sqm);
  return perimeter * wallHeight;
}

/**
 * Returns interpolated multipliers for the given wallArea.
 * Uses linear interpolation within each band for continuous sqm sensitivity.
 */
function pickExteriorBand(wallArea?: number): { minMult: number; maxMult: number } {
  const bands = EXTERIOR_WALL_AREA_BANDS;
  if (!wallArea || wallArea <= 0) return { minMult: bands[0].minMult, maxMult: bands[0].maxMult };

  for (let i = 0; i < bands.length - 1; i++) {
    const curr = bands[i];
    const next = bands[i + 1];
    if (wallArea >= curr.minArea && wallArea <= curr.maxArea) {
      const t = (wallArea - curr.minArea) / (curr.maxArea - curr.minArea);
      return {
        minMult: +(curr.minMult + t * (next.minMult - curr.minMult)).toFixed(3),
        maxMult: +(curr.maxMult + t * (next.maxMult - curr.maxMult)).toFixed(3),
      };
    }
  }
  return { minMult: bands[bands.length - 1].minMult, maxMult: bands[bands.length - 1].maxMult };
}

function formatMoney(n: number) {
  return n.toLocaleString('en-AU');
}

function inferApartmentClassFromSqm(sqm?: number) {
  if (!sqm) return undefined;
  if (sqm <= 45) return 'Studio' as const;
  if (sqm <= 70) return 'OneBed' as const;
  if (sqm <= 90) return 'TwoBedStd' as const;
  if (sqm <= 110) return 'TwoBedLg' as const;
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
  hasMasterBedroom?: boolean,
  sqm?: number
) {
  const extra =
    typeof bedroomCountInput === 'number' && Number.isFinite(bedroomCountInput)
      ? bedroomCountInput
      : 0;
  const totalBedrooms = extra + (hasMasterBedroom ? 1 : 0);
  if (totalBedrooms <= 0) return 'Studio' as const;
  if (totalBedrooms === 1) return 'OneBed' as const;
  if (totalBedrooms === 2) {
    // 90sqm 기준으로 TwoBedStd / TwoBedLg 분리
    if (sqm && sqm > 90) return 'TwoBedLg' as const;
    return 'TwoBedStd' as const;
  }
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
// RANGE CAP POLICY (dynamic)
// Interior/Total: $0~5k→1,200 / $5k~10k→1,800 / $10k~18k→2,500 / $18k+→3,500
// Exterior:       $0~10k→1,500 / $10k~20k→2,500 / $20k+→4,000
// -----------------------------
function capRangeWidthSmart(
  minVal: number,
  maxVal: number,
  _input: GeneratePaintingEstimateInput,
  context: 'interior' | 'exterior' | 'total' = 'interior'
) {
  const gap = maxVal - minVal;
  let cap: number;

  if (context === 'exterior') {
    if (minVal <= 10000) cap = 800;
    else if (minVal <= 20000) cap = 1500;
    else cap = 2500;
  } else {
    if (minVal <= 5000) cap = 1200;
    else if (minVal <= 10000) cap = 1800;
    else if (minVal <= 18000) cap = 2500;
    else cap = 3500;
  }

  if (gap <= cap) return { min: minVal, max: maxVal };
  return { min: minVal, max: Math.round(minVal + cap) };
}

// -----------------------------
// 3B2B FAIR (House) curve with 135sqm smoothing point
// -----------------------------
const CAL_3B2B_FAIR_SINGLE_POINTS = [
  { sqm: 120, min: 8500,  max: 11000 },
  { sqm: 135, min: 10000, max: 13500 },
  { sqm: 150, min: 12000, max: 15500 },
  { sqm: 180, min: 14500, max: 19000 },
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
  const story = input.houseStories ?? '1 storey';
  return isHouse && houseKey === '3B2B' && condition === 'Fair' && (story === 'Single story' || story === '1 storey');
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
  let min = clamp(target.min, 7000, 30000);
  let max = clamp(target.max, 9000, 35000);
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
  const story = input.houseStories ?? '1 storey';

  if (!isHouse || houseKey !== '3B2B' || condition !== 'Fair' || (story !== 'Double story or more' && story !== '2 storey')) {
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
  const story = input.houseStories ?? '1 storey';
  const isDouble = story === 'Double story or more' || story === '2 storey' || story === '3 storey';

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

  houseStories: z.enum(['1 storey', '2 storey', '3 storey', 'Single story', 'Double story or more']).optional(),
  bedroomCount: z.number().optional(),
  bathroomCount: z.number().optional(),

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
  wallHeight: z.number().optional(),

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
      wallTypeSurfaceNote: z.string().optional(),
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
- Wall Height: {{#if input.wallHeight}}{{input.wallHeight}}m{{else}}Default based on stories{{/if}}
- Approx Size: {{#if input.approxSize}}{{input.approxSize}} sqm{{else}}Calculated from room selections{{/if}}
- Paint Condition: {{#if input.paintCondition}}{{input.paintCondition}}{{else}}Fair{{/if}}
- Ceiling Style: {{#if input.ceilingType}}{{input.ceilingType}}{{else}}Flat{{/if}}
- Custom Interior Area (if selected 'Etc'): {{#if input.otherInteriorArea}}{{input.otherInteriorArea}}{{else}}N/A{{/if}}
- Custom Exterior Area (if selected 'Etc'): {{#if input.otherExteriorArea}}{{input.otherExteriorArea}}{{else}}N/A{{/if}}

GENERATED PRICE DATA (AUD)
Interior: {{intMin}} - {{intMax}}
Exterior: {{extMin}} - {{extMax}}
Total: {{priceMin}} - {{priceMax}}

WALL TYPE COAT SYSTEM (use when exterior wall type is selected):
All exterior wall types use a standard 3-coat system: 1 undercoat + 2 finish coats.

{{#if wallTypeSurfaceNote}}
SURFACE NOTE (incorporate this naturally into the explanation):
{{wallTypeSurfaceNote}}
{{/if}}

INSTRUCTIONS
1) explanation: 3–5 sentences, Australian English, professional tone.
   Focus on the main cost drivers: scope, condition, selected areas, stories, wall finish (if exterior), and complexity factors.
   If wallType is "rendered" or "brick", incorporate the relevant SURFACE NOTE above into the explanation naturally.
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

    const story = input.houseStories ?? '1 storey';
    const storyMult = STORY_MODIFIER[story] || 1.0;
    const isDouble = story === 'Double story or more' || story === '2 storey';
    const isTriple = story === '3 storey';
    const isMultiStorey = isDouble || isTriple;

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
          const sqmForClass = toNumberOrUndefined(input.approxSize);
          const classFromBedrooms = inferApartmentClassFromBedroomNumbers(
            input.bedroomCount,
            hasMaster,
            sqmForClass
          );
          const aptClass =
            (typeof input.bedroomCount === 'number' ? classFromBedrooms : undefined) ??
            inferApartmentClassFromSqm(sqmForClass) ??
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
        // bathroomCount 가 있으면 (House Entire property 신규 UI) 직접 사용, 없으면 rooms에서 추정
        const hasBathroomCountField =
          typeof input.bathroomCount === 'number' && Number.isFinite(input.bathroomCount);

        const bedroomsTotal = hasBathroomCountField
          ? (typeof input.bedroomCount === 'number' && Number.isFinite(input.bedroomCount)
              ? input.bedroomCount
              : 0)
          : (typeof input.bedroomCount === 'number' && Number.isFinite(input.bedroomCount)
              ? input.bedroomCount
              : 0) + (hasMaster ? 1 : 0);

        const bathroomsTotal = hasBathroomCountField
          ? input.bathroomCount!
          : (selectedRooms.includes('Bathroom') ? 1 : 0) +
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

      // Range cap (dynamic)
      {
        const capped = capRangeWidthSmart(intMin, intMax, input, 'interior');
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

      // wallType 기반 앵커 선택 (cladding / rendered / brick / default)
      const wallTypeKey = (input.wallType ?? 'default') as keyof typeof EXTERIOR_WALL_TYPE_ANCHOR;
      const wallAnchor = EXTERIOR_WALL_TYPE_ANCHOR[wallTypeKey] ?? EXTERIOR_WALL_TYPE_ANCHOR.default;
      const wallFloors = EXTERIOR_WALL_TYPE_FLOORS[wallTypeKey] ?? EXTERIOR_WALL_TYPE_FLOORS.default;

      // Wall area calculation: perimeter × height (captures story difference)
      const floorSqm = toNumberOrUndefined(input.approxSize) ?? 150;
      const wallHeight = toNumberOrUndefined(input.wallHeight)
        ?? DEFAULT_WALL_HEIGHT[story] ?? 2.7;
      const wallArea = estimateWallArea(floorSqm, wallHeight);
      const band = pickExteriorBand(wallArea);

      let baseMin = wallAnchor.median * band.minMult;
      let baseMax = wallAnchor.median * band.maxMult;

      baseMin = Math.max(baseMin, wallAnchor.min * band.minMult);
      baseMax = Math.min(
        Math.max(baseMax, wallAnchor.min * 1.25),
        wallAnchor.max * band.maxMult
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

      // NOTE: storyMult is NOT applied here because wall height already
      // captures the story difference via wallArea calculation.

      const diffs = input.jobDifficulty ?? [];
      const hasDifficultAccess = diffs.includes('Difficult access areas');

      if (hasDifficultAccess) {
        if (isTriple) {
          rMin *= 1.05;
          rMax *= 1.10;
        } else if (isDouble) {
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
        isFullExterior && isTriple
          ? wallFloors.tripleStoreyFullExterior
          : isFullExterior && isMultiStorey
            ? wallFloors.doubleStoreyFullExterior
            : isFullExterior
              ? wallFloors.fullExterior
              : hasEaves
                ? wallFloors.wallPlusEaves
                : wallFloors.wallOnly;

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
        const capped = capRangeWidthSmart(extMin, extMax, input, 'exterior');
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
      const capped = capRangeWidthSmart(totalMin, totalMax, input, 'total');
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
    const WALL_TYPE_SURFACE_NOTES: Record<string, string> = {
      rendered:
        'Rendered surfaces have a textured, porous finish that requires a full 3-coat system (1 undercoat + 2 finish coats) for proper adhesion and uniform coverage. The undercoat seals the render and prevents uneven absorption, while the two finish coats ensure colour consistency and long-term weather protection — particularly important for exterior surfaces exposed to Sydney\'s coastal conditions.',
      brick:
        'Brick surfaces require significantly more labour and preparation than other wall types. The deep mortar joints absorb more paint and demand careful brushwork to achieve full coverage, along with more complex surface preparation. While the same 3-coat system applies (1 undercoat + 2 finish coats), the increased application complexity and higher material consumption are reflected in the estimate.',
    };
    const wallTypeSurfaceNote = input.wallType ? WALL_TYPE_SURFACE_NOTES[input.wallType] : undefined;

    const { output } = await explanationPrompt({
      input,
      intMin,
      intMax,
      extMin,
      extMax,
      priceMin: totalMin,
      priceMax: totalMax,
      wallTypeSurfaceNote,
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