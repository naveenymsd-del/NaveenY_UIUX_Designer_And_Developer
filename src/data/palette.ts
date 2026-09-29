/**
 * Art direction: stylised realism in warm daylight. Muted architectural
 * colours (plaster, brick, sand, sage, slate), natural greens, neutral stone
 * paving and restrained accents. Key names are kept stable because the
 * generators reference them; the values define the look.
 */
export const PALETTE = {
  // facades
  cream: 0xeee4d2,
  ivory: 0xf6f1e8,
  blush: 0xdcbcb0,
  rose: 0xc4968a,
  peach: 0xe2bf9f,
  coral: 0xc27a60,
  lavender: 0xb8b3c2,
  lilac: 0x9c93ad,
  periwinkle: 0x8fa2bd,
  sky: 0xa9bdcc,
  powder: 0xd0d8dc,
  mint: 0xbccdbb,
  sage: 0x93a887,
  butter: 0xe3d2a2,
  mustard: 0xc49a4e,
  terracotta: 0xb06a4c,
  brick: 0x9b5442,
  cocoa: 0x785a48,
  walnut: 0x5c4535,
  stone: 0xcdc6b9,
  slate: 0x757a84,
  charcoal: 0x3b3e44,
  ink: 0x24262c,
  white: 0xffffff,
  // accents
  teal: 0x3f7f78,
  cobalt: 0x2f4a8a,
  cherry: 0xa4433d,
  tangerine: 0xc98a45,
  // world
  asphalt: 0x5d5f64,
  asphaltDark: 0x4f5156,
  paver: 0xcfc7ba,
  curb: 0xd8d4cc,
  grass: 0x7fa35a,
  grassDark: 0x6a8f4b,
  soil: 0x7b6150,
  water: 0x6fa6c6,
  leafA: 0x6f9a4c,
  leafB: 0x557f3f,
  leafC: 0x8fae5a,
  leafD: 0xd4a9ae, // soft blossom
  leafE: 0xc99a45, // autumn
  trunk: 0x6e5140,
  windowLit: 0xf4dcb4,
  windowLit2: 0xefcf9f,
  windowLit3: 0xf7ead0,
  glassBlue: 0x6f86a3,
  glassTeal: 0x6a8f98,
  lamp: 0xffe9c4,
} as const

export interface FacadeSet {
  wall: number
  trim: number
  accent: number
  roof: number
}

export const FACADE_SETS: FacadeSet[] = [
  { wall: 0xeee4d3, trim: 0xf7f3ec, accent: 0x3f5e4c, roof: 0x6d6a6a }, // cream plaster
  { wall: 0xa4553f, trim: 0xeee4d2, accent: 0x2b3a33, roof: 0x4f4a48 }, // red brick
  { wall: 0xd9c3a0, trim: 0xf6f1e8, accent: 0x2f3f66, roof: 0xa65a3e }, // warm sand
  { wall: 0xa9b69a, trim: 0xeee4d2, accent: 0xa65a3e, roof: 0x5e6258 }, // sage
  { wall: 0x8193a6, trim: 0xf6f1e8, accent: 0xc49a4e, roof: 0x4f5560 }, // slate blue
  { wall: 0xb9b2a7, trim: 0x3b3e44, accent: 0x9b5442, roof: 0x5c5e62 }, // warm grey
  { wall: 0xc47c5e, trim: 0xeee4d2, accent: 0x2f5d62, roof: 0x6b4638 }, // terracotta plaster
  { wall: 0xe3c9bd, trim: 0xf6f1e8, accent: 0x2f3f66, roof: 0x8a6a5e }, // dusty rose plaster
  { wall: 0xd1a95f, trim: 0xf6f1e8, accent: 0x3f5e4c, roof: 0x6d5a45 }, // ochre
  { wall: 0xcfc8bb, trim: 0x3b3e44, accent: 0x9e3b35, roof: 0x5c5e62 }, // stone
  { wall: 0xa7bac6, trim: 0xf6f1e8, accent: 0x9b5442, roof: 0x5a6068 }, // dusty blue
  { wall: 0x6a6c70, trim: 0xe8e2d6, accent: 0xb08050, roof: 0x3f4145 }, // charcoal render
]

export const CLOTHING = [0xf3f0ea, 0x2f3f66, 0x6f7f68, 0xb8664e, 0xd9c7a6, 0x4f5d73, 0x8c3f45, 0xe8e2d6, 0x3c3c40, 0x7d8fa6]
export const PANTS = [0x2e3445, 0x3b3a3c, 0x5d5b55, 0x8a7a64, 0x2f4358, 0xcfc4b0]
export const SKIN = [0xf1d0b5, 0xe6b894, 0xd29e78, 0xc08a64, 0xa06e4c, 0x7d5238]
export const HAIR = [0x1f1a1c, 0x2e2320, 0x4a3326, 0x6b4a33, 0x8c6a48, 0xb89468]
