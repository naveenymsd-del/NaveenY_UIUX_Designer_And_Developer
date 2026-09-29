# Mindscape Avenue

A playable 3D neighbourhood for the browser. You walk a stylised city street in third person, visit a café, gallery, store, studio and landmark, and browse five project pavilions. Everything is original, procedural geometry: there are no downloaded models, textures or sounds. Any piece can be swapped for your own GLB or audio files without touching gameplay code.

```bash
npm install
npm run dev        # http://localhost:5173/street
npm run build      # type-check + production bundle in dist/
npm run preview    # serve the production build
```

**Stack:** React 19 · TypeScript · Vite 7 · three.js r180 · @react-three/fiber 9 · drei 10 · @react-three/rapier 2 · @react-three/postprocessing 3 · Zustand 5

## Controls

| | Desktop | Touch |
|---|---|---|
| Move | `W A S D` / arrows | joystick (bottom-left) |
| Run | hold `Shift` | push the stick past ~90 % |
| Jump | `Space` | jump button (bottom-right) |
| Look | drag the mouse · scroll to zoom | drag the view · pinch to zoom |
| Interact | `E` (or click the prompt) | tap **Explore** |
| Close / back | `Esc` | Back / ✕ |
| Toggle tips | `H` | — |

## Routes and modes

- `/street` is exploration mode.
- `/projects` is the project discovery overview. Hover a card to preview a pavilion, click it to open the project. **Walk here** drops you next to that pavilion on foot.

Routing is client-side (`history.pushState`), so there are no page reloads, and back/forward works.

## Architecture

The app has two layers: the WebGL world (`components/game`, `environment`, `player`, `npc`, `vehicles`, `interactions`, `effects`) and the HTML/CSS UI above it (`components/ui`). The UI covers navigation, panels, prompts, menus, loading and accessibility.

```
src/
  app/            App shell, client routes
  core/           per-frame runtime state (no React re-renders), input, sound manager
  stores/         Zustand: gameStore (phase, mode, panels, loading), playerStore, uiStore, assetStore
  data/           everything data-driven: city layout, locations, projects, NPC routes, traffic loops, assets
  utils/          procedural generation (partBuilder, buildingGen, specialGen, propGen, cityGen),
                  materials/shaders, canvas textures + atlases, movement maths, quality tiers
  components/
    game/         Canvas, world assembly, camera director, debug probe
    environment/  instanced city renderer, ground, colliders, sky, screens, water, glass
    player/       kinematic character controller
    models/       replaceable model slots (CharacterModel, VehicleModel/GLB, PropModels, BuildingModel)
    npc/          pedestrian manager + agent
    vehicles/     traffic manager + vehicles
    interactions/ proximity manager, beacons, prompt anchor
    effects/      lighting, post-processing, particles, dust, birds, blob shadows
    ui/           HUD, panels, menu, joystick, loading, intro, minimap, a11y
```

### How it stays fast

- **Batching.** The city is authored as ~30k small parts, such as a window frame or an awning stripe. They are batched into `InstancedMesh`es by geometry + material, with spatial chunks for large groups so frustum culling still works. The whole neighbourhood renders in roughly 150–350 draw calls, shadows included.
- **Atlases.** All shop signs share one canvas atlas and one draw call. Shop interiors, artwork and the map board share a second one. Per-instance UVs are applied in the shader.
- **One draw call per character.** Each character, player and NPCs alike, is a single `SkinnedMesh`: every primitive part is merged and rigidly bound to a procedural bone.
- **Simple physics.** Colliders are simple cuboids and cylinders, with no trimesh anywhere. The player uses Rapier's kinematic character controller. NPCs and vehicles are kinematic and path-driven, so there are no dynamic bodies.
- **NPC LOD by distance.** Near NPCs update fully. Mid-distance ones update every third frame. Far ones are paused and hidden.
- **Quality tiers.** `low`, `medium` and `high` are picked from the device and GPU class. `PerformanceMonitor` then adapts resolution and can step the tier down. Lower tiers use cheaper shadows, updated every other frame, and FXAA instead of MSAA. Small details never cast shadows.
- **Shadow frustum.** The shadow frustum follows the player and is snapped to shadow-map texels, so edges don't shimmer.

### Game feel

