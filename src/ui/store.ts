import { type NativeSnapshot, RECEIVING_KEY, type ReceivingJournal } from './receiving.ts';

/**
 * Saves live in IndexedDB as gzip (state and replay history can exceed localStorage limits).
 * Every access is wrapped: a private window or blocked storage gives "no save", never a broken page.
 */
const DB = 'goodhands';
const STORE = 'pages';
let connection: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;
const revisions = new Map<string, number>();
type Row = { blob?: Blob; plain?: string; at: number; token?: string };

function open(): Promise<IDBDatabase> {
  if (connection) return Promise.resolve(connection);
  if (opening) return opening;
  opening = new Promise<IDBDatabase>((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => {
      connection = r.result;
      connection.onversionchange = () => {
        connection?.close();
        connection = null;
      };
      res(r.result);
    };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('Save database is blocked.'));
  });
  void opening
    .finally(() => {
      opening = null;
    })
    .catch(() => {});
  return opening;
}

async function gzip(text: string): Promise<Blob> {
  const cs = new CompressionStream('gzip');
  return new Response(new Blob([text]).stream().pipeThrough(cs)).blob();
}

async function gunzip(b: Blob): Promise<string> {
  const ds = new DecompressionStream('gzip');
  return new Response(b.stream().pipeThrough(ds)).text();
}

async function commit(key: string, row: Row, immutable = false): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    if (immutable) tx.objectStore(STORE).add(row, key);
    else tx.objectStore(STORE).put(row, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.onabort = () => rej(tx.error);
  });
}

/** Content-addressed full source custody. Success requires committed, exact readback. */
export async function retainSourceArchive(value: unknown): Promise<string | null> {
  try {
    const text = JSON.stringify(value);
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const key = `source:${Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join('')}`;
    const existing = await get<unknown>(key);
    if (existing) return JSON.stringify(existing.value) === text ? key : null;
    await commit(key, { blob: await gzip(text), at: Date.now() }, true);
    const retained = await get<unknown>(key);
    return retained && JSON.stringify(retained.value) === text ? key : null;
  } catch {
    return null;
  }
}

export async function put(key: string, value: unknown): Promise<boolean> {
  try {
    if (key.startsWith('source:') || key === RECEIVING_KEY) return false;
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    const text = JSON.stringify(value);
    const blob = await gzip(text);
    if (revisions.get(key) !== revision) return true;
    await commit(key, { blob, at: Date.now(), token: crypto.randomUUID() });

    return true;
  } catch {
    return false;
  }
}

export async function get<T>(key: string): Promise<{ value: T; at: number } | null> {
  try {
    const db = await open();
    const row = await new Promise<Row | undefined>((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(key);
      tx.onabort = () => rej(tx.error);
      tx.oncomplete = () => res(r.result as Row | undefined);
      r.onerror = () => rej(r.error);
    });
    if (!row) return null;
    return { value: JSON.parse(row.plain ?? (row.blob ? await gunzip(row.blob) : 'null')) as T, at: row.at };
  } catch {
    return null;
  }
}

/** Queue the latest JSON transaction synchronously while pagehide still owns a live database connection. */
export function putNow(key: string, value: unknown): boolean {
  try {
    if (key.startsWith('source:') || key === RECEIVING_KEY) return false;
    if (!connection) return false;
    const plain = JSON.stringify(value);
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    const tx = connection.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ plain, at: Date.now(), token: crypto.randomUUID() }, key);

    return true;
  } catch {
    return false;
  }
}

async function readRow(key: string): Promise<Row | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).get(key);
    tx.oncomplete = () => resolve(request.result as Row | undefined);
    tx.onabort = () => reject(tx.error ?? new Error('Read aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Read failed.'));
  });
}

async function rowValue(row: Row | undefined): Promise<unknown> {
  if (!row) return null;
  return JSON.parse(row.plain ?? (row.blob ? await gunzip(row.blob) : 'null')) as unknown;
}

/** Assign a durable identity to older saves before comparing them in a transaction. */
export async function captureNative(): Promise<NativeSnapshot> {
  const db = await open();
  const row = await new Promise<Row | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = tx.objectStore(STORE);
    const request = store.get('run');
    let result: Row | undefined;
    request.onsuccess = () => {
      result = request.result as Row | undefined;
      if (result && !result.token) {
        result = { ...result, token: crypto.randomUUID() };
        store.put(result, 'run');
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(tx.error ?? new Error('Save snapshot aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Save snapshot failed.'));
  });
  return { value: await rowValue(row), token: row?.token ?? null };
}

