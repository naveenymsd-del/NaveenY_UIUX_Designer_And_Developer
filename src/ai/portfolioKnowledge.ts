/**
 * What the guide knows about the portfolio itself — how this world is built.
 * Every statement here is checked against the repository (package.json,
 * README, src/). Pure data, no browser APIs: the server prompt uses it too.
 */
import { PROJECT_CONTENT } from '../data/projects'

/** how the visitor is talking to the guide right now (answers about voice depend on it) */
export type VoiceTier = 'realtime' | 'browser' | 'text' | 'off'

export const STACK = {
  ui: 'React 19 with TypeScript, built with Vite 7',
  three: 'three.js (r180) through React Three Fiber 9 and drei 10',
  physics: 'Rapier physics (@react-three/rapier 2)',
  post: 'post-processing effects (@react-three/postprocessing 3)',
  state: 'Zustand 5 for state',
  fonts: 'Bricolage Grotesque and Instrument Sans',
  hosting: 'a static site published to GitHub Pages by a GitHub Actions workflow',
}

export type PortfolioTopic =
  | 'stack' | 'architecture' | 'world' | 'character' | 'navigation' | 'aiGuide' | 'voice' | 'security'
  | 'studio' | 'minimap' | 'websiteOrGame' | 'why' | 'dayNight'

/** answers about the portfolio, short by default; `deep` for "explain the architecture" */
export function portfolioAnswer(topic: PortfolioTopic, tier: VoiceTier, deep = false): string {
  const voiceNow =
    tier === 'realtime' ? 'Right now you’re on realtime voice: your speech streams to a voice service and my replies stream back as audio, so you can interrupt me any time.'
      : tier === 'browser' ? 'Right now this is browser voice: your browser’s own speech recognition turns each sentence into text, I answer, and your browser reads the answer aloud. It’s turn by turn — not live speech-to-speech — so there’s a short pause after you finish speaking.'
        : 'Right now we’re talking by text.'
  switch (topic) {
    case 'stack':
      return deep
        ? `It’s a web app: ${STACK.ui}. The 3D world is ${STACK.three}, with ${STACK.physics}, ${STACK.post} and ${STACK.state}. It’s hosted as ${STACK.hosting}.`
        : `It’s a website built like a small game — React and TypeScript with Vite, and three.js through React Three Fiber for the 3D world, with Rapier for physics.`
    case 'architecture':
      return `There are two layers. The 3D world is ${STACK.three}: the city, buildings, people and props are generated procedurally from layout data, colliders are simple boxes and cylinders in Rapier, and the character uses Rapier’s kinematic character controller. On top sits the HTML interface — the case studies, minimap, menu and this conversation — with ${STACK.state}. All the content comes from a few data files, so one place drives the minimap, navigation, the Project Studio and what I know.${deep ? ' The AI guide is its own layer: it understands what you say, keeps track of where you are, and can only call a fixed set of actions — walk somewhere, open a project, switch a case-study tab, open a Figma link, stop or go back.' : ''}`
    case 'world':
      return 'The world is original procedural geometry — buildings, streets, trees and people are generated in code from a layout file, not downloaded models. One time-of-day value drives the sun, sky, fog and lights, and pedestrians and cars follow waypoint routes.'
    case 'dayNight':
      return 'One time-of-day value drives everything — sun and moon, sky, fog, window lights, street lights and the interface tone. You can switch between auto, day, sunset and night with the small sun button.'
    case 'character':
      return 'The character is a kinematic capsule driven by Rapier’s character controller — it handles slopes, steps and collisions — and the body is a procedural rig whose walk and run are driven by real speed, so the feet don’t slide. A third-person camera follows with collision.'
    case 'navigation':
      return `When you ask me to take you somewhere, I don’t teleport you. I plan a route on the same sidewalk waypoints the pedestrians use, and your character walks it with the normal controller and animations. Rooms are entered through their doors, and inside the office there’s an aisle route to each project screen. Press any movement key and you take over straight away.`
    case 'aiGuide':
      return `I’m the AI guide layer on top of the world. When you speak or type, I work out what you mean, keep track of what we’re talking about and where you are, and answer only from the portfolio’s own data. To change the world I can only call a fixed set of actions — walk to a place, walk to a project, switch a case-study tab, open a Figma link, stop, go back or run a tour. ${voiceNow}`
    case 'voice':
      return `${voiceNow} The voice layer is pluggable: a live speech-to-speech service can be connected when one is configured; without it, I use your browser’s speech, and where the browser can’t listen, typing — and the portfolio itself always works with the keyboard and mouse.`
    case 'security':
      return `No — the portfolio doesn’t record or keep your voice, and our conversation lives only in this visit. ${tier === 'realtime' ? 'Your voice is processed live by the voice service so I can understand you. ' : tier === 'browser' ? 'Your browser’s own speech service turns your voice into text. ' : ''}And no permanent AI key ever reaches your browser: when realtime voice is on, a small server endpoint creates a short-lived session for your visit.`
    case 'studio':
      return `The Project Studio is a glass wing inside the NFC Solutions office. Each project is one data entry, and that entry creates its screen bay, its case study with Overview and Challenges tabs, and its Figma links — ${PROJECT_CONTENT.length} projects right now.`
    case 'minimap':
      return 'The minimap, the next-stop chip, the menu and my navigation all read from one location config — so every place exists once, with its position, arrival point and room.'
    case 'websiteOrGame':
      return 'Both, really — it’s a website you can play. Everything runs in the browser, you can walk it like a game, and every place, project and contact detail is also reachable from the menu or by asking me.'
    case 'why':
      return 'The idea is a portfolio you explore rather than scroll: his story — home, education, work, projects, contact — becomes places you can walk to, with me as a guide if you’d rather just talk.'
  }
}

