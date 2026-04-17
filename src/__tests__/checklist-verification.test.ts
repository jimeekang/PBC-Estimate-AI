/**
 * checklist-verification.test.ts
 *
 * Runs scriptable items from docs/estimate-test-checklist.txt and prints
 * actual computed ranges so the checklist can be marked [x] or [ ] with
 * real data. Also reproduces the known bugs B.1 (Roof range width 0) and
 * B.2 (APARTMENT_SQM_CURVE monotonicity).
 */

import { calculateLiteEstimate } from '@/lib/lite-estimate';
import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';
import {
  APARTMENT_SQM_CURVE,
  EXTERIOR_ROOF_RATE,
  getRawMedianFromSqm,
} from '@/lib/pricing-engine';
import { liteEstimateSchema } from '@/schemas/estimate-lite';
import { estimateRequestSchema } from '@/schemas/estimate-request';

type LiteCase = {
  id: string;
  label: string;
  input: Parameters<typeof calculateLiteEstimate>[0];
  expected: { min: number; max: number };
};

const liteCases: LiteCase[] = [
  {
    id: 'L1',
    label: 'Apartment · Interior · Studio · 35sqm · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 35,
      apartmentStructure: 'Studio',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 1500, max: 2600 },
  },
  {
    id: 'L2',
    label: 'Apartment · Interior · 1Bed · 55sqm · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 55,
      apartmentStructure: '1Bed',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 2300, max: 3400 },
  },
  {
    id: 'L3',
    label: 'Apartment · Interior · 2Bed2Bath · 85sqm · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 3200, max: 4700 },
  },
  {
    id: 'L4',
    label: 'Apartment · Interior · 2Bed2Bath · 90sqm · Fair (monotonic check)',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 90,
      apartmentStructure: '2Bed2Bath',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 3200, max: 4650 },
  },
  {
    id: 'L5',
    label: 'Apartment · Interior · 3Bed2Bath · 110sqm · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 110,
      apartmentStructure: '3Bed2Bath',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 4000, max: 5900 },
  },
  {
    id: 'L6',
    label: 'Apartment · Interior · 3Bed2Bath · 110sqm · Poor',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 110,
      apartmentStructure: '3Bed2Bath',
      paintCondition: 'Poor',
    } as any,
    expected: { min: 4200, max: 6600 },
  },
  {
    id: 'L7',
    label: 'Apartment · Interior · 3Bed2Bath · 110sqm · Excellent',
    input: {
      workType: 'Interior Painting',
      propertyType: 'Apartment',
      approxSize: 110,
      apartmentStructure: '3Bed2Bath',
      paintCondition: 'Excellent',
    } as any,
    expected: { min: 3900, max: 5700 },
  },
  {
    id: 'L8',
    label: 'House · Interior · 3B/2B · 140sqm · 1 storey · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 8000, max: 12500 },
  },
  {
    id: 'L9',
    label: 'House · Interior · 3B/2B · 140sqm · 2 storey · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '2 storey',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 9500, max: 14500 },
  },
  {
    id: 'L10',
    label: 'House · Interior · 4B/2B · 180sqm · 1 storey · Fair',
    input: {
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 180,
      bedroomCount: 4,
      bathroomCount: 2,
      houseStories: '1 storey',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 11000, max: 17000 },
  },
  {
    id: 'L11',
    label: 'House · Interior · 5B/3B · 230sqm · 2 storey · Poor',
    input: {
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 230,
      bedroomCount: 5,
      bathroomCount: 3,
      houseStories: '2 storey',
      paintCondition: 'Poor',
    } as any,
    expected: { min: 17000, max: 25000 },
  },
  {
    id: 'L12',
    label: 'House · Exterior · 3B/2B · 140sqm · 1 storey · cladding · Fair',
    input: {
      workType: 'Exterior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      wallType: 'cladding',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 5000, max: 8000 },
  },
  {
    id: 'L13',
    label: 'House · Exterior · 3B/2B · 140sqm · 1 storey · rendered · Fair',
    input: {
      workType: 'Exterior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      wallType: 'rendered',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 6000, max: 9500 },
  },
  {
    id: 'L14',
    label: 'House · Exterior · 3B/2B · 140sqm · 1 storey · brick · Fair',
    input: {
      workType: 'Exterior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      wallType: 'brick',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 7200, max: 11500 },
  },
  {
    id: 'L15',
    label: 'House · Exterior · 3B/2B · 140sqm · 2 storey · cladding · Fair',
    input: {
      workType: 'Exterior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '2 storey',
      wallType: 'cladding',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 7000, max: 11000 },
  },
  {
    id: 'L16',
    label: 'House · Exterior · 3B/2B · 140sqm · 3 storey · brick · Poor',
    input: {
      workType: 'Exterior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '3 storey',
      wallType: 'brick',
      paintCondition: 'Poor',
    } as any,
    expected: { min: 14500, max: 22000 },
  },
  {
    id: 'L17',
    label: 'House · Interior+Exterior · 3B/2B · 140sqm · 1 storey · cladding · Fair',
    input: {
      workType: 'Interior + Exterior',
      propertyType: 'House / Townhouse',
      approxSize: 140,
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      wallType: 'cladding',
      paintCondition: 'Fair',
    } as any,
    expected: { min: 13000, max: 20000 },
  },
];

function summary(result: ReturnType<typeof calculateLiteEstimate>) {
  return {
    min: result.breakdown?.total?.min ?? -1,
    max: result.breakdown?.total?.max ?? -1,
    priceRange: result.priceRange,
  };
}

describe('Checklist PART A — Lite estimate cases', () => {
  const output: any[] = [];

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('\n=== LITE CHECKLIST RESULTS ===');
    // eslint-disable-next-line no-console
    console.table(output);
  });

  for (const tc of liteCases) {
    test(`${tc.id}: ${tc.label}`, () => {
      const res = calculateLiteEstimate(tc.input);
      const s = summary(res);
      const withinExpected =
        s.min >= tc.expected.min * 0.6 &&
        s.min <= tc.expected.max * 1.4 &&
        s.max >= tc.expected.min * 0.6 &&
        s.max <= Math.max(tc.expected.max * 1.4, 35000);
      output.push({
        id: tc.id,
        label: tc.label,
        actualMin: s.min,
        actualMax: s.max,
        expectedMin: tc.expected.min,
        expectedMax: tc.expected.max,
        priceRange: s.priceRange,
        withinTolerance: withinExpected,
      });
      // Basic sanity, not exact-match
      expect(s.min).toBeGreaterThan(0);
      expect(s.max).toBeGreaterThanOrEqual(s.min);
    });
  }
});

