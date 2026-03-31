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
  beforeEach(() => {
    mockExplanationPrompt.mockClear();
  });

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

  test('specific-area interior doors price higher for premium door types', async () => {
    const baseInput: GeneratePaintingEstimateInput = {
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
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 1 },
      ],
    };

    const flush = await generatePaintingEstimate(baseInput);
    const bifold = await generatePaintingEstimate({
      ...baseInput,
      interiorDoorItems: [
        { doorType: 'bi_folding', scope: 'Door & Frame', system: 'oil_2coat', quantity: 1 },
      ],
    });

    expect((bifold.pricingMeta?.subtotalExGst ?? 0)).toBeGreaterThan(flush.pricingMeta?.subtotalExGst ?? 0);
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

  test('wall-only pricing stays tighter for cladding, rendered, and brick at 150sqm', () => {
    const commonInput = {
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      approxSize: 150,
      wallHeight: 2.7,
    };

    const cladding = calculateExteriorEstimate({ ...commonInput, wallType: 'cladding' });
    const rendered = calculateExteriorEstimate({ ...commonInput, wallType: 'rendered' });
    const brick = calculateExteriorEstimate({ ...commonInput, wallType: 'brick' });

    expect(cladding.extMax).toBeLessThan(4500);
    expect(rendered.extMax).toBeLessThan(5400);
    expect(brick.extMax).toBeLessThan(6200);
    expect(rendered.extMin).toBeGreaterThan(cladding.extMin);
    expect(brick.extMin).toBeGreaterThan(rendered.extMin);
  });

  test('cladding wall explanations use a 2-coat system instead of the old generic 3-coat note', async () => {
    await generatePaintingEstimate({
      name: 'Exterior Test',
      email: 'test@example.com',
      typeOfWork: ['Exterior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      approxSize: 150,
      wallHeight: 2.7,
      wallType: 'cladding',
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
    });

    expect(mockExplanationPrompt).toHaveBeenCalled();
    const promptInput = mockExplanationPrompt.mock.calls.at(-1)?.[0];
    expect(promptInput?.wallTypeCoatSystem).toContain('2-coat');
    expect(promptInput?.wallTypeCoatSystem).not.toContain('3-coat');
  });

  test('single-room specific-area pricing better reflects small wet and utility rooms', async () => {
    const baseInput: GeneratePaintingEstimateInput = {
      name: 'Specific Room Test',
      email: 'test@example.com',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      houseStories: '1 storey',
      bedroomCount: 3,
      bathroomCount: 2,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
      interiorRooms: [],
    };

    const buildRoom = async (roomName: string) =>
      generatePaintingEstimate({
        ...baseInput,
        interiorRooms: [
          {
            roomName,
            paintAreas: {
              ceilingPaint: true,
              wallPaint: true,
              trimPaint: false,
              ensuitePaint: false,
            },
          },
        ],
      });

    const laundry = await buildRoom('Laundry');
    const study = await buildRoom('Study / Office');
    const bathroom = await buildRoom('Bathroom');
    const stairwell = await buildRoom('Stairwell');
    const living = await buildRoom('Living Room');

    expect((laundry.breakdown?.interior?.min ?? 0)).toBeLessThan(study.breakdown?.interior?.min ?? 0);
    expect((study.breakdown?.interior?.min ?? 0)).toBeLessThan(bathroom.breakdown?.interior?.min ?? 0);
    expect((stairwell.breakdown?.interior?.max ?? 0)).toBeLessThan(living.breakdown?.interior?.max ?? 0);
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
