jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => async () => ({ output: undefined }),
    defineFlow: (_config: unknown, fn: unknown) => fn,
  },
}));

import {
  generatePaintingEstimate,
  type GeneratePaintingEstimateInput,
} from '@/ai/flows/generate-painting-estimate';

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

  test('whole-house door type premiums apply on top of the trim share for entire-property pricing', async () => {
    const baseline = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });

    const premium = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush', 'bi_folding'],
      },
    });

    expect((premium.breakdown?.interior?.min ?? 0)).toBeGreaterThan(
      baseline.breakdown?.interior?.min ?? 0
    );
    expect((premium.breakdown?.interior?.max ?? 0)).toBeGreaterThan(
      baseline.breakdown?.interior?.max ?? 0
    );
  });

  test('whole-house water-based trim carries at least AUD 3,500 more than oil-based trim', async () => {
    const oil = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });

    const water = await generatePaintingEstimate({
      ...baseWholeHousePayload,
      roomsToPaint: [],
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });

    expect((water.breakdown?.interior?.min ?? 0) - (oil.breakdown?.interior?.min ?? 0)).toBeGreaterThanOrEqual(3500);
    expect((water.breakdown?.interior?.max ?? 0) - (oil.breakdown?.interior?.max ?? 0)).toBeGreaterThanOrEqual(3500);
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
