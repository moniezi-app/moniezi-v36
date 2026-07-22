const DB_NAME = "moniezi-receipts";
const DB_VERSION = 1;
const STORE_NAME = "receipts";

type ReceiptBlobRecord = {
  id: string;
  blob: Blob;
  mimeType: string;
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

export async function putReceiptBlob(id: string, blob: Blob, mimeType: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      id,
      blob,
      mimeType,
      updatedAt: new Date().toISOString(),
    } satisfies ReceiptBlobRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function getReceiptBlob(id: string): Promise<{ blob: Blob; mimeType: string } | null> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => {
      const rec = req.result as ReceiptBlobRecord | undefined;
      if (!rec) return resolve(null);
      resolve({ blob: rec.blob, mimeType: rec.mimeType });
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteReceiptBlob(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearAllReceipts(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<{ blob: Blob; mimeType: string }> {
  // Robust parsing without fetch() because some browsers block fetch(data:...) in certain contexts.
  // Format: data:[<mime>][;base64],<payload>
  const commaIdx = dataUrl.indexOf(",");
  if (commaIdx < 0) {
    return { blob: new Blob([], { type: "application/octet-stream" }), mimeType: "application/octet-stream" };
  }

  const header = dataUrl.slice(0, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);

  const mimeMatch = header.match(/^data:([^;]+)?/i);
  const mimeType = (mimeMatch && mimeMatch[1]) ? mimeMatch[1] : "image/png";
  const isBase64 = /;base64/i.test(header);

  let bytes: Uint8Array;
  if (isBase64) {
    const binary = atob(payload);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } else {
    const text = decodeURIComponent(payload);
    bytes = new TextEncoder().encode(text);
  }

  return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}


export async function blobToDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
