/**
 * The JSON clips in public/anims must reproduce the FBX sources they were
 * extracted from. This is the test that guards the 67.8 MB -> 6.75 MB change:
 * if the converter ever drifts, the game silently plays wrong animations.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

globalThis.self = globalThis;
globalThis.window = globalThis;

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'assets-src', 'anims');
const OUT = path.join(ROOT, 'public', 'anims');

const THREE = require('three');
THREE.ImageLoader.prototype.load = function (url, onLoad) {
  const image = {};
  if (onLoad) onLoad(image);
  return image;
};
THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
const { FBXLoader } = require(path.join(ROOT, 'node_modules', 'three-stdlib', 'loaders', 'FBXLoader.cjs'));
const loader = new FBXLoader();

const sourceClips = fs.readdirSync(SRC)
  .filter((f) => f.toLowerCase().endsWith('.fbx') && f !== 'stickman_base.fbx')
  .sort();

test('every source clip has a built JSON counterpart', () => {
  assert.ok(sourceClips.length > 0, 'no FBX sources found');
  const missing = sourceClips
    .map((f) => f.replace(/\.fbx$/i, '.json'))
    .filter((f) => !fs.existsSync(path.join(OUT, f)));
  assert.deepStrictEqual(missing, [], 'run npm run build:anims');
});

test('public/anims ships exactly one FBX (the mesh) and nothing else stale', () => {
  const shipped = fs.readdirSync(OUT);
  const fbx = shipped.filter((f) => f.toLowerCase().endsWith('.fbx'));
  assert.deepStrictEqual(fbx, ['stickman_base.fbx'],
    'only the mesh should still be an FBX; the rest are curves');
  const json = shipped.filter((f) => f.endsWith('.json'));
  assert.strictEqual(json.length, sourceClips.length);
});

test('the shipped animation payload stays under 10 MB', () => {
  let bytes = 0;
  for (const f of fs.readdirSync(OUT)) bytes += fs.statSync(path.join(OUT, f)).size;
  const mb = bytes / 1048576;
  assert.ok(mb < 10, 'public/anims is ' + mb.toFixed(1) + ' MB; it was 67.8 MB before extraction');
});

// The real check: load each pair and compare the motion they produce.
for (const file of sourceClips) {
  test('clip matches its source: ' + file, () => {
    const buf = fs.readFileSync(path.join(SRC, file));
    const fbxClip = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '').animations[0];
    const jsonClip = THREE.AnimationClip.parse(
      JSON.parse(fs.readFileSync(path.join(OUT, file.replace(/\.fbx$/i, '.json')), 'utf8'))
    );

    assert.ok(Math.abs(fbxClip.duration - jsonClip.duration) < 1e-4,
      'duration ' + fbxClip.duration + ' vs ' + jsonClip.duration);
    assert.strictEqual(jsonClip.tracks.length, fbxClip.tracks.length, 'track count');

    const byName = (clip) => Object.fromEntries(clip.tracks.map((t) => [t.name, t]));
    const a = byName(fbxClip);
    const b = byName(jsonClip);
    assert.deepStrictEqual(Object.keys(b).sort(), Object.keys(a).sort(), 'track names');

    // Sampled, not keyframe-diffed. A decimation difference makes identical
    // motion look completely unalike when you compare key arrays directly.
    let worst = 0;
    for (const name of Object.keys(a)) {
      const ia = a[name].createInterpolant();
      const ib = b[name].createInterpolant();
      const stride = a[name].getValueSize();
      for (let s = 0; s <= 60; s++) {
        const t = (s / 60) * fbxClip.duration;
        const va = ia.evaluate(t);
        const vb = ib.evaluate(t);
        for (let k = 0; k < stride; k++) worst = Math.max(worst, Math.abs(va[k] - vb[k]));
      }
    }
    // The converter rounds to 5dp, so anything above ~1e-5 means real drift.
    assert.ok(worst < 1e-4, file + ' drifts from its source by ' + worst.toExponential(2));
  });
}

test('the rig itself is still an FBX and still loads', () => {
  const buf = fs.readFileSync(path.join(OUT, 'stickman_base.fbx'));
  const group = loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '');
  let skinned = 0;
  let bones = 0;
  group.traverse((o) => {
    if (o.isSkinnedMesh) skinned++;
    if (o.isBone) bones++;
  });
  assert.ok(skinned > 0, 'stickman_base must carry the SkinnedMesh');
  assert.strictEqual(bones, 57, 'mixamo rig should have 57 bones');
});
