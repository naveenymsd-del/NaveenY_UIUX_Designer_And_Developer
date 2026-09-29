/**
 * Art-direction palette. Late-afternoon pastel neighbourhood:
 * warm pinks, soft blues, cream, lavender, muted greens and warm browns.
 */
export const PALETTE = {
  // facades
  cream: 0xf6ecdc,
  ivory: 0xfbf5ea,
  blush: 0xf4c3cc,
  rose: 0xe89aab,
  peach: 0xf6c4a4,
  coral: 0xef8a78,
  lavender: 0xbfaee0,
  lilac: 0xa996d4,
  periwinkle: 0x9fb2e6,
  sky: 0xa9cdec,
  powder: 0xcfe0f2,
  mint: 0xbfe3cf,
  sage: 0x9cc3a0,
  butter: 0xf5dd92,
  mustard: 0xe9b949,
  terracotta: 0xc9765e,
  brick: 0xb86a5c,
  cocoa: 0x8a5f4d,
  walnut: 0x6e4a3b,
  stone: 0xd6cfd9,
  slate: 0x8c86a3,
  charcoal: 0x3b3650,
  ink: 0x2b2350,
  white: 0xffffff,
  // accents
  teal: 0x4fb3a9,
  cobalt: 0x2f3fb8,
  cherry: 0xe0506a,
  tangerine: 0xf39a4a,
  // world
  asphalt: 0x6f6784,
  asphaltDark: 0x5c5572,
  paver: 0xe3cfe0,
  curb: 0xf1e6f0,
  grass: 0x93c47d,
  grassDark: 0x79ad6b,
  soil: 0x9b7560,
  water: 0x7ec8e8,
  leafA: 0x7cbf6a,
  leafB: 0x5fa55e,
  leafC: 0xa6cf5c,
  leafD: 0xe6a0b8, // blossom
  leafE: 0xf1c75b, // autumn gold
  trunk: 0x8a5f4d,
  windowLit: 0xffd9a0,
  windowLit2: 0xffc98a,
  windowLit3: 0xfff0c8,
  glassBlue: 0x5d7fb3,
  glassTeal: 0x5f9fb0,
  lamp: 0xfff1c9,
} as const

export interface FacadeSet {
  wall: number
  trim: number
  accent: number
  roof: number
}

export const FACADE_SETS: FacadeSet[] = [
  { wall: PALETTE.blush, trim: PALETTE.ivory, accent: PALETTE.cherry, roof: PALETTE.rose },
  { wall: PALETTE.cream, trim: PALETTE.walnut, accent: PALETTE.teal, roof: PALETTE.terracotta },
  { wall: PALETTE.lavender, trim: PALETTE.ivory, accent: PALETTE.mustard, roof: PALETTE.lilac },
  { wall: PALETTE.sky, trim: PALETTE.ivory, accent: PALETTE.coral, roof: PALETTE.periwinkle },
  { wall: PALETTE.peach, trim: PALETTE.cream, accent: PALETTE.cobalt, roof: PALETTE.terracotta },
  { wall: PALETTE.mint, trim: PALETTE.ivory, accent: PALETTE.cherry, roof: PALETTE.sage },
  { wall: PALETTE.brick, trim: PALETTE.cream, accent: PALETTE.butter, roof: PALETTE.cocoa },
  { wall: PALETTE.powder, trim: PALETTE.slate, accent: PALETTE.tangerine, roof: PALETTE.periwinkle },
  { wall: PALETTE.butter, trim: PALETTE.ivory, accent: PALETTE.cobalt, roof: PALETTE.mustard },
  { wall: PALETTE.stone, trim: PALETTE.charcoal, accent: PALETTE.coral, roof: PALETTE.slate },
  { wall: PALETTE.rose, trim: PALETTE.ivory, accent: PALETTE.teal, roof: PALETTE.lilac },
  { wall: PALETTE.periwinkle, trim: PALETTE.ivory, accent: PALETTE.butter, roof: PALETTE.slate },
]

export const CLOTHING = [
  0xef8a78, 0x4fb3a9, 0xf5dd92, 0x9fb2e6, 0xe0506a, 0x7cbf6a, 0xa996d4, 0xf39a4a, 0x2f3fb8, 0xf6ecdc,
  0x3b3650, 0xe89aab, 0x5d7fb3, 0xc9765e,
]
export const PANTS = [0x3b3650, 0x2f3fb8, 0x6e4a3b, 0x8c86a3, 0xf6ecdc, 0x4a4468, 0x5d7fb3, 0x2b2350]
export const SKIN = [0xffdcc4, 0xf6c7a5, 0xe3a882, 0xc68660, 0x9a6444, 0xffe6d6]
export const HAIR = [0x2b2350, 0x4a3226, 0x7a4a2c, 0xd8a45a, 0x1d1a24, 0xb85c3c, 0xe9e2f0, 0x5a4a8a]
