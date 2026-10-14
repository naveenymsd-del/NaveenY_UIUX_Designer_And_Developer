/**
 * The Music Lounge library — the one place to edit what plays.
 *
 * WHAT ACTUALLY PLAYS HERE
 * - `generative` tracks are original pieces composed for this portfolio and
 *   performed live by the visitor's browser (Web Audio, see engine.ts). Nothing
 *   is downloaded, so there is nothing to license.
 * - `file` tracks play an audio file you host. Only add files you are allowed
 *   to use (your own, properly licensed royalty-free, or public domain with a
 *   public-domain *recording*) and fill in `license` and `credit` truthfully.
 *   Put the file in /public/music/ and use url: '/music/your-file.mp3'.
 *
 * WHAT DOESN'T PLAY HERE
 * - `elsewhere` entries are famous songs we recommend. We don't have the rights
 *   to stream them, so they only link out (Spotify / YouTube Music search).
 */
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
} as const

export type Style = 'warm' | 'bouncy' | 'airy' | 'lofi' | 'pulse'
export interface GenSource { kind: 'generative'; bpm: number; root: number; mode: keyof typeof SCALES; progression: number[]; style: Style; seed: number }
export interface FileSource { kind: 'file'; url: string; license: string; credit: string }
export interface Track { id: string; title: string; albumId: string; duration: number; source: GenSource | FileSource }
export type Motif = 'sun' | 'confetti' | 'waves' | 'grid' | 'moon'
export interface Album { id: string; title: string; artist: string; motif: Motif; palette: [string, string, string, string]; blurb: string }
export interface Rec { title: string; artist: string }
export interface Playlist { id: string; title: string; blurb: string; trackIds: string[]; elsewhere: Rec[] }

export const ORIGINALS_ARTIST = 'Mindspace Sessions'
export const ORIGINALS_NOTE = 'Original pieces composed for this portfolio and played live by your browser — no recordings are downloaded.'

export const ALBUMS: Album[] = [
  { id: 'sunday-light', title: 'Sunday Light', artist: ORIGINALS_ARTIST, motif: 'sun', palette: ['#f6c177', '#ee8f5a', '#fbe7c6', '#7a3e2b'], blurb: 'Warm, unhurried instrumentals for a slow morning.' },
  { id: 'pocket-parade', title: 'Pocket Parade', artist: ORIGINALS_ARTIST, motif: 'confetti', palette: ['#ffd23f', '#ff5d8f', '#3bceac', '#2a2a72'], blurb: 'Bouncy, sunny tunes that refuse to sit still.' },
  { id: 'slow-tide', title: 'Slow Tide', artist: ORIGINALS_ARTIST, motif: 'waves', palette: ['#9ad1d4', '#3f8f9c', '#e8f3f1', '#1d3b4a'], blurb: 'Soft, drifting music for unwinding.' },
  { id: 'deep-work', title: 'Deep Work', artist: ORIGINALS_ARTIST, motif: 'grid', palette: ['#cfd3da', '#5b6472', '#f2f2ef', '#1c1f26'], blurb: 'Steady pulses for focus and making things.' },
  { id: 'night-garden', title: 'Night Garden', artist: ORIGINALS_ARTIST, motif: 'moon', palette: ['#b8a9e8', '#4b3f8f', '#efe9ff', '#14122b'], blurb: 'Late-evening calm with a little glow.' },
]

const g = (bpm: number, root: number, mode: GenSource['mode'], progression: number[], style: Style, seed: number): GenSource => ({ kind: 'generative', bpm, root, mode, progression, style, seed })

