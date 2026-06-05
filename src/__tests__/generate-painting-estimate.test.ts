const mockExplanationPrompt = jest.fn<Promise<{ output: unknown }>, []>(
  async () => ({ output: undefined })
);

jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => mockExplanationPrompt,
    defineFlow: (_config: unknown, fn: unknown) => fn,
  },
}));

import {
  generatePaintingEstimate,
  type GeneratePaintingEstimateInput,
} from '@/ai/flows/generate-painting-estimate';
import { clampInteriorRangeForOutput } from '@/lib/estimate-output-range';

const baseWholeHousePayload: GeneratePaintingEstimateInput = {
  name: 'Test User',
  email: 'test@example.com',
  typeOfWork: ['Interior Painting'],
  scopeOfPainting: 'Entire property',
  propertyType: 'House / Townhouse',
  houseStories: '1 storey',
  bedroomCount: 3,
  bathroomCount: 2,
  approxSize: 135,
  timingPurpose: 'Maintenance or refresh',
  paintCondition: 'Fair',
  paintAreas: {
    ceilingPaint: true,
    wallPaint: true,
    trimPaint: true,
    ensuitePaint: false,
  },
};

describe('generatePaintingEstimate', () => {
  beforeEach(() => {
    mockExplanationPrompt.mockResolvedValue({ output: undefined });
  });

  test('whole-house calibration does not change when bedroomCount already represents the full bedroom total', async () => {
    const baseline = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
    });

    const withRepresentativeRoom = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: ['Master Bedroom'],
    });

    expect(withRepresentativeRoom.breakdown?.interior).toEqual(baseline.breakdown?.interior);
  });

  test('3B2B fair single-storey whole-house estimate uses the calibrated 135sqm band', async () => {
    const result = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
    });

    expect(result.breakdown?.interior?.min).toBe(10000);
    expect(result.breakdown?.interior?.max).toBe(11500);
    expect(result.breakdown?.total?.min).toBe(10000);
    expect(result.breakdown?.total?.max).toBe(11500);
  });

  test('AI prompt output cannot override deterministic price range or breakdown', async () => {
    mockExplanationPrompt.mockResolvedValueOnce({
      output: {
        priceRange: 'AUD 1 - 2',
        explanation: 'Prompt explanation',
        details: ['Prompt detail'],
        breakdown: {
          interior: { min: 1, max: 2, priceRange: 'AUD 1 - 2' },
          total: { min: 1, max: 2, priceRange: 'AUD 1 - 2' },
        },
        pricingMeta: {
          mode: 'interior_itemized',
          subtotalExGst: 1,
          gst: 0,
          totalIncGst: 1,
        },
      },
    });

    const result = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
    });

    expect(result.priceRange).toBe('AUD 10,000 - 11,500');
    expect(result.breakdown?.interior).toEqual({
      min: 10000,
      max: 11500,
      priceRange: 'AUD 10,000 - 11,500',
    });
    expect(result.breakdown?.total).toEqual({
      min: 10000,
      max: 11500,
      priceRange: 'AUD 10,000 - 11,500',
    });
    expect(result.pricingMeta).toBeUndefined();
    expect(result.explanation).toBe('Prompt explanation');
    expect(result.details).toEqual(['Prompt detail']);
  });

  test('exterior-only estimate keeps total range aligned with exterior breakdown', async () => {
    const result = await generatePaintingEstimate({
      name: 'Exterior Test',
      email: 'test@example.com',
      typeOfWork: ['Exterior Painting'],
      scopeOfPainting: 'Entire property',
      propertyType: 'House / Townhouse',
      houseStories: '1 storey',
      approxSize: 180,
      wallHeight: 3,
      exteriorAreas: ['Wall'],
      wallFinishes: ['rendered'],
      wallType: 'rendered',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
    });

    expect(result.breakdown?.total).toEqual(result.breakdown?.exterior);
    expect(result.priceRange).toBe(result.breakdown?.exterior?.priceRange);
  });

  test('entire-apartment ensuite-only interior selection produces a priced range', async () => {
    const result = await generatePaintingEstimate({
      name: 'Ensuite Only Test',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Entire property',
      propertyType: 'Apartment',
      apartmentStructure: '2Bed2Bath',
      approxSize: 85,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: true,
      },
    });

    expect(result.breakdown?.interior?.min).toBeGreaterThan(0);
    expect(result.breakdown?.interior?.max).toBeGreaterThanOrEqual(
      result.breakdown?.interior?.min ?? 0
    );
  });

  test('entire-apartment trim quantities use the 50 percent whole-property trim anchor', async () => {
    const result = await generatePaintingEstimate({
      name: 'Apartment Trim Quantity Test',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Entire property',
      propertyType: 'Apartment',
      apartmentStructure: '2Bed2Bath',
      approxSize: 85,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      paintAreas: {
        ceilingPaint: true,
        wallPaint: true,
        trimPaint: true,
        ensuitePaint: false,
      },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 7 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 8 },
      ],
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: 65,
    });

    expect(result.breakdown?.interior?.min).toBe(5010);
    expect(result.breakdown?.interior?.max).toBe(5786);
  });

  test('whole-house trim quantities use the 50 percent whole-property trim anchor', async () => {
    const result = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 12 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 12 },
      ],
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: 130,
    });

    expect(result.breakdown?.interior?.min).toBe(12597);
    expect(result.breakdown?.interior?.max).toBe(14097);
  });

  test('trim-only interior door quantities use the volume discount scale', async () => {
    const result = await generatePaintingEstimate({
      name: 'Trim Only Test',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      specificInteriorTrimOnly: true,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
      },
      interiorRooms: [],
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 13 },
      ],
    });

    expect(result.pricingMeta?.subtotalExGst).toBe(2288);
    expect(result.breakdown?.interior?.min).toBe(2288);
  });

  test('trim-only interior window quantities use the volume discount scale', async () => {
    const result = await generatePaintingEstimate({
      name: 'Trim Only Test',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      specificInteriorTrimOnly: true,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Window Frames'],
      },
      interiorRooms: [],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 13 },
      ],
    });

    expect(result.pricingMeta?.subtotalExGst).toBe(2080);
    expect(result.breakdown?.interior?.min).toBe(2080);
  });

  test('interior output clamp never lets fallback exceed MAX_PRICE_CAP', () => {
    expect(clampInteriorRangeForOutput(50000, 30000, false)).toEqual({
      min: 35000,
      max: 35000,
    });
  });

  test('whole-house water-based trim quantities price above oil-based quantities', async () => {
    const oil = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 12 },
      ],
      interiorWindowItems: [
        { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 12 },
      ],
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: 130,
    });

    const water = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
      },
      interiorDoorItems: [
        {
          doorType: 'flush',
          scope: 'Door & Frame',
          system: 'water_3coat_white_finish',
          quantity: 12,
        },
      ],
      interiorWindowItems: [
        {
          type: 'Normal',
          scope: 'Window & Frame',
          system: 'water_3coat_white_finish',
          quantity: 12,
        },
      ],
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: 130,
    });

    expect(water.breakdown?.interior?.min).toBeGreaterThan(oil.breakdown?.interior?.min ?? 0);
    expect(water.breakdown?.interior?.max).toBeGreaterThan(oil.breakdown?.interior?.max ?? 0);
  });

  test('custom large rooms such as Rumpus are normalized to the Living Room score path', async () => {
    const baseSpecificPayload: GeneratePaintingEstimateInput = {
      name: 'Test User',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      houseStories: '1 storey',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      roomsToPaint: ['Living Room'],
    };

    const livingRoom = await generatePaintingEstimate(baseSpecificPayload);
    const rumpusRoom = await generatePaintingEstimate({
      ...baseSpecificPayload,
      roomsToPaint: ['Rumpus'],
    });

    expect(rumpusRoom.breakdown?.interior).toEqual(livingRoom.breakdown?.interior);
  });

  test('measured custom rooms such as Rumpus share the same anchor and multiplier as Living Room', async () => {
    const baseMeasuredPayload: GeneratePaintingEstimateInput = {
      name: 'Test User',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      houseStories: '1 storey',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      interiorWallHeight: 2.7,
      interiorRooms: [
        {
          roomName: 'Living Room',
          approxRoomSize: 24,
          paintAreas: {
            ceilingPaint: true,
            wallPaint: true,
            trimPaint: false,
            ensuitePaint: false,
          },
        },
      ],
    };

    const livingRoom = await generatePaintingEstimate(baseMeasuredPayload);
    const rumpusRoom = await generatePaintingEstimate({
      ...baseMeasuredPayload,
      interiorRooms: [
        {
          ...baseMeasuredPayload.interiorRooms![0],
          roomName: 'Rumpus',
        },
      ],
    });

    expect(rumpusRoom.breakdown?.interior).toEqual(livingRoom.breakdown?.interior);
  });
});
