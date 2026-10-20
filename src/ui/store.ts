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

export async function put(key: string, value: unknown): Promise<boolean> {
  try {
    const revision = (revisions.get(key) ?? 0) + 1;
    revisions.set(key, revision);
    const blob = await gzip(JSON.stringify(value));
    if (revisions.get(key) !== revision) return true;
    const db = await open();
    if (revisions.get(key) !== revision) return true;
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ blob, at: Date.now() }, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
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
      r.onsuccess = () => res(r.result as Row | undefined);
      r.onerror = () => rej(r.error);
    });
    if (!row) return null;
    return { value: JSON.parse(row.plain ?? (row.blob ? await gunzip(row.blob) : 'null')) as T, at: row.at };
  } catch {
    return null;
  }
}

export async function drop(key: string): Promise<void> {
  const revision = (revisions.get(key) ?? 0) + 1;
  revisions.set(key, revision);
  try {
    const db = await open();
    if (revisions.get(key) !== revision) return;
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
      tx.onabort = () => res();
    });
  } catch {}
}

/** Queue the latest JSON transaction synchronously while pagehide still owns a live database connection. */
export function putNow(key: string, value: unknown): boolean {
  try {
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
