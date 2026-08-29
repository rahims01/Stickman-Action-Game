// Vite rewrites `base` into HTML and CSS URLs, but not into string literals in
// JS — so every runtime-loaded asset (FBX clips, audio, textures) has to be
// prefixed by hand or it 404s wherever the app isn't served from the domain
// root. GitHub Pages serves this project under /Stickman-Action-Game/.
//
// BASE_URL is '/' in dev and the configured base in a production build, so
// asset('/anims/run.fbx') is correct in both.
const BASE = import.meta.env.BASE_URL;

export const asset = (path: string): string => `${BASE}${path.replace(/^\/+/, '')}`;
