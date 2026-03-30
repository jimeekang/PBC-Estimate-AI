'use server';

/**
 * @fileOverview Data-driven AI agent to estimate painting price range.
 *
 * Anchors calibrated to Northern Beaches, Sydney (premium market).
 * Base price = wall + ceiling + trim oil-based (all included).
 *
 * - Apartment interior (Entire property): uses CONTINUOUS SQM CURVE for smooth pricing.
 *   No class-based cliffs. 85sqm (avg 2bed apartment) is calibrated to start from low-$4k.
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
import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';
import { EXTERIOR_RESTRICTED_PROPERTY_TYPES } from '@/lib/estimate-constants';
import {
  InteriorHandrailDetailsSchema,
  InteriorRoomItemSchema,
  SkirtingCalculatorRoomSchema,
} from '@/schemas/estimate';
import {
  APARTMENT_ANCHORS_OIL,
  APARTMENT_SQM_CURVE,
  HOUSE_INTERIOR_ANCHORS,
  EXTERIOR_WALL_TYPE_ANCHOR,
  EXTERIOR_WALL_TYPE_FLOORS,
  MAX_PRICE_CAP,
  AREA_SHARE,
  CONDITION_MULTIPLIER,
  HOUSE_CONDITION_MULTIPLIER,
  EXTERIOR_CONDITION_MULTIPLIER,
  STORY_MODIFIER,
  DEFAULT_WALL_HEIGHT,
  EXTERIOR_WALL_AREA_BANDS,
  EXTERIOR_AREA_UPLIFT_PCT,
  EXTERIOR_DOOR_ANCHOR,
  EXTERIOR_WINDOW_ANCHOR,
  EXTERIOR_ARCHITRAVE_ANCHOR,
  EXTERIOR_FRONT_DOOR_ANCHOR,
  INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL,
  INTERIOR_DOOR_ITEM_ANCHOR,
  INTERIOR_WINDOW_ITEM_ANCHOR,
  INTERIOR_SKIRTING_LINEAR_RATE,
  INTERIOR_HANDRAIL_ITEM_PRICING,
  CAL_3B2B_FAIR_SINGLE_POINTS,
  DOUBLE_STOREY_3B2B_UPLIFT,
  clamp,
  lerp,
  getRawMedianFromSqm,
  pickExteriorBand,
  estimateWallArea,
  getInteriorHandrailWidthMultiplier,
  getQtyScaleFactor,
  calcTrimItemCost,
  inferHouseKey,
  capRangeWidthSmart,
  interpolateBySqm,
  sumAreaFactor,
  sumAreaFactorWholeApartment,
} from '@/lib/pricing-engine';

// -----------------------------
// Anchors (Sydney averages)
// -----------------------------

// NOTE: Anchors, SQM curve, and pricing constants are imported from '@/lib/pricing-engine'.
// See that file for Sydney Northern Beaches 2026 calibration values.

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
  Lounge: 1.35,
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
  Excellent: { min: 0.95, max: 1.05 },
  Fair:      { min: 0.92, max: 1.08 },
  Poor:      { min: 0.90, max: 1.25 },
} as const;

/** Standard coat system: 1 undercoat + 2 finish coats */
const BASE_COAT_COUNT = 3;

const WATER_BASED_UPLIFT = { minPct: 0.04, maxPct: 0.06 } as const;
const TRIM_PREMIUM_ENTIRE_WATER_PER_ITEM = { min: 50, max: 110 } as const;
const TRIM_PREMIUM_SPECIFIC_PER_ROOM = {
  'Oil-based': { min: 130, max: 220 },
  'Water-based': { min: 155, max: 260 },
} as const;

/** Interior window frame painting price by window type (AUD), Sydney Northern Beaches 2026. */
const INTERIOR_WINDOW_PRICE = {
  'Oil-based': {
    Normal: 140,
    Awning: 165,
    'Double Hung': 210,
    French: 290,
  },
  'Water-based': {
    Normal: 180,
    Awning: 205,
    'Double Hung': 255,
    French: 340,
  },
} as const;

const INTERIOR_WINDOW_TYPE_PREMIUM = {
  'Oil-based': {
    Normal: { min: 80, max: 140 },
    Awning: { min: 100, max: 170 },
    'Double Hung': { min: 130, max: 220 },
    French: { min: 230, max: 290 },
  },
  'Water-based': {
    Normal: { min: 95, max: 160 },
    Awning: { min: 120, max: 195 },
    'Double Hung': { min: 150, max: 245 },
    French: { min: 245, max: 310 },
  },
} as const;

const INTERIOR_TRIM_ONLY_BASE = {
  apartment: { min: 2850, max: 3600 },
  house: { min: 3200, max: 4100 },
} as const;

const INTERIOR_SKIRTING_ROOM_ANCHOR = {
  'Master Bedroom': { oil_2coat: 200, water_3coat_white_finish: 255 },
  'Bedroom 1': { oil_2coat: 145, water_3coat_white_finish: 190 },
  'Bedroom 2': { oil_2coat: 145, water_3coat_white_finish: 190 },
  'Bedroom 3': { oil_2coat: 145, water_3coat_white_finish: 190 },
  Bathroom: { oil_2coat: 160, water_3coat_white_finish: 210 },
  'Living Room': { oil_2coat: 220, water_3coat_white_finish: 280 },
  Lounge: { oil_2coat: 220, water_3coat_white_finish: 280 },
  Dining: { oil_2coat: 220, water_3coat_white_finish: 280 },
  Kitchen: { oil_2coat: 220, water_3coat_white_finish: 280 },
  'Study / Office': { oil_2coat: 180, water_3coat_white_finish: 230 },
  Laundry: { oil_2coat: 160, water_3coat_white_finish: 210 },
  Hallway: { oil_2coat: 160, water_3coat_white_finish: 210 },
  Foyer: { oil_2coat: 160, water_3coat_white_finish: 210 },
  Stairwell: { oil_2coat: 260, water_3coat_white_finish: 330 },
  'Walk-in robe': { oil_2coat: 140, water_3coat_white_finish: 180 },
  Etc: { oil_2coat: 180, water_3coat_white_finish: 230 },
} as const;

const INTERIOR_SPECIFIC_ROOM_TYPE_MULTIPLIER: Record<string, number> = {
  Bathroom: 1.12,
  Kitchen: 1.08,
  Laundry: 1.02,
  Stairwell: 1.18,
  Hallway: 0.94,
  Foyer: 0.94,
  'Walk-in robe': 0.9,
  'Study / Office': 1.0,
  Etc: 1.0,
};

const INTERIOR_SPECIFIC_SURFACE_RATE = {
  wall: { min: 18, max: 24 },
  ceiling: { min: 12, max: 18 },
  trimLinear: { min: 4, max: 7 },
} as const;

const TRIM_ONLY_SKIRTING_MARKET_UPLIFT = 20;

// -----------------------------
// Exterior modelling (UPDATED)
// -----------------------------
// EXTERIOR_CONDITION_MULTIPLIER, EXTERIOR_WALL_AREA_BANDS, DEFAULT_WALL_HEIGHT,
// and EXTERIOR_AREA_UPLIFT_PCT are imported from '@/lib/pricing-engine'.

/** Standalone pricing for exterior detail areas selected WITHOUT Wall painting.
 *  Calibrated for Sydney Northern Beaches 2026.
 */
