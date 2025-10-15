import type { CacheItem } from './types';

// --- IndexedDB Caching ---
const DB_NAME = 'FootballTrackerDB';
const DB_VERSION = 1;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('club-search')) {
        db.createObjectStore('club-search', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('teams')) {
        db.createObjectStore('teams', { keyPath: 'key' });
      }
       if (!db.objectStoreNames.contains('match-lists')) {
        db.createObjectStore('match-lists', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('match-details')) {
        db.createObjectStore('match-details', { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getFromDB = async <T,>(storeName: string, key: string | number): Promise<CacheItem<T> | null> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const setToDB = async <T,>(storeName: string, item: CacheItem<T>): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const isCacheValid = <T,>(item: CacheItem<T> | null): boolean => {
    return item ? (Date.now() - item.timestamp) < CACHE_DURATION_MS : false;
}
