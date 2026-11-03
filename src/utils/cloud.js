import { WEBHOOK_URL } from '../config.js';
async function request(method, payload, signal) {
  const response = await fetch(WEBHOOK_URL, {
    method, signal, cache: 'no-store',
    ...(payload ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) } : {}),
  });
  const data = await response.json();
  if (!response.ok || data?.ok !== true) throw new Error(data?.error || 'request_failed');
  return data;
}
export const fetchFromCloud = signal => request('GET', null, signal);
export const pushToCloud = (payload, signal) => request('POST', payload, signal);
