jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: jest.fn(() => jest.fn()),
    defineFlow: jest.fn((_config, fn) => fn),
  },
}));

import { isInteriorTrimItemOnly } from '@/lib/estimate-flow-logic';
import type { InteriorTrimItemOnlyInput } from '@/lib/estimate-flow-logic';

describe('isInteriorTrimItemOnly', () => {
  test('returns true for trim-only door or window jobs with no rooms attached', () => {
    expect(
      isInteriorTrimItemOnly({
        typeOfWork: ['Interior Painting'],
        scopeOfPainting: 'Specific areas only',
        specificInteriorTrimOnly: true,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Doors'],
        },
        interiorDoorItems: [{ doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 }],
        interiorRooms: [],
      } satisfies InteriorTrimItemOnlyInput)
    ).toBe(true);
  });

  test('returns false when skirting is included because it needs range pricing', () => {
    expect(
      isInteriorTrimItemOnly({
        typeOfWork: ['Interior Painting'],
        scopeOfPainting: 'Specific areas only',
        specificInteriorTrimOnly: true,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Doors', 'Skirting Boards'],
        },
        interiorDoorItems: [{ doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 }],
        interiorRooms: [],
      } satisfies InteriorTrimItemOnlyInput)
    ).toBe(false);
  });

  test('returns false when room-based trim work is present', () => {
    expect(
      isInteriorTrimItemOnly({
        typeOfWork: ['Interior Painting'],
        scopeOfPainting: 'Specific areas only',
        specificInteriorTrimOnly: false,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Doors'],
        },
        interiorDoorItems: [{ doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 }],
        interiorRooms: [
          {
            roomName: 'Bedroom 1',
            paintAreas: {
              ceilingPaint: false,
              wallPaint: false,
              trimPaint: true,
              ensuitePaint: false,
            },
          },
        ],
      } satisfies InteriorTrimItemOnlyInput)
    ).toBe(false);
  });

  test('returns false when a handrail room is present because it has separate pricing', () => {
    expect(
      isInteriorTrimItemOnly({
        typeOfWork: ['Interior Painting'],
        scopeOfPainting: 'Specific areas only',
        specificInteriorTrimOnly: true,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Window Frames'],
        },
        interiorWindowItems: [
          { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 1 },
        ],
        interiorRooms: [
          {
            roomName: 'Handrail',
            paintAreas: {
              ceilingPaint: false,
              wallPaint: false,
              trimPaint: false,
              ensuitePaint: false,
            },
          },
        ],
      } satisfies InteriorTrimItemOnlyInput)
    ).toBe(false);
  });
});
