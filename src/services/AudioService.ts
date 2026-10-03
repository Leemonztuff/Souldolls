import { GlobalEventBus } from '../core/EventBus';

export type SoundEffectType =
  | 'select'
  | 'confirm'
  | 'cancel'
  | 'start'
  | 'save'
  | 'levelUp'
  | 'level_up'
  | 'step'
  | 'bump'
  | 'faint'
  | 'catch'
  | 'attack_normal'
  | 'hit_normal'
  | 'hit_super'
  | 'status'
  | 'exp_gain'
  | 'wood'       // Brand wooden clack / knock
  | 'porcelain'  // Brand high doll chime / ring
  | 'crystal'    // Brand crystal resonance shimmer / ping
  | 'ki_burst'   // Brand ki burst whoosh / explosion
  | 'soul_seal'; // Brand soul capture bottle sound

export class AudioService {
  private static instance: AudioService;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;

  private isUnlocked = false;
  private masterVolume = 0.8;
  private sfxVolume = 0.9;
  private bgmVolume = 0.4;

  private bgmOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  private bgmInterval: number | null = null;
  private currentBgmTrack: string | null = null;

  private constructor() {
    GlobalEventBus.on('audio:play-sfx', ({ sound, pitch }) => {
      this.playSfx(sound as SoundEffectType, pitch);
    });

    // Auto-unlock on first user gesture
    const unlock = () => {
      this.initAudioContext();
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) {
      AudioService.instance = new AudioService();
    }
    return AudioService.instance;
  }

