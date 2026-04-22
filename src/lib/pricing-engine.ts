/**
 * pricing-engine.ts
 *
 * Single source of truth for PBC Estimate AI pure pricing functions and constants.
 * Used by both the AI flow (generate-painting-estimate.ts) and unit tests.
 *
 * Rules:
 * - No 'use server', no genkit, no Next.js server-only dependencies.
 * - All functions are pure (no side effects).
 * - All constants reflect Sydney Northern Beaches market (2026).
 */

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

// NOTE: APARTMENT_ANCHORS_OIL is used for "Specific areas only" mode.
// For "Entire property" mode, the APARTMENT_SQM_CURVE is used instead.
export const APARTMENT_ANCHORS_OIL = {
  Studio: { min: 2200, max: 3500, median: 2700 },
  OneBed: { min: 2800, max: 4200, median: 3300 },
  TwoBedStd: { min: 4300, max: 6200, median: 5000 },
  TwoBedLg: { min: 5000, max: 7500, median: 6000 },
  ThreeBed: { min: 6500, max: 9500, median: 7500 },
} as const;

export const APARTMENT_SQM_CURVE: readonly {
  sqm: number;
  rawMedian: number;
}[] = [
  { sqm: 35, rawMedian: 2200 },
  { sqm: 45, rawMedian: 2800 },
  { sqm: 55, rawMedian: 3100 },
  { sqm: 65, rawMedian: 3450 },
  { sqm: 80, rawMedian: 3800 },
  { sqm: 85, rawMedian: 4350 }, // avg 2bed apartment — key calibration point
  { sqm: 90, rawMedian: 4400 },
  { sqm: 105, rawMedian: 4850 },
  { sqm: 120, rawMedian: 5800 },
  { sqm: 140, rawMedian: 6900 },
  { sqm: 160, rawMedian: 7900 },
  { sqm: 200, rawMedian: 9500 },
] as const;

export const ENTIRE_APT_BAND = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 0.92, max: 1.08 },
  Poor: { min: 0.9, max: 1.18 },
} as const;

export const HOUSE_INTERIOR_ANCHORS = {
  '2B1B': { min: 7500, max: 11000, median: 9000 },
  '3B2B': { min: 9500, max: 14000, median: 11500 },
  '4B2B': { min: 13000, max: 18500, median: 15500 },
  '5B3B': { min: 17000, max: 25000, median: 20000 },
} as const;

export const ENTIRE_HOUSE_BAND = {
  Excellent: { min: 0.96, max: 1.04 },
  Fair: { min: 0.99, max: 1.1 },
  Poor: { min: 1.05, max: 1.44 },
} as const;

export const EXTERIOR_WALL_TYPE_FLOORS = {
  cladding: {
    wallOnly: 2600,
    wallPlusEaves: 3600,
    fullExterior: 5200,
    doubleStoreyFullExterior: 7600,
    tripleStoreyFullExterior: 10600,
  },
  rendered: {
    wallOnly: 3200,
    wallPlusEaves: 4500,
    fullExterior: 6200,
    doubleStoreyFullExterior: 8900,
    tripleStoreyFullExterior: 12300,
  },
  brick: {
    wallOnly: 3800,
    wallPlusEaves: 5400,
    fullExterior: 7400,
    doubleStoreyFullExterior: 10500,
    tripleStoreyFullExterior: 14500,
  },
} as const;