const EXTERIOR_DETAIL_STANDALONE: Record<string, { min: number; max: number; perStoryMult?: number }> = {
  'Exterior Trim': { min: 400, max: 1500, perStoryMult: 1.4 },
  'Pipes':         { min: 200, max: 600,  perStoryMult: 1.3 },
  // Deck removed: priced independently via calcDeckCost()
  // Paving removed: priced independently via calcPavingCost()
  'Eaves':         { min: 600, max: 2500, perStoryMult: 1.3 },
  'Gutter':        { min: 400, max: 1500, perStoryMult: 1.3 },
  'Fascia':        { min: 400, max: 1500, perStoryMult: 1.3 },
  'Roof':          { min: 2500, max: 9000 },
  'Etc':           { min: 300, max: 1500 },
};

// -----------------------------
// Deck Pricing Anchors (Sydney Northern Beaches 2026, prep included, PBC ×0.7 of market)
// Applies to House > Exterior > Deck regardless of whether Wall is selected.
// Prices cover: sanding + cleaning (prep) + application coats.
// -----------------------------

/** Per-m² rate bands (min, max) by service type. */
const DECK_RATE_PER_M2: Record<string, { min: number; max: number }> = {
  'stain-oil':         { min: 32, max: 60 },  // 2-coat oil-based stain
  'stain-water':       { min: 34, max: 62 },  // 2-coat water-based stain
  'clear-oil':         { min: 28, max: 53 },  // 2-coat oil-based clear/sealer
  'clear-water':       { min: 30, max: 55 },  // 2-coat water-based clear/sealer
  'paint-conversion':  { min: 60, max: 91 },  // 3-coat varnish/stain→paint (strip+prime+2coat)
  'paint-recoat':      { min: 35, max: 60 },  // 2-coat paint→paint recoat
};

/** Area band multiplier (small job premium / large job discount). */
function getDeckAreaBandMult(areaSqm: number): number {
  if (areaSqm <= 20)  return 1.15;
  if (areaSqm <= 50)  return 1.00;
  if (areaSqm <= 100) return 0.90;
  return 0.82;
}

/** Timber condition modifier applied on top of base rate. */
const DECK_CONDITION_MULT: Record<string, number> = {
  good:      1.00,  // light sand, standard prep
  weathered: 1.25,  // extra sanding, possible chemical strip
  damaged:   1.55,  // heavy prep, board repair, deep sand
};

const DECK_MINIMUM_CHARGE = 600;
const DECK_PROJECT_CEILING = 22000;

// -----------------------------
// Paving Pricing Anchors (Sydney Northern Beaches 2026, market-aligned ~88-92%)
// Applies to Exterior > Paving regardless of whether Wall is selected.
// Prices cover: pressure wash / etch / prime + 2 coats paving paint.
// Minimum 2-day job due to inter-coat dry time — reflected in PAVING_MINIMUM_CHARGE.
// -----------------------------

/** Per-m² rate bands by area bracket (min, max AUD). */
const PAVING_RATE_PER_M2: { maxArea: number; min: number; max: number }[] = [
  { maxArea: 25,   min: 44, max: 56 },  // ≤25 m² — small job premium
  { maxArea: 70,   min: 34, max: 44 },  // 26–70 m² — standard
  { maxArea: 140,  min: 27, max: 35 },  // 71–140 m² — large
  { maxArea: Infinity, min: 22, max: 29 }, // >140 m² — commercial scale
];

/** Surface condition multiplier (prep intensity). */
const PAVING_CONDITION_MULT: Record<string, number> = {
  good: 1.00,  // clean, light etch only
  fair: 1.20,  // stained/oily — acid wash + extra prep
  poor: 1.45,  // cracked/spalled — crack fill + 2× primer
};

const PAVING_MINIMUM_CHARGE = 950;
const PAVING_PROJECT_CEILING = 18000;

/** Returns the per-m² rate for the given area. */
function getPavingRate(area: number): { min: number; max: number } {
  return PAVING_RATE_PER_M2.find(b => area <= b.maxArea)!;
}

/** Computes paving cost range. Returns null if pavingArea is missing or zero. */
function calcPavingCost(input: {
  pavingArea?: number;
  pavingCondition?: string;
}): { min: number; max: number } | null {
  const area = input.pavingArea;
  if (!area || area <= 0) return null;

  const rate     = getPavingRate(area);
  const condMult = PAVING_CONDITION_MULT[input.pavingCondition ?? 'good'] ?? 1.0;

  return {
    min: Math.max(PAVING_MINIMUM_CHARGE, Math.round(area * rate.min * condMult)),
    max: Math.min(PAVING_PROJECT_CEILING, Math.round(area * rate.max * condMult)),
  };
}

/** Resolves deck service key from service + product type inputs. */
function getDeckServiceKey(
  serviceType: string,
  productType?: string
): string {
  if (serviceType === 'paint-conversion' || serviceType === 'paint-recoat') {
    return serviceType;
  }
  return `${serviceType}-${productType ?? 'oil'}`;
}

/** Computes deck cost range. Returns null if deckArea is missing or zero. */
function calcDeckCost(input: {
  deckArea?: number;
  deckServiceType?: string;
  deckProductType?: string;
  deckCondition?: string;
}): { min: number; max: number } | null {
  const area = input.deckArea;
  if (!area || area <= 0) return null;

  const key = getDeckServiceKey(
    input.deckServiceType ?? 'stain',
    input.deckProductType
  );
  const rate = DECK_RATE_PER_M2[key];
  if (!rate) return null;

  const bandMult  = getDeckAreaBandMult(area);
  const condMult  = DECK_CONDITION_MULT[input.deckCondition ?? 'good'] ?? 1.0;

  const rawMin = area * rate.min * bandMult * condMult;
  const rawMax = area * rate.max * bandMult * condMult;

  return {
    min: Math.max(DECK_MINIMUM_CHARGE, Math.round(rawMin)),
    max: Math.min(DECK_PROJECT_CEILING, Math.round(rawMax)),
  };
}

// INTERIOR_DOOR_ITEM_ANCHOR, INTERIOR_WINDOW_ITEM_ANCHOR imported from '@/lib/pricing-engine'.
// EXTERIOR_FLOORS kept for backward-compat; actual floors resolved via EXTERIOR_WALL_TYPE_FLOORS

// -----------------------------
// Exterior Trim Item-Level Anchors (Sydney Northern Beaches 2026)
// Per-item pricing for doors, windows, architraves.
// These are ADDITIVE to the base exterior estimate — not captured by EXTERIOR_AREA_UPLIFT_PCT.
// -----------------------------

// EXTERIOR_DOOR_ANCHOR, EXTERIOR_FRONT_DOOR_ANCHOR, EXTERIOR_WINDOW_ANCHOR,
// EXTERIOR_ARCHITRAVE_ANCHOR, getQtyScaleFactor, calcTrimItemCost — imported from '@/lib/pricing-engine'.

function getFrontDoorCost(input: GeneratePaintingEstimateInput): { min: number; max: number } {
  if (!input.exteriorFrontDoor) return { min: 0, max: 0 };
  return EXTERIOR_FRONT_DOOR_ANCHOR;
}

function isFrontDoorOnlyExteriorTrim(input: GeneratePaintingEstimateInput): boolean {
  if (!input.exteriorFrontDoor) return false;
  const trimItems = input.exteriorTrimItems ?? [];
  return (
    trimItems.includes('Front Door') &&
    !trimItems.includes('Doors') &&
    !trimItems.includes('Window Frames') &&
    !trimItems.includes('Architraves') &&
    !(input.exteriorDoors ?? []).some((item) => (item.quantity ?? 0) > 0) &&
    !(input.exteriorWindows ?? []).some((item) => (item.quantity ?? 0) > 0) &&
    !(input.exteriorArchitraves ?? []).some((item) => (item.quantity ?? 0) > 0)
  );
}

