import * as THREE from 'three';
import { useLoader } from '@react-three/fiber';
import { useMemo } from 'react';

/**
 * Loads an animation clip from its pre-extracted JSON instead of from the
 * FBX it came out of.
 *
 * Fifteen of the source FBX exports are mesh-bearing: each carries a
 * redundant copy of the same rig and texture (~3.6 MB) purely to deliver
 * ~30 KB of curves, and the only thing any caller ever does with the result
 * is read `.animations[0]`. public/anims was 67.8 MB, about 52 MB of it the
 * same mesh shipped fifteen times over. The mesh is now loaded exactly once,
 * from stickman_base.fbx, and the curves come from JSON built by
 * `scripts/build-anim-clips.cjs`.
 *
 * Deliberately shaped like `useFBX`'s return value - `{ animations }` - so
 * every call site stays as it was. Root motion is still stripped by the
 * actors at runtime rather than at build time, so behaviour is unchanged.
 */

/**
 * One parsed clip per URL, shared by every actor, which is what useFBX did.
 * It matters: the actors mutate the clip in place via stripRootMotion (an
 * idempotent freeze of the hip X/Z keys), and AnimationMixer.clipAction keys
 * its action cache on clip identity. A fresh clip per caller would silently
 * give every actor its own action set.
 */
const parsedClips = new Map<string, ClipSource>();

/** The `{ animations }` shape useFBX also returns, so call sites are unchanged. */
export interface ClipSource {
  animations: THREE.AnimationClip[];
}

/** Either extension resolves to the JSON. */
const toClipUrl = (path: string): string => path.replace(/\.fbx$/i, '.json');

export const useAnimation = (path: string): ClipSource => {
  const url = toClipUrl(path);
  // FileLoader hands back the raw text and suspends until it is there,
  // exactly as useFBX suspends on its own load.
  const raw = useLoader(THREE.FileLoader, url) as unknown as string;
  return useMemo(() => {
    const cached = parsedClips.get(url);
    if (cached) return cached;
    const json = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const entry = { animations: [THREE.AnimationClip.parse(json)] };
    parsedClips.set(url, entry);
    return entry;
  }, [url, raw]);
};