export const EXTERIOR_WALL_RATE_CURVES = {
  cladding: [
    { wallArea: 60, min: 28.0, max: 36.0 },
    { wallArea: 95, min: 25.5, max: 33.0 },
    { wallArea: 130, min: 23.5, max: 30.0 },
    { wallArea: 175, min: 22.0, max: 28.0 },
    { wallArea: 230, min: 20.5, max: 26.0 },
    { wallArea: 320, min: 19.0, max: 24.0 },
  ],
  rendered: [
    { wallArea: 60, min: 34.0, max: 44.0 },
    { wallArea: 95, min: 31.0, max: 40.0 },
    { wallArea: 130, min: 29.0, max: 37.0 },
    { wallArea: 175, min: 27.5, max: 35.0 },
    { wallArea: 230, min: 26.0, max: 33.0 },
    { wallArea: 320, min: 24.5, max: 31.0 },
  ],
  brick: [
    { wallArea: 60, min: 39.0, max: 50.0 },
    { wallArea: 95, min: 36.0, max: 46.0 },
    { wallArea: 130, min: 34.0, max: 43.0 },
    { wallArea: 175, min: 32.0, max: 40.0 },
    { wallArea: 230, min: 30.5, max: 38.0 },
    { wallArea: 320, min: 29.0, max: 36.0 },
  ],
} as const;

export const MAX_PRICE_CAP = 35000;
export const EXTERIOR_FULL_PROJECT_CEILING = 55000;

export const AREA_SHARE = {
  ceilingPaint: 0.25,
  wallPaint: 0.55,
  trimPaint: 0.2,
  ensuitePaint: 0.08,
};

// Scope-specific condition bands are intentional:
// apartments allow an entry-level discount, houses stay broader than apartments,
// and exterior carries the highest Poor ceiling.
export const CONDITION_MULTIPLIER = {
  Excellent: { min: 0.95, max: 1.05 },
  Fair: { min: 1.08, max: 1.22 },
  Poor: { min: 1.20, max: 1.42 },
} as const;

export const HOUSE_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.0, max: 1.08 },
  Fair: { min: 1.11, max: 1.26 },
  Poor: { min: 1.28, max: 1.54 },
} as const;

export const EXTERIOR_CONDITION_MULTIPLIER = {
  Excellent: { min: 1.0, max: 1.08 },
  Fair: { min: 1.1, max: 1.24 },
  Poor: { min: 1.22, max: 1.58 },
} as const;

export const CANONICAL_STORY_MODIFIER = {
  '1 storey': 1.0,
  '2 storey': 1.18,
  '3 storey': 1.35,
} as const;

export const STORY_MODIFIER = {
  ...CANONICAL_STORY_MODIFIER,
  'Single story': CANONICAL_STORY_MODIFIER['1 storey'],
  'Double story or more': CANONICAL_STORY_MODIFIER['2 storey'],
} as const;

export type StoryKey = keyof typeof CANONICAL_STORY_MODIFIER;

const STORY_LABEL_ALIASES = {
  'Single story': '1 storey',
  'Double story or more': '2 storey',
} as const;

export function normalizeStoryKey(story?: string | null): StoryKey {
  const candidate = story ?? '1 storey';
  const canonical =
    STORY_LABEL_ALIASES[candidate as keyof typeof STORY_LABEL_ALIASES] ?? candidate;

  if (canonical === '1 storey' || canonical === '2 storey' || canonical === '3 storey') {
    return canonical;
  }

  throw new Error(
    `Unknown house story "${story}". Expected one of: 1 storey, 2 storey, 3 storey`,
  );
}

export function assertKnownStory(story: string): StoryKey {
  return normalizeStoryKey(story);
}

export const CANONICAL_DEFAULT_WALL_HEIGHT = {
  '1 storey': 2.7,
  '2 storey': 5.4,
  '3 storey': 8.1,
} as const;

export const DEFAULT_WALL_HEIGHT = {
  ...CANONICAL_DEFAULT_WALL_HEIGHT,
  'Single story': CANONICAL_DEFAULT_WALL_HEIGHT['1 storey'],
  'Double story or more': CANONICAL_DEFAULT_WALL_HEIGHT['2 storey'],
} as const;

export function getStoryModifier(story?: string | null): number {
  return STORY_MODIFIER[normalizeStoryKey(story)];
}

