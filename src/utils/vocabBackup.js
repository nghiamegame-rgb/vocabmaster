// Immutable, content-addressed backups. LocalStorage backups remain untouched.
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
  };
}

export function storageMessage(error) {
  const quota = error?.name === 'QuotaExceededError' || /quota/i.test(error?.message || '');
  return quota
    ? 'Không đủ dung lượng lưu Vocabulary trên trình duyệt. Kho đang đọc được vẫn được giữ. Hãy Xuất bản sao Vocabulary ra tệp, kiểm tra dung lượng thiết bị rồi bấm Sync để thử lại; không xóa dữ liệu trang.'
    : 'Không lưu/đọc được bản sao Vocabulary: ' + error.message + '. Hãy Xuất bản sao Vocabulary ra tệp và bấm Sync để thử lại.';
}
