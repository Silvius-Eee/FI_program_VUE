const DB_NAME = 'fi-attachment-storage';
const DB_VERSION = 1;
const STORE_NAME = 'attachments';

export type StoredAttachmentRecord = {
  id: string;
  blob: Blob;
  name: string;
  type: string;
  size: number;
  updatedAt: string;
};

const canUseIndexedDb = () => (
  typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
);

const createStorageId = (prefix = 'attachment') => (
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const openAttachmentDb = () => new Promise<IDBDatabase>((resolve, reject) => {
  if (!canUseIndexedDb()) {
    reject(new Error('IndexedDB is not available in this browser.'));
    return;
  }

  const request = window.indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Failed to open attachment storage.'));
});

export const saveAttachmentBlob = async ({
  id,
  blob,
  name,
  type,
  size,
  prefix,
}: {
  id?: string;
  blob: Blob;
  name: string;
  type?: string;
  size?: number;
  prefix?: string;
}) => {
  const db = await openAttachmentDb();
  const storageId = id || createStorageId(prefix);
  const record: StoredAttachmentRecord = {
    id: storageId,
    blob,
    name,
    type: type || blob.type || '',
    size: Number.isFinite(Number(size)) ? Number(size) : blob.size,
    updatedAt: new Date().toISOString(),
  };

  return new Promise<string>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record);
    transaction.oncomplete = () => {
      db.close();
      resolve(storageId);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Failed to save attachment.'));
    };
  });
};

export const getAttachmentBlob = async (id: string) => {
  const storageId = String(id || '').trim();
  if (!storageId) return null;

  const db = await openAttachmentDb();

  return new Promise<Blob | null>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(storageId);

    request.onsuccess = () => {
      const record = request.result as StoredAttachmentRecord | undefined;
      resolve(record?.blob || null);
    };
    request.onerror = () => reject(request.error || new Error('Failed to read attachment.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Failed to read attachment.'));
    };
  });
};

export const createAttachmentObjectUrl = async (id: string) => {
  const blob = await getAttachmentBlob(id);
  if (!blob || typeof URL === 'undefined') return '';
  return URL.createObjectURL(blob);
};
