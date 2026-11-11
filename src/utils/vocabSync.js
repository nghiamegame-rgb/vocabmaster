import { createVocabBackupStore, storageMessage } from './vocabBackup.js';
// Vocabulary protocol 1. Legacy caches never become an authoritative base.
export const STATE_KEY = 'vocabmaster_vocab_sync_v1';
export const PAUSE_KEY = 'vocabmaster_vocab_sync_paused';
export const BACKUP_PREFIX = 'vocabmaster_vocab_backup_';
export const clone = value => JSON.parse(JSON.stringify(value));
export function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
export const equal = (a, b) => canonical(a) === canonical(b);
export function validateSnapshot(s) {
  if (!s || s.protocol !== 1 || typeof s.generation !== 'string' || !s.generation
      || !Number.isSafeInteger(s.revision) || s.revision < 0 || !Array.isArray(s.words)
      || !Array.isArray(s.tombstones)) throw new Error('invalid_snapshot');
  const ids = new Set();
  for (const w of s.words) {
    if (!w || typeof w.id !== 'string' || !w.id || ids.has(w.id)
        || typeof w.english !== 'string' || !w.english.trim()
        || typeof w.vietnamese !== 'string'
        || (w.hardMarked !== undefined && typeof w.hardMarked !== 'boolean')) throw new Error('invalid_word');
    ids.add(w.id);
  }
  const deleted = new Set();
  for (const id of s.tombstones) {
    if (typeof id !== 'string' || !id || ids.has(id) || deleted.has(id)) throw new Error('invalid_tombstone');
    deleted.add(id);
  }
  return s;
}
const isStarred = word => Boolean(word?.hardMarked);
function withoutStar(word) {
  if (!word || typeof word !== 'object') return word;
  const copy = { ...word };
  delete copy.hardMarked;
  return copy;
}
function applyStar(word, starred) {
  const copy = clone(word);
  if (starred) copy.hardMarked = true;
  else delete copy.hardMarked;
  return copy;
}
// Unchanged local records have no authority. Deletion wins; conflicting local
// edits are archived for explicit review, never silently thrown away.
export function reconcile(base, local, remote) {
  validateSnapshot(remote);
  if (!base || base.generation !== remote.generation) {
    return { words: clone(remote.words), tombstones: [...remote.tombstones], conflicts: clone(local) };
  }
  const before = new Map(base.words.map(w => [w.id, w]));
  const current = new Map(local.map(w => [w.id, w]));
  const result = new Map(remote.words.map(w => [w.id, clone(w)]));
  const deleted = new Set(remote.tombstones), conflicts = [];
  for (const w of base.words) if (!current.has(w.id)) { deleted.add(w.id); result.delete(w.id); }
  for (const w of local) {
    const old = before.get(w.id), cloud = result.get(w.id);
    if (equal(w, old)) continue;
    if (deleted.has(w.id)) { conflicts.push(clone(w)); continue; }
    if (!old) {
      if (cloud && !equal(cloud, w)) conflicts.push(clone(w));
      else if (!cloud) result.set(w.id, clone(w));
      continue;
    }
    if (!cloud) { conflicts.push(clone(w)); continue; }
    if (equal(cloud, old)) { result.set(w.id, clone(w)); continue; }
    if (equal(cloud, w)) continue;
    const oldRest = withoutStar(old), localRest = withoutStar(w), cloudRest = withoutStar(cloud);
    const localRestChanged = !equal(localRest, oldRest), cloudRestChanged = !equal(cloudRest, oldRest);
    const oldStar = isStarred(old), localStar = isStarred(w), cloudStar = isStarred(cloud);
    const localStarChanged = localStar !== oldStar, cloudStarChanged = cloudStar !== oldStar;
    if (!localRestChanged || !cloudRestChanged || equal(localRest, cloudRest)) {
      const winningRest = localRestChanged ? w : cloud;
      const finalStar = localStarChanged && !cloudStarChanged ? localStar : cloudStar;
      result.set(w.id, applyStar(winningRest, finalStar));
    } else {
      conflicts.push(clone(w));
      if (localStarChanged && !cloudStarChanged) result.set(w.id, applyStar(cloud, localStar));
    }
  }
  return { words: [...result.values()], tombstones: [...deleted].sort(), conflicts };
}
export class VocabSync {
  constructor({ storage, transport, changed = () => {}, uuid = () => crypto.randomUUID(), delay = 2000, backups = createVocabBackupStore() }) {
    Object.assign(this, { storage, transport, changed, uuid, delay, backups });
    this.status = 'idle'; this.readStatus = 'syncing'; this.notice = ''; this.active = false;
    this.serial = 0; this.timer = null; this.running = false;
    this.queue = Promise.resolve(); this.storageError = ''; this.networkError = '';
    this.pauseError = ''; this.pauseTarget = null;
    this.load(); // Read only: a backup failure must never hide readable words.
  }
  load() {
    this.loadError = ''; this.hasReadableWords = false;
    let raw, legacy;
    try {
      raw = this.storage.getItem(STATE_KEY);
      legacy = this.storage.getItem('vocabmaster_words');
      const state = raw ? JSON.parse(raw) : { base: null, words: JSON.parse(legacy || '[]') };
      validateSnapshot({ protocol: 1, generation: 'local', revision: 0, words: state.words, tombstones: [] });
      this.state = state; this.hasReadableWords = true;
      if (state.base) validateSnapshot(state.base);
      this.notice = state.notice && !state.notice.startsWith('Vocabulary chưa đồng bộ:') ? state.notice : '';
      this.startup = { raw, legacy };
    } catch {
      // A mirror is display-only when the authoritative state cannot be read.
      if (!this.hasReadableWords) {
        try {
          const words = JSON.parse(legacy);
          validateSnapshot({ protocol: 1, generation: 'local', revision: 0, words, tombstones: [] });
          this.state = { base: null, words }; this.hasReadableWords = true;
        } catch { this.state = null; }
      }
      this.loadError = 'Không đọc được kho Vocabulary chuẩn trên thiết bị. ' +
        (this.hasReadableWords ? 'Đang hiển thị bản local đọc được, chỉ để xem. ' : 'Chưa xác định được số từ; không coi đây là kho trống. ') +
        'Đã chặn sửa và đồng bộ; hãy xuất bản sao để kiểm tra rồi thử lại.';
      this.status = 'error'; this.readStatus = 'error';
    }
  }
  get message() { return [this.loadError, this.storageError, this.pauseError, this.networkError, this.notice].filter(Boolean).join(' '); }
  emit() { this.changed(this); }
  subscribe(listener) { this.changed = listener; }
  reportError(error) { this.storageError = storageMessage(error); this.status = 'error'; this.emit(); }
  enqueue(operation) {
    const result = this.queue.then(operation);
    this.queue = result.catch(() => {});
    return result;
  }
  async backup(data) {
    try { await this.backups.put(canonical(data)); }
    catch (error) { this.reportError(error); throw error; }
  }
  async protectStartup() {
    if (this.startup) {
      await this.backup(this.startup);
      this.startup = null;
    }
  }
  storageChanged(key) {
    if (key === PAUSE_KEY) { this.cancel(); this.status = this.paused() ? 'paused' : 'idle'; this.emit(); }
    if (key === PAUSE_KEY || key === STATE_KEY) this.schedule(0);
  }
  async persist(next, valid = () => true) {
    next = { ...next, notice: this.notice };
    // Each distinct state is immutable and deduplicated across tabs/reloads.
    // This also protects another tab's pending state before it can be overwritten.
    await this.protectStartup();
    await this.backup({ raw: this.storage.getItem(STATE_KEY), legacy: this.storage.getItem('vocabmaster_words') });
    await this.backup({ state: next });
    if (!valid()) return false;
    try {
      const serialized = JSON.stringify(next);
      if (this.storage.getItem(STATE_KEY) !== serialized) this.storage.setItem(STATE_KEY, serialized);
      this.state = next; // The authoritative write succeeded, even if the legacy mirror fails.
      const words = JSON.stringify(next.words);
      if (this.storage.getItem('vocabmaster_words') !== words) this.storage.setItem('vocabmaster_words', words);
    } catch (error) { this.reportError(error); throw error; }
    this.storageError = ''; this.emit();
    return true;
  }
  async archive(reason, data) {
    await this.backup({ reason, data });
    this.notice = 'Có bản sao Vocabulary cũ/xung đột cần xem lại. Xuất bản sao trước khi chọn nhập lại từng mục.';
  }
  edit(update) {
    return this.enqueue(async () => {
      if (this.loadError) throw new Error('invalid_local_cache');
      const current = this.pendingEdit || this.state;
      const words = clone(typeof update === 'function' ? update(current.words) : update);
      validateSnapshot({ protocol: 1, generation: 'local', revision: 0, words, tombstones: [] });
      this.pendingEdit = { ...current, words };
      await this.persist(this.pendingEdit);
      this.pendingEdit = null;
      this.status = this.networkError ? 'error' : 'idle'; this.emit(); this.schedule();
    });
  }
  paused() {
    if (this.pauseTarget === true) return true;
    try { return this.storage.getItem(PAUSE_KEY) !== 'false'; }
    catch { return true; }
  }
  pause(value = true) {
    this.cancel(); this.pauseTarget = value;
    try { this.storage.setItem(PAUSE_KEY, String(value)); }
    catch (error) { this.pauseError = storageMessage(error); this.status = 'error'; this.emit(); return; }
    this.pauseTarget = null; this.pauseError = '';
    this.status = value ? 'paused' : 'idle'; this.emit();
    if (!value) this.schedule(0);
  }
  cancel() { clearTimeout(this.timer); this.serial++; this.controller?.abort(); }
  start() { this.active = true; this.schedule(0); }
  stop() { this.active = false; this.cancel(); }
  schedule(delay = this.delay) {
    clearTimeout(this.timer);
    if (this.active) this.timer = setTimeout(() => this.sync(), delay);
  }
  async sync() {
    if (!this.active || this.running) return;
    if (this.pauseTarget !== null) {
      this.pause(this.pauseTarget);
      if (this.pauseTarget !== null) return;
    }
    clearTimeout(this.timer); this.running = true;
    const serial = this.serial;
    this.controller = new AbortController();
    const valid = () => this.active && serial === this.serial;
    let retry = false, phase = 'storage';
    try {
      this.status = 'syncing'; this.emit(); // Keep errors visible until their operation recovers.
      if (this.loadError) this.load();
      if (this.loadError) return;
      await this.enqueue(async () => {
        await this.protectStartup();
        if (this.pendingEdit && await this.persist(this.pendingEdit, valid)) this.pendingEdit = null;
      });
      if (!valid()) return;
      phase = 'network';
      const remote = validateSnapshot(await this.transport.read(this.controller.signal));
      if (!valid()) return;
      phase = 'storage';
      const merged = await this.enqueue(async () => {
        if (!valid()) return null;
        // A local edit may have failed while GET was in flight. Never merge an
        // older state over that pending edit or clear its error with unrelated work.
        if (this.pendingEdit) {
          if (!await this.persist(this.pendingEdit, valid)) return null;
          this.pendingEdit = null;
        }
        const result = reconcile(this.state.base, this.state.words, remote);
        if (!this.state.base || this.state.base.generation !== remote.generation) await this.archive('generation-or-legacy', this.state);
        else if (result.conflicts.length) await this.archive('concurrent-edit-or-deletion', result.conflicts);
        if (!await this.persist({ base: clone(remote), words: result.words }, valid)) return null;
        return result;
      });
      if (!merged || !valid()) return;
      this.readStatus = 'ok';
      if (this.paused() || remote.paused) {
        if (this.networkOperation !== 'write') this.networkError = '';
        this.status = 'paused'; return;
      }
      if (equal(merged.words, remote.words) && equal(merged.tombstones, remote.tombstones)) { this.networkError = ''; this.status = 'ok'; return; }
      const sent = clone(merged.words);
      const payload = { protocol: 1, generation: remote.generation, expectedRevision: remote.revision,
        requestId: this.uuid(), words: sent, tombstones: merged.tombstones, confirmEmpty: sent.length === 0 };
      if (!valid() || this.paused()) return;
      phase = 'network';
      this.networkOperation = 'write';
      this.status = 'pushing'; this.emit();
      const ack = await this.transport.write(payload, this.controller.signal);
      if (!valid()) return;
      validateSnapshot(ack);
      if (ack.requestId !== payload.requestId || ack.generation !== payload.generation
          || ack.revision !== payload.expectedRevision + 1 || !equal(ack.words, sent)
          || !equal(ack.tombstones, payload.tombstones)) throw new Error('invalid_ack');
      phase = 'storage';
      await this.enqueue(async () => {
        if (!valid()) return;
        // An edit that failed to persist must also advance its base after this ACK.
        if (this.pendingEdit) this.pendingEdit = { ...this.pendingEdit, base: clone(ack) };
        await this.persist({ base: clone(ack), words: (this.pendingEdit || this.state).words }, valid);
        if (valid()) this.pendingEdit = null;
      });
      if (!valid()) return;
      this.networkError = '';
      this.networkOperation = null;
      retry = !equal(this.state.words, sent); this.status = retry ? 'idle' : 'ok';
    } catch (error) {
      if (valid()) {
        this.status = 'error'; this.readStatus = 'error';
        if (phase === 'storage') this.reportError(error);
        else {
          this.networkError = 'Vocabulary chưa đồng bộ: ' + error.message + '. Dữ liệu chờ gửi được giữ; bấm Sync để thử lại.';
        }
      }
    } finally {
      this.running = false;
      if (valid()) this.emit();
      if (this.active && (retry || serial !== this.serial)) this.schedule();
    }
  }
}
