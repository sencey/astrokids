// Builds src/data/scenarios/may-2024.json and may-2024-compare.json from data/raw/**.
// Usage: node scripts/build-scenario.mjs   (run fetch-donki.mjs 2024-05-07 2024-05-16 and fetch-radlab.mjs first)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rawDonki = (t) => JSON.parse(readFileSync(join(root, 'data/raw/donki', `${t}_2024-05-07_2024-05-16.json`), 'utf8'));
const START = '2024-05-08', END = '2024-05-15';
const FALLBACK = { '2024-05-08': 'calm', '2024-05-09': 'calm', '2024-05-10': 'storm', '2024-05-11': 'storm', '2024-05-12': 'calm', '2024-05-13': 'storm', '2024-05-14': 'super', '2024-05-15': 'calm' };
const band = (r) => (r < 3 ? 'calm' : r < 100 ? 'storm' : 'super');
const day = (t) => String(t).slice(0, 10);
const keep = (t) => t ?? null; // DONKI minute-resolution times are kept as-is ("YYYY-MM-DDTHH:MMZ")

const dates = [];
for (let t = Date.parse(START + 'T00:00:00Z'); t <= Date.parse(END + 'T00:00:00Z'); t += 864e5) dates.push(new Date(t).toISOString().slice(0, 10));

// ---- DONKI
const FLR = rawDonki('FLR'), IPS = rawDonki('IPS'), SEP = rawDonki('SEP'), ENL = rawDonki('WSAEnlilSimulations');
const prov = (r) => r.provenance;

// ---- RadLab (LRO CRaTER drives the Moon base)
const radPath = join(root, 'data/raw/radlab/daily_CRaTER-D1D2.json');
const lro = existsSync(radPath) ? JSON.parse(readFileSync(radPath, 'utf8')) : null;
const radByDate = new Map((lro?.days ?? []).map((d) => [d.date, d]));
const haveRad = lro && dates.every((d) => radByDate.has(d));

// Alarm = first GOES SEISS (observed proton) event of the UTC day; if none, first event that triggered a DONKI notification.
// (A plain 'first SEP of the day' would pick up model/SOHO/STEREO entries hours earlier, e.g. 12:59Z on 05-10 vs GOES 13:35Z.)
const alarmOf = (evs) => {
  const s = [...evs].sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const e = s.find((x) => x.instruments?.some((i) => /^GOES/.test(i.displayName))) ?? s.find((x) => x.sentNotifications?.length);
  if (!e) return { alarmAt: null, alarmKind: null };
  // 'model' = warning came from a model run (e.g. REleASE); 'measured' = a real instrument saw the particles.
  const isModel = e.instruments?.every((i) => /^MODEL/.test(i.displayName));
  return { alarmAt: e.eventTime, alarmKind: isModel ? 'model' : 'measured' };
};
// Archive snapshots are curated, so provenance is never 'live' (latest.json keeps isLive true).
const arch = (p) => ({ ...p, isLive: false });
const sepDays = new Set(SEP.data.map((s) => day(s.eventTime)));
const daysBefore = (date, n) => new Date(Date.parse(date + 'T00:00:00Z') - n * 864e5).toISOString().slice(0, 10);

const days = dates.map((date, dayIndex) => {
  const rad = haveRad ? radByDate.get(date) : null;
  const flares = FLR.data
    .filter((f) => day(f.peakTime) === date && /^[MX]/.test(f.classType))
    .map((f) => ({ peakTime: keep(f.peakTime), classType: f.classType }))
    .sort((a, b) => a.peakTime.localeCompare(b.peakTime));
  const seenArr = new Set();
  const forecasts = ENL.data
    .filter((s) => day(s.modelCompletionTime) === date)
    .sort((a, b) => a.modelCompletionTime.localeCompare(b.modelCompletionTime))
    .filter((s) => { const k = s.estimatedShockArrivalTime ?? 'none'; if (seenArr.has(k)) return false; seenArr.add(k); return true; })
    .map((s) => ({
      simulationId: s.simulationID,
      cmeStart: s.cmeInputs?.map((c) => c.cmeStartTime).sort()[0] ?? null,
      estShockArrivalEarth: s.estimatedShockArrivalTime ?? null,
      kp90: s.kp_90 ?? null,
      kp180: s.kp_180 ?? null,
    }));
  const shocks = IPS.data.filter((i) => i.location === 'Earth' && day(i.eventTime) === date).map((i) => ({ eventTime: i.eventTime, location: i.location })).sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const sepEvents = SEP.data.filter((s) => day(s.eventTime) === date).map((s) => ({ eventTime: s.eventTime, instrument: s.instruments?.[0]?.displayName ?? 'unknown' })).sort((a, b) => a.eventTime.localeCompare(b.eventTime));
  const provenance = [prov(FLR), prov(rawDonki('IPS')), prov(SEP), prov(rawDonki('WSAEnlilSimulations'))];
  if (haveRad) provenance.push(lro.provenance);
  provenance.forEach((p, i) => (provenance[i] = arch(p)));
  const bandOfDay = haveRad ? band(rad.ratio) : FALLBACK[date];
  const alarm = alarmOf(SEP.data.filter((s) => day(s.eventTime) === date));
  return {
    dayIndex, date,
    sparkleBand: bandOfDay,
    sparkleRatio: haveRad ? Number(rad.ratio.toFixed(2)) : null,
    radInstrument: haveRad ? 'LRO CRaTER' : null,
    bandIsAssumption: !haveRad,
    flares, forecasts, shocks, sepEvents,
    ...alarm,
    alertOngoing: bandOfDay !== 'calm' && alarm.alarmAt === null && [1, 2].some((n) => sepDays.has(daysBefore(date, n))),
    provenance,
  };
});

