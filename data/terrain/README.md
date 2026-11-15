# Terrain data pipeline (Connecting Ridge, lunar south pole)

Outputs live in `public/terrain/connecting-ridge/` (format contract: see `meta.json`), plus `public/moon/` and `public/earth/` globe textures.
All numbers come from NASA products or are computed from them; nothing is hand-made. `meta.json.placeholder` is `false`.

## Sources (all fetched 2026-11-14, `isLive:false`)
- Elevation: NASA GSFC PGDA / LOLA, `LDEM_80S_20MPP_ADJ.TIF` (20 m/px, Barker et al. 2021) for the 26 km window around the site, and `LDEM_80S_80MPP_ADJ.TIF` (80 m/px) for a +-80 km surrounding window used only for horizon ray-marching. Read via HTTP range requests (cloud-optimised GeoTIFF), cached as raw float32 in `data/terrain/raw/` (git-ignored).
- Illumination: PGDA product 69 `AVGVISIB_85S_060M_201608.TIF` (average solar illumination, 60 m/px, Mazarico et al. 2011). int16, scale 4e-5 -> fraction.
- Permanent shadow: PGDA product 69 `LPSR_85S_060M_201608.TIF` (official PSR map; raw +20000 = PSR).
- Ephemeris: npm `astronomy-engine` 2.1.19 (Sun, Moon). Moon orientation: IAU 2015 rotation model (Archinal et al. 2018).
- Globe textures: NASA SVS 4720 CGI Moon Kit (Moon colour 2k + displacement 1k, unmodified) and NASA SVS 3615 (Earth, Blue Marble Next Generation based, downscaled to 1024x512). See `credits.json` in each folder.
- LROC WAC_POLE_ILL_TWI_SOUTH was not needed (PGDA worked).

## Processing (`scripts/terrain`, Node, own package.json; `npm ci`)
1. `node extract.mjs` - download DEM windows. 2. `node build.mjs` - everything else (about 5 min). `checkephem.mjs` compares the Moon frame with astronomy-engine `Libration()`.
- Site: 18 km square centred at PS (-4500, -9000) m = (-89.668, 206.57 E); N=256 -> 70.3125 m cells. Contains the sunlit ridge on the left/bottom, the Shackleton wall and floor (PSR) on the right. The pole is at the top edge.
- height: 4x4 box average of the 20 m DEM per cell, metres vs a 1737.4 km sphere.
- illum: bilinear resample of the NASA map. psr: nearest neighbour of the official PSR map.
- lit: ephemeris every 10 min per UTC day; per cell a 360-azimuth horizon profile by marching the DEM out to 85 km (planar PS distance, d^2/2R curvature drop); sunlit when Sun-centre elevation > horizon. Result = percent of the day.
- sun/earth json: hourly az/el at the site centre; az clockwise from grid north (+y of the map, image up).

## Known limitations
- Point Sun (no penumbra, no solar disc 0.53 deg); no refraction/dust; shadows only from the 70 m / 20 m DEM (no boulders).
- IAU Moon rotation used instead of the exact LOLA "ME" frame (about 0.02 deg difference, ~0.5 km); sub-Earth point matches astronomy-engine libration to 0.001 deg lon / 0.025 deg lat.
- NASA illumination is a multi-year average, ours is 15 days in a season when the sub-solar latitude is +1 deg (low for the south pole) - they differ by design. See `validation` in meta.json.
- 6% of PSR cells show a few percent of light in our calculation (crater edges, 60 m vs 70 m grid, frame error).
- Moon displacement map is 8-bit JPEG; its height scale is not documented on the SVS page.

(After build.mjs, run `node patchmeta.mjs` which rewrites meta.json gridNorthNote and validation.note wording.)