describe('Checklist A.1 regression guards', () => {
  test('L4: 90sqm apartment lite estimate should not price below 85sqm', () => {
    const at85 = summary(
      calculateLiteEstimate({
        workType: 'Interior Painting',
        propertyType: 'Apartment',
        approxSize: 85,
        apartmentStructure: '2Bed2Bath',
        paintCondition: 'Fair',
      } as any)
    );
    const at90 = summary(
      calculateLiteEstimate({
        workType: 'Interior Painting',
        propertyType: 'Apartment',
        approxSize: 90,
        apartmentStructure: '2Bed2Bath',
        paintCondition: 'Fair',
      } as any)
    );

    expect(at90.min).toBeGreaterThanOrEqual(at85.min);
    expect(at90.max).toBeGreaterThanOrEqual(at85.max);
  });

  test('L6: Poor apartment lite estimate should exceed Fair for same scope', () => {
    const fair = summary(
      calculateLiteEstimate({
        workType: 'Interior Painting',
        propertyType: 'Apartment',
        approxSize: 110,
        apartmentStructure: '3Bed2Bath',
        paintCondition: 'Fair',
      } as any)
    );
    const poor = summary(
      calculateLiteEstimate({
        workType: 'Interior Painting',
        propertyType: 'Apartment',
        approxSize: 110,
        apartmentStructure: '3Bed2Bath',
        paintCondition: 'Poor',
      } as any)
    );

    expect(poor.min).toBeGreaterThan(fair.min);
    expect(poor.max).toBeGreaterThan(fair.max);
  });

  test('L15: 2-storey cladding full exterior should stay within checklist ceiling', () => {
    const res = summary(
      calculateLiteEstimate({
        workType: 'Exterior Painting',
        propertyType: 'House / Townhouse',
        approxSize: 140,
        bedroomCount: 3,
        bathroomCount: 2,
        houseStories: '2 storey',
        wallType: 'cladding',
        paintCondition: 'Fair',
      } as any)
    );

    expect(res.min).toBeGreaterThanOrEqual(7000);
    expect(res.max).toBeLessThanOrEqual(11000);
  });

  test('L16: 3-storey brick full exterior poor condition should stay within checklist ceiling', () => {
    const res = summary(
      calculateLiteEstimate({
        workType: 'Exterior Painting',
        propertyType: 'House / Townhouse',
        approxSize: 140,
        bedroomCount: 3,
        bathroomCount: 2,
        houseStories: '3 storey',
        wallType: 'brick',
        paintCondition: 'Poor',
      } as any)
    );

    expect(res.min).toBeGreaterThanOrEqual(14500);
    expect(res.max).toBeLessThanOrEqual(22000);
  });
});

