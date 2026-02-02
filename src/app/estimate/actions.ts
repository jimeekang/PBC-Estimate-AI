'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';

const estimateFormSchema = z.object({
  paintAreas: z.object({
    ceilingPaint: z.boolean(),
    wallPaint: z.boolean(),
    trimPaint: z.boolean(),
  }),
  trimPaintOptions: z.optional(
    z.object({
      paintType: z.enum(['Oil-based', 'Water-based']),
      trimItems: z.array(z.enum(['Doors', 'Window Frames', 'Skirting Boards'])),
    })
  ),
});

export async function submitEstimate(prevState: any, formData: z.infer<typeof estimateFormSchema>) {
  const user = auth.currentUser;
  if (!user) {
    return { error: 'You must be logged in to get an estimate.' };
  }

  const validatedFields = estimateFormSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: 'Invalid form data.',
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