// -----------------------------
// Helpers
// -----------------------------
// clamp, getInteriorHandrailWidthMultiplier, estimateWallArea, pickExteriorBand
// are imported from '@/lib/pricing-engine'.

function toNumberOrUndefined(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return undefined;
}

function getInteriorHandrailRange(
  rooms: z.infer<typeof GeneratePaintingEstimateInputSchema>['interiorRooms']
) {
  if (!rooms?.length) return { min: 0, max: 0, details: [] as string[] };

  let min = 0;
  let max = 0;
  const details: string[] = [];

  for (const room of rooms) {
    if (room.roomName !== 'Handrail' || !room.handrailDetails?.system) continue;

    const lengthLm = toNumberOrUndefined(room.handrailDetails.lengthLm);
    const widthMm = toNumberOrUndefined(room.handrailDetails.widthMm);
    if (!lengthLm || !widthMm) continue;

    const system = room.handrailDetails.system;
    const pricing = INTERIOR_HANDRAIL_ITEM_PRICING[system];
    const widthMultiplier = getInteriorHandrailWidthMultiplier(widthMm);
    const lineMin = Math.round(Math.max(pricing.minJob.min, lengthLm * pricing.rate.min * widthMultiplier));
    const lineMax = Math.round(Math.max(pricing.minJob.max, lengthLm * pricing.rate.max * widthMultiplier));

    min += lineMin;
    max += lineMax;
    details.push(
      `Interior handrail set (${lengthLm} lm, ${widthMm}mm, ${pricing.label}) = AUD ${lineMin.toLocaleString('en-AU')} - ${lineMax.toLocaleString('en-AU')}`
    );
  }

  return { min, max, details };
}

function formatMoney(n: number) {
  return n.toLocaleString('en-AU');
}

function hasPricedInteriorSurfaceSelection(flags?: {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
}) {
  return !!(flags?.ceilingPaint || flags?.wallPaint || flags?.trimPaint);
}

function getInteriorDoorUnitPrice(system: string, scope: string) {
  const pricingBySystem = INTERIOR_DOOR_ITEM_ANCHOR as Record<string, Record<string, number>>;
  const unitPrice = pricingBySystem[system]?.[scope];
  if (typeof unitPrice !== 'number') {
    throw new Error(`Unknown interior door pricing key: ${system} / ${scope}`);
  }
  return unitPrice;
}

function getInteriorWindowUnitPrice(system: string, type: string, scope: string) {
  const pricingBySystem = INTERIOR_WINDOW_ITEM_ANCHOR as Record<
    string,
    Record<string, Record<string, number>>
  >;
  const unitPrice = pricingBySystem[system]?.[type]?.[scope];
  if (typeof unitPrice !== 'number') {
    throw new Error(`Unknown interior window pricing key: ${system} / ${type} / ${scope}`);
  }
  return unitPrice;
}

function trimPaintTypeToSystem(paintType: 'Oil-based' | 'Water-based') {
  return paintType === 'Water-based' ? 'water_3coat_white_finish' as const : 'oil_2coat' as const;
}

function getSpecificInteriorRoomBaseAnchor(roomName: string) {
  return (
    INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL[
      roomName as keyof typeof INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL
    ] ?? INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL.Etc
  );
}

function getInteriorSkirtingRoomAnchor(roomName: string, paintType: 'Oil-based' | 'Water-based') {
  const system = trimPaintTypeToSystem(paintType);
  const anchor =
    INTERIOR_SKIRTING_ROOM_ANCHOR[
      roomName as keyof typeof INTERIOR_SKIRTING_ROOM_ANCHOR
    ] ?? INTERIOR_SKIRTING_ROOM_ANCHOR.Etc;
  return anchor[system];
}

function estimateInteriorRoomPerimeter(sqm: number) {
  return 4.1 * Math.sqrt(sqm);
}

function getInteriorSpecificRoomMultiplier(roomName: string) {
  return INTERIOR_SPECIFIC_ROOM_TYPE_MULTIPLIER[roomName] ?? 1.0;
}

function getMeasuredInteriorSkirtingRange(
  sqm: number,
  paintType: 'Oil-based' | 'Water-based'
) {
  const perimeter = estimateInteriorRoomPerimeter(sqm);
  const system = trimPaintTypeToSystem(paintType);
  const rate = INTERIOR_SKIRTING_LINEAR_RATE[system];
  return {
    min: Math.round(perimeter * rate.min),
    max: Math.round(perimeter * rate.max),
  };
}

function getTrimOnlySkirtingLinearMetres(
  input: GeneratePaintingEstimateInput
) {
  if ((input.skirtingPricingMode ?? 'linear_metres') === 'linear_metres') {
    return toNumberOrUndefined(input.skirtingLinearMetres) ?? 0;
  }

  return (input.skirtingCalculatorRooms ?? []).reduce((sum, room) => {
    const length = toNumberOrUndefined(room.length) ?? 0;
    const width = toNumberOrUndefined(room.width) ?? 0;
    if (!length || !width) return sum;
    return sum + 2 * (length + width);
  }, 0);
}

function getTrimOnlySkirtingRange(
  input: GeneratePaintingEstimateInput,
  paintType: 'Oil-based' | 'Water-based'
) {
  const linearMetres = getTrimOnlySkirtingLinearMetres(input);
  if (linearMetres <= 0) return { min: 0, max: 0 };

  const system = trimPaintTypeToSystem(paintType);
  const rate = INTERIOR_SKIRTING_LINEAR_RATE[system];
  return {
    min: Math.round(linearMetres * rate.min) + TRIM_ONLY_SKIRTING_MARKET_UPLIFT,
    max: Math.round(linearMetres * rate.max) + TRIM_ONLY_SKIRTING_MARKET_UPLIFT,
  };
}

function isSkirtingOnlyTrimSpecific(input: GeneratePaintingEstimateInput) {
  const trimItems = input.trimPaintOptions?.trimItems ?? [];
  return (
    input.scopeOfPainting === 'Specific areas only' &&
    !!input.specificInteriorTrimOnly &&
    trimItems.includes('Skirting Boards') &&
    !trimItems.includes('Doors') &&
    !trimItems.includes('Window Frames')
  );
}

