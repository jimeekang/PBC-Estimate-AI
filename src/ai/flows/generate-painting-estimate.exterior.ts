import {
  EXTERIOR_ARCHITRAVE_ANCHOR,
  EXTERIOR_CONDITION_MULTIPLIER,
  EXTERIOR_DOOR_ANCHOR,
  EXTERIOR_FRONT_DOOR_ANCHOR,
  EXTERIOR_ITEM_ANCHORS,
  EXTERIOR_ROOF_RATE,
  EXTERIOR_WALL_TYPE_FLOORS,
  EXTERIOR_WINDOW_ANCHOR,
  DEFAULT_WALL_HEIGHT,
  MAX_PRICE_CAP,
  calcTrimItemCost,
  capRangeWidthSmart,
  clamp,
  estimateWallArea,
  getExteriorWallRate,
} from '@/lib/pricing-engine';

type ExteriorTrimDoor = { style?: string; quantity: number };
type ExteriorTrimWindow = { type?: string; quantity: number };
type ExteriorTrimArchitrave = { style?: string; quantity: number };

type ExteriorEstimateInput = {
  typeOfWork: string[];
  paintCondition?: string;
  houseStories?: string;
  exteriorAreas?: string[];
  exteriorTrimItems?: string[];
  exteriorFrontDoor?: boolean;
  exteriorDoors?: ExteriorTrimDoor[];
  exteriorWindows?: ExteriorTrimWindow[];
  exteriorArchitraves?: ExteriorTrimArchitrave[];
  deckArea?: number | null;
  deckServiceType?: string;
  deckProductType?: string;
  deckCondition?: string;
  pavingArea?: number | null;
  pavingCondition?: string;
  wallType?: string;
  wallHeight?: number | null;
  approxSize?: number | null;
  jobDifficulty?: string[];
};

// ─────────────────────────────────────────────────────────────
// Deck pricing
// ─────────────────────────────────────────────────────────────

const DECK_RATE_PER_M2: Record<string, { min: number; max: number }> = {
  'stain-oil': { min: 32, max: 60 },
  'stain-water': { min: 34, max: 62 },
  'clear-oil': { min: 28, max: 53 },
  'clear-water': { min: 30, max: 55 },
  'paint-conversion': { min: 60, max: 91 },
  'paint-recoat': { min: 35, max: 60 },
};

const DECK_CONDITION_MULT: Record<string, number> = {
  good: 1.0,
  weathered: 1.25,
  damaged: 1.55,
};

const DECK_MINIMUM_CHARGE = 600;
const DECK_PROJECT_CEILING = 22000;

// ─────────────────────────────────────────────────────────────
// Paving pricing
// ─────────────────────────────────────────────────────────────

const PAVING_RATE_PER_M2: { maxArea: number; min: number; max: number }[] = [
  { maxArea: 25, min: 44, max: 56 },
  { maxArea: 70, min: 34, max: 44 },
  { maxArea: 140, min: 27, max: 35 },
  { maxArea: Infinity, min: 22, max: 29 },
];

const PAVING_CONDITION_MULT: Record<string, number> = {
  good: 1.0,
  fair: 1.2,
  poor: 1.45,
};

const PAVING_MINIMUM_CHARGE = 950;
const PAVING_PROJECT_CEILING = 18000;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getDeckAreaBandMult(areaSqm: number): number {
  if (areaSqm <= 20) return 1.15;
  if (areaSqm <= 50) return 1.0;
  if (areaSqm <= 100) return 0.9;
  return 0.82;
}

function getPavingRate(area: number): { min: number; max: number } {
  return PAVING_RATE_PER_M2.find((band) => area <= band.maxArea)!;
}

