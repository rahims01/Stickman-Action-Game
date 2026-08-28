// Plain singleton audio manager (no React) built on the Web Audio API.
// Browsers block audio until a user gesture, so everything initializes
// lazily on the first pointer/key input; every play() before that is a
// silent no-op. One-shots run through a shared master gain; the ambience
// loop has its own gain and crossfades when the track changes.

export type SfxName =
  | 'punch'
  | 'death'
  | 'slimeHit'
  | 'footGrass'
  | 'footRock'
  | 'footWood'
  | 'ambDay'
  | 'ambNight'
  | 'ambMagma';

const FILES: Record<SfxName, string> = {
  punch: '/sfx/punch.mp3',
  death: '/sfx/death.mp3',
  slimeHit: '/sfx/slime-hit.mp3',
  footGrass: '/sfx/grass-footstep.mp3',
  footRock: '/sfx/rock-footstep.mp3',
  footWood: '/sfx/wood-footstep.mp3',
  ambDay: '/sfx/day-ambience-main.mp3',
  ambNight: '/sfx/night-ambience-main.mp3',
  ambMagma: '/sfx/magma-ambience-arena.mp3'
};

const AMBIENCE_LEVEL = 0.35;

class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private buffers = new Map<SfxName, AudioBuffer>();
  private loading = new Set<SfxName>();
  private masterVolume = 0.7;

  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceName: SfxName | null = null;
  // Remembered so an ambience requested before init starts once audio unlocks.
  private wantedAmbience: SfxName | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.ensureContext();
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock);
      window.addEventListener('keydown', unlock);
    }
  }

  private ensureContext() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.masterVolume;
      this.masterGain.connect(this.ctx.destination);
      if (this.wantedAmbience) this.setAmbience(this.wantedAmbience);
    } catch {
      this.ctx = null;
    }
  }

  private async getBuffer(name: SfxName): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    const cached = this.buffers.get(name);
    if (cached) return cached;
    if (this.loading.has(name)) return null;
    this.loading.add(name);
    try {
      const res = await fetch(FILES[name]);
      const data = await res.arrayBuffer();
      const buffer = await this.ctx.decodeAudioData(data);
      this.buffers.set(name, buffer);
      return buffer;
    } catch {
      return null;
    } finally {
      this.loading.delete(name);
    }
  }

  setMasterVolume(v: number) {
    this.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.value = this.masterVolume;
  }

  // Fire-and-forget one-shot with slight random pitch so repeats don't grate.
  play(name: SfxName, { volume = 1, rateJitter = 0.12 }: { volume?: number; rateJitter?: number } = {}) {
    if (!this.ctx || !this.masterGain || this.masterVolume <= 0) return;
    void this.getBuffer(name).then((buffer) => {
      if (!buffer || !this.ctx || !this.masterGain) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = 1 + (Math.random() * 2 - 1) * rateJitter;
      const gain = this.ctx.createGain();
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start();
    });
  }

  // Switch the background loop (null stops it). Fades the old loop out.
  setAmbience(name: SfxName | null) {
    this.wantedAmbience = name;
    if (!this.ctx || !this.masterGain) return;
    if (this.ambienceName === name) return;
    // Fade out + stop whatever is playing.
    if (this.ambienceSource && this.ambienceGain) {
      const oldSource = this.ambienceSource;
      const oldGain = this.ambienceGain;
      oldGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
      setTimeout(() => {
        try { oldSource.stop(); } catch { /* already stopped */ }
      }, 900);
      this.ambienceSource = null;
      this.ambienceGain = null;
    }
    this.ambienceName = name;
    if (!name) return;
    void this.getBuffer(name).then((buffer) => {
      if (!buffer || !this.ctx || !this.masterGain || this.ambienceName !== name) return;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(AMBIENCE_LEVEL, this.ctx.currentTime + 1.2);
      source.connect(gain);
      gain.connect(this.masterGain);
      source.start();
      this.ambienceSource = source;
      this.ambienceGain = gain;
    });
  }
}

export const audio = new AudioManager();
