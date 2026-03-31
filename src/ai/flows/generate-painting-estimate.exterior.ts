import {
  EXTERIOR_AREA_UPLIFT_PCT,
  EXTERIOR_ARCHITRAVE_ANCHOR,
  EXTERIOR_CONDITION_MULTIPLIER,
  EXTERIOR_DOOR_ANCHOR,
  EXTERIOR_FRONT_DOOR_ANCHOR,
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

const EXTERIOR_DETAIL_STANDALONE: Record<string, { min: number; max: number; perStoryMult?: number }> = {
  'Exterior Trim': { min: 400, max: 1500, perStoryMult: 1.4 },
  Pipes: { min: 200, max: 600, perStoryMult: 1.3 },
  Eaves: { min: 600, max: 2500, perStoryMult: 1.3 },
  Gutter: { min: 400, max: 1500, perStoryMult: 1.3 },
  Fascia: { min: 400, max: 1500, perStoryMult: 1.3 },
  Roof: { min: 2500, max: 9000 },
  Etc: { min: 300, max: 1500 },
};

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
  maxVal: number
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

export function calculateExteriorEstimate(input: ExteriorEstimateInput) {
  const condition = (input.paintCondition ?? 'Fair') as keyof typeof EXTERIOR_CONDITION_MULTIPLIER;
  const exteriorConditionMultiplier = EXTERIOR_CONDITION_MULTIPLIER[condition];
  const story = input.houseStories ?? '1 storey';
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

  if (!hasWall) {
    const storyMultiplier = isTriple ? 1.6 : isMultiStorey ? 1.3 : 1.0;
    const frontDoorOnlyTrim = isFrontDoorOnlyExteriorTrim(input);
    let rangeMin = 0;
    let rangeMax = 0;

    for (const area of areas) {
      if (area === 'Exterior Trim' && frontDoorOnlyTrim) continue;
      if (area === 'Deck' || area === 'Paving') continue;
      const anchor = EXTERIOR_DETAIL_STANDALONE[area];
      if (!anchor) continue;

      const multiplier =
        anchor.perStoryMult !== undefined && storyMultiplier > 1
          ? 1 + (storyMultiplier - 1) * (anchor.perStoryMult - 1)
          : 1;

      rangeMin += anchor.min * multiplier;
      rangeMax += anchor.max * multiplier;
    }

    rangeMin *= exteriorConditionMultiplier.min;
    rangeMax *= exteriorConditionMultiplier.max;

    if (areas.includes('Deck') && deckCost) {
      rangeMin += deckCost.min;
      rangeMax += deckCost.max;
    }

    if (areas.includes('Paving') && pavingCost) {
      rangeMin += pavingCost.min;
      rangeMax += pavingCost.max;
    }

    if (areas.includes('Exterior Trim')) {
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
        const architraveCost = calcTrimItemCost(input.exteriorArchitraves, EXTERIOR_ARCHITRAVE_ANCHOR);
        rangeMin += architraveCost.min;
        rangeMax += architraveCost.max;
      }
      const frontDoorCost = getFrontDoorCost(input);
      rangeMin += frontDoorCost.min;
      rangeMax += frontDoorCost.max;
    }

    if (rangeMin === 0 && rangeMax === 0) {
      rangeMin = 300;
      rangeMax = 800;
    }

    extMin = Math.round(Math.max(rangeMin, 300));
    extMax = Math.round(Math.max(rangeMax, Math.round(extMin * 1.3)));
    extMin = clamp(extMin, 300, MAX_PRICE_CAP);
    extMax = clamp(extMax, 400, MAX_PRICE_CAP);
    if (extMax < extMin) extMax = Math.round(extMin * 1.3);

    const cappedRange = capRangeWidthSmart(extMin, extMax, input, 'exterior');
    return {
      extMin: cappedRange.min,
      extMax: cappedRange.max,
      deckCost,
      pavingCost,
    };
  }

  const wallTypeKey = (input.wallType ?? 'default') as keyof typeof EXTERIOR_WALL_TYPE_FLOORS;
  const wallFloors = EXTERIOR_WALL_TYPE_FLOORS[wallTypeKey] ?? EXTERIOR_WALL_TYPE_FLOORS.default;
  const floorSqm = toNumberOrUndefined(input.approxSize) ?? 150;
  const wallHeight = toNumberOrUndefined(input.wallHeight) ?? DEFAULT_WALL_HEIGHT[story] ?? 2.7;
  const wallArea = estimateWallArea(floorSqm, wallHeight);
  const wallRate = getExteriorWallRate(wallTypeKey, wallArea);

  let baseMin = wallArea * wallRate.min;
  let baseMax = wallArea * wallRate.max;

  const frontDoorOnlyTrim = isFrontDoorOnlyExteriorTrim(input);
  let upliftMinPct = 0;
  let upliftMaxPct = 0;

  for (const area of areas) {
    if (area === 'Exterior Trim' && frontDoorOnlyTrim) continue;
    if (area === 'Deck' || area === 'Paving') continue;
    const uplift = EXTERIOR_AREA_UPLIFT_PCT[area];
    if (!uplift) continue;
    upliftMinPct += uplift.minPct;
    upliftMaxPct += uplift.maxPct;
  }

  upliftMinPct = clamp(upliftMinPct, 0, 0.95);
  upliftMaxPct = clamp(upliftMaxPct, 0, 1.2);

  let rangeMin = baseMin * (1 + upliftMinPct);
  let rangeMax = baseMax * (1 + upliftMaxPct);

  rangeMin *= exteriorConditionMultiplier.min;
  rangeMax *= exteriorConditionMultiplier.max;

  const upliftedRange = applyExteriorComplexityUpliftPct(input, rangeMin, rangeMax);
  rangeMin = upliftedRange.min;
  rangeMax = upliftedRange.max;

  if (areas.includes('Deck') && deckCost) {
    rangeMin += deckCost.min;
    rangeMax += deckCost.max;
  }

  if (areas.includes('Paving') && pavingCost) {
    rangeMin += pavingCost.min;
    rangeMax += pavingCost.max;
  }

  if (areas.includes('Exterior Trim')) {
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
      const architraveCost = calcTrimItemCost(input.exteriorArchitraves, EXTERIOR_ARCHITRAVE_ANCHOR);
      rangeMin += architraveCost.min;
      rangeMax += architraveCost.max;
    }

    const frontDoorCost = getFrontDoorCost(input);
    rangeMin += frontDoorCost.min;
    rangeMax += frontDoorCost.max;
  }

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

  extMin = clamp(Math.round(rangeMin), 1200, MAX_PRICE_CAP);
  extMax = clamp(Math.round(rangeMax), 1800, MAX_PRICE_CAP);
  if (extMax < extMin) extMax = Math.round(extMin * 1.25);

  if (!areas.includes('Roof') && extMax > 30000) extMax = 30000;
  if (!areas.includes('Roof') && extMin > 28000) extMin = 28000;

  const cappedRange = capRangeWidthSmart(extMin, extMax, input, 'exterior');
  return {
    extMin: cappedRange.min,
    extMax: cappedRange.max,
    deckCost,
    pavingCost,
  };
}
