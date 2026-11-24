// Immutable, content-addressed backups. LocalStorage backups are migrated to
// IndexedDB on first load and removed after verification.
//
// Pruning: each backup written by this version also stores a small metadata
// record under `meta:<sha>` ({ kind, at, seq }) in the same object store.
// Only ROUTINE kinds (startup / pre-write / state snapshots) are ever pruned,
// and only beyond the BACKUP_KEEP_RECENT most recent ones. Archive/conflict/
// adopt backups, unknown kinds (e.g. migrated LocalStorage backups), backups
// written before this version (no metadata) and the oldest surviving backup are
// always kept, so the only backup is never deleted.
export const BACKUP_DB = 'vocabmaster_vocabulary_backups';
export const BACKUP_KEEP_RECENT = 30;
const PRUNE_SLACK = 10; // prune only above 40 routine backups, back down to 30
const META_PREFIX = 'meta:';
const ROUTINE_KINDS = new Set(['startup', 'pre-write', 'state']);
let sequence = 0;
const nextSeq = () => Date.now() * 1000 + (sequence++ % 1000);

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
  // Delete routine backups beyond the most recent BACKUP_KEEP_RECENT. Never
  // touches protected kinds, backups without metadata or the oldest backup.
  async function prune() {
    return transact('readwrite', (store, done) => {
      const metas = [];
      const request = store.openCursor(IDBKeyRange.bound(META_PREFIX, META_PREFIX + '￿'));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          try { metas.push({ key: cursor.key.slice(META_PREFIX.length), ...JSON.parse(cursor.value) }); }
          catch { /* unreadable metadata: treat the backup as protected */ }
          cursor.continue();
          return;
        }
        const routine = metas.filter(meta => ROUTINE_KINDS.has(meta.kind)).sort((a, b) => b.seq - a.seq);
        if (routine.length <= BACKUP_KEEP_RECENT + PRUNE_SLACK) return done(0);
        const oldest = metas.reduce((min, meta) => (meta.seq < min.seq ? meta : min), metas[0]);
        const remove = routine.slice(BACKUP_KEEP_RECENT).filter(meta => meta.key !== oldest.key);
        for (const meta of remove) {
          store.delete(meta.key);
          store.delete(META_PREFIX + meta.key);
        }
        done(remove.length);
      };
    });
  }

  return {
    // kind: 'startup' | 'pre-write' | 'state' (routine) or anything else (protected,
    // e.g. 'archive'). Omitted kind is protected.
    async put(content, kind = 'other') {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
      const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      await transact('readwrite', (store, done, fail) => {
        const request = store.get(key);
        request.onsuccess = () => {
          try {
            const existed = request.result !== undefined;
            if (!existed) store.add(content, key);
            else if (request.result !== content) return fail(new Error('backup_hash_collision'));
            const metaRequest = store.get(META_PREFIX + key);
            metaRequest.onsuccess = () => {
              let previous = null;
              try { previous = metaRequest.result ? JSON.parse(metaRequest.result) : null; } catch { previous = { kind: 'other' }; }
              // A backup written before metadata existed stays without metadata (protected).
              if (existed && !previous) return;
              // Protection is sticky: a routine snapshot that is later archived stays protected.
              const protectedKind = previous && !ROUTINE_KINDS.has(previous.kind) ? previous.kind : kind;
              try { store.put(JSON.stringify({ at: Date.now(), seq: nextSeq(), kind: protectedKind }), META_PREFIX + key); }
              catch (error) { fail(error); }
            };
          } catch (error) { fail(error); }
        };
      });
      // Pruning failures never fail the backup that was just committed.
      if (ROUTINE_KINDS.has(kind)) await prune().catch(() => {});
      return key;
    },
    async entries() {
      return transact('readonly', (store, done) => {
        const entries = {};
        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return done(entries);
          if (!String(cursor.key).startsWith(META_PREFIX)) entries[cursor.key] = cursor.value;
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
