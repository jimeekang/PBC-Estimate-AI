import { formatEstimatePriceRangeForDisplay } from '@/lib/estimate-price-display';

describe('estimate price display', () => {
  it('appends GST wording to deterministic range displays', () => {
    expect(
      formatEstimatePriceRangeForDisplay({
        priceRange: 'AUD 10,000 - 11,500',
      })
    ).toBe('AUD 10,000 - 11,500 (+GST)');
  });

  it('does not duplicate existing GST wording', () => {
    expect(
      formatEstimatePriceRangeForDisplay({
        priceRange: 'AUD 440 + GST',
      })
    ).toBe('AUD 440 + GST');
  });

  it('does not append GST wording to itemized trim quotes', () => {
    expect(
      formatEstimatePriceRangeForDisplay({
        priceRange: 'AUD 440 + GST',
        pricingMeta: { mode: 'interior_itemized' },
      })
    ).toBe('AUD 440 + GST');
  });

  it('uses a fallback for missing ranges', () => {
    expect(
      formatEstimatePriceRangeForDisplay({
        priceRange: '',
      })
    ).toBe('N/A');
  });
});