function getDeckServiceKey(serviceType: string, productType?: string): string {
  if (serviceType === 'paint-conversion' || serviceType === 'paint-recoat') {
    return serviceType;
  }
  return `${serviceType}-${productType ?? 'oil'}`;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

/** Returns the storey tier key for EXTERIOR_ITEM_ANCHORS. */
function getStoreyTier(story: string): 'single' | 'double' | 'triple' {
  if (story === '3 storey') return 'triple';
  if (story === '2 storey' || story === 'Double story or more') return 'double';
  return 'single';
}

function getStoreyCount(story: string): number {
  if (story === '3 storey') return 3;
  if (story === '2 storey' || story === 'Double story or more') return 2;
  return 1;
}

/** Looks up the per-item anchor for a given area and storey tier. */
function getItemAnchor(
  area: string,
  storeyTier: 'single' | 'double' | 'triple',
): { min: number; max: number } {
  const anchors = EXTERIOR_ITEM_ANCHORS[area];
  if (!anchors) return { min: 0, max: 0 };
  return anchors[storeyTier];
}

// ─────────────────────────────────────────────────────────────
// Exported helpers
// ─────────────────────────────────────────────────────────────

export function calcPavingCost(input: {
  pavingArea?: number | null;
  pavingCondition?: string;
}): { min: number; max: number } | null {
  const area = input.pavingArea;
  if (!area || area <= 0) return null;

  const rate = getPavingRate(area);
  const conditionMultiplier = PAVING_CONDITION_MULT[input.pavingCondition ?? 'good'] ?? 1.0;

  return {
    min: Math.max(PAVING_MINIMUM_CHARGE, Math.round(area * rate.min * conditionMultiplier)),
    max: Math.min(PAVING_PROJECT_CEILING, Math.round(area * rate.max * conditionMultiplier)),
  };
}

export function calcDeckCost(input: {
  deckArea?: number | null;
  deckServiceType?: string;
  deckProductType?: string;
  deckCondition?: string;
}): { min: number; max: number } | null {
  const area = input.deckArea;
  if (!area || area <= 0) return null;

  const key = getDeckServiceKey(input.deckServiceType ?? 'stain', input.deckProductType);
  const rate = DECK_RATE_PER_M2[key];
  if (!rate) return null;

  const areaMultiplier = getDeckAreaBandMult(area);
  const conditionMultiplier = DECK_CONDITION_MULT[input.deckCondition ?? 'good'] ?? 1.0;

  return {
    min: Math.max(DECK_MINIMUM_CHARGE, Math.round(area * rate.min * areaMultiplier * conditionMultiplier)),
    max: Math.min(DECK_PROJECT_CEILING, Math.round(area * rate.max * areaMultiplier * conditionMultiplier)),
  };
}

function getFrontDoorCost(input: ExteriorEstimateInput): { min: number; max: number } {
  if (!input.exteriorFrontDoor) return { min: 0, max: 0 };
  return EXTERIOR_FRONT_DOOR_ANCHOR;
}

function isFrontDoorOnlyExteriorTrim(input: ExteriorEstimateInput): boolean {
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

function applyExteriorComplexityUpliftPct(
  input: ExteriorEstimateInput,
  minVal: number,
  maxVal: number,
) {
  const factors = input.jobDifficulty ?? [];
  const story = input.houseStories ?? '1 storey';
  const isDouble = story === '2 storey' || story === 'Double story or more';
  const isTriple = story === '3 storey';

  let minPct = 0;
  let maxPct = 0;

  for (const factor of factors) {
    if (factor === 'Difficult access areas') {
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

    if (factor === 'Stairs' || factor === 'High ceilings') {
      minPct += 0.015;
      maxPct += 0.03;
      continue;
    }

    if (factor === 'Extensive mouldings or trims') {
      minPct += 0.03;
      maxPct += 0.06;
    }
  }

  minPct = clamp(minPct, 0, 0.3);
  maxPct = clamp(maxPct, 0, 0.4);

  return {
    min: Math.round(minVal * (1 + minPct)),
    max: Math.round(maxVal * (1 + maxPct)),
  };
}

// ─────────────────────────────────────────────────────────────
// Main exterior estimate function
// ─────────────────────────────────────────────────────────────
//
// Each exterior area is priced independently — there is NO percentage uplift
// on top of the wall cost. Every item (Eaves, Gutter, Fascia, Pipes, Roof,
// Exterior Trim) has its own standalone anchor keyed by storey tier.
//
// Deck and Paving are priced by their own area-based functions and added
// independently after the condition multiplier.
//
// Order of operations:
//   1. Wall  — area-based (sqm × $/m² rate)
//   2. Other structural items  — EXTERIOR_ITEM_ANCHORS[area][storeyTier]
//   3. Condition multiplier  — applied to structural total
//   4. Complexity uplift  — applied after condition
//   5. Specific trim items  — added outside condition (per-item fixed pricing)
//   6. Deck / Paving  — added outside condition (own condition inputs)
//   7. Floor price  — EXTERIOR_WALL_TYPE_FLOORS applied when Wall is included
//   8. Cap / clamp
//
export function calculateExteriorEstimate(input: ExteriorEstimateInput) {
  const condition = (input.paintCondition ?? 'Fair') as keyof typeof EXTERIOR_CONDITION_MULTIPLIER;
  const exteriorConditionMultiplier = EXTERIOR_CONDITION_MULTIPLIER[condition];
  const story = input.houseStories ?? '1 storey';
  const storeyTier = getStoreyTier(story);
  const isDouble = story === 'Double story or more' || story === '2 storey';
  const isTriple = story === '3 storey';
  const isMultiStorey = isDouble || isTriple;

  const deckCost = calcDeckCost(input);
  const pavingCost = calcPavingCost(input);

  let extMin = 0;
  let extMax = 0;

  if (!input.typeOfWork.includes('Exterior Painting')) {
    return { extMin, extMax, deckCost, pavingCost };
  }

  let areas = (input.exteriorAreas ?? []).slice();
  if (!areas.length) {
    areas = ['Wall', 'Eaves'];
  }

  const hasWall = areas.includes('Wall');
  const wallTypeKey = (input.wallType ?? 'default') as keyof typeof EXTERIOR_WALL_TYPE_FLOORS;

  const frontDoorOnlyTrim = isFrontDoorOnlyExteriorTrim(input);
  // If specific items (doors/windows/architraves) are provided, use those instead
  // of the generic 'Exterior Trim' anchor to avoid double-counting.
  const hasSpecificTrimItems =
    (input.exteriorDoors?.some((d) => (d.quantity ?? 0) > 0) ?? false) ||
    (input.exteriorWindows?.some((w) => (w.quantity ?? 0) > 0) ?? false) ||
    (input.exteriorArchitraves?.some((a) => (a.quantity ?? 0) > 0) ?? false);

  let rangeMin = 0;
  let rangeMax = 0;

  // ── Step 1: Wall — area-based ──────────────────────────────
  if (hasWall) {
    const floorSqm = toNumberOrUndefined(input.approxSize) ?? 150;
    const footprintSqm = floorSqm / getStoreyCount(story);
    const wallHeight =
      toNumberOrUndefined(input.wallHeight) ?? DEFAULT_WALL_HEIGHT[story] ?? 2.7;
    const wallArea = estimateWallArea(footprintSqm, wallHeight);
    const wallRate = getExteriorWallRate(wallTypeKey, wallArea);
    rangeMin += wallArea * wallRate.min;
    rangeMax += wallArea * wallRate.max;
  }

  // ── Step 2: Other structural items — independent anchors ───
  for (const area of areas) {
    if (area === 'Wall') continue;
    if (area === 'Deck' || area === 'Paving') continue;
    if (area === 'Roof') continue; // handled separately in Step 2b (sqm-based)
    // Skip generic Exterior Trim anchor if front door only or specific items provided
    if (area === 'Exterior Trim' && (frontDoorOnlyTrim || hasSpecificTrimItems)) continue;

    const anchor = getItemAnchor(area, storeyTier);
    rangeMin += anchor.min;
    rangeMax += anchor.max;
  }

  // ── Step 2b: Roof — sqm-based (slope-adjusted) ────────────
  // Actual sloped area = floor sqm × pitchFactor; rate rises with storey (access difficulty).
  if (areas.includes('Roof')) {
    const floorSqm = toNumberOrUndefined(input.approxSize) ?? 150;
    const roofArea = floorSqm * EXTERIOR_ROOF_RATE.pitchFactor;
    const roofRate = EXTERIOR_ROOF_RATE[storeyTier];
    const roofMin = Math.max(roofArea * roofRate.min, roofRate.floor);
    const roofMax = roofArea * roofRate.max;
    rangeMin += roofMin;
    rangeMax += Math.max(roofMax, roofMin);
  }

  // ── Step 3: Condition multiplier ──────────────────────────
  rangeMin *= exteriorConditionMultiplier.min;
  rangeMax *= exteriorConditionMultiplier.max;

  // ── Step 4: Complexity uplift ─────────────────────────────
  const uplifted = applyExteriorComplexityUpliftPct(input, rangeMin, rangeMax);
  rangeMin = uplifted.min;
  rangeMax = uplifted.max;

  // ── Step 5: Specific trim items (outside condition) ───────
  if (areas.includes('Exterior Trim')) {
    if (!frontDoorOnlyTrim) {
      if (input.exteriorDoors?.length) {
        const doorCost = calcTrimItemCost(input.exteriorDoors, EXTERIOR_DOOR_ANCHOR);
        rangeMin += doorCost.min;
        rangeMax += doorCost.max;
      }
      if (input.exteriorWindows?.length) {
        const windowCost = calcTrimItemCost(input.exteriorWindows, EXTERIOR_WINDOW_ANCHOR);
        rangeMin += windowCost.min;
        rangeMax += windowCost.max;
      }
      if (input.exteriorArchitraves?.length) {
        const architraveCost = calcTrimItemCost(
          input.exteriorArchitraves,
          EXTERIOR_ARCHITRAVE_ANCHOR,
        );
        rangeMin += architraveCost.min;
        rangeMax += architraveCost.max;
      }
      const frontDoorCost = getFrontDoorCost(input);
      rangeMin += frontDoorCost.min;
      rangeMax += frontDoorCost.max;
    } else {
      // Front door only
      const frontDoorCost = getFrontDoorCost(input);
      rangeMin += frontDoorCost.min;
      rangeMax += frontDoorCost.max;
    }
  }

  // ── Step 6: Deck and Paving (own condition; outside multiplier) ──
  if (areas.includes('Deck') && deckCost) {
    rangeMin += deckCost.min;
    rangeMax += deckCost.max;
  }
  if (areas.includes('Paving') && pavingCost) {
    rangeMin += pavingCost.min;
    rangeMax += pavingCost.max;
  }

  // ── Step 7: Floor price when Wall is included ─────────────
  if (hasWall) {
    const wallFloors =
      EXTERIOR_WALL_TYPE_FLOORS[wallTypeKey] ?? EXTERIOR_WALL_TYPE_FLOORS.default;
    const hasEaves = areas.includes('Eaves');
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

    rangeMin = Math.max(rangeMin, floor);
    rangeMax = Math.max(rangeMax, Math.round(floor * 1.25));
  }

  // ── Step 8: Cap and clamp ─────────────────────────────────
  // Fallback when only Deck/Paving selected with no structural items
  if (rangeMin === 0 && rangeMax === 0) {
    rangeMin = 300;
    rangeMax = 800;
  }

  if (!areas.includes('Roof') && rangeMax > 30000) rangeMax = 30000;
  if (!areas.includes('Roof') && rangeMin > 28000) rangeMin = 28000;

  const minFloor = hasWall ? 1200 : 300;
  const maxFloor = hasWall ? 1800 : 400;

  extMin = clamp(Math.round(rangeMin), minFloor, MAX_PRICE_CAP);
  extMax = clamp(Math.round(rangeMax), maxFloor, MAX_PRICE_CAP);
  if (extMax < extMin) extMax = Math.round(extMin * (hasWall ? 1.25 : 1.3));

  const cappedRange = capRangeWidthSmart(extMin, extMax, input, 'exterior');
  return {
    extMin: cappedRange.min,
    extMax: cappedRange.max,
    deckCost,
    pavingCost,
  };
}
