jest.mock('@/ai/genkit', () => ({
  ai: {
    definePrompt: () => async () => ({ output: undefined }),
    defineFlow: (_config: unknown, fn: unknown) => fn,
  },
}));

import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';
import {
  generatePaintingEstimate,
  type GeneratePaintingEstimateInput,
} from '@/ai/flows/generate-painting-estimate';
import { estimateRequestSchema } from '@/schemas/estimate-request';

function exteriorSummary(input: Parameters<typeof calculateExteriorEstimate>[0]) {
  const result = calculateExteriorEstimate(input);
  return {
    actualMin: result.extMin,
    actualMax: result.extMax,
    rangeWidth: result.extMax - result.extMin,
  };
}

const baseExteriorFlowInput: GeneratePaintingEstimateInput = {
  name: 'Checklist User',
  email: 'checklist@example.com',
  phone: '0412 345 678',
  typeOfWork: ['Exterior Painting'],
  scopeOfPainting: 'Specific areas only',
  propertyType: 'House / Townhouse',
  houseStories: '1 storey',
  approxSize: 140,
  timingPurpose: 'Maintenance or refresh',
  paintCondition: 'Fair',
  exteriorAreas: ['Wall'],
  wallType: 'cladding',
  wallFinishes: ['cladding'],
  paintAreas: {
    ceilingPaint: false,
    wallPaint: false,
    trimPaint: false,
    ensuitePaint: false,
  },
};

const baseInteriorFlowInput: GeneratePaintingEstimateInput = {
  name: 'Checklist User',
  email: 'checklist@example.com',
  phone: '0412 345 678',
  typeOfWork: ['Interior Painting'],
  scopeOfPainting: 'Entire property',
  propertyType: 'House / Townhouse',
  houseStories: '1 storey',
  bedroomCount: 3,
  bathroomCount: 2,
  approxSize: 140,
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
    trimItems: ['Doors'],
    interiorDoorTypes: ['flush'],
  },
};

