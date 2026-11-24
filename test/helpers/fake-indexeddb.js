/**
 * Minimal in-memory IndexedDB for Node tests of src/utils/vocabBackup.js.
 * Supports open/upgrade, transactions (complete/abort), get/add/put/delete,
 * openCursor with IDBKeyRange.bound, and optional quota failures on add/put.
 * Not a general-purpose implementation.
 */
export function installFakeIndexedDB({ failWrite = () => false } = {}) {
  const databases = new Map(); // name -> { version, stores: Map<name, Map<key, value>> }

  const later = fn => setImmediate(fn);
  class Request { constructor() { this.result = undefined; this.error = null; this.onsuccess = null; this.onerror = null; } }

  class Transaction {
    constructor(db, mode) {
      this.db = db; this.mode = mode; this.pending = 0; this.finished = false; this.error = null;
      this.oncomplete = null; this.onabort = null; this.onerror = null;
      this.snapshot = new Map([...db.data.stores].map(([name, map]) => [name, new Map(map)]));
      later(() => this.maybeComplete());
    }
    objectStore(name) {
      const map = this.db.data.stores.get(name);
      if (!map) throw new Error(`No store ${name}`);
      return new Store(this, map);
    }
    request(work) {
      const req = new Request();
      this.pending++;
      later(() => {
        if (this.finished) return;
        try { req.result = work(); }
        catch (error) {
          req.error = error; this.pending--;
          req.onerror?.({ target: req });
          this.abort(error);
          return;
        }
        this.pending--;
        req.onsuccess?.({ target: req });
        later(() => this.maybeComplete());
      });
      return req;
    }
    maybeComplete() {
      if (this.finished || this.pending) return;
      this.finished = true;
      this.oncomplete?.();
    }
    abort(error) {
      if (this.finished) return;
      this.finished = true; this.error = error || new Error('AbortError');
      for (const [name, map] of this.snapshot) this.db.data.stores.set(name, map); // rollback
      this.onabort?.();
    }
  }

  class Store {
    constructor(tx, map) { this.tx = tx; this.map = map; }
    get(key) { return this.tx.request(() => this.map.get(key)); }
    write(value, key, mustBeNew) {
      if (this.tx.mode !== 'readwrite') throw new Error('ReadOnlyError');
      return this.tx.request(() => {
        if (failWrite(key, value)) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
        if (mustBeNew && this.map.has(key)) { const e = new Error('Key already exists'); e.name = 'ConstraintError'; throw e; }
        this.map.set(key, value);
        return key;
      });
    }
    add(value, key) { return this.write(value, key, true); }
    put(value, key) { return this.write(value, key, false); }
    delete(key) {
      if (this.tx.mode !== 'readwrite') throw new Error('ReadOnlyError');
      return this.tx.request(() => { this.map.delete(key); });
    }
    openCursor(range) {
      const keys = [...this.map.keys()].filter(key => !range || (key >= range.lower && key <= range.upper)).sort();
      let index = 0;
      const req = new Request();
      const step = () => this.tx.request(() => {
        while (index < keys.length && !this.map.has(keys[index])) index++;
        if (index >= keys.length) return null;
        const key = keys[index++];
        return { key, value: this.map.get(key), continue: () => { inner = step(); inner.onsuccess = forward; } };
      });
      let inner = step();
      const forward = () => { req.result = inner.result; req.onsuccess?.({ target: req }); };
      inner.onsuccess = forward;
      return req;
    }
  }

  globalThis.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
  globalThis.indexedDB = {
    databases,
    open(name, version = 1) {
      const req = new Request();
      later(() => {
        let data = databases.get(name);
        const upgrade = !data || data.version < version;
        if (!data) { data = { version: 0, stores: new Map() }; databases.set(name, data); }
        const db = {
          data,
          createObjectStore(store) { data.stores.set(store, new Map()); return {}; },
          transaction(store, mode = 'readonly') { return new Transaction(db, mode); },
          close() {},
        };
        req.result = db;
        if (upgrade) { data.version = version; req.onupgradeneeded?.(); }
        req.onsuccess?.();
      });
      return req;
    },
  };
  return databases;
}
