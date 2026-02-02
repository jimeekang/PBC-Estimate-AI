'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
  typeOfWork: z.enum(['Interior Painting', 'Exterior Painting', 'Timber']),
  scopeOfPainting: z.enum(['Full painting', 'Partial painting']),
  propertyType: z.string().min(1, 'Property type is required.'),
  numberOfRooms: z.coerce.number().positive().optional(),
  approxSize: z.coerce.number().positive().optional(),
  existingWallColour: z.string().optional(),
  location: z.string().optional(),
  timingPurpose: z.enum(['Ready to proceed', 'Budget only']),
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
}).refine(data => {
    return !data.paintAreas.trimPaint || (data.paintAreas.trimPaint && data.trimPaintOptions && data.trimPaintOptions.paintType && data.trimPaintOptions.trimItems.length > 0);
}, {
    message: 'Please select trim paint options',
    path: ['trimPaintOptions'],
});

export async function submitEstimate(prevState: any, formData: z.infer<typeof estimateFormSchema>) {
  const user = auth.currentUser;
  if (!user) {
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
    const aiPayload = validatedFields.data;
    if (!aiPayload.paintAreas.trimPaint) {
        // @ts-ignore
        delete aiPayload.trimPaintOptions;
    }
    
    const estimate = await generatePaintingEstimate(aiPayload);

    await addDoc(collection(db, 'estimates'), {
      userId: user.uid,
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
