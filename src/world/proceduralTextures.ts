import * as THREE from 'three';

/**
 * Procedural material textures for the arena rooms.
 *
 * There are ~30 rooms and each wants its own surface. Shipping 30 image files
 * would mean sourcing 30 licences, so these are painted into a canvas at
 * runtime instead: no downloads, no asset licences, nothing to redistribute,
 * and they weigh nothing in the build. Same reasoning as the procedural
 * football.
 *
 * Every material is a shared noise base plus a per-material painter, so
 * adding a room is a palette and a few strokes rather than an art pipeline.
 */

export type MaterialKey =
  // Tier 1 — the outdoors
  | 'sand' | 'rock' | 'grass' | 'dirt' | 'water' | 'snow' | 'badlands' | 'garden'
  // Tier 2 — underground and burning
  | 'magma' | 'cave' | 'darkConcrete' | 'volcano' | 'burntHouse' | 'amethyst' | 'iron' | 'copper'
  // Tier 3 — precious and strange
  | 'gold' | 'rainbow' | 'blue' | 'blood' | 'darkOcean' | 'night' | 'galaxy'
  // Tier 4 — hard and rare
  | 'diamond' | 'assassin' | 'pitch' | 'platinum' | 'glass' | 'clear' | 'illusion'
  // Tier 5 — the end
  | 'nightmare' | 'pitchBlack' | 'bone' | 'rust' | 'rift' | 'blackIce' | 'furnace' | 'hollow';

const SIZE = 256;

const cache = new Map<MaterialKey, THREE.CanvasTexture>();

// Deterministic per-material noise, so a texture looks the same every session
// and two rooms of the same material can't drift apart.
const mulberry32 = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hashKey = (key: string) => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
};

interface Recipe {
  /** Flat base fill. */
  base: string;
  /** Speckle colours scattered over the base. */
  speckle: string[];
  /** How much speckle, 0..1. */
  density: number;
  /** Optional extra pass for a material's signature look. */
  pass?: (ctx: CanvasRenderingContext2D, rand: () => number) => void;
}

