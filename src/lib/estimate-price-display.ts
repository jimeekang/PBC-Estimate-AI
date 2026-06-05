export type EstimatePriceDisplayMeta = {
  mode?: string;
} | null | undefined;

export type EstimatePriceDisplayInput = {
  priceRange?: string | null;
  pricingMeta?: EstimatePriceDisplayMeta;
  fallback?: string;
};

export function shouldAppendGstToEstimatePrice({
  priceRange,
  pricingMeta,
}: EstimatePriceDisplayInput) {
  const trimmedPriceRange = priceRange?.trim();

  if (!trimmedPriceRange) {
    return false;
  }

  if (pricingMeta?.mode === 'interior_itemized') {
    return false;
  }

  return !/\bGST\b/i.test(trimmedPriceRange);
}

export function formatEstimatePriceRangeForDisplay({
  priceRange,
  pricingMeta,
  fallback = 'N/A',
}: EstimatePriceDisplayInput) {
  const trimmedPriceRange = priceRange?.trim();

  if (!trimmedPriceRange) {
    return fallback;
  }

  return shouldAppendGstToEstimatePrice({ priceRange: trimmedPriceRange, pricingMeta })
    ? `${trimmedPriceRange} (+GST)`
    : trimmedPriceRange;
}
