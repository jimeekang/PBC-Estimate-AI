import { estimateRequestSchema } from '../schemas/estimate-request';

const basePayload = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '0412 345 678',
  typeOfWork: ['Interior Painting'] as const,
  scopeOfPainting: 'Entire property' as const,
  propertyType: 'Apartment',
  apartmentStructure: '2Bed2Bath' as const,
  approxSize: 85,
  timingPurpose: 'Maintenance or refresh' as const,
  paintAreas: {
    ceilingPaint: true,
    wallPaint: true,
    trimPaint: false,
    ensuitePaint: false,
  },
};

describe('estimateRequestSchema', () => {
  test('requires approxSize whenever the field is shown for entire-property jobs', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      approxSize: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.approxSize?.[0]).toBe(
      'Enter the approximate size in sqm.'
    );
  });

  test('requires approxSize for exterior specific-area wall jobs', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      typeOfWork: ['Exterior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      exteriorAreas: ['Wall'],
      wallFinishes: ['brick'],
      houseStories: '1 storey',
      approxSize: undefined,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.approxSize?.[0]).toBe(
      'Enter the approximate size in sqm.'
    );
  });

  test('rejects entire-property interior jobs when only ensuitePaint is true', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: true,
      },
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.paintAreas?.[0]).toBe(
      'Please select at least one interior surface.'
    );
  });

  test('requires approxRoomSize for each selected room in specific-area interior jobs', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      scopeOfPainting: 'Specific areas only',
      apartmentStructure: undefined,
      typeOfWork: ['Interior Painting'],
      interiorWallHeight: 2.7,
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          paintAreas: {
            ceilingPaint: true,
            wallPaint: true,
            trimPaint: false,
            ensuitePaint: false,
          },
        },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['interiorRooms', 0, 'approxRoomSize'],
          message: 'Enter the approximate room size in sqm.',
        }),
      ])
    );
  });

  test('accepts valid Australian mobile and landline numbers', () => {
    expect(
      estimateRequestSchema.safeParse({
        ...basePayload,
        phone: '0412 345 678',
      }).success
    ).toBe(true);

    expect(
      estimateRequestSchema.safeParse({
        ...basePayload,
        phone: '+61 2 9876 5432',
      }).success
    ).toBe(true);
  });

  test('rejects non-Australian phone formats', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      phone: '010-1234-5678',
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.phone?.[0]).toBe(
      'Enter a valid Australian phone number.'
    );
  });
});