export function getDefaultWallHeight(story?: string | null): number {
  return DEFAULT_WALL_HEIGHT[normalizeStoryKey(story)];
}

export const DECK_RATE_PER_M2: Record<string, { min: number; max: number }> = {
  'stain-oil': { min: 42, max: 78 },
  'stain-water': { min: 44, max: 85 },
  'clear-oil': { min: 38, max: 63 },
  'clear-water': { min: 40, max: 65 },
  'paint-conversion': { min: 85, max: 118 },
  'paint-recoat': { min: 54, max: 79 },
};

export const DECK_CONDITION_MULT: Record<string, number> = {
  good: 1.0,
  weathered: 1.25,
  damaged: 1.55,
};

// Deck keeps a single area scale factor layered on top of the base m² rate.
// Do not apply any second size multiplier outside this table.
export const DECK_AREA_BANDS = [
  { maxArea: 20, multiplier: 1.15 },
  { maxArea: 50, multiplier: 1.0 },
  { maxArea: 100, multiplier: 0.9 },
  { maxArea: Infinity, multiplier: 0.95 },
] as const;

export const DECK_MINIMUM_CHARGE = 600;
// Keep deck ceiling aligned with the global output cap so large jobs are not
// silently truncated below MAX_PRICE_CAP.
export const DECK_PROJECT_CEILING = MAX_PRICE_CAP;

export function getDeckServiceKey(serviceType: string, productType?: string): string {
  if (serviceType === 'paint-conversion' || serviceType === 'paint-recoat') {
    return serviceType;
  }
  return `${serviceType}-${productType ?? 'oil'}`;
}

function normalizeTrimAnchorLookupKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\band\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveTrimAnchorKey(
  candidate: string,
  anchor: Record<string, { min: number; max: number }>,
): string | undefined {
  const keys = Object.keys(anchor);
  if (!keys.length) return undefined;

  const lookupKey = normalizeTrimAnchorLookupKey(candidate);
  const exactMatch = keys.find((key) => normalizeTrimAnchorLookupKey(key) === lookupKey);
  if (exactMatch) return exactMatch;

  const aliasMap: Record<string, string> = {
    door: 'Door & Frame',
    'door frame': 'Door & Frame',
    doors: 'Door & Frame',
    window: 'Normal',
    'window frame': 'Normal',
    windows: 'Normal',
    architrave: 'Standard',
    architraves: 'Standard',
    simple: 'Simple',
    standard: 'Standard',
    normal: 'Normal',
    complex: 'Complex',
    french: 'French',
    awning: 'Awning',
    'double hung': 'Double Hung',
  };

  const alias = aliasMap[lookupKey];
  if (alias && anchor[alias]) return alias;

  if (anchor.Standard) return 'Standard';
  if (anchor.Normal) return 'Normal';
  return keys[0];
}

export function getDeckAreaBandMultiplier(areaSqm: number): number {
  const band = DECK_AREA_BANDS.find((entry) => areaSqm <= entry.maxArea);
  return band?.multiplier ?? DECK_AREA_BANDS[DECK_AREA_BANDS.length - 1].multiplier;
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

  const areaMultiplier = getDeckAreaBandMultiplier(area);
  const conditionMultiplier = DECK_CONDITION_MULT[input.deckCondition ?? 'good'] ?? 1.0;
  const rawMin = Math.round(area * rate.min * areaMultiplier * conditionMultiplier);
  const rawMax = Math.round(area * rate.max * areaMultiplier * conditionMultiplier);
  const cappedMax = Math.min(DECK_PROJECT_CEILING, Math.max(DECK_MINIMUM_CHARGE, rawMax));
  const cappedMin = Math.min(cappedMax, Math.max(DECK_MINIMUM_CHARGE, rawMin));

  return {
    min: cappedMin,
    max: cappedMax,
  };
}