function calculateMeasuredSpecificInteriorBase(
  rooms: z.infer<typeof GeneratePaintingEstimateInputSchema>['interiorRooms'],
  interiorWallHeight?: number
) {
  if (!rooms?.length || !interiorWallHeight || !Number.isFinite(interiorWallHeight)) return undefined;

  let min = 0;
  let max = 0;

  for (const room of rooms) {
    if (room.roomName === 'Handrail') continue;
    const sqm = room.approxRoomSize;
    if (!sqm || !Number.isFinite(sqm) || sqm <= 0) return undefined;

    const perimeter = estimateInteriorRoomPerimeter(sqm);
    const wallArea = perimeter * interiorWallHeight;
    const multiplier = getInteriorSpecificRoomMultiplier(room.roomName);
    const paintAreas = room.paintAreas ?? {};

    if (paintAreas.wallPaint) {
      min += wallArea * INTERIOR_SPECIFIC_SURFACE_RATE.wall.min * multiplier;
      max += wallArea * INTERIOR_SPECIFIC_SURFACE_RATE.wall.max * multiplier;
    }

    if (paintAreas.ceilingPaint) {
      min += sqm * INTERIOR_SPECIFIC_SURFACE_RATE.ceiling.min * multiplier;
      max += sqm * INTERIOR_SPECIFIC_SURFACE_RATE.ceiling.max * multiplier;
    }

    if (paintAreas.trimPaint) {
      min += perimeter * INTERIOR_SPECIFIC_SURFACE_RATE.trimLinear.min * multiplier;
      max += perimeter * INTERIOR_SPECIFIC_SURFACE_RATE.trimLinear.max * multiplier;
    }

    if (paintAreas.ensuitePaint) {
      min += 420 * multiplier;
      max += 720 * multiplier;
    }
  }

  return { min: Math.round(min), max: Math.round(max) };
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

// sumAreaFactor imported from '@/lib/pricing-engine'.

/** True when the job is interior-only, Specific areas only, with itemised
 *  trim items and NO rooms that have wall or ceiling painting selected.
 *  In this case we bypass room-based pricing entirely. */
function isInteriorTrimItemOnly(
  input: z.infer<typeof GeneratePaintingEstimateInputSchema>
): boolean {
  if (!input.typeOfWork.includes('Interior Painting')) return false;
  if (input.typeOfWork.includes('Exterior Painting')) return false;
  if (input.scopeOfPainting !== 'Specific areas only') return false;
  if (!input.interiorDoorItems?.length && !input.interiorWindowItems?.length) return false;
  const rooms = input.interiorRooms ?? [];
  return !rooms.some((r) => r.paintAreas.wallPaint || r.paintAreas.ceilingPaint);
}

function isTrimOnlySpecificInterior(
  input: z.infer<typeof GeneratePaintingEstimateInputSchema>,
  selectedRooms: string[]
) {
  if (input.scopeOfPainting !== 'Specific areas only') return false;
  if (!input.trimPaintOptions?.trimItems?.length) return false;

  if (!selectedRooms.length) return true;

  const rooms = input.interiorRooms ?? [];
  if (!rooms.length) return true;

  return rooms.every((room) => {
    const paintAreas = room.paintAreas ?? {};
    return !!paintAreas.trimPaint && !paintAreas.wallPaint && !paintAreas.ceilingPaint;
  });
}

function hasSelectedTrimOptions(input: z.infer<typeof GeneratePaintingEstimateInputSchema>) {
  return !!input.trimPaintOptions?.trimItems?.length;
}

function hasSelectedFrontDoor(input: z.infer<typeof GeneratePaintingEstimateInputSchema>) {
  return !!input.exteriorFrontDoor;
}

function withTrimPricingNote(
  text: string,
  includeTrimPricingNote: boolean
) {
  if (!includeTrimPricingNote) return text;
  const trimNote = 'Pricing varies depending on the number of trim items included.';
  return text.includes(trimNote) ? text : `${text} ${trimNote}`;
}

function withFrontDoorPricingNote(
  text: string,
  includeFrontDoorPricingNote: boolean
) {
  if (!includeFrontDoorPricingNote) return text;
  const frontDoorNote =
    'Front door pricing can vary depending on the door style, size, paint system, surface condition, and labour required for preparation and application.';
  return text.includes(frontDoorNote) ? text : `${text} ${frontDoorNote}`;
}

// sumAreaFactorWholeApartment imported from '@/lib/pricing-engine'.

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

// inferHouseKey imported from '@/lib/pricing-engine'.

// -----------------------------
// RANGE CAP POLICY (dynamic) — capRangeWidthSmart, lerp, interpolateBySqm imported from '@/lib/pricing-engine'.
// Interior/Total: $0~5k→1,200 / $5k~10k→1,800 / $10k~18k→2,500 / $18k+→3,500
// Exterior:       $0~10k→1,500 / $10k~20k→2,500 / $20k+→4,000
// -----------------------------

// -----------------------------
// 3B2B FAIR (House) curve — CAL_3B2B_FAIR_SINGLE_POINTS imported from '@/lib/pricing-engine'.
// -----------------------------

function shouldApply3B2BFairSingleHouseCalibration(
  input: GeneratePaintingEstimateInput,
  houseKey?: keyof typeof HOUSE_INTERIOR_ANCHORS
) {
  const isHouse = input.propertyType === 'House / Townhouse';
  const condition = input.paintCondition ?? 'Fair';
  const story = input.houseStories ?? '1 storey';
  return (
    input.scopeOfPainting === 'Entire property' &&
    isHouse &&
    houseKey === '3B2B' &&
    condition === 'Fair' &&
    (story === 'Single story' || story === '1 storey')
  );
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
// Double storey 3B2B uplift — DOUBLE_STOREY_3B2B_UPLIFT imported from '@/lib/pricing-engine'.
// -----------------------------

function applyDoubleStorey3B2BUplift(
  input: GeneratePaintingEstimateInput,
  houseKey: keyof typeof HOUSE_INTERIOR_ANCHORS,
  minVal: number,
  maxVal: number
) {
  const isHouse = input.propertyType === 'House / Townhouse';
  const condition = input.paintCondition ?? 'Fair';
  const story = input.houseStories ?? '1 storey';

  if (
    input.scopeOfPainting !== 'Entire property' ||
    !isHouse ||
    houseKey !== '3B2B' ||
    condition !== 'Fair' ||
    (story !== 'Double story or more' && story !== '2 storey')
  ) {
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
// Exterior Complexity uplift (%)
// All rates >= 1.5x interior equivalents.
// Difficult access is weighted heavily (ladders/scaffolding for exterior).
// -----------------------------
function applyExteriorComplexityUpliftPct(
  input: GeneratePaintingEstimateInput,
  minVal: number,
  maxVal: number
) {
  const factors = input.jobDifficulty ?? [];
  const story = input.houseStories ?? '1 storey';
  const isDouble = story === '2 storey' || story === 'Double story or more';
  const isTriple = story === '3 storey';

  let minPct = 0;
  let maxPct = 0;

  for (const f of factors) {
    if (f === 'Difficult access areas') {
      // Exterior: ladders/scaffolding cost rises sharply with storey height.
      // Single: ~3x interior (1/3% → 3/9%). Double: scaffold mandatory (8/16%). Triple: 12/22%.
      if (isTriple) {
        minPct += 0.12;
        maxPct += 0.22;
      } else if (isDouble) {
        minPct += 0.08;
        maxPct += 0.16;
      } else {
        minPct += 0.03;
        maxPct += 0.09;
      }
      continue;
    }
    if (f === 'Stairs') {
      // 1.5x interior (1/2% → 1.5/3%)
      minPct += 0.015;
      maxPct += 0.03;
      continue;
    }
    if (f === 'High ceilings') {
      // 1.5x interior (1/2% → 1.5/3%)
      minPct += 0.015;
      maxPct += 0.03;
      continue;
    }
    if (f === 'Extensive mouldings or trims') {
      // 1.5x interior (2/4% → 3/6%)
      minPct += 0.03;
      maxPct += 0.06;
      continue;
    }
  }

  minPct = clamp(minPct, 0, 0.30);
  maxPct = clamp(maxPct, 0, 0.40);

  return {
    min: Math.round(minVal * (1 + minPct)),
    max: Math.round(maxVal * (1 + maxPct)),
  };
}

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
  specificInteriorTrimOnly: z.boolean().optional(),
  otherInteriorArea: z.string().optional(),
  apartmentStructure: z.enum(['Studio', '1Bed', '2Bed2Bath', '3Bed2Bath']).optional(),

  exteriorAreas: z.array(z.string()).optional(),
  otherExteriorArea: z.string().optional(),
  exteriorTrimItems: z.array(z.enum(['Doors', 'Window Frames', 'Architraves', 'Front Door'])).optional(),
  exteriorFrontDoor: z.boolean().optional(),
  wallType: z.enum(['cladding', 'rendered', 'brick']).optional(),
  wallHeight: z.number().optional(),

  /** Exterior trim item-level inputs (optional — additive to base exterior estimate) */
  exteriorDoors: z.array(z.object({
    style: z.enum(['Simple', 'Standard', 'Complex']),
    quantity: z.number().min(0),
  })).optional(),
  exteriorWindows: z.array(z.object({
    type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']),
    quantity: z.number().min(0),
  })).optional(),
  exteriorArchitraves: z.array(z.object({
    style: z.enum(['Simple', 'Standard', 'Complex']),
    quantity: z.number().min(0),
  })).optional(),

  approxSize: z.number().optional(),
  interiorWallHeight: z.number().optional(),
  location: z.string().optional(),

  /** Deck-specific inputs — used by calcDeckCost() for area-based pricing */
  deckArea: z.number().positive().optional(),
  deckServiceType: z.enum(['stain', 'clear', 'paint-conversion', 'paint-recoat']).optional(),
  deckProductType: z.enum(['oil', 'water']).optional(),
  deckCondition: z.enum(['good', 'weathered', 'damaged']).optional(),

  /** Paving-specific inputs — used by calcPavingCost() for area-based pricing */
  pavingArea: z.number().positive().optional(),
  pavingCondition: z.enum(['good', 'fair', 'poor']).optional(),

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
      interiorWindowFrameTypes: z.array(z.enum(['Normal', 'Awning', 'Double Hung', 'French'])).optional(),
    })
    .optional(),
  skirtingPricingMode: z.enum(['linear_metres', 'room_calculator']).optional(),
  skirtingLinearMetres: z.number().positive().optional(),
  skirtingCalculatorRooms: z.array(SkirtingCalculatorRoomSchema).optional(),

  ceilingType: z.enum(['Flat', 'Decorative']).optional(),

  /** Interior door item-level pricing (Specific areas only) */
  interiorDoorItems: z
    .array(
      z.object({
        scope: z.enum(['Door & Frame', 'Door only', 'Frame only']),
        system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
        quantity: z.number().min(1).max(50),
      })
    )
    .optional(),
  interiorWindowItems: z
    .array(
      z.object({
        type: z.enum(['Normal', 'Awning', 'Double Hung', 'French']),
        scope: z.enum(['Window & Frame', 'Window only', 'Frame only']),
        system: z.enum(['oil_2coat', 'water_3coat_white_finish']),
        quantity: z.number().min(1).max(50),
      })
    )
    .optional(),
}).refine(
  (data) => {
    const hasExterior = data.typeOfWork.includes('Exterior Painting');
    if (!hasExterior) return true;
    return !EXTERIOR_RESTRICTED_PROPERTY_TYPES.includes(
      data.propertyType as (typeof EXTERIOR_RESTRICTED_PROPERTY_TYPES)[number]
    );
  },
  { path: ['typeOfWork'], message: 'Exterior painting is only available for house-style properties.' }
).refine(
  (data) => {
    const hasExterior = data.typeOfWork.includes('Exterior Painting');
    if (!hasExterior) return true;
    return (data.exteriorAreas ?? []).length > 0;
  },
  { path: ['exteriorAreas'], message: 'Please select at least one exterior area.' }
).refine(
  (data) => {
    const needsExteriorWallSize =
      data.typeOfWork.includes('Exterior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      (data.exteriorAreas ?? []).includes('Wall');
    if (!needsExteriorWallSize) return true;
    return typeof data.approxSize === 'number' && data.approxSize > 0;
  },
  { path: ['approxSize'], message: 'Enter the approximate size in sqm when Wall is selected.' }
).refine(
  (data) => {
    const needsDeckArea =
      data.typeOfWork.includes('Exterior Painting') &&
      (data.exteriorAreas ?? []).includes('Deck');
    if (!needsDeckArea) return true;
    return typeof data.deckArea === 'number' && data.deckArea > 0;
  },
  { path: ['deckArea'], message: 'Enter the deck area in sqm when Deck is selected.' }
).refine(
  (data) => {
    const needsPavingArea =
      data.typeOfWork.includes('Exterior Painting') &&
      (data.exteriorAreas ?? []).includes('Paving');
    if (!needsPavingArea) return true;
    return typeof data.pavingArea === 'number' && data.pavingArea > 0;
  },
  { path: ['pavingArea'], message: 'Enter the paving area in sqm when Paving is selected.' }
).refine(
  (data) => {
    const hasInterior = data.typeOfWork.includes('Interior Painting');
    if (!hasInterior || data.scopeOfPainting !== 'Entire property') return true;
    return !!(
      data.paintAreas?.ceilingPaint ||
      data.paintAreas?.wallPaint ||
      data.paintAreas?.trimPaint ||
      data.paintAreas?.ensuitePaint
    );
  },
  { path: ['paintAreas'], message: 'Please select at least one interior surface.' }
).refine(
  (data) => {
    const hasInterior = data.typeOfWork.includes('Interior Painting');
    const needsApartmentSizing =
      hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType === 'Apartment';
    if (!needsApartmentSizing) return true;
    return !!data.apartmentStructure || typeof data.approxSize === 'number';
  },
  { path: ['apartmentStructure'], message: 'Select an apartment structure or enter an approximate size.' }
).refine(
  (data) => {
    const hasInterior = data.typeOfWork.includes('Interior Painting');
    const needsWholePropertySizing =
      hasInterior && data.scopeOfPainting === 'Entire property' && data.propertyType !== 'Apartment';
    if (!needsWholePropertySizing) return true;
    const hasCounts =
      typeof data.bedroomCount === 'number' && typeof data.bathroomCount === 'number';
    return hasCounts || typeof data.approxSize === 'number';
  },
  {
    path: ['bedroomCount'],
    message: 'Enter bedroom and bathroom counts or provide an approximate size for a whole-property estimate.',
  }
).refine(
  (data) => {
    const selectedMeasuredRooms =
      data.scopeOfPainting === 'Specific areas only'
        ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
        : [];
    if (!selectedMeasuredRooms.length) return true;
    return typeof data.interiorWallHeight === 'number';
  },
  { path: ['interiorWallHeight'], message: 'Enter the interior wall height for specific-area pricing.' }
).refine(
  (data) => {
    const selectedMeasuredRooms =
      data.scopeOfPainting === 'Specific areas only'
        ? (data.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail')
        : [];
    if (!selectedMeasuredRooms.length) return true;
    return selectedMeasuredRooms.every((room) => typeof room.approxRoomSize === 'number' && room.approxRoomSize > 0);
  },
  { path: ['interiorRooms'], message: 'Enter an approximate room size for each selected room.' }
).refine(
  (data) => {
    const needsSkirtingRoom =
      data.typeOfWork.includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      !data.specificInteriorTrimOnly &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
    if (!needsSkirtingRoom) return true;
    return (data.interiorRooms ?? []).some((room) => room.paintAreas?.trimPaint);
  },
  { path: ['interiorRooms'], message: 'Select at least one trim room when including skirting boards.' }
).refine(
  (data) => {
    const needsTrimOnlySkirting =
      data.typeOfWork.includes('Interior Painting') &&
      data.scopeOfPainting === 'Specific areas only' &&
      !!data.specificInteriorTrimOnly &&
      (data.trimPaintOptions?.trimItems ?? []).includes('Skirting Boards');
    if (!needsTrimOnlySkirting) return true;

    if ((data.skirtingPricingMode ?? 'linear_metres') === 'linear_metres') {
      return typeof data.skirtingLinearMetres === 'number' && data.skirtingLinearMetres > 0;
    }

    return (data.skirtingCalculatorRooms ?? []).some(
      (room) => typeof room.length === 'number' && room.length > 0 && typeof room.width === 'number' && room.width > 0
    );
  },
  { path: ['skirtingLinearMetres'], message: 'Enter skirting length or add room dimensions for skirting-only pricing.' }
);

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

  /** Present when pricing metadata is available. Itemized trim quotes use `interior_itemized`. */
  pricingMeta: z
    .object({
      mode: z.enum(['interior_itemized', 'estimate']),
      subtotalExGst: z.number(),
      gst: z.number(),
      totalIncGst: z.number(),
    })
    .optional(),
});

