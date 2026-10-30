import { validateStructure } from './grammarSyncMerge';

export async function fetchStructuresFromCloud(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_cb=${Date.now()}&scope=structures`, { redirect: 'follow' });
  if (!res.ok) return null;
  const data = await res.json();
  // Fail closed against old backends; never acknowledge an ignored Structures write.
  if (!data?.ok || data.structuresSchema !== 1 || !Array.isArray(data.structures)
      || !Number.isInteger(data.structuresRevision) || data.structuresRevision < 0
      || data.structures.some(item => validateStructure(item))
      || new Set(data.structures.map(item => item.id)).size !== data.structures.length) return null;
  return { structures: data.structures, revision: data.structuresRevision };
}

export async function pushStructuresToCloud(structures, expectedRevision, url) {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
    body: JSON.stringify({ action: 'saveStructures', structuresSchema: 1, structures, expectedRevision }),
  });
  const data = await res.json();
  if (res.ok && data?.ok === true && data.structuresSchema === 1
      && data.structuresRevision === expectedRevision + 1 && data.writtenStructures === structures.length) return { ok: true };
  return { ok: false, error: data?.error || 'invalid_response' };
}
