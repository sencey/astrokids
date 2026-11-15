// Usage: node scripts/fetch-donki.mjs <start> <end>
// Saves data/raw/donki/<TYPE>_<start>_<end>.json as { provenance, data }.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchDonki } from './lib/donki.mjs';

export const TYPES = ['FLR', 'CME', 'IPS', 'SEP', 'GST', 'WSAEnlilSimulations'];
const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const [start, end] = process.argv.slice(2);
if (!start || !end) {
  console.error('Usage: node scripts/fetch-donki.mjs <YYYY-MM-DD> <YYYY-MM-DD>');
  process.exit(1);
}
const outDir = join(root, 'data', 'raw', 'donki');
mkdirSync(outDir, { recursive: true });
for (const type of TYPES) {
  const { data, provenance } = await fetchDonki(type, start, end);
  const file = join(outDir, `${type}_${start}_${end}.json`);
  writeFileSync(file, JSON.stringify({ provenance, data }, null, 1));
  console.log(`${type}: ${Array.isArray(data) ? data.length : '?'} records -> ${file}`);
}