  public initAudioContext(): void {
    if (this.isUnlocked && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.masterGain);

      this.isUnlocked = true;
    } catch (e) {
      console.warn('[AudioService] Web Audio not available or permitted yet.', e);
    }
  }

  /**
   * Play procedural sound effects
   */
  public playSfx(type: SoundEffectType, pitchMultiplier = 1.0): void {
    this.initAudioContext();
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    switch (type) {
      case 'select': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(520 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(780 * pitchMultiplier, t + 0.05);

        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.07);
        break;
      }

      case 'confirm': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(587.33 * pitchMultiplier, t); // D5
        osc.frequency.setValueAtTime(880 * pitchMultiplier, t + 0.08); // A5

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.setValueAtTime(0.25, t + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.26);
        break;
      }

      case 'cancel': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(160 * pitchMultiplier, t + 0.12);

        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.13);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.14);
        break;
      }

      case 'start': {
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + idx * 0.07);

          gain.gain.setValueAtTime(0, t);
          gain.gain.setValueAtTime(0.18, t + idx * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.2);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + idx * 0.07);
          osc.stop(t + idx * 0.07 + 0.22);
        });
        break;
      }

      case 'save': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + idx * 0.05);

          gain.gain.setValueAtTime(0.15, t + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.3);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + idx * 0.05);
          osc.stop(t + idx * 0.05 + 0.32);
        });
        break;
      }

      case 'levelUp': {
        const notes = [392, 523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + idx * 0.08);

          gain.gain.setValueAtTime(0.2, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.35);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.37);
        });
        break;
      }

      case 'step': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.04);

        gain.gain.setValueAtTime(0.06, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.05);
        break;
      }

      case 'wood': {
        // Quick mechanical wooden clack / knock
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + 0.05);

        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.06);
        break;
      }

      case 'porcelain': {
        // Ceramic / porcelain chime ping
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200 * pitchMultiplier, t);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1850 * pitchMultiplier, t);

        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + 0.32);
        osc2.stop(t + 0.32);
        break;
      }

      case 'crystal': {
        // Glowing magic crystal ring
        const notes = [880, 1109, 1318]; // A5, C#6, E6
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + idx * 0.03);

          gain.gain.setValueAtTime(0.12, t + idx * 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.03 + 0.5);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + idx * 0.03);
          osc.stop(t + idx * 0.03 + 0.52);
        });
        break;
      }

      case 'ki_burst': {
        // Whoosh of raw ki energy
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(80 * pitchMultiplier, t);
        osc.frequency.exponentialRampToValueAtTime(1200 * pitchMultiplier, t + 0.25);

        gain.gain.setValueAtTime(0.22, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.3);
        break;
      }

      case 'soul_seal': {
        // Chime sweep for Soul Bottle capture success
        const notes = [587, 880, 1760];
        notes.forEach((freq, idx) => {
          if (!this.ctx || !this.sfxGain) return;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq * pitchMultiplier, t + idx * 0.08);
          osc.frequency.exponentialRampToValueAtTime(freq * 1.5 * pitchMultiplier, t + idx * 0.08 + 0.2);

          gain.gain.setValueAtTime(0.18, t + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.22);

          osc.connect(gain);
          gain.connect(this.sfxGain);
          osc.start(t + idx * 0.08);
          osc.stop(t + idx * 0.08 + 0.25);
        });
        break;
      }

      default:
        break;
    }
  }

  /**
   * Play simple procedural background soundtrack loops
   */
  public playTitleBgm(): void {
    if (this.currentBgmTrack === 'title') return;
    this.stopBgm();
    this.initAudioContext();
    if (!this.ctx || !this.bgmGain) return;

    this.currentBgmTrack = 'title';

    // Nostalgic gentle arpeggio progression: Cmaj7 -> Am7 -> Fmaj7 -> G7
    const chords = [
      [261.63, 329.63, 392.0, 493.88], // C E G B
      [220.0, 261.63, 329.63, 392.0],  // A C E G
      [174.61, 220.0, 261.63, 329.63], // F A C E
      [196.0, 246.94, 293.66, 349.23], // G B D F
    ];

    let chordIdx = 0;
    let noteIdx = 0;

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || this.currentBgmTrack !== 'title') return;

      const chord = chords[chordIdx];
      const freq = chord[noteIdx % chord.length];
      const t = this.ctx.currentTime;

      // Synth note
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + 0.3);

      noteIdx++;
      if (noteIdx >= 8) {
        noteIdx = 0;
        chordIdx = (chordIdx + 1) % chords.length;
      }
    };

    this.bgmInterval = window.setInterval(playStep, 180);
  }

  public playZoneBgm(zoneId: 'aldea' | 'ruta' | 'cueva'): void {
    if (this.currentBgmTrack === zoneId) return;
    this.stopBgm();
    this.initAudioContext();
    if (!this.ctx || !this.bgmGain) return;

    this.currentBgmTrack = zoneId;

    // Different musical scales based on the zone archetype
    // 'aldea': Warm major pentatonic. 'ruta': Lively diatonic major. 'cueva': Eerie mysterious harmonic minor.
    const chordsMap = {
      aldea: [
        [261.63, 329.63, 392.00, 440.00], // C E G A
        [293.66, 349.23, 440.00, 523.25], // D F A C
      ],
      ruta: [
        [261.63, 329.63, 392.00, 523.25], // C4 E4 G4 C5
        [349.23, 440.00, 523.25, 698.46], // F4 A4 C5 F5
        [392.00, 493.88, 587.33, 783.99], // G4 B4 D5 G5
      ],
      cueva: [
        [220.00, 261.63, 311.13, 392.00], // A C D# G (diminished chord)
        [196.00, 233.08, 293.66, 349.23], // G A# D F
      ],
    };

    const chords = chordsMap[zoneId] || chordsMap['aldea'];
    const intervalMap = { aldea: 240, ruta: 180, cueva: 450 };
    const interval = intervalMap[zoneId] || 240;

    let chordIdx = 0;
    let noteIdx = 0;

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || this.currentBgmTrack !== zoneId) return;

      const chord = chords[chordIdx];
      const freq = chord[noteIdx % chord.length];
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Eerie sound for caves (sine/saw hybrid), warm for village (triangle)
      osc.type = zoneId === 'cueva' ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      // Low pass filter effect for cave to make it sound muffled
      if (zoneId === 'cueva') {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, t);
        osc.connect(filter);
        filter.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.gain.setValueAtTime(zoneId === 'cueva' ? 0.05 : 0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + (zoneId === 'cueva' ? 0.6 : 0.3));

      gain.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + (zoneId === 'cueva' ? 0.7 : 0.35));

      noteIdx++;
      if (noteIdx >= 8) {
        noteIdx = 0;
        chordIdx = (chordIdx + 1) % chords.length;
      }
    };

    this.bgmInterval = window.setInterval(playStep, interval);
  }

  public playBattleBgm(): void {
    if (this.currentBgmTrack === 'battle') return;
    this.stopBgm();
    this.initAudioContext();
    if (!this.ctx || !this.bgmGain) return;

    this.currentBgmTrack = 'battle';

    // Fast dramatic battle track (harmonic minor rising)
    const scale = [220.00, 233.08, 277.18, 293.66, 329.63, 349.23, 415.30, 440.00]; // A harmonic minor
    let idx = 0;

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || this.currentBgmTrack !== 'battle') return;

      const freq = scale[idx % scale.length];
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + 0.18);

      idx = (idx + 1) % scale.length;
    };

    this.bgmInterval = window.setInterval(playStep, 130); // Fast 130ms tempo
  }

  public playVictoryTheme(): void {
    if (this.currentBgmTrack === 'victory') return;
    this.stopBgm();
    this.initAudioContext();
    if (!this.ctx || !this.bgmGain) return;

    this.currentBgmTrack = 'victory';

    // Bright triumphant major scale run
    const scale = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50];
    let idx = 0;

    const playStep = () => {
      if (!this.ctx || !this.bgmGain || this.currentBgmTrack !== 'victory' || idx >= scale.length) {
        if (idx >= scale.length) this.stopBgm();
        return;
      }

      const freq = scale[idx];
      const t = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      osc.start(t);
      osc.stop(t + 0.3);

      idx++;
    };

    this.bgmInterval = window.setInterval(playStep, 100);
  }

  public stopBgm(): void {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
    this.currentBgmTrack = null;
  }

  public setMasterVolume(vol: number): void {
    this.masterVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  public setSfxVolume(vol: number): void {
    this.sfxVolume = Math.max(0, Math.min(1, vol));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
    }
  }

  public setBgmVolume(vol: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, vol));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
  }
}

export const GlobalAudioService = AudioService.getInstance();