describe('Checklist remaining regressions', () => {
  test('A.4 remaining exterior matrix prints actual ranges', () => {
    const cases = [
      {
        id: 'EX8',
        expected: 'Full exterior rendered poor @ 180sqm / 2 storey',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Poor',
          houseStories: '2 storey',
          exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
          wallType: 'rendered',
          approxSize: 180,
        }),
      },
      {
        id: 'EX9',
        expected: 'Full exterior brick poor + difficult access @ 230sqm / 3 storey',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Poor',
          houseStories: '3 storey',
          exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
          wallType: 'brick',
          approxSize: 230,
          jobDifficulty: ['Difficult access areas'],
        }),
      },
      {
        id: 'EXT1',
        expected: 'Exterior Trim + Simple doors x2',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Exterior Trim'],
          exteriorTrimItems: ['Doors'],
          exteriorDoors: [{ style: 'Simple', quantity: 2 }],
        }),
      },
      {
        id: 'EXT2',
        expected: 'Exterior Trim + Complex doors x4 + French windows x6',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Exterior Trim'],
          exteriorTrimItems: ['Doors', 'Window Frames'],
          exteriorDoors: [{ style: 'Complex', quantity: 4 }],
          exteriorWindows: [{ type: 'French', quantity: 6 }],
        }),
      },
      {
        id: 'EXT3',
        expected: 'Exterior Trim + Standard architraves x8',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Exterior Trim'],
          exteriorTrimItems: ['Architraves'],
          exteriorArchitraves: [{ style: 'Standard', quantity: 8 }],
        }),
      },
      {
        id: 'EXT4',
        expected: 'Front door only',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Exterior Trim'],
          exteriorTrimItems: ['Front Door'],
          exteriorFrontDoor: true,
        }),
      },
      {
        id: 'EXT5',
        expected: 'Front door + doors + windows',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Exterior Trim'],
          exteriorTrimItems: ['Front Door', 'Doors', 'Window Frames'],
          exteriorFrontDoor: true,
          exteriorDoors: [{ style: 'Standard', quantity: 2 }],
          exteriorWindows: [{ type: 'Normal', quantity: 4 }],
        }),
      },
      {
        id: 'EXR2',
        expected: 'Roof only @ 140sqm / 2 storey',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '2 storey',
          exteriorAreas: ['Roof'],
          approxSize: 140,
        }),
      },
      {
        id: 'EXR4',
        expected: 'Wall + Roof @ 200sqm / 2 storey',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '2 storey',
          exteriorAreas: ['Wall', 'Roof'],
          wallType: 'cladding',
          approxSize: 200,
        }),
      },
      {
        id: 'EXD1',
        expected: 'Deck only 20sqm stain-oil good, min >= 600',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Deck'],
          deckArea: 20,
          deckServiceType: 'stain',
          deckProductType: 'oil',
          deckCondition: 'good',
        }),
      },
      {
        id: 'EXD2',
        expected: 'Deck only 50sqm paint-conversion damaged',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Deck'],
          deckArea: 50,
          deckServiceType: 'paint-conversion',
          deckCondition: 'damaged',
        }),
      },
      {
        id: 'EXD3',
        expected: 'Deck only 200sqm stain-water weathered, checklist expected ceiling hit',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Deck'],
          deckArea: 200,
          deckServiceType: 'stain',
          deckProductType: 'water',
          deckCondition: 'weathered',
        }),
      },
      {
        id: 'EXD4',
        expected: 'Wall + Deck combination',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Wall', 'Deck'],
          wallType: 'cladding',
          approxSize: 140,
          deckArea: 30,
          deckServiceType: 'stain',
          deckProductType: 'oil',
          deckCondition: 'good',
        }),
      },
      {
        id: 'EXP1',
        expected: 'Paving only 30sqm good, min >= 950',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Paving'],
          pavingArea: 30,
          pavingCondition: 'good',
        }),
      },
      {
        id: 'EXP2',
        expected: 'Paving only 150sqm poor, min ~= 4,785',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Fair',
          houseStories: '1 storey',
          exteriorAreas: ['Paving'],
          pavingArea: 150,
          pavingCondition: 'poor',
        }),
      },
      {
        id: 'EXP3',
        expected: 'Wall + Deck + Paving + Roof @ 2 storey / Poor',
        ...exteriorSummary({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Poor',
          houseStories: '2 storey',
          exteriorAreas: ['Wall', 'Deck', 'Paving', 'Roof'],
          wallType: 'cladding',
          approxSize: 200,
          deckArea: 40,
          deckServiceType: 'stain',
          deckProductType: 'oil',
          deckCondition: 'weathered',
          pavingArea: 60,
          pavingCondition: 'poor',
        }),
      },
    ];

    // eslint-disable-next-line no-console
    console.log('\n=== A.4 REMAINING EXTERIOR RESULTS ===');
    // eslint-disable-next-line no-console
    console.table(cases);

    expect(cases).toHaveLength(16);
    expect(cases.find((item) => item.id === 'EXD1')?.actualMin).toBeGreaterThanOrEqual(600);
    expect(cases.find((item) => item.id === 'EXP1')?.actualMin).toBeGreaterThanOrEqual(950);
    expect(cases.find((item) => item.id === 'EXP2')?.actualMin).toBe(4785);
  });

  test('A.4 EXE7 verifies Etc exterior area pricing fallback risk', async () => {
    const result = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      exteriorAreas: ['Etc'],
      otherExteriorArea: 'Garden shed fascia and service duct enclosure',
    });

    const summary = {
      id: 'EXE7',
      expected: 'Custom exterior area should not silently fall back to generic minimum',
      actualMin: result.breakdown?.exterior?.min ?? -1,
      actualMax: result.breakdown?.exterior?.max ?? -1,
      totalPriceRange: result.priceRange,
      priceRange: result.breakdown?.exterior?.priceRange,
      details: result.details,
    };

    // eslint-disable-next-line no-console
    console.log('\n=== A.4 EXE7 CUSTOM EXTERIOR AREA ===');
    // eslint-disable-next-line no-console
    console.table([summary]);

    expect(summary.actualMin).toBe(330);
    expect(summary.actualMax).toBe(1330);
    expect(summary.priceRange).toBe('From AUD 330+ (Custom Scope - Site Inspection Required)');
    expect(summary.totalPriceRange).toBe('From AUD 330+ (Custom Scope - Site Inspection Required)');
    expect(summary.details).toEqual(
      expect.arrayContaining([
        'Custom exterior area selected (Garden shed fascia and service duct enclosure) - site inspection required for final pricing.',
      ])
    );
  });

  test('A.5 modifier matrix and A.7 output formatting print actual results', async () => {
    const excellent = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      paintCondition: 'Excellent',
    });
    const fair = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      paintCondition: 'Fair',
    });
    const poor = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      paintCondition: 'Poor',
    });
    const storey1 = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '1 storey',
    });
    const storey2 = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '2 storey',
    });
    const storey3 = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '3 storey',
    });
    const flat = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      ceilingType: 'Flat',
    });
    const decorative = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      ceilingType: 'Decorative',
    });
    const stairsOnly = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '2 storey',
      jobDifficulty: ['Stairs'],
    });
    const highOnly = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '2 storey',
      jobDifficulty: ['High ceilings'],
    });
    const mouldingsOnly = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      jobDifficulty: ['Extensive mouldings or trims'],
    });
    const difficultOnly = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      jobDifficulty: ['Difficult access areas'],
    });
    const combinedDifficulty = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      houseStories: '2 storey',
      jobDifficulty: ['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'],
    });
    const timingMaintenance = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      timingPurpose: 'Maintenance or refresh',
    });
    const timingSale = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      timingPurpose: 'Preparing for sale or rental',
    });
    const trimOil = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });
    const trimWater = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });
    const op2Cap = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      typeOfWork: ['Interior Painting', 'Exterior Painting'],
      scopeOfPainting: 'Entire property',
      propertyType: 'House / Townhouse',
      houseStories: '3 storey',
      bedroomCount: 5,
      bathroomCount: 3,
      approxSize: 230,
      paintCondition: 'Poor',
      wallType: 'brick',
      wallFinishes: ['brick'],
      exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim', 'Roof', 'Deck', 'Paving'],
      deckArea: 200,
      deckServiceType: 'paint-conversion',
      deckCondition: 'damaged',
      pavingArea: 150,
      pavingCondition: 'poor',
      paintAreas: {
        ceilingPaint: true,
        wallPaint: true,
        trimPaint: true,
        ensuitePaint: true,
      },
      trimPaintOptions: {
        paintType: 'Water-based',
        trimItems: ['Doors', 'Window Frames', 'Skirting Boards'],
        interiorDoorTypes: ['flush', 'bi_folding'],
        interiorWindowFrameTypes: ['French'],
      },
      jobDifficulty: ['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'],
      ceilingType: 'Decorative',
    });
    const bothBreakdown = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      typeOfWork: ['Interior Painting', 'Exterior Painting'],
      scopeOfPainting: 'Entire property',
      propertyType: 'House / Townhouse',
      bedroomCount: 3,
      bathroomCount: 2,
      houseStories: '1 storey',
      approxSize: 140,
      wallType: 'cladding',
      wallFinishes: ['cladding'],
      exteriorAreas: ['Wall', 'Eaves'],
      paintAreas: {
        ceilingPaint: true,
        wallPaint: true,
        trimPaint: true,
        ensuitePaint: false,
      },
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Doors'],
        interiorDoorTypes: ['flush'],
      },
    });
    const trimNote = await generatePaintingEstimate({
      ...baseInteriorFlowInput,
    });
    const frontDoorNote = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      exteriorAreas: ['Exterior Trim'],
      exteriorTrimItems: ['Front Door'],
      exteriorFrontDoor: true,
    });
    const deckDetails = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      exteriorAreas: ['Deck'],
      deckArea: 30,
      deckServiceType: 'stain',
      deckProductType: 'oil',
      deckCondition: 'good',
    });
    const pavingDetails = await generatePaintingEstimate({
      ...baseExteriorFlowInput,
      exteriorAreas: ['Paving'],
      pavingArea: 30,
      pavingCondition: 'good',
    });
    const itemized = await generatePaintingEstimate({
      name: 'Checklist User',
      email: 'checklist@example.com',
      phone: '0412 345 678',
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      approxSize: 85,
      apartmentStructure: '2Bed2Bath',
      specificInteriorTrimOnly: true,
      timingPurpose: 'Maintenance or refresh',
      paintCondition: 'Fair',
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
        { doorType: 'flush', scope: 'Door & Frame', system: 'oil_2coat', quantity: 2 },
      ],
      interiorRooms: [],
    });

    const rows = [
      {
        id: 'MX1',
        expected: 'Excellent <= Fair <= Poor',
        actual: `E:${excellent.breakdown?.interior?.min}-${excellent.breakdown?.interior?.max} F:${fair.breakdown?.interior?.min}-${fair.breakdown?.interior?.max} P:${poor.breakdown?.interior?.min}-${poor.breakdown?.interior?.max}`,
      },
      {
        id: 'MX2',
        expected: '1 <= 2 <= 3 storey',
        actual: `1:${storey1.breakdown?.interior?.min}-${storey1.breakdown?.interior?.max} 2:${storey2.breakdown?.interior?.min}-${storey2.breakdown?.interior?.max} 3:${storey3.breakdown?.interior?.min}-${storey3.breakdown?.interior?.max}`,
      },
      {
        id: 'MX3',
        expected: 'Decorative ceiling adds ~10%',
        actual: `Flat:${flat.breakdown?.interior?.min}-${flat.breakdown?.interior?.max} Decorative:${decorative.breakdown?.interior?.min}-${decorative.breakdown?.interior?.max}`,
      },
      {
        id: 'MX4',
        expected: 'Individual and combined difficulty uplifts remain monotonic',
        actual: `stairs:${stairsOnly.breakdown?.interior?.min}-${stairsOnly.breakdown?.interior?.max} high:${highOnly.breakdown?.interior?.min}-${highOnly.breakdown?.interior?.max} mouldings:${mouldingsOnly.breakdown?.interior?.min}-${mouldingsOnly.breakdown?.interior?.max} difficult:${difficultOnly.breakdown?.interior?.min}-${difficultOnly.breakdown?.interior?.max} combo:${combinedDifficulty.breakdown?.interior?.min}-${combinedDifficulty.breakdown?.interior?.max}`,
      },
      {
        id: 'MX5',
        expected: 'timingPurpose does not change price',
        actual: `maint:${timingMaintenance.breakdown?.interior?.priceRange} sale:${timingSale.breakdown?.interior?.priceRange}`,
      },
      {
        id: 'MX7',
        expected: 'Water-based trim >= AUD 3,500 above Oil-based trim',
        actual: `oil:${trimOil.breakdown?.interior?.priceRange} water:${trimWater.breakdown?.interior?.priceRange}`,
      },
      {
        id: 'OP1',
        expected: 'priceRange format AUD X - Y',
        actual: fair.priceRange,
      },
      {
        id: 'OP2',
        expected: 'Cap string From AUD 35,000+ (Site Inspection Required)',
        actual: op2Cap.priceRange,
      },
      {
        id: 'OP3',
        expected: 'Interior/exterior/total breakdown all present',
        actual: `interior:${!!bothBreakdown.breakdown?.interior} exterior:${!!bothBreakdown.breakdown?.exterior} total:${!!bothBreakdown.breakdown?.total}`,
      },
      {
        id: 'OP4',
        expected: 'Trim note appended when trim items selected',
        actual: trimNote.details?.find((detail) => detail.includes('Pricing varies depending on the number of trim items included.')) ?? 'missing',
      },
      {
        id: 'OP5',
        expected: 'Front door note appended when front door selected',
        actual: frontDoorNote.details?.find((detail) => detail.includes('Front door pricing can vary')) ?? 'missing',
      },
      {
        id: 'OP6',
        expected: 'Deck detail line present',
        actual: deckDetails.details?.find((detail) => detail.includes('Deck (')) ?? 'missing',
      },
      {
        id: 'OP7',
        expected: 'Paving detail line present',
        actual: pavingDetails.details?.find((detail) => detail.includes('Paving (')) ?? 'missing',
      },
      {
        id: 'OP8',
        expected: 'Itemized mode uses AUD X + GST',
        actual: itemized.priceRange,
      },
    ];

    // eslint-disable-next-line no-console
    console.log('\n=== A.5 / A.7 MODIFIER & OUTPUT RESULTS ===');
    // eslint-disable-next-line no-console
    console.table(rows);

    expect((excellent.breakdown?.interior?.min ?? 0)).toBeLessThanOrEqual(fair.breakdown?.interior?.min ?? 0);
    expect((fair.breakdown?.interior?.min ?? 0)).toBeLessThanOrEqual(poor.breakdown?.interior?.min ?? 0);
    expect((mouldingsOnly.breakdown?.interior?.min ?? 0)).toBeGreaterThan(fair.breakdown?.interior?.min ?? 0);
    expect((difficultOnly.breakdown?.interior?.min ?? 0)).toBeGreaterThan(fair.breakdown?.interior?.min ?? 0);
    expect((trimWater.breakdown?.interior?.min ?? 0) - (trimOil.breakdown?.interior?.min ?? 0)).toBeGreaterThanOrEqual(3500);
    expect((trimWater.breakdown?.interior?.max ?? 0) - (trimOil.breakdown?.interior?.max ?? 0)).toBeGreaterThanOrEqual(3500);
    expect(op2Cap.priceRange).toBe('From AUD 35,000+ (Site Inspection Required)');
    expect(itemized.priceRange).toMatch(/^AUD [\d,]+ \+ GST$/);
    expect(deckDetails.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Deck \(30 sqm\) - /)])
    );
    expect(pavingDetails.details).toEqual(
      expect.arrayContaining([expect.stringMatching(/^Paving \(30 sqm\) - /)])
    );
  });

  test('A.6 remaining schema cases print validation outcomes', () => {
    const v4 = estimateRequestSchema.safeParse({
      ...baseExteriorFlowInput,
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      apartmentStructure: '2Bed2Bath',
      interiorWallHeight: 2.7,
      interiorRooms: [
        {
          roomName: 'Bedroom 1',
          approxRoomSize: 0,
          paintAreas: {
            ceilingPaint: true,
            wallPaint: true,
            trimPaint: false,
            ensuitePaint: false,
          },
        },
      ],
    });

    const v5 = estimateRequestSchema.safeParse({
      ...baseExteriorFlowInput,
      typeOfWork: ['Interior Painting'],
      scopeOfPainting: 'Specific areas only',
      propertyType: 'Apartment',
      apartmentStructure: '2Bed2Bath',
      specificInteriorTrimOnly: true,
      trimPaintOptions: {
        paintType: 'Oil-based',
        trimItems: ['Skirting Boards'],
      },
      interiorRooms: [],
      paintAreas: {
        ceilingPaint: false,
        wallPaint: false,
        trimPaint: false,
        ensuitePaint: false,
      },
    });

    const v7 = estimateRequestSchema.safeParse({
      ...baseExteriorFlowInput,
      typeOfWork: ['Exterior Painting'],
      exteriorAreas: ['Wall'],
      wallType: 'stone-render' as never,
      wallFinishes: ['stone-render' as never],
    });

    const rows = [
      {
        id: 'V4',
        expected: 'approxRoomSize <= 0 rejects',
        actual: v4.success
          ? 'passed unexpectedly'
          : v4.error.issues.find((issue) => issue.path.join('.') === 'interiorRooms.0.approxRoomSize')?.message,
      },
      {
        id: 'V5',
        expected: 'Skirting Boards without linear metres/rooms rejects',
        actual: v5.success
          ? 'passed unexpectedly'
          : v5.error.flatten().fieldErrors.skirtingLinearMetres?.[0],
      },
      {
        id: 'V7',
        expected: 'Unknown wall type rejects',
        actual: v7.success
          ? 'passed unexpectedly'
          : v7.error.issues.find((issue) => issue.path.join('.') === 'wallType' || issue.path.join('.') === 'wallFinishes.0')?.message,
      },
    ];

    // eslint-disable-next-line no-console
    console.log('\n=== A.6 REMAINING SCHEMA RESULTS ===');
    // eslint-disable-next-line no-console
    console.table(rows);

    expect(v4.success).toBe(false);
    expect(v5.success).toBe(false);
    expect(v7.success).toBe(false);
  });
});
