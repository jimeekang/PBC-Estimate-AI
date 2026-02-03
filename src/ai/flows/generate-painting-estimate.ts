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
  name: z.string().describe('The name of the customer.'),
  email: z.string().describe('The email of the customer.'),
  phone: z.string().optional().describe('The phone number of the customer.'),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).describe('The type of work to be done.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']).describe('The scope of the painting job.'),
  propertyType: z.string().describe('The type of property.'),
  roomsToPaint: z.array(z.string()).optional().describe('The specific rooms selected to be painted.'),
  approxSize: z.number().optional().describe('The approximate size of the area to be painted in square meters.'),
  existingWallColour: z.string().optional().describe('The existing wall colour.'),
  location: z.string().optional().describe('The location of the property.'),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']).describe('The reason/purpose for the painting job.'),
  wallCondition: z.array(z.enum(['Cracks', 'Mould', 'Stains or contamination'])).optional().describe('The condition of the walls.'),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional().describe('Factors contributing to job difficulty.'),

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
  prompt: `You are a painting cost estimator AI for a company called "PBC quote pro".
  Your estimates should be professional and based on Australian market rates.

  A customer has requested an estimate. Here is the information they provided:

  **Customer Details:**
  - Name: {{name}}
  - Email: {{email}}
  {{#if phone}}- Phone: {{phone}}{{/if}}
  - Location: {{#if location}}{{location}}{{else}}Not provided{{/if}}

  **Job Details:**
  - Property Type: {{propertyType}}
  - Type of Work: {{#each typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  - Scope: {{scopeOfPainting}}
  - Reason for painting: {{timingPurpose}}
  {{#if roomsToPaint}}
  - Rooms/Areas to Paint: {{#each roomsToPaint}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  {{/if}}
  {{#if approxSize}}- Approx. Size (sqm): {{approxSize}}{{/if}}
  {{#if existingWallColour}}- Existing Wall Colour: {{existingWallColour}}{{/if}}

  **Areas to Paint:**
  - Ceiling: {{#if paintAreas.ceilingPaint}}Yes{{else}}No{{/if}}
  - Walls: {{#if paintAreas.wallPaint}}Yes{{else}}No{{/if}}
  - Trim: {{#if paintAreas.trimPaint}}Yes{{else}}No{{/if}}

  {{#if paintAreas.trimPaint}}
  **Trim Details:**
    {{#if trimPaintOptions}}
    - Paint Type: {{trimPaintOptions.paintType}}
    - Items: {{#each trimPaintOptions.trimItems}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
    {{else}}
    - No specific trim details provided.
    {{/if}}
  {{/if}}

  **Conditions & Difficulty:**
  {{#if wallCondition}}
  - Wall Condition: {{#each wallCondition}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} (This may require extra preparation work like filling cracks, treating mould, or applying stain blocker, which will increase the cost).
  {{/if}}
  {{#if jobDifficulty}}
  - Job Difficulty Factors: {{#each jobDifficulty}}{{this}}{{#unless @last}}, {{/unless}}{{/each}} (Factors like high ceilings, stairs, and difficult access will increase labor costs).
  {{/if}}

  Based on all this information, provide a realistic estimated price range (e.g., "$1500 - $2500") and a concise, friendly explanation for the estimate.
  The explanation should briefly mention the key factors that influenced the price, such as the scope, conditions, and difficulty.
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
