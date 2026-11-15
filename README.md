# Moon Base Commander

NASA Space Apps Challenge 2026 — *Build a Junior Astronaut Mission Trainer*.

**Play it:** https://sencey.github.io/astrokids/ (phone or desktop browser, no install)

A browser game for kids aged 7–12: the player commands a base at the Moon's south pole, on NASA's real LOLA terrain of the Connecting Ridge (Shackleton – de Gerlache), and splits a limited power budget between life support, ice mining, a greenhouse, a regolith radiation shield and science. The mission replays the real 8–22 May 2024 superstorm week; a second mode, "Today's Moon", uses today's Sun position and the latest NASA DONKI space weather. Pati, a dog in a spacesuit, is the commander's advisor.

## Run

```bash
npm install
npm run dev
```

Checks: `npm run typecheck`, `npm test`, `npm run build`. Never run `tsc` with emit: stray `.js` files in `src/` shadow the TypeScript sources.

## Data

Every NASA dataset, what it drives in the game and its URL is listed in the in-game **Sources** panel and in:

- `data/README.md` — DONKI and OSDR RadLab pipeline (`scripts/`)
- `data/terrain/README.md` — LOLA terrain, polar illumination, permanently shadowed regions, computed sunlight (`scripts/terrain/`)
- `public/moon/credits.json`, `public/earth/credits.json` — NASA SVS textures

Archive data is labelled ARCHIVE; only `public/data/latest.json` (refreshed nightly from DONKI) can show a LIVE badge, and only while it is less than 36 hours old.

## Demo video

`art/video/astrakids-film.mp4` (26.5 s) opens with real NASA Artemis I launch footage ("Artemis I Launch (Press Site)", NASA Image and Video Library, public domain). Every other shot is rendered from this project's own 3D scenes and NASA data (`film.html`, `src/film/`, `scripts/video/film-*.mjs`). Music and sound effects are synthesized by our scripts; the narration is SI-generated (ElevenLabs, see below).

## Use of Super Intelligence (SI)

In line with the Space Apps 2026 rules, we disclose SI use:

- **Code and data processing:** most of the TypeScript source, the data-processing scripts in `scripts/` and the automated tests were generated with Anthropic Claude models (Claude Sonnet writing code under the review of Claude Opus), then run, tested in a browser and accepted by the team.
- **Images:** the Pati character art in `art/pati-source/` and `public/pati/` is SI-generated. The AstroKids logo in `art/brand/` and `public/brand/` is SI-generated too. SI-generated images (Pati art, AstroKids logo) are disclosed in the in-game "About this game" panel on the title screen and here.
- **Audio:** Pati's English voice lines are SI-generated with ElevenLabs text-to-speech (voice "Killian"); see `public/audio/voice/en/credits.json`. Lines without a recording (and the Turkish version) fall back to the browser's built-in text-to-speech.
- **Not SI:** all terrain, illumination, radiation and space-weather numbers come from the cited NASA sources; the Moon and Earth textures are NASA SVS imagery.

## Hosting and performance

- **Caching.** `assets/*` files are content-hashed: serve them with `Cache-Control: public, max-age=31536000, immutable`. The terrain bins (`terrain/connecting-ridge/*.bin`), audio and `moon/` textures never change for a given build: serve them with `public, max-age=31536000, immutable` too (rename the file if the data ever changes). Keep `index.html` and `data/latest.json` at `no-cache` / a few minutes.
- **Compression.** Enable gzip or brotli for `.bin` and `.json` (content type `application/octet-stream`): `lit-may-2024.bin` is 983 KB raw but about 84 KB gzipped (most cells are 0 or 100), so this is the single biggest saving on mobile. We did not add a custom RLE format: host compression gets the same win with no extra decoder to test.
- **Quality tiers** (`src/three/config.ts`): `low` / `medium` (touch devices) / `high`. The game steps down one tier at runtime if it stays under 30 fps for 3 s. Force one with `?tier=low|medium|high` (disables the automatic step); `?lowpower=1` still works. `?fps` shows a corner readout (fps, tier, DPR, draw calls, triangles).

## Privacy

No accounts, no personal data, no ads, no third-party analytics. Progress stays on the device.
