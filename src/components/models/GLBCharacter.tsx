import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { type AnimationAction, type Group, LoopOnce, LoopRepeat, type Mesh } from 'three'
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CharacterAnim } from '@/core/runtime'
import type { ModelAsset } from '@/data/assets'

/**
 * Drives an animated GLB with the same CharacterAnim data the procedural rig
 * uses. Clips are cross-faded by state; walk/run playback speed is scaled by
 * actual ground speed / the clip's authored speed to avoid foot sliding.
 */
export function GLBCharacter({ asset, anim, castShadow = true }: { asset: ModelAsset; anim: CharacterAnim; castShadow?: boolean }) {
  const gltf = useGLTF(asset.url)
  const scene = useMemo(() => {
    const s = skeletonClone(gltf.scene)
    s.traverse((o) => {
      const mesh = o as Mesh
      if (mesh.isMesh) {
        mesh.castShadow = castShadow
        mesh.receiveShadow = true
      }
    })
    return s
  }, [gltf.scene, castShadow])
  const group = useRef<Group>(null!)
  const { actions, names } = useAnimations(gltf.animations, group)
  const current = useRef<AnimationAction | null>(null)
  const currentKey = useRef('')

  const resolve = useMemo(() => {
    const find = (wanted?: string) => {
      if (!wanted) return undefined
      const exact = names.find((n) => n === wanted)
      if (exact) return exact
      const lower = wanted.toLowerCase()
      return names.find((n) => n.toLowerCase().includes(lower))
    }
    const c = asset.clips ?? {}
    return {
      idle: find(c.idle) ?? names[0],
      walk: find(c.walk) ?? find('walk'),
      run: find(c.run) ?? find('run') ?? find(c.walk),
      jump: find(c.jump) ?? find('jump'),
      fall: find(c.fall) ?? find('fall') ?? find(c.jump),
      land: find(c.land) ?? find('land'),
      sit: find(c.sit) ?? find('sit'),
      talk: find(c.talk) ?? find('talk'),
    }
  }, [names, asset.clips])

  useEffect(() => {
    if (names.length === 0 && import.meta.env.DEV) console.info(`[assets] ${asset.url} has no animation clips; using static pose.`)
  }, [names, asset.url])

  useFrame(() => {
    if (!anim.active || names.length === 0) return
    let key: keyof typeof resolve = 'idle'
    if (anim.pose === 'sit' && resolve.sit) key = 'sit'
    else if (anim.pose === 'talk' && resolve.talk) key = 'talk'
    else if (anim.state === 'jump' && resolve.jump) key = 'jump'
    else if (anim.state === 'fall' && resolve.fall) key = 'fall'
    else if (anim.state === 'land' && resolve.land && anim.speed < 1) key = 'land'
    else if (anim.state === 'run' && resolve.run) key = 'run'
    else if ((anim.state === 'walk' || anim.state === 'run') && resolve.walk) key = 'walk'
    const clipName = resolve[key]
    const action = clipName ? actions[clipName] : null
    if (!action) return
    if (currentKey.current !== clipName) {
      action.reset()
      action.setLoop(key === 'jump' || key === 'land' ? LoopOnce : LoopRepeat, Infinity)
      action.clampWhenFinished = true
      action.fadeIn(0.18).play()
      current.current?.fadeOut(0.18)
      current.current = action
      currentKey.current = clipName ?? ''
    }
    if (key === 'walk') action.timeScale = Math.max(0.4, anim.speed / (asset.nativeWalkSpeed ?? 1.6))
    else if (key === 'run') action.timeScale = Math.max(0.6, anim.speed / (asset.nativeRunSpeed ?? 4.5))
    else action.timeScale = 1
  })

  return (
    <group ref={group} rotation-y={asset.rotationY ?? 0} position-y={asset.offsetY ?? 0} scale={asset.scale ?? 1}>
      <primitive object={scene} />
    </group>
  )
}
