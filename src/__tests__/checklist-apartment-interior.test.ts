/**
 * checklist-apartment-interior.test.ts
 *
 * Scriptable execution of docs/estimate-test-checklist.txt
 *   A.2  FULL ESTIMATE — APARTMENT INTERIOR
 *   A.2.1 Entire property (AE1-AE14)
 *   A.2.2 Specific areas only (AS1-AS18)
 *
 * Calls the full flow (`generatePaintingEstimate`) and reports actual min/max
 * against documented expectations. Also validates itemised unit pricing for
 * AS14/AS15/AS16 against the anchor tables.
 */

jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => async () => ({ output: undefined }),
    defineFlow: (_config: unknown, handler: unknown) => handler,
  },
}));

import {
  generatePaintingEstimate,
  type GeneratePaintingEstimateInput,
  type GeneratePaintingEstimateOutput,
} from '@/ai/flows/generate-painting-estimate';
import { estimateRequestSchema } from '@/schemas/estimate-request';
import {
  APARTMENT_ANCHORS_OIL,
  INTERIOR_DOOR_ITEM_ANCHOR,
  INTERIOR_DOOR_TYPE_PREMIUM,
  INTERIOR_WINDOW_ITEM_ANCHOR,
} from '@/lib/pricing-engine';

type Row = {
  id: string;
  label: string;
  actualMin: number;
  actualMax: number;
  expectedMin?: number;
  expectedMax?: number;
  priceRange?: string;
  note?: string;
};

const aeRows: Row[] = [];
const asRows: Row[] = [];

function findRemainingIssues(rows: Row[]) {
  return rows
    .map((row) => {
      const issues: string[] = [];
      if (
        typeof row.actualMin === 'number' &&
        typeof row.actualMax === 'number' &&
        row.actualMax - row.actualMin > 1500
      ) {
        issues.push(`range width ${row.actualMax - row.actualMin} > 1500`);
      }
      if (typeof row.expectedMin === 'number' && row.actualMin < row.expectedMin) {
        issues.push(`min ${row.actualMin} < expected ${row.expectedMin}`);
      }
      if (typeof row.expectedMax === 'number' && row.actualMax > row.expectedMax) {
        issues.push(`max ${row.actualMax} > expected ${row.expectedMax}`);
      }
      return issues.length > 0 ? { id: row.id, label: row.label, issues: issues.join('; ') } : null;
    })
    .filter((row): row is { id: string; label: string; issues: string } => row !== null);
}

afterAll(() => {
  const aeIssues = findRemainingIssues(aeRows);
  const asIssues = findRemainingIssues(asRows);

  // eslint-disable-next-line no-console
  console.log('\n=== A.2.1 APT · Entire property (Remaining issues only) ===');
  // eslint-disable-next-line no-console
  console.table(aeIssues.length > 0 ? aeIssues : [{ status: 'No remaining issues' }]);
  // eslint-disable-next-line no-console
  console.log('\n=== A.2.2 APT · Specific areas only (Remaining issues only) ===');
  // eslint-disable-next-line no-console
  console.table(asIssues.length > 0 ? asIssues : [{ status: 'No remaining issues' }]);
});

function base(): GeneratePaintingEstimateInput {
  return {
    name: 'Apt Test',
    email: 'apt@test.com',
    typeOfWork: ['Interior Painting'],
    scopeOfPainting: 'Entire property',
    propertyType: 'Apartment',
    timingPurpose: 'Maintenance or refresh',
    paintCondition: 'Fair',
  } as GeneratePaintingEstimateInput;
}

function interior(result: GeneratePaintingEstimateOutput) {
  return {
    min: result.breakdown?.interior?.min ?? 0,
    max: result.breakdown?.interior?.max ?? 0,
    priceRange: result.breakdown?.interior?.priceRange,
  };
}

function total(result: GeneratePaintingEstimateOutput) {
  return {
    min: result.breakdown?.total?.min ?? 0,
    max: result.breakdown?.total?.max ?? 0,
    priceRange: result.breakdown?.total?.priceRange,
  };
}

// ─────────────────────────────────────────────────────────────
// A.2.1 Apartment · Entire property
// ─────────────────────────────────────────────────────────────