export async function readReceiving(): Promise<ReceivingJournal | null> {
  return (await rowValue(await readRow(RECEIVING_KEY))) as ReceivingJournal | null;
}

/** Journal writes are serialized by IndexedDB and never use the coalescing save path. */
export async function retainReceiving(journal: ReceivingJournal): Promise<void> {
  const text = JSON.stringify(journal);
  const blob = await gzip(text);
  const previous = await readRow(RECEIVING_KEY);
  const prior = (await rowValue(previous)) as ReceivingJournal | null;
  const phases = ['prepared', 'sending', 'acknowledged'];
  if (
    (!prior && journal.phase !== 'prepared') ||
    (prior &&
      (prior.id !== journal.id ||
        phases.indexOf(journal.phase) < phases.indexOf(prior.phase) ||
        phases.indexOf(journal.phase) > phases.indexOf(prior.phase) + 1))
  ) {
    throw new Error('Another receiving operation is retained.');
  }
  const token = crypto.randomUUID();
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = tx.objectStore(STORE);
    const request = store.get(RECEIVING_KEY);
    let matched = false;
    request.onsuccess = () => {
      const current = request.result as Row | undefined;
      matched = current ? !!previous?.token && current.token === previous.token : !previous;
      if (matched) store.put({ blob, at: Date.now(), token }, RECEIVING_KEY);
    };
    tx.oncomplete = () => (matched ? resolve() : reject(new Error('Receiving operation changed.')));
    tx.onabort = () => reject(tx.error ?? new Error('Receiving save aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Receiving save failed.'));
  });
  const retained = await readRow(RECEIVING_KEY);
  if (retained?.token !== token || JSON.stringify(await rowValue(retained)) !== text) {
    throw new Error('Receiving save readback failed.');
  }
}

/** Promote only the acknowledged operation and the exact captured native save. */
export async function promoteReceiving(journal: ReceivingJournal): Promise<boolean> {
  if (journal.phase !== 'acknowledged') return false;
  const retained = await readRow(RECEIVING_KEY);
  const value = (await rowValue(retained)) as ReceivingJournal | null;
  if (!retained?.token || !value || JSON.stringify(value) !== JSON.stringify(journal)) return false;
  const native = await readRow('run');
  if (
    (native?.token ?? null) !== journal.priorNative.token ||
    JSON.stringify(await rowValue(native)) !== JSON.stringify(journal.priorNative.value)
  )
    return false;
  const blob = await gzip(JSON.stringify(journal.run));
  revisions.set('run', (revisions.get('run') ?? 0) + 1);
  const db = await open();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = tx.objectStore(STORE);
    const journalRequest = store.get(RECEIVING_KEY);
    const nativeRequest = store.get('run');
    let promoted = false;
    nativeRequest.onsuccess = () => {
      const currentJournal = journalRequest.result as Row | undefined;
      const currentNative = nativeRequest.result as Row | undefined;
      if (
        currentJournal?.token === retained.token &&
        (currentNative?.token ?? null) === journal.priorNative.token &&
        (!currentNative || !!currentNative.token)
      ) {
        store.put({ blob, at: Date.now(), token: crypto.randomUUID() }, 'run');
        store.delete(RECEIVING_KEY);
        promoted = true;
      }
    };
    tx.oncomplete = () => resolve(promoted);
    tx.onabort = () => reject(tx.error ?? new Error('Promotion aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Promotion failed.'));
  });
}

export async function discardReceiving(id: string): Promise<boolean> {
  const retained = await readRow(RECEIVING_KEY);
  const value = (await rowValue(retained)) as ReceivingJournal | null;
  if (!retained?.token || value?.id !== id || value.phase !== 'prepared') return false;
  const db = await open();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite', { durability: 'strict' });
    const store = tx.objectStore(STORE);
    const request = store.get(RECEIVING_KEY);
    let deleted = false;
    request.onsuccess = () => {
      if ((request.result as Row | undefined)?.token === retained.token) {
        store.delete(RECEIVING_KEY);
        deleted = true;
      }
    };
    tx.oncomplete = () => resolve(deleted);
    tx.onabort = () => reject(tx.error ?? new Error('Discard aborted.'));
    tx.onerror = () => reject(tx.error ?? new Error('Discard failed.'));
  });
}