// Soft blobby patches — the default "natural surface" look.
const blobs = (colors: string[], count: number, min: number, max: number, alpha = 1) =>
  (ctx: CanvasRenderingContext2D, rand: () => number) => {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      const r = min + rand() * (max - min);
      ctx.beginPath();
      ctx.arc(rand() * SIZE, rand() * SIZE, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

// Angular facets — for crystal, gem and metal surfaces.
const facets = (colors: string[], count: number, size: number, alpha = 0.85) =>
  (ctx: CanvasRenderingContext2D, rand: () => number) => {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      const cx = rand() * SIZE;
      const cy = rand() * SIZE;
      const s = size * (0.5 + rand());
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.beginPath();
      const sides = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < sides; k++) {
        const a = (k / sides) * Math.PI * 2 + rand();
        ctx.lineTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

// Horizontal banding — strata, water, wood-ish surfaces.
const bands = (colors: string[], count: number, alpha = 0.5) =>
  (ctx: CanvasRenderingContext2D, rand: () => number) => {
    ctx.globalAlpha = alpha;
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      const y = rand() * SIZE;
      ctx.fillRect(0, y, SIZE, 2 + rand() * 9);
    }
    ctx.globalAlpha = 1;
  };

// Bright pinpoints — stars, sparkle, glints.
const sparks = (colors: string[], count: number, maxR = 1.8) =>
  (ctx: CanvasRenderingContext2D, rand: () => number) => {
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
      ctx.beginPath();
      ctx.arc(rand() * SIZE, rand() * SIZE, rand() * maxR, 0, Math.PI * 2);
      ctx.fill();
    }
  };

const RECIPES: Record<MaterialKey, Recipe> = {
  // ── Tier 1 ──
  sand:      { base: '#d9c08a', speckle: ['#c9ad74', '#e8d3a4'], density: 0.5, pass: bands(['#cbb079'], 14, 0.35) },
  rock:      { base: '#6f7276', speckle: ['#5a5d61', '#868a8f', '#4c4f52'], density: 0.75, pass: facets(['#5f6367', '#7d8185'], 26, 18, 0.55) },
  grass:     { base: '#3f7a35', speckle: ['#2f6128', '#569447', '#87b26a'], density: 0.9 },
  dirt:      { base: '#6b4f34', speckle: ['#553f29', '#7d5f41', '#8a6b4a'], density: 0.7, pass: blobs(['#4d3a26'], 20, 6, 20, 0.5) },
  water:     { base: '#2a6f9e', speckle: ['#3a89bd', '#1e5c86'], density: 0.35, pass: bands(['#4fa3d1', '#215e88'], 26, 0.45) },
  snow:      { base: '#eef4f8', speckle: ['#dbe6ee', '#ffffff'], density: 0.45, pass: sparks(['#ffffff'], 200, 1.4) },
  badlands:  { base: '#a5603c', speckle: ['#8a4c2e', '#c07a4e'], density: 0.5, pass: bands(['#7d4227', '#c9895c'], 22, 0.55) },
  garden:    { base: '#4b8a3c', speckle: ['#3a6f2e', '#6aa855'], density: 0.7, pass: blobs(['#e05b8a', '#e8c14a', '#c959b0'], 34, 2, 5) },

  // ── Tier 2 ──
  magma:       { base: '#4a1a10', speckle: ['#7a2a14', '#331109'], density: 0.6, pass: blobs(['#ff5722', '#ff8a3d', '#ffb066'], 28, 3, 13) },
  cave:        { base: '#3b3a38', speckle: ['#2c2b29', '#4a4946'], density: 0.7, pass: facets(['#2a2927'], 20, 22, 0.5) },
  darkConcrete:{ base: '#38393b', speckle: ['#2b2c2e', '#454648'], density: 0.6 },
  volcano:     { base: '#2e1a15', speckle: ['#45241b', '#1d100c'], density: 0.65, pass: blobs(['#ff4500', '#c9340a'], 16, 2, 9) },
  burntHouse:  { base: '#3a2f28', speckle: ['#241d18', '#4d3f35'], density: 0.6, pass: bands(['#1c1614'], 18, 0.6) },
  amethyst:    { base: '#4a2a6b', speckle: ['#5f3688', '#37204f'], density: 0.4, pass: facets(['#8a5cc4', '#a87ae0', '#6b3fa0'], 34, 20, 0.8) },
  iron:        { base: '#6a6d71', speckle: ['#55585c', '#7f8388'], density: 0.5, pass: bands(['#4a4d51', '#8a8e93'], 18, 0.4) },
  copper:      { base: '#a9603a', speckle: ['#8d4d2c', '#c47a4e'], density: 0.5, pass: blobs(['#4f9d84'], 14, 4, 14, 0.35) },

  // ── Tier 3 ──
  gold:      { base: '#c9a227', speckle: ['#a8851b', '#e8c95a'], density: 0.45, pass: facets(['#f0d878', '#b8901f'], 24, 16, 0.7) },
  rainbow:   { base: '#3a2f4a', speckle: ['#ff4d4d', '#ffa64d', '#ffe94d', '#4dff77', '#4dc3ff', '#a64dff'], density: 1, pass: bands(['#ff4d4d', '#4dc3ff', '#4dff77', '#ffe94d'], 30, 0.55) },
  blue:      { base: '#1f3f8a', speckle: ['#2c56b8', '#16305f'], density: 0.5, pass: facets(['#3f6fd6'], 20, 18, 0.5) },
  blood:     { base: '#5a1216', speckle: ['#7d1a1f', '#3d0c0f'], density: 0.6, pass: blobs(['#8f1f24', '#2d080a'], 24, 4, 16, 0.7) },
  darkOcean: { base: '#0b2434', speckle: ['#123448', '#071823'], density: 0.5, pass: bands(['#18506b'], 20, 0.35) },
  night:     { base: '#141a2e', speckle: ['#1d2540', '#0d1120'], density: 0.5, pass: sparks(['#ffffff', '#cfe0ff'], 160, 1.2) },
  galaxy:    { base: '#120d24', speckle: ['#1e1440', '#2b1d5c'], density: 0.5, pass: (ctx, rand) => { blobs(['#6b3fa0', '#3f6fd6', '#a03f7a'], 22, 14, 44, 0.35)(ctx, rand); sparks(['#ffffff', '#ffe9a8'], 220, 1.5)(ctx, rand); } },

  // ── Tier 4 ──
  diamond:   { base: '#cfe9f2', speckle: ['#b6dbe8', '#eafaff'], density: 0.35, pass: facets(['#ffffff', '#9fd2e4'], 40, 15, 0.7) },
  assassin:  { base: '#1e2427', speckle: ['#161b1e', '#2b3337'], density: 0.6, pass: bands(['#0f1315'], 16, 0.5) },
  pitch:     { base: '#2f6b3a', speckle: ['#275c31', '#387a44'], density: 0.6, pass: bands(['#357040', '#2a6035'], 16, 0.5) },
  platinum:  { base: '#c3c9cd', speckle: ['#aeb5ba', '#e2e7ea'], density: 0.4, pass: facets(['#ffffff', '#9aa1a6'], 26, 14, 0.55) },
  glass:     { base: '#bcd7de', speckle: ['#a8c8d1', '#e0f2f6'], density: 0.3, pass: facets(['#ffffff'], 22, 26, 0.35) },
  clear:     { base: '#d8ecf2', speckle: ['#c6e2ea', '#f2fbfd'], density: 0.25, pass: facets(['#ffffff'], 16, 30, 0.25) },
  illusion:  { base: '#5a4a7a', speckle: ['#6f5c94', '#463a60'], density: 0.5, pass: (ctx, rand) => { bands(['#8f7ac4', '#3f3357'], 26, 0.4)(ctx, rand); sparks(['#d9c9ff'], 90, 1.6)(ctx, rand); } },

  // ── Tier 5 ──
  nightmare: { base: '#160f18', speckle: ['#241628', '#0d090e'], density: 0.6, pass: (ctx, rand) => { blobs(['#3d1030', '#5c1233'], 18, 8, 30, 0.5)(ctx, rand); sparks(['#ff2d55'], 40, 1.4)(ctx, rand); } },
  pitchBlack:{ base: '#08080a', speckle: ['#0d0d10', '#050506'], density: 0.5 },
  bone:      { base: '#ddd4bd', speckle: ['#c9bfa4', '#efe8d6'], density: 0.5, pass: bands(['#b8ad91'], 14, 0.35) },
  rust:      { base: '#8a4a28', speckle: ['#6d371c', '#a86038'], density: 0.7, pass: blobs(['#4a2413', '#c47a4e'], 24, 4, 15, 0.6) },
  rift:      { base: '#0a0616', speckle: ['#150c2b', '#05030d'], density: 0.5, pass: (ctx, rand) => { bands(['#7a2dd6', '#2d1a5c'], 14, 0.45)(ctx, rand); sparks(['#c9a8ff', '#ffffff'], 120, 1.6)(ctx, rand); } },
  blackIce:  { base: '#0e1a20', speckle: ['#16262e', '#081116'], density: 0.45, pass: facets(['#3f6f80', '#5f9fb5'], 30, 22, 0.5) },
  furnace:   { base: '#1c0d08', speckle: ['#2e1610', '#0f0705'], density: 0.6, pass: blobs(['#ff3d00', '#ffab40', '#c62828'], 34, 3, 16, 0.75) },
  hollow:    { base: '#2a2622', speckle: ['#1d1a17', '#3a352f'], density: 0.65, pass: facets(['#141210'], 26, 26, 0.6) }
};

/**
 * Builds (and caches) the texture for a material. Safe to call per frame —
 * the canvas work happens once per material for the whole session.
 */
export const getMaterialTexture = (key: MaterialKey): THREE.CanvasTexture => {
  const cached = cache.get(key);
  if (cached) return cached;

  const recipe = RECIPES[key];
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(hashKey(key));

  ctx.fillStyle = recipe.base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const grains = Math.floor(recipe.density * 2600);
  for (let i = 0; i < grains; i++) {
    ctx.fillStyle = recipe.speckle[Math.floor(rand() * recipe.speckle.length)];
    const r = 0.6 + rand() * 2.2;
    ctx.beginPath();
    ctx.arc(rand() * SIZE, rand() * SIZE, r, 0, Math.PI * 2);
    ctx.fill();
  }

  recipe.pass?.(ctx, rand);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, texture);
  return texture;
};

/** Base colour of a material, for minimap dots, blood tints and UI chips. */
export const materialColor = (key: MaterialKey): string => RECIPES[key].base;