export const EXTERIOR_WALL_AREA_BANDS = [
  { minArea: 0, maxArea: 75, minMult: 0.45, maxMult: 0.58 },
  { minArea: 76, maxArea: 108, minMult: 0.58, maxMult: 0.73 },
  { minArea: 109, maxArea: 128, minMult: 0.73, maxMult: 0.86 },
  { minArea: 129, maxArea: 144, minMult: 0.86, maxMult: 0.97 },
  { minArea: 145, maxArea: 158, minMult: 0.97, maxMult: 1.08 },
  { minArea: 159, maxArea: 175, minMult: 1.08, maxMult: 1.2 },
  { minArea: 176, maxArea: 220, minMult: 1.2, maxMult: 1.38 },
  { minArea: 221, maxArea: 290, minMult: 1.38, maxMult: 1.58 },
  { minArea: 291, maxArea: 345, minMult: 1.58, maxMult: 1.76 },
  { minArea: 346, maxArea: 9999, minMult: 1.76, maxMult: 1.98 },
] as const;

// NOTE: EXTERIOR_AREA_UPLIFT_PCT is kept for reference only.
// The active exterior estimate engine uses EXTERIOR_ITEM_ANCHORS instead.
export const EXTERIOR_AREA_UPLIFT_PCT: Record<
  string,
  { minPct: number; maxPct: number; notes?: string }
> = {
  Wall: {
    minPct: 0.0,
    maxPct: 0.0,
    notes: 'Base includes walls for typical full exterior scope.',
  },
  Eaves: { minPct: 0.09, maxPct: 0.14 },
  Gutter: { minPct: 0.05, maxPct: 0.08 },
  Fascia: { minPct: 0.05, maxPct: 0.08 },
  'Exterior Trim': { minPct: 0.04, maxPct: 0.08 },
  Pipes: { minPct: 0.02, maxPct: 0.04 },
  // Deck and Paving are priced independently via calcDeckCost() / calcPavingCost()
  Roof: { minPct: 0.18, maxPct: 0.32 },
  Etc: { minPct: 0.04, maxPct: 0.1 },
};

// Per-item standalone anchors — each exterior area has its own price, independent of wall size.
// Used by the Specific areas only exterior estimate engine.
// Sydney Northern Beaches 2026. storey tiers: single / double / triple.
export const EXTERIOR_ITEM_ANCHORS: Record<
  string,
  {
    single: { min: number; max: number };
    double: { min: number; max: number };
    triple: { min: number; max: number };
  }
> = {
  Eaves: {
    single: { min: 1200, max: 3500 },
    double: { min: 1800, max: 5000 },
    triple: { min: 2500, max: 7000 },
  },
  Gutter: {
    single: { min: 500, max: 1500 },
    double: { min: 800, max: 2200 },
    triple: { min: 1200, max: 3200 },
  },
  Fascia: {
    single: { min: 500, max: 1500 },
    double: { min: 800, max: 2200 },
    triple: { min: 1200, max: 3200 },
  },
  Pipes: {
    single: { min: 300, max: 800 },
    double: { min: 450, max: 1200 },
    triple: { min: 650, max: 1700 },
  },
  // Generic trim anchor — used only when no specific items (doors/windows/architraves) are provided
  'Exterior Trim': {
    single: { min: 600, max: 2000 },
    double: { min: 900, max: 3000 },
    triple: { min: 1200, max: 4000 },
  },
  Etc: {
    single: { min: 300, max: 1500 },
    double: { min: 450, max: 2200 },
    triple: { min: 650, max: 3000 },
  },
} as const;

// Roof pricing — sqm-based with slope factor.
// Actual roof area = floor sqm × pitchFactor (standard residential pitch ~25°).
// Rate per sqm (of actual sloped area) rises with storey — higher = harder access.
// Sydney Northern Beaches 2026.
export const EXTERIOR_ROOF_RATE = {
  pitchFactor: 1.3, // sloped area ≈ 30% larger than floor footprint
  single: { min: 18, max: 42, floor: 3500 },
  double: { min: 28, max: 58, floor: 5000 },
  triple: { min: 38, max: 75, floor: 7000 },
} as const;

