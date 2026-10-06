// Vite rewrites `base` into HTML and CSS URLs, but not into string literals in
// JS — so every runtime-loaded asset (animation clips, the rig, audio,
// textures) has to be prefixed by hand or it 404s wherever the app isn't
// served from the domain root.
//
// Cloudflare serves this project at the root of its domain, so base is '/'
// and this is currently a no-op. It is kept because the cost is one string
// concat and the alternative is finding all 80-odd call sites again the next
// time the app moves somewhere with a path prefix — which is exactly what
// happened under GitHub Pages, where base was '/Stickman-Action-Game/'.
//
// BASE_URL is '/' in dev and the configured base in a production build, so
// asset('/anims/run.json') is correct in both.
const BASE = import.meta.env.BASE_URL;

export const asset = (path: string): string => `${BASE}${path.replace(/^\/+/, '')}`;
