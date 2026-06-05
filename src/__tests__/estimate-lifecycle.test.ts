import {
  buildEstimateCreatePayload,
  buildEstimateDraftPayload,
  buildEstimateUpdatePayload,
  buildRateLimitReleasePatch,
  canMutateEstimate,
  type EstimateRateLimitReservation,
} from '@/lib/estimate-lifecycle';

const inputSnapshot = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '0412 345 678',
};

const estimate = {
  total: 1200,
  breakdown: [],
};

describe('estimate lifecycle helpers', () => {
  it('builds an empty draft document before photo upload', () => {
    const timestamp = { serverTimestamp: true };

    const result = buildEstimateDraftPayload({
      userId: 'user-1',
      timestamp,
    });

    expect(result).toEqual({
      userId: 'user-1',
      status: 'draft',
      revision: 0,
      photoPaths: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it('stores rate-limit reservation metadata on draft documents', () => {
    const timestamp = { serverTimestamp: true };
    const rateLimitReservation: EstimateRateLimitReservation = {
      reservedAt: 1700000000000,
      previousLastSubmitAt: 1699999990000,
      hourlyBucket: '2023-11-14T22',
      dailyBucket: '2023-11-14',
    };

    const result = buildEstimateDraftPayload({
      userId: 'user-1',
      timestamp,
      rateLimitReservation,
    });

    expect(result.rateLimitReservation).toEqual(rateLimitReservation);
  });

  it('builds a generated revision-one document for new estimates', () => {
    const timestamp = { serverTimestamp: true };

    const result = buildEstimateCreatePayload({
      userId: 'user-1',
      inputSnapshot,
      estimate,
      photoPaths: ['uploads/photo.jpg'],
      timestamp,
    });

    expect(result).toEqual({
      userId: 'user-1',
      status: 'generated',
      revision: 1,
      inputSnapshot,
      options: inputSnapshot,
      estimate,
      photoPaths: ['uploads/photo.jpg'],
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  });

  it('increments revision and snapshots the previous estimate before update', () => {
    const timestamp = { serverTimestamp: true };
    const existing = {
      options: { old: 'options' },
      inputSnapshot: { old: 'input' },
      estimate: { old: 'estimate' },
      photoPaths: ['old/photo.jpg'],
      revision: 3,
      createdAt: { seconds: 1 },
      updatedAt: { seconds: 2 },
    };

    const result = buildEstimateUpdatePayload({
      existing,
      inputSnapshot,
      estimate,
      photoPaths: ['new/photo.jpg'],
      timestamp,
    });

    expect(result.previousRevision).toBe(3);
    expect(result.versionId).toBe('3');
    expect(result.previousVersion).toEqual(existing);
    expect(result.update).toEqual({
      status: 'generated',
      revision: 4,
      inputSnapshot,
      options: inputSnapshot,
      estimate,
      photoPaths: ['new/photo.jpg'],
      updatedAt: timestamp,
    });
  });

  it('promotes a draft to generated revision one on first submit', () => {
    const timestamp = { serverTimestamp: true };
    const existing = {
      userId: 'user-1',
      status: 'draft',
      revision: 0,
      photoPaths: [],
      createdAt: { seconds: 1 },
      updatedAt: { seconds: 1 },
    };

    const result = buildEstimateUpdatePayload({
      existing,
      inputSnapshot,
      estimate,
      photoPaths: ['new/photo.jpg'],
      timestamp,
    });

    expect(result.previousRevision).toBe(0);
    expect(result.versionId).toBe('0');
    expect(result.update).toEqual({
      status: 'generated',
      revision: 1,
      inputSnapshot,
      options: inputSnapshot,
      estimate,
      photoPaths: ['new/photo.jpg'],
      updatedAt: timestamp,
    });
  });

  it('treats legacy estimates without revision as revision one before update', () => {
    const result = buildEstimateUpdatePayload({
      existing: {
        options: { old: 'options' },
        estimate: { old: 'estimate' },
        photoPaths: [],
      },
      inputSnapshot,
      estimate,
      photoPaths: [],
      timestamp: 'now',
    });

    expect(result.previousRevision).toBe(1);
    expect(result.versionId).toBe('1');
    expect(result.previousVersion.revision).toBe(1);
    expect(result.update.revision).toBe(2);
  });

  it('allows owners and admins to mutate an estimate', () => {
    expect(canMutateEstimate({ userId: 'user-1' }, 'user-1', false)).toBe(true);
    expect(canMutateEstimate({ userId: 'user-2' }, 'user-1', true)).toBe(true);
    expect(canMutateEstimate({ userId: 'user-2' }, 'user-1', false)).toBe(false);
  });

  it('rolls back every counter reserved by a matching rate-limit reservation', () => {
    const reservation: EstimateRateLimitReservation = {
      reservedAt: 1700000000000,
      previousLastSubmitAt: 1699999990000,
      hourlyBucket: '2023-11-14T22',
      dailyBucket: '2023-11-14',
    };

    const result = buildRateLimitReleasePatch(
      {
        estimateCount: 2,
        lastSubmitAt: reservation.reservedAt,
        hourlyBucket: reservation.hourlyBucket,
        hourlyCount: 3,
        dailyBucket: reservation.dailyBucket,
        dailyCount: 4,
      },
      reservation
    );

    expect(result).toEqual({
      estimateCount: 1,
      lastSubmitAt: reservation.previousLastSubmitAt,
      hourlyCount: 2,
      dailyCount: 3,
    });
  });

  it('does not rewind lastSubmitAt when a newer reservation is present', () => {
    const reservation: EstimateRateLimitReservation = {
      reservedAt: 1700000000000,
      previousLastSubmitAt: 1699999990000,
      hourlyBucket: '2023-11-14T22',
      dailyBucket: '2023-11-14',
    };

    const result = buildRateLimitReleasePatch(
      {
        estimateCount: 2,
        lastSubmitAt: 1700000005000,
        hourlyBucket: reservation.hourlyBucket,
        hourlyCount: 2,
        dailyBucket: reservation.dailyBucket,
        dailyCount: 2,
      },
      reservation
    );

    expect(result).toEqual({
      estimateCount: 1,
      hourlyCount: 1,
      dailyCount: 1,
    });
  });

  it('leaves counters from newer buckets untouched while still releasing the estimate count', () => {
    const reservation: EstimateRateLimitReservation = {
      reservedAt: 1700000000000,
      previousLastSubmitAt: 0,
      hourlyBucket: '2023-11-14T22',
      dailyBucket: '2023-11-14',
    };

    const result = buildRateLimitReleasePatch(
      {
        estimateCount: 1,
        lastSubmitAt: reservation.reservedAt,
        hourlyBucket: '2023-11-14T23',
        hourlyCount: 1,
        dailyBucket: '2023-11-15',
        dailyCount: 1,
      },
      reservation
    );

    expect(result).toEqual({
      estimateCount: 0,
      lastSubmitAt: 0,
    });
  });
});
