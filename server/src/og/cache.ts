// Bounded cache for rendered OG PNGs, keyed `id:version`.
//
// A published snapshot is immutable, so a rendered image never goes stale and
// republishing mints a new key rather than invalidating the old one. That is
// what makes caching correct — and also what made the previous unbounded Map a
// slow leak: every invitation ever unfurled kept its PNG for the process's
// lifetime, and republishing added a key without dropping the one it
// superseded. Satori output at 1200x630 is on the order of hundreds of KB.
//
// NFR-7 fixes the deployment at one small instance, which bounds how many
// processes hold this — not how much heap one of them may take. adr-007
// records a sidecar being OOM-killed on exactly that plan, so the cap is the
// conservative reading.
//
// The Map is insertion-ordered, which is the whole LRU: a hit re-inserts its
// key so it moves to the end, leaving `keys().next()` the least recently used.

/** Entries kept before the least recently used is dropped. Sized so the
 *  working set of a small deployment stays resident (~50 images, tens of MB)
 *  while the ceiling is fixed rather than open-ended. */
export const OG_PNG_CACHE_LIMIT = 50;

const pngCache = new Map<string, Buffer>();

/** The cached PNG for this key, if any. A hit refreshes the key's recency. */
export function recallOgPng(key: string): Buffer | undefined {
  const png = pngCache.get(key);
  if (png === undefined) return undefined;
  pngCache.delete(key);
  pngCache.set(key, png);
  return png;
}

/** Cache a rendered PNG, evicting the least recently used entry once the cache
 *  is over its limit. */
export function rememberOgPng(key: string, png: Buffer): void {
  // Delete first so re-caching an existing key moves it to the end rather than
  // updating it in place, where it would keep its original (stale) position.
  pngCache.delete(key);
  pngCache.set(key, png);
  if (pngCache.size > OG_PNG_CACHE_LIMIT) {
    const oldest = pngCache.keys().next();
    if (!oldest.done) pngCache.delete(oldest.value);
  }
}

/** Test hook: drop all cached images. */
export function resetOgPngCache(): void {
  pngCache.clear();
}
