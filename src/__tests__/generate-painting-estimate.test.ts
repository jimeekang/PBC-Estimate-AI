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
    expect(result.breakdown?.interior?.max).toBe(11800);
    expect(result.breakdown?.total?.min).toBe(10000);
    expect(result.breakdown?.total?.max).toBe(11800);
  });
});
