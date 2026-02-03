'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  typeOfWork: z.array(z.enum(['Interior Painting', 'Exterior Painting'])).min(1, 'Please select at least one type of work.'),
  scopeOfPainting: z.enum(['Full painting', 'Partial painting']),
  propertyType: z.string().min(1, 'Property type is required.'),
  roomsToPaint: z.array(z.string()).optional(),
  approxSize: z.coerce.number().positive().optional(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Maintenance or refresh', 'Preparing for sale or rental']),
  wallCondition: z.array(z.enum(['Cracks', 'Mould', 'Stains or contamination'])).optional(),
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

export async function submitEstimate(formData: any, userId?: string) {
  if (!userId) {
    return { error: 'You must be logged in to get an estimate.' };
  }

  const validatedFields = estimateFormSchema.safeParse(formData);

  if (!validatedFields.success) {
    console.error(validatedFields.error.flatten().fieldErrors);
    return {
      error: 'Invalid form data. Please check your inputs.',
    };
  }

  try {
    const aiPayload = { ...validatedFields.data };
    // If trim paint is not selected, remove trimPaintOptions
    if (!aiPayload.paintAreas.trimPaint) {
        delete aiPayload.trimPaintOptions;
    }
    
    const estimate = await generatePaintingEstimate(aiPayload as any);

    await addDoc(collection(db, 'estimates'), {
      userId: userId,
      options: validatedFields.data,
      estimate,
      createdAt: serverTimestamp(),
    });

    return { data: estimate };
  } catch (error) {
    console.error('Error getting estimate or saving to Firestore:', error);
    return { error: 'Failed to generate estimate. Please try again.' };
  }
}
