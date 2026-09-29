/**
 * The site can be served from a sub-path (e.g. GitHub Pages:
 * /NaveenY_UIUX_Designer_And_Developer/). BASE always ends with '/'.
 */
export const BASE = import.meta.env.BASE_URL

/** prefix a root-relative public asset path ('/models/x.glb') with the base */
export const asset = (p: string) => (p.startsWith('/') ? BASE + p.slice(1) : p)
