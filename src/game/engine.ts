import { RetroAudio, TrackName } from './audio';
import {
  CHEST_ITEMS,
  DAY_CYCLE_FRAMES,
  DX,
  DY,
  FONT,
  H,
  INTRO_FADE_FRAMES,
  INTRO_LOGO_FRAMES,
  INTRO_RISE_FRAMES,
  NAME_ROWS,
  QUESTS,
  SHIELD_STATS,
  SHOPS,
  SOLID_TILES,
  STORY_PAGES,
  STORY_TONES,
  SWORD_STATS,
  W,
} from './constants';
import {
  drawGame,
  drawGameOver,
  drawHelp,
  drawIntro,
  drawMenu,
  drawMgMenu,
  drawMinigame,
  drawNameEntry,
  drawShop,
  drawStory,
  drawVictory,
  getCycleInfo,
  Star,
  wrapText,
} from './render';
import {
  DustMote,
  Enemy,
  EngineUIState,
  HeroState,
  IntroPhase,
  KeyCode,
  MinigameState,
  Npc,
  OutfitId,
  Particle,
  ProgressState,
  Projectile,
  ScreenState,
  SecondaryTool,
  ShieldTier,
  SwordTier,
  WorldData,
} from './types';
import { createWeatherState, stepWeather, triggerLightningNow } from './weather';
import {
  bio,
  buildWorld,
  createInitialHero,
  createInitialProgress,
  getEnemyMaxHp,
  hasSavedGame,
  isHouse,
  lake,
  loadSavedGame,
  mapDisplayName,
  rnd,
  saveGame,
} from './world';

const SECONDARY_ORDER: SecondaryTool[] = ['arco', 'bomba', 'tocha', 'pocao'];

export class GameEngine {
  private ctx: CanvasRenderingContext2D;
  public audio = new RetroAudio();

  private rafId: number | null = null;
  private lastTs = 0;
  private acc = 0;

  private t = 0;
  private worldTime = 450; // Starts in bright morning daylight, cycling smoothly into dusk & night
  private torchFuel = 0;

  private st: ScreenState = 'intro';
  private introPhase: IntroPhase = 'logo';
  private introTick = 0;

  private menuSel = 0;
  private mgSel = 0;
  private victorySel = 0;
  private invSel = 0;
  private invHeroDir = 2;
  private shopId: 'items' | 'weapons' | 'tailor' | 'bazaar' = 'items';
  private shopSel = 0;
  private noSaveTimer = 0;

  private nm = '';
  private nc = { x: 0, y: 0 };
  private hn = '';

  private sc = 0;
  private pg = 0;
  private ch = 0;
  private tn = 0.22;
  private lastBlipChar = -1;

  private world: WorldData = buildWorld();
  private V: ProgressState = createInitialProgress();
  private G: HeroState = createInitialHero();
  private mg: MinigameState | null = null;
  private particles: Particle[] = [];
  private projectiles: Projectile[] = [];
  private weather = createWeatherState();

  private lastMapSaved = -1;
  private stuckFrames = 0;
  private victoryShown = false;
  private sleepTimer = 0;
  private swingHitEnemies = new Set<Enemy>();
  private swingHitClanged = false;
  private shakeFrames = 0;
  private shakeMag = 1.4;

  private stars: Star[] = Array.from({ length: 40 }, () => [rnd(W), rnd(120), rnd(3)]);
  private dust: DustMote[] = Array.from({ length: 28 }, (_, i) => ({
    x: 12 + Math.random() * (W - 24),
    y: 12 + Math.random() * (H - 24),
    vx: (Math.random() - 0.5) * 0.14 + (i % 2 === 0 ? 0.04 : -0.03),
    vy: -0.04 - Math.random() * 0.06,
    size: i % 5 === 0 ? 2 : 1,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.25 + Math.random() * 0.4,
    warm: i % 3 !== 0,
  }));

  // Continuous analog thumbstick vector (-1..1) + menu discrete repeat cooldown
  private analog = { x: 0, y: 0 };
  private analogMenuCooldown = 0;

  private input: Record<KeyCode, boolean> = {
    u: false,
    d: false,
    l: false,
    r: false,
    a: false,
    b: false,
    x: false,
    s: false,
    m: false,
    i: false,
  };

  private pressed: Record<KeyCode, boolean> = {
    u: false,
    d: false,
    l: false,
    r: false,
    a: false,
    b: false,
    x: false,
    s: false,
    m: false,
    i: false,
  };

  private onStateChange?: (ui: EngineUIState) => void;
  private lastBroadcast = '';

