'use server';

import { z } from 'zod';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const getDashboardDataSchema = z.object({
  idToken: z.string().min(1, 'Authentication is required.'),
});

function getTimestampMillis(value: unknown) {
  if (!value || typeof value !== 'object') return 0;
  if ('toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if ('seconds' in value && typeof value.seconds === 'number') {
    return value.seconds * 1000;
  }
  return 0;
}

export async function getDashboardData(payload: unknown) {
  const validated = getDashboardDataSchema.safeParse(payload);

  if (!validated.success) {
    return { error: 'Authentication is required.' };
  }

  try {
    const adminAuth = getAdminAuth();
    const adminDb = getAdminDb();
    const decodedToken = await adminAuth.verifyIdToken(validated.data.idToken);

    const estimateCountPromise = adminDb
      .collection('estimates')
      .where('userId', '==', decodedToken.uid)
      .count()
      .get();

    const estimatesSnapshotPromise = adminDb
      .collection('estimates')
      .where('userId', '==', decodedToken.uid)
      .get();

    const [estimateCountSnapshot, estimatesSnapshot] = await Promise.all([
      estimateCountPromise,
      estimatesSnapshotPromise,
    ]);

    const estimates = estimatesSnapshot.docs
      .map((doc) => {
        const data = doc.data() as {
          options?: {
            typeOfWork?: string[];
            location?: string;
          };
          estimate?: {
            priceRange?: string;
          };
          createdAt?: unknown;
        };

        return {
          id: doc.id,
          priceRange: data.estimate?.priceRange ?? 'N/A',
          typeOfWork: data.options?.typeOfWork ?? [],
          location: data.options?.location ?? '',
          createdAtMs: getTimestampMillis(data.createdAt),
        };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);

    const estimateCount = estimateCountSnapshot.data().count;

    return {
      estimateCount,
      remainingEstimates: Math.max(0, 2 - estimateCount),
      estimates,
    };
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    return { error: 'Failed to load your estimate history.' };
  }
}
