import { acceptPersona, createPersona } from '@adam0white/lab-client';
import { expect, test, vi } from 'vitest';
import { ContinuitySession, emptyContinuity } from '../src/ui/continuity.ts';

async function original() {
  return createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.zeynep.pass',
    castRevision: '1',
    branchId: 'test-branch',
    parentRevision: null,
    source: { game: 'pass', build: 'test', engine: '2.14.1', rules: 'pass-12' },
    transfer: { person: {} },
    limitations: [],
  });
}
test('a receiving claim advances atomically before use, and old saved parents stay stale', async () => {
  const source = await original();
  let shelfState = acceptPersona({ heads: {}, revisions: [] }, source);
  let gets = 0;
  const shelf = {
    enabled: true,
    ready: Promise.resolve(true),
    setEnabled() {},
    async request<T>(r: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
      if (r.action === 'get') {
        gets++;
        return source as T;
      }
      if (r.action === 'put') {
        shelfState = acceptPersona(shelfState, r.envelope!, r.fork);
        return true as T;
      }
      return { sameEpoch: true } as T;
    },
  };
  const lab = { setPersonaRecording() {}, allowPersonaRecording() {} };
  const session = new ContinuitySession(shelf, lab);
  const book = emptyContinuity();
  const claim = await session.claim(source, 'shared');
  expect(shelfState.heads[source.castId]).toBe(claim.revision);
  book.heads.push(claim);
  const { revision: _revision, ...claimBody } = claim;
  const newer = await createPersona({
    ...claimBody,
    parentRevision: claim.revision,
    transfer: { person: { later: true } },
  });
  shelfState = acceptPersona(shelfState, newer);
  await expect(session.publish(book, source.castId, { person: { return: true } })).rejects.toThrow(
    'Continuity conflict',
  );
  expect(book.heads[0]?.revision).toBe(claim.revision);
  expect(gets).toBe(0);
});
test('recording gate is set before association lookup; files never inherit sameEpoch', async () => {
  const calls: string[] = [];
  const source = await original();
  const book = emptyContinuity();
  book.heads.push(source);
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        calls.push('query');
        return {
          sameEpoch: true,
          branchId: request.envelope?.branchId,
          revision: request.envelope?.revision,
        } as T;
      },
    },
    {
      setPersonaRecording(key) {
        calls.push(key ? 'gate' : 'fresh');
      },
      allowPersonaRecording(allow) {
        calls.push(allow ? 'allow' : 'deny');
      },
    },
  );
  await session.recording(book, false);
  expect(calls.indexOf('gate')).toBeLessThan(calls.indexOf('query'));
  expect(calls.indexOf('deny')).toBeLessThan(calls.indexOf('query'));
  expect(calls.at(-1)).toBe('allow');
  calls.length = 0;
  await session.recording(book, true);
  expect(calls).not.toContain('query');
  expect(calls).not.toContain('allow');
  expect(calls.at(-1)).toBe('deny');
  calls.length = 0;
  await session.recording(book, false);
  expect(calls).not.toContain('query');
  expect(calls).not.toContain('allow');
  expect(calls.at(-1)).toBe('deny');
});

test('validated reload rejects a checksum-valid unrelated head', async () => {
  const { validateContinuity } = await import('../src/ui/export.ts');
  const book = emptyContinuity();
  book.heads.push(await original());
  await expect(validateContinuity(book)).rejects.toThrow(/head|arrival/i);
});

test('blocked bridge retains file admission, while a real competing head still refuses it', async () => {
  const source = await original();
  let message = 'Shelf unavailable. Use a local file.';
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        throw new Error(message);
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  expect((await session.claim(source, 'file')).parentRevision).toBe(source.revision);
  message = 'Continuity conflict. Export this history or explicitly fork it.';
  await expect(session.claim(source, 'file')).rejects.toThrow('Continuity conflict');
});

test('two different admissions from the same source cannot share an idempotent claim', async () => {
  const source = await original();
  let state = acceptPersona({ heads: {}, revisions: [] }, source);
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        state = acceptPersona(state, request.envelope!);
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  const first = await session.claim(source, 'shared');
  expect(typeof (first.transfer.targetClaim as { claimId: string }).claimId).toBe('string');
  await expect(session.claim(source, 'shared')).rejects.toThrow('Continuity conflict');
});

