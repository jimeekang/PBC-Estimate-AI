type TimestampValue = unknown;

export type EstimateRateLimitReservation = {
  reservedAt: number;
  previousLastSubmitAt: number;
  hourlyBucket: string;
  dailyBucket: string;
};

export type EstimateRateLimitState = {
  estimateCount?: number;
  lastSubmitAt?: number;
  hourlyBucket?: string;
  hourlyCount?: number;
  dailyBucket?: string;
  dailyCount?: number;
};

export type ExistingEstimateSnapshot = {
  userId?: unknown;
  status?: unknown;
  options?: unknown;
  inputSnapshot?: unknown;
  estimate?: unknown;
  photoPaths?: unknown;
  rateLimitReservation?: unknown;
  revision?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function resolvePreviousRevision(existing: ExistingEstimateSnapshot) {
  if (existing.status === 'draft' && existing.revision === 0) {
    return 0;
  }

  return typeof existing.revision === 'number' && Number.isFinite(existing.revision) && existing.revision > 0
    ? Math.floor(existing.revision)
    : 1;
}

export function canMutateEstimate(
  existing: Pick<ExistingEstimateSnapshot, 'userId'>,
  requesterUid: string,
  isAdmin: boolean
) {
  return isAdmin || existing.userId === requesterUid;
}

export function buildEstimateDraftPayload(args: {
  userId: string;
  timestamp: TimestampValue;
  rateLimitReservation?: EstimateRateLimitReservation;
}) {
  return {
    userId: args.userId,
    status: 'draft',
    revision: 0,
    photoPaths: [],
    ...(args.rateLimitReservation ? { rateLimitReservation: args.rateLimitReservation } : {}),
    createdAt: args.timestamp,
    updatedAt: args.timestamp,
  };
}

export function isEstimateRateLimitReservation(
  value: unknown
): value is EstimateRateLimitReservation {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<EstimateRateLimitReservation>;
  return (
    typeof candidate.reservedAt === 'number' &&
    Number.isFinite(candidate.reservedAt) &&
    typeof candidate.previousLastSubmitAt === 'number' &&
    Number.isFinite(candidate.previousLastSubmitAt) &&
    typeof candidate.hourlyBucket === 'string' &&
    typeof candidate.dailyBucket === 'string'
  );
}

export function buildRateLimitReleasePatch(
  state: EstimateRateLimitState | undefined,
  reservation?: EstimateRateLimitReservation
) {
  const patch: {
    estimateCount: number;
    lastSubmitAt?: number;
    hourlyCount?: number;
    dailyCount?: number;
  } = {
    estimateCount: Math.max(0, (state?.estimateCount ?? 0) - 1),
  };

  if (!reservation) {
    return patch;
  }

  if (state?.lastSubmitAt === reservation.reservedAt) {
    patch.lastSubmitAt = reservation.previousLastSubmitAt;
  }

  if (state?.hourlyBucket === reservation.hourlyBucket) {
    patch.hourlyCount = Math.max(0, (state.hourlyCount ?? 0) - 1);
  }

  if (state?.dailyBucket === reservation.dailyBucket) {
    patch.dailyCount = Math.max(0, (state.dailyCount ?? 0) - 1);
  }

  return patch;
}

export function buildEstimateCreatePayload(args: {
  userId: string;
  inputSnapshot: unknown;
  estimate: unknown;
  photoPaths: string[];
  timestamp: TimestampValue;
}) {
  return {
    userId: args.userId,
    status: 'generated',
    revision: 1,
    inputSnapshot: args.inputSnapshot,
    options: args.inputSnapshot,
    estimate: args.estimate,
    photoPaths: args.photoPaths,
    createdAt: args.timestamp,
    updatedAt: args.timestamp,
  };
}

export function buildEstimateUpdatePayload(args: {
  existing: ExistingEstimateSnapshot;
  inputSnapshot: unknown;
  estimate: unknown;
  photoPaths: string[];
  timestamp: TimestampValue;
}) {
  const previousRevision = resolvePreviousRevision(args.existing);
  const previousVersion = {
    options: args.existing.options,
    inputSnapshot: args.existing.inputSnapshot,
    estimate: args.existing.estimate,
    photoPaths: args.existing.photoPaths,
    revision: previousRevision,
    createdAt: args.existing.createdAt,
    updatedAt: args.existing.updatedAt,
  };

  return {
    previousRevision,
    versionId: String(previousRevision),
    previousVersion,
    update: {
      status: 'generated',
      revision: previousRevision + 1,
      inputSnapshot: args.inputSnapshot,
      options: args.inputSnapshot,
      estimate: args.estimate,
      photoPaths: args.photoPaths,
      updatedAt: args.timestamp,
    },
  };
}
