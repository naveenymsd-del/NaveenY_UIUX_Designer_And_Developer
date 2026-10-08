# Naveen — interactive 3D portfolio (Mindscape Avenue)

A playable portfolio neighbourhood for the browser. It opens with a cinematic flight: the city emerges from a morning haze, the orange AI companion wakes, and the camera glides under the welcome arch to the avatar. From there you walk the street in third person. The places are the **Education** campus, **My Home** (profile), the **Gallery** park (UI screens from the case studies on easels, the AI-assisted design area and interests), and the **NFC Solutions** office, where colleagues work and the **Project Studio** holds the projects. The journey ends at the **Contact Café**, with thanks, contact links and feedback. Everything is original, procedural geometry. You can swap any piece for your own GLB or audio without touching gameplay code.

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

## The journey — one location config

**`src/data/world.ts`** (`WORLD_STOPS`) defines the route:

- START
- 01 Home
- 02 Education
- 03 NFC Solutions
- 04 Projects (the Project Studio inside the office)
- 05 Gallery
- 06 Contact Café

Each stop sets:

- its name, its question and its icon;
- its minimap position, arrival point and room;
- the companion's lines;
- the words the guide understands.

These all read from it:

- the minimap: markers, route line and active highlight;
- the guide's quick links and typed commands;
- `navigateToLocation`;
- the Next-stop chip;
- the menu.

To add a stop, add an entry, plus an `INTERIORS` entry if it has a room.

The **Contact Café** (on the promenade, west of the start) is the ending:

1. Press E to sit at the window table. Naveen sits across from you and asks how it went.
2. Leave a review, or skip.
3. The contact details appear (Email Me and Call, plus LinkedIn and View Resume once their URLs are set, from `CONTACT` in `src/data/portfolioContent.ts`).

## Story, guide and navigation

The world tells one story in chapters, each arriving as you reach its place:
- 01 Who I am (Home)
- 02 Where I started (campus)
- 04 Where I work (NFC Solutions)
- 05 What I build (Project Studio)
- 06 Work, AI & interests (Gallery)
- 09 Let's talk (Contact Café)

**Content lives in `src/data/portfolioContent.ts`:**
- `SKILL_GROUPS` makes the Home skill wall (one column per group).
- `PROFILE`, `EXPERIENCE`, `EDUCATION`, `CERTIFICATION`, `INTERESTS`, `AI_WORKFLOW`, `GALLERY`, `CONTACT`.
- `GUIDE_ANSWERS`: questions the companion answers ("What tools does he use?") before travelling.
- Education, office and home stories.

**The guide:** click the orange companion, or the guide button in the header, to open *Where would you like to go?*
- Quick links: Home · Education · NFC Solutions · Projects · Gallery · Contact Café, plus one button per project.
- A text box understood locally, with no API. A project name opens that case study; a question ("Where did Naveen study?", "How does he use AI?") gets an answer from `GUIDE_ANSWERS` and then travels; otherwise the stop words in `src/data/world.ts` pick a destination.
- Travel uses `navigateToLocation(dest)`. The camera lifts into a ~2 s aerial glide, the player is moved while the camera is high, rooms are entered with the usual fade, and a soft ring marks the arrival point. Destinations are `DESTINATIONS` in the same file.

**Greetings:** people you pass occasionally say hello. Lines depend on the time of day and the place, and colleagues say "Hey Naveen!". A 42 % roll, a 50 s per-person cooldown and a 5 s global quiet period keep it natural. The lines are `LINES` in `src/components/npc/NPCManager.tsx`.

**Colleagues:** names are in `src/data/colleagues.ts` and are revealed only up close. Who sits, walks and works is `INTERIOR_PEOPLE` / `INTERIOR_ROUTES` in `src/data/interiors.ts`. To add an employee, add them to `COLLEAGUES` and give a person in `INTERIOR_PEOPLE` that `name`.

**Opening:** a light aircraft tows a cloth banner, *WELCOME TO MY PORTFOLIO*, across the sky, then the camera tips down into the city. It is about 15 s, uses the same world at any time of day, and can be skipped with Skip intro or Esc. It isn't forced again in the same browser session. The timing is `INTRO` / `PLANE` in `src/core/intro.ts` and the model is `components/effects/IntroPlane.tsx`.

## AI guide: talk to the portfolio

The orange companion is also a conversational guide. Visitors can explore
normally, or talk (or type) to it. They can ask about Naveen, his experience
or a project, or tell it where to go. It then **walks** them there through the
world. It never teleports.