export const EXTERIOR_DOOR_ANCHOR: Record<
  string,
  { min: number; max: number }
> = {
  Simple: { min: 150, max: 280 },
  Standard: { min: 250, max: 420 },
  Complex: { min: 400, max: 680 },
};

export const EXTERIOR_WINDOW_ANCHOR: Record<
  string,
  { min: number; max: number }
> = {
  Normal: { min: 80, max: 160 },
  Awning: { min: 130, max: 220 },
  'Double Hung': { min: 180, max: 320 },
  French: { min: 280, max: 500 },
};

export const EXTERIOR_ARCHITRAVE_ANCHOR: Record<
  string,
  { min: number; max: number }
> = {
  Simple: { min: 50, max: 110 },
  Standard: { min: 80, max: 170 },
  Complex: { min: 140, max: 300 },
};

export const EXTERIOR_FRONT_DOOR_ANCHOR = { min: 520, max: 880 } as const;

export const INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL = {
  'Master Bedroom': { min: 1350, max: 1700, median: 1500 },
  'Bedroom 1': { min: 980, max: 1280, median: 1130 },
  'Bedroom 2': { min: 980, max: 1280, median: 1130 },
  'Bedroom 3': { min: 980, max: 1280, median: 1130 },
  Bathroom: { min: 1150, max: 1550, median: 1350 },
  'Living Room': { min: 2200, max: 3200, median: 2650 },
  Dining: { min: 1700, max: 2400, median: 2000 },
  Kitchen: { min: 1900, max: 2700, median: 2250 },
  'Study / Office': { min: 1050, max: 1450, median: 1250 },
  Laundry: { min: 850, max: 1150, median: 1000 },
  Hallway: { min: 900, max: 1400, median: 1150 },
  Foyer: { min: 850, max: 1300, median: 1050 },
  Stairwell: { min: 1250, max: 1850, median: 1500 },
  'Walk-in robe': { min: 800, max: 1200, median: 1000 },
  Etc: { min: 1200, max: 1800, median: 1500 },
} as const;

const INTERIOR_SPECIFIC_ROOM_ALIASES = {
  Lounge: 'Living Room',
  'Family Room': 'Living Room',
  Rumpus: 'Living Room',
  Theatre: 'Living Room',
  'Media Room': 'Living Room',
  'Games Room': 'Living Room',
  'Open Plan': 'Living Room',
  'Open Plan Living': 'Living Room',
  'Living / Dining': 'Living Room',
  'Walk in robe': 'Walk-in robe',
  WIR: 'Walk-in robe',
  Ensuite: 'Bathroom',
} as const;

export function resolveInteriorSpecificRoomName(roomName: string) {
  const normalized = roomName.trim();
  const alias =
    INTERIOR_SPECIFIC_ROOM_ALIASES[normalized as keyof typeof INTERIOR_SPECIFIC_ROOM_ALIASES];
  if (alias) return alias as keyof typeof INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL;

  const lowered = normalized.toLowerCase();
  if (/lounge|family|rumpus|theatre|media|games|open plan|living/.test(lowered)) {
    return 'Living Room';
  }
  if (/walk.?in robe|\bwir\b|robe/.test(lowered)) {
    return 'Walk-in robe';
  }
  if (/ensuite|bath/.test(lowered)) {
    return 'Bathroom';
  }
  if (/master/.test(lowered) && /bed/.test(lowered)) {
    return 'Master Bedroom';
  }
  if (normalized in INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL) {
    return normalized as keyof typeof INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL;
  }
  return 'Etc';
}

export const INTERIOR_DOOR_ITEM_ANCHOR: Record<
  string,
  Record<string, number>
