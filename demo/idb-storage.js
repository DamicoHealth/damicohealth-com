// ==========================================
// IndexedDB Storage Layer
// Drop-in async replacement for localStorage for large data
// ==========================================
const idbStore = (function() {
  // Storage namespace. Non-production builds (the public demo, staging) inject
  // window.DH_STORAGE_SUFFIX so they get their OWN database and can never read
  // or overwrite real patient records that share the same origin.
  const DB_NAME = 'dh-emr-db' + ((typeof window !== 'undefined' && window.DH_STORAGE_SUFFIX) || '');
  const DB_VERSION = 1;
  const STORE_NAME = 'keyval';

  let dbPromise = null;

  // Ask the browser to keep our storage PERSISTENT so iOS does not evict the
  // patient database when the PWA is closed/backgrounded. This is the fix for
  // "records gone after reopening" on offline iPads. Best-effort + feature-detected.
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    (async () => {
      try {
        const already = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        const granted = already || await navigator.storage.persist();
        if (typeof window !== 'undefined') window._storagePersistent = granted;
        console.log('[idb-storage] persistent storage:', granted);
      } catch (e) { /* not supported on this browser */ }
    })();
  }

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('[idb-storage] Failed to open IndexedDB:', request.error);
        reject(request.error);
      };
    });
    return dbPromise;
  }

  function withStore(mode, callback) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const result = callback(store);
        tx.oncomplete = () => resolve(result._value);
        tx.onerror = () => reject(tx.error);
        // For get operations, resolve with the request result
        if (result._request) {
          result._request.onsuccess = () => {
            result._value = result._request.result;
          };
        }
      });
    });
  }

  return {
    getItem: function(key) {
      if (window.NativeKV && /records/i.test(key)) return window.NativeKV.getItem(key);
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const request = store.get(key);
          request.onsuccess = () => resolve(request.result !== undefined ? request.result : null);
          request.onerror = () => reject(request.error);
        });
      }).catch((err) => {
        // Genuine IndexedDB failure. Try the localStorage fallback; if a value
        // is there, use it. Otherwise REJECT rather than return null — callers
        // must be able to tell "storage unreadable" apart from "genuinely empty",
        // or an empty result can trigger a destructive whole-dataset overwrite.
        console.warn('[idb-storage] getItem failed, trying localStorage:', err);
        let ls = null;
        try { ls = localStorage.getItem(key); } catch (e) { ls = null; }
        if (ls !== null && ls !== undefined) {
          try { return JSON.parse(ls); } catch (e) { return ls; }
        }
        throw (err || new Error('storage read failed'));
      });
    },

    setItem: function(key, value) {
      if (window.NativeKV && /records/i.test(key)) return window.NativeKV.setItem(key, value);
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.put(value, key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }).catch((err) => {
        console.warn('[idb-storage] setItem failed, trying localStorage:', err);
        try {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        } catch(e) {
          // Both IndexedDB AND the localStorage fallback failed — surface it so
          // the caller can warn the user instead of silently losing the write.
          throw (e || err);
        }
      });
    },

    removeItem: function(key) {
      if (window.NativeKV && /records/i.test(key)) return window.NativeKV.removeItem(key);
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          store.delete(key);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }).catch((err) => {
        console.warn('[idb-storage] removeItem failed:', err);
      });
    },

    getAllKeys: function() {
      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          // Use getAllKeys if available, otherwise iterate
          if (store.getAllKeys) {
            const request = store.getAllKeys();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          } else {
            const keys = [];
            const request = store.openCursor();
            request.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                keys.push(cursor.key);
                cursor.continue();
              } else {
                resolve(keys);
              }
            };
            request.onerror = () => reject(request.error);
          }
        });
      }).catch((err) => {
        console.warn('[idb-storage] getAllKeys failed:', err);
        return [];
      });
    },

    // Migrate data from localStorage to IndexedDB (one-time)
    migrateFromLocalStorage: function(prefix) {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(prefix)) {
          keys.push(key);
        }
      }
      if (keys.length === 0) return Promise.resolve(0);

      return openDB().then((db) => {
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          let migrated = 0;
          keys.forEach((key) => {
            try {
              const val = localStorage.getItem(key);
              const parsed = JSON.parse(val);
              store.put(parsed, key);
              migrated++;
            } catch(e) {
              // Skip unparseable items
            }
          });
          tx.oncomplete = () => {
            console.log(`[idb-storage] Migrated ${migrated} items from localStorage`);
            resolve(migrated);
          };
          tx.onerror = () => reject(tx.error);
        });
      });
    }
  };
})();
