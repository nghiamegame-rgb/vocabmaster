// Immutable, content-addressed backups. LocalStorage backups are migrated to
// IndexedDB on first load and removed after verification.
export const BACKUP_DB = 'vocabmaster_vocabulary_backups';
export function createVocabBackupStore() {
  async function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(BACKUP_DB, 1);
      let blocked = false;
      request.onupgradeneeded = () => request.result.createObjectStore('backups');
      request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
      request.onerror = () => reject(request.error);
      request.onblocked = () => { blocked = true; reject(new Error('backup_database_blocked')); };
    });
  }
  async function transact(mode, run) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('backups', mode);
        let result, failure;
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(failure || tx.error || new Error('backup_transaction_aborted'));
        tx.onerror = () => {}; // Reject on abort, never acknowledge an uncommitted write.
        try { run(tx.objectStore('backups'), value => { result = value; }, error => { failure = error; tx.abort(); }); }
        catch (error) { tx.abort(); reject(error); }
      });
    } finally { db.close(); }
  }
  return {
    async put(content) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
      const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      await transact('readwrite', (store, done, fail) => {
        const request = store.get(key);
        request.onsuccess = () => {
          try {
            if (request.result === undefined) store.add(content, key);
            else if (request.result !== content) fail(new Error('backup_hash_collision'));
          } catch (error) { fail(error); }
        };
      });
      return key;
    },
    async entries() {
      return transact('readonly', (store, done) => {
        const entries = {};
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return done(entries);
          entries[cursor.key] = cursor.value;
          cursor.continue();
        };
      });
    },
    /** Read a single backup entry by its content-SHA-256 key. */
    async getByKey(sha) {
      return transact('readonly', (store, done) => {
        const request = store.get(sha);
        request.onsuccess = () => done(request.result ?? null);
      });
    },
  };
}

/**
 * Migrate old LocalStorage backup keys (prefix `vocabmaster_vocab_backup_`) to
 * IndexedDB, then remove them from LocalStorage so the quota is freed.
 *
 * Safety contract:
 *   1. Each key is put() into IndexedDB first (deduplicated by content-SHA-256).
 *   2. The key is verified to exist in IndexedDB by reading it back.
 *   3. Only after a successful round-trip read is the LocalStorage key removed.
 *   4. If ANY step fails, the key is left in LocalStorage (no data loss).
 *   5. The function is fire-and-forget: errors are swallowed so callers are
 *      never blocked and readable words are never hidden.
 *
 * @param {Storage} storage  - The localStorage-like object to migrate from.
 * @param {string}  prefix   - Key prefix to scan (e.g. 'vocabmaster_vocab_backup_').
 * @param {ReturnType<createVocabBackupStore>} store - IndexedDB store instance.
 * @returns {Promise<number>} Number of keys successfully migrated and removed.
 */
export async function migrateLocalStorageBackups(storage, prefix, store) {
  const keys = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
  } catch { return 0; }
  if (!keys.length) return 0;

  let migrated = 0;
  for (const key of keys) {
    try {
      const content = storage.getItem(key);
      if (content === null) continue; // already removed by another tab
      // 1. Write to IndexedDB (put() is idempotent for same content).
      const sha = await store.put(content);
      // 2. Verify: read back from IndexedDB before removing the LocalStorage copy.
      const existing = await store.getByKey(sha);
      if (existing !== content) continue; // verification failed — keep LS copy
      // 3. Safe to remove.
      storage.removeItem(key);
      migrated++;
    } catch { /* keep the key in LocalStorage if anything fails */ }
  }
  return migrated;
}

export function storageMessage(error) {
  const quota = error?.name === 'QuotaExceededError' || /quota/i.test(error?.message || '');
  return quota
    ? 'Không đủ dung lượng lưu Vocabulary trên trình duyệt. Kho đang đọc được vẫn được giữ. Hãy Xuất bản sao Vocabulary ra tệp, kiểm tra dung lượng thiết bị rồi bấm Sync để thử lại; không xóa dữ liệu trang.'
    : 'Không lưu/đọc được bản sao Vocabulary: ' + error.message + '. Hãy Xuất bản sao Vocabulary ra tệp và bấm Sync để thử lại.';
}
