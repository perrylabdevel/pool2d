const DB_NAME = 'RailRush_TableEditor';
const DB_VERSION = 2;

export const STORE_SKINS = 'skins';
export const STORE_TABLES = 'tables';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openEditorDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('[TableEditor] IndexedDB open blocked (close other tabs?)');
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_SKINS)) {
        const store = db.createObjectStore(STORE_SKINS, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_TABLES)) {
        const store = db.createObjectStore(STORE_TABLES, { keyPath: 'id' });
        store.createIndex('name', 'name', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
  });

  return dbPromise;
}