describe('Checklist L18 — Apartment + Exterior blocked by schema', () => {
  test('Apartment + Exterior Painting rejected', () => {
    const parsed = liteEstimateSchema.safeParse({
      workType: 'Exterior Painting',
      propertyType: 'Apartment',
      approxSize: 70,
      bedroomCount: 2,
      bathroomCount: 1,
      houseStories: '1 storey',
      wallType: 'cladding',
      paintCondition: 'Fair',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('Checklist L19-L20 — approxSize bounds', () => {
  test('L19: approxSize=30 (min) accepted', () => {
    const parsed = liteEstimateSchema.safeParse({
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 30,
      bedroomCount: 1,
      bathroomCount: 1,
      houseStories: '1 storey',
      paintCondition: 'Fair',
    });
    expect(parsed.success).toBe(true);
  });

  test('L19 boundary: approxSize=29 rejected', () => {
    const parsed = liteEstimateSchema.safeParse({
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 29,
      bedroomCount: 1,
      bathroomCount: 1,
      houseStories: '1 storey',
      paintCondition: 'Fair',
    });
    expect(parsed.success).toBe(false);
  });

  test('L20: approxSize=1200 (max) accepted', () => {
    const parsed = liteEstimateSchema.safeParse({
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 1200,
      bedroomCount: 5,
      bathroomCount: 3,
      houseStories: '3 storey',
      paintCondition: 'Fair',
    });
    expect(parsed.success).toBe(true);
  });

  test('L20 boundary: approxSize=1201 rejected', () => {
    const parsed = liteEstimateSchema.safeParse({
      workType: 'Interior Painting',
      propertyType: 'House / Townhouse',
      approxSize: 1201,
      bedroomCount: 5,
      bathroomCount: 3,
      houseStories: '3 storey',
      paintCondition: 'Fair',
    });
    expect(parsed.success).toBe(false);
  });
});

describe('Checklist PART A.4 — Exterior subsystem direct calls', () => {
  const out: any[] = [];

  afterAll(() => {
    // eslint-disable-next-line no-console
    console.log('\n=== EXTERIOR CHECKLIST RESULTS ===');
    // eslint-disable-next-line no-console
    console.table(out);
  });

  test('EX1: Wall only · 140sqm · 1 storey · cladding · Fair', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EX1', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 2600 });
    expect(r.extMin).toBeGreaterThanOrEqual(2600 * 0.9);
  });

  test('EX2: Wall only · 140sqm · 1 storey · rendered · Fair', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      wallType: 'rendered',
      approxSize: 140,
    });
    out.push({ id: 'EX2', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 3200 });
    expect(r.extMin).toBeGreaterThanOrEqual(3200 * 0.9);
  });

  test('EX3: Wall only · 140sqm · 1 storey · brick · Fair', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      wallType: 'brick',
      approxSize: 140,
    });
    out.push({ id: 'EX3', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 3800 });
    expect(r.extMin).toBeGreaterThanOrEqual(3800 * 0.9);
  });

  test('EX4: Wall+Eaves · cladding', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall', 'Eaves'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EX4', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 3600 });
    expect(r.extMin).toBeGreaterThanOrEqual(3600 * 0.9);
  });

  test('EX5: full exterior cladding 1 storey', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EX5', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 5200 });
    expect(r.extMin).toBeGreaterThanOrEqual(5200 * 0.9);
  });

  test('EX6: full exterior cladding 2 storey', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '2 storey',
      exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EX6', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 7600 });
    expect(r.extMin).toBeGreaterThanOrEqual(7600 * 0.9);
  });

  test('EX7: full exterior cladding 3 storey', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '3 storey',
      exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EX7', actualMin: r.extMin, actualMax: r.extMax, floorExpected: 10600 });
    expect(r.extMin).toBeGreaterThanOrEqual(10600 * 0.9);
  });

  test('EX10 (B.3 risk): Wall+Gutter+Fascia only · cladding (no Eaves)', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall', 'Gutter', 'Fascia'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({
      id: 'EX10',
      actualMin: r.extMin,
      actualMax: r.extMax,
      note: 'floor should be wallOnly 2600 — under-valuation risk',
    });
  });

  test('EXR1: Roof only · 140sqm · 1 storey', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Roof'],
      wallType: 'cladding',
      approxSize: 140,
    });
    out.push({ id: 'EXR1', actualMin: r.extMin, actualMax: r.extMax });
  });

  test('EXR3 (B.1 reproducer): Roof only · 50sqm · 3 storey → min==max risk', () => {
    const r = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '3 storey',
      exteriorAreas: ['Roof'],
      wallType: 'cladding',
      approxSize: 50,
    });
    out.push({
      id: 'EXR3',
      actualMin: r.extMin,
      actualMax: r.extMax,
      rangeWidth: r.extMax - r.extMin,
      note: 'B.1 bug: width should be > 0; if 0 → bug reproduced',
    });
  });
});