> = {
  oil_2coat: {
    'Door & Frame': 220,
    'Door only': 160,
    'Frame only': 60,
  },
  water_3coat_white_finish: {
    'Door & Frame': 295,
    'Door only': 210,
    'Frame only': 85,
  },
};

export const INTERIOR_DOOR_TYPE_PREMIUM = {
  flush: 0,
  sliding: 5,
  panelled: 10,
  french: 15,
  bi_folding: 25,
} as const;

export const INTERIOR_DOOR_WHOLE_JOB_PREMIUM_PCT = {
  flush: 0,
  sliding: 0.02,
  panelled: 0.04,
  french: 0.06,
  bi_folding: 0.1,
} as const;

export const INTERIOR_WINDOW_ITEM_ANCHOR = {
  oil_2coat: {
    Normal: { 'Window & Frame': 200, 'Window only': 150, 'Frame only': 110 },
    Awning: { 'Window & Frame': 235, 'Window only': 180, 'Frame only': 135 },
    'Double Hung': {
      'Window & Frame': 300,
      'Window only': 230,
      'Frame only': 175,
    },
    French: { 'Window & Frame': 400, 'Window only': 310, 'Frame only': 240 },
  },
  water_3coat_white_finish: {
    Normal: { 'Window & Frame': 275, 'Window only': 200, 'Frame only': 135 },
    Awning: { 'Window & Frame': 310, 'Window only': 230, 'Frame only': 160 },
    'Double Hung': {
      'Window & Frame': 375,
      'Window only': 280,
      'Frame only': 200,
    },
    French: { 'Window & Frame': 475, 'Window only': 360, 'Frame only': 265 },
  },
} as const;

export const INTERIOR_SKIRTING_LINEAR_RATE = {
  oil_2coat: { min: 7, max: 10 },
  water_3coat_white_finish: { min: 8, max: 11 },
} as const;

export const INTERIOR_HANDRAIL_ITEM_PRICING = {
  paint_to_paint_oil_2coat: {
    label: 'Paint to paint, oil 2 coats',
    rate: { min: 155, max: 180 },
    minJob: { min: 480, max: 580 },
  },
  paint_to_paint_water_3coat: {
    label: 'Paint to paint, water 3 coats',
    rate: { min: 180, max: 210 },
    minJob: { min: 560, max: 680 },
  },
  varnish_to_paint_oil_3coat_min: {
    label: 'Varnish to paint, oil min 3 coats',
    rate: { min: 185, max: 215 },
    minJob: { min: 600, max: 720 },
  },
  varnish_to_paint_water_4coat_min: {
    label: 'Varnish to paint, water min 4 coats',
    rate: { min: 210, max: 245 },
    minJob: { min: 680, max: 820 },
  },
  varnish_to_varnish_stain: {
    label: 'Varnish to varnish stain',
    rate: { min: 200, max: 235 },
    minJob: { min: 650, max: 800 },
  },
  varnish_to_varnish_clear: {
    label: 'Varnish to varnish clear',
    rate: { min: 170, max: 200 },
    minJob: { min: 540, max: 660 },
  },
} as const;

export const CAL_3B2B_FAIR_SINGLE_POINTS = [
  { sqm: 120, min: 8500, max: 11000 },
  { sqm: 135, min: 10000, max: 13500 },
  { sqm: 150, min: 12000, max: 15500 },
  { sqm: 180, min: 14500, max: 19000 },
] as const;

export const DOUBLE_STOREY_3B2B_UPLIFT = {
  baseMinPct: 0.03,
  baseMaxPct: 0.05,
  autoStairwellPct: 0.01,
  highCeilingReductionPct: 0.02,
};

// ─────────────────────────────────────────────────────────────
// PURE HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function getRawMedianFromSqm(
  sqmInput: number | undefined | null,
): number {
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
  const a = curve[curve.length - 2];
  const b = curve[curve.length - 1];
  const t = (sqm - a.sqm) / (b.sqm - a.sqm);
  return a.rawMedian + (b.rawMedian - a.rawMedian) * t;
}

