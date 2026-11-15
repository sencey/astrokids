# Data pipeline

All scripts are plain Node (v20+, built-in fetch, no npm packages), ES modules.

| Script | What it does |
|---|---|
| `scripts/lib/donki.mjs` | Fetch helper: 3 tries with backoff, 2 s spacing between requests, returns `{ data, provenance }` (`sourceUrl` = exact request URL, `fetchedAt` = UTC now, `isLive` = true). |
| `scripts/fetch-donki.mjs <start> <end>` | Saves FLR, CME, IPS, SEP, GST, WSAEnlilSimulations to `data/raw/donki/<TYPE>_<start>_<end>.json` as `{ provenance, data }`. Scenario input used: `2024-05-07 2024-05-16`. |
| `scripts/fetch-radlab.mjs` | Pulls RadLab dose-rate rows per detector for 2024-04-01..2024-05-31 and reduces them to daily values in `data/raw/radlab/daily_<instrument_id>.json` (+ `STATUS.md`). |
| `scripts/build-scenario.mjs` | Builds `src/data/scenarios/may-2024.json` (8 days, 2024-05-08..15) and `may-2024-compare.json`, then asserts the sanity checks. Falls back to assumed bands if RadLab files are missing. |
| `scripts/build-live.mjs` | Last 30 days from DONKI -> `public/data/latest.json`. |
| `scripts/upsert-supabase.mjs` | Upserts latest.json + the scenario to Supabase (PostgREST). Needs `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; otherwise prints a skip message and exits 0. |
| `supabase/schema.sql` | Postgres DDL, RLS (public read-only), `increment_choice()` security-definer function for `agg_choice`. |
| `.github/workflows/nightly.yml` | Nightly 02:17 UTC live refresh + upsert + commit; Monday 03:41 UTC RadLab refresh. |

## Sources
- NASA DONKI (CCMC): `https://ccmc.gsfc.nasa.gov/DONKI-API/get/{FLR|CME|IPS|SEP|GST|WSAEnlilSimulations|notifications}?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` (no key, CORS `*`; do not use api.nasa.gov).
- NASA OSDR RadLab: `https://visualization.osdr.nasa.gov/radlab/api/` (docs: `/radlab/gui/data-api/`).

## RadLab status: WORKING
The bare `/radlab/api` URL answers 308 -> `/radlab/api/`, then 500 "No columns specified" until columns are requested. Working query shape:
`.../api/?instrument_id=CRaTER-D1D2&timestamp>=2024-05-01&timestamp<2024-05-11&absorbed_dose_rate&format=json` returns `{columns,index,data}`.
Instrument ids: LRO CRaTER = `CRaTER-D1D2` (Moon, "Lunar orbit"), BioSentinel = `BPD`, ISS = `DosTel1` / `DosTel2` (Columbus), Curiosity = `MSL-RAD-Surface`. Values are dose RATES in uGy/hour; daily dose = mean over the UTC day x 24.
Quiet baseline = median of 2024-04-01..2024-05-05 daily values, per instrument. **Only compare ratios within the same detector, never absolute values across detectors.**

## Event-to-day rules
An event belongs to the UTC date of its time. Flares: class M/X by peakTime. Forecasts: WSA-ENLIL runs by modelCompletionTime (identical Earth arrival times deduplicated). Shocks: IPS with location Earth. `alarmAt`: first GOES SEISS SEP event of the day (observed), else first SEP with a DONKI notification.
Bands from the LRO ratio: <3 calm, 3..<100 storm, >=100 super.

## The isLive rule
The UI shows a LIVE badge only if `provenance.isLive === true` AND `fetchedAt` is within 36 h of now AND the event is within the last 7 days. Everything else is shown as "archive" with its fetch date. Archive scenario files are labelled `dataMode: 'archive'`; the `isLive` flag in them only records that the bytes came from the live endpoint at fetch time, so the UI must not show LIVE for them (the 7-day event rule fails).

