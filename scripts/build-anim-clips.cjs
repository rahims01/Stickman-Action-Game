/**
 * Extracts animation curves from the source FBX files into JSON clips.
 *
 * Why: 15 of the FBX exports are mesh-bearing - each carries a redundant copy
 * of the same rig and texture (~3.6 MB) purely to deliver ~30 KB of curves.
 * public/anims was 67.8 MB, of which ~52 MB was the same mesh shipped fifteen
 * times to every player. The mesh is needed exactly once, from
 * stickman_base.fbx; everything else only ever has .animations[0] read off it.
 *
 * Sources live in assets-src/anims (not served). Output goes to public/anims.
 * Root motion is deliberately NOT stripped here - the actors still call
 * stripRootMotion at runtime, so behaviour is identical to the FBX path.
 *
 * Run: node scripts/build-anim-clips.cjs
 */
const fs = require('fs');
const path = require('path');

// FBXLoader reaches for a few browser globals on the way in. It never needs
// them for animation-only data, so the minimum stubs are enough.
globalThis.self = globalThis;
globalThis.window = globalThis;

const THREE = require('three');
THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const image = {};
  if (onLoad) onLoad(image);
  return image;
};
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const { FBXLoader } = require(path.join(__dirname, '..', 'node_modules', 'three-stdlib', 'loaders', 'FBXLoader.cjs'));

const SRC = path.join(__dirname, '..', 'assets-src', 'anims');
const OUT = path.join(__dirname, '..', 'public', 'anims');
/** The one file that must stay an FBX: it is where the mesh comes from. */
const KEEP_AS_FBX = 'stickman_base.fbx';

/**
 * Trim float noise from VALUES only. 5dp on a unit quaternion, or on a hip
 * position in pre-scale Mixamo units, is far below visible.
 *
 * TIMES are left alone deliberately. Rounding them to 5dp shifts a keyframe
 * by up to 3 microseconds, and on a fast track - falling-to-roll covers 269
 * units in 1.467s - that shifted grid moves the INTERPOLATED value by ~1e-3,
 * a hundred times the error that rounding the values themselves introduces.
 */
const roundValue = (n) => Math.round(n * 1e5) / 1e5;

const loader = new FBXLoader();

if (!fs.existsSync(SRC)) {
  console.error('No source directory at ' + SRC);
  console.error('Expected the FBX sources to live outside public/ so they are not served.');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });

const files = fs.readdirSync(SRC).filter((f) => f.toLowerCase().endsWith('.fbx') && f !== KEEP_AS_FBX).sort();
let srcBytes = 0;
let outBytes = 0;
const rows = [];

for (const file of files) {
  const full = path.join(SRC, file);
  const buf = fs.readFileSync(full);
  srcBytes += buf.length;

  const group = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  const clip = group.animations && group.animations[0];
  if (!clip) {
    console.error(file + ': no animation track found');
    process.exitCode = 1;
    continue;
  }

  const json = THREE.AnimationClip.toJSON(clip);
  for (const track of json.tracks) {
    track.times = Array.from(track.times);
    track.values = Array.from(track.values, roundValue);
  }

  const outName = file.replace(/\.fbx$/i, '.json');
  const text = JSON.stringify(json);
  fs.writeFileSync(path.join(OUT, outName), text);
  outBytes += Buffer.byteLength(text);
  rows.push([file, buf.length / 1024, Buffer.byteLength(text) / 1024, clip.duration, clip.tracks.length]);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('clip', 30) + 'fbx KB'.padStart(9) + 'json KB'.padStart(9) + 'dur'.padStart(8) + 'tracks'.padStart(8));
for (const [file, fkb, jkb, dur, tracks] of rows) {
  console.log(pad(file, 30) + fkb.toFixed(0).padStart(9) + jkb.toFixed(0).padStart(9) + dur.toFixed(3).padStart(8) + String(tracks).padStart(8));
}
console.log('');
console.log(rows.length + ' clips   ' + (srcBytes / 1048576).toFixed(1) + ' MB of FBX -> ' + (outBytes / 1048576).toFixed(2) + ' MB of JSON');
