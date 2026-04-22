import { calculateExteriorEstimate } from '@/ai/flows/generate-painting-estimate.exterior';
import {
  EXTERIOR_FULL_PROJECT_CEILING,
  EXTERIOR_WALL_TYPE_FLOORS,
  MAX_PRICE_CAP,
  STORY_MODIFIER,
} from '@/lib/pricing-engine';

describe('calculateExteriorEstimate', () => {
  // ── Stale data isolation ─────────────────────────────────────────────────────

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

  // ── Front door only ──────────────────────────────────────────────────────────

  test('front door only exterior trim — exact anchor range', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Exterior Trim'],
      exteriorTrimItems: ['Front Door'],
      exteriorFrontDoor: true,
    });

    // Structural total is 0, so condition mult does not inflate.
    // Front door anchor (520–880) added outside condition; cap gap ≤ 800.
    expect(result.extMin).toBe(520);
    expect(result.extMax).toBe(880);
  });

  // ── Independent item pricing (no wall) ──────────────────────────────────────

  test('Eaves-only single storey — priced from standalone anchor, not wall-derived', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Excellent',
      houseStories: '1 storey',
      exteriorAreas: ['Eaves'],
      jobDifficulty: [],
    });

    // Excellent condition → multiplier 1.0–1.08
    // Eaves single anchor: 1200–3500; after condition: 1200–3780
    // capRangeWidthSmart cap=800 → extMin≥1200, extMax≥extMin
    expect(result.extMin).toBeGreaterThanOrEqual(1200);
    expect(result.extMax).toBeGreaterThan(result.extMin);
  });

  test('Roof-only single storey — minimum $3500', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Excellent',
      houseStories: '1 storey',
      exteriorAreas: ['Roof'],
      jobDifficulty: [],
    });

    expect(result.extMin).toBeGreaterThanOrEqual(3500);
  });

  test('Roof double storey — priced higher than single storey', () => {
    const single = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Roof'],
    });
    const double = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '2 storey',
      exteriorAreas: ['Roof'],
    });

    expect(double.extMin).toBeGreaterThan(single.extMin);
    expect(double.extMax).toBeGreaterThan(single.extMax);
  });

  test('Roof triple storey — priced higher than double storey', () => {
    const double = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '2 storey',
      exteriorAreas: ['Roof'],
    });
    const triple = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '3 storey',
      exteriorAreas: ['Roof'],
    });

    expect(triple.extMin).toBeGreaterThan(double.extMin);
    expect(triple.extMax).toBeGreaterThan(double.extMax);
  });

  test('Wall + Eaves triple storey — priced higher than double storey for partial scope', () => {
    const double = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '2 storey',
      exteriorAreas: ['Wall', 'Eaves'],
      wallType: 'cladding',
      approxSize: 150,
    });
    const triple = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '3 storey',
      exteriorAreas: ['Wall', 'Eaves'],
      wallType: 'cladding',
      approxSize: 150,
    });

    expect(triple.extMin).toBeGreaterThan(double.extMin);
    expect(triple.extMax).toBeGreaterThan(double.extMax);
  });

  const wallAdjacencyScopes = [
    { label: 'Wall + Gutter', exteriorAreas: ['Wall', 'Gutter'] as const },
    { label: 'Wall + Fascia', exteriorAreas: ['Wall', 'Fascia'] as const },
  ];

  for (const { label, exteriorAreas } of wallAdjacencyScopes) {
    for (const houseStories of ['1 storey', '2 storey', '3 storey'] as const) {
      test(`${label} ${houseStories} — uses wallPlusEaves floor uplift`, () => {
        const result = calculateExteriorEstimate({
          typeOfWork: ['Exterior Painting'],
          paintCondition: 'Excellent',
          houseStories,
          exteriorAreas: [...exteriorAreas],
          wallType: 'cladding',
          approxSize: 60,
        });

        const expectedFloor = Math.round(
          EXTERIOR_WALL_TYPE_FLOORS.cladding.wallPlusEaves * STORY_MODIFIER[houseStories]
        );

        expect(result.extMin).toBeGreaterThanOrEqual(expectedFloor);
      });
    }
  }

  test('Eaves double storey — priced higher than single', () => {
    const single = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Eaves'],
    });
    const double = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '2 storey',
      exteriorAreas: ['Eaves'],
    });

    expect(double.extMin).toBeGreaterThan(single.extMin);
    expect(double.extMax).toBeGreaterThan(single.extMax);
  });

  test('Wall + Roof — Roof adds meaningful cost on top of Wall', () => {
    const wallOnly = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      wallType: 'cladding',
      approxSize: 150,
    });
    const wallPlusRoof = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall', 'Roof'],
      wallType: 'cladding',
      approxSize: 150,
    });

    // Roof adds at least $2000 on top
    expect(wallPlusRoof.extMin).toBeGreaterThan(wallOnly.extMin + 2000);
  });

  test('Specific trim items replace generic Exterior Trim anchor (no double-count)', () => {
    const genericTrim = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Exterior Trim'],
      exteriorTrimItems: ['Doors'],
      // No specific quantities — triggers generic anchor
    });
    const specificTrim = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Exterior Trim'],
      exteriorTrimItems: ['Doors'],
      exteriorDoors: [{ style: 'Standard', quantity: 3 }],
    });

    // Both should produce a result; specific items should price differently from generic
    expect(specificTrim.extMin).toBeGreaterThan(0);
    expect(genericTrim.extMin).toBeGreaterThan(0);
    // Specific items (3× Standard door $250–$420 ea) should NOT double-count with generic anchor
    // i.e., specific >= generic anchor min (items add real cost, not duplicated overhead)
    expect(specificTrim.extMin).toBeGreaterThanOrEqual(genericTrim.extMin);
  });

  // ── Wall-based path (area pricing) ──────────────────────────────────────────

  test('brick wall estimates stay above cladding for the same wall scope', () => {
    const commonInput = {
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Wall'],
      approxSize: 150,
      wallHeight: 2.7,
    };

    const cladding = calculateExteriorEstimate({ ...commonInput, wallType: 'cladding' });
    const brick = calculateExteriorEstimate({ ...commonInput, wallType: 'brick' });

    expect(brick.extMin).toBeGreaterThan(cladding.extMin);
    expect(brick.extMax).toBeGreaterThan(cladding.extMax);
  });

  test('wall-only pricing stays within market ceiling for cladding, rendered, and brick at 150sqm', () => {
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

    // Caps updated to reflect realistic Northern Beaches wall-only range post-condition
    expect(cladding.extMax).toBeLessThan(5500);
    expect(rendered.extMax).toBeLessThan(6700);
    expect(brick.extMax).toBeLessThan(7500);
    expect(rendered.extMin).toBeGreaterThan(cladding.extMin);
    expect(brick.extMin).toBeGreaterThan(rendered.extMin);
  });

  // ── Deck ─────────────────────────────────────────────────────────────────────

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

    const good = calculateExteriorEstimate({ ...commonInput, deckCondition: 'good' });
    const damaged = calculateExteriorEstimate({ ...commonInput, deckCondition: 'damaged' });

    expect(damaged.extMin).toBeGreaterThan(good.extMin);
    expect(damaged.extMax).toBeGreaterThan(good.extMax);
  });

  test('deck-only pricing can rise above the old $22k ceiling but stays under the global cap', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Fair',
      houseStories: '1 storey',
      exteriorAreas: ['Deck'],
      deckArea: 200,
      deckServiceType: 'paint-conversion',
      deckProductType: 'oil',
      deckCondition: 'weathered',
    });

    expect(result.deckCost?.max).toBeGreaterThan(22000);
    expect(result.deckCost?.max).toBeLessThanOrEqual(MAX_PRICE_CAP);
    expect(result.extMin).toBe(result.deckCost?.min);
    expect(result.extMax).toBe(result.deckCost?.max);
  });

  test('3 storey full exterior no longer clips at $35k when the scope is genuinely high risk', () => {
    const result = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      paintCondition: 'Poor',
      houseStories: '3 storey',
      exteriorAreas: ['Wall', 'Eaves', 'Gutter', 'Fascia', 'Exterior Trim'],
      wallType: 'brick',
      approxSize: 1500,
      jobDifficulty: ['Difficult access areas'],
    });

    expect(result.extMax).toBeGreaterThan(MAX_PRICE_CAP);
    expect(result.extMax).toBeLessThanOrEqual(EXTERIOR_FULL_PROJECT_CEILING);
  });

  // ── Condition multiplier ─────────────────────────────────────────────────────

  test('Poor condition raises Eaves estimate above Excellent', () => {
    const base = {
      typeOfWork: ['Exterior Painting'],
      houseStories: '1 storey',
      exteriorAreas: ['Eaves'],
    };

    const excellent = calculateExteriorEstimate({ ...base, paintCondition: 'Excellent' });
    const poor = calculateExteriorEstimate({ ...base, paintCondition: 'Poor' });

    expect(poor.extMin).toBeGreaterThan(excellent.extMin);
  });

  test('poor paving pricing is materially above fair paving pricing', () => {
    const fair = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      houseStories: '1 storey',
      exteriorAreas: ['Paving'],
      pavingArea: 30,
      pavingCondition: 'fair',
    });

    const poor = calculateExteriorEstimate({
      typeOfWork: ['Exterior Painting'],
      houseStories: '1 storey',
      exteriorAreas: ['Paving'],
      pavingArea: 30,
      pavingCondition: 'poor',
    });

    expect(poor.pavingCost?.min).toBeGreaterThanOrEqual(Math.round((fair.pavingCost?.min ?? 0) * 1.5));
    expect(poor.pavingCost?.max).toBeGreaterThanOrEqual(Math.round((fair.pavingCost?.max ?? 0) * 1.5));
  });
});
