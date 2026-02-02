'use server';

/**
 * @fileOverview An AI agent to estimate the painting price range and provide a short explanation.
 *
 * - generatePaintingEstimate - A function that handles the painting estimate process.
 * - GeneratePaintingEstimateInput - The input type for the generatePaintingEstimate function.
 * - GeneratePaintingEstimateOutput - The return type for the generatePaintingEstimate function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GeneratePaintingEstimateInputSchema = z.object({
  paintAreas: z.object({
    ceilingPaint: z.boolean().describe('Whether ceiling paint is selected.'),
    wallPaint: z.boolean().describe('Whether wall paint is selected.'),
    trimPaint: z.boolean().describe('Whether trim paint is selected.'),
  }).describe('The paint areas selected by the user.'),
  trimPaintOptions: z.optional(z.object({
    paintType: z.enum(['Oil-based', 'Water-based']).describe('The type of trim paint selected.'),
    trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])).describe('The trim items selected.'),
  }).describe('The trim paint options selected by the user, if trim paint is selected.')),
});
export type GeneratePaintingEstimateInput = z.infer<typeof GeneratePaintingEstimateInputSchema>;

const GeneratePaintingEstimateOutputSchema = z.object({
  estimatedPriceRange: z.string().describe('The estimated price range for the painting job.'),
  explanation: z.string().describe('A short explanation of how the price was calculated.'),
});
export type GeneratePaintingEstimateOutput = z.infer<typeof GeneratePaintingEstimateOutputSchema>;

export async function generatePaintingEstimate(input: GeneratePaintingEstimateInput): Promise<GeneratePaintingEstimateOutput> {
  return generatePaintingEstimateFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generatePaintingEstimatePrompt',
  input: {schema: GeneratePaintingEstimateInputSchema},
  output: {schema: GeneratePaintingEstimateOutputSchema},
  prompt: `You are a painting cost estimator AI.

  Based on the following information about the painting job, provide an estimated price range and a short explanation of how the price was calculated.

  Paint Areas:
  Ceiling Paint: {{paintAreas.ceilingPaint}}
  Wall Paint: {{paintAreas.wallPaint}}
  Trim Paint: {{paintAreas.trimPaint}}

  {{#if trimPaintOptions}}
  Trim Paint Options:
  Paint Type: {{trimPaintOptions.paintType}}
  Trim Items: {{#each trimPaintOptions.trimItems}}- {{this}}\n{{/each}}
  {{/if}}
  `,
});

const generatePaintingEstimateFlow = ai.defineFlow(
  {
    name: 'generatePaintingEstimateFlow',
    inputSchema: GeneratePaintingEstimateInputSchema,
    outputSchema: GeneratePaintingEstimateOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