test('a full bounded replay history refuses before any shelf mutation', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  book.rows = Array.from({ length: 256 }, () => ({
    v: 1 as const,
    probe: 'zeynep' as const,
    arm: 'continuing' as const,
    scope: 'shared' as const,
    castId: source.castId,
    branchId: source.branchId,
    revision: source.revision,
    parentRevision: null,
    stage: 'checkpoint',
    outcome: 'accepted',
  }));
  let writes = 0;
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(): Promise<T> {
        writes++;
        return true as T;
      },
    },
    { setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  await expect(session.publish(book, source.castId, { person: {} })).rejects.toThrow(/history.*full/);
  expect(writes).toBe(0);
  expect(book.rows).toHaveLength(256);
  expect(book.heads).toEqual([source]);
});

test('recording queries pin the exact envelope and reject an unbound bridge reply', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  const requests: import('@adam0white/lab-client').PersonaRequest[] = [];
  const grants: boolean[] = [];
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        requests.push(request);
        return { sameEpoch: true } as T;
      },
    },
    {
      setPersonaRecording() {},
      allowPersonaRecording(allow) {
        grants.push(allow);
      },
    },
  );
  await session.recording(book);
  expect(requests[0]?.envelope).toEqual(source);
  expect(grants).not.toContain(true);
});

test('a late recording reply cannot approve a changed identity or a later refusal', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  let resolve!: (result: unknown) => void;
  let queries = 0;
  const grants: boolean[] = [];
  const lab = {
    playerId: 'player-a',
    setPersonaRecording() {},
    allowPersonaRecording(allow: boolean) {
      grants.push(allow);
    },
  };
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      request<T>(): Promise<T> {
        if (++queries > 2) return Promise.resolve({ sameEpoch: false } as T);
        return new Promise((r) => {
          resolve = r as (result: unknown) => void;
        });
      },
    },
    lab,
  );
  const pending = session.recording(book);
  await new Promise((r) => setTimeout(r, 10));
  lab.playerId = 'player-b';
  resolve({ sameEpoch: true, branchId: source.branchId, revision: source.revision });
  await pending;
  expect(grants).not.toContain(true);
  grants.length = 0;
  const second = session.recording(book);
  await new Promise((r) => setTimeout(r, 10));
  await session.allow(book, false);
  resolve({ sameEpoch: true, branchId: source.branchId, revision: source.revision });
  await second;
  expect(grants).not.toContain(true);
});

test('explicit recording grant and denial carry the immediately queried opaque epoch', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  const requests: (import('@adam0white/lab-client').PersonaRequest & { recordingEpoch?: string })[] = [];
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        requests.push(request);
        return {
          sameEpoch: false,
          branchId: source.branchId,
          revision: source.revision,
          recordingEpoch: 'opaque-test-epoch',
        } as T;
      },
    },
    { playerId: 'player-a', setPersonaRecording() {}, allowPersonaRecording() {} },
  );
  await session.recording(book);
  requests.length = 0;
  await session.allow(book, true);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({
    envelope: source,
    allowRecording: true,
    recordingEpoch: 'opaque-test-epoch',
  });
  requests.length = 0;
  await session.allow(book, false);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toMatchObject({
    envelope: source,
    allowRecording: false,
    recordingEpoch: 'opaque-test-epoch',
  });
  expect(book.fileUnlinked).toBe(true);
});

test('the real SDK gated player getter does not invalidate our own gate changes', async () => {
  const source = await original();
  const book = emptyContinuity();
  book.heads = [source];
  let allowed = true;
  let gated = false;
  const requests: (import('@adam0white/lab-client').PersonaRequest & { recordingEpoch?: string })[] = [];
  const lab = {
    get playerId() {
      return gated && !allowed ? null : 'player-a';
    },
    get personaRecordingAllowed() {
      return !gated || allowed;
    },
    setPersonaRecording(key: string | null) {
      gated = key !== null;
    },
    allowPersonaRecording(value: boolean) {
      allowed = value;
    },
  };
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        requests.push(request);
        return {
          sameEpoch: true,
          branchId: source.branchId,
          revision: source.revision,
          recordingEpoch: 'opaque-test-epoch',
        } as T;
      },
    },
    lab,
  );
  await session.recording(book);
  expect(allowed).toBe(true);
  await session.allow(book, false);
  expect(allowed).toBe(false);
  requests.length = 0;
  await session.allow(book, true);
  expect(allowed).toBe(true);
  expect(requests[1]?.allowRecording).toBe(true);
});