describe('A.2.1 Apartment · Entire property', () => {
  test('AE1: Studio 40sqm · wall+ceiling · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 40,
      apartmentStructure: 'Studio',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE1', label: 'Studio 40 w+c', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
    expect(i.max).toBeGreaterThanOrEqual(i.min);
  });

  test('AE2: 1Bed 55sqm · wall+ceiling · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 55,
      apartmentStructure: '1Bed',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE2', label: '1Bed 55 w+c', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
    expect(i.max).toBeGreaterThanOrEqual(i.min);
  });

  test('AE3: 2Bed2Bath 85sqm · wall+ceiling+trim · Fair · Oil-based', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE3', label: '2B2B 85 w+c+t oil', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AE4: 2Bed2Bath 85sqm · wall+ceiling+trim · Fair · Water-based', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE4', label: '2B2B 85 w+c+t water', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AE5: 2Bed2Bath 85sqm · w+c+t · Water · Doors(French) → +6-10% vs baseline', async () => {
    const baseline = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });
    const withFrench = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['french'],
      },
    });
    const b = interior(baseline);
    const f = interior(withFrench);
    const liftMin = (f.min - b.min) / Math.max(1, b.min);
    const liftMax = (f.max - b.max) / Math.max(1, b.max);
    aeRows.push({
      id: 'AE5',
      label: '2B2B 85 doors French lift',
      actualMin: f.min,
      actualMax: f.max,
      note: `baseline ${b.min}-${b.max} → french ${f.min}-${f.max}, lift ${(liftMin * 100).toFixed(1)}%/${(liftMax * 100).toFixed(1)}%`,
    });
    expect(f.max).toBeGreaterThanOrEqual(b.max);
    expect(liftMin).toBeGreaterThanOrEqual(0.04);
    expect(liftMax).toBeGreaterThanOrEqual(0.04);
  });

  test('AE6: 3Bed2Bath 110sqm · w+c+t+ensuite · Poor', async () => {
    const fair = await generatePaintingEstimate({
      ...base(),
      approxSize: 110,
      apartmentStructure: '3Bed2Bath',
      paintCondition: 'Fair',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: true },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
    });
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 110,
      apartmentStructure: '3Bed2Bath',
      paintCondition: 'Poor',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: true },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
    });
    const fairInterior = interior(fair);
    const i = interior(r);
    aeRows.push({ id: 'AE6', label: '3B2B 110 all Poor', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.max).toBeGreaterThan(i.min);
    expect(i.min).toBeGreaterThan(fairInterior.min);
    expect(i.max).toBeGreaterThan(fairInterior.max);
  });

  test('AE7: 2Bed2Bath 85sqm · wall only · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE7', label: '2B2B 85 wall only', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
    expect(i.min).toBeLessThan(3393);
    expect(i.max).toBeLessThan(4072);
  });

  test('AE8: 2Bed2Bath 85sqm · ceiling only · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: false, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({ id: 'AE8', label: '2B2B 85 ceiling only', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
    expect(i.min).toBeLessThan(3393);
    expect(i.max).toBeLessThan(4072);
  });

  test('AE9: 2Bed2Bath 85sqm · trim only · Fair (trim-only branch)', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: false, wallPaint: false, trimPaint: true, ensuitePaint: false },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
    });
    const i = interior(r);
    aeRows.push({
      id: 'AE9',
      label: '2B2B 85 trim only',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
      note: 'trim-only entire branch',
    });
    expect(i.min).toBeGreaterThan(0);
    expect(i.max).toBeGreaterThanOrEqual(i.min);
    expect(i.min).toBeLessThan(3393);
    expect(i.max).toBeLessThan(4072);
  });

  test('AE7/AE8/AE9: single-surface entire apartment prices should stay distinct', async () => {
    const [wallOnly, ceilingOnly, trimOnly] = await Promise.all([
      generatePaintingEstimate({
        ...base(),
        approxSize: 85,
        apartmentStructure: '2Bed2Bath',
        paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false },
      }),
      generatePaintingEstimate({
        ...base(),
        approxSize: 85,
        apartmentStructure: '2Bed2Bath',
        paintAreas: { ceilingPaint: true, wallPaint: false, trimPaint: false, ensuitePaint: false },
      }),
      generatePaintingEstimate({
        ...base(),
        approxSize: 85,
        apartmentStructure: '2Bed2Bath',
        paintAreas: { ceilingPaint: false, wallPaint: false, trimPaint: true, ensuitePaint: false },
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
        },
      }),
    ]);

    const wall = interior(wallOnly);
    const ceiling = interior(ceilingOnly);
    const trim = interior(trimOnly);

    expect(wall.min).toBeGreaterThan(ceiling.min);
    expect(ceiling.min).toBeGreaterThan(trim.min);
    expect(wall.max).toBeGreaterThan(ceiling.max);
    expect(ceiling.max).toBeGreaterThan(trim.max);
    expect(ceiling.min / wall.min).toBeGreaterThanOrEqual(0.6);
    expect(ceiling.min / wall.min).toBeLessThanOrEqual(0.63);
    expect(ceiling.max / wall.max).toBeGreaterThanOrEqual(0.6);
    expect(ceiling.max / wall.max).toBeLessThanOrEqual(0.63);
  });

  test('AE10: ensuite-only edge case — throws because no priced surface selected', async () => {
    await expect(
      generatePaintingEstimate({
        ...base(),
        approxSize: 85,
        apartmentStructure: '2Bed2Bath',
        paintAreas: { ceilingPaint: false, wallPaint: false, trimPaint: false, ensuitePaint: true },
      })
    ).rejects.toThrow(/priced interior surface/i);
    aeRows.push({
      id: 'AE10',
      label: 'ensuite-only → throws',
      actualMin: 0,
      actualMax: 0,
      note: 'Flow rejects no priced surface (ensuite alone not enough)',
    });
  });

  test('AE11: approxSize missing → apartmentStructure fallback', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      apartmentStructure: '2Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({
      id: 'AE11',
      label: 'approxSize missing, structure=2B2B',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
    });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AE12: apartmentStructure missing → sqm curve only (85sqm)', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 85,
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({
      id: 'AE12',
      label: 'structure missing, approxSize=85',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
    });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AE13: approxSize=35, structure=Studio → lower bound of curve', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 35,
      apartmentStructure: 'Studio',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({
      id: 'AE13',
      label: 'Studio 35 curve low',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
    });
    expect(i.min).toBeGreaterThanOrEqual(800);
  });

  test('AE14: approxSize=200 → curve extrapolation', async () => {
    const r = await generatePaintingEstimate({
      ...base(),
      approxSize: 200,
      apartmentStructure: '3Bed2Bath',
      paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
    });
    const i = interior(r);
    aeRows.push({
      id: 'AE14',
      label: '3B2B 200 curve upper',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
    });
    expect(i.min).toBeGreaterThan(0);
  });

});