const sources = [...new Map([...['FLR', 'IPS', 'SEP', 'WSAEnlilSimulations'].map((t) => prov(rawDonki(t))), ...(haveRad ? [lro.provenance] : [])].map((p) => [p.sourceUrl, arch(p)])).values()];
const scenario = {
  id: 'may-2024', slug: 'may-2024',
  titleTr: 'Büyük Fırtına, Mayıs 2024', titleEn: 'The Great Storm, May 2024',
  world: 'moon', dataMode: 'archive', startDate: START, endDate: END,
  lessonTr: 'Fırtınayı durduramayız. Ama tahmine bakıp hazırlanabiliriz; hazırlanmanın da bir bedeli vardır.',
  lessonEn: "We can't stop a space storm. But we can read the forecast and get ready, and getting ready always costs something.",
  generatedAt: new Date().toISOString(), sources, days,
};
const outDir = join(root, 'src/data/scenarios');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'may-2024.json'), JSON.stringify(scenario, null, 2));

// ---- Compare file (real RadLab only). Peak within the storm window so ISS "no rise" is honest.
const WIN = ['2024-05-08', '2024-05-31'];
const CMP = [['CRaTER-D1D2', 'LRO CRaTER'], ['BPD', 'BioSentinel BPD'], ['DosTel1', 'ISS DosTel1'], ['MSL-RAD-Surface', 'Curiosity RAD']];
const instruments = [];
for (const [id, label] of CMP) {
  const p = join(root, `data/raw/radlab/daily_${id}.json`);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  const w = j.days.filter((d) => d.date >= WIN[0] && d.date <= WIN[1]);
  const peak = w.reduce((a, b) => (b.ratio > a.ratio ? b : a), w[0]);
  instruments.push({ instrument: label, place: j.place, peakDate: peak.date, ratio: Number(peak.ratio.toFixed(2)), quietBaseline: Number(j.quietBaseline.toFixed(1)), unit: 'uGy/day', provenance: arch(j.provenance) });
}
writeFileSync(join(outDir, 'may-2024-compare.json'), JSON.stringify({
  status: instruments.length ? 'ok' : 'radlab-unavailable',
  note: 'Ratios are peak-day daily dose / quiet baseline (median of 2024-04-01..2024-05-05) within the SAME detector. Never compare absolute values across detectors.',
  peakWindow: WIN, generatedAt: new Date().toISOString(), instruments,
}, null, 2));

// ---- Sanity checks
console.log('date        band   ratio   alarmAt              kind     ongoing flares  forecasts shocks sep');
for (const d of days) console.log(d.date, d.sparkleBand.padEnd(6), String(d.sparkleRatio).padEnd(7), String(d.alarmAt).padEnd(20), String(d.alarmKind).padEnd(8), String(d.alertOngoing).padEnd(7), String(d.flares.length).padEnd(7), String(d.forecasts.length).padEnd(9), String(d.shocks.length).padEnd(6), d.sepEvents.length);
const by = Object.fromEntries(days.map((d) => [d.date, d]));
assert.equal(by['2024-05-10'].alarmAt, '2024-05-10T13:35Z', 'alarmAt 05-10');
assert.ok(by['2024-05-10'].shocks.some((s) => s.eventTime === '2024-05-10T16:36Z'), 'Earth shock 16:36Z');
assert.ok([...by['2024-05-08'].forecasts, ...by['2024-05-09'].forecasts].some((f) => f.estShockArrivalEarth === '2024-05-10T12:50Z'), 'forecast 12:50Z');
assert.ok(by['2024-05-11'].flares.some((f) => f.classType === 'X5.8'), 'X5.8 flare 05-11');
assert.ok(by['2024-05-11'].sepEvents.some((s) => s.eventTime === '2024-05-11T02:10Z'), 'SEP 02:10Z 05-11');
for (const d of days) assert.equal(d.alertOngoing, ['2024-05-12', '2024-05-14', '2024-05-15'].includes(d.date), 'alertOngoing ' + d.date);
assert.deepEqual(days.map((d) => d.alarmKind), [null, 'model', 'measured', 'measured', null, 'measured', null, null], 'alarmKind');
assert.ok(days.every((d) => d.provenance.every((p) => p.isLive === false)) && scenario.sources.every((p) => p.isLive === false), 'archive isLive false');
console.log('Sanity checks PASSED');
console.log(instruments.map((i) => `${i.instrument}: ${i.peakDate} x${i.ratio} (baseline ${i.quietBaseline})`).join('\n'));


