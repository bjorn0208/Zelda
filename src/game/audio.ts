import {
  AWAKENING_LINE,
  BAZAAR_LINE,
  BLACKSMITH_LINE,
  FATHER_INTRO_LINE,
  GUARD_LINE,
  MERCHANT_THEO_LINE,
  SWORD_HINT_LINE,
  SWORD_PULLED_LINE,
  TAILOR_LINE,
} from './constants';
import type { DialogState } from './types';

export type TrackName =
  | ''
  | 'prologue'
  | 'awakening'
  | 'ezlo'
  | 'postSword'
  | 'cyclops'
  | 'storyIntro'
  | 'menu'
  | 'field'
  | 'calm'
  | 'cave'
  | 'boss'
  | 'story'
  | 'mini';

interface TrackDef {
  bpm: number;
  c: Array<[number, number]>;
  l: number[];
  w: OscillatorType;
  bp: string;
  dm: number;
  arp?: number;
  pad?: number;
}

/**
 * Tracks backed by a real audio file instead of the synth. When a track is
 * listed here the file wins and the synth stays silent for it; anything not
 * listed keeps the chiptune generator, so missing/failing files degrade to
 * the original music rather than silence.
 */
const TRACK_FILES: Partial<Record<Exclude<TrackName, ''>, string>> = {
  // Toca desde o logo da Dominic Games até a escolha do nome.
  prologue: '/music/prologue.mp3',
  // "Hyrule Castle": toca durante a chuva, ao acordar, até pegar a espada.
  awakening: '/music/hyrule_castle.mp3',
  ezlo: '/music/ezlo.mp3',
  // "In the Field": trilha da fase após a espada ser retirada.
  postSword: '/music/in_the_field.mp3',
  // "Element Appears": trilha da introdução da história (páginas narradas,
  // interlúdio do Ciclope e frase final).
  storyIntro: '/music/story_intro.mp3',
  // Faixa do Ciclope, usada nas cavernas.
  cyclops: '/music/cyclops.mp3',
  cave: '/music/cyclops.mp3',
};

/** Volume da música (1 = normal, 0.5 = personagem falando). */
const MUSIC_VOLUME = 0.55;

/**
 * Falas de diálogo com gravação própria (SpeechGen). O texto completo é
 * comparado antes da paginação, então a dublagem toca uma vez mesmo quando a
 * fala ocupa várias páginas. As demais falas não têm voz: o jogador lê o texto.
 */
const VOICE_LINES: Array<{ match: string; src: string }> = [
  { match: FATHER_INTRO_LINE, src: '/voice/father.mp3' },
  { match: SWORD_HINT_LINE, src: '/voice/sword_hint.mp3' },
  { match: SWORD_PULLED_LINE, src: '/voice/sword_pulled.mp3' },
  { match: AWAKENING_LINE, src: '/voice/awakening_line.mp3' },
  { match: MERCHANT_THEO_LINE, src: '/voice/theo_line.mp3' },
  { match: BLACKSMITH_LINE, src: '/voice/blacksmith_line.mp3' },
  { match: TAILOR_LINE, src: '/voice/tailor_line.mp3' },
  { match: BAZAAR_LINE, src: '/voice/bazaar_line.mp3' },
  { match: GUARD_LINE, src: '/voice/guard_line.mp3' },
];

/** Identifica diálogos que possuem gravação própria. */
export function isRecordedDialog(d: DialogState): boolean {
  const text = cleanSpeechText(d.full ?? d.p[d.i]?.join(' ') ?? '');
  return VOICE_LINES.some((v) => text.includes(v.match));
}

/**
 * Narração da história: cinco frases em um único MP3. Os tempos são os
 * silêncios entre frases detectados no áudio do share 25961153.
 */
const STORY_VOICE = {
  src: '/voice/story.mp3',
  starts: [0, 5.457, 10.954, 17.081, 22.486] as const,
  end: 27.376,
};

