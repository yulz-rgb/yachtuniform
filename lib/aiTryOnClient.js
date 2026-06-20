/** Client-side store for AI try-on results, keyed by body/view/garment signature.
 * Mirrors the useSyncExternalStore pattern in lib/previewAdjustments.js so async
 * fetch results re-render consumers without ever calling React setState inside
 * an effect body. */

const DEFAULT_ENTRY = { src: null, loading: false };
const entries = new Map();
const listeners = new Set();

// Once the server reports AI try-on isn't configured (no GEMINI_API_KEY), skip
// it for the rest of the session instead of retrying on every selection change.
let unavailable = false;

export function subscribeAiTryOn(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAiTryOnEntry(key) {
  if (!key) return DEFAULT_ENTRY;
  return entries.get(key) || DEFAULT_ENTRY;
}

export function getAiTryOnServerSnapshot() {
  return DEFAULT_ENTRY;
}

export function setAiTryOnEntry(key, patch) {
  const prev = entries.get(key) || DEFAULT_ENTRY;
  entries.set(key, { ...prev, ...patch });
  for (const listener of listeners) listener();
}

export function isAiTryOnUnavailable() {
  return unavailable;
}

export function markAiTryOnUnavailable() {
  unavailable = true;
}