**It works with no API key, no server and no payment.** Out of the box (no
`VITE_*` variables) the guide uses **browser voice**: the browser's own speech
recognition and speech synthesis, with the guide's built-in brain. That is
turn-by-turn voice, not live speech-to-speech, and the UI says so ("Browser
voice"). Two optional extras plug into the same interfaces later:

| Mode | Needs | Cost |
|---|---|---|
| **Browser voice + built-in brain** (default) | nothing | free |
| Free cloud text brain for open questions the built-in brain can't answer | the Worker in `server/` deployed on a free Cloudflare account (Workers AI binding) + `VITE_GUIDE_ENDPOINT` | free (Workers AI's 10,000 neurons/day; when used up it stops, nothing is charged) |
| Claude text brain | the Worker + `ANTHROPIC_API_KEY` secret | paid API |
| Live speech-to-speech ("Live voice") | the Worker + `OPENAI_API_KEY` secret + `VITE_VOICE_SESSION_ENDPOINT` | paid API |

**How it fits together** (`src/ai/`, all event-driven, nothing in the render loop):

| Layer | File | What it does |
|---|---|---|
| Voice (realtime, optional) | `voice/realtime.ts` | `RealtimeVoice`: speech-to-speech over WebRTC (OpenAI Realtime, `gpt-realtime-2.1`), selected only when `VITE_VOICE_SESSION_ENDPOINT` is set to a real endpoint; otherwise never loaded into the conversation. The browser asks the Worker for a 10-minute session key, never the real API key. Semantic turn detection, interruption (speaking over the guide cuts it off), echo cancellation and noise suppression on the mic, live transcripts both ways. The model can only call the same closed set of world tools. |
| Voice (browser, default) | `voice/types.ts`, `voice/browser.ts` | `BrowserVoice`, behind the same `VoiceProvider` interface (`connect`, `disconnect`, `startListening`, `stopListening`, `interrupt`, `sendText`, `isConnected` + events). Web Speech recognition where supported, synthesis everywhere it exists. Desktop: barge-in by voice (its own voice echoing back is ignored). Phones: the mic pauses while the guide speaks (speaker next to the mic) and a tap interrupts. "Stop listening" / "mute" pause the mic; a tap resumes. Speech is unlocked inside the first tap for Safari/iOS. |
| Knowledge | `knowledge.ts` | Reads `src/data/*` (no new facts): place descriptions, project aliases for misheard names, a small glossary, and `knowledgeText()` for the server brain. |
| Brain | `brain/local.ts` | Built-in and instant. Intent understanding (not exact commands), fuzzy project names ("Intelli staff", "calm scient"), memory and references ("he", "there", "that one", "the previous one", "the mobile one", "the second one"), interruptions ("wait", "actually…", "take me somewhere else"), time-of-day greetings, answer depth ("what is" short, "explain" medium, "explain everything" long), and answers grounded only in the data, in the third person. Honest when it doesn't know; never invents metrics. |
| Portfolio knowledge | `portfolioKnowledge.ts`, `guidePrompt.ts` | What the guide knows about this website itself (stack, world, day/night, AI guide, privacy). `guidePrompt.ts` holds the one set of instructions and tools shared by the realtime voice and the text endpoint, so both behave the same. |
| Tours | `tour.ts` | "Give me a tour" (Home → Education → NFC Solutions → Project Studio → each project → Gallery → Contact) and "Show me all the projects". Walks to each stop, introduces it, then waits. Visitors can say next, skip, go back, pause, continue or stop, and ask questions mid-tour ("Want to continue the tour?" follows). Tour state is kept apart from conversation and navigation. |
| Brain (optional) | `brain/remote.ts` + `server/` | When `VITE_GUIDE_ENDPOINT` is set, only questions the built-in brain has no answer for go to the Worker (Workers AI for free, or Claude with a key). Navigation, tours and context always stay with the built-in brain. See `server/README.md`. |
| Actions | `actions.ts` | The only way the guide changes the world: `navigate`, `navigateProject`, `showSection`, `openPrototype`, `stop`, `goBack`, `help`. Validated against known places and project ids; the UI prototype and the case-study prototype open only from the project's own `prototypeUrl` / `caseStudyUrl`. |
| Walking | `autoWalk.ts` | A small waypoint graph on the pedestrians' sidewalk network plus room aisles. The character walks with the normal controller (collision, walk/jog animation, turning); rooms are entered and left through their doors. Any WASD, arrow or joystick input takes over ("Got it — you're driving."). |
| Orchestration | `guide.ts`, `conversation.ts`, `voiceStore.ts`, `worldState.ts` | Each turn: transcript → brain → speech + bubble + transcript → actions. Session-only memory. Separate stores for voice/UI state, conversation and world. |
| UI | `components/ui/VoiceDock.tsx`, `styles/voice.css` | Orb with state (listening, thinking, speaking, walking), the latest exchange, one contextual hint, a text box, and the voice control, labelled with the mode in use ("Browser voice" or "Live voice"). |

