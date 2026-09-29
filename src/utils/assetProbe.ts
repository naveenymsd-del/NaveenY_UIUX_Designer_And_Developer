/**
 * Check whether an optional asset really exists. Dev servers with an SPA
 * fallback answer missing files with index.html (HTTP 200), so we inspect the
 * content-type and, for GLB, the 'glTF' magic bytes.
 */
export async function probeAsset(url: string, kind: 'model' | 'audio'): Promise<boolean> {
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
