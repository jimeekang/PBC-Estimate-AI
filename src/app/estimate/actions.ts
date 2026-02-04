'use server';

import { generatePaintingEstimate } from '@/ai/flows/generate-painting-estimate';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp, query, where, getCountFromServer } from 'firebase/firestore';
import { z } from 'zod';

const estimateFormSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  email: z.string().email('Invalid email address.'),
  phone: z.string().optional(),
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

export async function submitEstimate(formData: any, userId?: string) {
  if (!userId) {
    return { error: 'You must be logged in to get an estimate.' };
  }

  try {
    const estimatesRef = collection(db, 'estimates');
    const q = query(estimatesRef, where('userId', '==', userId));
    const snapshot = await getCountFromServer(q);
    const count = snapshot.data().count;

    if (count >= 2) {
      return { 
        error: 'You have reached your limit of 2 free estimates. Please contact support for more.',
        limitReached: true
      };
    }

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

    await addDoc(collection(db, 'estimates'), {
      userId: userId,
      options: rawData,
      estimate,
      createdAt: serverTimestamp(),
    });

    return { data: estimate };
  } catch (error: any) {
    console.error('Error generating estimate:', error);
    return { error: 'Failed to generate estimate. ' + (error.message || 'Please try again later.') };
  }
}

export async function getEstimateCount(userId: string) {
  if (!userId) return 0;
  try {
    const estimatesRef = collection(db, 'estimates');
    const q = query(estimatesRef, where('userId', '==', userId));
    const snapshot = await getCountFromServer(q);
    return snapshot.data().count;
  } catch (err) {
    console.error('Error fetching count from Firestore:', err);
    // 보안 규칙 위반 시 콘솔에 로그가 찍히며 0이 반환될 수 있으므로 주의 깊게 확인이 필요합니다.
    return 0;
  }
}
