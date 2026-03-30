import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';

describe('calculateExteriorEstimate', () => {
  test('ignores stale exterior trim quantities unless Exterior Trim is selected', () => {
    const baseInput = {
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall', 'Eaves'],
      wallType: 'brick',
      approxSize: 150,
      wallHeight: 2.7,
      jobDifficulty: [],
    };

    const withoutTrim = calculateExteriorEstimate(baseInput);
    const withStaleTrim = calculateExteriorEstimate({
      ...baseInput,
      exteriorTrimItems: ['Doors', 'Front Door'],
      exteriorFrontDoor: true,
      exteriorDoors: [{ style: 'Complex', quantity: 2 }],
      exteriorWindows: [{ type: 'French', quantity: 3 }],
      exteriorArchitraves: [{ style: 'Complex', quantity: 6 }],
    });

    expect(withStaleTrim.extMin).toBe(withoutTrim.extMin);
    expect(withStaleTrim.extMax).toBe(withoutTrim.extMax);
  });
});
