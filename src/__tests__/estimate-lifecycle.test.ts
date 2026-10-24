import {
  assertEstimateQuotaAvailable,
  buildEstimateCreatePayload,
  buildEstimateDraftPayload,
  buildEstimateUpdatePayload,
  buildRateLimitReleasePatch,
  canMutateEstimate,
  countQuotaUsage,
  isStaleDraft,
  type EstimateRateLimitReservation,
} from '@/lib/estimate-lifecycle';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { cleanupEstimateDraft, createEstimateDraft, getEstimateQuotaStatus, submitEstimate } from '@/app/estimate/actions';
import { generatePaintingEstimate } from '@/domains/estimate/application/generation/generate-painting-estimate';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import type { ExistingEstimateSnapshot } from '@/domains/estimate/application/lifecycle/estimate-lifecycle';

jest.mock('@/lib/firebase-admin', () => ({ getAdminAuth: jest.fn(), getAdminDb: jest.fn() }));
jest.mock('@/domains/estimate/application/generation/generate-painting-estimate', () => ({
  generatePaintingEstimate: jest.fn(async () => ({ total: 1200, breakdown: [] })),
}));

const inputSnapshot = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '0412 345 678',
};

const estimate = {
  total: 1200,
  breakdown: [],
};

// Serialize transactions to model Firestore's document locks and apply field deletions.
function installQuotaDb(estimates: Record<string, ExistingEstimateSnapshot>, hideOutsideTransaction = false, isAdmin = false) {
  type Ref = { path: string; id: string; collection: (name: string) => ReturnType<typeof collection> };
  type Query = { filters: [string, unknown][]; get: () => Promise<ReturnType<typeof querySnapshot>> };
  const documents = new Map<string, Record<string, unknown>>(
    Object.entries(estimates).map(([id, data]) => [`estimates/${id}`, { userId: 'user-1', ...data }])
  );
  let nextId = 0;
  const documentSnapshot = (ref: Ref) => ({
    id: ref.id, ref, exists: documents.has(ref.path), data: () => documents.get(ref.path),
  });
  const querySnapshot = (query: Query, hidden = false) => ({
    docs: hidden ? [] : [...documents.entries()]
      .filter(([path, data]) => path.startsWith('estimates/') && path.split('/').length === 2 &&
        query.filters.every(([field, value]) => data[field] === value))
      .map(([path]) => documentSnapshot(reference(path))),
  });
  const reference = (path: string): Ref => ({
    path, id: path.split('/').at(-1)!, collection: (name) => collection(`${path}/${name}`),
    ...{ get: async () => documentSnapshot(reference(path)) },
  });
  const makeQuery = (filters: [string, unknown][]): Query => ({
    filters,
    get: async () => querySnapshot(makeQuery(filters), hideOutsideTransaction),
    ...{
      where: (field: string, _op: string, value: unknown) => makeQuery([...filters, [field, value]]),
      count: () => ({ get: async () => ({ data: () => ({ count: querySnapshot(makeQuery(filters)).docs.length }) }) }),
    },
  });
  function collection(path: string) {
    return {
      doc: (id = `new-${++nextId}`) => reference(`${path}/${id}`),
      where: (field: string, _op: string, value: unknown) => makeQuery([[field, value]]),
    };
  }
  const transactionQueries: Query[] = [];
  let transactionQueue = Promise.resolve();
  const db = {
    collection,
    runTransaction: (callback: (transaction: unknown) => Promise<unknown>) => {
      const result = transactionQueue.then(async () => {
        const writes: (() => void)[] = [];
        const transaction = {
          get: async (target: Ref | Query) => {
            if (writes.length) throw new Error('Transaction read after write');
            if ('filters' in target) {
              transactionQueries.push(target);
              return querySnapshot(target);
            }
            return documentSnapshot(target);
          },
          set: (ref: Ref, value: Record<string, unknown>, options?: { merge: boolean }) => {
            writes.push(() => {
              const next = { ...(options?.merge ? documents.get(ref.path) : {}), ...value };
              for (const [key, field] of Object.entries(value)) {
                if (field instanceof FieldValue && field.isEqual(FieldValue.delete())) delete next[key];
              }
              documents.set(ref.path, next);
            });
          },
          delete: (ref: Ref) => writes.push(() => { documents.delete(ref.path); }),
        };
        const value = await callback(transaction);
        writes.forEach((write) => write());
        return value;
      });
      transactionQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  jest.mocked(getAdminDb).mockReturnValue(db as unknown as ReturnType<typeof getAdminDb>);
  jest.mocked(getAdminAuth).mockReturnValue({
    verifyIdToken: async () => ({ uid: 'user-1', email: 'test@example.com', email_verified: true, admin: isAdmin }),
  } as unknown as ReturnType<typeof getAdminAuth>);
  return { documents, transactionQueries, db };
}

describe('estimate actions quota transactions', () => {
  const formData = {
    ...inputSnapshot, typeOfWork: ['Interior Painting'], scopeOfPainting: 'Entire property',
    propertyType: 'Apartment', apartmentStructure: '2Bed2Bath', approxSize: 85,
    timingPurpose: 'Maintenance or refresh',
    paintAreas: { ceilingPaint: true, wallPaint: true, trimPaint: false, ensuitePaint: false },
  };
  let consoleError: jest.SpyInstance;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.mocked(generatePaintingEstimate).mockClear();
    jest.useFakeTimers().setSystemTime(new Date('2026-10-24T05:10:00Z'));
  });
  afterEach(() => { consoleError.mockRestore(); jest.useRealTimers(); });

  it.each(['draft', 'generated'])('allows an admin third %s creation but rejects another within 30 seconds', async (kind) => {
    const { documents } = installQuotaDb({ first: { estimate }, second: { estimate } }, false, true);
    const create = () => kind === 'draft'
      ? createEstimateDraft({ idToken: 'token' })
      : submitEstimate({ idToken: 'token', formData });
    expect(await create()).toMatchObject({ estimateCount: 0, limitReached: false });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ hourlyCount: 1, dailyCount: 1 });
    const calls = jest.mocked(generatePaintingEstimate).mock.calls.length;
    expect(await create()).toMatchObject({ error: expect.stringContaining('30 seconds') });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(calls);
  });

  it.each([false, true])('rate limits revisions with full quota (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({
      first: { status: 'generated', revision: 1 }, second: { estimate },
    }, false, isAdmin);
    const revise = () => submitEstimate({ idToken: 'token', estimateId: 'first', formData });
    expect(await revise()).toMatchObject({ estimateId: 'first', revision: 2 });
    expect(await revise()).toMatchObject({ error: expect.stringContaining('30 seconds') });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_000);
    expect(await revise()).toMatchObject({ estimateId: 'first', revision: 3 });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ hourlyCount: 2, dailyCount: 2 });
  });

  it.each([false, true])('reuses a server draft reservation only for the first promotion (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({}, false, isAdmin);
    const draft = await createEstimateDraft({ idToken: 'token' });
    expect(draft).toMatchObject({ revision: 0 });
    const reservedState = { ...documents.get('estimateRateLimits/user-1') };
    const submit = () => submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData });
    expect(await submit()).toMatchObject({ estimateId: draft.estimateId, revision: 1 });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({
      lastSubmitAt: reservedState.lastSubmitAt, hourlyCount: 1, dailyCount: 1,
    });
    expect(await submit()).toMatchObject({ error: expect.stringContaining('30 seconds') });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
  });

  it.each([undefined, { reservedAt: 'invalid' }])('rate limits a draft without a valid reservation: %p', async (rateLimitReservation) => {
    installQuotaDb({ draft: { status: 'draft', revision: 0, rateLimitReservation } });
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ revision: 0 });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'draft', formData })).toMatchObject({
      error: expect.stringContaining('30 seconds'),
    });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
  });

  it('rejects a quota-exceeding draft promotion before AI or rate counters are consumed', async () => {
    const { documents } = installQuotaDb({
      first: { estimate }, second: { estimate },
      draft: { status: 'draft', revision: 0, createdAt: Timestamp.fromMillis(Date.now() - 31 * 60_000) },
    });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'draft', formData })).toMatchObject({
      error: expect.stringContaining('2 free estimates'), limitReached: true,
    });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.has('estimateRateLimits/user-1')).toBe(false);
  });

  it('checks ownership before consuming rate counters or invoking AI', async () => {
    const { documents } = installQuotaDb({ other: { userId: 'other-user', status: 'generated', revision: 1 } });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'other', formData })).toMatchObject({
      error: 'You do not have permission to update this estimate.',
    });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.has('estimateRateLimits/user-1')).toBe(false);
  });

  it('does not reuse another owner draft reservation for an admin request', async () => {
    const { documents } = installQuotaDb({ other: {
      userId: 'other-user', status: 'draft', revision: 0,
      rateLimitReservation: {
        reservedAt: Date.now(), previousLastSubmitAt: 0,
        hourlyBucket: new Date().toISOString().slice(0, 13), dailyBucket: new Date().toISOString().slice(0, 10),
      },
    } }, false, true);
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ revision: 0 });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'other', formData })).toMatchObject({
      error: expect.stringContaining('30 seconds'),
    });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.get('estimates/other')).toMatchObject({ revision: 0 });
  });

  it('retains the transactional quota recheck when quota changes after promotion preflight', async () => {
    const { documents, transactionQueries } = installQuotaDb({
      first: { estimate }, second: { estimate }, draft: { status: 'draft', revision: 0 },
    }, true);
    expect(await submitEstimate({ idToken: 'token', estimateId: 'draft', formData })).toMatchObject({
      error: expect.stringContaining('2 free estimates'), limitReached: true,
    });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
    expect(transactionQueries.map((query) => query.filters)).toEqual([[['userId', 'user-1']]]);
    expect(documents.get('estimates/draft')).toMatchObject({ status: 'draft', revision: 0 });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ lastSubmitAt: 0, hourlyCount: 0, dailyCount: 0 });
  });

  it('releases an admin new-estimate reservation after AI failure', async () => {
    const { documents } = installQuotaDb({}, false, true);
    jest.mocked(generatePaintingEstimate).mockRejectedValueOnce(new Error('AI unavailable'));
    expect(await submitEstimate({ idToken: 'token', formData })).toMatchObject({
      error: expect.stringContaining('AI unavailable'),
    });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ lastSubmitAt: 0, hourlyCount: 0, dailyCount: 0 });
    expect(await submitEstimate({ idToken: 'token', formData })).toMatchObject({ estimateCount: 0, limitReached: false });
  });

  it.each([false, true])('releases the current revision reservation after AI failure (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({ first: { status: 'generated', revision: 1 } }, false, isAdmin);
    jest.mocked(generatePaintingEstimate).mockRejectedValueOnce(new Error('AI unavailable'));
    expect(await submitEstimate({ idToken: 'token', estimateId: 'first', formData })).toMatchObject({
      error: expect.stringContaining('AI unavailable'),
    });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ lastSubmitAt: 0, hourlyCount: 0, dailyCount: 0 });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'first', formData })).toMatchObject({ revision: 2 });
  });

  it.each([false, true])('consumes the draft reservation even after a failed first promotion (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({}, false, isAdmin);
    const draft = await createEstimateDraft({ idToken: 'token' });
    const state = { ...documents.get('estimateRateLimits/user-1') };
    jest.mocked(generatePaintingEstimate).mockRejectedValueOnce(new Error('AI unavailable'));
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })).toMatchObject({ error: expect.any(String) });
    expect(documents.get('estimateRateLimits/user-1')).toEqual(state);
    expect(documents.get(`estimates/${draft.estimateId}`)).not.toHaveProperty('rateLimitReservation');
    expect(documents.get(`estimates/${draft.estimateId}`)).toHaveProperty('reservationClaimedAt');
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })).toMatchObject({
      error: expect.stringContaining('30 seconds'),
    });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(30_000);
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })).toMatchObject({ revision: 1 });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ hourlyCount: 2, dailyCount: 2 });
  });

  it.each([false, true])('blocks repeated submit/cleanup loops without refunding consumed rate counters (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({}, false, isAdmin);
    const draft = await createEstimateDraft({ idToken: 'token' });
    let release!: () => void;
    let started!: () => void;
    const aiStarted = new Promise<void>((resolve) => { started = resolve; });
    jest.mocked(generatePaintingEstimate).mockImplementationOnce(() => {
      started();
      return new Promise((resolve) => { release = () => resolve(estimate as never); });
    });
    const submitting = submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData });
    await aiStarted;
    expect(await cleanupEstimateDraft({ idToken: 'token', estimateId: draft.estimateId })).toEqual({ deleted: true, released: true });
    release();
    expect(await submitting).toMatchObject({ error: 'Estimate not found.' });
    for (let attempt = 0; attempt < 7; attempt++) {
      expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ error: expect.stringContaining('30 seconds') });
    }
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({
      lastSubmitAt: Date.now(), hourlyCount: 1, dailyCount: 1,
    });
  });

  it.each([false, true])('allows only one of six parallel submissions to claim a draft reservation (admin=%s)', async (isAdmin) => {
    installQuotaDb({}, false, isAdmin);
    const draft = await createEstimateDraft({ idToken: 'token' });
    const results = await Promise.all(Array.from({ length: 6 }, () =>
      submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })));
    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error?.includes('30 seconds'))).toHaveLength(5);
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
  });

  it('does not invoke AI if cleanup refunds the draft between preflight and claim', async () => {
    const { documents, db } = installQuotaDb({});
    const draft = await createEstimateDraft({ idToken: 'token' });
    const runTransaction = db.runTransaction;
    jest.spyOn(db, 'runTransaction').mockImplementationOnce(async (callback) => {
      expect(await cleanupEstimateDraft({ idToken: 'token', estimateId: draft.estimateId })).toMatchObject({ deleted: true });
      return runTransaction(callback);
    });
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })).toMatchObject({ error: 'Estimate not found.' });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ lastSubmitAt: 0, hourlyCount: 0, dailyCount: 0 });
  });

  it.each([false, true])('allows the first draft promotion with uploaded photos (admin=%s)', async (isAdmin) => {
    const { documents } = installQuotaDb({}, false, isAdmin);
    const draft = await createEstimateDraft({ idToken: 'token' });
    const photoPaths = [`estimates/user-1/${draft.estimateId}/${Date.now()}-0-room.jpg`];
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData, photoPaths })).toMatchObject({ revision: 1 });
    expect(documents.get(`estimates/${draft.estimateId}`)).toMatchObject({ photoPaths });
    expect(generatePaintingEstimate).toHaveBeenCalledTimes(1);
  });

  it.each([
    undefined,
    { userId: 'other-user' },
    { status: 'generated' },
    { revision: 1 },
    { rateLimitReservation: undefined },
  ])('rechecks draft eligibility inside the claim transaction (case %#)', async (change) => {
    const { documents, db } = installQuotaDb({});
    const draft = await createEstimateDraft({ idToken: 'token' });
    const path = `estimates/${draft.estimateId}`;
    const runTransaction = db.runTransaction;
    jest.spyOn(db, 'runTransaction').mockImplementationOnce((callback) => {
      if (change) documents.set(path, { ...documents.get(path), ...change });
      else documents.delete(path);
      return runTransaction(callback);
    });
    expect(await submitEstimate({ idToken: 'token', estimateId: draft.estimateId, formData })).toMatchObject({
      error: expect.stringContaining('30 seconds'),
    });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.get(path) ?? {}).not.toHaveProperty('reservationClaimedAt');
  });

  it.each([
    'estimates/other-user/draft/1792818600000-0-room.jpg',
    'estimates/user-10/draft/1792818600000-0-room.jpg',
    'uploads/photo.jpg',
    'estimates/user-1/draft/../../secret.jpg',
    'estimates/user-1/draft/1792818600000-0-room%2fsecret.jpg',
    `estimates/user-1/draft/1792818600000-0-${'a'.repeat(1024)}.jpg`,
  ])('rejects unowned or malformed photo paths before AI or rate consumption (case %#)', async (photoPath) => {
    const { documents } = installQuotaDb({});
    expect(await submitEstimate({ idToken: 'token', formData, photoPaths: [photoPath] })).toMatchObject({ error: 'Invalid request payload.' });
    expect(generatePaintingEstimate).not.toHaveBeenCalled();
    expect(documents.has('estimateRateLimits/user-1')).toBe(false);
  });

  it('releases admin draft reservations during cleanup', async () => {
    const { documents } = installQuotaDb({}, false, true);
    const draft = await createEstimateDraft({ idToken: 'token' });
    expect(await cleanupEstimateDraft({ idToken: 'token', estimateId: draft.estimateId })).toEqual({ deleted: true, released: true });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ hourlyCount: 0, dailyCount: 0, lastSubmitAt: 0 });
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ revision: 0 });
  });

  it('releases an admin reservation when draft persistence fails', async () => {
    const { documents, db } = installQuotaDb({}, false, true);
    const runTransaction = db.runTransaction;
    jest.spyOn(db, 'runTransaction').mockImplementationOnce(runTransaction).mockRejectedValueOnce(new Error('Write failed'));
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ error: 'Write failed' });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({ hourlyCount: 0, dailyCount: 0, lastSubmitAt: 0 });
  });

  it.each([
    [{ hourlyCount: 5, dailyCount: 5 }, 'this hour'],
    [{ hourlyCount: 0, dailyCount: 10 }, 'Daily'],
  ])('applies hourly and daily limits to admins: %p', async (counters, message) => {
    const { documents } = installQuotaDb({}, false, true);
    documents.set('estimateRateLimits/user-1', {
      hourlyBucket: new Date().toISOString().slice(0, 13), dailyBucket: new Date().toISOString().slice(0, 10),
      ...counters,
    });
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ error: expect.stringContaining(message) });
  });

  it('rejects new creation with one legacy and one generated estimate in the transaction snapshot', async () => {
    const { documents, transactionQueries } = installQuotaDb({
      legacy: { estimate }, generated: { status: 'generated', revision: 1 },
    }, true);
    const result = await createEstimateDraft({ idToken: 'token' });
    expect(result).toMatchObject({ error: expect.stringContaining('2 free estimates'), limitReached: true });
    expect([...documents.keys()].filter((key) => key.startsWith('estimates/'))).toHaveLength(2);
    expect(transactionQueries.map((query) => query.filters)).toEqual([[['userId', 'user-1']]]);
  });

  it('allows one of two drafts to be promoted while rejecting a third new estimate', async () => {
    const freshDraft = { status: 'draft', revision: 0, createdAt: Timestamp.now() };
    const { documents, transactionQueries } = installQuotaDb({ first: freshDraft, second: freshDraft });
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ limitReached: true });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'first', formData })).toMatchObject({
      estimateId: 'first', revision: 1,
    });
    expect(documents.get('estimates/first')).toMatchObject({ status: 'generated', revision: 1 });
    expect(documents.get('estimates/second')).toMatchObject({ status: 'draft', revision: 0 });
    expect(transactionQueries.map((query) => query.filters)).toEqual([[['userId', 'user-1']]]);
  });

  it('rechecks quota despite a forged reservation and missing draft activity time', async () => {
    const { documents } = installQuotaDb({
      first: { status: 'generated' }, second: { status: 'generated' },
      forged: {
        status: 'draft', revision: 0,
        rateLimitReservation: { reservedAt: 1, previousLastSubmitAt: 0, hourlyBucket: '', dailyBucket: '' },
      },
    });
    expect(await submitEstimate({ idToken: 'token', estimateId: 'forged', formData })).toMatchObject({
      error: expect.stringContaining('2 free estimates'), limitReached: true,
    });
    expect(documents.get('estimates/forged')).toMatchObject({ status: 'draft', revision: 0 });
  });

  it('excludes a stale draft without deleting it or refunding its hourly and daily counters', async () => {
    const now = new Date();
    const stale = {
      status: 'draft', revision: 0, createdAt: Timestamp.fromMillis(now.getTime() - 31 * 60 * 1000),
      photoPaths: ['photo.jpg'],
      rateLimitReservation: {
        reservedAt: now.getTime() - 31 * 60 * 1000, previousLastSubmitAt: 0,
        hourlyBucket: now.toISOString().slice(0, 13), dailyBucket: now.toISOString().slice(0, 10),
      },
    };
    const { documents } = installQuotaDb({ stale });
    documents.set('estimateRateLimits/user-1', {
      lastSubmitAt: stale.rateLimitReservation.reservedAt, estimateCount: 99,
      hourlyBucket: stale.rateLimitReservation.hourlyBucket, hourlyCount: 1,
      dailyBucket: stale.rateLimitReservation.dailyBucket, dailyCount: 1,
    });
    expect(await getEstimateQuotaStatus({ idToken: 'token' })).toEqual({ estimateCount: 0, limitReached: false });
    expect(await createEstimateDraft({ idToken: 'token' })).toMatchObject({ revision: 0, estimateCount: 1 });
    expect(documents.get('estimates/stale')).toEqual({ userId: 'user-1', ...stale });
    expect(documents.get('estimateRateLimits/user-1')).toMatchObject({
      estimateCount: 1, hourlyCount: 2, dailyCount: 2,
    });
  });
});