describe('Checklist PART B — Known bug reproducers', () => {
  test('B.1 Roof: verifies min/max divergence on small roof + high storey', () => {
    // Direct calc: floor 50 × 1.3 (pitchFactor) = 65 sqm
    const pitch = EXTERIOR_ROOF_RATE.pitchFactor;
    const roofArea = 50 * pitch;
    const tripleRate = EXTERIOR_ROOF_RATE.triple;
    const rawMin = roofArea * tripleRate.min;
    const rawMax = roofArea * tripleRate.max;
    const floor = tripleRate.floor;
    const clampedMin = Math.max(rawMin, floor);
    const clampedMax = Math.max(rawMax, clampedMin);

    // eslint-disable-next-line no-console
    console.log('[B.1] roofArea', roofArea, 'rawMin', rawMin, 'rawMax', rawMax, 'floor', floor);
    // eslint-disable-next-line no-console
    console.log('[B.1] clampedMin', clampedMin, 'clampedMax', clampedMax, 'width', clampedMax - clampedMin);

    if (clampedMax - clampedMin === 0) {
      // eslint-disable-next-line no-console
      console.warn('[B.1] BUG CONFIRMED — roof range width is 0');
    }
    expect(clampedMin).toBeGreaterThan(0);
  });

  test('B.2 APARTMENT_SQM_CURVE 85→90sqm monotonicity check', () => {
    const p85 = APARTMENT_SQM_CURVE.find((p) => p.sqm === 85);
    const p90 = APARTMENT_SQM_CURVE.find((p) => p.sqm === 90);
    // eslint-disable-next-line no-console
    console.log('[B.2] 85sqm rawMedian =', p85?.rawMedian, ', 90sqm rawMedian =', p90?.rawMedian);
    expect(p85).toBeDefined();
    expect(p90).toBeDefined();

    const m85 = getRawMedianFromSqm(85);
    const m90 = getRawMedianFromSqm(90);
    // eslint-disable-next-line no-console
    console.log('[B.2] getRawMedianFromSqm(85)=', m85, 'getRawMedianFromSqm(90)=', m90);

    // Canonical check: monotonically non-decreasing
    if (m90 < m85) {
      // eslint-disable-next-line no-console
      console.warn(
        `[B.2] BUG CONFIRMED — price decreases from 85sqm (${m85}) to 90sqm (${m90})`
      );
    }
    expect(m90).toBeGreaterThanOrEqual(m85);
  });

  test('B.2 full monotonic scan over APARTMENT_SQM_CURVE', () => {
    const violations: { from: { sqm: number; val: number }; to: { sqm: number; val: number } }[] = [];
    for (let i = 1; i < APARTMENT_SQM_CURVE.length; i++) {
      const a = APARTMENT_SQM_CURVE[i - 1];
      const b = APARTMENT_SQM_CURVE[i];
      if (b.rawMedian < a.rawMedian) {
        violations.push({
          from: { sqm: a.sqm, val: a.rawMedian },
          to: { sqm: b.sqm, val: b.rawMedian },
        });
      }
    }
    // eslint-disable-next-line no-console
    console.log('[B.2] monotonic violations:', violations);
    expect(violations).toHaveLength(0);
  });
});