// ─────────────────────────────────────────────────────────────
// A.2.2 Apartment · Specific areas only
// ─────────────────────────────────────────────────────────────

function baseSpecific(): GeneratePaintingEstimateInput {
  return {
    name: 'Apt Spec',
    email: 'apt@test.com',
    typeOfWork: ['Interior Painting'],
    scopeOfPainting: 'Specific areas only',
    propertyType: 'Apartment',
    timingPurpose: 'Maintenance or refresh',
    paintCondition: 'Fair',
    approxSize: 85,
    interiorWallHeight: 2.7,
  } as GeneratePaintingEstimateInput;
}

describe('A.2.2 Apartment · Specific areas only', () => {
  test('AS1: Living Room · wall+ceiling · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        {
          roomName: 'Living Room',
          approxRoomSize: 18,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS1', label: 'Living only', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AS2: Living + Kitchen · wall+ceiling · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        {
          roomName: 'Living Room',
          approxRoomSize: 18,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
        {
          roomName: 'Kitchen',
          approxRoomSize: 12,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS2', label: 'Living+Kitchen', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AS3: Master Bedroom · wall+trim · Water-based', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        {
          roomName: 'Master Bedroom',
          approxRoomSize: 16,
          paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: true, ensuitePaint: false },
        },
      ],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'water_3coat_white_finish', quantity: 1 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'water_3coat_white_finish', quantity: 1 },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS3', label: 'Master w+t water', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AS4: Bathroom only · wall · Fair — expect floor ≈ $1,050', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        {
          roomName: 'Bathroom',
          approxRoomSize: 5,
          paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const i = interior(r);
    asRows.push({
      id: 'AS4',
      label: 'Bathroom only',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
      expectedMin: 1050,
    });
    expect(i.min).toBeGreaterThanOrEqual(1050);
  });

  test('AS5: Bedroom 1+2+3 · wall · Fair', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        { roomName: 'Bedroom 1', approxRoomSize: 12, paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false } },
        { roomName: 'Bedroom 2', approxRoomSize: 11, paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false } },
        { roomName: 'Bedroom 3', approxRoomSize: 10, paintAreas: { ceilingPaint: false, wallPaint: true, trimPaint: false, ensuitePaint: false } },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS5', label: 'Bed1+2+3 wall', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AS6: Stairwell only · wall+ceiling · Fair — expect ≈ $1,100', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      propertyType: 'House / Townhouse', // Stairwell is a house-flavored room
      interiorRooms: [
        {
          roomName: 'Stairwell',
          approxRoomSize: 8,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const i = interior(r);
    asRows.push({
      id: 'AS6',
      label: 'Stairwell only',
      ...i,
      actualMin: i.min,
      actualMax: i.max,
      expectedMin: 1100,
    });
    expect(i.min).toBeGreaterThanOrEqual(1100);
  });

  test('AS7: Handrail only · water 3coat · 4lm × 70mm', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      propertyType: 'House / Townhouse',
      interiorRooms: [
        {
          roomName: 'Handrail',
          paintAreas: { ceilingPaint: false, wallPaint: false, trimPaint: true, ensuitePaint: false },
          handrailDetails: {
            lengthLm: 4,
            widthMm: 70,
            system: 'paint_to_paint_water_3coat',
          },
        },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS7', label: 'Handrail 4lm 70mm', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBe(778);
    expect(i.max).toBe(907);
  });

  test('AS8: 5 rooms · wall+ceiling+trim · Water-based', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      interiorRooms: [
        { roomName: 'Living Room', approxRoomSize: 20, paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false } },
        { roomName: 'Kitchen', approxRoomSize: 10, paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false } },
        { roomName: 'Bedroom 1', approxRoomSize: 12, paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false } },
        { roomName: 'Bathroom', approxRoomSize: 5, paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false } },
        { roomName: 'Dining Room', approxRoomSize: 14, paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: true, ensuitePaint: false } },
      ],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'water_3coat_white_finish', quantity: 5 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'water_3coat_white_finish', quantity: 4 },
      ],
    });
    const i = interior(r);
    asRows.push({ id: 'AS8', label: '5 rooms all water', ...i, actualMin: i.min, actualMax: i.max });
    expect(i.min).toBeGreaterThan(0);
  });

  test('AS9: interiorWallHeight missing → schema error', () => {
    const base = {
      name: 'X',
      email: 'x@x.com',
      phone: '0412345678',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          approxRoomSize: 10,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    };
    const res = estimateRequestSchema.safeParse(base);
    asRows.push({
      id: 'AS9',
      label: 'missing wallHeight',
      actualMin: 0,
      actualMax: 0,
      note: res.success ? 'ACCEPTED (unexpected)' : 'rejected ✓',
    });
    expect(res.success).toBe(false);
  });

  test('AS10: approxRoomSize=0 → schema error', () => {
    const res = estimateRequestSchema.safeParse({
      name: 'X',
      email: 'x@x.com',
      phone: '0412345678',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      interiorWallHeight: 2.7,
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          approxRoomSize: 0,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    asRows.push({
      id: 'AS10',
      label: 'approxRoomSize=0',
      actualMin: 0,
      actualMax: 0,
      note: res.success ? 'ACCEPTED (unexpected)' : 'rejected ✓',
    });
    expect(res.success).toBe(false);
  });

  test('AS11: Bedroom 1 · trim only · Oil-based (trim-only specific)', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 1 },
      ],
    });
    asRows.push({
      id: 'AS11',
      label: 'trim only (doors) oil',
      actualMin: r.breakdown?.total?.min ?? -1,
      actualMax: r.breakdown?.total?.max ?? -1,
      note: `mode=${r.pricingMeta?.mode ?? 'estimate'}`,
    });
    expect(r.pricingMeta?.mode).toBe('interior_itemized');
  });

  test('AS12: Skirting Boards only · linear_metres · 40lm · Oil-based', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Skirting Boards'],
      },
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: 40,
    });
    const t = total(r);
    asRows.push({ id: 'AS12', label: 'Skirting 40lm oil', ...t, actualMin: t.min, actualMax: t.max });
    expect(t.min).toBeGreaterThan(0);
  });

  test('AS13: Skirting Boards only · room_calculator · 2 rooms', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Skirting Boards'],
      },
      skirtingPricingMode: 'room_calculator',
      skirtingCalculatorRooms: [
        { label: 'Living', length: 5, width: 4 },
        { label: 'Bed 1', length: 4, width: 3 },
      ],
    });
    const t = total(r);
    asRows.push({ id: 'AS13', label: 'Skirting room_calc 2rms', ...t, actualMin: t.min, actualMax: t.max });
    expect(t.min).toBeGreaterThan(0);
  });

  test('AS14: Door flush / Door&Frame / oil / 5 → subtotal 5×$220 = $1,100', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 5 },
      ],
    });
    const sub = r.pricingMeta?.subtotalExGst ?? -1;
    const expected =
      (INTERIOR_DOOR_ITEM_ANCHOR.oil_2coat['Door & Frame'] +
        INTERIOR_DOOR_TYPE_PREMIUM.flush) *
      5;
    asRows.push({
      id: 'AS14',
      label: 'flush D&F oil ×5',
      actualMin: sub,
      actualMax: sub,
      expectedMin: expected,
      expectedMax: expected,
    });
    expect(sub).toBe(1100);
    expect(expected).toBe(1100);
  });

  test('AS15: Door bi_folding / Door&Frame / water / 2 → subtotal 2×($295+$25) = $640', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors'],
      },
      interiorDoorItems: [
        { doorType: 'bi_folding', scope: 'Door & Frame', system: 'water_3coat_white_finish', quantity: 2 },
      ],
    });
    const sub = r.pricingMeta?.subtotalExGst ?? -1;
    const expected =
      (INTERIOR_DOOR_ITEM_ANCHOR.water_3coat_white_finish['Door & Frame'] +
        INTERIOR_DOOR_TYPE_PREMIUM.bi_folding) *
      2;
    asRows.push({
      id: 'AS15',
      label: 'bi_folding D&F water ×2',
      actualMin: sub,
      actualMax: sub,
      expectedMin: expected,
      expectedMax: expected,
    });
    expect(sub).toBe(640);
    expect(expected).toBe(640);
  });

  test('AS16: Window French / Window&Frame / water / 4 → subtotal 4×$475 = $1,900', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Window Frames'],
      },
      interiorWindowItems: [
        { type: 'French', scope: 'Window & Frame', system: 'water_3coat_white_finish', quantity: 4 },
      ],
    });
    const sub = r.pricingMeta?.subtotalExGst ?? -1;
    const expected =
      INTERIOR_WINDOW_ITEM_ANCHOR.water_3coat_white_finish.French['Window & Frame'] * 4;
    asRows.push({
      id: 'AS16',
      label: 'French W&F water ×4',
      actualMin: sub,
      actualMax: sub,
      expectedMin: expected,
      expectedMax: expected,
    });
    expect(sub).toBe(1900);
    expect(expected).toBe(1900);
  });

  test('AS17: Door+Window items only (no rooms) → interior_itemized mode', async () => {
    const r = await generatePaintingEstimate({
      ...baseSpecific(),
      specificInteriorTrimOnly: true,
      interiorRooms: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 2 },
      ],
    });
    const sub = r.pricingMeta?.subtotalExGst ?? -1;
    // Doors 2 × 220 = 440; Windows 2 × 200 = 400; subtotal = 840
    const expected = 440 + 400;
    asRows.push({
      id: 'AS17',
      label: 'door+window items',
      actualMin: sub,
      actualMax: sub,
      expectedMin: expected,
      expectedMax: expected,
      note: `mode=${r.pricingMeta?.mode}`,
    });
    expect(r.pricingMeta?.mode).toBe('interior_itemized');
    expect(sub).toBe(expected);
  });

  test('AS18: TwoBedStd 90sqm vs TwoBedLg 91sqm (class cliff)', async () => {
    const r90 = await generatePaintingEstimate({
      ...baseSpecific(),
      approxSize: 90,
      bedroomCount: 2,
      interiorRooms: [
        {
          roomName: 'Living Room',
          approxRoomSize: 20,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const r91 = await generatePaintingEstimate({
      ...baseSpecific(),
      approxSize: 91,
      bedroomCount: 2,
      interiorRooms: [
        {
          roomName: 'Living Room',
          approxRoomSize: 20,
          paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
        },
      ],
    });
    const a = interior(r90);
    const b = interior(r91);
    const dMin = b.min - a.min;
    const dMax = b.max - a.max;
    asRows.push({
      id: 'AS18',
      label: '90 vs 91 class cliff',
      actualMin: a.min,
      actualMax: a.max,
      note: `90: ${a.min}-${a.max}  91: ${b.min}-${b.max}  Δ ${dMin}/${dMax}`,
    });
    // Reference (anchor table): TwoBedStd median 5000, TwoBedLg median 6000 → cliff expected
    expect(APARTMENT_ANCHORS_OIL.TwoBedStd.median).toBeLessThan(APARTMENT_ANCHORS_OIL.TwoBedLg.median);
    expect(b.min).toBeGreaterThan(a.min);
    expect(b.max).toBeGreaterThan(a.max);
  });

});