export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

function formatSelectedOptionList(values: string[] | undefined): string | undefined {
  if (!values?.length) return undefined;
  return values.join(', ');
}

function getSelectedOptionLines(input: GeneratePaintingEstimateInput): string[] {
  const lines: string[] = [];
  const exteriorAreas = (input.exteriorAreas ?? []).map((area) => {
    if (area === 'Etc' && input.otherExteriorArea?.trim()) {
      return `Etc (${input.otherExteriorArea.trim()})`;
    }
    return area;
  });
  const interiorAreas = (input.roomsToPaint ?? []).map((area) => {
    if (area === 'Etc' && input.otherInteriorArea?.trim()) {
      return `Etc (${input.otherInteriorArea.trim()})`;
    }
    return area;
  });

  const exteriorAreaText = formatSelectedOptionList(exteriorAreas);
  if (exteriorAreaText) lines.push(`Selected exterior areas: ${exteriorAreaText}`);

  const exteriorTrimText = formatSelectedOptionList(input.exteriorTrimItems);
  if (exteriorTrimText) lines.push(`Selected exterior trim items: ${exteriorTrimText}`);

  const interiorAreaText = formatSelectedOptionList(interiorAreas);
  if (interiorAreaText) lines.push(`Selected interior areas: ${interiorAreaText}`);

  const difficultyText = formatSelectedOptionList(input.jobDifficulty);
  if (difficultyText) lines.push(`Selected difficulty factors: ${difficultyText}`);

  if ((input.exteriorAreas ?? []).includes('Wall') && input.wallType) {
    lines.push(`Selected wall finish: ${input.wallType}`);
  }

  return lines;
}

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
      deckMin: z.number().optional(),
      deckMax: z.number().optional(),
      pavingMin: z.number().optional(),
      pavingMax: z.number().optional(),
      selectedOptionLines: z.array(z.string()),
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
SELECTED OPTIONS ONLY
{{#each selectedOptionLines}}
- {{this}}
{{/each}}
{{#if input.deckArea}}
DECK DETAILS
- Deck area: {{input.deckArea}}sqm
- Service type: {{#if input.deckServiceType}}{{input.deckServiceType}}{{else}}stain{{/if}}
- Product base: {{#if input.deckProductType}}{{input.deckProductType}}-based{{else}}oil-based{{/if}}
- Timber condition: {{#if input.deckCondition}}{{input.deckCondition}}{{else}}good{{/if}}
- Deck cost range: AUD {{deckMin}} – {{deckMax}}
{{/if}}
{{#if input.pavingArea}}
PAVING DETAILS
- Paving area: {{input.pavingArea}}sqm
- Surface condition: {{#if input.pavingCondition}}{{input.pavingCondition}}{{else}}good{{/if}}
- Application: 2-coat Dulux paving system (pressure wash + etch/prime + 2 coats), minimum 2-day job due to inter-coat dry time
- Paving cost range: AUD {{pavingMin}} – {{pavingMax}}
{{/if}}

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
1) explanation: 3–5 sentences, Australian English, professional tone. All text MUST be in English.
   Focus on the main cost drivers: scope, condition, selected areas, stories, wall finish (if exterior), and complexity factors.
   Mention only options that are explicitly present in SELECTED OPTIONS ONLY, DECK DETAILS, or PAVING DETAILS.
   Do not mention unselected areas, trim items, wall finishes, service types, product bases, or complexity factors.
   If wallType is "rendered" or "brick", incorporate the relevant SURFACE NOTE above into the explanation naturally.
   If trim-related options are selected, include this idea naturally: "Pricing varies depending on the number of trim items included."
   If DECK DETAILS are present: mention the deck area, service type, and timber condition naturally in one sentence.
   If PAVING DETAILS are present: mention the paving area and surface condition, and note that the 2-coat system requires a minimum 2-day application process due to inter-coat drying time.
2) priceRange:
   - Use commas as thousands separators.
   - If Total priceMax >= 35,000 format: "From AUD {{priceMin}}+ (Site Inspection Required)"
   - Else: "AUD {{priceMin}} - {{priceMax}}"
3) details: 4–7 bullet points. All text MUST be in English.
   - MUST include a clear breakdown line if both Interior and Exterior are selected:
     "Interior: AUD X - Y"
     "Exterior: AUD X - Y"
     "Total: AUD X - Y"
   - If DECK DETAILS are present, MUST include a dedicated line:
     "Deck (X sqm) — [service type] / [condition] timber: AUD X – Y"
   - If PAVING DETAILS are present, MUST include a dedicated line:
     "Paving (X sqm) — [surface condition] surface, 2-coat system: AUD X – Y"
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

    const story = input.houseStories ?? '1 storey';
    const storyMult = STORY_MODIFIER[story] || 1.0;

    // -----------------------------
    // Interior door item-level pricing (early return — bypasses room-based model)
    // Triggered when: Interior only + Specific areas only + door items + no wall/ceiling rooms
    // -----------------------------
    if (isInteriorTrimItemOnly(input)) {
      let subtotalExGst = 0;
      const lineItems: string[] = [];

      for (const item of input.interiorDoorItems ?? []) {
        const unitPrice = getInteriorDoorUnitPrice(item.system, item.scope);
        const lineTotal = unitPrice * item.quantity;
        subtotalExGst += lineTotal;
        const systemLabel =
          item.system === 'oil_2coat'
            ? '2 coats (oil-based)'
            : '3 coats (water-based, white finish)';
        lineItems.push(
          `${item.scope} × ${item.quantity} — ${systemLabel} @ AUD ${unitPrice} each = AUD ${lineTotal.toLocaleString('en-AU')}`
        );
      }

      for (const item of input.interiorWindowItems ?? []) {
        const unitPrice = getInteriorWindowUnitPrice(item.system, item.type, item.scope);
        const lineTotal = unitPrice * item.quantity;
        subtotalExGst += lineTotal;
        const systemLabel =
          item.system === 'oil_2coat'
            ? '2 coats (oil-based)'
            : '3 coats (water-based, white finish)';
        lineItems.push(
          `Window: ${item.type} / ${item.scope} x ${item.quantity} - ${systemLabel} @ AUD ${unitPrice} each = AUD ${lineTotal.toLocaleString('en-AU')}`
        );
      }

      const gst = Math.round(subtotalExGst * 0.1);
      const totalIncGst = subtotalExGst + gst;
      const priceStr = `AUD ${subtotalExGst.toLocaleString('en-AU')} + GST`;

      return {
        priceRange: priceStr,
        explanation: `This is a fixed-price itemised quote for interior trim painting. Doors and windows are priced per unit, based on the selected type, painted area, and paint system, so room-based modelling does not apply. All prices are exclusive of GST (10%). GST of AUD ${gst.toLocaleString('en-AU')} applies, making the total AUD ${totalIncGst.toLocaleString('en-AU')} including GST.`,
        details: lineItems,
        breakdown: {
          interior: { min: subtotalExGst, max: subtotalExGst, priceRange: priceStr },
          total: { min: subtotalExGst, max: subtotalExGst, priceRange: priceStr },
        },
        pricingMeta: {
          mode: 'interior_itemized' as const,
          subtotalExGst,
          gst,
          totalIncGst,
        },
      };
    }

    // -----------------------------
    // 1) Interior
    // -----------------------------
    let intMin = 0;
    let intMax = 0;

    if (isInt) {
      const isWhole = input.scopeOfPainting === 'Entire property';
      const aptLike = isApartmentLike(input.propertyType);
      const isSkirtingOnlySpecific = isSkirtingOnlyTrimSpecific(input);

      let selectedRooms: string[] = [];
      let areaFactor = 1.0;

      if (isWhole) {
        selectedRooms = (input.roomsToPaint ?? []).filter((room) => room !== 'Handrail');
        const globalAreas = input.paintAreas ?? {
          ceilingPaint: true,
          wallPaint: true,
          trimPaint: false,
          ensuitePaint: false,
        };
        if (!hasPricedInteriorSurfaceSelection(globalAreas)) {
          throw new Error('At least one priced interior surface must be selected.');
        }
        areaFactor = aptLike
          ? sumAreaFactorWholeApartment(globalAreas)
          : sumAreaFactor(globalAreas);
      } else {
        const rooms = input.interiorRooms ?? [];
        selectedRooms = rooms.filter((r) => r.roomName !== 'Handrail').map((r) => r.roomName);
        areaFactor = 1.0;
      }

      if (!selectedRooms.length && isWhole) {
        selectedRooms = ['Bedroom 1', 'Bathroom', 'Living Room', 'Kitchen'];
      }

      const hasMaster = selectedRooms.includes('Master Bedroom');
      const measuredSpecificBase = !isWhole
        ? calculateMeasuredSpecificInteriorBase(
            input.interiorRooms ?? [],
            toNumberOrUndefined(input.interiorWallHeight)
          )
        : undefined;

      if (!isWhole) {
        const rooms = (input.interiorRooms ?? []).filter((room) => room.roomName !== 'Handrail');
        const conditionBand = aptLike ? CONDITION_MULTIPLIER[condition] : HOUSE_CONDITION_MULTIPLIER[condition];
        if (measuredSpecificBase) {
          intMin = Math.round(measuredSpecificBase.min * conditionBand.min);
          intMax = Math.round(measuredSpecificBase.max * conditionBand.max);
        } else {
          let baseSpecificMin = 0;
          let baseSpecificMax = 0;

          for (const room of rooms) {
            const roomName = room.roomName || 'Etc';
            const roomAnchor = getSpecificInteriorRoomBaseAnchor(roomName);
            const roomAreaFactor = sumAreaFactor(room.paintAreas ?? {});
            if (roomAreaFactor <= 0) continue;

            baseSpecificMin += roomAnchor.min * roomAreaFactor;
            baseSpecificMax += roomAnchor.max * roomAreaFactor;
          }

          intMin = Math.round(baseSpecificMin * conditionBand.min);
          intMax = Math.round(baseSpecificMax * conditionBand.max);
        }
      }

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
          const absoluteFloor = Math.round(rawMedian * 0.78);
          intMin = Number.isFinite(computedMin) ? Math.max(computedMin, absoluteFloor) : absoluteFloor;
          intMax = Number.isFinite(computedMax) ? Math.max(computedMax, Math.round(absoluteFloor * 1.2)) : Math.round(absoluteFloor * 1.2);
        }

        // ── SPECIFIC AREAS: use class-based anchor + room scoring ────────────
        else if (!isWhole) {
          const specificRooms = (input.interiorRooms ?? [])
            .filter((r) => r.roomName !== 'Handrail')
            .map((r) => r.roomName);

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

          const totalRoomScore = specificRooms.reduce((sum, r) => sum + roomScore(r), 0);
          const partialRatio = clamp(totalRoomScore / BASE_FULL_APT_SCORE, 0.22, 0.9);

          const baseMid = anchor.median * partialRatio;

          let baseMin = baseMid * 0.88;
          let baseMax = baseMid * 1.22;

          baseMin *= areaFactor;
          baseMax *= areaFactor;

          const pseudoSqm = pseudoSqmFromRooms(specificRooms);
          if (pseudoSqm >= 24) {
            baseMin *= 1.08;
            baseMax *= 1.15;
          } else if (pseudoSqm >= 16) {
            baseMin *= 1.04;
            baseMax *= 1.1;
          }

          const roomCount = specificRooms.length;
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

      if (!aptLike && (isWhole || selectedRooms.length > 0) && !measuredSpecificBase) {
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
        const trimItems = input.trimPaintOptions.trimItems ?? [];
        const interiorWindowFrameTypes = trimItems.includes('Window Frames')
          ? input.trimPaintOptions.interiorWindowFrameTypes ?? []
          : [];
        const trimOnlySpecific = isTrimOnlySpecificInterior(input, selectedRooms);

        if (input.scopeOfPainting === 'Entire property') {
          const globalTrimOn = !!input.paintAreas?.trimPaint;

          if (interiorWindowFrameTypes.length > 0) {
            for (const type of interiorWindowFrameTypes) {
              const premium = INTERIOR_WINDOW_TYPE_PREMIUM[paintType][type];
              intMin += premium.min;
              intMax += premium.max;
            }
          }

          if (globalTrimOn && paintType === 'Water-based') {
            const itemCount = trimItems.length;
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
          const roomsWithTrim = rooms.filter((r) => r.paintAreas?.trimPaint);
          const interiorDoorItems = trimItems.includes('Doors') ? input.interiorDoorItems ?? [] : [];
          const interiorWindowItems = trimItems.includes('Window Frames') ? input.interiorWindowItems ?? [] : [];
          const includeSkirting = trimItems.includes('Skirting Boards');
          const onlySkirtingTrimOnly = isSkirtingOnlySpecific;

          // Specific-room anchors are oil-based by default. Only water-based trim
          // needs an uplift on the trim share; oil-based trim is already included.
          if (paintType === 'Water-based' && roomsWithTrim.length > 0) {
            const p = TRIM_PREMIUM_SPECIFIC_PER_ROOM['Water-based'];
            intMin += p.min * roomsWithTrim.length;
            intMax += p.max * roomsWithTrim.length;
          }

          if (includeSkirting) {
            if (onlySkirtingTrimOnly) {
              const skirtingCost = getTrimOnlySkirtingRange(input, paintType);
              intMin += skirtingCost.min;
              intMax += skirtingCost.max;
            } else {
              for (const room of roomsWithTrim) {
                if (room.approxRoomSize && Number.isFinite(room.approxRoomSize)) {
                  const skirtingCost = getMeasuredInteriorSkirtingRange(room.approxRoomSize, paintType);
                  intMin += skirtingCost.min;
                  intMax += skirtingCost.max;
                } else {
                  const skirtingCost = getInteriorSkirtingRoomAnchor(room.roomName, paintType);
                  intMin += skirtingCost;
                  intMax += skirtingCost;
                }
              }
            }
          }

          if (interiorWindowFrameTypes.length > 0 && interiorWindowItems.length === 0) {
            for (const type of interiorWindowFrameTypes) {
              const unitPrice = INTERIOR_WINDOW_PRICE[paintType][type];
              intMin += unitPrice;
              intMax += unitPrice;
            }
          }

          if (interiorDoorItems.length > 0) {
            for (const item of interiorDoorItems) {
              const unitPrice = getInteriorDoorUnitPrice(item.system, item.scope);
              const lineTotal = unitPrice * item.quantity;
              intMin += lineTotal;
              intMax += lineTotal;
            }
          }

          if (interiorWindowItems.length > 0) {
            for (const item of interiorWindowItems) {
              const unitPrice = getInteriorWindowUnitPrice(item.system, item.type, item.scope);
              const lineTotal = unitPrice * item.quantity;
              intMin += lineTotal;
              intMax += lineTotal;
            }
          }

          if (trimOnlySpecific && !onlySkirtingTrimOnly) {
            const trimBase = aptLike ? INTERIOR_TRIM_ONLY_BASE.apartment : INTERIOR_TRIM_ONLY_BASE.house;
            intMin = Math.max(intMin, trimBase.min);
            intMax = Math.max(intMax, trimBase.max);
          }
        }
      }

      const handrailCost = getInteriorHandrailRange(input.interiorRooms ?? []);
      intMin += handrailCost.min;
      intMax += handrailCost.max;

      // % complexity uplift (interior)
      {
        const uplifted = applyInteriorComplexityUpliftPct(input, intMin, intMax);
        intMin = uplifted.min;
        intMax = uplifted.max;
      }

      // 3B2B + Fair curve calibration (House / Townhouse)
      let finalHouseKey: keyof typeof HOUSE_INTERIOR_ANCHORS | undefined;

      if (!isApartmentLike(input.propertyType) && isWhole) {
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

      if (isSkirtingOnlySpecific) {
        intMin = clamp(intMin, 0, MAX_PRICE_CAP);
        intMax = clamp(intMax, 0, MAX_PRICE_CAP);
      } else {
        intMin = clamp(intMin, 800, MAX_PRICE_CAP);
        intMax = clamp(intMax, 1200, MAX_PRICE_CAP);
      }
      if (intMax < intMin) intMax = Math.round(intMin * 1.18);

      // Range cap (dynamic)
      if (!isSkirtingOnlySpecific) {
        const capped = capRangeWidthSmart(intMin, intMax, input, 'interior');
        intMin = capped.min;
        intMax = capped.max;
      }
    }

    // -----------------------------
    // 2) Exterior (UPDATED)
    // -----------------------------
    const {
      extMin,
      extMax,
      deckCost: deckCostForPrompt,
      pavingCost: pavingCostForPrompt,
    } = calculateExteriorEstimate(input);

    // -----------------------------
    // 3) Combine
    // -----------------------------
    let totalMin = intMin + extMin;
    let totalMax = intMax + extMax;

    totalMin = Math.round(totalMin);
    totalMax = Math.round(totalMax);

    if (totalMax > MAX_PRICE_CAP) totalMax = MAX_PRICE_CAP;
    if (totalMin > MAX_PRICE_CAP) totalMin = MAX_PRICE_CAP;

    if (!isBoth) {
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
    const includeTrimPricingNote = hasSelectedTrimOptions(input);
    const includeFrontDoorPricingNote = hasSelectedFrontDoor(input);
    const handrailPricingDetails = getInteriorHandrailRange(input.interiorRooms ?? []).details;
    const trimPricingDetail = 'Pricing varies depending on the number of trim items included.';
    const frontDoorPricingDetail =
      'Front door pricing can vary depending on the door style, size, paint system, surface condition, and labour required for preparation and application.';

    // -----------------------------
    // 5) AI Explanation
    // -----------------------------
    const WALL_TYPE_SURFACE_NOTES: Record<string, string> = {
      rendered:
        'Rendered surfaces have a textured, porous finish that requires a full 3-coat system (1 undercoat + 2 finish coats) for proper adhesion and uniform coverage. The undercoat seals the render and prevents uneven absorption, while the two finish coats ensure colour consistency and long-term weather protection — particularly important for exterior surfaces exposed to Sydney\'s coastal conditions.',
      brick:
        'Brick surfaces require significantly more labour and preparation than other wall types. The deep mortar joints absorb more paint and demand careful brushwork to achieve full coverage, along with more complex surface preparation. While the same 3-coat system applies (1 undercoat + 2 finish coats), the increased application complexity and higher material consumption are reflected in the estimate.',
    };
    const wallTypeSurfaceNote =
      (input.exteriorAreas ?? []).includes('Wall') && input.wallType
        ? WALL_TYPE_SURFACE_NOTES[input.wallType]
        : undefined;
    const selectedOptionLines = getSelectedOptionLines(input);

    const { output } = await explanationPrompt({
      input,
      intMin,
      intMax,
      extMin,
      extMax,
      priceMin: totalMin,
      priceMax: totalMax,
      wallTypeSurfaceNote,
      deckMin:   deckCostForPrompt?.min,
      deckMax:   deckCostForPrompt?.max,
      pavingMin: pavingCostForPrompt?.min,
      pavingMax: pavingCostForPrompt?.max,
      selectedOptionLines,
    });

    if (output?.priceRange) {
        return {
          ...output,
          explanation: withFrontDoorPricingNote(
            withTrimPricingNote(
              output.explanation,
              includeTrimPricingNote
            ),
            includeFrontDoorPricingNote
          ),
          breakdown: output.breakdown ?? breakdown,
          details:
            output.details && output.details.length
            ? [
                ...output.details,
                ...handrailPricingDetails.filter((detail) => !output.details?.includes(detail)),
                ...(includeTrimPricingNote && !output.details.includes(trimPricingDetail)
                  ? [trimPricingDetail]
                  : []),
                ...(includeFrontDoorPricingNote && !output.details.includes(frontDoorPricingDetail)
                  ? [frontDoorPricingDetail]
                  : []),
              ]
            : [
                ...(isInt ? [`Interior: ${interiorPriceRange}`] : []),
                ...(isExt ? [`Exterior: ${exteriorPriceRange}`] : []),
                `Total: ${totalPriceRange}`,
                ...handrailPricingDetails,
                ...(includeTrimPricingNote ? [trimPricingDetail] : []),
                ...(includeFrontDoorPricingNote ? [frontDoorPricingDetail] : []),
              ],
        pricingMeta:
          output.pricingMeta?.mode === 'interior_itemized'
            ? output.pricingMeta
            : undefined,
      };
    }

    return {
      priceRange: totalPriceRange,
      explanation: withFrontDoorPricingNote(
        withTrimPricingNote(
          'This is an indicative estimate based on the information provided and is subject to site inspection for a final quote.',
          includeTrimPricingNote
        ),
        includeFrontDoorPricingNote
      ),
      details: [
        ...(isInt ? [`Interior: ${interiorPriceRange}`] : []),
        ...(isExt ? [`Exterior: ${exteriorPriceRange}`] : []),
        `Total: ${totalPriceRange}`,
        ...handrailPricingDetails,
        ...(includeTrimPricingNote ? [trimPricingDetail] : []),
        ...(includeFrontDoorPricingNote ? [frontDoorPricingDetail] : []),
      ],
      breakdown,
    };
  }
);