describe('Checklist A.6 — Schema validation (V1-V7)', () => {
  const base = {
    name: 'Test',
    email: 'test@test.com',
    phone: '0412345678',
    typeOfWork: ['Interior Painting'],
    scopeOfPainting: 'Entire property',
    propertyType: 'House / Townhouse',
    houseStories: '1 storey',
    bedroomCount: 3,
    bathroomCount: 2,
    approxSize: 140,
    paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    timingPurpose: 'Maintenance or refresh',
  };

  test('V1: name missing → error', () => {
    const res = estimateRequestSchema.safeParse({ ...base, name: '' });
    expect(res.success).toBe(false);
  });

  test('V2: email invalid → error', () => {
    const res = estimateRequestSchema.safeParse({ ...base, email: 'not-an-email' });
    expect(res.success).toBe(false);
  });

  test('V3: bedroom/bathroom + approxSize all missing → error', () => {
    const { bedroomCount, bathroomCount, approxSize, ...rest } = base as any;
    const res = estimateRequestSchema.safeParse(rest);
    expect(res.success).toBe(false);
  });

  test('V6: interiorDoorItems quantity 51 → error', () => {
    const res = estimateRequestSchema.safeParse({
      ...base,
      scopeOfPainting: 'Specific areas only',
      interiorWallHeight: 2.7,
      interiorRooms: [{ roomName: 'Bedroom 1', approxRoomSize: 12, paintAreas: { trimPaint: true } }],
      trimPaintOptions: { paintType: 'Oil-based', trimItems: ['Doors'] },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 51 },
      ],
    });
    expect(res.success).toBe(false);
  });

  test('New rule: trim enabled but no trim items → error', () => {
    const res = estimateRequestSchema.safeParse({
      ...base,
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: { paintType: 'Oil-based', trimItems: [] },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const hasTrimItemsError = res.error.issues.some(
        (i) => i.path.join('.') === 'trimPaintOptions.trimItems'
      );
      expect(hasTrimItemsError).toBe(true);
    }
  });

  test('New rule: trim enabled + Doors selected → passes trim items check', () => {
    const res = estimateRequestSchema.safeParse({
      ...base,
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: { paintType: 'Oil-based', trimItems: ['Doors'] },
    });
    // This might still fail other refine rules (door items empty), but NOT for trimItems-empty reason
    if (!res.success) {
      const hasTrimItemsEmptyError = res.error.issues.some(
        (i) =>
          i.path.join('.') === 'trimPaintOptions.trimItems' &&
          (i.message || '').toLowerCase().includes('select at least one trim item')
      );
      expect(hasTrimItemsEmptyError).toBe(false);
    } else {
      expect(res.success).toBe(true);
    }
  });
});
