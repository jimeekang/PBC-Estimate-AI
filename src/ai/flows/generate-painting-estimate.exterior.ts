import {
  EXTERIOR_ARCHITRAVE_ANCHOR,
  assertKnownStory,
  assertKnownWallType,
  EXTERIOR_CONDITION_MULTIPLIER,
  EXTERIOR_DOOR_ANCHOR,
  EXTERIOR_FRONT_DOOR_ANCHOR,
  EXTERIOR_ITEM_ANCHORS,
  EXTERIOR_ROOF_RATE,
  EXTERIOR_WALL_TYPE_FLOORS,
  EXTERIOR_WINDOW_ANCHOR,
  DEFAULT_WALL_HEIGHT,
  STORY_MODIFIER,
  calcDeckCost,
  calcTrimItemCost,
  capRangeWidthSmart,
  clamp,
  estimateWallArea,
  getExteriorProjectCap,
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
// Paving pricing
// ─────────────────────────────────────────────────────────────

const PAVING_RATE_PER_M2: { maxArea: number; min: number; max: number }[] = [
  { maxArea: 25, min: 52, max: 65 },
  { maxArea: 70, min: 42, max: 52 },
  { maxArea: 140, min: 34, max: 42 },
  { maxArea: Infinity, min: 28, max: 36 },
];

const PAVING_CONDITION_MULT: Record<string, number> = {
  good: 1.0,
  fair: 1.2,
  // Poor paving typically includes pressure wash, patch repair, etch/prime,
  // and the full 2-coat system.
  poor: 1.9,
};

const PAVING_MINIMUM_CHARGE = 950;
const PAVING_PROJECT_CEILING = 18000;

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function getPavingRate(area: number): { min: number; max: number } {
  return PAVING_RATE_PER_M2.find((band) => area <= band.maxArea)!;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

/** Returns the storey tier key for EXTERIOR_ITEM_ANCHORS. */
function getStoreyTier(story: '1 storey' | '2 storey' | '3 storey'): 'single' | 'double' | 'triple' {
  if (story === '3 storey') return 'triple';
  if (story === '2 storey') return 'double';
  return 'single';
}

function getStoreyCount(story: '1 storey' | '2 storey' | '3 storey'): number {
  if (story === '3 storey') return 3;
  if (story === '2 storey') return 2;
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
  const area = toNumberOrUndefined(input.pavingArea);
  if (!area || area <= 0) return null;

  const rate = getPavingRate(area);
  const conditionMultiplier = PAVING_CONDITION_MULT[input.pavingCondition ?? 'good'] ?? 1.0;

  return {
    min: Math.max(PAVING_MINIMUM_CHARGE, Math.round(area * rate.min * conditionMultiplier)),
    max: Math.min(PAVING_PROJECT_CEILING, Math.round(area * rate.max * conditionMultiplier)),
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
  const story = assertKnownStory(input.houseStories ?? '1 storey');
  const isDouble = story === '2 storey';
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
  const story = assertKnownStory(input.houseStories ?? '1 storey');
  const storeyTier = getStoreyTier(story);
  const storyMultiplier = STORY_MODIFIER[story];
  const isDouble = story === '2 storey';
  const isTriple = story === '3 storey';
  const isMultiStorey = isDouble || isTriple;
  const exteriorProjectCap = getExteriorProjectCap(input);

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
  const hasEaves = areas.includes('Eaves');
  const hasGutter = areas.includes('Gutter');
  const hasFascia = areas.includes('Fascia');
  const hasTrim = areas.includes('Exterior Trim');
  const wallTypeKey = hasWall ? assertKnownWallType(input.wallType) : undefined;

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
    const wallHeight = toNumberOrUndefined(input.wallHeight) ?? DEFAULT_WALL_HEIGHT[story];
    const wallArea = estimateWallArea(footprintSqm, wallHeight);
    const wallRate = getExteriorWallRate(wallTypeKey!, wallArea);
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
    const roofMax = Math.max(roofArea * roofRate.max, roofRate.floor * 1.25);
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
  // Trim items are added after complexity uplift, so we re-apply difficulty
  // to the trim portion only and add it on top.
  const isTrimOnly =
    areas.includes('Exterior Trim') &&
    !hasWall &&
    !areas.includes('Eaves') &&
    !areas.includes('Gutter') &&
    !areas.includes('Fascia') &&
    !areas.includes('Roof') &&
    !areas.includes('Deck') &&
    !areas.includes('Paving');

  if (areas.includes('Exterior Trim')) {
    let trimMin = 0;
    let trimMax = 0;
    if (!frontDoorOnlyTrim) {
      if (input.exteriorDoors?.length) {
        const doorCost = calcTrimItemCost(input.exteriorDoors, EXTERIOR_DOOR_ANCHOR);
        trimMin += doorCost.min;
        trimMax += doorCost.max;
      }
      if (input.exteriorWindows?.length) {
        const windowCost = calcTrimItemCost(input.exteriorWindows, EXTERIOR_WINDOW_ANCHOR);
        trimMin += windowCost.min;
        trimMax += windowCost.max;
      }
      if (input.exteriorArchitraves?.length) {
        const architraveCost = calcTrimItemCost(
          input.exteriorArchitraves,
          EXTERIOR_ARCHITRAVE_ANCHOR,
        );
        trimMin += architraveCost.min;
        trimMax += architraveCost.max;
      }
      const frontDoorCost = getFrontDoorCost(input);
      trimMin += frontDoorCost.min;
      trimMax += frontDoorCost.max;
    } else {
      // Front door only
      const frontDoorCost = getFrontDoorCost(input);
      trimMin += frontDoorCost.min;
      trimMax += frontDoorCost.max;
    }
    // Re-apply difficulty uplift to trim items (Step 4 ran before trim was added)
    const trimUplifted = applyExteriorComplexityUpliftPct(input, trimMin, trimMax);
    rangeMin += trimUplifted.min;
    rangeMax += trimUplifted.max;
  }

  // ── Step 6: Floor price when Wall is included ─────────────
  if (hasWall) {
    const wallFloors = EXTERIOR_WALL_TYPE_FLOORS[wallTypeKey!];
    const isFullExterior =
      areas.includes('Wall') &&
      areas.includes('Eaves') &&
      areas.includes('Gutter') &&
      areas.includes('Fascia') &&
      areas.includes('Exterior Trim');
    const hasWallAdjacencyScope = hasEaves || hasGutter || hasFascia || hasTrim;
    const partialScopeFloor = hasWallAdjacencyScope
      ? wallFloors.wallPlusEaves
      : wallFloors.wallOnly;

    const floor =
      isFullExterior && isTriple
        ? wallFloors.tripleStoreyFullExterior
        : isFullExterior && isMultiStorey
          ? wallFloors.doubleStoreyFullExterior
          : isFullExterior
            ? wallFloors.fullExterior
            : Math.round(partialScopeFloor * storyMultiplier);

    rangeMin = Math.max(rangeMin, floor);
    rangeMax = Math.max(rangeMax, Math.round(floor * 1.25));
  }

  const cappedStructuralRange = isTrimOnly
    ? { min: Math.round(rangeMin), max: Math.round(rangeMax) }
    : capRangeWidthSmart(Math.round(rangeMin), Math.round(rangeMax), input, 'exterior');
  rangeMin = cappedStructuralRange.min;
  rangeMax = cappedStructuralRange.max;

  // ── Step 7: Deck and Paving add-on and final clamp ─────────────────
  if (areas.includes('Deck') && deckCost) {
    rangeMin += deckCost.min;
    rangeMax += deckCost.max;
  }
  if (areas.includes('Paving') && pavingCost) {
    rangeMin += pavingCost.min;
    rangeMax += pavingCost.max;
  }

  // Fallback when only Deck/Paving selected with no structural items
  if (rangeMin === 0 && rangeMax === 0) {
    rangeMin = 300;
    rangeMax = 800;
  }

  const minFloor = hasWall ? 1200 : 300;
  const maxFloor = hasWall ? 1800 : 400;

  extMin = clamp(Math.round(rangeMin), minFloor, exteriorProjectCap);
  extMax = clamp(Math.round(rangeMax), maxFloor, exteriorProjectCap);
  if (extMax < extMin) extMax = Math.round(extMin * (hasWall ? 1.25 : 1.3));
  extMax = Math.min(extMax, exteriorProjectCap);
  return { extMin, extMax, deckCost, pavingCost };
}
