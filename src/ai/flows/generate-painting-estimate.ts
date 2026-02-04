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
  roomsToPaint: z.array(z.string()).optional().describe('The specific rooms selected to be painted (for Interior).'),
  exteriorAreas: z.array(z.string()).optional().describe('The specific exterior areas selected (for Exterior).'),
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

  # PRICING LOGIC & RULES
  - **Baseline Reference**: For a vacant 2-bedroom Apartment (rental/sale prep), the standard price for painting Ceilings, Walls, and Doors (using Super Enamel) is approximately **$3,542.30 AUD**.
  - **Property Type Multiplier**: 
    - Apartment: Baseline cost.
    - House or Unit: Add **20%** to the baseline cost due to increased complexity and surface area.
  - **Calculation Basis**: Estimates are calculated based on material costs (paint, supplies) and labor (number of painters x number of days required).
  - **Service Scope Adjustments**:
    - The baseline includes Ceilings, Walls, and Doors.
    - **Window Frames** and **Skirting Boards**: These are NOT included in the baseline and require meticulous, time-consuming labor. If these are selected in "Trim Items", increase the estimate significantly.
    - **Exterior Specifics**: Exterior work involving Eaves, Gutters, and Fascia requires specialized preparation and often heights equipment, increasing the cost compared to simple wall painting.
  - **Condition Surcharge**: 
    - Excellent: Standard rate.
    - Fair: Add 10-15% for minor preparation.
    - Poor: Add 25-40% for extensive sanding, patching, and priming.
  - **Difficulty Factors**: High ceilings, stairs, and difficult access add significant labor hours and equipment costs.

  # CUSTOMER INPUT DATA
  - Customer: {{name}} ({{email}}{{#if phone}}, {{phone}}{{/if}})
  - Location: {{#if location}}{{location}}{{else}}Not provided{{/if}}
  - Property: {{propertyType}}
  - Work Type: {{#each typeOfWork}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  - Scope: {{scopeOfPainting}} (Goal: {{timingPurpose}})
  
  {{#if roomsToPaint}}
  - Interior Areas: {{#each roomsToPaint}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  {{/if}}
  
  {{#if exteriorAreas}}
  - Exterior Areas: {{#each exteriorAreas}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  {{/if}}

  {{#if approxSize}}- Size: {{approxSize}} sqm{{/if}}
  {{#if existingWallColour}}- Current Color: {{existingWallColour}}{{/if}}

  # SELECTED SERVICES
  - Ceiling: {{#if paintAreas.ceilingPaint}}Yes{{else}}No{{/if}}
  - Walls: {{#if paintAreas.wallPaint}}Yes{{else}}No{{/if}}
  - Trim: {{#if paintAreas.trimPaint}}{{#if trimPaintOptions}}Yes ({{trimPaintOptions.paintType}} on {{#each trimPaintOptions.trimItems}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}){{else}}Yes (Specifics not provided){{/if}}{{else}}No{{/if}}

  # SITE CONDITIONS
  - Paint Condition: {{#if paintCondition}}{{paintCondition}}{{else}}Unknown{{/if}}
  - Challenges: {{#if jobDifficulty}}{{#each jobDifficulty}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{else}}None listed{{/if}}

  # OUTPUT INSTRUCTIONS
  1. Provide a realistic "Estimated Price Range" in AUD (e.g., "$4,200 - $4,800").
  2. Write an "Explanation" that:
     - Greets the customer by name professionally.
     - Specifically mentions how the property type ({{propertyType}}) and the selected areas (Interior/Exterior) influenced the base price.
     - If Windows or Skirting Boards were selected, explain that these require extra detail work and increased the labor cost.
     - Mention that the estimate factors in both high-quality materials and the expert labor (man-days) required for a professional finish.
     - Maintain a helpful, expert, and encouraging tone.
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
