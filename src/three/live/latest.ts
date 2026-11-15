// public/data/latest.json (NASA DONKI snapshot): honesty rules for the LIVE badge and the bits shown in the notebook.
export interface LatestJson {
  generatedAt: string;
  provenance: { sourceId: string; fetchedAt: string; isLive: boolean }[];
  flares?: { peakTime: string; classType?: string }[];
  cmes?: { activityId: string; startTime: string; speedKms?: number | null; enlil?: { estShockArrivalEarth: string | null } | null }[];
  shocks?: { eventTime: string; location?: string }[];
  sep: { eventTime: string; instruments?: unknown }[];
  notifications?: { messageId: string; messageType?: string; issueTime: string; summary: string; url?: string }[];
}

export type LiveState = 'live' | 'stale' | 'offline';
export interface LiveStatus {
  state: LiveState;
  /** oldest source fetch time (ISO) or null */
  fetchedAt: string | null;
  reason: string;
}

const H = 3600 * 1000;

/** LIVE only if every source is isLive, the OLDEST fetch is within 36 h, and some event is within 7 days. */
export function liveStatus(l: LatestJson | null, now: number): LiveStatus {
  if (!l || !Array.isArray(l.provenance) || l.provenance.length === 0) return { state: 'offline', fetchedAt: null, reason: 'latest.json missing' };
  const fetched = l.provenance.map((p) => Date.parse(p.fetchedAt)).filter(Number.isFinite);
  const oldest = fetched.length ? Math.min(...fetched) : NaN;
  const fetchedAt = Number.isFinite(oldest) ? new Date(oldest).toISOString() : null;
  if (!l.provenance.every((p) => p.isLive)) return { state: 'stale', fetchedAt, reason: 'a source is not live' };
  if (!Number.isFinite(oldest) || now - oldest > 36 * H) return { state: 'stale', fetchedAt, reason: 'older than 36 h' };
  const times = [
    ...(l.flares ?? []).map((e) => e.peakTime),
    ...(l.cmes ?? []).map((e) => e.startTime),
    ...(l.shocks ?? []).map((e) => e.eventTime),
    ...l.sep.map((e) => e.eventTime),
    ...(l.notifications ?? []).map((e) => e.issueTime),
  ].map((t) => Date.parse(t));
  const recent = times.some((t) => Number.isFinite(t) && now - t <= 7 * 24 * H && t <= now + 24 * H);
  return recent ? { state: 'live', fetchedAt, reason: 'ok' } : { state: 'stale', fetchedAt, reason: 'no event in the last 7 days' };
}

export const firstSentence = (s: string): string => {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
};

/** Newest CME that has an ENLIL Earth shock arrival time. */
export function newestEarthCME(l: LatestJson): { activityId: string; startTime: string; arrival: string; speedKms: number | null } | null {
  const list = (l.cmes ?? [])
    .filter((c) => c.enlil?.estShockArrivalEarth)
    .sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
  const c = list[0];
  return c ? { activityId: c.activityId, startTime: c.startTime, arrival: c.enlil!.estShockArrivalEarth!, speedKms: c.speedKms ?? null } : null;
}

export function newestNotification(l: LatestJson): { issueTime: string; messageType: string; first: string; url: string | null } | null {
  const n = [...(l.notifications ?? [])].sort((a, b) => Date.parse(b.issueTime) - Date.parse(a.issueTime))[0];
  return n ? { issueTime: n.issueTime, messageType: n.messageType ?? '', first: firstSentence(n.summary), url: n.url ?? null } : null;
}
