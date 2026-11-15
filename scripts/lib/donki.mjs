// DONKI fetch helper: retry (3 tries, backoff), 2 s spacing between requests.
export const DONKI_BASE = 'https://ccmc.gsfc.nasa.gov/DONKI-API/get';
const SPACING_MS = 2000;
let lastRequestAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function donkiUrl(type, startDate, endDate, extra = '') {
  return `${DONKI_BASE}/${type}?startDate=${startDate}&endDate=${endDate}${extra}`;
}

/** Fetch JSON with retry + spacing. Returns { data, provenance }. */
export async function fetchJson(url, { sourceId = 'donki', tries = 3 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const wait = lastRequestAt + SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // DONKI returns an empty body when there are no events.
      const data = text.trim() === '' ? [] : JSON.parse(text);
      return {
        data,
        provenance: { sourceId, sourceUrl: url, fetchedAt: new Date().toISOString(), isLive: true },
      };
    } catch (e) {
      lastErr = e;
      if (attempt < tries) await sleep(1500 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`Fetch failed after ${tries} tries: ${url} (${lastErr?.message})`);
}

export function fetchDonki(type, startDate, endDate, extra = '') {
  return fetchJson(donkiUrl(type, startDate, endDate, extra), { sourceId: `donki-${type.toLowerCase()}` });
}
