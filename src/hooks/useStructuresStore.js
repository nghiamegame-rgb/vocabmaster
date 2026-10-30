import { useCallback, useEffect, useRef, useState } from 'react';
import { mergeStructures, structureProgress, validateStructure } from '../utils/grammarSyncMerge';
import { getGrammarCloudUrl } from '../utils/grammarStorage';
import { fetchStructuresFromCloud, pushStructuresToCloud } from '../utils/structureCloud';
import {
  getStructures,
  saveStructures,
} from '../utils/structureStorage';

function normalizeStructure(input = {}) {
  return {
    ...input,
    reviewBase: input.reviewBase || structureProgress({ ...input, reviewEvents: {} }),
    reviewEvents: input.reviewEvents || {},
    updatedAt: Number(input.updatedAt) || 0,
    id: input.id || `gs_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    english: String(input.english || '').trim(),
    vietnamese: String(input.vietnamese || '').trim(),
    example: String(input.example || '').trim(),
    notes: String(input.notes || '').trim(),
    topic: String(input.topic || '').trim(),
    level: Math.min(5, Math.max(1, Number(input.level) || 1)),
    currentStreak: Math.max(0, Number(input.currentStreak) || 0),
    wrongCount: Math.max(0, Number(input.wrongCount) || 0),
    totalReviews: Math.max(0, Number(input.totalReviews) || 0),
    lastReviewedAt: input.lastReviewedAt || null,
    nextReviewAt: input.nextReviewAt || null,
    createdAt: input.createdAt || Date.now(),
  };
}

export function useStructuresStore() {
  const [records, setRecords] = useState(() => getStructures().filter(item => item && typeof item === 'object').map(normalizeStructure).filter(item => item.english && item.vietnamese));
  const [syncStatus, setSyncStatus] = useState('pending');
  const recordsRef = useRef(records);
  const syncRef = useRef(null);
  const timerRef = useRef(null);
  const busyRef = useRef(false);
  const generationRef = useRef(0);
  const structures = records.filter(item => !item.deletedAt);

  const persist = useCallback(updater => {
    const next = typeof updater === 'function' ? updater(recordsRef.current) : updater;
    // Save before publishing state: failed persistence must never acknowledge an edit.
    saveStructures(next);
    recordsRef.current = next;
    setRecords(next);
    setSyncStatus('pending');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => syncRef.current?.(), 2500);
  }, []);

  const syncFromCloud = useCallback(async () => {
    if (busyRef.current) return;
    const url = getGrammarCloudUrl();
    if (!url) { setSyncStatus('unconfigured'); return; }
    const generation = generationRef.current;
    const active = () => generation === generationRef.current && url === getGrammarCloudUrl();
    busyRef.current = true;
    clearTimeout(timerRef.current);
    setSyncStatus('syncing');
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        // Always hydrate before writing, including after reconnect or a lost POST response.
        const cloud = await fetchStructuresFromCloud(url);
        if (!active()) return;
        if (!cloud) throw new Error('Structures cloud unavailable or backend upgrade required.');
        const merged = mergeStructures(recordsRef.current, cloud.structures).map(normalizeStructure);
        saveStructures(merged);
        recordsRef.current = merged;
        setRecords(merged);
        if (JSON.stringify(mergeStructures([], cloud.structures)) === JSON.stringify(merged)) {
          setSyncStatus('ok');
          return;
        }
        const result = await pushStructuresToCloud(merged, cloud.revision, url);
        if (!active()) return;
        if (result.ok) {
          // Edits made during POST remain local and get their own fetch/CAS cycle.
          const changed = recordsRef.current !== merged;
          setSyncStatus(changed ? 'pending' : 'ok');
          if (changed) timerRef.current = setTimeout(() => syncRef.current?.(), 2500);
          return;
        }
        if (result.error !== 'conflict') throw new Error(result.error);
      }
      throw new Error('conflict');
    } catch {
      if (active()) setSyncStatus('error');
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        if (url !== getGrammarCloudUrl()) syncRef.current?.();
      }
    }
  }, []);

  useEffect(() => {
    syncRef.current = syncFromCloud;
    syncFromCloud();
    const retry = () => syncFromCloud();
    window.addEventListener('online', retry);
    window.addEventListener('focus', retry);
    return () => {
      generationRef.current++;
      busyRef.current = false;
      clearTimeout(timerRef.current);
      window.removeEventListener('online', retry);
      window.removeEventListener('focus', retry);
    };
  }, [syncFromCloud]);

  const addStructure = useCallback(input => {
    const english = String(input.english || '').trim();
    const vietnamese = String(input.vietnamese || '').trim();
    if (!english || !vietnamese) return { ok: false, error: 'Cấu trúc và nghĩa tiếng Việt là bắt buộc.' };
    if (structures.some(item => item.english.toLowerCase() === english.toLowerCase())) {
      return { ok: false, error: 'Cấu trúc này đã tồn tại.' };
    }
    persist(prev => [normalizeStructure({ ...input, english, vietnamese, updatedAt: Date.now() }), ...prev]);
    return { ok: true };
  }, [persist, structures]);

  const updateStructure = useCallback((id, input) => {
    const english = String(input.english || '').trim();
    const vietnamese = String(input.vietnamese || '').trim();
    if (!english || !vietnamese) return { ok: false, error: 'Cấu trúc và nghĩa tiếng Việt là bắt buộc.' };
    if (structures.some(item => item.id !== id && item.english.toLowerCase() === english.toLowerCase())) {
      return { ok: false, error: 'Cấu trúc này đã tồn tại.' };
    }
    persist(prev => prev.map(item => item.id === id ? normalizeStructure({ ...item, english, vietnamese, example: input.example, notes: input.notes, topic: input.topic, updatedAt: Math.max(Date.now(), (item.updatedAt || 0) + 1) }) : item));
    return { ok: true };
  }, [persist, structures]);

  const deleteStructure = useCallback(id => persist(prev => prev.map(item => item.id === id ? { ...item, deletedAt: Date.now() } : item)), [persist]);

  const recordStructureResult = useCallback((id, isCorrect) => {
    if (!id) return;
    persist(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (item.deletedAt) return item;
      const event = { at: Math.max(Date.now(), (item.lastReviewedAt || 0) + 1), correct: Boolean(isCorrect) };
      const next = { ...item, reviewEvents: { ...item.reviewEvents, [crypto.randomUUID()]: event } };
      return { ...next, ...structureProgress(next) };
    }));
  }, [persist]);

  const importStructures = useCallback(data => {
    if (!Array.isArray(data)) return { ok: false, error: 'JSON phải là một mảng cấu trúc.' };
    if (data.some(item => !item || validateStructure({ ...item, id: item.id || 'import' }))) return { ok: false, error: 'JSON không hợp lệ; dữ liệu hiện tại được giữ nguyên.' };
    const normalized = data.map(normalizeStructure);
    const deduped = normalized.filter((item, index, all) => all.findIndex(other => other.id === item.id) === index);
    // Import adds/merges records; it never replaces the library or resets progress.
    persist(prev => mergeStructures(deduped, prev));
    return { ok: true, count: deduped.length };
  }, [persist]);

  return { structures, syncStatus, syncFromCloud, addStructure, updateStructure, deleteStructure, recordStructureResult, importStructures };
}
