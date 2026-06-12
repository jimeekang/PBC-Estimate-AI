import { readFileSync } from 'fs';
import path from 'path';

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(relativePath: string) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('public home CTA and example estimate copy', () => {
  it('removes the duplicate sample estimate preview from the public home page', () => {
    const homePageSource = readProjectFile('src/app/(public)/page.tsx');

    expect(homePageSource).not.toContain('See What an AI Estimate Looks Like');
    expect(homePageSource).not.toContain('Sample Preview');
  });

  it('keeps fixed booking CTA and sends free estimate CTAs to the estimate page', () => {
    const homePageSource = readProjectFile('src/app/(public)/page.tsx');

    expect(homePageSource).toContain('fixed bottom-4 right-4');
    expect(homePageSource).toContain('Book Online for a Firm Quote');
    expect(homePageSource).toContain('Start With Free AI Estimate');
    expect(homePageSource).toContain('href="/estimate"');
    expect(homePageSource).not.toContain('href="#quick-price-guide"');
  });

  it('does not render the example quick price guide on the public home page', () => {
    const homePageSource = readProjectFile('src/app/(public)/page.tsx');

    expect(homePageSource).not.toContain('<section id="quick-price-guide"');
    expect(homePageSource).not.toContain('<LiteEstimateForm />');
    expect(homePageSource).not.toContain('lite-estimate-form');
  });

  it('marks quick price guide screen and PDF output as an example', () => {
    const liteFormSource = readProjectFile(
      'src/domains/estimate/presentation/components/lite-estimate-form.tsx'
    );
    const estimateResultSource = readProjectFile(
      'src/domains/estimate/presentation/components/estimate-result.tsx'
    );

    expect(liteFormSource).toContain('<EstimateResult result={result} isExample');
    expect(estimateResultSource).toContain('EXAMPLE PRICE GUIDE');
    expect(estimateResultSource).toContain('Download Example PDF');
    expect(estimateResultSource).toContain('Example AI Painting Estimate');
  });
});
