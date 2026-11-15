// Upserts public/data/latest.json (+ the may-2024 scenario) into Supabase via PostgREST.
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Without them: prints a skip message and exits 0.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log('SKIP: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY not set; nothing was uploaded (expected until a Supabase project exists).');
  process.exit(0);
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' };

async function rest(table, rows, onConflict, method = 'POST') {
  if (!rows.length) return [];
  const q = onConflict ? `?on_conflict=${onConflict}` : '';
  const res = await fetch(`${url}/rest/v1/${table}${q}`, {
    method, headers: { ...headers, prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

const live = JSON.parse(readFileSync(join(root, 'public/data/latest.json'), 'utf8'));
const byType = Object.fromEntries(live.provenance.map((p) => [p.sourceId, p]));
const SRC = (id, name) => ({ id, name, base_url: 'https://ccmc.gsfc.nasa.gov/DONKI-API/get', license_note: 'NASA public data' });
await rest('source', [SRC('donki-flr', 'DONKI flares'), SRC('donki-cme', 'DONKI CMEs'), SRC('donki-ips', 'DONKI interplanetary shocks'), SRC('donki-sep', 'DONKI SEP'), SRC('donki-notifications', 'DONKI notifications'),
  { id: 'radlab', name: 'NASA OSDR RadLab', base_url: 'https://visualization.osdr.nasa.gov/radlab/api', license_note: 'NASA public data' }], 'id');

const runs = {};
for (const [id, p] of Object.entries(byType)) {
  const [r] = await rest('fetch_run', [{ source_id: id, source_url: p.sourceUrl, started_at: p.fetchedAt, finished_at: new Date().toISOString(), ok: true }]);
  runs[id] = r.id;
}
const prov = (id) => ({ source_id: id, source_url: byType[id].sourceUrl, fetched_at: byType[id].fetchedAt, is_live: byType[id].isLive, fetch_run_id: runs[id] });

await rest('sw_flare', live.flares.map((f) => ({ flr_id: f.flrId, peak_time: f.peakTime, class_type: f.classType, source_location: f.sourceLocation, active_region_num: f.activeRegionNum, ...prov('donki-flr'), raw: f })), 'flr_id');
await rest('sw_cme', live.cmes.map((c) => ({ activity_id: c.activityId, start_time: c.startTime, speed_kms: c.speedKms, half_angle: c.halfAngle, ...prov('donki-cme'), raw: c })), 'activity_id');
await rest('sw_shock_arrival', live.shocks.map((s) => ({ activity_id: s.activityId, event_time: s.eventTime, location: s.location, ...prov('donki-ips'), raw: s })), 'activity_id');
await rest('sw_sep', live.sep.map((s) => ({ sep_id: s.eventTime + '|' + s.instrument, event_time: s.eventTime, instrument: s.instrument, ...prov('donki-sep'), raw: s })), 'sep_id');
await rest('sw_notification', live.notifications.map((n) => ({ message_id: n.messageId, message_type: n.messageType, issue_time: n.issueTime, summary: n.summary, url: n.url, ...prov('donki-notifications'), raw: n })), 'message_id');

// Archive scenario
const sp = join(root, 'src/data/scenarios/may-2024.json');
if (existsSync(sp)) {
  const s = JSON.parse(readFileSync(sp, 'utf8'));
  await rest('scenario', [{ id: s.id, slug: s.slug, title_tr: s.titleTr, title_en: s.titleEn, world: s.world, data_mode: s.dataMode, start_date: s.startDate, end_date: s.endDate, lesson_tr: s.lessonTr, lesson_en: s.lessonEn, generated_at: s.generatedAt, sources: s.sources }], 'id');
  await rest('scenario_day', s.days.map((d) => ({ scenario_id: s.id, day_index: d.dayIndex, date: d.date, sparkle_band: d.sparkleBand, sparkle_ratio: d.sparkleRatio, rad_instrument: d.radInstrument, band_is_assumption: d.bandIsAssumption, alarm_at: d.alarmAt, payload: d })), 'scenario_id,day_index');
}
console.log('Supabase upsert done.');
