// Fetch RadLab (NASA OSDR) dose-rate series and reduce to DAILY values per detector.
// API docs: https://visualization.osdr.nasa.gov/radlab/gui/data-api/  (GET, key=value filters, format=json)
// Dose rate unit is uGy/hour; daily dose (uGy/day) = mean(rate over samples of the UTC day) * 24.
// RULE: never mix absolute values across detectors; only ratios within the same detector.
// Usage: node scripts/fetch-radlab.mjs [start=2024-04-01] [end=2024-05-31]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchJson } from './lib/donki.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://visualization.osdr.nasa.gov/radlab/api/';
const [START, END] = [process.argv[2] ?? '2024-04-01', process.argv[3] ?? '2024-05-31'];
const QUIET_END = '2024-05-05';

// instrument_id as used by RadLab -> place in the compare screen
export const INSTRUMENTS = [
  { id: 'CRaTER-D1D2', label: 'LRO CRaTER', place: 'lunarOrbit' },
  { id: 'BPD', label: 'BioSentinel BPD', place: 'deepSpace' },
  { id: 'DosTel1', label: 'ISS DosTel1', place: 'iss' },
  { id: 'DosTel2', label: 'ISS DosTel2', place: 'iss' },
  { id: 'MSL-RAD-Surface', label: 'Curiosity RAD', place: 'marsSurface' },
];

const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

mkdirSync(join(root, 'data', 'raw', 'radlab'), { recursive: true });
const summary = [];
for (const inst of INSTRUMENTS) {
  const sums = new Map(); // date -> {n, sum}
  const provs = [];
  for (let s = START; s <= END; s = addDays(s, 10)) {
    const e = addDays(s, 10) > addDays(END, 1) ? addDays(END, 1) : addDays(s, 10);
    const url = `${API}?instrument_id=${inst.id}&timestamp>=${s}&timestamp<${e}&absorbed_dose_rate&format=json`;
    const { data, provenance } = await fetchJson(url, { sourceId: 'radlab' });
    provs.push(provenance);
    const ci = data.columns.indexOf('timestamp');
    const ri = data.columns.indexOf('absorbed_dose_rate');
    for (const row of data.data) {
      const v = Number(row[ri]);
      if (!Number.isFinite(v)) continue;
      const day = String(row[ci]).slice(0, 10);
      const o = sums.get(day) ?? { n: 0, sum: 0 };
      o.n++; o.sum += v;
      sums.set(day, o);
    }
  }
  const days = [...sums.keys()].sort().map((date) => {
    const { n, sum } = sums.get(date);
    return { date, samples: n, meanRateUGyPerHour: sum / n, doseUGyPerDay: (sum / n) * 24 };
  });
  const quiet = days.filter((d) => d.date <= QUIET_END).map((d) => d.doseUGyPerDay);
  const baseline = quiet.length ? median(quiet) : null;
  const out = {
    instrumentId: inst.id, label: inst.label, place: inst.place, unit: 'uGy/day',
    range: [START, END], quietBaselineWindow: ['2024-04-01', QUIET_END],
    quietBaseline: baseline, quietDays: quiet.length,
    provenance: { sourceId: 'radlab', sourceUrl: `${API}?instrument_id=${inst.id}&timestamp>=${START}&timestamp<${addDays(END, 1)}&absorbed_dose_rate&format=json`, fetchedAt: provs.at(-1).fetchedAt, isLive: true },
    days: days.map((d) => ({ ...d, ratio: baseline ? d.doseUGyPerDay / baseline : null })),
  };
  writeFileSync(join(root, 'data', 'raw', 'radlab', `daily_${inst.id}.json`), JSON.stringify(out, null, 1));
  const peak = out.days.reduce((a, b) => (b.ratio > a.ratio ? b : a), out.days[0]);
  summary.push({ id: inst.id, days: days.length, baseline: baseline?.toFixed(1), peakDate: peak?.date, peakDose: peak?.doseUGyPerDay.toFixed(0), peakRatio: peak?.ratio.toFixed(1) });
  console.log(summary.at(-1));
}
writeFileSync(join(root, 'data', 'raw', 'radlab', 'STATUS.md'),
`# RadLab status\n\nWorking (fetched ${new Date().toISOString()}). API: ${API} (docs at /radlab/gui/data-api/). Key-value GET syntax, format=json returns {columns,index,data}. Native rows are ~hourly (LRO, Curiosity) or ~minutely (ISS, BioSentinel) dose RATES in uGy/hour; this script averages per UTC day and multiplies by 24.\n\n\`\`\`json\n${JSON.stringify(summary, null, 1)}\n\`\`\`\n`);
