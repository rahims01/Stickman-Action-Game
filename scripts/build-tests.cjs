/**
 * Compiles src/ into .test-build/ so the test suite can require the real
 * modules rather than a reimplementation of them.
 *
 * Two details worth knowing:
 *
 *  - tsc is run with --module commonjs, which makes `import.meta` in
 *    assetPath.ts a compile ERROR (TS1343). It still emits, and assetPath is
 *    a Vite concern rather than game logic, so the emitted file is replaced
 *    with a stub afterwards and tsc's exit code is ignored. Type correctness
 *    of the real build is enforced by `npm run build`, not here.
 *  - .test-build gets its own package.json marking it CommonJS, because the
 *    repo root is "type": "module" and the emitted .js would otherwise be
 *    treated as ESM.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '.test-build');

fs.rmSync(OUT, { recursive: true, force: true });

try {
  execSync(
    'npx tsc --outDir .test-build --module commonjs --target es2020 ' +
      '--rootDir src --moduleResolution node --skipLibCheck --esModuleInterop --resolveJsonModule ' +
      '--jsx react-jsx --noEmitOnError false ' +
      'src/world/collision.ts src/world/gameState.ts src/world/arenaRooms.ts ' +
      'src/world/enemyConfig.ts src/world/arenaVersus.ts src/world/pitchBrawl.ts ' +
      'src/world/cupRun.ts src/world/statusEffects.ts src/world/worldObjects.ts ' +
      'src/world/ragdoll.ts src/world/physicsWorld.ts src/world/characterMorph.ts src/world/armyAi.ts ' +
      'src/world/skinWeights.ts',
    { cwd: ROOT, stdio: 'pipe' }
  );
} catch (e) {
  // Expected: TS1343 from assetPath's import.meta under commonjs. Emission
  // still happened; the stub below replaces that one file.
}

fs.writeFileSync(path.join(OUT, 'package.json'), '{"type":"commonjs"}\n');

const assetPath = path.join(OUT, 'world', 'assetPath.js');
fs.mkdirSync(path.dirname(assetPath), { recursive: true });
fs.writeFileSync(
  assetPath,
  '"use strict";\n' +
    'Object.defineProperty(exports, "__esModule", { value: true });\n' +
    'exports.asset = (p) => p;\n'
);

// Fail loudly if anything the suite needs did not emit.
const required = [
  'world/collision.js', 'world/gameState.js', 'world/arenaRooms.js',
  'world/enemyConfig.js', 'world/arenaVersus.js', 'world/pitchBrawl.js',
  'world/cupRun.js', 'world/statusEffects.js', 'world/worldObjects.js',
  'world/ragdoll.js', 'world/physicsWorld.js', 'world/characterMorph.js', 'world/armyAi.js'
];
const missing = required.filter((f) => !fs.existsSync(path.join(OUT, f)));
if (missing.length) {
  console.error('test build incomplete, missing:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log('test build ready: ' + required.length + ' modules in .test-build/');
