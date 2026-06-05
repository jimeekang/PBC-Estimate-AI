import { normalizeEstimateRequest } from '@/lib/normalize-estimate-request';
import type { EstimateRequest } from '@/schemas/estimate-request';

const baseRequest = (overrides: Partial<EstimateRequest> = {}): EstimateRequest => ({
  name: 'Test User',
  email: 'test@example.com',
  phone: '0412 345 678',
  typeOfWork: ['Interior Painting', 'Exterior Painting'],
  scopeOfPainting: 'Entire property',
  propertyType: 'House / Townhouse',
  houseStories: '2 storey',
  bedroomCount: 3,
  bathroomCount: 2,
  roomsToPaint: ['Living Room'],
  interiorRooms: [],
  specificInteriorTrimOnly: false,
  exteriorAreas: ['Wall'],
  wallType: 'cladding',
  wallFinishes: ['cladding'],
  wallHeight: 2.7,
  approxSize: 150,
  interiorWallHeight: 2.4,
  location: 'Manly NSW',
  timingPurpose: 'Maintenance or refresh',
  paintCondition: 'Fair',
  jobDifficulty: [],
  paintAreas: {
    ceilingPaint: true,
    wallPaint: true,
    trimPaint: true,
    ensuitePaint: false,
  },
  trimPaintOptions: {
    paintType: 'Oil-based',
    trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
    interiorDoorTypes: ['flush'],
    interiorWindowFrameTypes: ['Normal'],
  },
  skirtingPricingMode: 'linear_metres',
  skirtingLinearMetres: 30,
  skirtingCalculatorRooms: [{ label: 'Living', length: 5, width: 4 }],
  ceilingOptions: { ceilingType: 'Flat' },
  ceilingType: 'Flat',
  interiorDoorItems: [{ doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 }],
  interiorWindowItems: [{ type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 3 }],
  exteriorTrimItems: ['Doors', 'Window Frames', 'Architraves', 'Front Door'],
  exteriorFrontDoor: true,
  exteriorDoors: [{ style: 'Standard', quantity: 2 }],
  exteriorWindows: [{ type: 'Normal', quantity: 5 }],
  exteriorArchitraves: [{ style: 'Simple', quantity: 4 }],
  deckArea: 20,
  deckServiceType: 'stain',
  deckProductType: 'oil',
  deckCondition: 'weathered',
  pavingArea: 15,
  pavingCondition: 'fair',
  otherExteriorArea: 'Fence',
  otherInteriorArea: 'Pantry',
  apartmentStructure: '2Bed2Bath',
  ...overrides,
});

describe('normalizeEstimateRequest', () => {
  it('removes exterior-only fields when exterior painting is not selected', () => {
    const result = normalizeEstimateRequest(baseRequest({ typeOfWork: ['Interior Painting'] }));

    expect(result.exteriorAreas).toBeUndefined();
    expect(result.wallType).toBeUndefined();
    expect(result.wallFinishes).toBeUndefined();
    expect(result.wallHeight).toBeUndefined();
    expect(result.exteriorTrimItems).toBeUndefined();
    expect(result.exteriorDoors).toBeUndefined();
    expect(result.deckArea).toBeUndefined();
    expect(result.pavingArea).toBeUndefined();
    expect(result.otherExteriorArea).toBeUndefined();
    expect(result.houseStories).toBe('2 storey');
    expect(result.roomsToPaint).toEqual(['Living Room']);
  });

  it('removes interior-only fields when interior painting is not selected', () => {
    const result = normalizeEstimateRequest(baseRequest({ typeOfWork: ['Exterior Painting'] }));

    expect(result.roomsToPaint).toBeUndefined();
    expect(result.interiorRooms).toBeUndefined();
    expect(result.specificInteriorTrimOnly).toBeUndefined();
    expect(result.trimPaintOptions).toBeUndefined();
    expect(result.skirtingLinearMetres).toBeUndefined();
    expect(result.interiorDoorItems).toBeUndefined();
    expect(result.interiorWindowItems).toBeUndefined();
    expect(result.paintAreas).toBeUndefined();
    expect(result.ceilingOptions).toBeUndefined();
    expect(result.ceilingType).toBeUndefined();
    expect(result.exteriorAreas).toEqual(['Wall']);
  });

  it('clears global paintAreas for specific-area scope and preserves room paintAreas and trim item data', () => {
    const result = normalizeEstimateRequest(
      baseRequest({
        typeOfWork: ['Interior Painting'],
        scopeOfPainting: 'Specific areas only',
        interiorRooms: [
          {
            roomName: 'Living Room',
            approxRoomSize: 20,
            paintAreas: {
              ceilingPaint: false,
              wallPaint: true,
              trimPaint: true,
              ensuitePaint: false,
            },
          },
        ],
      })
    );

    expect(result.paintAreas).toEqual({
      ceilingPaint: false,
      wallPaint: false,
      trimPaint: false,
      ensuitePaint: false,
    });
    expect(result.interiorRooms?.[0]?.paintAreas).toEqual({
      ceilingPaint: false,
      wallPaint: true,
      trimPaint: true,
      ensuitePaint: false,
    });
    expect(result.trimPaintOptions?.trimItems).toEqual(['Doors', 'Window Frames', 'Skirting Boards']);
    expect(result.interiorDoorItems).toHaveLength(1);
  });

  it('removes apartment-only stale fields when property type is not apartment', () => {
    const result = normalizeEstimateRequest(
      baseRequest({
        propertyType: 'House / Townhouse',
        apartmentStructure: '3Bed2Bath',
        approxSize: 110,
      })
    );

    expect(result.apartmentStructure).toBeUndefined();
    expect(result.approxSize).toBe(110);
  });
});
