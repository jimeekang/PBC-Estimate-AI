'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { z } from 'zod';

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().min(1, 'Phone number is required.'),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Entire property', 'Specific areas only']),
  propertyType: z.string().min(1, 'Property type is required.'),
  roomsToPaint: z.array(z.string()).optional(),
  exteriorAreas: z.array(z.string()).optional(),
  approxSize: z.coerce.number().positive().optional().nullable(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  paintCondition: z.enum(['Excellent', 'Fair', 'Poor']).optional(),
  jobDifficulty: z.array(z.enum(['Stairs', 'High ceilings', 'Extensive mouldings or trims', 'Difficult access areas'])).optional(),

  paintAreas: z.object({
    ceilingPaint: z.boolean().default(false),
    wallPaint: z.boolean().default(false),
    trimPaint: z.boolean().default(false),
  }).default({}),
  trimPaintOptions: z.optional(
    z.object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
  ),
});

export async function submitEstimate(formData: any) {
  try {
    const validatedFields = estimateFormSchema.safeParse(formData);

    if (!validatedFields.success) {
      console.error('Validation Error:', validatedFields.error.flatten().fieldErrors);
      return {
        error: 'Invalid form data. Please check all required fields.',
      };
    }

    const rawData = validatedFields.data;
    const aiPayload: any = {
      ...rawData,
      approxSize: rawData.approxSize || undefined,
    };

    if (!aiPayload.paintAreas.trimPaint) {
        delete aiPayload.trimPaintOptions;
    }
    
    const estimate = await generatePaintingEstimate(aiPayload);

    return { data: estimate };
  } catch (error: any) {
    console.error('Error generating estimate:', error);
    return { error: 'Failed to generate estimate. ' + (error.message || 'Please try again later.') };
  }
}
