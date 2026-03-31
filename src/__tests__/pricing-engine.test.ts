/**
 * pricing-engine.test.ts
 *
 * Full test suite for PBC Estimate AI pricing logic.
 * All ranges validated against Sydney Northern Beaches market (2026).
 *
 * Tests import from src/lib/pricing-engine.ts — the single source of truth.
 */

import {
  // Constants
  APARTMENT_SQM_CURVE,
  HOUSE_INTERIOR_ANCHORS,
  EXTERIOR_WALL_TYPE_ANCHOR,
  EXTERIOR_WALL_TYPE_FLOORS,
  EXTERIOR_AREA_UPLIFT_PCT,
  EXTERIOR_DOOR_ANCHOR,
  EXTERIOR_WINDOW_ANCHOR,
  EXTERIOR_FRONT_DOOR_ANCHOR,
  INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL,
  INTERIOR_DOOR_ITEM_ANCHOR,
  INTERIOR_DOOR_TYPE_PREMIUM,
  INTERIOR_DOOR_WHOLE_JOB_PREMIUM_PCT,
  INTERIOR_WINDOW_ITEM_ANCHOR,
  INTERIOR_SKIRTING_LINEAR_RATE,
  INTERIOR_HANDRAIL_ITEM_PRICING,
  CONDITION_MULTIPLIER,
  HOUSE_CONDITION_MULTIPLIER,
  STORY_MODIFIER,
  DEFAULT_WALL_HEIGHT,
  CAL_3B2B_FAIR_SINGLE_POINTS,
  DOUBLE_STOREY_3B2B_UPLIFT,
  MAX_PRICE_CAP,
  // Functions
  clamp,
  getRawMedianFromSqm,
  getExteriorWallRate,
  pickExteriorBand,
  estimateWallArea,
  getInteriorHandrailWidthMultiplier,
  calculateInteriorHandrailItemRange,
  getQtyScaleFactor,
  calcTrimItemCost,
  inferHouseKey,
  capRangeWidthSmart,
  interpolateBySqm,
  lerp,
  sumAreaFactor,
  sumAreaFactorWholeApartment,
} from '../lib/pricing-engine';

