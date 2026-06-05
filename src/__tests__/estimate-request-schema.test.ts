import { estimateRequestSchema, estimateSubmissionSchema } from '../schemas/estimate-request';

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

  test('rejects multiple exterior wall finishes because pricing expects one dominant finish', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      typeOfWork: ['Exterior Painting'],
      propertyType: 'House / Townhouse',
      exteriorAreas: ['Wall'],
      wallFinishes: ['brick', 'rendered'],
      houseStories: '1 storey',
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.wallFinishes?.[0]).toBe(
      'Select one main wall finish.'
    );
  });

  test('requires a wallType when exterior Wall scope is selected', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      typeOfWork: ['Exterior Painting'],
      propertyType: 'House / Townhouse',
      exteriorAreas: ['Wall'],
      wallFinishes: ['brick'],
      houseStories: '1 storey',
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.wallType?.[0]).toBe(
      'Please select the main exterior wall finish.'
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

  test('requires at least one Exterior Trim detail item when Exterior Trim is selected', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      typeOfWork: ['Exterior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'House / Townhouse',
      exteriorAreas: ['Exterior Trim'],
      houseStories: '1 storey',
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.exteriorTrimItems?.[0]).toBe(
      'Please select at least one exterior trim item.'
    );
  });

  test('accepts entire-property interior jobs when only ensuitePaint is true', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: true,
      },
    });

    expect(result.success).toBe(true);
  });

  test('rejects interior door details with zero quantity', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      scopeOfPainting: 'Specific areas only',
      specificInteriorTrimOnly: true,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
      },
      interiorDoorItems: [
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 0 },
      ],
      interiorRooms: [],
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['interiorDoorItems', 0, 'quantity'],
        }),
      ])
    );
  });

  test('requires trim quantities for entire-property interior trim pricing', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
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
      interiorDoorItems: [],
      interiorWindowItems: [],
      skirtingPricingMode: 'linear_metres',
      skirtingLinearMetres: undefined,
    });

    expect(result.success).toBe(false);
    expect(result.success ? [] : result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['interiorDoorItems'] }),
        expect.objectContaining({ path: ['interiorWindowItems'] }),
        expect.objectContaining({ path: ['skirtingLinearMetres'] }),
      ])
    );
  });

  test('accepts entire-property interior trim with door, window, and skirting quantities', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
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

    expect(result.success).toBe(true);
  });

  test('rejects apartment specific-area interior jobs until apartment room policy is defined', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      scopeOfPainting: 'Specific areas only',
      interiorWallHeight: 2.7,
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          approxRoomSize: 12,
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
    expect(result.success ? '' : result.error.flatten().fieldErrors.scopeOfPainting?.[0]).toBe(
      'Apartment specific-area interior estimates are not available yet. Please choose Entire property.'
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

  test('rejects specific-area interior jobs with no billable room or trim item', () => {
    const result = estimateRequestSchema.safeParse({
      ...basePayload,
      propertyType: 'House / Townhouse',
      scopeOfPainting: 'Specific areas only',
      apartmentStructure: undefined,
      approxSize: undefined,
      bedroomCount: undefined,
      bathroomCount: undefined,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
      interiorRooms: [],
      specificInteriorTrimOnly: false,
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.interiorRooms?.[0]).toBe(
      'Select at least one interior room, handrail, door, window, or skirting item.'
    );
  });

  test('accepts valid trim-only door, window, and skirting specific-area interior jobs', () => {
    const trimOnlyBase = {
      ...basePayload,
      propertyType: 'House / Townhouse',
      scopeOfPainting: 'Specific areas only' as const,
      apartmentStructure: undefined,
      approxSize: undefined,
      bedroomCount: undefined,
      bathroomCount: undefined,
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
      interiorRooms: [],
      specificInteriorTrimOnly: true,
    };

    expect(
      estimateRequestSchema.safeParse({
        ...trimOnlyBase,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Doors'],
        },
        interiorDoorItems: [
          { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 1 },
        ],
      }).success
    ).toBe(true);

    expect(
      estimateRequestSchema.safeParse({
        ...trimOnlyBase,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Window Frames'],
        },
        interiorWindowItems: [
          { type: 'Normal', scope: 'Window & Frame', system: 'oil_2coat', quantity: 1 },
        ],
      }).success
    ).toBe(true);

    expect(
      estimateRequestSchema.safeParse({
        ...trimOnlyBase,
        trimPaintOptions: {
          paintType: 'Oil-based',
          trimItems: ['Skirting Boards'],
        },
        skirtingPricingMode: 'linear_metres',
        skirtingLinearMetres: 12,
      }).success
    ).toBe(true);
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

describe('estimateSubmissionSchema', () => {
  test('trims optional estimateId when present', () => {
    const result = estimateSubmissionSchema.safeParse({
      idToken: 'token',
      estimateId: '  estimate-123  ',
      formData: basePayload,
    });

    expect(result.success).toBe(true);
    expect(result.success ? result.data.estimateId : '').toBe('estimate-123');
  });

  test('rejects blank estimateId values', () => {
    const result = estimateSubmissionSchema.safeParse({
      idToken: 'token',
      estimateId: '   ',
      formData: basePayload,
    });

    expect(result.success).toBe(false);
    expect(result.success ? '' : result.error.flatten().fieldErrors.estimateId?.[0]).toBe(
      'Estimate ID is required when provided.'
    );
  });
});
