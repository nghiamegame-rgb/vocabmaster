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
  constructor({ storage, transport, changed = () => {}, uuid = () => crypto.randomUUID(), delay = 2000 }) {
    Object.assign(this, { storage, transport, changed, uuid, delay });
    this.status = 'idle'; this.readStatus = 'syncing'; this.notice = ''; this.active = false;
    this.serial = 0; this.timer = null; this.running = false;
    const raw = storage.getItem(STATE_KEY), legacy = storage.getItem('vocabmaster_words');
    this.state = raw ? JSON.parse(raw) : { base: null, words: JSON.parse(legacy || '[]') };
    if (!Array.isArray(this.state.words)) throw new Error('invalid_local_cache');
    validateSnapshot({ protocol: 1, generation: 'local', revision: 0, words: this.state.words, tombstones: [] });
    if (this.state.base) validateSnapshot(this.state.base);
    this.notice = this.state.notice || '';
    this.backupKey = BACKUP_PREFIX + uuid();
    this.storage.setItem(BACKUP_PREFIX + uuid(), JSON.stringify({ reason: 'session-start', raw, legacy, state: this.state }));
    this.storage.setItem(this.backupKey, JSON.stringify({ state: this.state }));
  }
  emit() { this.changed(this); }
  subscribe(listener) { this.changed = listener; }
  reportError(error) { this.notice = 'Không lưu được thay đổi: ' + error.message; this.status = 'error'; this.emit(); }
  storageChanged(key) {
    if (key === PAUSE_KEY) { this.cancel(); this.status = this.paused() ? 'paused' : 'idle'; this.emit(); }
    if (key === PAUSE_KEY || key === STATE_KEY) this.schedule(0);
  }
  persist(next) {
    next = { ...next, notice: this.notice };
    // Per-session copy preserves pending edits even when another tab writes the shared cache.
    this.storage.setItem(this.backupKey, JSON.stringify({ state: next }));
    this.storage.setItem(STATE_KEY, JSON.stringify(next));
    this.state = next;
    this.storage.setItem('vocabmaster_words', JSON.stringify(next.words));
    this.emit();
  }
  archive(reason, data) {
    this.storage.setItem(BACKUP_PREFIX + this.uuid(), JSON.stringify({ reason, data }));
    this.notice = 'Có bản sao Vocabulary cũ/xung đột cần xem lại. Xuất bản sao trước khi chọn nhập lại từng mục.';
  }
  edit(update) {
    const words = clone(typeof update === 'function' ? update(this.state.words) : update);
    validateSnapshot({ protocol: 1, generation: 'local', revision: 0, words, tombstones: [] });
    this.persist({ ...this.state, words }); this.schedule();
  }
  paused() { return this.storage.getItem(PAUSE_KEY) !== 'false'; }
  pause(value = true) {
    this.storage.setItem(PAUSE_KEY, String(value)); this.cancel();
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
    clearTimeout(this.timer); this.running = true;
    const serial = this.serial;
    this.controller = new AbortController();
    const valid = () => this.active && serial === this.serial;
    let retry = false;
    try {
      this.notice = this.state.notice && !this.state.notice.startsWith('Vocabulary chưa đồng bộ:') ? this.state.notice : '';
      this.status = 'syncing'; this.emit();
      const remote = validateSnapshot(await this.transport.read(this.controller.signal));
      if (!valid()) return;
      const merged = reconcile(this.state.base, this.state.words, remote);
      if (!this.state.base || this.state.base.generation !== remote.generation) this.archive('generation-or-legacy', this.state);
      else if (merged.conflicts.length) this.archive('concurrent-edit-or-deletion', merged.conflicts);
      this.persist({ base: clone(remote), words: merged.words }); this.readStatus = 'ok';
      if (this.paused() || remote.paused) { this.status = 'paused'; return; }
      if (equal(merged.words, remote.words) && equal(merged.tombstones, remote.tombstones)) { this.status = 'ok'; return; }
      const sent = clone(merged.words);
      const payload = { protocol: 1, generation: remote.generation, expectedRevision: remote.revision,
        requestId: this.uuid(), words: sent, tombstones: merged.tombstones, confirmEmpty: sent.length === 0 };
      if (!valid() || this.paused()) return;
      this.status = 'pushing'; this.emit();
      const ack = await this.transport.write(payload, this.controller.signal);
      if (!valid()) return;
      validateSnapshot(ack);
      if (ack.requestId !== payload.requestId || ack.generation !== payload.generation
          || ack.revision !== payload.expectedRevision + 1 || !equal(ack.words, sent)
          || !equal(ack.tombstones, payload.tombstones)) throw new Error('invalid_ack');
      this.persist({ base: clone(ack), words: this.state.words });
      retry = !equal(this.state.words, sent); this.status = retry ? 'idle' : 'ok';
    } catch (error) {
      if (valid()) {
        this.status = 'error'; this.readStatus = 'error';
        this.notice = 'Vocabulary chưa đồng bộ: ' + error.message + '. Dữ liệu chờ gửi được giữ; bấm Sync để thử lại.';
      }
    } finally {
      this.running = false;
      if (valid()) this.emit();
      if (this.active && (retry || serial !== this.serial)) this.schedule();
    }
  }
}
