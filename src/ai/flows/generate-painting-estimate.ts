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
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional().describe('The current condition of the existing paint.'),
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
  prompt: `
  # ROLE
  You are an expert Painting Cost Estimator for "Paint Buddy & Co quote pro", a premier painting service in Australia. 
  Your goal is to provide a realistic, professional, and helpful price estimate based on market rates and specific business logic.

  # PRICING LOGIC & RULES (Update this section with your detailed criteria)
  - Base Rate: Use professional Australian market rates for labor and materials.
  - Property Type Factor: Houses generally require more prep than apartments.
  - Condition Surcharge: 
    - Fair: Add 10-15% for minor prep.
    - Poor: Add 25-40% for extensive sanding, patching, and priming.
  - Difficulty Surcharge: High ceilings, stairs, and difficult access add significant labor hours.
  - Trim Work: Oil-based paint for trims is more labor-intensive and expensive than water-based.
  - Purpose: "Preparing for sale" might require a more premium finish or specific color advice.

  # CUSTOMER INPUT DATA
  - Customer: {{name}} ({{email}}{{#if phone}}, {{phone}}{{/if}})
  - Location: {{#if location}}{{location}}{{else}}Not provided{{/if}}
  - Property: {{propertyType}}
  - Work Type: {{#each typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  - Scope: {{scopeOfPainting}} (Goal: {{timingPurpose}})
  {{#if roomsToPaint}}- Areas: {{#each roomsToPaint}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
  {{#if approxSize}}- Size: {{approxSize}} sqm{{/if}}
  {{#if existingWallColour}}- Current Color: {{existingWallColour}}{{/if}}

  # SELECTED SERVICES
  - Ceiling: {{#if paintAreas.ceilingPaint}}Yes{{else}}No{{/if}}
  - Walls: {{#if paintAreas.wallPaint}}Yes{{else}}No{{/if}}
  - Trim: {{#if paintAreas.trimPaint}}Yes ({{trimPaintOptions.paintType}} on {{#each trimPaintOptions.trimItems}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}){{else}}No{{/if}}

  # SITE CONDITIONS
  - Paint Condition: {{#if paintCondition}}{{paintCondition}}{{else}}Unknown{{/if}}
  - Challenges: {{#if jobDifficulty}}{{#each jobDifficulty}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None listed{{/if}}

  # OUTPUT INSTRUCTIONS
  1. Provide a realistic "Estimated Price Range" in AUD (e.g., "$2,200 - $3,100").
  2. Write a "Explanation" that:
     - Greets the customer by name professionally.
     - Briefly lists the primary factors driving the cost (e.g., "The 'Poor' condition of the current walls requires extensive preparation...").
     - Mentions how the difficulty factors (like {{#each jobDifficulty}}{{this}} {{/each}}) were factored in.
     - Keeps the tone helpful, expert, and encouraging.
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