test('identity preference events invalidate replies even while the SDK player getter stays null', async () => {
  const events = new EventTarget();
  vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
  try {
    const source = await original();
    const book = emptyContinuity();
    book.heads = [source];
    let resolve!: (value: unknown) => void;
    let allowed = false;
    const session = new ContinuitySession(
      {
        enabled: true,
        ready: Promise.resolve(true),
        setEnabled() {},
        request<T>(): Promise<T> {
          return new Promise((r) => {
            resolve = r as (value: unknown) => void;
          });
        },
      },
      {
        get playerId() {
          return null;
        },
        setPersonaRecording() {},
        allowPersonaRecording(value) {
          allowed = value;
        },
      },
    );
    const pending = session.recording(book);
    await new Promise((r) => setTimeout(r, 10));
    events.dispatchEvent(new Event('hf-lab-preference'));
    resolve({ sameEpoch: true, branchId: source.branchId, revision: source.revision });
    await pending;
    expect(allowed).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('a preference change before bootstrap finishes still leaves an imported run gated', async () => {
  const events = new EventTarget();
  vi.stubGlobal('addEventListener', events.addEventListener.bind(events));
  try {
    const source = await original();
    const book = emptyContinuity();
    book.heads = [source];
    let ready!: (value: boolean) => void;
    let key: string | null = null;
    let allowed = true;
    const session = new ContinuitySession(
      {
        enabled: true,
        ready: new Promise((r) => {
          ready = r;
        }),
        setEnabled() {},
        async request<T>(): Promise<T> {
          throw Error('unexpected query');
        },
      },
      {
        get playerId() {
          return key && !allowed ? null : 'player-a';
        },
        setPersonaRecording(value) {
          key = value;
        },
        allowPersonaRecording(value) {
          allowed = value;
        },
      },
    );
    const pending = session.recording(book, true);
    events.dispatchEvent(new Event('hf-lab-preference'));
    ready(true);
    await pending;
    expect(key).not.toBeNull();
    expect(allowed).toBe(false);
    expect(book.fileUnlinked).toBe(true);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('a live central denial or invalid reply overrides cached association; offline permission stays local', async () => {
  const source = await original();
  const results: boolean[] = [];
  for (const mode of ['denied', 'unbound', 'invalid', 'offline']) {
    const book = emptyContinuity();
    book.heads = [source];
    const associations = new Map<string, boolean>();
    let key: string | null = null;
    let queries = 0;
    const allowed = () => key === null || associations.get(key) === true;
    const lab = {
      get playerId() {
        return allowed() ? 'player-a' : null;
      },
      get personaRecordingAllowed() {
        return allowed();
      },
      setPersonaRecording(value: string | null) {
        key = value;
      },
      allowPersonaRecording(value: boolean) {
        if (key) associations.set(key, value);
      },
    };
    const session = new ContinuitySession(
      {
        enabled: true,
        ready: Promise.resolve(true),
        setEnabled() {},
        async request<T>(): Promise<T> {
          if (++queries === 1)
            return { sameEpoch: true, branchId: source.branchId, revision: source.revision } as T;
          if (mode === 'invalid') throw Error('Invalid selected person envelope');
          if (mode === 'offline') throw Error('Shelf unavailable. Use a local file.');
          return (
            mode === 'denied'
              ? { sameEpoch: false, branchId: source.branchId, revision: source.revision }
              : { sameEpoch: true }
          ) as T;
        },
      },
      lab,
    );
    await session.recording(book);
    expect(allowed()).toBe(true);
    await session.recording(book);
    results.push(allowed());
  }
  expect(results).toEqual([false, false, false, true]);
});

test('one unavailable head cannot hide another head’s live recording denial', async () => {
  const source = await original();
  const { revision: _revision, ...body } = source;
  const second = await createPersona({ ...body, castId: 'hf.cast.selin.voice', branchId: 'second-branch' });
  const book = emptyContinuity();
  book.heads = [source, second];
  const associations = new Map<string, boolean>();
  let key: string | null = null;
  let initial = true;
  const allowed = () => key === null || associations.get(key) === true;
  const lab = {
    get playerId() {
      return allowed() ? 'player-a' : null;
    },
    get personaRecordingAllowed() {
      return allowed();
    },
    setPersonaRecording(value: string | null) {
      key = value;
    },
    allowPersonaRecording(value: boolean) {
      if (key) associations.set(key, value);
    },
  };
  const session = new ContinuitySession(
    {
      enabled: true,
      ready: Promise.resolve(true),
      setEnabled() {},
      async request<T>(request: import('@adam0white/lab-client').PersonaRequest): Promise<T> {
        if (!initial && request.castId === source.castId) throw Error('Shelf unavailable. Use a local file.');
        return {
          sameEpoch: initial,
          branchId: request.envelope!.branchId,
          revision: request.envelope!.revision,
        } as T;
      },
    },
    lab,
  );
  await session.recording(book);
  expect(allowed()).toBe(true);
  initial = false;
  await session.recording(book);
  expect(allowed()).toBe(false);
});