**Consent and privacy.** The microphone is never turned on automatically. The
first tap explains: "Voice mode uses your microphone so I can hear you. Your
portfolio session doesn't store your voice recordings." The visitor then
chooses "Turn on voice" or "Type instead". In browser voice the dialog also
says that the browser does the transcription (Chrome and Edge use their online
speech service) and that it is turn by turn, not live speech-to-speech.
Turning voice off stops listening (and, in live voice, ends the session and
releases every microphone track); so does hiding the tab. No audio is recorded
or stored, and conversations are kept only in memory for the session. **No API
key is ever in the browser or the repository.** Optional keys live only as
Worker secrets; the browser gets at most a short-lived realtime session key.

**Fallbacks.** Live voice (if configured) → browser voice + guide brain → text →
manual exploring. No session endpoint, or it fails: browser voice, and the guide
says so. No speech recognition (e.g. Firefox): typing, with answers still read
aloud. Microphone
blocked: an explanation and typing. No server endpoint, or it's slow: the
built-in brain. No speech synthesis, or sound switched off: text only. The
world keeps working either way.

**Touching the 3D code.** `Player.tsx` follows `playerRuntime.autoWalk`, and
`GameCamera.tsx` keeps settling behind the player during a guided walk unless
the visitor just moved the camera. `AICompanion.tsx` adds a subtle
listening/speaking pulse, and `ProjectPanel.tsx` listens for "show the
challenge". Nothing else in the world changed.

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
- an interaction ("Explore TASK");
- a close-up camera;
- a case-study presentation: the title with **View prototype** beside it (opens Figma in a new tab), role · platform · domain, and two tabs — **Overview** (project overview, my approach, key user flows, information architecture, UI & design system, key screens) and **Challenges** (the challenge, UX & product thinking, design decisions);
- an easel in the Gallery park showing its screens;
- a pavilion in the `/projects` overview.

Only projects with a verified Figma prototype belong in this file (`prototypeUrl`). The case-study content is written from the résumé and the case-study frames in that Figma file; key screens are exported from it into `public/projects/`. No metrics or outcomes are added. The studio fits five bays on its east wall and continues onto the back wall. Extend `STUDIO.BAY_Z` / `BACK_BAYS` in `src/data/interiors.ts` for more.

## Colleagues

Names are in **`src/data/colleagues.ts`**. A name appears only when you walk up to that person, and fades out as you leave. `role` is shown under the name only when filled in; it is empty for everyone by default. `look` picks an avatar build and outfit only, so change it freely. Who sits, walks or waves is set in `INTERIOR_PEOPLE` / `INTERIOR_ROUTES` (`src/data/interiors.ts`).

## Visitors, time and feedback

- **Time:** the HUD shows the visitor's local time and updates on the minute.
- **Visitor count** (`src/services/visitors.ts`): no number is ever invented. Without a backend the HUD says **THIS SESSION · 01**. Set `VITE_VISITOR_ENDPOINT` (e.g. in `.env.local`) to a URL that records a visit on `POST` and returns `{ current?, today?, total? }` on `GET`. A Supabase edge function or Firebase function works, and the HUD then shows the real figures.
- **Feedback** (`src/services/feedback.ts`): one question, four answers, an optional note, and no account needed. Set `VITE_FEEDBACK_ENDPOINT` to a URL that accepts a JSON `POST`. Until then, feedback is kept in this browser (`localStorage` → `mindscape:feedback`), and the UI says so.

## Day & night

The same world is shown at every hour; only the light changes. One time value (0–24 h) in **`src/core/dayNight.ts`** drives everything: sun ↔ moon (one shadow-casting key light), sky gradient, stars and moon, hemisphere and ambient fill, fog, reflections, window lights, street and park lights, vehicle lights, the companion's warmth and the UI tone.