export function pickExteriorBand(wallArea?: number): {
  minMult: number;
  maxMult: number;
} {
  const bands = EXTERIOR_WALL_AREA_BANDS;
  if (!wallArea || wallArea <= 0)
    return { minMult: bands[0].minMult, maxMult: bands[0].maxMult };

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
  return {
    minMult: bands[bands.length - 1].minMult,
    maxMult: bands[bands.length - 1].maxMult,
  };
}

export function getExteriorWallRate(
  wallType: keyof typeof EXTERIOR_WALL_RATE_CURVES,
  wallArea?: number,
): { min: number; max: number } {
  const curve = EXTERIOR_WALL_RATE_CURVES[wallType];
  const area =
    wallArea == null ||
    !Number.isFinite(wallArea) ||
    isNaN(wallArea) ||
    wallArea <= 0
      ? curve[0].wallArea
      : wallArea;

  if (area <= curve[0].wallArea) {
    return { min: curve[0].min, max: curve[0].max };
  }

  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (area >= a.wallArea && area <= b.wallArea) {
      const t = (area - a.wallArea) / (b.wallArea - a.wallArea);
      return {
        min: +(a.min + (b.min - a.min) * t).toFixed(2),
        max: +(a.max + (b.max - a.max) * t).toFixed(2),
      };
    }
  }

  const last = curve[curve.length - 1];
  return { min: last.min, max: last.max };
}

export function assertKnownWallType(wallType?: string): keyof typeof EXTERIOR_WALL_RATE_CURVES {
  if (!wallType) {
    throw new Error('Select the main exterior wall finish before pricing.');
  }

  if (wallType in EXTERIOR_WALL_RATE_CURVES) {
    return wallType as keyof typeof EXTERIOR_WALL_RATE_CURVES;
  }

  throw new Error(
    `Unknown wall type "${wallType}". Expected one of: cladding, rendered, brick.`,
  );
}

export function estimateWallArea(sqm: number, wallHeight: number): number {
  const perimeter = 4.2 * Math.sqrt(sqm);
  return perimeter * wallHeight;
}

export function getInteriorHandrailWidthMultiplier(widthMm: number): number {
  if (widthMm <= 50) return 1.0;
  if (widthMm <= 70) return 1.08;
  if (widthMm <= 90) return 1.16;
  return 1.25;
}

export function calculateInteriorHandrailItemRange(
  lengthLm: number,
  widthMm: number,
  system: keyof typeof INTERIOR_HANDRAIL_ITEM_PRICING,
): { min: number; max: number } {
  const pricing = INTERIOR_HANDRAIL_ITEM_PRICING[system];
  const widthMultiplier = getInteriorHandrailWidthMultiplier(widthMm);
  return {
    min: Math.round(
      Math.max(
        pricing.minJob.min,
        lengthLm * pricing.rate.min * widthMultiplier,
      ),
    ),
    max: Math.round(
      Math.max(
        pricing.minJob.max,
        lengthLm * pricing.rate.max * widthMultiplier,
      ),
    ),
  };
}

export function getQtyScaleFactor(qty: number): number {
  if (qty <= 3) return 1.0;
  if (qty <= 7) return 0.92;
  if (qty <= 12) return 0.85;
  return 0.8;
}

export function calcTrimItemCost(
  items: { style?: string; type?: string; quantity: number }[],
  anchor: Record<string, { min: number; max: number }>,
): { min: number; max: number } {
  let totalMin = 0;
  let totalMax = 0;
  for (const item of items) {
    const key = item.style ?? item.type ?? 'Standard';
    const resolvedKey = resolveTrimAnchorKey(key, anchor);
    if (!resolvedKey) continue;
    const a = anchor[resolvedKey];
    if (!a) continue;
    const qty = Math.max(0, item.quantity ?? 0);
    if (qty === 0) continue;
    const scale = getQtyScaleFactor(qty);
    totalMin += a.min * qty * scale;
    totalMax += a.max * qty * scale;
  }
  return { min: Math.round(totalMin), max: Math.round(totalMax) };
}

