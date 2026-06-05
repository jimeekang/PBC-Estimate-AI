'use server';

import { calculateLiteEstimate } from '@/domains/estimate/application/lite/lite-estimate';
import { liteEstimateSchema } from '@/domains/estimate/domain/schemas/estimate-lite';

export async function submitLiteEstimate(payload: unknown) {
  const validated = liteEstimateSchema.safeParse(payload);

  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    return { error: firstIssue?.message || 'Invalid quick estimate request.' };
  }

  try {
    const result = calculateLiteEstimate(validated.data);
    return { data: result };
  } catch (error) {
    console.error('Failed to create lite estimate:', error);
    return { error: 'Failed to create your quick estimate. Please try again.' };
  }
}
