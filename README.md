# Naveen — interactive 3D portfolio (Mindscape Avenue)

A playable portfolio neighbourhood for the browser. It opens with a cinematic flight: the city emerges from a morning haze, the orange AI companion wakes, and the camera glides under the welcome arch to the avatar. From there you walk the street in third person. The places are the **Education** campus, **My Home** (profile), the **Design Park** (design process, AI workflow and activities), and the **NFC Solutions** office, where colleagues work and the **Project Studio** holds the projects. The journey ends at **The Lookout**, with thanks, contact links and feedback. Everything is original, procedural geometry. You can swap any piece for your own GLB or audio without touching gameplay code.

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

## Visitor flow

1. **Loading** shows a dark skyline whose windows switch on as the world builds, with staged messages ("Preparing the people…") and "Ready.".
2. **Intro** is a cinematic flight (about 16 s, with **Skip intro** or Esc) that ends on the hero: name, one line, **Start exploring** / **View my work**.
3. **Start exploring** puts you on the street. The companion greets you in two or three short lines and suggests where to begin.
4. **View my work** takes you straight to the Project Studio inside NFC Solutions.
5. As you explore, the companion speaks only at meaningful moments: arriving somewhere, opening a project, and one rare nudge after a long quiet spell.

## Routes and modes

- `/street` is the experience.
- `/projects` is kept as a fallback overview of every project (pavilions around the plaza). It links back to the Project Studio.

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
- **NPC LOD by distance.** Near NPCs update fully. Mid-distance ones update every third frame. Far ones are paused and hidden. Street pedestrians use a lighter mesh (about 40 % fewer triangles). The player and people indoors keep full detail.
- **Quality tiers.** `low`, `medium` and `high` are picked from the device and GPU class. `PerformanceMonitor` then adapts resolution and can step the tier down. Lower tiers use cheaper shadows, updated every other frame, and FXAA instead of MSAA. Small details never cast shadows.
- **Shadow frustum.** The shadow frustum follows the player and is snapped to shadow-map texels, so edges don't shimmer.

### Game feel

- **Movement** accelerates and decelerates smoothly, with speed-limited turning, coyote time and jump buffering.
- **Animations.** A landing squash scales with fall height. Legs, knees and feet are driven by a gait phase advanced by *distance travelled*, and swing amplitude comes from stride length, so feet don't skate. The walk has a heel-to-toe roll, and the pelvis bobs, sways and turns against the chest. Blends cover idle, walk, run, jump, fall, land, turn-in-place and strafe cross-steps. Overlays add talk, wave, work, read, coffee and phone poses, plus seated variants, head gaze and blinking. An office colleague turns and waves when you arrive.
- **Camera.** Third person, with lag, clamped pitch and collision (it pulls in fast and eases out slowly). It auto-aligns gently when you walk forward. Foliage near the camera dissolves with a dither instead of filling the screen. Landmarks get a short cinematic reveal the first time you enter their zone.

## Projects (Project Studio)

Projects live in **`src/data/projects.ts`** (`PROJECT_CONTENT`). Each entry automatically gets:

- a screen bay in the Project Studio (it switches on as you approach);
- an interaction ("Explore IntelliStaff");
- a close-up camera;
- a case-study presentation (Overview · Challenge · Process · UI · Prototype · Outcome);
- a pavilion in the `/projects` overview.

Only real facts belong in this file. Unknown fields stay `[ADD …]` and are highlighted in the UI. Put screenshots in `public/projects/<id>/` and list them in `screens`. Add links (case study, prototype, live) to `links`. The studio fits five bays on its east wall and continues onto the back wall. Extend `STUDIO.BAY_Z` / `BACK_BAYS` in `src/data/interiors.ts` for more.

## Colleagues

Names are in **`src/data/colleagues.ts`**. A name appears only when you walk up to that person, and fades out as you leave. `role` is shown under the name only when filled in; it is empty for everyone by default. `look` picks an avatar build and outfit only, so change it freely. Who sits, walks or waves is set in `INTERIOR_PEOPLE` / `INTERIOR_ROUTES` (`src/data/interiors.ts`).

## Visitors, time and feedback

- **Time:** the HUD shows the visitor's local time and updates on the minute.
- **Visitor count** (`src/services/visitors.ts`): no number is ever invented. Without a backend the HUD says **THIS SESSION · 01**. Set `VITE_VISITOR_ENDPOINT` (e.g. in `.env.local`) to a URL that records a visit on `POST` and returns `{ current?, today?, total? }` on `GET`. A Supabase edge function or Firebase function works, and the HUD then shows the real figures.
- **Feedback** (`src/services/feedback.ts`): one question, four answers, an optional note, and no account needed. Set `VITE_FEEDBACK_ENDPOINT` to a URL that accepts a JSON `POST`. Until then, feedback is kept in this browser (`localStorage` → `mindscape:feedback`), and the UI says so.

## Typography

**Bricolage Grotesque** is the display face (optical sizes): the hero, headings and key labels. **Instrument Sans** is the body face: copy, instructions, metadata and navigation. The tokens (`--font-*`, `--text-*`, `--track-*`, `--weight-*`) live in `src/styles/global.css`. The refined interface layer is `src/styles/refine.css`.

## Portfolio content and placeholders

All personal text lives in **`src/data/portfolioContent.ts`**. Nothing in it is invented. Anything that needs a real fact is a `[BRACKETED PLACEHOLDER]`. These placeholders render highlighted in the panels until you replace them. Search the file for `[` to find them:

- `PROFILE`: name, role, tagline
- `CONTACT`: email, LinkedIn, resume, portfolio links (any placeholder shows as "coming soon", never as a broken link)
- `EDUCATION_TIMELINE` / `EDUCATION_STORIES`: degree, institution, years, certificates
- `OFFICE_STORIES`: role, responsibilities and team at NFC Solutions
- `HOME_STORIES`: about me, personal journey, interests
- `DESIGN_PROCESS` (steps 01–09), `AI_WORKFLOW`, `ACTIVITY_STORIES`: the Design Park texts

The NFC Solutions building uses text signage only. To use the official logo, add it and reference it in `landmarkGen.genOffice` / `interiorGen`, keeping its aspect ratio.

### Interiors

Rooms are real geometry placed far east of the city (x = 320), and entering one fades and teleports you there. They are defined in `src/data/interiors.ts`, which holds:

- size, palette, entry and exit poses and the establishing shot
- desks, people and walking routes
- story anchors (`INTERIOR_STORIES`)

`src/utils/interiorGen.ts` builds the furniture. Animated story props (timeline, chalkboard, laptop, curtains, nameplate and so on) live in `components/interactions/StoryProps.tsx`. The enter/exit sequence is `src/core/interiors.ts`.

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
node scripts/qa-rooms.mjs        # enter and exit every interior
node scripts/qa-intro.mjs        # loading → each beat of the cinematic → hero → street
node scripts/qa-studio.mjs       # View my work → Project Studio → case study → colleague name → back outside
node scripts/qa-journey.mjs      # menu sections, the Lookout thank-you + feedback, mobile hero
node scripts/qa-closeup.mjs      # avatar + companion close-ups (debug camera: window.__shot)
```

Known third-party notice: Rapier's WASM loader logs `using deprecated parameters for the initialization function` once at startup. It comes from the library, not from this code, and is harmless.
