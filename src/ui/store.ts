/**
 * Saves live in IndexedDB as gzip (state and replay history can exceed localStorage limits).
 * Every access is wrapped: a private window or blocked storage gives "no save", never a broken page.
 */
const DB = 'goodhands';
const STORE = 'pages';
let connection: IDBDatabase | null = null;
let opening: Promise<IDBDatabase> | null = null;
const revisions = new Map<string, number>();
type Row = { blob?: Blob; plain?: string; at: number };

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
    if (key.startsWith('source:')) return false;
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    const text = JSON.stringify(value);
    const blob = await gzip(text);
    if (revisions.get(key) !== revision) return true;
    await commit(key, { blob, at: Date.now() });

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
    if (key.startsWith('source:')) return false;
    if (!connection) return false;
    const plain = JSON.stringify(value);
    revisions.set(key, (revisions.get(key) ?? 0) + 1);
    const tx = connection.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ plain, at: Date.now() }, key);

    return true;
  } catch {
    return false;
  }
}