  constructor(canvas: HTMLCanvasElement, onStateChange?: (ui: EngineUIState) => void) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context not available');
    this.ctx = context;
    this.ctx.imageSmoothingEnabled = false;
    this.onStateChange = onStateChange;

    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.load(FONT);
    }
  }

  public start(): void {
    this.broadcastUI();
    this.lastTs = performance.now();
    const tick = (ts: number) => {
      const dt = Math.min(Math.max(0, ts - this.lastTs), 100);
      this.lastTs = ts;
      this.acc += dt;
      while (this.acc >= 16.6667) {
        this.acc -= 16.6667;
        this.step();
        this.clearPressed();
      }
      this.draw();
      this.broadcastUI();
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  public destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.audio.setRainAmbience(0);
  }

  public getUIState(): EngineUIState {
    const overworldMap = this.G.map < 56 ? this.G.map : this.G.ret?.map ?? 51;
    const isCave = !isHouse(this.G.map) && this.G.map >= 200;
    return {
      screen: this.st,
      introPhase: this.introPhase,
      showLogoGif: this.st === 'intro' && this.introPhase === 'logo',
      muted: this.audio.mute,
      hasSave: hasSavedGame(),
      heroName: this.hn,
      secondary: this.V.secondary,
      torchLit: this.V.torchLit,
      isNight: getCycleInfo(this.worldTime).isNight,
      explored: [...this.V.explored],
      currentMap: this.G.map,
      overworldMap,
      locationName: mapDisplayName(this.G.map),
      rp: this.G.rp,
      fragments: this.V.it.fragmento | 0,
      pot: this.V.pot,
      arrows: this.V.arrows,
      bombs: this.V.bombs,
      torches: this.V.torches,
      swordName: this.V.sword ? SWORD_STATS[this.V.swordTier].name : 'SEM ESPADA',
      shieldName: SHIELD_STATS[this.V.shield].name,
      heroNormX: Math.max(0, Math.min(1, (this.G.x + 8) / W)),
      heroNormY: Math.max(0, Math.min(1, (this.G.y + 8) / H)),
      heroDir: this.G.dir,
      hp: this.G.hp,
      maxHp: this.V.mh * 2,
      torchFuelRatio: this.V.torchLit ? Math.max(0, Math.min(1, this.torchFuel / 2400)) : 0,
      isCave,
      invSel: this.invSel,
      invHeroDir: this.invHeroDir,
      hasSword: Boolean(this.V.sword),
      equippedSword: this.V.sword > 0 && this.V.equipped === 'sword',
      swordTier: this.V.swordTier,
      ownedSwords: [...this.V.ownedSwords],
      dmg: this.V.dmg,
      shieldTier: this.V.shield,
      ownedShields: [...this.V.ownedShields],
      outfit: this.V.outfit,
      ownedOutfits: [...this.V.ownedOutfits],
      mushrooms: this.V.it.cogumelo | 0,
      hasRing: Boolean(this.V.it.anel),
      hasOre: Boolean(this.V.it.minerio),
      hasBear: Boolean(this.V.it.ursinho),
    };
  }

  private broadcastUI(): void {
    if (!this.onStateChange) return;
    const ui = this.getUIState();
    const nx = (ui.heroNormX * 16) | 0;
    const ny = (ui.heroNormY * 12) | 0;
    const tf = (ui.torchFuelRatio * 10) | 0;
    const sig = `${ui.screen}|${ui.introPhase}|${ui.showLogoGif}|${ui.muted}|${ui.hasSave}|${ui.heroName}|${ui.secondary}|${ui.torchLit}|${ui.isNight}|${ui.currentMap}|${ui.overworldMap}|${ui.explored.length}|${ui.rp}|${ui.fragments}|${ui.pot}|${ui.arrows}|${ui.bombs}|${ui.torches}|${ui.swordName}|${ui.shieldName}|${nx}|${ny}|${ui.heroDir}|${ui.hp}|${ui.maxHp}|${tf}|${ui.isCave}|${ui.invSel}|${ui.invHeroDir}|${ui.hasSword}|${ui.equippedSword}|${ui.swordTier}|${ui.shieldTier}|${ui.outfit}|${ui.ownedSwords.length}|${ui.ownedShields.length}|${ui.ownedOutfits.length}|${ui.mushrooms}|${ui.hasRing}|${ui.hasOre}|${ui.hasBear}`;
    if (sig !== this.lastBroadcast) {
      this.lastBroadcast = sig;
      this.onStateChange(ui);
    }
  }

  public selectInvSlot(idx: number): void {
    if (this.st !== 'inv') return;
    const clamped = Math.max(0, Math.min(7, idx));
    if (this.invSel === clamped) {
      this.activateInventorySlot();
    } else {
      this.invSel = clamped;
      this.audio.bp(520, 0.04);
    }
    this.broadcastUI();
  }

  public activateInvSlot(idx?: number): void {
    if (this.st !== 'inv') return;
    if (typeof idx === 'number') {
      this.invSel = Math.max(0, Math.min(7, idx));
    }
    this.activateInventorySlot();
    this.broadcastUI();
  }

  public rotateInvHero(): void {
    if (this.st !== 'inv') return;
    this.invHeroDir = (this.invHeroDir + 1) % 4;
    this.audio.bp(640, 0.04);
    this.broadcastUI();
  }

  public closeInv(): void {
    if (this.st !== 'inv') return;
    this.st = 'game';
    this.audio.bp(480, 0.05);
    this.broadcastUI();
  }

  public quickSave(): void {
    this.audio.unlock();
    if (this.st === 'game' || this.st === 'inv' || this.st === 'shop') {
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      this.V.msg = 'JOGO SALVO!';
      this.V.mt = 75;
      this.audio.bp(920, 0.09);
      this.broadcastUI();
    } else {
      this.audio.bp(260, 0.06);
    }
  }

  private markExplored(mapId: number): void {
    if (mapId >= 0 && mapId < 56 && !this.V.explored.includes(mapId)) {
      this.V.explored.push(mapId);
    }
  }

  public setAnalog(ax: number, ay: number): void {
    const len = Math.hypot(ax, ay);
    if (len < 0.08) {
      this.analog.x = 0;
      this.analog.y = 0;
      return;
    }
    if (len > 1) {
      this.analog.x = ax / len;
      this.analog.y = ay / len;
    } else {
      this.analog.x = ax;
      this.analog.y = ay;
    }
  }

  public setKey(k: KeyCode, down: boolean): void {
    if (down) this.audio.unlock();
    if (down && !this.input[k]) {
      this.pressed[k] = true;
    }
    this.input[k] = down;
  }

  public toggleMute(): void {
    this.audio.unlock();
    this.audio.toggleMute();
    this.broadcastUI();
  }

  public handleTextKey(e: KeyboardEvent): boolean {
    if (this.st !== 'name') return false;
    this.audio.unlock();
    const k = e.key;
    if (/^[a-zA-Z]$/.test(k)) {
      if (this.nm.length < 8) {
        this.nm += k.toUpperCase();
        this.audio.bp(760, 0.04);
      }
      return true;
    }
    if (k === ' ' && this.nm.length > 0 && this.nm.length < 8) {
      this.nm += ' ';
      this.audio.bp(700, 0.04);
      return true;
    }
    if (k === 'Backspace') {
      this.nm = this.nm.slice(0, -1);
      this.audio.bp(320, 0.04);
      return true;
    }
    if (k === 'Enter') {
      this.confirmName();
      return true;
    }
    return false;
  }

  public handleCanvasTap(cx: number, cy: number): void {
    this.audio.unlock();
    if (this.st === 'intro') {
      this.advanceIntro();
      return;
    }
    if (this.st === 'menu') {
      const idx = Math.floor((cy - 92) / 14);
      if (cx >= 42 && cx <= 198 && idx >= 0 && idx < 4) {
        this.menuSel = idx;
        this.activateMenu();
      }
      return;
    }
    if (this.st === 'mgmenu') {
      const idx = Math.floor((cy - 100) / 14);
      if (cx >= 42 && cx <= 198 && idx >= 0 && idx < 3) {
        this.mgSel = idx;
        this.activateMgMenu();
      }
      return;
    }
    if (this.st === 'help') {
      this.audio.bp(600, 0.05);
      this.st = 'menu';
      return;
    }
    if (this.st === 'name') {
      for (let j = 0; j < 3; j++) {
        const y0 = 55 + j * 14;
        if (cy >= y0 && cy < y0 + 13) {
          const i = Math.floor((cx - 45) / 16);
          if (i >= 0 && i < 9) {
            this.nc = { x: i, y: j };
            const ch = NAME_ROWS[j][i];
            if (this.nm.length < 8) {
              this.nm += ch;
              this.audio.bp(800, 0.04);
            }
            return;
          }
        }
      }
      if (cy >= 102 && cy <= 122) {
        if (cx >= 36 && cx <= 120) {
          this.nc = { x: 0, y: 3 };
          this.nm = this.nm.slice(0, -1);
          this.audio.bp(320, 0.04);
          return;
        }
        if (cx > 120 && cx <= 210) {
          this.nc = { x: 1, y: 3 };
          this.confirmName();
          return;
        }
      }
      return;
    }
    if (this.st === 'story') {
      this.advanceStoryPage();
      return;
    }
    if (this.st === 'over') {
      this.beginGameInsideHouse();
      return;
    }
    if (this.st === 'inv') {
      if (cx < 6 || cx > W - 6 || cy < 6 || cy > H - 6) {
        this.st = 'game';
        this.audio.bp(480, 0.05);
        return;
      }
      if (cx >= 10 && cx <= 95 && cy >= 25 && cy <= 146) {
        this.invHeroDir = (this.invHeroDir + 1) % 4;
        this.audio.bp(640, 0.04);
        return;
      }
      for (let i = 0; i < 8; i++) {
        const col = i % 4;
        const row = (i / 4) | 0;
        const sx = 101 + col * 32;
        const sy = 27 + row * 28;
        if (cx >= sx && cx <= sx + 29 && cy >= sy && cy <= sy + 25) {
          if (this.invSel === i) {
            this.activateInventorySlot();
          } else {
            this.invSel = i;
            this.audio.bp(520, 0.04);
          }
          return;
        }
      }
      return;
    }
    if (this.st === 'shop') {
      if (cx < 10 || cx > 230 || cy < 6 || cy > 154) {
        this.st = 'game';
        this.audio.bp(480, 0.05);
        return;
      }
      const shop = SHOPS[this.shopId];
      for (let i = 0; i < shop.items.length; i++) {
        const ry = 28 + i * 17;
        if (cx >= 18 && cx <= 222 && cy >= ry && cy <= ry + 16) {
          if (this.shopSel === i) {
            this.buyShopItem();
          } else {
            this.shopSel = i;
            this.audio.bp(520, 0.04);
          }
          return;
        }
      }
      return;
    }
    if (this.st === 'victory') {
      if (cy >= 96 && cy <= 113) {
        this.victorySel = 0;
        this.st = 'game';
        this.audio.bp(800, 0.08);
      } else if (cy > 113 && cy <= 132) {
        this.victorySel = 1;
        this.st = 'menu';
        this.menuSel = 0;
        this.audio.bp(700, 0.08);
      }
      return;
    }
    if (this.st === 'game') {
      if (this.G.dlg) {
        this.G.dlg.i++;
        this.audio.bp(700, 0.04);
        if (this.G.dlg.i >= this.G.dlg.p.length) {
          this.G.dlg = null;
          if (this.V.fl.win && !this.victoryShown) {
            this.victoryShown = true;
            this.victorySel = 0;
            this.st = 'victory';
          }
        }
      } else if (this.G.sleeping && (this.G.wakeTimer ?? 0) === 0) {
        this.startWakeAnimation();
      }
    }
  }

  private clearPressed(): void {
    (Object.keys(this.pressed) as KeyCode[]).forEach((k) => {
      this.pressed[k] = false;
    });
  }

  private syncAnalogToMenuPressed(): void {
    if (this.analogMenuCooldown > 0) {
      this.analogMenuCooldown--;
      return;
    }
    const ax = this.analog.x;
    const ay = this.analog.y;
    if (Math.hypot(ax, ay) < 0.52) return;

    if (Math.abs(ax) > Math.abs(ay)) {
      this.pressed[ax > 0 ? 'r' : 'l'] = true;
    } else {
      this.pressed[ay > 0 ? 'd' : 'u'] = true;
    }
    this.analogMenuCooldown = 14;
  }

  private advanceIntro(): void {
    this.audio.bp(700, 0.06);
    if (this.introPhase === 'logo') {
      this.introPhase = 'fade';
      this.introTick = 0;
    } else if (this.introPhase === 'fade') {
      this.introPhase = 'rise';
      this.introTick = 0;
    } else {
      this.st = 'menu';
      this.menuSel = 0;
    }
  }

  private formatDialogText(raw: string): string {
    if (!this.hn) return raw;
    return raw.replace(/\b[Hh]er[oó]i\b/g, this.hn);
  }

  private talk(raw: string): void {
    const formatted = this.formatDialogText(raw);
    const lines = wrapText(formatted, 26);
    const pages: string[][] = [];
    for (let i = 0; i < lines.length; i += 3) {
      pages.push(lines.slice(i, i + 3));
    }
    this.G.dlg = { p: pages, i: 0 };
  }

  private talkChain(linesRaw: string[]): void {
    const pages: string[][] = [];
    for (const part of linesRaw) {
      const lines = wrapText(this.formatDialogText(part), 26);
      for (let i = 0; i < lines.length; i += 3) {
        pages.push(lines.slice(i, i + 3));
      }
    }
    if (pages.length) {
      this.G.dlg = { p: pages, i: 0 };
    }
  }

  private spawn(): void {
    this.G.en = [];
    this.G.it = [];
    this.projectiles = [];
    const e = this.world.enemies[this.G.map] || [0, 0];
    let n = e[0];
    if (e[1] === 4 && this.V.fl['b' + this.G.map]) n = 0;
    const kind = e[1];
    const maxHp = getEnemyMaxHp(this.G.map, kind);
    for (let q = 0; q < 90 && n > 0; q++) {
      const a = 1 + rnd(13);
      const b = 1 + rnd(8);
      const c = this.world.maps[this.G.map]?.[b]?.[a];
      if (c && '.sncgi'.includes(c) && Math.hypot(a * 16 - this.G.x, b * 16 - this.G.y) > 70) {
        this.G.en.push({
          x: a * 16,
          y: b * 16,
          hp: maxHp,
          maxHp,
          k: kind,
          dx: 0,
          dy: 0,
          t: 0,
          cd: 50 + rnd(50),
        });
        n--;
      }
    }
  }

  private free(x: number, y: number, w: number, h: number, isEnemy = false): boolean {
    const map = this.world.maps[this.G.map];
    if (!map) return false;
    for (const [cx, cy] of [
      [x, y],
      [x + w - 1, y],
      [x, y + h - 1],
      [x + w - 1, y + h - 1],
    ]) {
      const a = Math.floor(cx / 16);
      const b = Math.floor(cy / 16);
      if (a < 0 || b < 0 || a > 14 || b > 9) {
        if (isEnemy) return false;
        continue;
      }
      if (SOLID_TILES.has(map[b][a])) return false;
    }
    for (const n of this.world.npcs[this.G.map] || []) {
      if (x < n.x * 16 + 14 && x + w > n.x * 16 + 2 && y < n.y * 16 + 14 && y + h > n.y * 16 + 4) {
        return false;
      }
    }
    return true;
  }

  private fixPos(): void {
    const ok = (x: number, y: number) => this.free(x + 3, y + 8, 10, 7);
    if (ok(this.G.x, this.G.y)) return;
    for (let r = 4; r <= 64; r += 4) {
      for (let a = 0; a < 16; a++) {
        const x = this.G.x + Math.cos(a * 0.3927) * r;
        const y = this.G.y + Math.sin(a * 0.3927) * r;
        if (x > -3 && x < 227 && y > -8 && y < 145 && ok(x, y)) {
          this.G.x = x;
          this.G.y = y;
          return;
        }
      }
    }
  }

  private burst(x: number, y: number, c: string, glow = false, count = 9): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * (glow ? 1.9 : 1.1),
        vy: (Math.random() * 2 - 1.3) * (glow ? 1.8 : 1.3),
        l: 16 + rnd(12),
        maxL: 28,
        c,
        glow,
        size: glow && i % 2 === 0 ? 3 : 2,
      });
    }
  }

  private getSwordEffectColors(): { primary: string; secondary: string; glow: string } {
    switch (this.V.swordTier) {
      case 'solar':
        return { primary: '#fff4a8', secondary: '#ff7a2e', glow: '#ffb040' };
      case 'runica':
        return { primary: '#b8f4ff', secondary: '#2ea8ff', glow: '#66e2ff' };
      case 'aco':
        return { primary: '#fff0a0', secondary: '#f0a528', glow: '#ffd84a' };
      default:
        return { primary: '#ffffff', secondary: '#7ce4ff', glow: '#bfefff' };
    }
  }

  private emitSwordArcSparks(swFrame: number): void {
    const d = this.G.dir;
    const baseAng = d === 0 ? -Math.PI / 2 : d === 1 ? 0 : d === 2 ? Math.PI / 2 : Math.PI;
    const progress = (14 - swFrame) / 13;
    const ease = 1 - Math.pow(1 - progress, 2.3);
    const curAng = baseAng + (ease - 0.5) * 2.38;
    const px = d === 1 ? this.G.x + 13 : d === 3 ? this.G.x + 3 : this.G.x + 8;
    const py = d === 0 ? this.G.y + 1 : d === 2 ? this.G.y + 13 : this.G.y + 8;
    const cols = this.getSwordEffectColors();

    for (let i = 0; i < 2; i++) {
      const ang = curAng + (Math.random() - 0.5) * 0.4;
      const dist = 12 + Math.random() * 6;
      this.particles.push({
        x: px + Math.cos(ang) * dist,
        y: py + Math.sin(ang) * dist,
        vx: Math.cos(ang) * (0.55 + Math.random() * 0.6),
        vy: Math.sin(ang) * (0.55 + Math.random() * 0.6) - 0.2,
        l: 6 + rnd(4),
        maxL: 10,
        c: i === 0 ? cols.primary : cols.secondary,
        glow: false,
        size: 1,
        kind: 'spark',
      });
    }
  }

  private startWakeAnimation(): void {
    this.G.wakeTimer = 44;
    this.audio.bp(580, 0.06, 'triangle');
  }

  private beginGameInsideHouse(): void {
    this.V = createInitialProgress();
    this.world = buildWorld();
    this.G = createInitialHero();
    this.worldTime = 450;
    this.torchFuel = 0;
    this.projectiles = [];
    this.particles = [];
    this.spawn();
    this.victoryShown = false;
    this.sleepTimer = 0;
    this.st = 'game';
    this.lastMapSaved = this.G.map;
    this.talk(
      'Você desperta com o som dos trovões lá fora... Hora de levantar, descer as escadas e ir à casa ao lado puxar a Espada Lendária!',
    );
    saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
  }

  private confirmName(): void {
    this.hn = this.nm.trim() || 'HEROI';
    this.st = 'story';
    this.sc = 0;
    this.pg = 0;
    this.ch = 0;
    this.tn = STORY_TONES[0];
    this.lastBlipChar = -1;
    this.weather = createWeatherState();
    triggerLightningNow(this.weather, 14, 1.15);
    this.audio.bp(900, 0.2);
  }

  private startMinigame(id: 1 | 2, from: 'game' | 'mgmenu'): void {
    this.mg = {
      id,
      from,
      t: 1800,
      sc: 0,
      pop: Array(9).fill(0),
      cx: 1,
      cy: 1,
      sw: 0,
      it: [],
      bx: 108,
      end: 0,
    };
    this.st = 'mg';
    this.audio.bp(600, 0.1);
  }

  private activateMenu(): void {
    this.audio.bp(800, 0.08);
    if (this.menuSel === 0) {
      this.hn = '';
      this.nm = '';
      this.nc = { x: 0, y: 0 };
      this.st = 'name';
    } else if (this.menuSel === 1) {
      const loaded = loadSavedGame();
      if (!loaded) {
        this.noSaveTimer = 90;
        this.audio.bp(180, 0.16, 'sawtooth');
      } else {
        this.hn = loaded.heroName;
        this.world = loaded.world;
        this.G = loaded.G;
        this.V = loaded.V;
        this.worldTime = loaded.worldTime;
        this.torchFuel = this.V.torchLit ? 1200 : 0;
        this.markExplored(this.G.map);
        this.spawn();
        this.fixPos();
        this.st = 'game';
        this.V.msg = 'JOGO CARREGADO';
        this.V.mt = 100;
        this.lastMapSaved = this.G.map;
      }
    } else if (this.menuSel === 2) {
      this.st = 'mgmenu';
      this.mgSel = 0;
    } else {
      this.st = 'help';
    }
  }

  private activateMgMenu(): void {
    this.audio.bp(700, 0.07);
    if (this.mgSel === 2) {
      this.st = 'menu';
    } else {
      this.startMinigame((this.mgSel + 1) as 1 | 2, 'mgmenu');
    }
  }

  private advanceStoryPage(): void {
    const s = STORY_PAGES[this.pg].replace('{N}', this.hn);
    if (this.ch < s.length) {
      this.ch = s.length;
      this.audio.bp(620, 0.04);
    } else {
      this.pg++;
      this.ch = 0;
      this.lastBlipChar = -1;
      if (this.pg >= STORY_PAGES.length) {
        this.pg = STORY_PAGES.length - 1;
        this.audio.bp(880, 0.14);
        this.beginGameInsideHouse();
      } else {
        this.audio.bp(700, 0.06);
        if (this.pg === 1 || this.pg === 3) {
          triggerLightningNow(this.weather, 10, 1.2);
        }
      }
    }
  }

  private stepStory(): void {
    this.sc++;
    this.tn += (STORY_TONES[this.pg] - this.tn) * 0.03;
    const s = STORY_PAGES[this.pg].replace('{N}', this.hn);
    if (this.ch < s.length) {
      this.ch = Math.min(s.length, this.ch + 0.65);
      const ci = this.ch | 0;
      if (ci > this.lastBlipChar && ci % 3 === 0 && s[ci] !== ' ') {
        this.lastBlipChar = ci;
        this.audio.playTypeBlip(ci);
      }
    }

    if (this.pressed.a || this.pressed.s) {
      this.advanceStoryPage();
    }
  }

  private stepName(): void {
    this.syncAnalogToMenuPressed();
    const cols = this.nc.y < 3 ? 9 : 2;
    if (this.pressed.l) {
      this.nc.x = (this.nc.x + cols - 1) % cols;
      this.audio.bp(480, 0.03);
    }
    if (this.pressed.r) {
      this.nc.x = (this.nc.x + 1) % cols;
      this.audio.bp(480, 0.03);
    }
    if (this.pressed.u) {
      this.nc.y = (this.nc.y + 3) % 4;
      this.audio.bp(480, 0.03);
    }
    if (this.pressed.d) {
      this.nc.y = (this.nc.y + 1) % 4;
      this.audio.bp(480, 0.03);
    }

    const c2 = this.nc.y < 3 ? 9 : 2;
    if (this.nc.x >= c2) this.nc.x = c2 - 1;

    if (this.pressed.a) {
      if (this.nc.y < 3) {
        if (this.nm.length < 8) {
          this.nm += NAME_ROWS[this.nc.y][this.nc.x];
          this.audio.bp(800, 0.04);
        }
      } else if (this.nc.x === 0) {
        this.nm = this.nm.slice(0, -1);
        this.audio.bp(320, 0.04);
      } else {
        this.confirmName();
      }
    }
    if (this.pressed.b) {
      this.nm = this.nm.slice(0, -1);
      this.audio.bp(320, 0.04);
    }
    if (this.pressed.s) {
      this.confirmName();
    }
  }

  private enterDoor(): boolean {
    const a = (this.G.x + 8) >> 4;
    const b = (this.G.y + 12) >> 4;
    const L = this.world.doors[this.G.map] || [];
    const tol = this.G.map >= 100 ? 1 : 0;
    const d = L.find((o) => o.y === b && Math.abs(o.x - a) <= tol);
    if (!d) return false;

    if (d.to === 'ret') {
      const r = this.G.ret || { map: 51, x: 32, y: 68 };
      this.G.map = r.map;
      this.G.x = r.x;
      this.G.y = r.y;
    } else {
      if (this.G.map < 100) {
        this.G.ret = { map: this.G.map, x: d.x * 16, y: (d.y + 1) * 16 + 4 };
      }
      this.G.map = d.to;
      this.G.x = d.px;
      this.G.y = d.py;
    }

    this.markExplored(this.G.map);
    this.spawn();
    this.fixPos();
    this.audio.bp(500, 0.12);
    if (this.G.map >= 100 || this.G.map === 35 || this.G.map === 36) {
      const name = mapDisplayName(this.G.map);
      if (name) {
        this.V.msg = name;
        this.V.mt = 100;
      }
    }
    return true;
  }

  private interactNpc(n: Npc): void {
    if (n.shopId) {
      this.shopId = n.shopId;
      this.shopSel = 0;
      this.st = 'shop';
      this.audio.bp(820, 0.08);
      return;
    }

    const q = n.q ? QUESTS[n.q] : null;
    if (n.heal) this.G.hp = this.V.mh * 2;
    if (n.el && !this.V.sword) {
      this.talk(
        'Você precisa da Espada Lendária! Vá até a casa ao lado da sua e puxe a espada cravada no meio da sala.',
      );
      return;
    }
    if (n.el) {
      const f = this.V.it.fragmento | 0;
      this.talk(
        f >= 3
          ? 'Você tem os 3 fragmentos! Vá ao castelo, ao norte, e derrote Vorak!'
          : f
            ? `Você tem ${f} de 3 fragmentos. Cavernas: floresta (leste), ruínas (nordeste) e gelo (noroeste).`
            : n.s,
      );
      return;
    }
    if (n.q === 'maria' && !this.V.sword) {
      this.talk(
        'Essa espada está cravada no meio da minha casa há séculos! Ninguém nunca conseguiu puxá-la... Tente você, Herói!',
      );
      return;
    }
    if (q) {
      const s = this.V.fl[n.q!] | 0;
      if (s === 2) {
        this.talk(q.done);
        return;
      }
      if ((this.V.it[q.need] | 0) >= q.n) {
        this.V.it[q.need] -= q.n;
        this.V.fl[n.q!] = 2;
        const r = q.rew;
        if (r.rp) this.G.rp = Math.min(999, this.G.rp + r.rp);
        if (r.pot) this.V.pot += r.pot;
        if (r.arrows) this.V.arrows = Math.min(99, this.V.arrows + r.arrows);
        if (r.bombs) this.V.bombs = Math.min(99, this.V.bombs + r.bombs);
        if (n.q === 'marta') this.V.torches = Math.min(99, this.V.torches + 3);
        if (r.mh) {
          this.V.mh++;
          this.G.hp = this.V.mh * 2;
        }
        if (r.dmg) {
          this.V.dmg = Math.max(this.V.dmg, r.dmg);
          if (!this.V.ownedSwords.includes('aco')) this.V.ownedSwords.push('aco');
          this.V.swordTier = 'aco';
          this.V.sword = 1;
          this.V.equipped = 'sword';
        }
        this.audio.bp(900, 0.4);
        this.talk(q.ok);
        return;
      }
      this.V.fl[n.q!] = 1;
      this.talk(q.ask);
      return;
    }

    if (n.chat && n.chat.length > 0 && Math.random() < 0.65) {
      this.talkChain([n.s, ...n.chat]);
      return;
    }

    const { isNight } = getCycleInfo(this.worldTime);
    const nightExtra =
      isNight && this.G.map < 100 && Math.random() < 0.45
        ? ' A noite chegou: acenda uma tocha com X se for explorar cavernas!'
        : '';
    this.talk(n.s + nightExtra + (n.heal ? ' (Vida restaurada!)' : ''));
  }

  private pullSword(a: number, b: number): void {
    this.V.sword = 1;
    this.V.equipped = 'sword';
    if (!this.V.ownedSwords.includes('lendaria')) this.V.ownedSwords.push('lendaria');
    this.V.swordTier = 'lendaria';
    this.V.dmg = Math.max(this.V.dmg, 1);
    this.weather.clearBanner = 160;
    this.world.maps[this.G.map][b][a] = 'r';
    this.audio.playSwordFanfare();
    this.burst(a * 16 + 8, b * 16 + 4, '#ffd84a', true, 16);
    this.talk(
      'Com força e coragem, Herói puxa a ESPADA LENDÁRIA! Apenas você podia retirá-la. A chuva lá fora parou!',
    );
    saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
  }

  private openChest(a: number, b: number): void {
    const c = CHEST_ITEMS[this.G.map];
    const chestFlag = `ch_${this.G.map}_${a}_${b}`;
    const alreadyMain = Boolean(this.V.fl[`main_${this.G.map}`]);
    this.audio.bp(900, 0.3);

    if (!alreadyMain && c && !this.V.fl[chestFlag]) {
      this.V.fl[`main_${this.G.map}`] = 1;
      this.V.fl[chestFlag] = 1;
      if (c === 'rp') {
        this.G.rp = Math.min(999, this.G.rp + 100);
        this.talk('Você achou 100 rupias!');
      } else if (c === 'pocao') {
        this.V.pot += 2;
        this.talk('Você achou 2 poções! Use pelo menu ou botão X.');
      } else if (c === 'bomba_kit') {
        this.V.bombs = Math.min(99, this.V.bombs + 5);
        this.G.rp = Math.min(999, this.G.rp + 30);
        this.V.secondary = 'bomba';
        this.talk('Você achou 5 BOMBAS e 30 rupias! Use com X para explodir pedras rachadas!');
      } else if (c === 'escudo_tesouro') {
        if (!this.V.ownedShields.includes('madeira')) {
          this.V.ownedShields.push('madeira');
          this.V.shield = 'madeira';
          this.talk('Você achou o ESCUDO DE MADEIRA! Segure B para bloquear ataques.');
        } else {
          this.G.rp = Math.min(999, this.G.rp + 60);
          this.talk('Você achou um tesouro de 60 rupias!');
        }
      } else {
        this.V.it[c] = 1;
        this.talk(`Você achou: ${c.toUpperCase()}! Talvez alguém precise disso...`);
      }
    } else {
      // Bonus vault secondary chests
      this.G.rp = Math.min(999, this.G.rp + 35);
      this.V.bombs = Math.min(99, this.V.bombs + 2);
      this.V.arrows = Math.min(99, this.V.arrows + 5);
      this.V.torches = Math.min(99, this.V.torches + 1);
      this.talk('Tesouro secreto! +35 rupias, +2 bombas, +5 flechas e +1 tocha!');
    }
    saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
  }

  private tryOpenGate(a: number, b: number): void {
    if ((this.V.it.fragmento | 0) >= 3) {
      this.world.maps[this.G.map][b][a] = 'D';
      this.world.doors[this.G.map].push({ x: a, y: b, to: 260, px: 112, py: 112 });
      this.talk('Os 3 fragmentos brilham... o portão se abre!');
      this.audio.bp(300, 0.6);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
    } else {
      this.talk(`O portão está selado. Fragmentos: ${this.V.it.fragmento | 0}/3`);
    }
  }

  private damageEnemy(e: Enemy, dmg: number, knockDx = 0, knockDy = 0): void {
    e.hp -= dmg;
    e.hitFlash = 8;
    this.audio.playSwordHit();
    const ex = e.k === 4 ? e.x + 16 : e.x + 8;
    const ey = e.k === 4 ? e.y + 16 : e.y + 8;
    const cols = this.getSwordEffectColors();

    // Subtle shockwave ring + crisp slash cross + compact spark burst
    this.particles.push({
      x: ex,
      y: ey,
      vx: 0,
      vy: 0,
      l: 9,
      maxL: 9,
      c: cols.glow,
      glow: false,
      size: e.k === 4 ? 13 : 9,
      kind: 'ring',
    });
    this.particles.push({
      x: ex,
      y: ey,
      vx: 0,
      vy: 0,
      l: 7,
      maxL: 7,
      c: '#ffffff',
      glow: false,
      size: e.k === 4 ? 9 : 6,
      kind: 'slash',
      ang: (Math.random() - 0.5) * 1.1,
    });
    this.burst(ex, ey, '#ffe98a', false, 5);
    this.burst(ex, ey, cols.secondary, false, 3);

    if ((knockDx || knockDy) && this.free(e.x + knockDx + 2, e.y + knockDy + 6, 12, 8, true)) {
      e.x += knockDx;
      e.y += knockDy;
    }
    if (e.hp <= 0) {
      this.burst(ex, ey, '#ffffff', true, 7);
      this.G.it.push({ x: e.x + 4, y: e.y + 4, val: e.k >= 3 ? 5 : 1 });
    }
  }

  private slash(swFrame: number): void {
    const d = this.G.dir;
    const baseAng = d === 0 ? -Math.PI / 2 : d === 1 ? 0 : d === 2 ? Math.PI / 2 : Math.PI;
    const sweepOffset = swFrame === 12 ? -0.65 : swFrame === 8 ? 0.65 : 0;
    const ang = baseAng + sweepOffset;

    const px = this.G.x + 8 + DX[d] * 17;
    const py = this.G.y + 10 + DY[d] * 17;
    const sx = this.G.x + 8 + Math.cos(ang) * 17;
    const sy = this.G.y + 8 + Math.sin(ang) * 17;

    // Cut bushes across the sweeping arc
    let hitAnything = false;
    for (const [cx, cy] of [
      [px, py],
      [sx, sy],
    ]) {
      const a = cx >> 4;
      const b = cy >> 4;
      const row = this.world.maps[this.G.map]?.[b];
      const tile = row && row[a];
      if (tile === 'b') {
        row[a] = '.';
        hitAnything = true;
        this.audio.bp(520, 0.08);
        for (let i = 0; i < 7; i++) {
          this.particles.push({
            x: a * 16 + 4 + Math.random() * 8,
            y: b * 16 + 4 + Math.random() * 8,
            vx: (Math.random() - 0.5) * 2.2,
            vy: -0.9 - Math.random() * 1.4,
            l: 18 + rnd(10),
            maxL: 28,
            c: i % 2 === 0 ? '#6fe58a' : '#2fa84a',
            size: 2,
            kind: 'leaf',
          });
        }
        if (Math.random() < 0.65) {
          this.G.it.push({ x: a * 16 + 4, y: b * 16 + 4, val: Math.random() < 0.2 ? 5 : 1 });
        }
        if (Math.random() < 0.3) {
          this.V.it.cogumelo = (this.V.it.cogumelo | 0) + 1;
          this.V.msg = '+1 COGUMELO';
          this.V.mt = 90;
        }
      }
    }

    // Strike enemies across front & sweeping points (max once per swing)
    for (const e of this.G.en) {
      if (this.swingHitEnemies.has(e)) continue;
      const hitRadius = e.k === 4 ? 25 : 17;
      const ex = e.k === 4 ? e.x + 16 : e.x + 8;
      const ey = e.k === 4 ? e.y + 16 : e.y + 8;
      const hitFront = Math.abs(ex - px) < hitRadius && Math.abs(ey - py) < hitRadius;
      const hitSweep = Math.abs(ex - sx) < hitRadius && Math.abs(ey - sy) < hitRadius;
      if (hitFront || hitSweep) {
        this.swingHitEnemies.add(e);
        this.damageEnemy(e, this.V.dmg, DX[d] * 11, DY[d] * 11);
        // Stronger tactile screen shake on powerful monsters (Boss, Golem, Skeleton, Dark Mage)
        if (e.k === 4) {
          this.shakeFrames = 10;
          this.shakeMag = 2.4;
        } else if (e.k === 5) {
          this.shakeFrames = 8;
          this.shakeMag = 1.9;
        } else if (e.k === 3 || e.k === 6) {
          this.shakeFrames = 6;
          this.shakeMag = 1.4;
        } else if (e.hp <= 0) {
          this.shakeFrames = 3;
          this.shakeMag = 1.0;
        }
        hitAnything = true;
      }
    }
    this.G.en = this.G.en.filter((e) => e.hp > 0);

    // Deflect enemy magic orbs with the sword!
    for (const p of this.projectiles) {
      if (p.kind === 'orb' && p.fromEnemy) {
        const dFront = Math.hypot(p.x - px, p.y - py);
        const dSweep = Math.hypot(p.x - sx, p.y - sy);
        if (dFront < 18 || dSweep < 18) {
          p.fromEnemy = false;
          p.vx = DX[d] * 2.6 + (Math.random() - 0.5) * 0.25;
          p.vy = DY[d] * 2.6 + (Math.random() - 0.5) * 0.25;
          p.life = 55;
          this.audio.playClang();
          this.particles.push({
            x: p.x,
            y: p.y,
            vx: 0,
            vy: 0,
            l: 10,
            maxL: 10,
            c: '#8ce8ff',
            glow: true,
            size: 12,
            kind: 'ring',
          });
          this.burst(p.x, p.y, '#9ed8ff', true, 7);
          this.shakeFrames = 3;
          hitAnything = true;
        }
      }
    }

    // Metallic clang sparks when hitting solid stone/wall on center frame
    if (!hitAnything && swFrame === 10 && !this.swingHitClanged && this.swingHitEnemies.size === 0) {
      const ca = px >> 4;
      const cb = py >> 4;
      const wallTile = this.world.maps[this.G.map]?.[cb]?.[ca];
      if (wallTile === '#' || wallTile === 'm' || wallTile === 'R' || wallTile === 'G' || wallTile === 'S') {
        this.swingHitClanged = true;
        this.audio.playClang();
        this.burst(px - DX[d] * 3, py - DY[d] * 3, '#ffe98a', true, 5);
      }
    }
  }

  private useSecondaryTool(): void {
    const tool = this.V.secondary;
    if (tool === 'arco') {
      if (this.V.arrows <= 0) {
        this.V.msg = 'SEM FLECHAS!';
        this.V.mt = 65;
        this.audio.bp(180, 0.06);
        return;
      }
      this.V.arrows--;
      const d = this.G.dir;
      this.projectiles.push({
        x: this.G.x + 8 + DX[d] * 8,
        y: this.G.y + 8 + DY[d] * 8,
        vx: DX[d] * 3.1,
        vy: DY[d] * 3.1,
        kind: 'arrow',
        life: 60,
      });
      this.audio.bp(760, 0.06, 'triangle');
    } else if (tool === 'bomba') {
      if (this.V.bombs <= 0) {
        this.V.msg = 'SEM BOMBAS!';
        this.V.mt = 65;
        this.audio.bp(180, 0.06);
        return;
      }
      this.V.bombs--;
      const d = this.G.dir;
      this.projectiles.push({
        x: this.G.x + 8 + DX[d] * 10,
        y: this.G.y + 10 + DY[d] * 10,
        vx: 0,
        vy: 0,
        kind: 'bomb',
        life: 70,
      });
      this.audio.bp(280, 0.08);
    } else if (tool === 'tocha') {
      this.toggleTorch();
    } else if (tool === 'pocao') {
      if (this.V.pot > 0 && this.G.hp < this.V.mh * 2) {
        this.V.pot--;
        this.G.hp = this.V.mh * 2;
        this.audio.bp(1200, 0.3);
        this.V.msg = 'POCAO USADA!';
        this.V.mt = 75;
      } else {
        this.audio.bp(180, 0.05);
      }
    }
  }

  private toggleTorch(): void {
    if (this.V.torchLit) {
      this.V.torchLit = false;
      this.V.msg = 'TOCHA APAGADA';
      this.V.mt = 60;
      this.audio.bp(300, 0.06);
      return;
    }
    if (this.V.torches <= 0) {
      this.V.msg = 'SEM TOCHAS! COMPRE NA VILA';
      this.V.mt = 80;
      this.audio.bp(180, 0.06);
      return;
    }
    this.V.torches--;
    this.V.torchLit = true;
    this.torchFuel = 2400; // 40 seconds of blazing cave/night light per torch
    this.V.msg = 'TOCHA ACESA!';
    this.V.mt = 65;
    this.burst(this.G.x + 8, this.G.y + 6, '#ffaa3a', true, 8);
    this.audio.bp(680, 0.1);
  }

  private detonateBomb(bx: number, by: number): void {
    this.audio.playThunder(0.95);
    this.burst(bx, by, '#ff9a3a', true, 18);
    this.burst(bx, by, '#ffe98a', true, 12);

    // Destroy cracked boulders ('R') & bushes ('b') in blast radius
    const map = this.world.maps[this.G.map];
    if (map) {
      const ca = Math.floor(bx / 16);
      const cb = Math.floor(by / 16);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const row = map[cb + dy];
          if (!row) continue;
          const tile = row[ca + dx];
          if (tile === 'R') {
            row[ca + dx] = 'c';
            this.burst((ca + dx) * 16 + 8, (cb + dy) * 16 + 8, '#a4a2be', false, 10);
          } else if (tile === 'b') {
            row[ca + dx] = '.';
          }
        }
      }
    }

    // Blast nearby enemies
    for (const e of this.G.en) {
      const ex = e.k === 4 ? e.x + 16 : e.x + 8;
      const ey = e.k === 4 ? e.y + 16 : e.y + 8;
      if (Math.hypot(ex - bx, ey - by) < 34) {
        this.damageEnemy(e, 3);
      }
    }
    this.G.en = this.G.en.filter((e) => e.hp > 0);
  }

  private stepProjectiles(): void {
    const map = this.world.maps[this.G.map];
    const next: Projectile[] = [];

    for (const p of this.projectiles) {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;

      if (p.kind === 'bomb') {
        if (p.life <= 0) {
          this.detonateBomb(p.x, p.y);
          continue;
        }
        next.push(p);
        continue;
      }

      if (p.x < 0 || p.x >= W || p.y < 0 || p.y >= H || p.life <= 0) continue;

      const tile = map?.[p.y >> 4]?.[p.x >> 4];
      if (tile && SOLID_TILES.has(tile) && tile !== '~') {
        this.burst(p.x, p.y, p.kind === 'orb' ? '#ff6ad8' : '#e8f4ff', p.kind === 'orb', 5);
        continue;
      }

      if (p.kind === 'arrow') {
        let hit = false;
        for (const e of this.G.en) {
          const hr = e.k === 4 ? 16 : 9;
          const ex = e.k === 4 ? e.x + 16 : e.x + 8;
          const ey = e.k === 4 ? e.y + 16 : e.y + 8;
          if (Math.abs(ex - p.x) < hr && Math.abs(ey - p.y) < hr) {
            this.damageEnemy(e, 2, p.vx * 2, p.vy * 2);
            hit = true;
            break;
          }
        }
        if (hit) {
          this.G.en = this.G.en.filter((e) => e.hp > 0);
          continue;
        }
      } else if (p.kind === 'orb') {
        if (!p.fromEnemy) {
          // Deflected orb strikes enemies!
          let hit = false;
          for (const e of this.G.en) {
            const hr = e.k === 4 ? 18 : 11;
            const ex = e.k === 4 ? e.x + 16 : e.x + 8;
            const ey = e.k === 4 ? e.y + 16 : e.y + 8;
            if (Math.abs(ex - p.x) < hr && Math.abs(ey - p.y) < hr) {
              this.damageEnemy(e, Math.max(2, this.V.dmg), p.vx * 3, p.vy * 3);
              hit = true;
              break;
            }
          }
          if (hit) {
            this.G.en = this.G.en.filter((e) => e.hp > 0);
            continue;
          }
        } else if (Math.abs(this.G.x + 8 - p.x) < 10 && Math.abs(this.G.y + 8 - p.y) < 10) {
          // Enemy magic orb vs Hero (can be blocked/reflected by Shield!)
          if (this.G.shielding && this.V.shield !== 'none') {
            this.audio.bp(960, 0.08, 'triangle');
            this.burst(p.x, p.y, '#9ed8ff', true, 6);
            if (this.V.shield === 'espelhado' || this.V.shield === 'real') {
              p.vx = -p.vx * 1.2;
              p.vy = -p.vy * 1.2;
              p.fromEnemy = false; // Reflected back at enemies!
              p.life = 45;
              next.push(p);
            }
            continue;
          } else if (this.G.inv <= 0) {
            this.G.hp--;
            this.G.inv = 65;
            this.audio.bp(120, 0.2, 'sawtooth');
            this.burst(p.x, p.y, '#ff4a8a', true, 8);
            if (this.G.hp <= 0) {
              this.st = 'over';
              this.audio.bp(100, 0.5);
              return;
            }
            continue;
          }
        }
      }

      next.push(p);
    }

    this.projectiles = next;
  }

  private stepGame(): void {
    if (this.V.mt > 0) this.V.mt--;

    if (this.G.dlg) {
      this.G.shielding = false;
      if (this.pressed.a || this.pressed.s || this.pressed.b) {
        this.G.dlg.i++;
        this.audio.bp(700, 0.04);
        if (this.G.dlg.i >= this.G.dlg.p.length) {
          this.G.dlg = null;
          if (this.V.fl.win && !this.victoryShown) {
            this.victoryShown = true;
            this.victorySel = 0;
            this.st = 'victory';
          }
        }
      }
      return;
    }

    if (this.G.sleeping) {
      const wt = this.G.wakeTimer ?? 0;
      if (wt === 0) {
        // Wait in bed until the opening text finishes and player presses ANY button
        const anyButtonPressed =
          this.pressed.a ||
          this.pressed.b ||
          this.pressed.x ||
          this.pressed.s ||
          this.pressed.i ||
          this.pressed.u ||
          this.pressed.d ||
          this.pressed.l ||
          this.pressed.r ||
          Math.hypot(this.analog.x, this.analog.y) > 0.35 ||
          this.input.u ||
          this.input.d ||
          this.input.l ||
          this.input.r;
        if (anyButtonPressed) {
          this.startWakeAnimation();
        }
      } else {
        this.G.wakeTimer = wt - 1;
        if (this.G.wakeTimer === 25) {
          this.audio.bp(760, 0.08, 'triangle');
        }
        if (this.G.wakeTimer <= 25 && this.G.wakeTimer > 0) {
          const tJump = (25 - this.G.wakeTimer) / 25;
          this.G.x = 20 + (24 - 20) * tJump;
          this.G.y = 14 + (34 - 14) * tJump;
        }
        if (this.G.wakeTimer <= 0) {
          this.G.sleeping = false;
          this.G.wakeTimer = 0;
          this.G.x = 24;
          this.G.y = 34;
          this.G.dir = 2;
          this.fixPos();
          this.audio.bp(260, 0.06, 'triangle');
          this.burst(32, 46, '#f4e7c8', false, 5);
          this.V.msg = 'BOM DIA! BOA AVENTURA!';
          this.V.mt = 80;
        }
      }
      return;
    }

    // Advance Day / Dusk / Night / Dawn cycle & Torch fuel
    this.worldTime = (this.worldTime + 1) % DAY_CYCLE_FRAMES;
    if (this.V.torchLit) {
      this.torchFuel--;
      if (this.torchFuel <= 0) {
        this.V.torchLit = false;
        this.V.msg = 'A TOCHA SE APAGOU';
        this.V.mt = 80;
      }
    }

    if (!this.G.sw) {
      const row = this.world.maps[this.G.map]?.[(this.G.y + 12) >> 4];
      const ft = row && row[(this.G.x + 8) >> 4];
      if ((ft === 'D' || ft === 'E') && this.enterDoor()) return;
    }

    if (this.G.inv > 0) this.G.inv--;

    // Holding B raises equipped Shield (or drinks potion if no shield equipped)
    this.G.shielding = Boolean(this.input.b && this.V.shield !== 'none' && !this.G.sw);

    // Continuous 360-degree Analog + Digital movement!
    if (!this.G.sw) {
      let dx = this.analog.x;
      let dy = this.analog.y;
      const digX = (this.input.r ? 1 : 0) - (this.input.l ? 1 : 0);
      const digY = (this.input.d ? 1 : 0) - (this.input.u ? 1 : 0);
      if (digX || digY) {
        dx = digX;
        dy = digY;
        if (dx && dy) {
          dx *= 0.71;
          dy *= 0.71;
        }
      }

      if (Math.hypot(dx, dy) > 0.08) {
        if (Math.abs(dy) >= Math.abs(dx)) {
          this.G.dir = dy > 0 ? 2 : 0;
        } else {
          this.G.dir = dx < 0 ? 3 : 1;
        }
        this.G.wk++;
        const sp = this.G.shielding ? 0.95 : 1.35;
        if (dx && this.free(this.G.x + 3 + dx * sp, this.G.y + 8, 10, 7)) this.G.x += dx * sp;
        if (dy && this.free(this.G.x + 3, this.G.y + 8 + dy * sp, 10, 7)) this.G.y += dy * sp;
      }
    }

    if (this.pressed.i && !this.G.dlg && !this.G.sw) {
      this.invHeroDir = 2;
      this.st = 'inv';
      this.audio.bp(620, 0.05);
      return;
    }

    if (this.pressed.x && !this.G.sw) {
      this.useSecondaryTool();
    }

    if (this.pressed.a && !this.G.sw) {
      const fx = this.G.x + 8 + DX[this.G.dir] * 14;
      const fy = this.G.y + 10 + DY[this.G.dir] * 14;
      const a = fx >> 4;
      const b = fy >> 4;
      const row = this.world.maps[this.G.map]?.[b];
      const tile = row && row[a];
      const npcs = this.world.npcs[this.G.map] || [];
      let npc = npcs.find(
        (o) => Math.abs(o.x * 16 + 8 - fx) < 13 && Math.abs(o.y * 16 + 8 - fy) < 13,
      );
      if (!npc && (tile === 'z' || tile === 'Y')) {
        // Allow talking to merchants across a shop counter ('z') or market stall ('Y')
        const fx2 = fx + DX[this.G.dir] * 14;
        const fy2 = fy + DY[this.G.dir] * 14;
        npc = npcs.find(
          (o) => o.shopId && Math.abs(o.x * 16 + 8 - fx2) < 18 && Math.abs(o.y * 16 + 8 - fy2) < 18,
        );
      }

      if (npc) {
        this.audio.bp(700, 0.05);
        this.interactNpc(npc);
      } else if (tile === 'S' && !this.V.sword) {
        this.pullSword(a, b);
      } else if (tile === 'C') {
        row[a] = 'c';
        this.openChest(a, b);
      } else if (tile === 'G') {
        this.tryOpenGate(a, b);
      } else if (tile === 'y') {
        this.audio.bp(520, 0.08, 'triangle');
        this.talk(
          'Uma TV de tubo conectada ao seu videogame estilo PS2! A luz azul continua acesa... Melhor salvar Aurora antes de jogar!',
        );
      } else if (tile === 'q' && this.G.map === 451) {
        this.audio.bp(640, 0.05);
        this.talk(
          'Sua estante com livros antigos sobre a Lenda de Aurora, mapas do reino e os Três Fragmentos.',
        );
      } else if (tile === 'e') {
        this.G.hp = this.V.mh * 2;
        this.audio.bp(740, 0.1, 'triangle');
        this.talk('Sua cama macia! Você descansa por um instante e recupera toda a energia.');
      } else if (this.V.sword && this.V.equipped === 'sword') {
        this.G.sw = 14;
        this.swingHitEnemies.clear();
        this.swingHitClanged = false;
        this.audio.playSwordSwing(this.V.swordTier);
        this.emitSwordArcSparks(13);
      } else if (this.V.sword) {
        this.audio.bp(220, 0.05);
        this.V.msg = 'EQUIPE A ESPADA (INV)';
        this.V.mt = 75;
      } else {
        this.audio.bp(180, 0.05);
      }
    }

    if (this.pressed.b && this.V.shield === 'none' && this.V.pot > 0 && this.G.hp < this.V.mh * 2) {
      this.V.pot--;
      this.G.hp = this.V.mh * 2;
      this.audio.bp(1200, 0.3);
      this.V.msg = 'POCAO USADA!';
      this.V.mt = 75;
    }

    if (this.G.sw) {
      this.G.sw--;
      if (this.G.sw === 12 || this.G.sw === 10 || this.G.sw === 8) {
        this.slash(this.G.sw);
      }
      if (this.G.sw === 11 || this.G.sw === 9) {
        this.emitSwordArcSparks(this.G.sw);
      }
    }

    // Screen transitions
    let dir: 'l' | 'r' | 'u' | 'd' | null = null;
    if (this.G.x < -3) dir = 'l';
    else if (this.G.x > 227) dir = 'r';
    else if (this.G.y < -8) dir = 'u';
    else if (this.G.y > 145) dir = 'd';

    if (dir) {
      const next = this.world.neighbors[this.G.map]?.[dir];
      if (next == null) {
        this.G.x = Math.max(-3, Math.min(227, this.G.x));
        this.G.y = Math.max(-8, Math.min(145, this.G.y));
      } else {
        this.G.map = next;
        this.markExplored(next);
        if (dir === 'l') this.G.x = 227;
        else if (dir === 'r') this.G.x = -3;
        else if (dir === 'u') this.G.y = 144;
        else this.G.y = -8;
        this.spawn();
        if (next === 35 || next === 36 || next === 51 || next === 4) {
          this.V.msg = mapDisplayName(next);
          this.V.mt = 90;
        }
      }
    }

    if (!this.G.dlg && !this.G.sw) {
      const r2 = this.world.maps[this.G.map]?.[(this.G.y + 12) >> 4];
      const f2 = r2 && r2[(this.G.x + 8) >> 4];
      if ((f2 === 'D' || f2 === 'E') && this.enterDoor()) return;
    }

    this.stepProjectiles();
    if (this.st !== 'game') return;

    // Enemies AI & ranged spells
    const { isNight } = getCycleInfo(this.worldTime);
    const nightBoost = isNight && this.G.map < 100 ? 1.18 : 1.0;

    for (const e of this.G.en) {
      if (e.hitFlash && e.hitFlash > 0) e.hitFlash--;
      if (--e.t <= 0) {
        e.t = e.k === 1 ? 18 + rnd(20) : 30 + rnd(40);
        const spd = (e.k === 4 ? 0.75 : e.k === 1 ? 0.92 : e.k === 5 ? 0.44 : 0.62) * nightBoost;
        const a = Math.random() < 0.55 ? Math.atan2(this.G.y - e.y, this.G.x - e.x) : Math.random() * 6.28;
        e.dx = Math.cos(a) * spd;
        e.dy = Math.sin(a) * spd;
      }
      if (this.free(e.x + e.dx + 2, e.y + 6, 12, 8, true)) e.x += e.dx;
      if (this.free(e.x + 2, e.y + e.dy + 6, 12, 8, true)) e.y += e.dy;

      // Dark Mages (6) & Vorak Boss (4) fire dark magic orbs
      if ((e.k === 6 || e.k === 4) && e.cd !== undefined && --e.cd <= 0) {
        e.cd = e.k === 4 ? 75 + rnd(35) : 105 + rnd(45);
        const ex = e.k === 4 ? e.x + 16 : e.x + 8;
        const ey = e.k === 4 ? e.y + 16 : e.y + 8;
        const ang = Math.atan2(this.G.y + 8 - ey, this.G.x + 8 - ex);
        this.projectiles.push({
          x: ex,
          y: ey,
          vx: Math.cos(ang) * 1.55,
          vy: Math.sin(ang) * 1.55,
          kind: 'orb',
          life: 130,
          fromEnemy: true,
        });
        this.audio.bp(380, 0.06, 'triangle');
      }

      const hitX = e.k === 4 ? 18 : 10;
      const hitY = e.k === 4 ? 16 : 9;
      if (this.G.inv <= 0 && Math.abs(e.x - this.G.x) < hitX && Math.abs(e.y - this.G.y) < hitY) {
        const blocked = this.G.shielding && this.V.shield !== 'none';
        const blockRate =
          this.V.shield === 'real' || this.V.shield === 'espelhado'
            ? 1
            : this.V.shield === 'ferro'
              ? 0.88
              : 0.65;
        if (blocked && Math.random() < blockRate) {
          this.G.inv = 28;
          this.audio.bp(760, 0.06);
          this.burst(this.G.x + 8, this.G.y + 8, '#9ed8ff', false, 4);
        } else {
          this.G.hp -= e.k === 5 || e.k === 4 ? 2 : 1;
          this.G.inv = 70;
          this.audio.bp(120, 0.2, 'sawtooth');
        }
        const a = Math.atan2(this.G.y - e.y, this.G.x - e.x);
        const kx = Math.cos(a) * 12;
        const ky = Math.sin(a) * 12;
        if (this.free(this.G.x + 3 + kx, this.G.y + 8 + ky, 10, 7)) {
          this.G.x += kx;
          this.G.y += ky;
        }
        if (this.G.hp <= 0) {
          this.st = 'over';
          this.audio.bp(100, 0.5);
          return;
        }
      }
    }

    // Rupee pickups
    this.G.it = this.G.it.filter((i) => {
      if (Math.abs(i.x - this.G.x - 4) < 10 && Math.abs(i.y - this.G.y - 4) < 10) {
        this.G.rp = Math.min(999, this.G.rp + (i.val || 1));
        this.audio.bp(1000, 0.05);
        return false;
      }
      return true;
    });

    // Boss clear / Crystal fragment reward
    const f = 'b' + this.G.map;
    const enMeta = this.world.enemies[this.G.map];
    if (enMeta && enMeta[1] === 4 && !this.V.fl[f] && !this.G.en.length && !this.G.dlg) {
      this.V.fl[f] = 1;
      if (this.G.map === 261) {
        this.V.fl.win = 1;
        this.talk(
          'Vorak foi derrotado e o Cristal de Luz brilha de novo! O reino de Aurora está salvo!',
        );
      } else {
        this.V.it.fragmento = (this.V.it.fragmento | 0) + 1;
        this.G.hp = this.V.mh * 2;
        this.talk(`Você obteve um fragmento do cristal! (${this.V.it.fragmento}/3)`);
      }
      this.audio.bp(1200, 0.5);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
    }

    // Save on room changes or periodic timer
    if (this.G.map !== this.lastMapSaved) {
      this.lastMapSaved = this.G.map;
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
    } else if (this.t % 900 === 0) {
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
    }

    // Anti-stuck safeguard
    if (!this.free(this.G.x + 3, this.G.y + 8, 10, 7)) {
      if (++this.stuckFrames > 20) {
        this.fixPos();
        this.stuckFrames = 0;
      }
    } else {
      this.stuckFrames = 0;
    }
  }

  private stepMinigame(): void {
    this.syncAnalogToMenuPressed();
    const m = this.mg;
    if (!m) return;
    if (m.end) {
      if (this.pressed.a || this.pressed.s) {
        this.G.rp = Math.min(999, this.G.rp + m.sc);
        if (m.from === 'game') {
          this.G.x = (m.id === 1 ? 3 : 11) * 16;
          this.G.y = 80;
          this.st = 'game';
        } else {
          this.st = 'mgmenu';
        }
      }
      return;
    }

    if (--m.t <= 0) {
      m.end = 1;
      this.audio.bp(660, 0.3);
    }

    if (m.id === 1) {
      if (this.pressed.l) m.cx = (m.cx + 2) % 3;
      if (this.pressed.r) m.cx = (m.cx + 1) % 3;
      if (this.pressed.u) m.cy = (m.cy + 2) % 3;
      if (this.pressed.d) m.cy = (m.cy + 1) % 3;
      if (Math.random() < 0.05 + m.sc * 0.001) {
        const i = rnd(9);
        if (!m.pop[i]) m.pop[i] = 60;
      }
      m.pop = m.pop.map((p) => (p > 0 ? p - 1 : 0));
      if (this.pressed.a) {
        const i = m.cy * 3 + m.cx;
        m.sw = 8;
        if (m.pop[i] > 0) {
          m.pop[i] = 0;
          m.sc++;
          this.audio.bp(700, 0.06);
        } else {
          this.audio.bp(150, 0.05);
        }
      }
      if (m.sw > 0) m.sw--;
    } else {
      const mx = Math.abs(this.analog.x) > 0.1 ? this.analog.x : (this.input.r ? 1 : 0) - (this.input.l ? 1 : 0);
      m.bx = Math.max(0, Math.min(W - 24, m.bx + mx * 2.8));
      if (Math.random() < 0.05) {
        m.it.push({ x: rnd(W - 12), y: -8, k: Math.random() < 0.2 ? 1 : Math.random() < 0.2 ? 2 : 0 });
      }
      m.it = m.it.filter((i) => {
        i.y += 1.7;
        if (i.y > H - 26 && i.y < H - 14 && i.x + 8 > m.bx && i.x < m.bx + 24) {
          if (i.k === 1) {
            m.sc = Math.max(0, m.sc - 3);
            this.audio.bp(110, 0.2, 'sawtooth');
          } else {
            m.sc += i.k === 2 ? 3 : 1;
            this.audio.bp(1000, 0.05);
          }
          return false;
        }
        return i.y < H;
      });
    }
  }

  private activateInventorySlot(): void {
    if (this.invSel === 0) {
      if (!this.V.sword || this.V.ownedSwords.length === 0) {
        this.audio.bp(180, 0.06);
        return;
      }
      if (this.V.equipped === 'none') {
        this.V.equipped = 'sword';
      } else {
        const idx = this.V.ownedSwords.indexOf(this.V.swordTier);
        if (this.V.ownedSwords.length > 1) {
          const nextIdx = (idx + 1) % this.V.ownedSwords.length;
          if (nextIdx === 0) {
            this.V.equipped = 'none';
          } else {
            this.V.swordTier = this.V.ownedSwords[nextIdx];
            this.V.dmg = SWORD_STATS[this.V.swordTier].dmg;
          }
        } else {
          this.V.equipped = 'none';
        }
      }
      this.audio.bp(this.V.equipped === 'sword' ? 880 : 440, 0.07);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      return;
    }
    if (this.invSel === 1) {
      if (!this.V.ownedShields.length) {
        this.audio.bp(180, 0.06);
        return;
      }
      const idx = this.V.ownedShields.indexOf(this.V.shield);
      this.V.shield = this.V.ownedShields[(idx + 1) % this.V.ownedShields.length];
      this.audio.bp(760, 0.06);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      return;
    }
    if (this.invSel === 2) {
      const idx = this.V.ownedOutfits.indexOf(this.V.outfit);
      this.V.outfit = this.V.ownedOutfits[(idx + 1) % this.V.ownedOutfits.length];
      this.audio.bp(780, 0.06);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      return;
    }
    if (this.invSel === 3) {
      const idx = SECONDARY_ORDER.indexOf(this.V.secondary);
      this.V.secondary = SECONDARY_ORDER[(idx + 1) % SECONDARY_ORDER.length];
      this.audio.bp(680, 0.05);
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      return;
    }
    if (this.invSel === 4) {
      if (this.V.pot > 0 && this.G.hp < this.V.mh * 2) {
        this.V.pot--;
        this.G.hp = this.V.mh * 2;
        this.audio.bp(1200, 0.3);
        saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      } else {
        this.audio.bp(180, 0.05);
      }
      return;
    }
    if (this.invSel === 5) {
      this.toggleTorch();
      saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
      return;
    }
    this.audio.bp(540, 0.04);
  }

  private stepInventory(): void {
    this.syncAnalogToMenuPressed();
    if (this.pressed.i || this.pressed.b || this.pressed.s) {
      this.st = 'game';
      this.audio.bp(480, 0.05);
      return;
    }
    if (this.pressed.l) {
      this.invSel = (this.invSel + 7) % 8;
      this.audio.bp(500, 0.04);
    }
    if (this.pressed.r) {
      this.invSel = (this.invSel + 1) % 8;
      this.audio.bp(500, 0.04);
    }
    if (this.pressed.u || this.pressed.d) {
      this.invSel = (this.invSel + 4) % 8;
      this.audio.bp(500, 0.04);
    }
    if (this.pressed.x) {
      this.invHeroDir = (this.invHeroDir + 1) % 4;
      this.audio.bp(640, 0.04);
    }
    if (this.pressed.a) {
      this.activateInventorySlot();
    }
  }

  private buyShopItem(): void {
    const shop = SHOPS[this.shopId];
    const it = shop.items[this.shopSel];
    if (!it) return;

    // Already owned permanent gear: equip immediately
    if (it.kind === 'sword' && this.V.ownedSwords.includes(it.tier as SwordTier)) {
      this.V.swordTier = it.tier as SwordTier;
      this.V.dmg = SWORD_STATS[this.V.swordTier].dmg;
      this.V.sword = 1;
      this.V.equipped = 'sword';
      this.V.msg = `${it.name} EQUIPADA!`;
      this.V.mt = 75;
      this.audio.bp(760, 0.06);
      return;
    }
    if (it.kind === 'shield' && this.V.ownedShields.includes(it.tier as ShieldTier)) {
      this.V.shield = it.tier as ShieldTier;
      this.V.msg = `${it.name} EQUIPADO!`;
      this.V.mt = 75;
      this.audio.bp(760, 0.06);
      return;
    }
    if (it.kind === 'outfit' && this.V.ownedOutfits.includes(it.tier as OutfitId)) {
      this.V.outfit = it.tier as OutfitId;
      this.V.msg = `${it.name} VESTIDA!`;
      this.V.mt = 75;
      this.audio.bp(760, 0.06);
      return;
    }

    if (this.G.rp < it.price) {
      this.audio.bp(160, 0.14, 'sawtooth');
      this.V.msg = 'RUPIAS INSUFICIENTES';
      this.V.mt = 70;
      return;
    }

    this.G.rp -= it.price;
    this.audio.bp(1020, 0.18);

    if (it.kind === 'pot') {
      this.V.pot += it.amount || 1;
    } else if (it.kind === 'arrows') {
      this.V.arrows = Math.min(99, this.V.arrows + (it.amount || 15));
      this.V.secondary = 'arco';
    } else if (it.kind === 'bombs') {
      this.V.bombs = Math.min(99, this.V.bombs + (it.amount || 5));
      this.V.secondary = 'bomba';
    } else if (it.kind === 'torch') {
      this.V.torches = Math.min(99, this.V.torches + (it.amount || 3));
      this.V.secondary = 'tocha';
    } else if (it.kind === 'sword') {
      const tier = it.tier as SwordTier;
      this.V.ownedSwords.push(tier);
      this.V.swordTier = tier;
      this.V.dmg = Math.max(this.V.dmg, SWORD_STATS[tier].dmg);
      this.V.sword = 1;
      this.V.equipped = 'sword';
    } else if (it.kind === 'shield') {
      const tier = it.tier as ShieldTier;
      this.V.ownedShields.push(tier);
      this.V.shield = tier;
    } else if (it.kind === 'outfit') {
      const tier = it.tier as OutfitId;
      this.V.ownedOutfits.push(tier);
      this.V.outfit = tier;
    }

    this.V.msg = `COMPROU: ${it.name}`;
    this.V.mt = 85;
    saveGame(this.hn, this.G, this.V, this.world, this.worldTime);
  }

  private stepShop(): void {
    this.syncAnalogToMenuPressed();
    if (this.V.mt > 0) this.V.mt--;
    const count = SHOPS[this.shopId].items.length;
    if (this.pressed.b || this.pressed.s || this.pressed.i) {
      this.st = 'game';
      this.audio.bp(480, 0.05);
      return;
    }
    if (this.pressed.u) {
      this.shopSel = (this.shopSel + count - 1) % count;
      this.audio.bp(500, 0.04);
    }
    if (this.pressed.d) {
      this.shopSel = (this.shopSel + 1) % count;
      this.audio.bp(500, 0.04);
    }
    if (this.pressed.a) {
      this.buyShopItem();
    }
  }

  private wantedTrack(): TrackName {
    if (this.st === 'intro') {
      return this.introPhase === 'rise' ? 'menu' : '';
    }
    if (this.st === 'mg') return 'mini';
    if (this.st === 'story') return 'story';
    if (this.st === 'game' || this.st === 'inv' || this.st === 'shop') {
      const m = this.G.map;
      if (isHouse(m) || m === 35 || m === 36) return 'calm';
      if (m >= 200) {
        return this.world.enemies[m] && this.world.enemies[m][1] === 4 && !this.V.fl['b' + m]
          ? 'boss'
          : 'cave';
      }
      if (m < 8 && m >= 3 && m <= 5) return 'cave';
      const x = m & 7;
      const y = m >> 3;
      return lake(x, y) || bio(x, y) === 'n' ? 'calm' : 'field';
    }
    if (this.st === 'over') return '';
    return 'menu';
  }

  private step(): void {
    this.t++;
    if (this.pressed.m) this.audio.toggleMute();
    if (this.noSaveTimer > 0) this.noSaveTimer--;

    const weatherMode: 'story' | 'overworld' | 'none' =
      this.st === 'story'
        ? 'story'
        : (this.st === 'game' || this.st === 'inv' || this.st === 'shop') && this.G.map < 100 && !this.V.sword
          ? 'overworld'
          : 'none';

    stepWeather(this.weather, weatherMode, (intensity) => {
      this.audio.playThunder(intensity);
    });

    this.audio.setRainAmbience(weatherMode === 'story' ? 0.045 : weatherMode === 'overworld' ? 0.032 : 0);

    this.audio.tickMusic(this.wantedTrack());
    if (
      this.st === 'game' &&
      !isHouse(this.G.map) &&
      this.G.map >= 200 &&
      this.t % 24 === 0 &&
      this.G.en.some((e) => Math.hypot(e.x - this.G.x, e.y - this.G.y) < 56)
    ) {
      this.audio.nt(94, 0.08, 'square', 0.02);
    }

    if (this.shakeFrames > 0) this.shakeFrames--;

    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.kind === 'leaf') {
        p.vx *= 0.94;
        p.vy += 0.045;
      } else if (p.kind !== 'ring' && p.kind !== 'slash') {
        p.vy += 0.07;
      }
      p.l--;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      if (this.particles[i].l <= 0) this.particles.splice(i, 1);
    }

    // Gentle floating dust motes inside hero's bedroom (map 451)
    if (this.G.map === 451) {
      for (const m of this.dust) {
        m.x += m.vx + Math.sin(this.t * 0.015 + m.phase) * 0.04;
        m.y += m.vy + Math.cos(this.t * 0.02 + m.phase) * 0.05;
        if (m.x < 10) m.x = W - 12;
        if (m.x > W - 10) m.x = 12;
        if (m.y < 10) m.y = H - 12;
        if (m.y > H - 10) m.y = 12;
      }
    }

    const ok = this.pressed.a || this.pressed.s;

    if (this.st === 'intro') {
      this.introTick++;
      if (ok) {
        this.advanceIntro();
        return;
      }
      if (this.introPhase === 'logo' && this.introTick >= INTRO_LOGO_FRAMES) {
        this.introPhase = 'fade';
        this.introTick = 0;
      } else if (this.introPhase === 'fade' && this.introTick >= INTRO_FADE_FRAMES) {
        this.introPhase = 'rise';
        this.introTick = 0;
      } else if (this.introPhase === 'rise' && this.introTick >= INTRO_RISE_FRAMES) {
        this.st = 'menu';
        this.menuSel = 0;
      }
      return;
    }

    if (this.st === 'menu') {
      this.syncAnalogToMenuPressed();
      if (this.pressed.u) {
        this.menuSel = (this.menuSel + 3) % 4;
        this.audio.bp(500, 0.04);
      }
      if (this.pressed.d) {
        this.menuSel = (this.menuSel + 1) % 4;
        this.audio.bp(500, 0.04);
      }
      if (ok) this.activateMenu();
      return;
    }

    if (this.st === 'mgmenu') {
      this.syncAnalogToMenuPressed();
      if (this.pressed.u) {
        this.mgSel = (this.mgSel + 2) % 3;
        this.audio.bp(500, 0.04);
      }
      if (this.pressed.d) {
        this.mgSel = (this.mgSel + 1) % 3;
        this.audio.bp(500, 0.04);
      }
      if (this.pressed.b) {
        this.st = 'menu';
        this.audio.bp(400, 0.05);
      }
      if (ok) this.activateMgMenu();
      return;
    }

    if (this.st === 'help') {
      if (ok || this.pressed.b) {
        this.st = 'menu';
        this.audio.bp(500, 0.05);
      }
      return;
    }

    if (this.st === 'name') {
      this.stepName();
      return;
    }

    if (this.st === 'story') {
      this.stepStory();
      return;
    }

    if (this.st === 'mg') {
      this.stepMinigame();
      return;
    }

    if (this.st === 'over') {
      if (ok) this.beginGameInsideHouse();
      return;
    }

    if (this.st === 'victory') {
      this.syncAnalogToMenuPressed();
      if (this.pressed.u || this.pressed.d) {
        this.victorySel = 1 - this.victorySel;
        this.audio.bp(500, 0.04);
      }
      if (ok) {
        this.audio.bp(800, 0.08);
        if (this.victorySel === 0) {
          this.st = 'game';
        } else {
          this.st = 'menu';
          this.menuSel = 0;
        }
      }
      return;
    }

    if (this.st === 'inv') {
      this.stepInventory();
      return;
    }

    if (this.st === 'shop') {
      this.stepShop();
      return;
    }

    this.stepGame();
  }

  private draw(): void {
    const g = this.ctx;
    const analogActive = Math.hypot(this.analog.x, this.analog.y) > 0.1;

    if (this.st === 'intro') {
      drawIntro(g, this.t, this.stars, this.introPhase, this.introTick);
    } else if (this.st === 'menu') {
      drawMenu(g, this.t, this.stars, this.menuSel, this.noSaveTimer);
    } else if (this.st === 'mgmenu') {
      drawMgMenu(g, this.t, this.stars, this.mgSel);
    } else if (this.st === 'help') {
      drawHelp(g, this.t, this.stars);
    } else if (this.st === 'name') {
      drawNameEntry(g, this.t, this.stars, this.nm, this.nc);
    } else if (this.st === 'story') {
      drawStory(g, this.t, this.stars, this.sc, this.pg, this.ch, this.tn, this.hn, this.weather);
    } else if (this.st === 'inv') {
      drawGame(
        g,
        this.world,
        this.G,
        this.V,
        this.hn,
        this.t,
        this.input,
        analogActive,
        this.particles,
        this.projectiles,
        this.weather,
        this.worldTime,
        this.dust,
      );
      g.fillStyle = 'rgba(6, 9, 18, 0.55)';
      g.fillRect(0, 0, W, H);
    } else if (this.st === 'shop') {
      drawGame(
        g,
        this.world,
        this.G,
        this.V,
        this.hn,
        this.t,
        this.input,
        analogActive,
        this.particles,
        this.projectiles,
        this.weather,
        this.worldTime,
        this.dust,
      );
      drawShop(g, this.shopId, this.shopSel, this.G, this.V);
    } else if (this.st === 'mg' && this.mg) {
      drawMinigame(g, this.mg);
    } else if (this.st === 'over') {
      drawGameOver(g, this.t);
    } else if (this.st === 'victory') {
      drawVictory(g, this.t, this.stars, this.hn, this.G, this.V, this.victorySel);
    } else {
      const amp = this.shakeFrames > 0 ? this.shakeMag * Math.min(1, this.shakeFrames / 8 + 0.25) : 0;
      const shx = this.shakeFrames > 0 ? Math.round(Math.sin(this.t * 2.9) * amp) : 0;
      const shy = this.shakeFrames > 0 ? Math.round(Math.cos(this.t * 3.5) * amp) : 0;
      g.save();
      if (shx || shy) g.translate(shx, shy);
      drawGame(
        g,
        this.world,
        this.G,
        this.V,
        this.hn,
        this.t,
        this.input,
        analogActive,
        this.particles,
        this.projectiles,
        this.weather,
        this.worldTime,
        this.dust,
      );
      g.restore();
    }
  }
}