export const TRACKS: Track[] = [
  { id: 'golden-hour-walk', title: 'Golden Hour Walk', albumId: 'sunday-light', duration: 168, source: g(92, 62, 'major', [0, 4, 5, 3], 'warm', 11) },
  { id: 'window-seat', title: 'Window Seat', albumId: 'sunday-light', duration: 154, source: g(84, 65, 'lydian', [0, 1, 5, 4], 'airy', 12) },
  { id: 'little-victories', title: 'Little Victories', albumId: 'sunday-light', duration: 146, source: g(104, 67, 'major', [0, 3, 4, 0], 'warm', 13) },
  { id: 'confetti-brain', title: 'Confetti Brain', albumId: 'pocket-parade', duration: 138, source: g(118, 60, 'major', [0, 5, 3, 4], 'bouncy', 21) },
  { id: 'rubber-duck-strut', title: 'Rubber Duck Strut', albumId: 'pocket-parade', duration: 150, source: g(112, 69, 'mixolydian', [0, 6, 3, 0], 'bouncy', 22) },
  { id: 'yes-and', title: 'Yes, And!', albumId: 'pocket-parade', duration: 132, source: g(124, 64, 'major', [0, 4, 5, 3], 'pulse', 23) },
  { id: 'low-tide-hum', title: 'Low Tide Hum', albumId: 'slow-tide', duration: 196, source: g(70, 63, 'major', [0, 5, 3, 4], 'airy', 31) },
  { id: 'paper-boats', title: 'Paper Boats', albumId: 'slow-tide', duration: 172, source: g(78, 57, 'dorian', [0, 3, 0, 4], 'lofi', 32) },
  { id: 'sofa-weather', title: 'Sofa Weather', albumId: 'slow-tide', duration: 164, source: g(74, 65, 'major', [0, 2, 3, 4], 'lofi', 33) },
  { id: 'grid-systems', title: 'Grid Systems', albumId: 'deep-work', duration: 200, source: g(96, 60, 'dorian', [0, 3, 6, 4], 'pulse', 41) },
  { id: 'quiet-prototype', title: 'Quiet Prototype', albumId: 'deep-work', duration: 182, source: g(80, 55, 'dorian', [0, 2, 3, 4], 'airy', 42) },
  { id: 'flow-state', title: 'Flow State', albumId: 'deep-work', duration: 190, source: g(100, 62, 'minor', [0, 5, 2, 6], 'pulse', 43) },
  { id: 'moon-lanterns', title: 'Moon Lanterns', albumId: 'night-garden', duration: 188, source: g(66, 59, 'minor', [0, 5, 2, 6], 'airy', 51) },
  { id: 'fireflies', title: 'Fireflies', albumId: 'night-garden', duration: 158, source: g(88, 64, 'major', [0, 3, 5, 4], 'warm', 52) },
  { id: 'last-train-home', title: 'Last Train Home', albumId: 'night-garden', duration: 170, source: g(76, 61, 'major', [0, 5, 1, 4], 'lofi', 53) },
]

export const PLAYLISTS: Playlist[] = [
  {
    id: 'classics', title: 'Feel-Good Classics', blurb: 'Famous songs we love. We can’t stream them here, so they open in Spotify or YouTube Music.', trackIds: [],
    elsewhere: [
      { title: 'Here Comes the Sun', artist: 'The Beatles' }, { title: 'Lovely Day', artist: 'Bill Withers' }, { title: 'September', artist: 'Earth, Wind & Fire' },
      { title: 'Don’t Stop Me Now', artist: 'Queen' }, { title: 'Walking on Sunshine', artist: 'Katrina and the Waves' }, { title: 'Three Little Birds', artist: 'Bob Marley & The Wailers' },
      { title: 'Ain’t No Mountain High Enough', artist: 'Marvin Gaye & Tammi Terrell' }, { title: 'Mr. Blue Sky', artist: 'Electric Light Orchestra' },
    ],
  },
  {
    id: 'happy', title: 'Happy Energy', blurb: 'Bouncy originals to play here — plus a few big hits to open elsewhere.', trackIds: ['confetti-brain', 'rubber-duck-strut', 'yes-and', 'little-victories'],
    elsewhere: [{ title: 'Happy', artist: 'Pharrell Williams' }, { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars' }, { title: 'Can’t Stop the Feeling!', artist: 'Justin Timberlake' }, { title: 'Dancing Queen', artist: 'ABBA' }],
  },
  {
    id: 'chill', title: 'Chill & Unwind', blurb: 'Soft and slow. Put your feet up.', trackIds: ['low-tide-hum', 'paper-boats', 'sofa-weather', 'moon-lanterns', 'last-train-home'],
    elsewhere: [{ title: 'Banana Pancakes', artist: 'Jack Johnson' }, { title: 'Put Your Records On', artist: 'Corinne Bailey Rae' }],
  },
  {
    id: 'instrumentals', title: 'Feel-Good Instrumentals', blurb: 'No words, just warmth.', trackIds: ['golden-hour-walk', 'window-seat', 'little-victories', 'fireflies'],
    elsewhere: [{ title: 'Gymnopédie No. 1', artist: 'Erik Satie' }, { title: 'Clair de Lune', artist: 'Claude Debussy' }],
  },
  {
    id: 'focus', title: 'Focus & Creativity', blurb: 'Steady and unobtrusive — good company for design work.', trackIds: ['grid-systems', 'quiet-prototype', 'flow-state', 'window-seat'],
    elsewhere: [{ title: 'Weightless', artist: 'Marconi Union' }, { title: 'Experience', artist: 'Ludovico Einaudi' }],
  },
]

export const trackById = (id: string | null | undefined) => TRACKS.find((t) => t.id === id)
export const albumById = (id: string) => ALBUMS.find((a) => a.id === id)!
export const albumOf = (t: Track) => albumById(t.albumId)
export const tracksOf = (albumId: string) => TRACKS.filter((t) => t.albumId === albumId)
export const fmt = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`
export const spotifySearch = (r: Rec) => `https://open.spotify.com/search/${encodeURIComponent(`${r.title} ${r.artist}`)}`
export const ytMusicSearch = (r: Rec) => `https://music.youtube.com/search?q=${encodeURIComponent(`${r.title} ${r.artist}`)}`