// ─────────────────────────────────────────────────────────────
// GROUP A: Interior Apartment – Entire Property (SQM Curve)
// ─────────────────────────────────────────────────────────────
describe('A: Interior Apartment Entire Property (SQM Curve)', () => {
  test('A1: Studio 35sqm — rawMedian equals first curve point (2200)', () => {
    const raw = getRawMedianFromSqm(35);
    expect(raw).toBe(2200);
  });

  test('A1: Studio 35sqm — realistic market range $2000–$4000', () => {
    const raw = getRawMedianFromSqm(35);
    // Apply Excellent band: 0.95–1.05
    const minPrice = raw * CONDITION_MULTIPLIER.Excellent.min;
    const maxPrice = raw * CONDITION_MULTIPLIER.Poor.max;
    expect(minPrice).toBeGreaterThanOrEqual(2000);
    expect(maxPrice).toBeLessThanOrEqual(4500);
  });

  test('A2: 85sqm (avg 2Bed) — rawMedian is key calibration point ~4350', () => {
    const raw = getRawMedianFromSqm(85);
    // Exact curve point
    expect(raw).toBe(4350);
  });

  test('A2: 85sqm Fair — min price in market range $3800–$5800', () => {
    const raw = getRawMedianFromSqm(85);
    const minPrice = raw * CONDITION_MULTIPLIER.Fair.min;
    const maxPrice = raw * CONDITION_MULTIPLIER.Fair.max;
    expect(minPrice).toBeGreaterThanOrEqual(3800);
    expect(maxPrice).toBeLessThanOrEqual(5800);
  });

  test('A3: 90sqm Excellent — rawMedian ~4300', () => {
    const raw = getRawMedianFromSqm(90);
    expect(raw).toBe(4300);
  });

  test('A3: 90sqm Excellent — priced in range $3900–$5500', () => {
    const raw = getRawMedianFromSqm(90);
    const minPrice = raw * CONDITION_MULTIPLIER.Excellent.min;
    const maxPrice = raw * CONDITION_MULTIPLIER.Excellent.max;
    expect(minPrice).toBeGreaterThanOrEqual(3900);
    expect(maxPrice).toBeLessThanOrEqual(5500);
  });

  test('A4: 120sqm — rawMedian at curve point (5800)', () => {
    const raw = getRawMedianFromSqm(120);
    expect(raw).toBe(5800);
  });

  test('A4: 120sqm Poor — max price does not undercut floor ($4800)', () => {
    const raw = getRawMedianFromSqm(120);
    const minPrice = raw * CONDITION_MULTIPLIER.Poor.min;
    expect(minPrice).toBeGreaterThanOrEqual(4800);
  });

  test('A4: 120sqm Poor — max price within realistic ceiling ($9200)', () => {
    // rawMedian(120) = 5800; Poor.max = 1.55 → 5800 × 1.55 = 8990
    // This is correct: Poor condition adds significant prep/repair labour.
    const raw = getRawMedianFromSqm(120);
    const maxPrice = raw * CONDITION_MULTIPLIER.Poor.max;
    expect(maxPrice).toBeLessThanOrEqual(9200);
  });

  test('A5: 200sqm Fair — rawMedian at curve top (9500)', () => {
    const raw = getRawMedianFromSqm(200);
    expect(raw).toBe(9500);
  });

  test('A5: 200sqm Fair — min price is above $8000', () => {
    const raw = getRawMedianFromSqm(200);
    const minPrice = raw * CONDITION_MULTIPLIER.Fair.min;
    expect(minPrice).toBeGreaterThanOrEqual(8000);
  });

  test('A6: sqm=null fallback uses 90sqm default', () => {
    expect(getRawMedianFromSqm(null)).toBe(getRawMedianFromSqm(90));
  });

  test('A6: sqm=undefined fallback uses 90sqm default', () => {
    expect(getRawMedianFromSqm(undefined)).toBe(getRawMedianFromSqm(90));
  });

  test('A6: sqm=NaN fallback uses 90sqm default', () => {
    expect(getRawMedianFromSqm(NaN)).toBe(getRawMedianFromSqm(90));
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP B: Interior House – Entire Property
// ─────────────────────────────────────────────────────────────
describe('B: Interior House Entire Property', () => {
  test('B1: inferHouseKey — 2B1B (2 bedrooms)', () => {
    expect(inferHouseKey({ bedroomsTotal: 2 })).toBe('2B1B');
  });

  test('B1: inferHouseKey — 2B1B anchor min is $7500', () => {
    expect(HOUSE_INTERIOR_ANCHORS['2B1B'].min).toBe(7500);
  });

  test('B2: 3B2B Excellent 1 storey — anchor min $9500, max $14000', () => {
    const key = inferHouseKey({ bedroomsTotal: 3, bathroomsTotal: 2 });
    expect(key).toBe('3B2B');
    const anchor = HOUSE_INTERIOR_ANCHORS['3B2B'];
    expect(anchor.min).toBe(9500);
    expect(anchor.max).toBe(14000);
  });

  test('B3: 3B2B Fair 2 storey — storey modifier 1.18 applied to base price', () => {
    const anchor = HOUSE_INTERIOR_ANCHORS['3B2B'];
    const storyMod = STORY_MODIFIER['2 storey'];
    const condMin = HOUSE_CONDITION_MULTIPLIER.Fair.min;
    const adjusted = anchor.median * storyMod * condMin;
    // After 1.18× storey uplift, must exceed single-storey price
    expect(adjusted).toBeGreaterThan(anchor.median * condMin);
    expect(storyMod).toBe(1.18);
  });

  test('B4: 4B2B Poor 2 storey — priced above 3B2B equivalent', () => {
    const anchor3B2B = HOUSE_INTERIOR_ANCHORS['3B2B'];
    const anchor4B2B = HOUSE_INTERIOR_ANCHORS['4B2B'];
    expect(anchor4B2B.min).toBeGreaterThan(anchor3B2B.min);
    expect(anchor4B2B.max).toBeGreaterThan(anchor3B2B.max);
  });

  test('B5: inferHouseKey — 5+ bedrooms maps to 5B3B', () => {
    expect(inferHouseKey({ bedroomsTotal: 5 })).toBe('5B3B');
    expect(inferHouseKey({ bedroomsTotal: 6 })).toBe('5B3B');
  });

  test('B5: inferHouseKey — 3+ bathrooms maps to 5B3B', () => {
    expect(inferHouseKey({ bathroomsTotal: 3 })).toBe('5B3B');
  });

  test('B6: inferHouseKey — sqm fallback 90sqm → 2B1B', () => {
    expect(inferHouseKey({ approxSizeSqm: 90 })).toBe('2B1B');
  });

  test('B6: inferHouseKey — sqm fallback 120sqm → 3B2B', () => {
    expect(inferHouseKey({ approxSizeSqm: 120 })).toBe('3B2B');
  });

  test('B6: inferHouseKey — sqm fallback 160sqm → 4B2B', () => {
    expect(inferHouseKey({ approxSizeSqm: 160 })).toBe('4B2B');
  });

  test('B6: inferHouseKey — sqm fallback 220sqm → 5B3B', () => {
    expect(inferHouseKey({ approxSizeSqm: 220 })).toBe('5B3B');
  });

  test('B6: inferHouseKey — no params defaults to 3B2B', () => {
    expect(inferHouseKey({})).toBe('3B2B');
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP C: Interior Specific Areas
// ─────────────────────────────────────────────────────────────
describe('C: Interior Specific Areas', () => {
  test('C1: Bedroom 1 anchor — min $980, max $1280', () => {
    const anchor = INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL['Bedroom 1'];
    expect(anchor.min).toBe(980);
    expect(anchor.max).toBe(1280);
  });

  test('C2: Living Room anchor — min $2200, max $3200', () => {
    const anchor = INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL['Living Room'];
    expect(anchor.min).toBe(2200);
    expect(anchor.max).toBe(3200);
  });

  test('C3: Bathroom anchor is trimmed closer to a small wet area range', () => {
    const bathroom = INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL.Bathroom;
    expect(bathroom.min).toBe(1150);
    expect(bathroom.max).toBe(1550);
  });

  test('C4: Stairwell anchor is reduced so access premium can come from difficulty instead', () => {
    const anchor = INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL.Stairwell;
    expect(anchor.min).toBe(1250);
    expect(anchor.max).toBe(1850);
  });

  test('C4b: Study and laundry anchors stay below standard bedroom-heavy rooms', () => {
    expect(INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL['Study / Office'].min).toBe(1050);
    expect(INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL.Laundry.min).toBe(850);
    expect(INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL.Laundry.min).toBeLessThan(
      INTERIOR_SPECIFIC_ROOM_BASE_ANCHOR_OIL['Study / Office'].min
    );
  });

  test('C5: Oil 2coat Door & Frame anchor = $220', () => {
    expect(INTERIOR_DOOR_ITEM_ANCHOR.oil_2coat['Door & Frame']).toBe(220);
  });

  test('C5b: Door type premiums keep flush as the base and bi-folding as the highest uplift', () => {
    expect(INTERIOR_DOOR_TYPE_PREMIUM.flush).toBe(0);
    expect(INTERIOR_DOOR_TYPE_PREMIUM.sliding).toBe(5);
    expect(INTERIOR_DOOR_TYPE_PREMIUM.panelled).toBe(10);
    expect(INTERIOR_DOOR_TYPE_PREMIUM.french).toBe(15);
    expect(INTERIOR_DOOR_TYPE_PREMIUM.bi_folding).toBe(25);
    expect(INTERIOR_DOOR_WHOLE_JOB_PREMIUM_PCT.bi_folding).toBe(0.1);
  });

  test('C6: Door quantity discount — 1-3 items: factor 1.00', () => {
    expect(getQtyScaleFactor(3)).toBe(1.00);
  });

  test('C6: Door quantity discount — 4-7 items: factor 0.92', () => {
    expect(getQtyScaleFactor(4)).toBe(0.92);
    expect(getQtyScaleFactor(7)).toBe(0.92);
  });

  test('C6: Door quantity discount — 8-12 items: factor 0.85', () => {
    expect(getQtyScaleFactor(8)).toBe(0.85);
    expect(getQtyScaleFactor(12)).toBe(0.85);
  });

  test('C6: Door quantity discount — 13+ items: factor 0.80', () => {
    expect(getQtyScaleFactor(13)).toBe(0.80);
    expect(getQtyScaleFactor(20)).toBe(0.80);
  });

  test('C7: Skirting linear rate oil_2coat — $7/m min, $10/m max', () => {
    expect(INTERIOR_SKIRTING_LINEAR_RATE.oil_2coat.min).toBe(7);
    expect(INTERIOR_SKIRTING_LINEAR_RATE.oil_2coat.max).toBe(10);
  });

  test('C8: Skirting linear rate water — $8/m min, $11/m max', () => {
    expect(INTERIOR_SKIRTING_LINEAR_RATE.water_3coat_white_finish.min).toBe(8);
    expect(INTERIOR_SKIRTING_LINEAR_RATE.water_3coat_white_finish.max).toBe(11);
  });

  test('C9: Interior Window French water-based Window & Frame = $475', () => {
    expect(INTERIOR_WINDOW_ITEM_ANCHOR.water_3coat_white_finish.French['Window & Frame']).toBe(475);
  });

  test('C10: calcTrimItemCost — each group gets independent scale factor (no cross-group stacking)', () => {
    // 5 doors + 3 windows → doors scale 0.92, windows scale 1.00 (independent)
    const doorAnchor = { 'Door & Frame': { min: 200, max: 300 } };
    const windowAnchor = { Normal: { min: 100, max: 200 } };

    const doors = calcTrimItemCost([{ style: 'Door & Frame', quantity: 5 }], doorAnchor);
    const windows = calcTrimItemCost([{ type: 'Normal', quantity: 3 }], windowAnchor);

    // Doors: 5 × $200 × 0.92 = $920 min; 5 × $300 × 0.92 = $1380 max
    expect(doors.min).toBe(920);
    expect(doors.max).toBe(1380);

    // Windows: 3 × $100 × 1.00 = $300 min; 3 × $200 × 1.00 = $600 max
    expect(windows.min).toBe(300);
    expect(windows.max).toBe(600);
  });

  test('C10: calcTrimItemCost throws on unknown anchor key instead of silently using a fallback', () => {
    expect(() =>
      calcTrimItemCost([{ style: 'Unknown Style', quantity: 2 }], EXTERIOR_DOOR_ANCHOR)
    ).toThrow('Unknown trim anchor key');
  });

  test('C11: Handrail oil 2coat anchor — $155/m min, $180/m max', () => {
    const anchor = INTERIOR_HANDRAIL_ITEM_PRICING.paint_to_paint_oil_2coat;
    expect(anchor.rate.min).toBe(155);
    expect(anchor.rate.max).toBe(180);
  });

  test('C12: Handrail width multiplier — 60mm = 1.08', () => {
    expect(getInteriorHandrailWidthMultiplier(60)).toBe(1.08);
  });

  test('C13: Handrail formula — 4lm, 60mm, paint->paint oil = $670–$778 rounded', () => {
    const range = calculateInteriorHandrailItemRange(4, 60, 'paint_to_paint_oil_2coat');
    expect(range.min).toBe(670);
    expect(range.max).toBe(778);
  });

  test('C14: Handrail minimum job floor — short clear varnish refresh stays above floor', () => {
    const range = calculateInteriorHandrailItemRange(2, 45, 'varnish_to_varnish_clear');
    expect(range.min).toBe(540);
    expect(range.max).toBe(660);
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP D: Exterior
// ─────────────────────────────────────────────────────────────
describe('D: Exterior Painting', () => {
  test('D1: Cladding wallOnly floor — $2600', () => {
    expect(EXTERIOR_WALL_TYPE_FLOORS.cladding.wallOnly).toBe(2600);
  });

  test('D2: Rendered wallOnly floor — $3200', () => {
    expect(EXTERIOR_WALL_TYPE_FLOORS.rendered.wallOnly).toBe(3200);
  });

  test('D3: Brick wallOnly floor — $3800', () => {
    expect(EXTERIOR_WALL_TYPE_FLOORS.brick.wallOnly).toBe(3800);
  });

  test('D4: Brick tripleStoreyFullExterior floor — $14500', () => {
    expect(EXTERIOR_WALL_TYPE_FLOORS.brick.tripleStoreyFullExterior).toBe(14500);
  });

  test('D5: estimateWallArea(100, 2.7) — approximately 113m²', () => {
    const area = estimateWallArea(100, 2.7);
    expect(area).toBeCloseTo(113.4, 0); // 4.2 × √100 × 2.7 = 4.2 × 10 × 2.7 = 113.4
  });

  test('D6: estimateWallArea(150, 5.4) — approximately 278m²', () => {
    const area = estimateWallArea(150, 5.4);
    // 4.2 × √150 × 5.4 = 4.2 × 12.247 × 5.4 ≈ 277.7
    expect(area).toBeCloseTo(277.7, 0);
  });

  test('D6b: getExteriorWallRate scales down per-m² as wall area grows', () => {
    const small = getExteriorWallRate('cladding', 80);
    const large = getExteriorWallRate('cladding', 220);
    expect(large.min).toBeLessThan(small.min);
    expect(large.max).toBeLessThan(small.max);
  });

  test('D7: pickExteriorBand — 113m² falls in band 3 (minMult 0.73–0.86 range)', () => {
    const band = pickExteriorBand(113);
    // Band 3 covers 109–128, minMult 0.73 at start
    expect(band.minMult).toBeGreaterThanOrEqual(0.73);
    expect(band.minMult).toBeLessThanOrEqual(0.86);
    expect(band.maxMult).toBeGreaterThanOrEqual(0.86);
    expect(band.maxMult).toBeLessThanOrEqual(0.97);
  });

  test('D8: STORY_MODIFIER 1 storey = 1.0', () => {
    expect(STORY_MODIFIER['1 storey']).toBe(1.0);
  });

  test('D9: STORY_MODIFIER 2 storey = 1.18', () => {
    expect(STORY_MODIFIER['2 storey']).toBe(1.18);
  });

  test('D10: STORY_MODIFIER 3 storey = 1.35', () => {
    expect(STORY_MODIFIER['3 storey']).toBe(1.35);
  });

  test('D11: Roof uplift is 18–32% of base', () => {
    const roofUplift = EXTERIOR_AREA_UPLIFT_PCT.Roof;
    expect(roofUplift.minPct).toBe(0.18);
    expect(roofUplift.maxPct).toBe(0.32);
  });

  test('D12: Eaves uplift is 9–14% of base', () => {
    const eavesUplift = EXTERIOR_AREA_UPLIFT_PCT.Eaves;
    expect(eavesUplift.minPct).toBe(0.09);
    expect(eavesUplift.maxPct).toBe(0.14);
  });

  test('D13: Exterior Door Simple — min $150, max $280', () => {
    expect(EXTERIOR_DOOR_ANCHOR.Simple.min).toBe(150);
    expect(EXTERIOR_DOOR_ANCHOR.Simple.max).toBe(280);
  });

  test('D14: Exterior Window French — min $280, max $500', () => {
    expect(EXTERIOR_WINDOW_ANCHOR.French.min).toBe(280);
    expect(EXTERIOR_WINDOW_ANCHOR.French.max).toBe(500);
  });

  test('D15: Front door standalone — $520–$880', () => {
    expect(EXTERIOR_FRONT_DOOR_ANCHOR.min).toBe(520);
    expect(EXTERIOR_FRONT_DOOR_ANCHOR.max).toBe(880);
  });

  test('D16: DEFAULT_WALL_HEIGHT — 2 storey = 5.4m (double height)', () => {
    expect(DEFAULT_WALL_HEIGHT['2 storey']).toBe(5.4);
    // Double storey (5.4m) is exactly 2x single (2.7m), confirming correct height model
    expect(DEFAULT_WALL_HEIGHT['2 storey']).toBe(DEFAULT_WALL_HEIGHT['1 storey'] * 2);
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP E: Range Cap Policy
// ─────────────────────────────────────────────────────────────
describe('E: Range Cap Policy', () => {
  test('E1: interior, min=$4000 — cap is 1200', () => {
    const result = capRangeWidthSmart(4000, 6500, {}, 'interior');
    expect(result.min).toBe(4000);
    expect(result.max).toBe(5200); // 4000 + 1200
  });

  test('E2: interior, min=$7000 — cap is 1800', () => {
    const result = capRangeWidthSmart(7000, 10000, {}, 'interior');
    expect(result.min).toBe(7000);
    expect(result.max).toBe(8800); // 7000 + 1800
  });

  test('E3: interior, min=$12000 — cap is 2500', () => {
    const result = capRangeWidthSmart(12000, 16000, {}, 'interior');
    expect(result.min).toBe(12000);
    expect(result.max).toBe(14500); // 12000 + 2500
  });

  test('E4: interior, min=$20000 — cap is 3500', () => {
    const result = capRangeWidthSmart(20000, 26000, {}, 'interior');
    expect(result.min).toBe(20000);
    expect(result.max).toBe(23500); // 20000 + 3500
  });

  test('E5: exterior, min=$8000 — cap is 800', () => {
    const result = capRangeWidthSmart(8000, 12000, {}, 'exterior');
    expect(result.min).toBe(8000);
    expect(result.max).toBe(8800); // 8000 + 800
  });

  test('E6: exterior, min=$15000 — cap is 1500', () => {
    const result = capRangeWidthSmart(15000, 20000, {}, 'exterior');
    expect(result.min).toBe(15000);
    expect(result.max).toBe(16500); // 15000 + 1500
  });

  test('E7: exterior, min=$22000 — cap is 2500', () => {
    const result = capRangeWidthSmart(22000, 28000, {}, 'exterior');
    expect(result.min).toBe(22000);
    expect(result.max).toBe(24500); // 22000 + 2500
  });

  test('E8: gap smaller than cap — range preserved unchanged', () => {
    const result = capRangeWidthSmart(4000, 4800, {}, 'interior');
    // gap = 800 < cap 1200 → preserved
    expect(result.min).toBe(4000);
    expect(result.max).toBe(4800);
  });

  test('E8: gap exactly equal to cap — range preserved unchanged', () => {
    const result = capRangeWidthSmart(4000, 5200, {}, 'interior');
    // gap = 1200 = cap → preserved
    expect(result.min).toBe(4000);
    expect(result.max).toBe(5200);
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP F: Helper Functions
// ─────────────────────────────────────────────────────────────
describe('F: Helper Functions', () => {
  test('F1: clamp(5, 0, 10) === 5', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  test('F2: clamp(-1, 0, 10) === 0', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  test('F3: clamp(11, 0, 10) === 10', () => {
    expect(clamp(11, 0, 10)).toBe(10);
  });

  test('F3: clamp with equal min and max returns that value', () => {
    expect(clamp(5, 5, 5)).toBe(5);
    expect(clamp(3, 5, 5)).toBe(5);
    expect(clamp(7, 5, 5)).toBe(5);
  });

  test('F4: getQtyScaleFactor(1) === 1.00', () => {
    expect(getQtyScaleFactor(1)).toBe(1.00);
  });

  test('F5: getQtyScaleFactor(5) === 0.92', () => {
    expect(getQtyScaleFactor(5)).toBe(0.92);
  });

  test('F6: getQtyScaleFactor(10) === 0.85', () => {
    expect(getQtyScaleFactor(10)).toBe(0.85);
  });

  test('F7: getQtyScaleFactor(15) === 0.80', () => {
    expect(getQtyScaleFactor(15)).toBe(0.80);
  });

  test('F8: getRawMedianFromSqm interpolates between 65sqm and 80sqm points', () => {
    // Curve: 65→3450, 80→3800. At 72.5 (midpoint), expect lerp ~3625
    const raw = getRawMedianFromSqm(72.5);
    expect(raw).toBeGreaterThan(3450);
    expect(raw).toBeLessThan(3800);
    expect(raw).toBeCloseTo(3625, 0);
  });

  test('F9: lerp(0, 100, 0.5) === 50', () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });

  test('F9: lerp(0, 100, 0) === 0', () => {
    expect(lerp(0, 100, 0)).toBe(0);
  });

  test('F9: lerp(0, 100, 1) === 100', () => {
    expect(lerp(0, 100, 1)).toBe(100);
  });

  test('F10: sumAreaFactor({wallPaint, ceilingPaint}) === 0.80', () => {
    // wallPaint 0.55 + ceilingPaint 0.25 = 0.80
    const factor = sumAreaFactor({ wallPaint: true, ceilingPaint: true });
    expect(factor).toBeCloseTo(0.80, 10);
  });

  test('F10: sumAreaFactor — full set (wall+ceil+trim+ensuite) = 1.0 (ensuite is data-only, not priced)', () => {
    const factor = sumAreaFactor({
      wallPaint: true,
      ceilingPaint: true,
      trimPaint: true,
      ensuitePaint: true,
    });
    // ensuitePaint does not contribute to pricing — base anchor covers the full property
    expect(factor).toBeCloseTo(1.0, 10);
  });

  test('F10: sumAreaFactor — no flags = 0 (filtered out in scoring)', () => {
    expect(sumAreaFactor({})).toBe(0);
  });

  test('sumAreaFactorWholeApartment — no flags defaults to 1.0', () => {
    expect(sumAreaFactorWholeApartment({})).toBe(1.0);
  });

  test('sumAreaFactorWholeApartment — with flags same as sumAreaFactor', () => {
    const flags = { wallPaint: true, ceilingPaint: true };
    expect(sumAreaFactorWholeApartment(flags)).toBeCloseTo(sumAreaFactor(flags), 10);
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP G: Market Realism Sanity Checks
// ─────────────────────────────────────────────────────────────
describe('G: Market Realism Sanity Check', () => {
  test('G1: Studio apartment rawMedian < 5B3B house min price', () => {
    const studioRaw = getRawMedianFromSqm(35);
    const houseLargeMin = HOUSE_INTERIOR_ANCHORS['5B3B'].min;
    expect(studioRaw).toBeLessThan(houseLargeMin);
  });

  test('G2: Exterior wall type floor — brick > rendered > cladding (wallOnly)', () => {
    expect(EXTERIOR_WALL_TYPE_FLOORS.brick.wallOnly)
      .toBeGreaterThan(EXTERIOR_WALL_TYPE_FLOORS.rendered.wallOnly);
    expect(EXTERIOR_WALL_TYPE_FLOORS.rendered.wallOnly)
      .toBeGreaterThan(EXTERIOR_WALL_TYPE_FLOORS.cladding.wallOnly);
  });

  test('G2: Exterior wall type median — brick > rendered > cladding', () => {
    expect(EXTERIOR_WALL_TYPE_ANCHOR.brick.median)
      .toBeGreaterThan(EXTERIOR_WALL_TYPE_ANCHOR.rendered.median);
    expect(EXTERIOR_WALL_TYPE_ANCHOR.rendered.median)
      .toBeGreaterThan(EXTERIOR_WALL_TYPE_ANCHOR.cladding.median);
  });

  test('G3: Storey modifiers increase with storeys (1 < 2 < 3)', () => {
    expect(STORY_MODIFIER['1 storey']).toBeLessThan(STORY_MODIFIER['2 storey']);
    expect(STORY_MODIFIER['2 storey']).toBeLessThan(STORY_MODIFIER['3 storey']);
  });

  test('G4: Apartment condition multiplier max — Poor > Fair > Excellent', () => {
    expect(CONDITION_MULTIPLIER.Poor.max)
      .toBeGreaterThan(CONDITION_MULTIPLIER.Fair.max);
    expect(CONDITION_MULTIPLIER.Fair.max)
      .toBeGreaterThan(CONDITION_MULTIPLIER.Excellent.max);
  });

  test('G4: Apartment condition multiplier min — Poor > Fair > Excellent', () => {
    expect(CONDITION_MULTIPLIER.Poor.min)
      .toBeGreaterThan(CONDITION_MULTIPLIER.Fair.min);
    expect(CONDITION_MULTIPLIER.Fair.min)
      .toBeGreaterThan(CONDITION_MULTIPLIER.Excellent.min);
  });

  test('G5: 200sqm apartment rawMedian is at least 3× the 35sqm rawMedian', () => {
    const small = getRawMedianFromSqm(35);
    const large = getRawMedianFromSqm(200);
    expect(large).toBeGreaterThanOrEqual(small * 3);
  });

  test('G6: MAX_PRICE_CAP === 35000', () => {
    expect(MAX_PRICE_CAP).toBe(35000);
  });

  test('G7: House anchors scale upward — 2B1B < 3B2B < 4B2B < 5B3B (median)', () => {
    expect(HOUSE_INTERIOR_ANCHORS['2B1B'].median)
      .toBeLessThan(HOUSE_INTERIOR_ANCHORS['3B2B'].median);
    expect(HOUSE_INTERIOR_ANCHORS['3B2B'].median)
      .toBeLessThan(HOUSE_INTERIOR_ANCHORS['4B2B'].median);
    expect(HOUSE_INTERIOR_ANCHORS['4B2B'].median)
      .toBeLessThan(HOUSE_INTERIOR_ANCHORS['5B3B'].median);
  });

  test('G8: SQM curve is monotonically increasing up to 85sqm', () => {
    // 35→45→55→65→80→85: each rawMedian should be greater than or equal to previous
    for (let i = 0; i < APARTMENT_SQM_CURVE.length - 1; i++) {
      const curr = APARTMENT_SQM_CURVE[i];
      const next = APARTMENT_SQM_CURVE[i + 1];
      // Note: 85→90 is a slight decrease (4350→4300) — this is intentional calibration
      if (curr.sqm === 85) continue;
      expect(next.rawMedian).toBeGreaterThanOrEqual(curr.rawMedian);
    }
  });

  test('G9: Wall band multiplier at 346+m² is higher than at 0m²', () => {
    const smallBand = pickExteriorBand(50);
    const largeBand = pickExteriorBand(400);
    expect(largeBand.minMult).toBeGreaterThan(smallBand.minMult);
    expect(largeBand.maxMult).toBeGreaterThan(smallBand.maxMult);
  });

  test('G10: DOUBLE_STOREY_3B2B_UPLIFT constants are present and non-zero', () => {
    expect(DOUBLE_STOREY_3B2B_UPLIFT.baseMinPct).toBeGreaterThan(0);
    expect(DOUBLE_STOREY_3B2B_UPLIFT.baseMaxPct).toBeGreaterThan(0);
    expect(DOUBLE_STOREY_3B2B_UPLIFT.baseMaxPct)
      .toBeGreaterThan(DOUBLE_STOREY_3B2B_UPLIFT.baseMinPct);
  });
});

// ─────────────────────────────────────────────────────────────
// GROUP H: interpolateBySqm (CAL_3B2B_FAIR_SINGLE_POINTS)
// ─────────────────────────────────────────────────────────────
describe('H: interpolateBySqm for 3B2B Fair calibration', () => {
  test('H1: at exact first point (120sqm) — returns point values', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 120);
    expect(result.min).toBe(8500);
    expect(result.max).toBe(11000);
  });

  test('H2: at exact last point (180sqm) — returns point values', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 180);
    expect(result.min).toBe(14500);
    expect(result.max).toBe(19000);
  });

  test('H3: at 135sqm (known calibration point) — returns exact values', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 135);
    expect(result.min).toBe(10000);
    expect(result.max).toBe(13500);
  });

  test('H4: at midpoint between 120–135sqm (127.5sqm) — interpolated values', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 127.5);
    expect(result.min).toBeGreaterThan(8500);
    expect(result.min).toBeLessThan(10000);
    expect(result.max).toBeGreaterThan(11000);
    expect(result.max).toBeLessThan(13500);
  });

  test('H5: below first point — scales proportionally', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 60);
    // 60/120 = 0.5 → min = 8500 × 0.5 = 4250, max = 11000 × 0.5 = 5500
    expect(result.min).toBeCloseTo(4250, 0);
    expect(result.max).toBeCloseTo(5500, 0);
  });

  test('H6: above last point — scales proportionally', () => {
    const result = interpolateBySqm(CAL_3B2B_FAIR_SINGLE_POINTS, 360);
    // 360/180 = 2.0 → min = 14500×2 = 29000, max = 19000×2 = 38000
    expect(result.min).toBeCloseTo(29000, 0);
    expect(result.max).toBeCloseTo(38000, 0);
  });
});
