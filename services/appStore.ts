const DB_NAME = "moniezi-app";
const DB_VERSION = 1;
const STORE_NAME = "kv";

type KVRecord<T = any> = {
  id: string;
  value: T;
  updatedAt: string;
};

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function kvGet<T>(id: string): Promise<T | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const rec = req.result as KVRecord<T> | undefined;
      resolve(rec?.value ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

async function kvSet<T>(id: string, value: T): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies KVRecord<T>);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function kvDelete(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Public API
const APP_STATE_KEY = "appState";

export async function loadAppState<T = any>(): Promise<T | null> {
  return await kvGet<T>(APP_STATE_KEY);
}

export async function saveAppState<T = any>(state: T): Promise<void> {
  await kvSet(APP_STATE_KEY, state);
}

export async function clearAppState(): Promise<void> {
  await kvDelete(APP_STATE_KEY);
}
