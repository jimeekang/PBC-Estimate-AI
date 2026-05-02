import { MAX_PRICE_CAP, clamp } from '@/lib/pricing-engine';

export function clampInteriorRangeForOutput(
  min: number,
  max: number,
  allowZeroFloor: boolean
): { min: number; max: number } {
  const floorMin = allowZeroFloor ? 0 : 800;
  const clampedMin = clamp(min, floorMin, MAX_PRICE_CAP);
  const floorMax = allowZeroFloor ? clampedMin : 1200;
  let clampedMax = clamp(max, floorMax, MAX_PRICE_CAP);

  if (clampedMax < clampedMin) {
    clampedMax = Math.min(MAX_PRICE_CAP, Math.round(clampedMin * 1.18));
  }

  return { min: clampedMin, max: clampedMax };
}
