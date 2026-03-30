const mockExplanationPrompt = jest.fn().mockResolvedValue({ output: undefined });

jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => mockExplanationPrompt,
    defineFlow: (_config: unknown, handler: unknown) => handler,
  },
}));

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import type { GeneratePaintingEstimateInput } from '@/ai/flows/generate-painting-estimate';
import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';

describe('estimate flow pricing regressions', () => {
  test('apartment specific-area pricing increases when measured room sizes increase', async () => {
    const baseInput: GeneratePaintingEstimateInput = {
      name: 'Test User',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      approxSize: 85,
      interiorWallHeight: 2.7,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          approxRoomSize: 10,
          paintAreas: {
            ceilingPaint: true,
            wallPaint: true,
            trimPaint: false,
            ensuitePaint: false,
          },
        },
      ],
    };

    const smallRoom = await generatePaintingEstimate(baseInput);
    const largeRoom = await generatePaintingEstimate({
      ...baseInput,
      interiorRooms: [
        {
          ...baseInput.interiorRooms![0],
          approxRoomSize: 25,
        },
      ],
    });

    expect(smallRoom.breakdown?.interior?.min).toBeDefined();
    expect(largeRoom.breakdown?.interior?.min).toBeDefined();
    expect((largeRoom.breakdown?.interior?.min ?? 0)).toBeGreaterThan(
      smallRoom.breakdown?.interior?.min ?? 0
    );
    expect((largeRoom.breakdown?.interior?.max ?? 0)).toBeGreaterThan(
      smallRoom.breakdown?.interior?.max ?? 0
    );
  });

  test('front door only exterior trim stays on the standalone anchor range', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Exterior Trim'],
      exteriorTrimItems: ['Front Door'],
      exteriorFrontDoor: true,
    });

    expect(result.extMin).toBe(520);
    expect(result.extMax).toBe(880);
  });

  test('brick wall estimates stay above cladding for the same wall scope', () => {
    const commonInput = {
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      approxSize: 150,
      wallHeight: 2.7,
    };

    const cladding = calculateExteriorEstimate({
      ...commonInput,
      wallType: 'cladding',
    });
    const brick = calculateExteriorEstimate({
      ...commonInput,
      wallType: 'brick',
    });

    expect(brick.extMin).toBeGreaterThan(cladding.extMin);
    expect(brick.extMax).toBeGreaterThan(cladding.extMax);
  });

  test('deck-only pricing rises with worse timber condition', () => {
    const commonInput = {
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Deck'],
      deckArea: 30,
      deckServiceType: 'stain',
      deckProductType: 'oil',
    };

    const good = calculateExteriorEstimate({
      ...commonInput,
      deckCondition: 'good',
    });
    const damaged = calculateExteriorEstimate({
      ...commonInput,
      deckCondition: 'damaged',
    });

    expect(damaged.extMin).toBeGreaterThan(good.extMin);
    expect(damaged.extMax).toBeGreaterThan(good.extMax);
  });
});