function cleanSpeechText(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

const TRACKS: Partial<Record<Exclude<TrackName, ''>, TrackDef>> = {
  menu: {
    bpm: 108,
    c: [
      [33, 1],
      [29, 0],
      [36, 0],
      [31, 0],
    ],
    l: [
      69, 0, 72, 0, 76, 0, 74, 72, 72, 0, 69, 0, 65, 0, 69, 72, 76, 0, 79, 0, 84, 0, 79, 76, 74, 0,
      71, 0, 67, 0, 71, 74,
    ],
    w: 'square',
    bp: 'x...x...x...x.x.',
    dm: 1,
    arp: 1,
  },
  field: {
    bpm: 138,
    c: [
      [36, 0],
      [31, 0],
      [33, 1],
      [29, 0],
    ],
    l: [
      76, 0, 79, 76, 84, 0, 79, 0, 74, 0, 79, 74, 83, 0, 79, 0, 72, 0, 76, 72, 81, 0, 76, 0, 77, 0,
      81, 77, 84, 81, 77, 0,
    ],
    w: 'square',
    bp: 'x.x.x.o.x.x.x.o.',
    dm: 1,
    arp: 1,
  },
  calm: {
    bpm: 84,
    c: [
      [33, 1],
      [29, 0],
      [36, 0],
      [31, 0],
    ],
    l: [
      76, 0, 0, 79, 0, 0, 76, 0, 77, 0, 0, 81, 0, 0, 77, 0, 72, 0, 0, 76, 0, 0, 72, 0, 74, 0, 0, 71,
      0, 0, 67, 0,
    ],
    w: 'sine',
    bp: 'x.......x.......',
    dm: 3,
    arp: 1,
  },
  cave: {
    bpm: 150,
    c: [
      [28, 1],
      [29, 2],
      [28, 1],
      [27, 2],
    ],
    l: [
      76, 0, 82, 0, 76, 0, 82, 0, 77, 0, 83, 0, 77, 0, 83, 0, 76, 0, 82, 76, 0, 82, 76, 0, 76, 77,
      78, 79, 80, 81, 82, 83,
    ],
    w: 'sawtooth',
    bp: 'xoxoxoxoxoxoxoxo',
    dm: 2,
    pad: 1,
  },
  boss: {
    bpm: 172,
    c: [
      [28, 1],
      [26, 1],
      [24, 0],
      [31, 2],
    ],
    l: [
      76, 0, 76, 79, 0, 83, 0, 79, 74, 0, 74, 77, 0, 81, 0, 77, 72, 0, 72, 76, 0, 79, 0, 76, 79, 82,
      83, 0, 83, 82, 79, 76,
    ],
    w: 'sawtooth',
    bp: 'xoxoxoxoxoxoxoxo',
    dm: 2,
    pad: 1,
  },
  story: {
    bpm: 72,
    c: [
      [26, 1],
      [34, 0],
      [29, 0],
      [33, 0],
    ],
    l: [
      74, 0, 0, 0, 77, 0, 0, 0, 74, 0, 0, 0, 70, 0, 0, 0, 72, 0, 0, 0, 77, 0, 0, 0, 73, 0, 0, 0, 76,
      0, 0, 0,
    ],
    w: 'triangle',
    bp: 'x.......x.......',
    dm: 0,
    arp: 1,
    pad: 1,
  },
  mini: {
    bpm: 170,
    c: [
      [36, 0],
      [41, 0],
      [31, 0],
      [36, 0],
    ],
    l: [
      76, 79, 84, 79, 76, 79, 84, 79, 77, 81, 84, 81, 77, 81, 84, 81, 74, 77, 83, 77, 74, 77, 83,
      77, 72, 76, 79, 76, 72, 76, 79, 84,
    ],
    w: 'square',
    bp: 'x.x.x.x.x.x.x.x.',
    dm: 1,
  },
};

export class RetroAudio {
  private ac: AudioContext | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private rainNoiseBuf: AudioBuffer | null = null;
  private rainGain: GainNode | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private currentRainLevel = 0;

  public mute = false;
  private trk: TrackName = '';
  private ms = 0;
  private ma = 0;
  /** Música abaixa para metade enquanto há um diálogo aberto. */
  private musicDucked = false;
  private musicVolume = 1;

  // --- real audio files (see TRACK_FILES) -----------------------------------
  private fileEl: HTMLAudioElement | null = null;
  private fileSrc = '';
  private fileTrk: TrackName = '';
  // Browsers refuse audible autoplay until a user gesture. We still start the
  // track immediately (muted) so it is already playing when the game opens;
  // the first gesture anywhere unmutes it without restarting the song.
  private fileWaitingGesture = false;

  // --- dialogue voices ------------------------------------------------------
  private voiceEl: HTMLAudioElement | null = null;
  private voiceWaitingGesture = false;
  /** invalida falas agendadas quando o diálogo avança ou é fechado */
  private voiceToken = 0;

  private storyEl: HTMLAudioElement | null = null;
  private storyWaitingGesture = false;
  private storyToken = 0;

  /** Best-effort play of a streamed track; never throws into the game loop. */
  private playTrackFile(wanted: TrackName, src: string): void {
    if (typeof document === 'undefined' || typeof Audio === 'undefined') return;
    try {
      if (!this.fileEl || this.fileSrc !== src) {
        if (this.fileEl) {
          // Different track: swap the source in place, keeping one element alive.
          this.fileEl.pause();
          this.fileEl.src = src;
          this.fileEl.load();
        } else {
          this.fileEl = new Audio(src);
          this.fileEl.loop = true;
          this.fileEl.preload = 'auto';
          this.fileEl.volume = MUSIC_VOLUME * this.musicVolume;
        }
        this.fileSrc = src;
        this.fileTrk = wanted;
        this.fileWaitingGesture = false;
      }
      const el = this.fileEl;
      if (!el) return;
      // Mute on open (autoplay policy) or when the player hit the mute button.
      el.muted = this.mute || this.fileWaitingGesture;
      if (el.paused) {
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Audible autoplay was refused: fall back to muted playback so the
            // track still starts now. unlock() flips it back on first gesture.
            this.fileWaitingGesture = true;
            el.muted = true;
            const mutedPlay = el.play();
            if (mutedPlay && typeof mutedPlay.catch === 'function') mutedPlay.catch(() => undefined);
          });
        }
      }
    } catch {
      this.fileWaitingGesture = true;
    }
  }

  private stopTrackFile(): void {
    if (!this.fileEl) return;
    try {
      if (!this.fileEl.paused) this.fileEl.pause();
    } catch {
      // Ignore teardown errors
    }
  }

  /** Abaixa a música pela metade quando um personagem está falando. */
  public setMusicDucked(ducked: boolean): void {
    if (this.musicDucked === ducked) return;
    this.musicDucked = ducked;
    this.musicVolume = ducked ? 0.5 : 1;
    if (this.fileEl) this.fileEl.volume = MUSIC_VOLUME * this.musicVolume;
  }

  /** One-shot item/chest jingle, independent from the background track. */
  public playItemGet(): void {
    if (typeof document === 'undefined' || typeof Audio === 'undefined') return;
    try {
      const el = new Audio('/music/item_get.mp3');
      el.volume = 0.7;
      // Muted autoplay is allowed on open; unlock() will not touch this node.
      if (this.mute) el.muted = true;
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // If autoplay is blocked, retry once muted so it still sounds after
          // the first gesture unmutes the context.
          el.muted = true;
          const retry = el.play();
          if (retry && typeof retry.catch === 'function') retry.catch(() => undefined);
        });
      }
      el.addEventListener('ended', () => {
        el.src = '';
      });
    } catch {
      // Never let a missing SFX break gameplay
    }
  }

  // --- dialogue voices ------------------------------------------------------

  /** Corta a fala gravada e a narração sem afetar a música. */
  public stopVoice(): void {
    this.voiceToken++;
    this.voiceWaitingGesture = false;
    this.stopStoryVoice();
    if (this.voiceEl) {
      try {
        this.voiceEl.pause();
        this.voiceEl.src = '';
      } catch {
        // Ignore teardown errors
      }
      this.voiceEl = null;
    }
  }

  private playVoiceFile(src: string, token: number, onEnd?: () => void): void {
    if (typeof document === 'undefined' || typeof Audio === 'undefined') {
      onEnd?.();
      return;
    }
    try {
      const el = new Audio(src);
      el.volume = 0.95;
      el.preload = 'auto';
      el.muted = false;
      this.voiceEl = el;
      this.voiceWaitingGesture = false;
      el.addEventListener('ended', () => {
        if (token !== this.voiceToken) return;
        if (this.voiceEl === el) this.voiceEl = null;
        onEnd?.();
      });
      const p = el.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          if (token !== this.voiceToken) return;
          // Autoplay bloqueado: deixa mudo agora e libera no primeiro gesto.
          this.voiceWaitingGesture = true;
          el.muted = true;
          const retry = el.play();
          if (retry && typeof retry.catch === 'function') retry.catch(() => undefined);
        });
      }
    } catch {
      this.voiceEl = null;
    }
  }

  /** Toca a página atual do diálogo apenas quando ela tem gravação própria. */
  public playDialogVoice(d: DialogState, onEnd?: () => void): void {
    this.stopVoice();
    if (this.mute) {
      // Sem áudio, a fala gravada não deve travar o jogo.
      if (isRecordedDialog(d)) onEnd?.();
      return;
    }
    if (!d.p[d.i]) return;
    const token = this.voiceToken;
    const full = cleanSpeechText(d.full ?? d.p[d.i].join(' '));
    const recorded = VOICE_LINES.find((v) => full.includes(v.match));
    // A gravação cobre a fala inteira: toca uma vez e não troca de voz nas
    // páginas seguintes (que são só a continuação visual do mesmo texto).
    if (recorded && d.i === 0) this.playVoiceFile(recorded.src, token, onEnd);
  }

  /** Corta a narração da história sem mexer na música nem nas falas. */
  public stopStoryVoice(): void {
    this.storyToken++;
    this.storyWaitingGesture = false;
    if (this.storyEl) {
      try {
        this.storyEl.pause();
        this.storyEl.src = '';
      } catch {
        // Ignore teardown errors
      }
      this.storyEl = null;
    }
  }

  /**
   * Toca apenas o trecho da página atual da narração. Quando o trecho termina
   * (ou o jogador pula), o motor avança a página seguinte da história.
   */
  public playStoryVoice(page: number, onSegmentEnd?: () => void): void {
    this.stopStoryVoice();
    if (this.mute || page < 0 || page >= STORY_VOICE.starts.length) return;
    if (typeof document === 'undefined' || typeof Audio === 'undefined') return;
    const token = this.storyToken;
    const start = STORY_VOICE.starts[page];
    const end = page + 1 < STORY_VOICE.starts.length ? STORY_VOICE.starts[page + 1] : STORY_VOICE.end;
    try {
      const el = new Audio(STORY_VOICE.src);
      el.volume = 0.95;
      el.preload = 'auto';
      el.muted = false;
      this.storyEl = el;
      this.storyWaitingGesture = false;
      let started = false;
      let finished = false;
      const done = () => {
        if (finished || token !== this.storyToken) return;
        finished = true;
        this.stopStoryVoice();
        onSegmentEnd?.();
      };
      // Nunca chama play() antes do seek: o navegador começa a tocar o MP3 do
      // zero e repetia a primeira palavra de cada trecho ao aplicar currentTime.
      const begin = () => {
        if (started || finished || token !== this.storyToken) return;
        started = true;
        try {
          el.currentTime = start;
        } catch {
          // O navegador pode recusar o seek em metadados ainda parciais.
        }
        const p = el.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            if (token !== this.storyToken) return;
            this.storyWaitingGesture = true;
            el.muted = true;
            const retry = el.play();
            if (retry && typeof retry.catch === 'function') retry.catch(() => undefined);
          });
        }
      };
      el.addEventListener('timeupdate', () => {
        if (started && el.currentTime >= end) done();
      });
      el.addEventListener('ended', () => {
        if (started) done();
      });
      el.addEventListener('error', done);
      if (el.readyState >= 1) begin();
      else el.addEventListener('loadedmetadata', begin, { once: true });
    } catch {
      this.storyEl = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ac) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ac = new Ctx();
    }
    if (this.ac.state === 'suspended') {
      void this.ac.resume();
    }
    return this.ac;
  }

  public unlock(): void {
    try {
      this.ensureContext();
    } catch {
      // Ignore audio lock failures prior to user interaction
    }
    // First gesture: drop the muted-autoplay fallback and unmute in place.
    if (this.fileWaitingGesture) {
      this.fileWaitingGesture = false;
      if (this.fileEl) {
        this.fileEl.muted = this.mute;
        if (this.fileEl.paused) {
          const p = this.fileEl.play();
          if (p && typeof p.catch === 'function') p.catch(() => undefined);
        }
      }
    }
    if (this.voiceWaitingGesture && this.voiceEl) {
      this.voiceWaitingGesture = false;
      this.voiceEl.muted = this.mute;
      if (this.voiceEl.paused) {
        const p = this.voiceEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    }
    if (this.storyWaitingGesture && this.storyEl) {
      this.storyWaitingGesture = false;
      this.storyEl.muted = this.mute;
      if (this.storyEl.paused) {
        const p = this.storyEl.play();
        if (p && typeof p.catch === 'function') p.catch(() => undefined);
      }
    }
  }

  public toggleMute(): boolean {
    this.mute = !this.mute;
    if (this.mute) this.stopVoice();
    if (this.fileEl) this.fileEl.muted = this.mute || this.fileWaitingGesture;
    if (this.voiceEl) this.voiceEl.muted = this.mute || this.voiceWaitingGesture;
    if (this.storyEl) this.storyEl.muted = this.mute || this.storyWaitingGesture;
    this.updateRainGain(this.mute ? 0 : this.currentRainLevel);
    return this.mute;
  }

  public bp(freq = 440, dur = 0.07, type: OscillatorType = 'square'): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac) return;
      const o = ac.createOscillator();
      const v = ac.createGain();
      o.type = type;
      o.frequency.value = freq;
      v.gain.value = 0.035;
      o.connect(v);
      v.connect(ac.destination);
      o.start();
      o.stop(ac.currentTime + dur);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public playTypeBlip(idx = 0): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const o = ac.createOscillator();
      const v = ac.createGain();
      const now = ac.currentTime;
      o.type = 'triangle';
      o.frequency.value = 540 + (idx % 3) * 45;
      v.gain.setValueAtTime(0.014, now);
      v.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);
      o.connect(v);
      v.connect(ac.destination);
      o.start(now);
      o.stop(now + 0.028);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public playSwordFanfare(): void {
    if (this.mute) return;
    const notes = [64, 68, 71, 76, 80, 83, 88];
    notes.forEach((n, idx) => {
      setTimeout(() => {
        this.nt(n, idx === notes.length - 1 ? 0.55 : 0.14, 'square', 0.045);
        this.nt(n - 12, idx === notes.length - 1 ? 0.55 : 0.14, 'triangle', 0.06);
      }, idx * 75);
    });
  }

  public playSwordSwing(tier = 'lendaria'): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const sr = ac.sampleRate;
      const dur = 0.13;
      const len = Math.floor(sr * dur);
      const buf = ac.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      const startFreq = tier === 'solar' ? 1650 : tier === 'runica' ? 1450 : 1200;
      bp.frequency.setValueAtTime(startFreq, now);
      bp.frequency.exponentialRampToValueAtTime(360, now + dur);
      bp.Q.value = 1.6;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.095, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, now + dur);

      src.connect(bp);
      bp.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
      src.stop(now + dur);

      // Subtle crisp steel shimmer
      const osc = ac.createOscillator();
      const og = ac.createGain();
      osc.type = 'triangle';
      const pitch = tier === 'solar' ? 740 : tier === 'runica' ? 680 : tier === 'aco' ? 600 : 540;
      osc.frequency.setValueAtTime(pitch, now);
      osc.frequency.exponentialRampToValueAtTime(260, now + 0.08);
      og.gain.setValueAtTime(0.032, now);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
      osc.connect(og);
      og.connect(ac.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // Ignore Web Audio errors
    }
  }

  /** Curto "shing" de espada estilo The Legend of Zelda: The Minish Cap. */
  public playMinishSwing(): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;

      const o1 = ac.createOscillator();
      const g1 = ac.createGain();
      o1.type = 'square';
      o1.frequency.setValueAtTime(1560, now);
      o1.frequency.exponentialRampToValueAtTime(520, now + 0.085);
      g1.gain.setValueAtTime(0.042, now);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      o1.connect(g1);
      g1.connect(ac.destination);
      o1.start(now);
      o1.stop(now + 0.1);

      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(2100, now);
      o2.frequency.exponentialRampToValueAtTime(880, now + 0.06);
      g2.gain.setValueAtTime(0.02, now);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
      o2.connect(g2);
      g2.connect(ac.destination);
      o2.start(now);
      o2.stop(now + 0.075);
    } catch {
      // Ignore Web Audio errors
    }
  }

  /** Estouro curto e abafado quando um monstro é derrotado. */
  public playEnemyExplosion(): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const sr = ac.sampleRate;
      const dur = 0.24;
      const len = Math.floor(sr * dur);
      const buf = ac.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.12 * white) / 1.12;
        data[i] = last * (1 - i / len) * 1.6;
      }
      const src = ac.createBufferSource();
      src.buffer = buf;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900, now);
      lp.frequency.exponentialRampToValueAtTime(120, now + dur);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(lp);
      lp.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
      src.stop(now + dur);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public playSwordHit(): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const o1 = ac.createOscillator();
      const g1 = ac.createGain();
      o1.type = 'sawtooth';
      o1.frequency.setValueAtTime(320, now);
      o1.frequency.exponentialRampToValueAtTime(95, now + 0.09);
      g1.gain.setValueAtTime(0.07, now);
      g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
      o1.connect(g1);
      g1.connect(ac.destination);
      o1.start(now);
      o1.stop(now + 0.1);

      const o2 = ac.createOscillator();
      const g2 = ac.createGain();
      o2.type = 'square';
      o2.frequency.setValueAtTime(920, now);
      o2.frequency.exponentialRampToValueAtTime(420, now + 0.05);
      g2.gain.setValueAtTime(0.035, now);
      g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      o2.connect(g2);
      g2.connect(ac.destination);
      o2.start(now);
      o2.stop(now + 0.06);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public playClang(): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(1280, now);
      o.frequency.exponentialRampToValueAtTime(1640, now + 0.03);
      o.frequency.exponentialRampToValueAtTime(980, now + 0.1);
      g.gain.setValueAtTime(0.04, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
      o.connect(g);
      g.connect(ac.destination);
      o.start(now);
      o.stop(now + 0.12);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public playThunder(intensity = 1): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      const sr = ac.sampleRate;
      const len = Math.floor(sr * 1.9);
      const buf = ac.createBuffer(1, len, sr);
      const ch = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        // Brown-ish rumble mixed with sharp initial crack
        last = (last + 0.05 * white) / 1.05;
        const crack = i < sr * 0.18 ? white * (1 - i / (sr * 0.18)) * 0.7 : 0;
        const rumble = last * 3.8 + white * 0.12;
        const env =
          i < sr * 0.06
            ? i / (sr * 0.06)
            : Math.pow(1 - (i - sr * 0.06) / (len - sr * 0.06), 1.4);
        ch[i] = Math.max(-1, Math.min(1, (crack + rumble) * env));
      }

      const src = ac.createBufferSource();
      src.buffer = buf;

      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(850 * intensity, now);
      filter.frequency.exponentialRampToValueAtTime(110, now + 1.7);

      const gain = ac.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.24 * Math.min(1.2, intensity), now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.85);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(ac.destination);
      src.start(now);
      src.stop(now + 1.9);

      // Sub-bass boom
      const sub = ac.createOscillator();
      const subGain = ac.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(72, now);
      sub.frequency.exponentialRampToValueAtTime(30, now + 0.9);
      subGain.gain.setValueAtTime(0.16 * Math.min(1.2, intensity), now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.95);
      sub.connect(subGain);
      subGain.connect(ac.destination);
      sub.start(now);
      sub.stop(now + 1.0);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public setRainAmbience(level: number): void {
    this.currentRainLevel = level;
    this.updateRainGain(this.mute ? 0 : level);
  }

  private updateRainGain(target: number): void {
    try {
      const ac = this.ac;
      if (!ac || ac.state !== 'running') return;
      if (target > 0 && !this.rainSource) {
        const sr = ac.sampleRate;
        if (!this.rainNoiseBuf) {
          this.rainNoiseBuf = ac.createBuffer(1, sr * 2, sr);
          const data = this.rainNoiseBuf.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            data[i] = Math.random() * 2 - 1;
          }
        }
        const src = ac.createBufferSource();
        src.buffer = this.rainNoiseBuf;
        src.loop = true;

        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 1800;
        bp.Q.value = 0.65;

        const gn = ac.createGain();
        gn.gain.value = 0;

        src.connect(bp);
        bp.connect(gn);
        gn.connect(ac.destination);
        src.start();
        this.rainSource = src;
        this.rainGain = gn;
      }

      if (this.rainGain) {
        const now = ac.currentTime;
        this.rainGain.gain.cancelScheduledValues(now);
        this.rainGain.gain.setTargetAtTime(target, now, 0.08);
      }
    } catch {
      // Ignore Web Audio errors
    }
  }

  public nt(n: number, d: number, ty: OscillatorType, v: number, det = 0): void {
    if (!n || this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const o = ac.createOscillator();
      const gn = ac.createGain();
      const a = ac.currentTime;
      o.type = ty;
      o.detune.value = det;
      o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
      gn.gain.setValueAtTime(v, a);
      gn.gain.exponentialRampToValueAtTime(0.0001, a + d);
      o.connect(gn);
      gn.connect(ac.destination);
      o.start(a);
      o.stop(a + d);
    } catch {
      // Ignore Web Audio errors
    }
  }

  private nz(d: number, v: number, f: number): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const sr = ac.sampleRate;
      if (!this.noiseBuf) {
        this.noiseBuf = ac.createBuffer(1, sr / 2, sr);
        const a = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
      }
      const s = ac.createBufferSource();
      const gn = ac.createGain();
      const fl = ac.createBiquadFilter();
      const a = ac.currentTime;
      s.buffer = this.noiseBuf;
      fl.type = 'highpass';
      fl.frequency.value = f;
      gn.gain.setValueAtTime(v, a);
      gn.gain.exponentialRampToValueAtTime(0.0001, a + d);
      s.connect(fl);
      fl.connect(gn);
      gn.connect(ac.destination);
      s.start(a);
      s.stop(a + d);
    } catch {
      // Ignore Web Audio errors
    }
  }

  private kick(vol = 1): void {
    if (this.mute) return;
    try {
      const ac = this.ensureContext();
      if (!ac || ac.state !== 'running') return;
      const o = ac.createOscillator();
      const gn = ac.createGain();
      const a = ac.currentTime;
      o.frequency.setValueAtTime(150, a);
      o.frequency.exponentialRampToValueAtTime(40, a + 0.12);
      gn.gain.setValueAtTime(0.14 * vol, a);
      gn.gain.exponentialRampToValueAtTime(0.0001, a + 0.15);
      o.connect(gn);
      gn.connect(ac.destination);
      o.start(a);
      o.stop(a + 0.16);
    } catch {
      // Ignore Web Audio errors
    }
  }

  public tickMusic(wanted: TrackName): void {
    if (wanted !== this.trk) {
      this.trk = wanted;
      this.ms = 0;
      this.ma = 99;
    }
    if (!this.trk || this.mute) {
      this.stopTrackFile();
      return;
    }

    // A real file, when mapped for this track, replaces the synth entirely.
    const fileSrc = TRACK_FILES[this.trk];
    if (fileSrc) {
      this.playTrackFile(this.trk, fileSrc);
      return;
    }
    this.stopTrackFile();

    const k = TRACKS[this.trk];
    if (!k) return;
    const fr = 900 / k.bpm;
    this.ma++;
    if (this.ma < fr) return;
    this.ma -= fr;

    const s = this.ms++ % (16 * k.c.length);
    const sp = s & 15;
    const ch = k.c[s >> 4];
    const ct = [
      [0, 4, 7],
      [0, 3, 7],
      [0, 3, 6],
    ][ch[1]];
    const d = fr / 60;
    const v = this.musicVolume;

    if (!(s & 1)) {
      const n = k.l[s >> 1];
      if (n) {
        this.nt(n, d * 3, k.w, 0.028 * v);
        this.nt(n, d * 3, k.w, 0.014 * v, 9);
      }
    }
    if (k.arp) {
      this.nt(ch[0] + 24 + ct[sp % 3] + (sp & 8 ? 12 : 0), d * 1.4, 'square', 0.011 * v);
    }
    const b = k.bp[sp];
    if (b === 'x') this.nt(ch[0], d * 1.8, 'triangle', 0.075 * v);
    else if (b === 'o') this.nt(ch[0] + 12, d * 1.4, 'triangle', 0.055 * v);
    if (k.pad && !sp) this.nt(ch[0] + 24, d * 14, 'sawtooth', 0.011 * v, 6);

    const dm = k.dm;
    if (dm && dm < 3 && (sp % 8 === 0 || (dm === 2 && sp % 4 === 0))) this.kick(v);
    if (dm && dm < 3 && (sp === 4 || sp === 12)) this.nz(0.12, 0.045 * v, 1500);
    if (dm && (dm === 2 || !(sp & 1))) this.nz(0.04, 0.01 * v, 7000);
  }
}