- **Movement** accelerates and decelerates smoothly, with speed-limited turning, coyote time and jump buffering.
- **Animations.** A landing squash scales with fall height. Legs, knees and feet are driven by a gait phase advanced by *distance travelled*, and swing amplitude comes from stride length, so feet don't skate. Blends cover idle, walk, run, jump, fall, land, turn lean and strafe cross-steps. NPCs add sit, talk, window-shopping and phone poses.
- **Camera.** Third person, with lag, clamped pitch and collision (it pulls in fast and eases out slowly). It auto-aligns gently when you walk forward. Foliage near the camera dissolves with a dither instead of filling the screen. Landmarks get a short cinematic reveal the first time you enter their zone.

## Adding or changing content

Everything interactive is data. Add an entry to `src/data/locations.ts` and the beacon, prompt, `E` interaction, camera shot, panel, minimap label and accessible overview all pick it up. Projects live in `src/data/projects.ts`; each one gets a pavilion in the plaza automatically.

- **Buildings.** Hand-placed lots and generated frontages are in `src/data/cityLayout.ts`. Styles are `shop`, `apartment`, `corner`, `townhouse` and `tower`, and the landmarks have bespoke generators.
- **NPCs.** Waypoint routes, sitters, conversations and window-shoppers are in `src/data/npcPaths.ts`.
- **Traffic.** Lane loops are in `src/data/vehiclePaths.ts`.
- **Game feel.** Movement tuning is `MOVE` in `src/utils/movement.ts`. Camera defaults are `CAMERA_DEFAULTS` in `src/core/runtime.ts`.

## Replacing placeholder assets with GLB

At startup the app probes `/public/models`. It checks the real file bytes, not just the HTTP status, because dev servers answer missing files with `index.html`. If a file is missing, the procedural placeholder is used. If a file exists but fails to load, an error boundary falls back to the placeholder and logs `Failed to load … Using placeholder`.

| File | Replaces | Notes |
|---|---|---|
| `models/character.glb` | player | clips `Idle Walk Run Jump Fall Land` (names configurable) |
| `models/npc.glb` | pedestrians | clips `Idle Walk Sit Talk` |
| `models/car.glb`, `van.glb`, `bus.glb` | vehicles | forward = +Z, origin on the ground |
| `models/tree.glb`, `bench.glb`, `lamp.glb` | street props | placed at every generated spot; collision is kept |
| any building | set `model: '/models/building-a.glb'` on a `BuildingDef` | auto-fitted to the lot footprint |

Scale, yaw correction, vertical offset, clip names and the authored walk/run speeds live in `src/data/assets.ts`. The authored speeds are used to match playback speed to ground speed, so imported walk cycles don't slide.

## Audio

The sound manager synthesises every sound with WebAudio when files are absent: footsteps, jump, land, UI clicks, interaction chimes, city hum, birds, engine hum near traffic and a soft generative pad. To use real audio, drop these files into `public/audio/`:

```
ambient-city.mp3  music.mp3  birds.mp3  footstep.mp3  jump.mp3
land.mp3  ui-click.mp3  interact.mp3  open.mp3  vehicle.mp3
```

The sound button toggles everything. The preference is saved in `localStorage` (`mindscape-avenue:sound`). Audio starts on the first user gesture, as browsers require.

## Accessibility

- All UI is real HTML: buttons have labels and visible focus states, and every panel is keyboard reachable.
- Tabbing from the page start reveals an accessible overview that lists every place and project and opens each one directly.
- A polite live region announces what's nearby.
- Browsers without WebGL get a plain HTML version of the content.
- `prefers-reduced-motion` is respected by the UI.

## Debugging and QA

- `?debug` shows an HUD with fps, draw calls, triangles and player state.
- `?quality=low|medium|high` forces a tier.
- `?touch` / `?desktop` forces the input mode.
- `?physics` draws the colliders.
- `?off=shadows,npc,traffic,parts,env,particles` disables subsystems for profiling.

`scripts/qa.mjs` drives the locally installed Chrome through automated scenarios and writes screenshots to `qa-screens/`: `smoke`, `move`, `projects`, `mobile`, `viewports`, `perf`, `tiers`, `profile`, `tour`, `all`.

```bash
npm run dev
npm run qa                       # all scenarios (CHROME_PATH=... to use another Chromium)
npm run qa:collision             # facade / fountain / ramp / boundary / traffic checks
```

Known third-party notice: Rapier's WASM loader logs `using deprecated parameters for the initialization function` once at startup. It comes from the library, not from this code, and is harmless.