- **Moments:** `MOMENTS` defines golden 17:30, sunset 18:15, blue 18:50, night 19:35, and dawn and sunrise in the morning. The look at each moment is a preset (`DAY`, `GOLDEN`, `SUNSET`, `BLUE`, `NIGHT`, …), blended smoothly in between. The `DAY` preset is exactly the original daytime look.
- **Modes:** the small sun/moon button in the HUD cycles **Auto → Day → Sunset → Night**. Auto starts at the visitor's local time and advances at `DAY_NIGHT_SPEED` in-world minutes per real minute (default 10). Mode changes play a short time-lapse the shorter way round the clock, never a cut.
- **API:** `setTime(hour, animate?)`, `setMode(mode)`, `getTime()` and `useDayNight` (mode, phase, night) for UI. The evaluated state is `sky`, which consumers read each frame.
- **Where it's applied:**
  - `DayNightSystem` handles materials, fog, background and reflections.
  - `Lighting` handles sun/moon, hemisphere and ambient; rooms keep warm indoor light.
  - `Sky` handles the gradient, stars, moon and clouds.
  - `NightLights` handles the local point lights.
  - `TrafficManager` handles tail lights.
- **Windows:** window glass lights up per pane from a stable hash of its position. Some panes stay off, some are dim, the colours range from warm white to amber, and they switch on staggered through the evening. The home, office and campus have their own occupancy (`ZONES` in DayNightSystem). The base probability is `nightUniforms.uWindowP` (0.45).
- **Performance:**
  - No per-window or per-lamp lights: windows, lamp heads and bollards are emissive, and pavement light is shared additive decals.
  - Only 4 pooled point lights (plus one small companion light) follow the nearest anchors. Every `lightPoolAt` call registers one.
  - The light count is constant, so shaders never recompile when night falls.
- **Testing:** `?mode=night`, `?mode=sunset` or `?mode=day` sets the start mode, and `?time=18.9` freezes a time. In dev (or with `?debug`), **N** is night, **M** is day and **T** is +1 hour; D is taken by WASD. `node scripts/qa-daynight.mjs` captures five places at five moments. `node scripts/qa-daynight-toggle.mjs` checks the toggle time-lapses and the office at night.

## Typography

**Bricolage Grotesque** is the display face (optical sizes): the hero, headings and key labels. **Instrument Sans** is the body face: copy, instructions, metadata and navigation. The tokens (`--font-*`, `--text-*`, `--track-*`, `--weight-*`) live in `src/styles/global.css`. The refined interface layer is `src/styles/refine.css`.

## Portfolio content and placeholders

All personal text lives in **`src/data/portfolioContent.ts`**, taken from the résumé. Nothing in it is invented, and there are no placeholders: anything not confirmed is simply left out.

- `PROFILE`: name, role, summary
- `CONTACT`: email and phone; `linkedin` and `resume` stay empty (their buttons hidden) until real URLs are added
- `EXPERIENCE`, `EDUCATION`, `CERTIFICATION` (the one certificate), `SKILL_GROUPS`, `INTERESTS`
- `GALLERY`: built from the project screens; add sketches or photos (`category: 'Sketching' | 'Photography'`) once real files exist
- `EDUCATION_STORIES`, `OFFICE_STORIES`, `HOME_STORIES`: the panels in each room
- `AI_WORKFLOW` (five steps, the last one human), `ACTIVITY_STORIES` (interests): the Gallery park texts

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
node scripts/qa-guide-brain.mjs  # AI guide brain, no browser: ~76 visitor phrasings (intent, memory, references, interruptions, greetings, tours, grounding, honesty); --print shows answers
node scripts/qa-browser-voice.mjs # default free voice, no endpoints: consent, spoken turns, pronouns, barge-in, echo, "stop listening", tour by voice (pause/continue/explain), takeover, voice off, Firefox-like and no-speech fallbacks, phone half-duplex
node scripts/qa-worker.mjs       # the optional Worker offline: 501 with no keys, free Workers AI text brain (grounded, text only), quota → fallback, origin/size/rate guards
node scripts/qa-realtime.mjs     # optional live voice with a fake WebRTC peer (starts its own dev server with a test endpoint): session key flow, transcripts, tool calls, interruption, mic released, fallback
node scripts/qa-tour.mjs         # guided tours in the browser: walked (no teleport), questions mid-tour, next / skip / stop, project tour
node scripts/qa-voice.mjs        # AI guide end to end: consent, conversation, guided walk (no teleport), project, Challenges, prototype, takeover, stop, phone
node scripts/qa-projects.mjs     # every Project Studio bay, tabs, verified prototype links, guide commands
node scripts/qa-content.mjs      # résumé content in every place, gallery, café, no placeholders
```

Known third-party notice: Rapier's WASM loader logs `using deprecated parameters for the initialization function` once at startup. It comes from the library, not from this code, and is harmless.
