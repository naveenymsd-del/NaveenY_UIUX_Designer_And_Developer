/**
 * Check whether an optional asset really exists. Dev servers with an SPA
 * fallback answer missing files with index.html (HTTP 200), so we inspect the
 * content-type and, for GLB, the 'glTF' magic bytes. Files not present in /public at
 * build time (or when the dev server started) are never requested.
 */
declare const __PUBLIC_FILES__: string[]

export async function probeAsset(url: string, kind: 'model' | 'audio'): Promise<boolean> {
  // skip the request entirely when the file isn't in /public (listed at build / dev-server start)
  const rel = '/' + url.slice(import.meta.env.BASE_URL.length)
  if (!__PUBLIC_FILES__.includes(rel)) return false
  try {
    const res = await fetch(url, { headers: { Range: 'bytes=0-15' }, cache: 'no-cache' })
    if (!res.ok && res.status !== 206) return false
    const type = res.headers.get('content-type') ?? ''
    if (type.includes('text/html')) return false
    if (kind === 'audio') return type.startsWith('audio/') || type.includes('octet-stream') || type.includes('mpeg') || type.includes('ogg')
    const buf = new Uint8Array(await res.arrayBuffer())
    if (url.endsWith('.glb')) return buf.length >= 4 && buf[0] === 0x67 && buf[1] === 0x6c && buf[2] === 0x54 && buf[3] === 0x46
    return buf.length > 0 && buf[0] === 0x7b // .gltf json
  } catch {
    return false
  }
}