/** which portfolio topic a question is about (null when it isn't about the portfolio itself) */
export function portfolioTopic(t: string): PortfolioTopic | null {
  if (/\b(api key|secure|security|privacy|private)\b|\b(voice|audio|data|conversation|recording)s? (is |are |get |gets )?(stored|saved|kept|recorded)\b|\b(store|save|keep|record)s? (my|what i)\b/.test(t)) return 'security'
  if (/\b(voice|speech|hear me|microphone|mic)\b/.test(t) && /\b(how|work|works)\b/.test(t) && !/\b(naveen|his)\b/.test(t)) return 'voice'
  // questions about the guide itself ("how do you work?", "how does the AI navigate?") — not Naveen's AI workflow
  if (/\bhow (do|does|can) (you|the ai|this ai|the guide|the companion|your ai|the assistant)\b/.test(t) && /\b(work|navigate|understand|know|walk|move|take me|find)\b/.test(t) && !/\b(design|workflow|developers?|naveen|he|his|use ai|tools?|figma|projects?)\b/.test(t)) {
    return /\b(navigat\w*|walk|move|take me|find)\b/.test(t) ? 'navigation' : 'aiGuide'
  }
  if (/\b(character|avatar|player)\b/.test(t) && /\b(move|moves|walk|walks|work|controls?)\b/.test(t)) return 'character'
  if (/\b(minimap|mini map|map)\b/.test(t)) return 'minimap'
  if (/\b(project studio|studio)\b/.test(t) && /\b(how|work)\b/.test(t)) return 'studio'
  if (/\b(day|night|sunset|time of day)\b/.test(t) && /\b(how|work|change)\b/.test(t)) return 'dayNight'
  if (/\bwebsite or (a )?game|game or (a )?website|is this a (game|website)\b/.test(t)) return 'websiteOrGame'
  if (/\bwhy did (he|naveen) (build|make|create|design) (this|it|the portfolio|this portfolio|this website|this world)\b|\bwhy (a )?3d\b/.test(t)) return 'why'
  if (/\barchitecture\b/.test(t)) return 'architecture'
  if (/\b(technolog\w*|tech stack|stack|framework|libraries|what is (this|it) (built|made) (with|in)|built with|made with|three ?js|react)\b/.test(t)) return 'stack'
  if (/\b(3d world|the world|this world)\b/.test(t) && /\b(how|work|built|made)\b/.test(t)) return 'world'
  return null
}
