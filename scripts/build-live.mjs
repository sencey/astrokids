// Builds public/data/latest.json from the last 30 days of DONKI (live). Usage: node scripts/build-live.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDonki } from './lib/donki.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iso = (d) => d.toISOString().slice(0, 10);
const now = new Date();
const windowEnd = iso(now);
const windowStart = iso(new Date(now.getTime() - 30 * 864e5));

const get = async (type, extra = '') => fetchDonki(type, windowStart, windowEnd, extra);
const [flr, cme, ips, sep, notif] = [await get('FLR'), await get('CME'), await get('IPS'), await get('SEP'), await get('notifications', '&type=all')];
const provenance = [flr, cme, ips, sep, notif].map((r) => r.provenance);

const flares = flr.data.map((f) => ({ flrId: f.flrID, peakTime: f.peakTime, classType: f.classType, sourceLocation: f.sourceLocation ?? null, activeRegionNum: f.activeRegionNum ?? null }));

const cmes = cme.data.map((c) => {
  const a = (c.cmeAnalyses ?? []).find((x) => x.isMostAccurate) ?? c.cmeAnalyses?.[0] ?? null;
  // Latest ENLIL run attached to the analysis (last in list = most recently completed).
  const runs = [...(a?.enlilList ?? [])].sort((x, y) => String(x.modelCompletionTime).localeCompare(String(y.modelCompletionTime)));
  const e = runs.at(-1) ?? null;
  const mars = e?.impactList?.find((i) => i.location === 'Mars') ?? null;
  return {
    activityId: c.activityID,
    startTime: c.startTime,
    speedKms: a?.speed ?? null,
    halfAngle: a?.halfAngle ?? null,
    enlil: e ? { estShockArrivalEarth: e.estimatedShockArrivalTime ?? null, kp90: e.kp_90 ?? null, kp180: e.kp_180 ?? null, mars: mars?.arrivalTime ?? null } : null,
  };
});

const shocks = ips.data.filter((i) => i.location === 'Earth').map((i) => ({ eventTime: i.eventTime, location: i.location, activityId: i.activityID }));
const sepOut = sep.data.map((s) => ({ eventTime: s.eventTime, instrument: s.instruments?.[0]?.displayName ?? 'unknown' }));

const summaryOf = (body = '') => {
  const m = body.match(/##\s*Summary:?\s*([\s\S]*?)(?:\n##\s|$)/i);
  return (m ? m[1] : body).replace(/\s+/g, ' ').trim().slice(0, 400);
};
const notifications = notif.data.map((n) => ({ messageId: n.messageID, messageType: n.messageType, issueTime: n.messageIssueTime, summary: summaryOf(n.messageBody), url: n.messageURL }));

const out = { generatedAt: new Date().toISOString(), windowStart, windowEnd, provenance, flares, cmes, shocks, sep: sepOut, notifications };
mkdirSync(join(root, 'public', 'data'), { recursive: true });
writeFileSync(join(root, 'public', 'data', 'latest.json'), JSON.stringify(out, null, 1));
console.log(`latest.json: ${flares.length} flares, ${cmes.length} CMEs (${cmes.filter((c) => c.enlil).length} with ENLIL), ${shocks.length} shocks, ${sepOut.length} SEP, ${notifications.length} notifications`);