export function inferHouseKey(opts: {
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

export function capRangeWidthSmart(
  minVal: number,
  maxVal: number,
  _input: unknown,
  context: 'interior' | 'exterior' | 'total' = 'interior',
): { min: number; max: number } {
  const gap = maxVal - minVal;
  const input = (_input ?? {}) as {
    paintCondition?: string;
    jobDifficulty?: string[];
    deckArea?: number | null;
    deckServiceType?: string;
    deckProductType?: string;
    deckCondition?: string;
  };
  let cap: number;

  if (context === 'exterior') {
    if (minVal <= 3000) cap = 1000;
    else if (minVal <= 8000) cap = 1800;
    else if (minVal <= 10000) cap = 1750;
    else cap = 2000;
  } else if (context === 'total') {
    if (minVal <= 5000) cap = 1200;
    else if (minVal <= 12000) cap = 1700;
    else if (minVal <= 20000) cap = 2200;
    else cap = 3000;
  } else {
    if (minVal <= 5000) cap = 1200;
    else cap = 1500;
  }

  // Poor condition and complex jobs need a wider tail so the cap does not
  // erase the upper-risk signal entirely.
  const isPoorCondition = input.paintCondition === 'Poor';
  const difficultyCount = Array.isArray(input.jobDifficulty) ? input.jobDifficulty.length : 0;
  const isComplexInterior = context !== 'exterior' && difficultyCount >= 2;
  // Total combines independent scopes. Preserve a deck tail so the combined
  // quote does not flatten an already-priced accessory range.
  const deckRange =
    context === 'total'
      ? calcDeckCost({
          deckArea: input.deckArea,
          deckServiceType: input.deckServiceType,
          deckProductType: input.deckProductType,
          deckCondition: input.deckCondition,
        })
      : null;
  const deckTail = deckRange ? deckRange.max - deckRange.min : 0;

  if (isPoorCondition) cap *= 1.5;
  if (isComplexInterior) cap *= 1.4;
  if (deckTail > 0) cap = Math.max(cap, deckTail);
  cap = Math.round(cap);

  if (gap <= cap) return { min: minVal, max: maxVal };
  return { min: minVal, max: Math.round(minVal + cap) };
}

function hasFullExteriorScope(exteriorAreas?: string[]): boolean {
  const areas = exteriorAreas ?? [];
  return (
    areas.includes('Wall') &&
    areas.includes('Eaves') &&
    areas.includes('Gutter') &&
    areas.includes('Fascia') &&
    areas.includes('Exterior Trim')
  );
}

export function getExteriorProjectCap(input: {
  houseStories?: string;
  exteriorAreas?: string[];
}): number {
  const story = normalizeStoryKey(input.houseStories);
  return story === '3 storey' && hasFullExteriorScope(input.exteriorAreas)
    ? EXTERIOR_FULL_PROJECT_CEILING
    : MAX_PRICE_CAP;
}

export function interpolateBySqm(
  points: readonly { sqm: number; min: number; max: number }[],
  sqm: number,
): { min: number; max: number } {
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

export function sumAreaFactor(flags: {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
}): number {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  return f;
}

export function sumAreaFactorWholeApartment(flags: {
  ceilingPaint?: boolean;
  wallPaint?: boolean;
  trimPaint?: boolean;
  ensuitePaint?: boolean;
}): number {
  let f = 0;
  if (flags.ceilingPaint) f += AREA_SHARE.ceilingPaint;
  if (flags.wallPaint) f += AREA_SHARE.wallPaint;
  if (flags.trimPaint) f += AREA_SHARE.trimPaint;
  return f > 0 ? f : 1.0;
}