describe('estimate lifecycle helpers', () => {
  const now = 1700000000000;
  const draftTtlMs = 30 * 60 * 1000;
  const docs = (estimates: ExistingEstimateSnapshot[]) => estimates.map((data, index) => ({
    id: String(index), data: () => data,
  }));

  it('counts legacy and unknown statuses conservatively', () => {
    expect(countQuotaUsage(docs([
      { userId: 'user-1', estimate },
      { status: 'archived', revision: 1 },
      { status: 'draft', revision: 1 },
    ]), now, draftTtlMs)).toBe(3);
  });

  it('uses updatedAt instead of an older createdAt for draft activity', () => {
    expect(isStaleDraft({
      status: 'draft', revision: 0,
      createdAt: Timestamp.fromMillis(now - draftTtlMs - 1),
      updatedAt: Timestamp.fromMillis(now),
    }, now, draftTtlMs)).toBe(false);
  });

  it.each([undefined, null, now - draftTtlMs - 1, 'old', new Date(0), {}, { toMillis: () => 0 }])(
    'includes drafts with a missing or non-Timestamp activity time: %p',
    (createdAt) => {
      expect(countQuotaUsage(docs([
        { status: 'draft', revision: 0, createdAt },
      ]), now, draftTtlMs)).toBe(1);
    }
  );

  it('does not fall back to createdAt when updatedAt is present but invalid', () => {
    expect(isStaleDraft({
      status: 'draft', revision: 0,
      createdAt: Timestamp.fromMillis(now - draftTtlMs - 1),
      updatedAt: 'invalid',
    }, now, draftTtlMs)).toBe(false);
  });

  it('identifies a revision-zero draft older than the TTL', () => {
    expect(isStaleDraft({
      status: 'draft',
      revision: 0,
      createdAt: Timestamp.fromMillis(now - draftTtlMs - 1),
    }, now, draftTtlMs)).toBe(true);
  });

  it('never treats a generated estimate as a stale draft', () => {
    expect(isStaleDraft({
      status: 'generated',
      revision: 1,
      createdAt: Timestamp.fromMillis(now - draftTtlMs - 1),
    }, now, draftTtlMs)).toBe(false);
  });

  it('keeps fresh drafts and drafts exactly at the TTL boundary', () => {
    for (const ageMs of [0, draftTtlMs - 1, draftTtlMs]) {
      expect(isStaleDraft({
        status: 'draft',
        revision: 0,
        createdAt: Timestamp.fromMillis(now - ageMs),
      }, now, draftTtlMs)).toBe(false);
    }
  });

  it('rejects a third creation when two fresh drafts reserve both free slots', () => {
    const draft = { status: 'draft', revision: 0, createdAt: Timestamp.fromMillis(now) };
    const estimateCount = countQuotaUsage(docs([draft, draft]), now, draftTtlMs);
    expect(estimateCount).toBe(2);
    expect(() => assertEstimateQuotaAvailable(estimateCount)).toThrow('2 free estimates');
  });

  it('excludes stale drafts while retaining generated estimates in quota usage', () => {
    const createdAt = Timestamp.fromMillis(now - draftTtlMs - 1);
    const estimateCount = countQuotaUsage(docs([
      { status: 'draft', revision: 0, createdAt },
      { status: 'generated', revision: 1, createdAt },
    ]), now, draftTtlMs);
    expect(estimateCount).toBe(1);
    expect(() => assertEstimateQuotaAvailable(estimateCount)).not.toThrow();
  });

  it('retains drafts with an unresolved creation time in quota usage', () => {
    expect(countQuotaUsage(docs([{ status: 'draft', revision: 0 }]), now, draftTtlMs)).toBe(1);
  });

  it('excludes only the specified document id during promotion', () => {
    expect(countQuotaUsage(docs([
      { status: 'draft', revision: 0, createdAt: Timestamp.fromMillis(now) },
      { estimate },
    ]), now, draftTtlMs, '0')).toBe(1);
  });

  it.each([
    [draftTtlMs - 1, 1], [draftTtlMs, 1], [draftTtlMs + 1, 0],
  ])('counts a draft aged %i ms as %i at the TTL boundary', (ageMs, expected) => {
    expect(countQuotaUsage(docs([{
      status: 'draft', revision: 0, createdAt: Timestamp.fromMillis(now - ageMs),
    }]), now, draftTtlMs)).toBe(expected);
  });

  it('includes an old draft with recent activity in quota usage', () => {
    expect(countQuotaUsage(docs([{
      status: 'draft', revision: 0,
      createdAt: Timestamp.fromMillis(now - draftTtlMs - 1), updatedAt: Timestamp.fromMillis(now),
    }]), now, draftTtlMs)).toBe(1);
  });

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
