# 3D models (optional)

Drop GLB files here to replace the built-in primitive stand-ins. A missing file is fine: the game
draws a primitive instead (it probes each file and ignores Vite's index.html answer for missing files).

## Exact filenames
`habitat.glb`, `solarTower.glb`, `greenhouse.glb`, `rover.glb`, `antenna.glb`, `lander.glb`, `astronaut.glb`, `pati.glb`

## Spec (all files)
- glTF binary (.glb), Y-up, **1 unit = 1 m**, origin at the **ground centre** of the object.
- At most 15,000 triangles per file; textures at most 1024 px; no logos or trademarks.
- Real-world size: habitat ~6 m wide, solar tower ~9 m tall, greenhouse ~7 m, rover ~3 m, antenna ~5 m, lander ~8 m, astronaut ~1.8 m, Pati ~0.6 m long.
- The game scales buildings up to read from orbit; do not pre-scale.

## Named nodes
- `solarTower.glb`: a node named `panel` (the game rotates it around Y to face the Sun; it stands vertical).
- `habitat.glb`: nodes `berm1`, `berm2`, `berm3` (regolith shield layers).

## Animations (exact clip names, all optional)
`idle`, `wag`, `alert`, `run`, `sit`, `walk` (mainly for `pati.glb` and `astronaut.glb`).
`idle` is the default and is the fallback when a requested clip does not exist.