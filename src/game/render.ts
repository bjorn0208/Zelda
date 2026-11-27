import {
  DAY_CYCLE_FRAMES,
  DOMINIC_BEAM_COLORS,
  ENEMY_PALETTES,
  FONT,
  GAME_ZOOM,
  H,
  NAME_ROWS,
  OUTFIT_COLORS,
  SHIELD_STATS,
  SHOPS,
  STORY_INTERLUDE_AT,
  STORY_PAGES,
  SUBTITLE_FONT,
  SWORD_MAP,
  SWORD_STATS,
  SWORD_TILE,
  T,
  W,
  WALL_PALETTES,
} from './constants';
import {
  DustMote,
  Enemy,
  HeroState,
  IntroPhase,
  KeyCode,
  MinigameState,
  Npc,
  OutfitId,
  Particle,
  ProgressState,
  Projectile,
  ShopId,
  ShieldTier,
  SwordTier,
  WeatherState,
  WorldData,
} from './types';
import { bio, dungeonTheme, getEnemyMaxHp, hs, isHouse, p3 } from './world';
import {
  drawInvItem,
  drawWorldSword,
  INV_SLOT_COUNT,
  invItemStateFromProgress,
  invItemTag,
} from './items';

export type Star = [number, number, number];

/**
 * The hero's living room, bedroom, shops and starting village use reference
 * images as backdrops. The tile map still provides all collision, doors,
 * bed, stairs and chest logic.
 */
const HOUSE_IMAGE = '/rooms/hero_house.png';
const SHOP_IMAGE = '/rooms/shop_interior.png';
const START_IMAGE = '/rooms/start_village.png';
const CENTER_IMAGE = '/rooms/market_center.png';
const ROOM_IMAGES: Record<number, string> = {
  36: CENTER_IMAGE, // Centro do jogo: mercado com dez barracas interativas
  51: START_IMAGE, // Vila inicial: primeira tela ao sair da casa do pai
  135: SHOP_IMAGE, // Mercado Central
  136: SHOP_IMAGE, // Alfaiataria
  151: HOUSE_IMAGE,
  335: SHOP_IMAGE, // Forja Real
  451: '/rooms/hero_bedroom.png',
};

const roomImageCache = new Map<string, HTMLImageElement | null>();

function getRoomImage(src: string): HTMLImageElement | null {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return null;
  if (!roomImageCache.has(src)) {
    const img = new Image();
    img.src = src;
    roomImageCache.set(src, img);
  }
  const img = roomImageCache.get(src) ?? null;
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

function roomImageFor(map: number): string | null {
  if (ROOM_IMAGES[map]) return ROOM_IMAGES[map];
  // Todas as casas usam o mesmo interior da referência; 451 é o quarto e
  // 301 é a sala angelical (desenhada por tiles, não é uma casa).
  if (isHouse(map) && map !== 451 && map !== 301 && !ROOM_IMAGES[map]) return HOUSE_IMAGE;
  return null;
}

export interface GameCamera {
  zoom: number;
  x: number;
  y: number;
}

let gameCamera: GameCamera = { zoom: GAME_ZOOM, x: W / 2, y: H / 2 };
let cameraMapId = -1;

export function getGameCamera(): GameCamera {
  return { ...gameCamera };
}

/** Convert a 240x160 screen-space canvas point back into world coordinates. */
export function screenToWorld(sx: number, sy: number): { x: number; y: number } {
  return {
    x: (sx - W / 2) / gameCamera.zoom + gameCamera.x,
    y: (sy - H / 2) / gameCamera.zoom + gameCamera.y,
  };
}

function updateGameCamera(G: HeroState): GameCamera {
  const halfW = W / (2 * GAME_ZOOM);
  const halfH = H / (2 * GAME_ZOOM);
  const minX = halfW;
  const maxX = W - halfW;
  const minY = halfH;
  const maxY = H - halfH;
  const targetX = Math.max(minX, Math.min(maxX, G.x + 8));
  const targetY = Math.max(minY, Math.min(maxY, G.y + 8));

  if (cameraMapId !== G.map || !Number.isFinite(gameCamera.x) || !Number.isFinite(gameCamera.y)) {
    gameCamera.x = targetX;
    gameCamera.y = targetY;
    cameraMapId = G.map;
  } else {
    gameCamera.x += (targetX - gameCamera.x) * 0.2;
    gameCamera.y += (targetY - gameCamera.y) * 0.2;
  }
  gameCamera.zoom = GAME_ZOOM;
  return gameCamera;
}

// Cached offscreen lightmap canvas for smooth professional dynamic lighting
let lightCanvas: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;

function getLightLayer(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  if (typeof document === 'undefined') return null;
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas');
    lightCanvas.width = W;
    lightCanvas.height = H;
    lightCtx = lightCanvas.getContext('2d');
  }
  if (!lightCtx) return null;
  return { canvas: lightCanvas, ctx: lightCtx };
}

function R(g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = c;
  g.fillRect(x | 0, y | 0, w, h);
}

function Qr(g: CanvasRenderingContext2D, c: string, x: number, y: number, w: number, h: number): void {
  g.fillStyle = c;
  g.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function ln(
  g: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  c: string,
  w: number,
): void {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1) | 0;
  for (let i = 0; i <= n; i++) {
    Qr(g, c, x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, w, w);
  }
}

export function tx(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  c = '#fff',
  al: CanvasTextAlign = 'left',
  o = '#000',
): void {
  g.font = FONT;
  g.textAlign = al;
  g.textBaseline = 'top';
  g.fillStyle = o;
  for (const [a, b] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    g.fillText(s, x + a, y + b);
  }
  g.fillStyle = c;
  g.fillText(s, x, y);
}

type FrameStyle = 'gold' | 'crimson' | 'arcane';

const FRAME_COLORS: Record<FrameStyle, { rim: string; metal: string; ink: string; paper: string }> = {
  gold: { rim: '#4a2b0c', metal: '#e0a93a', ink: '#ffd84a', paper: '#f1dfae' },
  crimson: { rim: '#3d0810', metal: '#b64032', ink: '#ff9a72', paper: '#f0d6c2' },
  arcane: { rim: '#101a3a', metal: '#4d7bb8', ink: '#9ad8ff', paper: '#dde6f5' },
};

/** Moldura de pergaminho com cantos ornamentados, no lugar dos antigos GIFs. */
function drawMedievalFrame(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  style: FrameStyle,
): void {
  const c = FRAME_COLORS[style];
  R(g, '#0009', x - 2, y - 2, w + 4, h + 4);
  R(g, c.rim, x, y, w, h);
  R(g, c.metal, x + 2, y + 2, w - 4, h - 4);
  R(g, c.rim, x + 4, y + 4, w - 8, h - 8);
  R(g, c.paper, x + 6, y + 6, w - 12, h - 12);
  R(g, '#00000018', x + 6, y + h - 10, w - 12, 4);
  g.strokeStyle = c.rim;
  g.lineWidth = 1;
  g.strokeRect(x + 7.5, y + 7.5, w - 15, h - 15);
  for (const [cx, cy] of [
    [x + 3, y + 3],
    [x + w - 3, y + 3],
    [x + 3, y + h - 3],
    [x + w - 3, y + h - 3],
  ]) {
    R(g, c.ink, cx - 2, cy - 2, 4, 4);
    R(g, c.rim, cx - 1, cy - 1, 2, 2);
  }
  const my = y + (h >> 1);
  R(g, c.ink, x + 1, my - 6, 2, 12);
  R(g, c.ink, x + w - 3, my - 6, 2, 12);
  ln(g, x + w / 2 - 7, y + 3, x + w / 2, y + 1, c.ink, 1);
  ln(g, x + w / 2, y + 1, x + w / 2 + 7, y + 3, c.ink, 1);
  ln(g, x + w / 2 - 7, y + h - 3, x + w / 2, y + h - 1, c.ink, 1);
  ln(g, x + w / 2, y + h - 1, x + w / 2 + 7, y + h - 3, c.ink, 1);
  g.lineWidth = 1;
}

/** Texto centralizado dentro de uma moldura, com leve aumento. */
function framedLabel(
  g: CanvasRenderingContext2D,
  s: string,
  cx: number,
  cy: number,
  scale: number,
  color: string,
  outline: string,
): void {
  g.save();
  g.scale(scale, scale);
  tx(g, s, cx / scale, cy / scale - 4, color, 'center', outline);
  g.restore();
}

const mx = (a: number, b: number, k: number): number => a + (b - a) * k;
const mc = (a: readonly number[], b: readonly number[], k: number): string =>
  `rgb(${a.map((v, i) => (v + (b[i] - v) * k) | 0).join(',')})`;

function disc(g: CanvasRenderingContext2D, c: string, cx: number, cy: number, r: number): void {
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    R(g, c, cx - w, cy + dy, 2 * w + 1, 1);
  }
}

function pine(g: CanvasRenderingContext2D, x: number, y: number, h: number, c: string): void {
  const s = Math.max(3, (h / 4) | 0);
  R(g, c, x - 1, y - 3, 3, 3);
  for (let j = 0; j < 3; j++) {
    const w = 5 - j * 2 + (h > 12 ? 2 : 0);
    R(g, c, x - w, y - 3 - (j + 1) * s, w * 2 + 1, s + 1);
  }
}

function roof(g: CanvasRenderingContext2D, cx: number, top: number, hw: number, h: number, c: string): void {
  for (let j = 0; j < h; j++) {
    const w = Math.max(1, ((hw * (j + 1)) / h) | 0);
    R(g, c, cx - w, top + j, w * 2, 1);
  }
}

function rup(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  a = '#2ee06b',
  b = '#1fa04c',
): void {
  x |= 0;
  y |= 0;
  R(g, b, x + 3, y, 2, 9);
  R(g, a, x + 1, y + 2, 6, 5);
  R(g, '#fff8', x + 3, y + 2, 1, 3);
}

const HEART_SPRITE = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
function drawHeart(g: CanvasRenderingContext2D, c: string, x: number, y: number, maxCols = 9): void {
  HEART_SPRITE.forEach((r, j) => {
    for (let i = 0; i < r.length && i < maxCols; i++) {
      if (r[i] !== '.') R(g, c, x + i, y + j, 1, 1);
    }
  });
}

function floorHeart(g: CanvasRenderingContext2D, x: number, y: number): void {
  x |= 0;
  y |= 0;
  drawHeart(g, '#5a1020', x, y + 1, 7);
  drawHeart(g, '#ff4a5a', x, y, 7);
  R(g, '#ffd0d8', x + 2, y + 1, 1, 1);
  R(g, '#ffd0d8', x + 4, y + 1, 1, 1);
}

export function wrapText(s: string, maxLen = 27): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const word of s.split(' ')) {
    const candidate = (cur + ' ' + word).trim();
    if (candidate.length > maxLen && cur.length > 0) {
      lines.push(cur);
      cur = word;
    } else {
      cur = candidate;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export function getCycleInfo(_worldTime: number): {
  phase: number;
  nightFactor: number;
  duskFactor: number;
  isNight: boolean;
  label: string;
} {
  return {
    phase: 0.68,
    nightFactor: 1,
    duskFactor: 0,
    isNight: true,
    label: 'NOITE',
  };
}

function drawSwordArt(g: CanvasRenderingContext2D, oy: number): void {
  const y = oy | 0;
  for (let i = 0; i < 10; i++) {
    const w = 2 + 2 * i;
    R(g, '#aebfe6', 120 - w / 2, y + 6 + i, w, 1);
  }
  R(g, '#aebfe6', 110, y + 16, 20, 76);
  R(g, '#6f86b8', 110, y + 16, 2, 76);
  R(g, '#6f86b8', 128, y + 16, 2, 76);
  R(g, '#e8f0ff', 118, y + 8, 4, 84);
  R(g, '#b8860b', 84, y + 92, 72, 9);
  R(g, '#ffd84a', 84, y + 92, 72, 3);
  R(g, '#ffd84a', 84, y + 88, 8, 16);
  R(g, '#ffd84a', 148, y + 88, 8, 16);
  R(g, '#6b3f1d', 114, y + 101, 12, 24);
  for (let i = 0; i < 4; i++) R(g, '#4a2a10', 114, y + 105 + i * 6, 12, 2);
  R(g, '#ffd84a', 112, y + 125, 16, 7);
  R(g, '#e8383d', 118, y + 126, 4, 4);
}

export function drawKingdom(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  riseOffset = 0,
  skyReveal = 1,
): void {
  const oy = Math.round(riseOffset);

  for (let i = 0; i < 20; i++) {
    const k = i / 19;
    const duskTop = [16, 12, 52];
    const duskBot = [200, 90, 90];
    const nightTop = [6, 5, 20];
    const nightBot = [22, 16, 54];
    const r = mx(mx(nightTop[0], nightBot[0], k), mx(duskTop[0], duskBot[0], k), skyReveal) | 0;
    const gr = mx(mx(nightTop[1], nightBot[1], k), mx(duskTop[1], duskBot[1], k), skyReveal) | 0;
    const b = mx(mx(nightTop[2], nightBot[2], k), mx(duskTop[2], duskBot[2], k), skyReveal) | 0;
    R(g, `rgb(${r},${gr},${b})`, 0, i * 8, W, 9);
  }

  for (const s of stars) {
    if (s[1] < 78 && (((t / 20 + s[2]) | 0) % 3 !== 0)) {
      R(g, '#fff', s[0], s[1], 1, 1);
    }
  }

  const moonY = 36 + Math.round(oy * 0.35);
  disc(g, '#fff1c8', 205, moonY, 9);
  disc(g, '#e8d8a8', 202, moonY - 3, 2);

  for (let i = 0; i < 3; i++) {
    const x = ((((i * 100 + t * 0.15) % (W + 80)) + W + 80) % (W + 80)) - 40;
    const y = 48 + i * 12 + Math.round(oy * 0.45);
    R(g, '#8a5a9a', x, y, 30, 4);
    R(g, '#8a5a9a', x + 6, y - 3, 16, 3);
  }

  g.save();
  g.translate(0, oy);

  for (let x = 0; x < W; x += 4) {
    const h = 30 + Math.sin(x / 28) * 12 + Math.sin(x / 11) * 4;
    R(g, '#3e2c6e', x, (100 - h) | 0, 4, (h + 90) | 0);
  }

  const by = 92;
  for (let y = by; y < 175; y++) {
    const w = (24 + (y - by) * 1.7) | 0;
    R(g, '#5a5088', 120 - w, y, w, 1);
    R(g, '#2e2850', 120, y, w, 1);
    if (y % 7 === 0) {
      R(g, '#463f72', 120 - w + ((y * 13) % Math.max(1, w)), y, 6, 1);
      R(g, '#1e1a3a', 120 + ((y * 7) % Math.max(1, w)), y, 6, 1);
    }
  }
  for (let y = by; y < 175; y++) {
    const px = 120 + Math.sin((y - by) / 12) * Math.min(30, (y - by) * 0.4);
    R(g, '#c9a866', (px - 2) | 0, y, 4, 1);
  }

  R(g, '#9a96b8', 96, by - 14, 48, 14);
  R(g, '#c4c0e0', 96, by - 14, 48, 2);
  for (let x = 96; x < 144; x += 6) R(g, '#9a96b8', x, by - 17, 3, 3);

  for (const x of [88, 142]) {
    R(g, '#b0acd0', x, by - 24, 10, 24);
    R(g, '#e0dcf4', x, by - 24, 2, 24);
    roof(g, x + 5, by - 31, 7, 8, '#c0392b');
    R(g, '#ffd860', x + 4, by - 16, 2, 4);
  }

  R(g, '#b0acd0', 108, by - 34, 24, 34);
  R(g, '#e0dcf4', 108, by - 34, 2, 34);
  roof(g, 120, by - 47, 15, 13, '#2a5ac0');
  R(g, '#6b3f1d', 120, by - 60, 1, 14);
  for (let i = 0; i < 9; i++) {
    R(g, '#ff4a3a', 121 + i, (by - 60 + Math.sin(t / 5 + i * 0.8) * 1.5) | 0, 1, 4);
  }

  R(g, '#ffd860', 115, by - 28, 3, 5);
  R(g, '#ffd860', 123, by - 28, 3, 5);
  R(g, '#2a1a30', 116, by - 11, 8, 11);
  R(g, '#2a1a30', 117, by - 13, 6, 2);
  const fl = (t >> 2) & 1;
  R(g, '#ff9a3a', 111, by - 12 - fl, 2, 3);
  R(g, '#ff9a3a', 127, by - 12 - fl, 2, 3);

  for (let i = 0; i < 9; i++) {
    const fx = (i * 53 + t * 0.25 * (1 + (i % 3))) % W;
    const fy = 100 + Math.sin(t / 30 + i) * 14 + i * 4;
    R(g, ((t >> 3) + i) & 1 ? '#ffe98a' : '#a89a50', fx, fy, 1, 1);
  }

  g.restore();

  if (oy < 25) {
    const s = t % 420;
    if (s < 30) R(g, '#fff', 200 - s * 5, 10 + s * 2, 3, 1);
  }
}

export function drawTitle(g: CanvasRenderingContext2D, t: number, alpha: number, yShift = 0): void {
  g.save();
  g.globalAlpha = Math.max(0, Math.min(1, alpha));
  g.scale(2, 2);
  const lines: Array<[string, number]> = [
    ['A LENDA', 3 + yShift],
    ['DO HERÓI', 13 + yShift],
  ];
  lines.forEach(([s, y], li) => {
    const x0 = 60 - s.length * 4;
    [...s].forEach((c, i) => {
      const w = Math.sin(t / 12 + i * 0.7 + li) * 1.2;
      const hi = ((t >> 2) % 12) === i + li * 5;
      tx(g, c, x0 + i * 8, y + w + 1, '#ff9a1a', 'left', '#1a1040');
      tx(g, c, x0 + i * 8, y + w, hi ? '#fff' : '#ffe98a', 'left', '#1a1040');
    });
  });
  g.restore();
}

function drawPanel(g: CanvasRenderingContext2D, items: string[], sel: number, y: number): void {
  R(g, '#0a071bcc', 42, y - 6, 156, items.length * 14 + 10);
  R(g, '#ffd84a55', 42, y - 6, 156, 1);
  R(g, '#ffd84a55', 42, y + items.length * 14 + 3, 156, 1);
  items.forEach((s, i) => {
    tx(g, (i === sel ? '> ' : '  ') + s, 54, y + i * 14, i === sel ? '#ffd84a' : '#fff');
  });
}

function drawScene(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  off: number,
  tn: number,
  hz: number,
  fg: number,
  lightningFlash: number,
): void {
  const dt = [70, 110, 190];
  const db = [255, 190, 120];
  const n1 = [10, 8, 36];
  const n2 = [60, 40, 100];
  const N = 16;
  const hh = (hz + 24) / N;

  const flashBoost = Math.min(1, lightningFlash / 12) * 0.75;
  for (let i = 0; i < N; i++) {
    const k = i / (N - 1);
    const c = [0, 1, 2].map((j) => {
      const base = mx(mx(dt[j], db[j], k), mx(n1[j], n2[j], k), tn);
      return Math.min(255, base + flashBoost * (j === 2 ? 190 : 140)) | 0;
    });
    R(g, `rgb(${c.join(',')})`, 0, (i * hh) | 0, W, (hh + 2) | 0);
  }

  if (tn > 0.45 && lightningFlash < 4) {
    for (const s of stars) {
      if (s[1] < hz - 8 && ((t / 20 + s[2]) | 0) % 3) {
        R(g, '#fff', s[0], s[1], 1, 1);
      }
    }
  }

  if (tn < 0.5) {
    disc(g, '#ffe9a0', 170, hz - 30, 8);
    disc(g, '#fff4d0', 170, hz - 30, 5);
  } else {
    disc(g, '#e8e4ff', 60, hz - 50, 7);
    disc(g, '#c9c3f0', 58, hz - 52, 2);
  }

  const cl = mc([210, 195, 190], [40, 38, 86], tn);
  for (let i = 0; i < 5; i++) {
    const x = ((((i * 70 - off * 0.18) % (W + 80)) + W + 80) % (W + 80)) - 40;
    const y = hz - 66 + ((i * 11) % 24);
    R(g, cl, x, y, 30, 5);
    R(g, cl, x + 6, y - 3, 16, 3);
  }

  const mt = lightningFlash > 6 ? '#6a78b8' : mc([106, 122, 184], [36, 28, 80], tn);
  for (let x = 0; x < W; x += 4) {
    const h = 22 + Math.sin((x + off * 0.2) / 26) * 10 + Math.sin((x + off * 0.2) / 9) * 4;
    R(g, mt, x, (hz - 8 - h) | 0, 4, (h + 10) | 0);
  }

  const cx = ((((340 - off * 0.3) % 520) + 520) % 520) - 60;
  if (cx > -30 && cx < W + 10) {
    const c0 = '#1a1030';
    const by = hz - 34;
    R(g, c0, cx, by, 20, 26);
    R(g, c0, cx - 3, by - 8, 6, 12);
    R(g, c0, cx + 8, by - 12, 6, 16);
    R(g, c0, cx + 17, by - 8, 6, 12);
    R(g, '#ff4a3a', cx + 8, by + 6, 3, 4);
    if (tn > 0.3) {
      g.globalAlpha = 0.25;
      R(g, '#ff2a1a', cx + 4, by - 22, 12, 10);
      g.globalAlpha = 1;
    }
  }

  const hl = mc([74, 138, 74], [28, 44, 64], tn);
  for (let x = 0; x < W; x += 4) {
    const h = 9 + Math.sin((x + off * 0.5) / 18) * 6 + Math.sin((x + off * 0.5) / 7) * 2;
    R(g, hl, x, (hz + 6 - h) | 0, 4, (h + 20) | 0);
  }

  const pc = mc([40, 100, 60], [14, 26, 40], tn);
  for (let i = 0; i < 9; i++) {
    const x = ((((i * 30 - off * 0.6) % (W + 30)) + W + 30) % (W + 30)) - 15;
    pine(g, x | 0, hz + 10, 12, pc);
  }

  R(g, mc([90, 160, 70], [20, 40, 40], tn), 0, hz + 10, W, H - hz - 10);
  R(g, mc([216, 190, 130], [70, 66, 90], tn), 0, hz + 14, W, 5);

  const gl = mc([120, 190, 90], [30, 60, 56], tn);
  for (let r = 0; r < 5; r++) {
    const y = hz + 22 + r * 7;
    const x0 = ((-off * (1 + r * 0.7)) % 24 + 24) % 24;
    for (let x = x0 - 24; x < W; x += 24) R(g, gl, x, y, 8 + r * 2, 1);
  }

  if (fg === 1) {
    for (let i = 0; i < 5; i++) {
      const x = ((((i * 52 - off * 3) % (W + 52)) + W + 52) % (W + 52)) - 26;
      pine(g, x | 0, hz + 30, 22, '#050d0a');
    }
  }
}

function drawHorse(g: CanvasRenderingContext2D, cx: number, cy: number, z: number, tt: number): void {
  const p = tt * 0.28;
  const bob = Math.sin(p * 2) * 1.3;
  const B = '#7a4a22';
  const H1 = '#a07040';
  const D = '#4a2a12';
  const K = '#1a0e08';

  g.save();
  g.translate(cx, cy);
  g.scale(z, z);

  Qr(g, '#0004', -14, -1, 28, 3);
  for (const [hx, ph] of [
    [-6, 0.1],
    [-3, 0.85],
    [3, 3.1],
    [6, 3.85],
  ]) {
    const a = p + ph;
    const fx = hx + Math.sin(a) * 7;
    const lift = Math.max(0, Math.cos(a)) * 6;
    const kx = hx + Math.sin(a) * 3.5 + (hx < 0 ? -1.8 : 2.2) * (lift / 6);
    const ky = -8 - lift * 0.55;
    ln(g, hx, -9 + bob, kx, ky, D, 3);
    ln(g, kx, ky, fx, -lift - 1, D, 2);
    Qr(g, K, fx - 1, -lift - 2, 3, 2);
  }

  Qr(g, B, -10, -17 + bob, 20, 8);
  Qr(g, B, -8, -19 + bob, 16, 2);
  Qr(g, H1, -8, -19 + bob, 14, 1);
  Qr(g, D, -9, -10 + bob, 18, 1);
  Qr(g, B, 6, -20 + bob, 5, 7);

  ln(g, 8, -17 + bob, 13, -24 + bob, B, 5);
  Qr(g, B, 11, -28 + bob, 8, 5);
  Qr(g, B, 17, -26 + bob, 4, 4);
  Qr(g, K, 19, -25 + bob, 1, 1);
  Qr(g, K, 13, -30 + bob, 2, 2);
  Qr(g, '#fff', 14, -27 + bob, 1, 1);

  for (let i = 0; i < 5; i++) {
    ln(
      g,
      9 + i * 0.8,
      -24 + bob + i * 1.5,
      5 - i * 1.2 - Math.sin(p + i) * 2,
      -23 + bob + i * 1.6 + Math.cos(p + i),
      K,
      2,
    );
  }

  const ty = -14 + bob + Math.sin(p) * 2;
  ln(g, -10, -17 + bob, -17, ty, K, 3);
  ln(g, -17, ty, -20 - Math.cos(p), -8 + bob + Math.sin(p + 1) * 3, K, 2);

  const rb = Math.sin(p * 2 + 0.5) * 0.8;
  ln(g, -2, -26 + bob + rb, -11, -22 + bob + rb + Math.sin(p * 2) * 2, '#c0392b', 3);
  Qr(g, '#26307a', -3, -27 + bob + rb, 6, 9);
  Qr(g, '#f5c99a', -2, -33 + bob + rb, 5, 5);
  Qr(g, '#3a2a1a', -3, -35 + bob + rb, 7, 2);
  Qr(g, '#3a2a1a', 2, -34 + bob + rb, 4, 1);
  ln(g, 1, -24 + bob + rb, 6, -22 + bob, '#f5c99a', 2);

  for (let i = 0; i < 6; i++) {
    g.globalAlpha = 0.5 - i * 0.07;
    Qr(g, '#b0a698', -22 - i * 6 - ((tt * 1.5) % 6), -4 - (i % 3) * 2, 5 - (i >> 1), 3);
  }
  g.globalAlpha = 1;
  g.restore();
}

function drawWeather(
  g: CanvasRenderingContext2D,
  weather: WeatherState,
  count: number,
  isStory: boolean,
): void {
  g.fillStyle = isStory ? 'rgba(10, 14, 38, 0.22)' : 'rgba(12, 18, 44, 0.22)';
  g.fillRect(0, 0, W, H);

  if (weather.bolt) {
    const alpha = Math.min(1, weather.bolt.life / 8);
    g.save();
    g.strokeStyle = `rgba(225, 244, 255, ${alpha})`;
    g.lineWidth = 2;
    for (const [x1, y1, x2, y2] of weather.bolt.segments) {
      ln(g, x1, y1, x2, y2, '#e8f7ff', 2);
      ln(g, x1, y1, x2, y2, '#9ed8ff', 1);
    }
    g.restore();
  }

  for (let i = 0; i < count && i < weather.drops.length; i++) {
    const d = weather.drops[i];
    const color =
      d.layer === 0
        ? 'rgba(165, 200, 245, 0.35)'
        : d.layer === 1
          ? 'rgba(195, 224, 255, 0.55)'
          : 'rgba(230, 244, 255, 0.78)';
    const steps = d.layer === 2 ? 4 : 3;
    g.fillStyle = color;
    for (let s = 0; s < steps; s++) {
      const px = Math.floor(d.x + d.vx * (s / steps) * 1.3);
      const py = Math.floor(d.y + d.vy * (s / steps) * 1.3);
      g.fillRect(px, py, 1, d.layer === 2 ? 2 : 1);
    }
  }

  for (const sp of weather.splashes) {
    const spread = 6 - sp.life;
    g.fillStyle = 'rgba(215, 238, 255, 0.6)';
    g.fillRect((sp.x - spread) | 0, sp.y | 0, 1, 1);
    g.fillRect((sp.x + spread) | 0, sp.y | 0, 1, 1);
  }

  if (weather.flash > 0) {
    const fa = Math.min(0.62, (weather.flash / 16) * 0.62);
    g.fillStyle = `rgba(230, 242, 255, ${fa})`;
    g.fillRect(0, 0, W, H);
  }
}

/** Neve caindo no bioma gelado — leve, silenciosa e sem relâmpagos. */
export function drawSnow(g: CanvasRenderingContext2D, weather: WeatherState): void {
  g.fillStyle = 'rgba(190, 216, 245, 0.12)';
  g.fillRect(0, 0, W, H);
  for (const f of weather.snow) {
    const x = f.x | 0;
    const y = f.y | 0;
    g.fillStyle = f.r > 1.6 ? 'rgba(255,255,255,0.95)' : 'rgba(226,242,255,0.78)';
    g.fillRect(x, y, f.r > 1.6 ? 2 : 1, f.r > 1.6 ? 2 : 1);
    if (f.r > 1.8 && ((f.phase | 0) & 1) === 0) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(x - 1, y, 1, 1);
      g.fillRect(x + 2, y, 1, 1);
    }
  }
}

function drawTile(
  g: CanvasRenderingContext2D,
  world: WorldData,
  V: ProgressState,
  G: HeroState,
  t: number,
  ch: string,
  a: number,
  b: number,
  weather: WeatherState,
  nightFactor: number,
): void {
  const M_ = G.map;
  const m = world.maps[M_];
  const x = a * T;
  const y = b * T;
  const h = hs(a, b);
  const hh = isHouse(M_);
  const dn = !hh && M_ >= 200;
  const T_ = dn ? dungeonTheme(M_) : 3;
  const fc = hh ? 'F' : ['g', 's', 'i', 'c', 'c', 'c'][T_];
  const nb = (dx: number, dy: number) => m[b + dy] && m[b + dy][a + dx];

  // Village Streetlamp / Lantern ('L')
  if (ch === 'L') {
    const bgTile = M_ === 35 || M_ === 36 ? 'p' : m[b]?.[a - 1] === 'p' ? 'p' : '.';
    drawTile(g, world, V, G, t, bgTile, a, b, weather, nightFactor);
    R(g, '#0005', x + 4, y + 13, 8, 2);
    R(g, '#2a2a3c', x + 6, y + 6, 4, 9);
    R(g, '#4e5272', x + 7, y + 6, 2, 8);
    R(g, '#2a2a3c', x + 4, y + 1, 8, 6);
    R(g, '#ffd86a', x + 5, y + 2, 6, 4);
    const flk = ((t + a * 3) >> 3) & 1;
    R(g, flk ? '#fff8d0' : '#ffaa3a', x + 6, y + 3, 4, 2);
    R(g, '#4e5272', x + 5, y, 6, 1);
    return;
  }

  // Cave Wall/Floor Torch ('t')
  if (ch === 't') {
    drawTile(g, world, V, G, t, fc, a, b, weather, nightFactor);
    R(g, '#0005', x + 4, y + 13, 8, 2);
    R(g, '#3a2210', x + 6, y + 7, 4, 7);
    R(g, '#6b3f1d', x + 7, y + 7, 2, 7);
    R(g, '#ffd84a', x + 6, y + 6, 4, 2);
    const fl = ((t + a * 5 + b * 3) >> 2) & 1;
    R(g, '#ff5a1a', x + 5, y + 2 + fl, 6, 5 - fl);
    R(g, '#ffaa2a', x + 6, y + 2, 4, 4);
    R(g, '#fff6b0', x + 7, y + 3 + fl, 2, 2);
    return;
  }

  // Cracked Boulder ('R') - Destructible with Bombs!
  if (ch === 'R') {
    drawTile(g, world, V, G, t, fc, a, b, weather, nightFactor);
    R(g, '#1f1c2e', x + 1, y + 2, 14, 13);
    R(g, '#5a5872', x + 2, y + 3, 12, 11);
    R(g, '#8886a4', x + 3, y + 3, 9, 4);
    R(g, '#3a384e', x + 2, y + 11, 12, 3);
    // Bright cracks indicating bomb vulnerability
    R(g, '#141222', x + 7, y + 3, 2, 4);
    R(g, '#141222', x + 5, y + 7, 4, 2);
    R(g, '#141222', x + 9, y + 8, 2, 4);
    R(g, '#ffd84a88', x + 7, y + 5, 1, 2);
    return;
  }

  // Interior walls & dungeon walls
  if (ch === 'W' && (hh || dn)) {
    if (hh) {
      R(g, '#d9b680', x, y, T, T);
      R(g, '#c4a066', x, y + 9, T, 1);
      R(g, '#8a5f2e', x, y + 13, T, 3);
      R(g, '#8a5f2e', x + (h % 2 ? 3 : 11), y, 2, 13);
    } else {
      const p = WALL_PALETTES[T_];
      R(g, p[0], x, y, T, T);
      R(g, p[1], x, y, T, 1);
      R(g, p[2], x, y + 7, T, 1);
      R(g, p[2], x + (h % 2 ? 5 : 11), y, 1, 7);
      R(g, p[2], x + (h % 2 ? 11 : 5), y + 8, 1, 8);
      R(g, p[1], x + 1, y + 1, 4, 2);
      if (b === 0 && a % 4 === 2) {
        R(g, '#6b3f1d', x + 7, y + 7, 2, 6);
        const f = (t >> 3) & 1;
        R(g, '#ff7a2a', x + 6, y + 3 + f, 4, 5);
        R(g, '#ffe98a', x + 7, y + 5, 2, 3);
      }
    }
    return;
  }

  // House window (reflects storm or night/day sky outside)
  if (ch === 'w') {
    R(g, '#d9b680', x, y, T, T);
    R(g, '#8a5f2e', x, y + 13, T, 3);
    R(g, '#6b3f1d', x + 2, y + 2, 12, 10);
    const stormy = !V.sword;
    if (stormy) {
      const skyC = weather.flash > 6 ? '#cfe9ff' : '#2a4173';
      R(g, skyC, x + 3, y + 3, 10, 8);
      const ry = (t >> 1) % 6;
      R(g, '#9bc7ff', x + 5, y + 3 + ry, 1, 2);
      R(g, '#9bc7ff', x + 10, y + 5 + ((ry + 3) % 5), 1, 2);
    } else if (nightFactor > 0.5) {
      R(g, '#16204a', x + 3, y + 3, 10, 8);
      R(g, '#fff8c8', x + 5, y + 5, 1, 1);
      R(g, '#fff8c8', x + 10, y + 7, 1, 1);
    } else {
      R(g, '#8fd0ff', x + 3, y + 3, 10, 8);
      R(g, '#fff6', x + 3, y + 3, 4, 2);
    }
    R(g, '#6b3f1d', x + 7, y + 3, 2, 8);
    return;
  }

  // Doors inside houses / caves
  if (ch === 'D' && (hh || dn)) {
    drawTile(g, world, V, G, t, fc, a, b, weather, nightFactor);
    if (hh) {
      R(g, '#2a1608', x + 1, y, 14, T);
      R(g, '#6b3f1d', x + 2, y, 12, 15);
      R(g, '#8a5f2e', x + 3, y + 1, 4, 13);
      R(g, '#ffd84a', x + 11, y + 8, 2, 2);
    } else {
      const p = WALL_PALETTES[T_];
      R(g, '#0a0818', x + 1, y, 14, T);
      R(g, p[1], x, y, T, 3);
      R(g, p[1], x, y, 2, T);
      R(g, p[1], x + 14, y, 2, T);
      R(g, '#2a2a40', x + 3, y + 4, 10, 2);
      R(g, '#2a2a40', x + 4, y + 8, 8, 2);
      R(g, '#2a2a40', x + 5, y + 12, 6, 2);
    }
    return;
  }

  // Interior floor tiles
  if (ch === 'F' || ch === 'K') {
    R(g, '#b5834a', x, y, T, T);
    R(g, '#8a5f2e', x, y + 7, T, 1);
    R(g, '#8a5f2e', x, y + 15, T, 1);
    R(g, '#8a5f2e', x + (h % 2 ? 4 : 11), y, 1, 7);
    R(g, '#8a5f2e', x + (h % 2 ? 11 : 4), y + 8, 1, 7);
    if (ch === 'K') {
      if (hh) {
        // Larger heavy supply crate inside houses/shops
        R(g, '#2a1608', x, y - 1, T, 17);
        R(g, '#6b3f1d', x + 1, y, 14, 15);
        R(g, '#c0392b', x + 1, y, 14, 6);
        R(g, '#e8604f', x + 1, y, 14, 2);
        R(g, '#ffd84a', x + 3, y + 7, 10, 1);
      } else {
        R(g, '#2a1608', x + 1, y + 3, 14, 11);
        R(g, '#6b3f1d', x + 2, y + 4, 12, 9);
        R(g, '#c0392b', x + 2, y + 4, 12, 4);
        R(g, '#e8604f', x + 2, y + 4, 12, 1);
      }
    }
    return;
  }

  if (ch === 'g') {
    R(g, '#2c4a3a', x, y, T, T);
    R(g, '#3a6648', x + (h % 10), y + (h % 8) + 2, 5, 3);
    R(g, '#5aa05a', x + ((h >> 3) % 12), y + ((h >> 2) % 12), 1, 2);
    return;
  }

  if (ch === 'i') {
    R(g, '#a8d4f0', x, y, T, T);
    R(g, '#c8e8ff', x + (h % 9), y + 3, 6, 1);
    R(g, '#c8e8ff', x + ((h >> 3) % 9) + 2, y + 10, 5, 1);
    R(g, '#7fb0d8', x + (h % 12), y + (h % 11) + 2, 3, 1);
    return;
  }

  if (ch === 'r' || ch === 'd') {
    const c1 = hh ? '#b0302a' : '#4a1a60';
    const c2 = hh ? '#e8c860' : '#c8a0e8';
    R(g, c1, x, y, T, T);
    R(g, c2, x + 1, y + 1, 14, 1);
    R(g, c2, x + 1, y + 14, 14, 1);
    if (ch === 'd') {
      // Bold gold pixel "D" emblem centered on the bedroom rug
      R(g, '#7a1c18', x + 1, y + 1, 14, 14);
      R(g, '#c89b32', x + 2, y + 2, 12, 1);
      R(g, '#c89b32', x + 2, y + 13, 12, 1);
      // Drop shadow
      R(g, '#4a100d', x + 5, y + 4, 2, 9);
      R(g, '#4a100d', x + 5, y + 4, 6, 2);
      R(g, '#4a100d', x + 5, y + 11, 6, 2);
      R(g, '#4a100d', x + 11, y + 6, 2, 5);
      // Golden D
      R(g, '#ffd84a', x + 4, y + 3, 2, 9);
      R(g, '#ffd84a', x + 4, y + 3, 6, 2);
      R(g, '#ffd84a', x + 4, y + 10, 6, 2);
      R(g, '#ffd84a', x + 10, y + 5, 2, 5);
      R(g, '#fff4a8', x + 4, y + 3, 5, 1);
      R(g, '#fff4a8', x + 4, y + 3, 1, 7);
    }
    return;
  }

  if (ch === 'E') {
    drawTile(g, world, V, G, t, 'F', a, b, weather, nightFactor);
    R(g, '#2a1608', x, y - 2, T, 18);
    R(g, '#522d14', x + 1, y - 1, 14, 16);
    // Larger grand wooden staircase steps
    for (let s = 0; s < 5; s++) {
      const sy = y + s * 3;
      R(g, '#b87b34', x + 2, sy, 12, 2);
      R(g, '#dfb05c', x + 2, sy, 12, 1);
      R(g, '#3a1e0c', x + 2, sy + 2, 12, 1);
    }
    // Chunky side handrails
    R(g, '#7a4921', x, y - 2, 2, 18);
    R(g, '#7a4921', x + 14, y - 2, 2, 18);
    R(g, '#c98b3c', x, y - 2, 2, 2);
    R(g, '#c98b3c', x + 14, y - 2, 2, 2);
    R(g, '#ffd84a', x + 6, y + (G.map === 451 ? 13 : 1), 4, 2);
    return;
  }

  if (ch === 'S' && (hh || M_ === SWORD_MAP)) {
    drawTile(g, world, V, G, t, 'r', a, b, weather, nightFactor);
    if (!V.sword) {
      const pulse = 0.22 + 0.1 * Math.sin(t / 10);
      g.fillStyle = `rgba(143, 208, 255, ${pulse})`;
      g.fillRect(x, y - 10, T, 25);
    }
    // Altar sagrado: a espada em pixel-art é desenhada por cima do desenho
    // da praça, com a ponta cravada no pedestal.
    R(g, '#0005', x, y + 12, T, 4);
    R(g, '#3e3e52', x + 1, y + 7, 14, 8);
    R(g, '#7a7a96', x + 2, y + 5, 12, 6);
    R(g, '#b6b6d0', x + 3, y + 5, 10, 2);
    R(g, '#ffd84a', x + 7, y + 9, 2, 2);
    if (!V.sword) {
      drawWorldSword(g, x, y - 10);
      if ((t >> 3) & 1) R(g, '#fff', x + 13, y - 5, 1, 1);
      if ((t >> 4) & 1) R(g, '#9ee6ff', x + 2, y, 1, 2);
    }
    return;
  }

  if (ch === 'C' && hh) {
    drawTile(g, world, V, G, t, 'F', a, b, weather, nightFactor);
    // Larger indoor treasure chest
    R(g, '#000', x, y, T, 16);
    R(g, '#5a3a1a', x + 1, y + 1, 14, 14);
    R(g, '#a8743a', x + 1, y + 1, 14, 6);
    R(g, '#c98b3c', x + 1, y + 1, 14, 3);
    R(g, '#2a1608', x + 1, y + 7, 14, 2);
    R(g, '#ffd84a', x + 5, y + 6, 6, 5);
    R(g, '#fff8c8', x + 7, y + 7, 2, 2);
    if (!V.sword && ((t >> 4) & 1)) R(g, '#fff', x + 13, y, 2, 2);
    return;
  }

  if ('euqzvy'.includes(ch)) {
    drawTile(g, world, V, G, t, 'F', a, b, weather, nightFactor);
    if (ch === 'e') {
      // Seamless larger double-wide bed if horizontal neighbors are also 'e'
      const hasL = nb(-1, 0) === 'e';
      const hasR = nb(1, 0) === 'e';
      const leftX = hasL ? x : x + 1;
      const rightW = (hasL ? 1 : 0) + (hasR ? 1 : 0);
      const bx = leftX;
      const bw = rightW === 2 ? T : hasL ? 15 : hasR ? 15 : 14;
      // Tall headboard extending up onto wall top + full bedding
      R(g, '#2a1608', bx, y - 4, bw, 20);
      R(g, '#6b3f1d', hasL ? bx : bx + 1, y - 3, hasL && hasR ? bw : bw - 1, 5);
      R(g, '#a8743a', hasL ? bx : bx + 1, y - 2, hasL && hasR ? bw : bw - 1, 2);
      R(g, '#8a5f2e', hasL ? bx : bx + 1, y + 2, hasL && hasR ? bw : bw - 1, 13);
      if (!hasL) {
        // Wide plush pillow on the left side of the bed
        R(g, '#ffffff', bx + 2, y + 2, hasR ? 12 : 9, 5);
        R(g, '#dbe8ff', bx + 2, y + 6, hasR ? 12 : 9, 1);
      }
      // Cozy quilted bedspread
      const qx = hasL ? bx : bx + 1;
      const qw = hasL && hasR ? bw : bw - 2;
      R(g, '#3958cc', qx, hasL ? y + 2 : y + 7, qw, hasL ? 12 : 7);
      R(g, '#5d7df0', qx, hasL ? y + 2 : y + 7, qw, 2);
      R(g, '#8aa6ff', qx, y + 9, qw, 1);
      if (!hasR && hasL) {
        // Footboard trim on right side
        R(g, '#4a2810', x + 14, y - 1, 2, 17);
      }
    } else if (ch === 'u') {
      // Larger carved stone fireplace extending upward
      R(g, '#48485a', x, y - 5, T, 21);
      R(g, '#6c6c80', x + 1, y - 4, 14, 19);
      R(g, '#a6a6be', x, y - 5, T, 3);
      R(g, '#222230', x + 2, y + 3, 12, 13);
      const f = (t >> 3) & 1;
      R(g, '#ff6a1a', x + 4, y + 6 + f, 8, 10 - f);
      R(g, '#ffe98a', x + 6, y + 9, 4, 7);
    } else if (ch === 'q') {
      // Towering seamless bookcase extending above wall line (y - 6..y + 16)
      const hasL = nb(-1, 0) === 'q';
      const hasR = nb(1, 0) === 'q';
      const lx = hasL ? x : x + 1;
      const rw = hasL && hasR ? T : hasL || hasR ? 15 : 14;
      R(g, '#2a1608', lx, y - 6, rw, 22);
      R(g, '#6b3f1d', hasL ? lx : lx + 1, y - 5, hasL && hasR ? rw : rw - 1, 20);
      R(g, '#9a6232', hasL ? lx : lx + 1, y - 5, hasL && hasR ? rw : rw - 1, 2);
      // 3 full shelf dividers
      R(g, '#2a1608', lx + 1, y + 1, rw - 2, 1);
      R(g, '#2a1608', lx + 1, y + 8, rw - 2, 1);
      // Taller, thicker colorful books across all 3 shelves
      for (let i = 0; i < 4; i++) {
        const bx = x + 2 + i * 3;
        const c1 = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad'][(i + h) % 5];
        const c2 = ['#e67e22', '#2980b9', '#ffd84a', '#9b59b6', '#c0392b'][(i + h + 2) % 5];
        const c3 = ['#16a085', '#c0392b', '#f39c12', '#3498db', '#d35400'][(i + h + 3) % 5];
        R(g, c1, bx, y - 3, 2, 4);
        R(g, c2, bx, y + 2, 2, 6);
        R(g, c3, bx, y + 9, 2, 5);
      }
    } else if (ch === 'z') {
      // Seamless larger indoor table / shop counter
      const hasL = nb(-1, 0) === 'z';
      const hasR = nb(1, 0) === 'z';
      const lx = hasL ? x : x;
      const rw = T;
      R(g, '#2a1608', lx, y + 1, rw, 14);
      R(g, '#a8743a', hasL ? lx : lx + 1, y + 2, hasL && hasR ? rw : rw - 1, 10);
      R(g, '#c98b3c', hasL ? lx : lx + 1, y + 2, hasL && hasR ? rw : rw - 1, 3);
      R(g, '#7a4921', hasL ? lx : lx + 1, y + 12, 3, 3);
      if (!hasR) R(g, '#7a4921', x + 12, y + 12, 3, 3);
      // Decorative tabletop mug / parchment / apples
      if (!hasL || (a & 1) === 0) {
        R(g, '#fff', x + 4, y + 4, 4, 3);
        R(g, '#e8604f', x + 10, y + 5, 3, 3);
      } else {
        R(g, '#f5e4b8', x + 4, y + 4, 6, 4);
        R(g, '#ffd84a', x + 11, y + 4, 3, 3);
      }
    } else if (ch === 'y') {
      // Larger retro TV cabinet + glowing CRT TV + chunky PS2-style console (y - 6 .. y + 16)
      R(g, '#2a1608', x, y + 7, T, 9);
      R(g, '#6b3f1d', x + 1, y + 8, 14, 7);
      // Retro CRT TV extending high & wide
      R(g, '#141722', x, y - 6, T, 13);
      R(g, '#2f3548', x + 1, y - 5, 14, 11);
      // Little rabbit-ear TV antenna tips
      R(g, '#8ea0c0', x + 5, y - 7, 1, 1);
      R(g, '#8ea0c0', x + 10, y - 7, 1, 1);
      const scan = (t >> 3) & 4;
      R(g, '#1646ad', x + 2, y - 4, 12, 9);
      R(g, '#3f96ff', x + 2, y - 4 + scan, 12, 3);
      R(g, '#a8ebff', x + 3 + ((t >> 4) % 6), y - 1, 4, 3);
      // Larger matte-black PS2-style console with glowing LEDs & dual controller slots
      R(g, '#0b0d14', x + 1, y + 8, 14, 7);
      R(g, '#23283c', x + 1, y + 11, 14, 1);
      R(g, '#05060a', x + 3, y + 12, 3, 2);
      R(g, '#05060a', x + 7, y + 12, 3, 2);
      R(g, '#1ea8ff', x + 12, y + 9, 2, 2); // Bright PS2 blue power LED
      R(g, '#2ee06b', x + 12, y + 12, 2, 2); // Bright green eject LED
    } else {
      // Larger ornate glazed terracotta amphora pot
      R(g, '#2a1608', x + 2, y + 1, 12, 14);
      R(g, '#c8794a', x + 3, y + 3, 10, 11);
      R(g, '#e8a070', x + 4, y + 4, 3, 8);
      R(g, '#8a4a2a', x + 2, y + 1, 12, 3);
      R(g, '#ffd84a', x + 3, y + 7, 10, 1);
    }
    return;
  }

  if ('mjJxoA'.includes(ch)) {
    drawTile(g, world, V, G, t, fc, a, b, weather, nightFactor);
    const ic = T_ === 2;
    if (ch === 'm') {
      R(g, '#0003', x + 2, y + 13, 12, 2);
      R(g, '#2f2a50', x + 6, y + 1, 4, 3);
      R(g, '#5a5488', x + 6, y + 3, 4, 4);
      R(g, '#5a5488', x + 4, y + 7, 8, 7);
      R(g, '#7a74a8', x + 5, y + 4, 2, 9);
    } else if (ch === 'j') {
      R(g, '#0003', x + 2, y + 13, 12, 2);
      R(g, '#4a8ac0', x + 5, y + 1, 6, 13);
      R(g, '#bfe6ff', x + 6, y + 2, 3, 10);
      R(g, '#fff', x + 7, y + 3, 1, 3);
      R(g, '#4a8ac0', x + 2, y + 8, 4, 6);
    } else if (ch === 'J') {
      R(g, '#0003', x + 2, y + 14, 12, 2);
      R(g, '#8a6a3a', x + 4, y, 8, T);
      R(g, '#c8a870', x + 4, y, 6, T);
      R(g, '#e0c890', x + 3, y, 10, 3);
      R(g, '#e0c890', x + 3, y + 13, 10, 3);
    } else if (ch === 'x') {
      const c = ic ? ['#2a6a90', '#6ad0ff', '#d8f4ff'] : ['#2a1a60', '#7a5aff', '#b8a8ff'];
      R(g, '#0003', x + 3, y + 13, 10, 2);
      R(g, c[0], x + 4, y + 3, 8, 11);
      R(g, c[1], x + 5, y + 1, 6, 12);
      R(g, c[2], x + 6, y + 3, 2, 6);
      if ((t >> 4) % 3 === a % 3) R(g, '#fff', x + 10, y + 3, 1, 1);
    } else if (ch === 'o') {
      R(g, '#e8e0d0', x + 3, y + 9, 9, 2);
      R(g, '#e8e0d0', x + 4, y + 6, 3, 3);
      R(g, '#222', x + 4, y + 7, 1, 1);
    } else {
      R(g, '#2a2a38', x + 1, y + 5, 14, 11);
      R(g, '#6c6c80', x + 2, y + 6, 12, 9);
      R(g, '#9a9ab0', x + 2, y + 6, 12, 3);
      if (!V.fl['b' + M_]) {
        R(g, '#7a2ab0', x + 5, y + ((t >> 4) & 1), 6, 6);
        R(g, '#d8a8ff', x + 6, y + 1 + ((t >> 4) & 1), 2, 2);
      }
    }
    return;
  }

  if (ch === 's' || ch === 'k') {
    R(g, '#e8d08a', x, y, T, T);
    R(g, '#d4b86a', x + (h % 12), y + (h % 9) + 2, 3, 1);
    R(g, '#f4e2a8', x + ((h >> 3) % 12), y + 11, 2, 1);
    if (ch === 'k') {
      R(g, '#0f4a1d', x + 5, y + 1, 6, 14);
      R(g, '#2f9e44', x + 6, y + 2, 4, 12);
      R(g, '#0f4a1d', x + 1, y + 5, 5, 3);
      R(g, '#2f9e44', x + 2, y + 5, 3, 2);
      R(g, '#0f4a1d', x + 10, y + 7, 5, 3);
      R(g, '#2f9e44', x + 11, y + 7, 3, 2);
    }
    return;
  }

  if (ch === 'n' || ch === 'P') {
    R(g, '#eef6ff', x, y, T, T);
    R(g, '#cfe0f5', x + (h % 12), y + (h % 9) + 3, 4, 1);
    R(g, '#fff', x + ((h >> 3) % 12), y + 11, 2, 1);
    if (ch === 'P') {
      R(g, '#0003', x + 2, y + 14, 12, 2);
      R(g, '#5a3a1a', x + 7, y + 12, 2, 4);
      R(g, '#14573a', x + 3, y + 8, 10, 5);
      R(g, '#1f7a4f', x + 4, y + 4, 8, 5);
      R(g, '#2f9e6a', x + 6, y + 1, 4, 4);
      R(g, '#fff', x + 3, y + 8, 10, 1);
      R(g, '#fff', x + 4, y + 4, 8, 1);
      R(g, '#fff', x + 6, y + 1, 4, 1);
    }
    return;
  }

  if (ch === 'G') {
    R(g, '#2e2848', x, y, T, T);
    R(g, '#4a4270', x, y, T, 2);
    R(g, '#0a0818', x + 2, y + 3, 12, 13);
    R(g, (V.it.fragmento | 0) >= 3 ? '#ffd84a' : '#7a2ab0', x + 4, y + 5, 8, 11);
    R(g, '#0008', x + 7, y + 5, 2, 11);
    if ((t >> 4) & 1) R(g, '#fff', x + 5, y + 7, 1, 1);
    return;
  }

  // Lama do pântano (solo caminhável) e juncos escondidos entre as poças.
  if (ch === 'a' || ch === 'l') {
    R(g, '#43512e', x, y, T, T);
    R(g, '#53653a', x + (h % 11), y + (h % 8) + 2, 5, 2);
    R(g, '#6d7f47', x + ((h >> 3) % 12), y + 11, 2, 1);
    R(g, '#2c3a22', x + ((h >> 2) % 12), y + 6, 3, 1);
    if (ch === 'l') {
      for (let i = 0; i < 3; i++) {
        const rx = x + 3 + i * 4;
        R(g, '#1d3a1c', rx, y + 4, 2, 11);
        R(g, '#5f9b45', rx + (i & 1), y + 3, 1, 9);
        R(g, '#8cc25c', rx + 1, y + 2 + (i & 1), 1, 4);
      }
    }
    return;
  }

  if (ch === 'W' || ch === 'c' || ch === 'C') {
    if (ch === 'W') {
      R(g, '#221c44', x, y, T, T);
      R(g, '#3a3270', x, y, T, 1);
      R(g, '#171233', x, y + 7, T, 1);
      R(g, '#171233', x + (h % 2 ? 5 : 11), y, 1, 7);
      R(g, '#171233', x + (h % 2 ? 11 : 5), y + 8, 1, 8);
      R(g, '#2e2858', x + 1, y + 1, 4, 2);
      if (b === 0 && a % 4 === 2) {
        R(g, '#6b3f1d', x + 7, y + 7, 2, 6);
        const f = (t >> 3) & 1;
        R(g, '#ff7a2a', x + 6, y + 3 + f, 4, 5);
        R(g, '#ffe98a', x + 7, y + 5, 2, 3);
      }
    } else {
      R(g, '#38335e', x, y, T, T);
      R(g, '#403b6c', x, y, 8, 8);
      R(g, '#403b6c', x + 8, y + 8, 8, 8);
      R(g, '#2a2548', x + (h % 10) + 2, y + (h % 6) + 3, 4, 1);
      R(g, '#2a2548', x + (h % 10) + 4, y + (h % 6) + 4, 1, 3);
      R(g, '#5a5490', x + ((h >> 4) % 12) + 1, y + 11, 2, 1);
    }
    if (ch === 'C') {
      R(g, '#000', x + 1, y + 4, 14, 12);
      R(g, '#5a3a1a', x + 2, y + 5, 12, 10);
      R(g, '#a8743a', x + 2, y + 5, 12, 4);
      R(g, '#c98b3c', x + 2, y + 5, 12, 2);
      R(g, '#2a1608', x + 2, y + 9, 12, 1);
      R(g, '#ffd84a', x + 6, y + 8, 4, 4);
      R(g, '#fff', x + 7, y + 9, 1, 1);
      if ((t >> 4) & 1) R(g, '#fff', x + 13, y + 3, 1, 1);
    }
    return;
  }

  if (ch === '~') {
    const fm = (dx: number, dy: number) => {
      const c = nb(dx, dy);
      return c !== undefined && c !== '~' && c !== 'B';
    };
    R(g, '#2a63c8', x, y, T, T);
    R(g, '#3478e6', x, y + (((t >> 5) + b) & 1 ? 0 : 8), T, 8);
    if (fm(-1, 0)) R(g, '#cfe8ff', x, y, 2, T);
    if (fm(1, 0)) R(g, '#cfe8ff', x + 14, y, 2, T);
    if (fm(0, -1)) R(g, '#cfe8ff', x, y, T, 2);
    if (fm(0, 1)) R(g, '#cfe8ff', x, y + 14, T, 2);
    const o = ((t >> 4) + a + b) & 1;
    R(g, '#8fc0ff', x + 2 + o * 6, y + 5, 6, 1);
    R(g, '#8fc0ff', x + 8 - o * 5, y + 12, 5, 1);
    return;
  }

  if (ch === 'B') {
    R(g, '#b3813f', x, y, T, T);
    for (let i = 0; i < 4; i++) {
      R(g, '#7a4f22', x + i * 4 + 3, y, 1, T);
      R(g, '#cf9d55', x + i * 4, y, 1, T);
    }
    if (nb(0, -1) === '~') R(g, '#5a3a1a', x, y, T, 3);
    if (nb(0, 1) === '~') R(g, '#5a3a1a', x, y + 13, T, 3);
    return;
  }

  if (ch === 'p') {
    const isPlaza = M_ === 35 || M_ === 36;
    if (isPlaza) {
      R(g, '#b8a888', x, y, T, T);
      R(g, '#cbbca0', x, y, 7, 7);
      R(g, '#cbbca0', x + 8, y + 8, 7, 7);
      R(g, '#94866b', x + 7, y, 1, T);
      R(g, '#94866b', x, y + 7, T, 1);
    } else {
      R(g, '#dcc07a', x, y, T, T);
      R(g, '#e8d092', x, y, T, 1);
      R(g, '#c4a55f', x + (h % 12), y + (h % 9) + 2, 3, 2);
      R(g, '#b0924f', x + ((h >> 3) % 12), y + 11, 2, 1);
    }
    return;
  }

  // Base Grass
  R(g, '#62b94a', x, y, T, T);
  if (!(h & 3)) R(g, '#6ac752', x + 2, y + 2, 7, 5);
  R(g, '#4a9c3a', x + (h % 13), y + ((h >> 2) % 12), 2, 1);
  const sw = (t >> 5) & 1;
  const tz = (h % 10) + 2;
  const ta = ((h >> 3) % 9) + 3;
  R(g, '#3f8a32', x + tz, y + ta, 1, 3);
  R(g, '#3f8a32', x + tz + 1 + sw, y + ta - 1, 1, 2);
  R(g, '#3f8a32', x + tz + 2, y + ta, 1, 3);

  if (ch === 'T') {
    R(g, '#0e3b26', x + 3, y, 10, 1);
    R(g, '#0e3b26', x + 1, y + 1, 14, 11);
    R(g, '#0e3b26', x + 3, y + 12, 10, 1);
    R(g, '#1f7a4f', x + 2, y + 1, 12, 10);
    R(g, '#36a56f', x + 3, y + 2, 6, 3);
    R(g, '#14573a', x + 2, y + 8, 12, 3);
    R(g, '#6fd09a', x + 4 + (h % 5), y + 3, 2, 1);
    R(g, '#6fd09a', x + 9, y + 6, 2, 1);
    R(g, '#0003', x + 2, y + 14, 12, 2);
    R(g, '#5a3a1a', x + 6, y + 12, 4, 4);
    R(g, '#3b250e', x + 6, y + 12, 1, 4);
  } else if (ch === 'b') {
    R(g, '#0f4a1d', x + 3, y + 2, 10, 1);
    R(g, '#0f4a1d', x + 1, y + 3, 14, 12);
    R(g, '#2f9e44', x + 2, y + 3, 12, 11);
    R(g, '#6fe58a', x + 3, y + 4, 5, 3);
    R(g, '#1c6b2a', x + 2, y + 11, 12, 3);
    if (h % 3 === 0) R(g, '#ff4a55', x + 9, y + 8, 2, 2);
    R(g, '#fff6', x + 4, y + 4, 2, 1);
  } else if (ch === 'f') {
    const c = ['#ff8fc0', '#fff', '#ffd84a', '#b78bff'][h % 4];
    const s = (t >> 5) & 1;
    R(g, '#2f8a3c', x + 4, y + 6, 1, 5);
    R(g, c, x + 3 + s, y + 3, 3, 3);
    R(g, '#ffd84a', x + 4 + s, y + 4, 1, 1);
    R(g, '#2f8a3c', x + 11, y + 9, 1, 4);
    R(g, c, x + 10, y + 6, 3, 3);
    R(g, '#fff', x + 11, y + 7, 1, 1);
  } else if (ch === '#') {
    R(g, '#2a2a38', x, y + 1, T, 15);
    R(g, '#6c6c80', x + 1, y + 2, 14, 13);
    R(g, '#9a9ab0', x + 2, y + 2, 10, 4);
    R(g, '#b8b8cc', x + 3, y + 3, 4, 1);
    R(g, '#4a4a5c', x + 1, y + 11, 14, 4);
    R(g, '#2a2a38', x + 8, y + 6, 1, 6);
  } else  if (ch === 'U' || ch === 'V' || ch === 'Y') {
    const isForge = M_ === 35 && a >= 9;
    const isTailor = M_ === 36;
    if (ch === 'Y') {
      // Outdoor Bazaar Merchant Stall
      const bg = M_ === 36 ? 'p' : '.';
      drawTile(g, world, V, G, t, bg, a, b, weather, nightFactor);
      R(g, '#0005', x + 1, y + 13, 14, 3);
      // Wooden counter
      R(g, '#4a2810', x, y + 8, T, 7);
      R(g, '#9a6232', x + 1, y + 9, 14, 4);
      R(g, '#c98b3c', x + 1, y + 9, 14, 1);
      // Striped bazaar canopy
      const stripe = (a & 1) === 0;
      R(g, '#6a1818', x, y + 1, T, 7);
      R(g, stripe ? '#d84038' : '#fff0d4', x + 1, y + 1, 7, 6);
      R(g, stripe ? '#fff0d4' : '#d84038', x + 8, y + 1, 7, 6);
      R(g, '#ffd84a', x, y + 7, T, 1);
      // Display wares on counter (potion + shield / lantern)
      if ((a & 1) === 0) {
        R(g, '#ff4a55', x + 4, y + 7, 3, 3);
        R(g, '#9ed8ff', x + 9, y + 7, 4, 3);
      } else {
        R(g, '#ffd84a', x + 4, y + 7, 3, 3);
        R(g, '#ffaa3a', x + 11, y + 5, 3, 4);
      }
      return;
    }

    const roofMain = isForge ? '#4a1d24' : isTailor ? '#44206a' : '#1b4a68';
    const roofDark = isForge ? '#2b1015' : isTailor ? '#281142' : '#102d42';
    const roofHi = isForge ? '#8a323e' : isTailor ? '#7a42b8' : '#327ba8';
    const awnA = isForge ? '#b82a2a' : isTailor ? '#6c34b8' : '#d84038';
    const awnB = isForge ? '#ffd84a' : isTailor ? '#ffe98a' : '#fff0d4';

    if (ch === 'U') {
      if (b === 1) {
        // Ornate stepped Grand Store parapet & roof
        R(g, roofDark, x, y, T, T);
        R(g, roofMain, x, y + 2, T, 13);
        R(g, '#ffd84a', x, y + 1, T, 1);
        R(g, roofHi, x + 2, y + 4, 12, 2);
        R(g, roofDark, x, y + 14, T, 2);
        // Center hanging Golden Store Emblem Signboard
        const isCenterCol = (M_ === 35 && (a === 3 || a === 11)) || (M_ === 36 && a === 3);
        if (isCenterCol) {
          R(g, '#2a1608', x + 1, y + 3, 14, 12);
          R(g, '#ffd84a', x + 2, y + 4, 12, 10);
          R(g, '#1f1638', x + 3, y + 5, 10, 8);
          if (isForge) {
            // Crossed sword & shield sign
            R(g, '#d8e4f4', x + 4, y + 6, 3, 5);
            R(g, '#ffd84a', x + 8, y + 6, 4, 5);
            R(g, '#3a66c8', x + 9, y + 7, 2, 3);
          } else if (isTailor) {
            // Royal tunic/crown sign
            R(g, '#ffd84a', x + 5, y + 6, 6, 2);
            R(g, '#c8323c', x + 4, y + 8, 8, 4);
          } else {
            // Glowing red potion sign
            R(g, '#d8f0ff', x + 6, y + 6, 4, 2);
            R(g, '#ff4a55', x + 5, y + 8, 6, 4);
          }
        } else {
          // Decorative rooftop crest/lantern
          R(g, '#ffd84a88', x + 6, y + 7, 4, 4);
        }
      } else {
        // Striped festive market awning (b === 2)
        R(g, '#2a1608', x, y, T, T);
        for (let st = 0; st < 4; st++) {
          R(g, st % 2 === 0 ? awnA : awnB, x + st * 4, y + 1, 4, 11);
        }
        R(g, '#0004', x, y + 12, T, 4);
        R(g, '#ffd84a', x, y + 11, T, 1);
        // Hanging warm lanterns beside center door
        if (a === 2 || a === 4 || a === 10 || a === 12) {
          R(g, '#2a1608', x + 6, y + 10, 4, 5);
          R(g, '#ffd86a', x + 7, y + 11, 2, 3);
        }
      }
      return;
    }

    // Grand Store lower showcase facade ('V')
    R(g, '#e8d7b2', x, y, T, T);
    R(g, '#6a5842', x, y, T, 2);
    R(g, '#524c66', x, y + 12, T, 4);
    R(g, '#3a344c', x, y + 15, T, 1);
    // Pillars at outer corners
    if (a === 1 || a === 5 || a === 9 || a === 13) {
      R(g, '#8a7c66', x + 1, y, 4, 14);
      R(g, '#b8a88e', x + 2, y, 2, 13);
    }
    // Illuminated glass storefront showcase window
    R(g, '#4a2810', x + 2, y + 2, 12, 10);
    R(g, '#ffcf66', x + 3, y + 3, 10, 8);
    R(g, '#ffeaa0', x + 3, y + 3, 4, 3);
    if (isForge) {
      R(g, '#7a8ea8', x + 5, y + 5, 3, 5);
      R(g, '#d8e4f4', x + 9, y + 4, 2, 6);
    } else if (isTailor) {
      R(g, '#c8323c', x + 4, y + 5, 4, 5);
      R(g, '#2e62c8', x + 9, y + 5, 3, 5);
    } else {
      R(g, '#ff4a55', x + 4, y + 6, 3, 4);
      R(g, '#2ee06b', x + 9, y + 6, 3, 4);
    }
    return;
  }

  if (ch === 'H' || ch === 'D') {
    const bl = nb(0, 1);
    const b2 = nb(0, 2);
    const isGrandShopDoor = ch === 'D' && (M_ === 35 || M_ === 36);
    if (isGrandShopDoor) {
      R(g, '#e8d7b2', x, y, T, T);
      R(g, '#ffd84a', x, y, T, 2);
      R(g, '#4a2810', x + 1, y + 2, 14, 14);
      R(g, '#6b3f1d', x + 2, y + 3, 5, 12);
      R(g, '#6b3f1d', x + 9, y + 3, 5, 12);
      R(g, '#ffd84a', x + 6, y + 9, 1, 2);
      R(g, '#ffd84a', x + 9, y + 9, 1, 2);
      R(g, '#ffcf66', x + 3, y + 4, 3, 3);
      R(g, '#ffcf66', x + 10, y + 4, 3, 3);
      R(g, '#c8b48c', x, y + 14, T, 2);
      return;
    }
    const isShopHouse = M_ === 35 || M_ === 36;
    if (ch === 'H' && (bl === 'H' || bl === 'D')) {
      R(g, isShopHouse ? '#2a5ac0' : '#b8382a', x, y, T, T);
      for (let r = 0; r < 4; r++) {
        R(g, isShopHouse ? '#1c3e88' : '#8e2a20', x, y + r * 4 + 3, T, 1);
        R(g, isShopHouse ? '#1c3e88' : '#8e2a20', x + ((r + a) % 2 ? 4 : 10), y + r * 4, 1, 3);
        R(g, isShopHouse ? '#4882e8' : '#d4503f', x + ((r + a) % 2 ? 5 : 11), y + r * 4, 2, 1);
      }
      R(g, isShopHouse ? '#6aa2ff' : '#e8604f', x, y, T, 1);
      if (bl === 'D' || (bl === 'H' && b2 !== 'H' && b2 !== 'D')) R(g, '#3a1a12', x, y + 13, T, 3);
    } else {
      R(g, '#efe0b0', x, y, T, T);
      R(g, '#c9b57e', x, y + 5, T, 1);
      R(g, '#c9b57e', x, y + 10, T, 1);
      R(g, '#b89a60', x, y + 14, T, 2);
      if (ch === 'H') {
        R(g, '#7a4f22', x + 3, y + 2, 10, 8);
        // Glowing golden house windows at night!
        R(g, nightFactor > 0.35 ? '#ffd468' : '#8fd0ff', x + 4, y + 3, 8, 6);
        R(g, '#fff8', x + 4, y + 3, 3, 2);
        R(g, '#7a4f22', x + 7, y + 3, 1, 6);
      } else {
        R(g, '#7a4f22', x + 1, y + 1, 14, 15);
        R(g, '#3b2412', x + 2, y + 2, 12, 14);
        R(g, '#2a1608', x + 2, y + 2, 12, 3);
        R(g, '#6b3f1d', x + 3, y + 5, 4, 11);
        R(g, '#ffd84a', x + 11, y + 10, 2, 2);
        R(g, '#b0a07a', x, y + 14, T, 2);
      }
    }
  }
}

function drawPerson(g: CanvasRenderingContext2D, n: Npc, t: number): void {
  const x = n.x * 16;
  const y = n.y * 16;
  const k = n.kind || 'villager';
  const phase = n.x * 11 + n.y * 7;
  const bob = ((t >> 5) + n.x) & 1;
  const sway = ((t >> 4) + phase) & 1;
  const blink = ((t + phase * 13) % 190) > 184;
  const h = hs(n.x, n.y);
  const Y = y + (bob ? 1 : 0);

  // Soft ground contact shadow
  R(g, '#0005', x + 2, y + 14, 12, 2);
  R(g, '#0003', x + 3, y + 13, 10, 1);

  // Cobertura listrada das barracas do mercado central.
  if (n.stall) {
    const { awning, stripe } = n.stall;
    R(g, '#2a1a1055', x - 3, y - 7, 22, 2);
    R(g, awning, x - 2, y - 6, 20, 5);
    for (let sx = 0; sx < 20; sx += 4) R(g, stripe, x - 2 + sx, y - 6, 2, 5);
    R(g, '#ffffff44', x - 2, y - 6, 20, 1);
    for (let sx = 0; sx < 20; sx += 4) R(g, stripe, x - 2 + sx, y - 1, 2, 2);
    R(g, awning, x - 1, y - 3, 18, 1);
  }

  if (k === 'child') {
    // Detailed Child Sprite (Lino / Village Kid)
    const hair = h % 2 === 0 ? '#e6a825' : '#7a441e';
    const hairHi = h % 2 === 0 ? '#ffe478' : '#b8723a';
    // Little boots
    R(g, '#2a1608', x + 4, y + 13, 3, 2);
    R(g, '#2a1608', x + 9, y + 13, 3, 2);
    // Tunic & overalls
    R(g, '#1f1208', x + 4, Y + 8, 8, 6);
    R(g, n.c, x + 5, Y + 9, 6, 4);
    R(g, '#ffffff55', x + 5, Y + 9, 6, 1);
    R(g, '#6b3f1d', x + 5, Y + 12, 6, 1);
    R(g, '#ffd84a', x + 7, Y + 12, 2, 1);
    // Arms
    R(g, '#f5c99a', x + 3, Y + 9 + sway, 2, 3);
    R(g, '#f5c99a', x + 11, Y + 10 - sway, 2, 3);
    // Head & rosy cheeks
    R(g, '#3a2410', x + 4, Y + 3, 8, 6);
    R(g, '#f5c99a', x + 5, Y + 4, 6, 4);
    R(g, '#e0a574', x + 5, Y + 7, 6, 1);
    R(g, '#f2908a', x + 5, Y + 6, 1, 1);
    R(g, '#f2908a', x + 10, Y + 6, 1, 1);
    if (!blink) {
      R(g, '#222', x + 6, Y + 5, 1, 2);
      R(g, '#222', x + 9, Y + 5, 1, 2);
      R(g, '#fff', x + 6, Y + 5, 1, 1);
      R(g, '#fff', x + 9, Y + 5, 1, 1);
    } else {
      R(g, '#5a3a22', x + 6, Y + 6, 1, 1);
      R(g, '#5a3a22', x + 9, Y + 6, 1, 1);
    }
    // Spiky hair tuft
    R(g, hair, x + 4, Y + 1, 8, 3);
    R(g, hairHi, x + 5, Y + 1, 5, 1);
    R(g, hair, x + 7, Y, 3, 1);
    // Toy wooden sword in hand
    R(g, '#8a5a2a', x + 12, Y + 7 - sway, 2, 4);
    R(g, '#c98b3c', x + 11, Y + 9 - sway, 4, 1);
    return;
  }

  // Boots for all adult NPCs
  R(g, '#1f1208', x + 3, y + 13, 4, 2);
  R(g, '#1f1208', x + 9, y + 13, 4, 2);
  R(g, '#6b3f1d', x + 4, y + 13, 2, 1);
  R(g, '#6b3f1d', x + 10, y + 13, 2, 1);

  if (k === 'guard') {
    // Royal Knight / Guard: gleaming steel plate, crimson tabard, crested helm & halberd
    R(g, '#262e3d', x + 2, Y + 6, 12, 8);
    R(g, '#6c7c96', x + 3, Y + 7, 10, 6);
    R(g, '#b8cae0', x + 4, Y + 7, 8, 2);
    // Crimson tabard & gold belt
    R(g, '#a8222a', x + 6, Y + 8, 4, 5);
    R(g, '#e04850', x + 7, Y + 8, 2, 4);
    R(g, '#6b3f1d', x + 3, Y + 11, 10, 1);
    R(g, '#ffd84a', x + 7, Y + 11, 2, 1);
    // Pauldrons & gauntlets
    R(g, '#9fb2cc', x + 1, Y + 7, 2, 3);
    R(g, '#9fb2cc', x + 13, Y + 7, 2, 3);
    R(g, '#4b576b', x + 1, Y + 10, 2, 2);
    R(g, '#4b576b', x + 13, Y + 10, 2, 2);
    // Face inside visor
    R(g, '#262e3d', x + 3, Y + 1, 10, 6);
    R(g, '#f5c99a', x + 5, Y + 4, 6, 3);
    if (!blink) {
      R(g, '#1a202c', x + 5, Y + 5, 2, 1);
      R(g, '#1a202c', x + 9, Y + 5, 2, 1);
    }
    // Knight Helm + Plume
    R(g, '#7c8ea8', x + 3, Y, 10, 4);
    R(g, '#dceaff', x + 4, Y + 1, 7, 2);
    R(g, '#fff', x + 5, Y + 1, 3, 1);
    R(g, '#961e26', x + 6, Y - 3, 4, 3);
    R(g, '#e6424a', x + 7 - sway, Y - 3, 3, 2);
    // Gleaming Halberd Spear
    R(g, '#4a2a12', x + 14, Y + 1, 1, 13);
    R(g, '#8fa4bf', x + 13, Y - 2, 3, 4);
    R(g, '#eef6ff', x + 14, Y - 3, 1, 4);
    R(g, '#ffd84a', x + 13, Y + 2, 3, 1);
  } else if (k === 'mage') {
    // Arcane Mage / Sage Orion: layered mystic robes, starry hat, white beard & glowing orb staff
    R(g, '#180c38', x + 2, Y + 6, 12, 8);
    R(g, '#3b1e82', x + 3, Y + 7, 10, 6);
    R(g, '#5a32b8', x + 4, Y + 7, 4, 5);
    R(g, '#ffd84a', x + 3, Y + 12, 10, 1); // Gold robe hem
    R(g, '#ffd84a', x + 7, Y + 8, 2, 4); // Arcane sash
    // Sleeves & hands
    R(g, '#2a1460', x + 1, Y + 8, 2, 4);
    R(g, '#2a1460', x + 13, Y + 8, 2, 4);
    R(g, '#f5c99a', x + 1, Y + 11, 2, 1);
    R(g, '#f5c99a', x + 13, Y + 11, 2, 1);
    // Face + wise beard
    R(g, '#2a1608', x + 3, Y + 2, 10, 6);
    R(g, '#f5c99a', x + 4, Y + 3, 8, 4);
    if (!blink) {
      R(g, '#1c1038', x + 5, Y + 4, 2, 2);
      R(g, '#1c1038', x + 9, Y + 4, 2, 2);
      R(g, '#88ecff', x + 5, Y + 4, 1, 1);
      R(g, '#88ecff', x + 9, Y + 4, 1, 1);
    }
    R(g, '#d8e0f0', x + 5, Y + 6, 6, 3);
    R(g, '#ffffff', x + 6, Y + 6, 4, 2);
    // Tall pointed sorcerer hat with gold crescent band
    R(g, '#1c0e44', x + 1, Y + 2, 14, 2);
    R(g, '#3b1e82', x + 3, Y - 1, 10, 3);
    R(g, '#5830b5', x + 5, Y - 3, 6, 2);
    R(g, '#7348d8', x + 7 - sway, Y - 4, 3, 2);
    R(g, '#ffd84a', x + 3, Y + 1, 10, 1);
    // Arcane Staff with pulsing glowing orb
    R(g, '#5a3214', x + 14, Y + 3, 1, 11);
    R(g, '#ffd84a', x + 13, Y + 2, 3, 1);
    R(g, sway ? '#5ce1ff' : '#d688ff', x + 13, Y - 1, 3, 3);
    R(g, '#ffffff', x + 14, Y, 1, 1);
  } else if (k === 'blacksmith') {
    // Master Blacksmith: crimson bandana, muscular arms, stitched leather apron & heavy forge hammer
    R(g, '#2a1608', x + 2, Y + 6, 12, 8);
    R(g, n.c, x + 3, Y + 7, 10, 6);
    // Bare muscular arms
    R(g, '#e8b688', x + 1, Y + 7, 2, 5);
    R(g, '#e8b688', x + 13, Y + 7, 2, 5);
    R(g, '#c48654', x + 1, Y + 10, 2, 2);
    // Heavy stitched leather apron
    R(g, '#4f2c12', x + 4, Y + 7, 8, 7);
    R(g, '#7a4921', x + 5, Y + 8, 6, 5);
    R(g, '#ffd84a', x + 5, Y + 8, 1, 1);
    R(g, '#ffd84a', x + 10, Y + 8, 1, 1);
    R(g, '#2a1608', x + 4, Y + 11, 8, 1);
    // Head + rugged stubble + brows
    R(g, '#2a1608', x + 3, Y + 1, 10, 6);
    R(g, '#e8b688', x + 4, Y + 3, 8, 4);
    R(g, '#7a4a2a', x + 5, Y + 6, 6, 1);
    if (!blink) {
      R(g, '#222', x + 5, Y + 4, 2, 2);
      R(g, '#222', x + 9, Y + 4, 2, 2);
      R(g, '#fff', x + 5, Y + 4, 1, 1);
      R(g, '#fff', x + 9, Y + 4, 1, 1);
    }
    // Crimson smithing bandana + knot tails
    R(g, '#961c1c', x + 3, Y + 1, 10, 2);
    R(g, '#e03e36', x + 4, Y + 1, 7, 1);
    R(g, '#c02822', x + 13, Y + 2 + sway, 2, 2);
    // Heavy Iron Forging Hammer
    R(g, '#5a3214', x + 14, Y + 4, 1, 8);
    R(g, '#5a6278', x + 12, Y + 2, 5, 3);
    R(g, '#c2ccde', x + 12, Y + 2, 4, 1);
  } else if (k === 'merchant') {
    const isTailor = n.shopId === 'tailor';
    if (isTailor) {
      // Costureira Clara: plum velvet gown, gold lace collar, braided hair with golden ribbon
      R(g, '#361348', x + 2, Y + 6, 12, 8);
      R(g, '#8e44ad', x + 3, Y + 7, 10, 7);
      R(g, '#b86be0', x + 4, Y + 7, 4, 5);
      R(g, '#fff', x + 5, Y + 7, 6, 2);
      R(g, '#ffd84a', x + 4, Y + 11, 8, 1);
      // Arms
      R(g, '#f5c99a', x + 1, Y + 8, 2, 4);
      R(g, '#f5c99a', x + 13, Y + 8, 2, 4);
      // Face + blush
      R(g, '#3a1f10', x + 3, Y + 1, 10, 6);
      R(g, '#f5c99a', x + 4, Y + 3, 8, 4);
      R(g, '#f28b92', x + 4, Y + 5, 1, 1);
      R(g, '#f28b92', x + 11, Y + 5, 1, 1);
      if (!blink) {
        R(g, '#222', x + 5, Y + 4, 2, 2);
        R(g, '#222', x + 9, Y + 4, 2, 2);
        R(g, '#fff', x + 5, Y + 4, 1, 1);
        R(g, '#fff', x + 9, Y + 4, 1, 1);
      }
      // Chestnut hair + golden hairpin
      R(g, '#6e381a', x + 3, Y, 10, 3);
      R(g, '#9a542c', x + 4, Y + 1, 6, 1);
      R(g, '#6e381a', x + 3, Y + 3, 1, 4);
      R(g, '#6e381a', x + 12, Y + 3, 1, 4);
      R(g, '#ffd84a', x + 10, Y + 1, 3, 2);
      // Bolt of royal cloth / ribbon in hand
      R(g, '#ff6a88', x + 13, Y + 8, 3, 4);
      R(g, '#ffd84a', x + 13, Y + 9, 3, 1);
    } else {
      // Rich Guild Merchant: velvet coat, white cravat, feathered beret & golden rupee pouch
      R(g, '#2a1608', x + 2, Y + 6, 12, 8);
      R(g, n.c, x + 3, Y + 7, 10, 6);
      R(g, '#ffffff', x + 6, Y + 7, 4, 2);
      R(g, '#ffd84a', x + 5, Y + 7, 1, 5);
      R(g, '#ffd84a', x + 10, Y + 7, 1, 5);
      R(g, '#4a2810', x + 3, Y + 11, 10, 1);
      R(g, '#ffd84a', x + 7, Y + 11, 2, 1);
      // Sleeves & hands
      R(g, '#f5c99a', x + 1, Y + 8, 2, 4);
      R(g, '#f5c99a', x + 13, Y + 8, 2, 4);
      // Face + friendly mustache
      R(g, '#2a1608', x + 3, Y + 1, 10, 6);
      R(g, '#f5c99a', x + 4, Y + 3, 8, 4);
      R(g, '#7a4a24', x + 5, Y + 6, 6, 1);
      if (!blink) {
        R(g, '#222', x + 5, Y + 4, 2, 2);
        R(g, '#222', x + 9, Y + 4, 2, 2);
        R(g, '#fff', x + 5, Y + 4, 1, 1);
        R(g, '#fff', x + 9, Y + 4, 1, 1);
      }
      // Feathered Merchant Cap
      R(g, '#4a2810', x + 2, Y + 1, 12, 2);
      R(g, '#7a421e', x + 3, Y, 10, 2);
      R(g, '#ffd84a', x + 4 - sway, Y - 2, 3, 2);
      R(g, '#fff8c8', x + 5 - sway, Y - 2, 1, 1);
      // Plump Gold Pouch + Emerald Rupee on hip
      R(g, '#d49a1a', x + 11, Y + 9, 4, 4);
      R(g, '#ffe98a', x + 12, Y + 10, 2, 2);
      R(g, '#2ee06b', x + 12, Y + 11, 1, 1);
    }
  } else if (k === 'explorer') {
    // Frontier Ranger / Explorer: hooded cloak, leather satchel, bedroll backpack & compass
    R(g, '#261a0e', x + 2, Y + 6, 12, 8);
    R(g, '#523e24', x + 3, Y + 7, 10, 6);
    R(g, '#7a5e38', x + 4, Y + 7, 8, 3);
    // Cross-body leather strap
    R(g, '#8a5224', x + 4, Y + 7, 2, 2);
    R(g, '#8a5224', x + 6, Y + 9, 2, 2);
    R(g, '#8a5224', x + 8, Y + 11, 2, 2);
    // Arms
    R(g, '#f5c99a', x + 1, Y + 8, 2, 4);
    R(g, '#f5c99a', x + 13, Y + 8, 2, 4);
    // Face shaded under hood
    R(g, '#3a2a16', x + 3, Y, 10, 7);
    R(g, '#e8bc8e', x + 4, Y + 3, 8, 4);
    if (!blink) {
      R(g, '#222', x + 5, Y + 4, 2, 2);
      R(g, '#222', x + 9, Y + 4, 2, 2);
      R(g, '#fff', x + 5, Y + 4, 1, 1);
      R(g, '#fff', x + 9, Y + 4, 1, 1);
    }
    // Hooded peak & trim
    R(g, '#664e2e', x + 3, Y, 10, 3);
    R(g, '#8a6c42', x + 5, Y - 1, 6, 2);
    // Backpack & rolled blanket
    R(g, '#8a5224', x + 12, Y + 5, 3, 6);
    R(g, '#d8c492', x + 12, Y + 4, 3, 2);
  } else if (k === 'elder') {
    // Village Elder Aldor: ornate crimson-gold robe, long flowing silver beard & amber-crystal staff
    R(g, '#2a1018', x + 2, Y + 6, 12, 8);
    R(g, '#8c2232', x + 3, Y + 7, 10, 6);
    R(g, '#c43a4e', x + 4, Y + 7, 8, 4);
    R(g, '#ffd84a', x + 5, Y + 7, 1, 6);
    R(g, '#ffd84a', x + 10, Y + 7, 1, 6);
    R(g, '#ffd84a', x + 3, Y + 12, 10, 1);
    // Arms
    R(g, '#8c2232', x + 1, Y + 8, 2, 3);
    R(g, '#8c2232', x + 13, Y + 8, 2, 3);
    R(g, '#f5c99a', x + 1, Y + 11, 2, 1);
    R(g, '#f5c99a', x + 13, Y + 11, 2, 1);
    // Face + silver hair + flowing layered beard
    R(g, '#96a0b4', x + 3, Y, 10, 6);
    R(g, '#f5c99a', x + 4, Y + 3, 8, 4);
    if (!blink) {
      R(g, '#222', x + 5, Y + 4, 2, 1);
      R(g, '#222', x + 9, Y + 4, 2, 1);
    }
    R(g, '#d8e0ec', x + 3, Y + 1, 10, 2);
    R(g, '#ffffff', x + 4, Y + 1, 6, 1);
    R(g, '#cfd8e8', x + 4, Y + 6, 8, 4);
    R(g, '#ffffff', x + 5, Y + 6, 6, 3);
    R(g, '#ffffff', x + 6, Y + 9, 4, 2);
    // Oak Wisdom Staff + glowing amber gem
    R(g, '#5a3214', x + 14, Y + 3, 1, 11);
    R(g, '#ffd84a', x + 13, Y + 1, 3, 3);
    R(g, sway ? '#fff8c8' : '#ffaa3a', x + 14, Y + 2, 1, 1);
  } else {
    // Rich Villager Variants (hair style, vest/shawl, apron & accessory by coordinate hash)
    const hairPalettes = [
      ['#5a3418', '#8a542c'],
      ['#261c2e', '#4c3a5c'],
      ['#a85224', '#d97a42'],
      ['#c99628', '#f2ca58'],
    ];
    const [hDark, hHi] = hairPalettes[h % hairPalettes.length];
    const hasApron = h % 2 === 0;

    R(g, '#26160a', x + 2, Y + 6, 12, 8);
    R(g, n.c, x + 3, Y + 7, 10, 6);
    R(g, '#ffffff44', x + 3, Y + 7, 10, 1);
    if (hasApron) {
      // Crisp linen apron + waist tie
      R(g, '#e8e0cf', x + 5, Y + 8, 6, 5);
      R(g, '#c4b8a0', x + 5, Y + 12, 6, 1);
    } else {
      // Leather vest + brass buckle belt
      R(g, '#4a2e1a', x + 3, Y + 7, 3, 4);
      R(g, '#4a2e1a', x + 10, Y + 7, 3, 4);
      R(g, '#5a3a1a', x + 3, Y + 11, 10, 1);
      R(g, '#ffd84a', x + 7, Y + 11, 2, 1);
    }
    // Arms & hands
    R(g, '#f5c99a', x + 1, Y + 8 + sway, 2, 4);
    R(g, '#f5c99a', x + 13, Y + 9 - sway, 2, 4);
    // Head + facial shading + eyes
    R(g, '#2a1608', x + 3, Y + 1, 10, 6);
    R(g, '#f5c99a', x + 4, Y + 3, 8, 4);
    R(g, '#dfaa7a', x + 4, Y + 6, 8, 1);
    if (!blink) {
      R(g, '#222', x + 5, Y + 4, 2, 2);
      R(g, '#222', x + 9, Y + 4, 2, 2);
      R(g, '#fff', x + 5, Y + 4, 1, 1);
      R(g, '#fff', x + 9, Y + 4, 1, 1);
    } else {
      R(g, '#5a3a22', x + 5, Y + 5, 2, 1);
      R(g, '#5a3a22', x + 9, Y + 5, 2, 1);
    }
    // Detailed Hair + side locks or headband
    R(g, hDark, x + 3, Y, 10, 3);
    R(g, hHi, x + 4, Y + 1, 6, 1);
    R(g, hDark, x + 3, Y + 3, 1, 2);
    R(g, hDark, x + 12, Y + 3, 1, 2);
    if (h % 3 === 0) {
      R(g, '#e85868', x + 10, Y + 1, 2, 2); // Hair ribbon accent
    }
  }

  // Curiosos da espada: braços estendidos e pequenos puxões rítmicos.
  if (n.swordCrowd && n.home && n.x === n.home.x && n.y === n.home.y) {
    const dx = SWORD_TILE.x - n.x;
    const dy = SWORD_TILE.y - n.y;
    const ax = dx > 0 ? x + 13 : dx < 0 ? x + 1 : x + 7;
    const ay = dy > 0 ? Y + 10 : dy < 0 ? Y + 2 : Y + 6;
    const tug = Math.sin(t / 7 + phase) > 0 ? 1 : 0;
    R(g, '#f5c99a', ax, ay - tug, 2, 3);
    R(g, '#fff8c8', ax, ay - tug, 1, 1);
  }

  // Floating golden trade badge for all merchants
  if (n.shopId) {
    const floatY = y - 7 + (sway ? 1 : 0);
    R(g, '#0a0718cc', x + 5, floatY - 1, 6, 6);
    R(g, '#ffd84a', x + 6, floatY, 4, 4);
    R(g, '#fff8c8', x + 7, floatY + 1, 2, 2);
  }
}

function drawHeroSwordSwing(
  g: CanvasRenderingContext2D,
  G: HeroState,
  V: ProgressState,
  hx: number,
  hy: number,
): void {
  if (G.sw <= 0) return;
  const d = G.dir;
  const swDef = SWORD_STATS[V.swordTier] || SWORD_STATS.lendaria;
  const progress = Math.max(0, Math.min(1, (14 - G.sw) / 13));
  const ease = 1 - Math.pow(1 - progress, 2.3);
  const baseAng = d === 0 ? -Math.PI / 2 : d === 1 ? 0 : d === 2 ? Math.PI / 2 : Math.PI;
  const sweep = 2.38;
  const curAng = baseAng + (ease - 0.5) * sweep;
  const trailFrom = baseAng + (Math.max(0, ease - 0.52) - 0.5) * sweep;

  // Pivot anchored strictly outside hero's head/torso silhouette
  const px = d === 1 ? hx + 13 : d === 3 ? hx + 3 : hx + 8;
  const py = d === 0 ? hy + 1 : d === 2 ? hy + 13 : hy + 8;

  const arcColor =
    V.swordTier === 'solar'
      ? 'rgba(255, 130, 40, '
      : V.swordTier === 'runica'
        ? 'rgba(55, 195, 255, '
        : V.swordTier === 'aco'
          ? 'rgba(255, 210, 65, '
          : 'rgba(135, 230, 255, ';

  const fade = Math.max(0.12, 1 - progress * 0.78);

  // Sleek crescent slash trail behind blade
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = `${arcColor}${(0.26 * fade).toFixed(3)})`;
  g.lineWidth = 3.5;
  g.beginPath();
  g.arc(px, py, 14.5, trailFrom, curAng);
  g.stroke();

  g.strokeStyle = swDef.blade;
  g.globalAlpha = 0.54 * fade;
  g.lineWidth = 1.8;
  g.beginPath();
  g.arc(px, py, 15.5, Math.max(trailFrom, curAng - 0.8), curAng);
  g.stroke();

  g.strokeStyle = '#ffffff';
  g.globalAlpha = 0.68 * fade;
  g.lineWidth = 1;
  g.beginPath();
  g.arc(px, py, 16.5, Math.max(trailFrom, curAng - 0.5), curAng);
  g.stroke();
  g.restore();

  // Crisp rotated pixel-art blade extending outward from hero hand
  g.save();
  g.translate(px, py);
  g.rotate(curAng);

  // Hand gripping hilt & metallic pommel
  g.fillStyle = '#c98b3c';
  g.fillRect(-1, -1.5, 2, 3);
  g.fillStyle = '#f5c99a';
  g.fillRect(1, -1.5, 2.5, 3);

  // Crossguard
  g.fillStyle = '#ffd84a';
  g.fillRect(3.5, -3.5, 2, 7);
  g.fillStyle = '#fff6b8';
  g.fillRect(3.5, -2.5, 1, 5);

  // Blade body + sharp luminous cutting edge & tip
  g.fillStyle = swDef.edge;
  g.fillRect(5.5, -2, 12.5, 4);
  g.fillStyle = swDef.blade;
  g.fillRect(5.5, -1.2, 12.5, 2.4);
  g.fillStyle = '#ffffff';
  g.fillRect(6.5, -1.5, 11, 1);
  g.fillRect(18, -1, 2, 2);
  g.restore();
}

function drawHero(
  g: CanvasRenderingContext2D,
  G: HeroState,
  V: ProgressState,
  input: Record<KeyCode, boolean>,
  analogActive: boolean,
  t: number,
): void {
  const lunge =
    G.sw > 0 ? Math.round(Math.sin((Math.max(0, Math.min(1, (14 - G.sw) / 13))) * Math.PI) * 2) : 0;
  const x = (G.x | 0) + (G.dir === 1 ? lunge : G.dir === 3 ? -lunge : 0);
  const y = (G.y | 0) + (G.dir === 2 ? lunge : G.dir === 0 ? -lunge : 0);
  const d = G.dir;
  if (G.inv > 0 && ((G.inv >> 2) & 1)) return;
  const oc = OUTFIT_COLORS[V.outfit] || OUTFIT_COLORS.verde;

  if (G.sleeping) {
    const wt = G.wakeTimer ?? 0;
    const breath = (t >> 4) & 1;

    if (wt === 0) {
      // Hero tucked horizontally into the corner bed while text plays or waiting for button
      R(g, '#f5c99a', x + 1, y + 5, 6, 6);
      R(g, oc.dark, x - 1, y + 4, 5, 6);
      R(g, oc.cap, x, y + 5, 4, 4);
      if (G.dlg) {
        // Closed peaceful eyes + Zzz while opening text plays
        R(g, '#3a2410', x + 3, y + 7, 2, 1);
        R(g, '#3a2410', x + 3, y + 9, 2, 1);
        const z1 = (t >> 3) % 10;
        const z2 = ((t + 16) >> 3) % 10;
        tx(g, 'Z', x + 6, y - 2 - z1, '#ffe98a', 'left', '#1a1230');
        tx(g, 'z', x + 12, y - 6 - z2, '#8fd0ff', 'left', '#1a1230');
      } else {
        // Text finished: eyes open awake in bed waiting for any button press!
        R(g, '#222', x + 3, y + 6, 2, 2);
        R(g, '#fff', x + 4, y + 6, 1, 1);
        R(g, '#222', x + 3, y + 9, 2, 2);
        R(g, '#fff', x + 4, y + 9, 1, 1);
      }
      // Cozy blanket matching hero outfit
      R(g, '#324ec0', x + 6, y + 6, 16, 8);
      R(g, '#4f6ee6', x + 7, y + 7, 14, 6);
      R(g, '#8aa4ff', x + 6, y + 6, 2, 8);
      R(g, oc.main, x + 8, y + 8 + breath, 10, 4);
      return;
    }

    if (wt > 25) {
      // Stage A: Sitting up & stretching awake in bed!
      const stretch = ((44 - wt) >> 2) & 1;
      // Blanket pushed back on right half of bed
      R(g, '#324ec0', x + 11, y + 7, 11, 7);
      R(g, '#4f6ee6', x + 12, y + 8, 9, 5);
      // Hero sitting upright on bed
      const sy = y - 1 - stretch;
      R(g, oc.dark, x + 2, sy + 6, 12, 6);
      R(g, oc.main, x + 3, sy + 7, 10, 5);
      R(g, '#f5c99a', x + 0, sy + 3 - stretch, 3, 4); // Stretching left arm up!
      R(g, '#f5c99a', x + 13, sy + 3 - stretch, 3, 4); // Stretching right arm up!
      R(g, '#3a2410', x + 3, sy + 1, 10, 7);
      R(g, '#f5c99a', x + 4, sy + 3, 8, 5);
      R(g, oc.dark, x + 2, sy - 1, 12, 4);
      R(g, oc.cap, x + 3, sy, 10, 3);
      R(g, '#222', x + 5, sy + 5, 2, 2);
      R(g, '#222', x + 9, sy + 5, 2, 2);
      R(g, '#fff', x + 5, sy + 5, 1, 1);
      R(g, '#fff', x + 9, sy + 5, 1, 1);
      tx(g, '!', x + 8, sy - 9, '#ffd84a', 'center', '#1a1230');
      return;
    }

    // Stage B (wt <= 25): Parabolic jump out of bed onto the floor!
    const tJump = (25 - wt) / 25;
    const arcLift = Math.round(Math.sin(tJump * Math.PI) * 15);
    const jy = y - arcLift;
    // Ground shadow stays on floor level
    R(g, '#0005', x + 3, y + 13, arcLift > 8 ? 10 : 12, 3);
    // Jumping hero pose
    R(g, '#2a1608', x + 3, jy + 12, 4, 3);
    R(g, '#2a1608', x + 9, jy + 12, 4, 3);
    R(g, oc.dark, x + 2, jy + 6, 12, 7);
    R(g, oc.main, x + 3, jy + 7, 10, 5);
    R(g, oc.light, x + 3, jy + 7, 10, 1);
    R(g, '#6b3f1d', x + 3, jy + 10, 10, 1);
    R(g, '#ffd84a', x + 7, jy + 10, 2, 1);
    R(g, '#f5c99a', x + 0, jy + 5, 3, 3);
    R(g, '#f5c99a', x + 13, jy + 5, 3, 3);
    R(g, '#3a2410', x + 3, jy + 1, 10, 8);
    R(g, '#f5c99a', x + 4, jy + 3, 8, 5);
    R(g, oc.dark, x + 2, jy - 1, 12, 5);
    R(g, oc.cap, x + 3, jy, 10, 3);
    R(g, oc.dark, x + 12, jy - 3, 5, 4);
    R(g, oc.cap, x + 13, jy - 2, 3, 3);
    R(g, '#222', x + 5, jy + 5, 2, 2);
    R(g, '#222', x + 9, jy + 5, 2, 2);
    R(g, '#fff', x + 5, jy + 5, 1, 1);
    R(g, '#fff', x + 9, jy + 5, 1, 1);
    return;
  }

  const w = (G.wk >> 3) & 1;
  const mv = analogActive || input.u || input.d || input.l || input.r;
  const Y = y + (mv && w ? 1 : 0);
  const l = mv && w ? 1 : 0;

  // When facing UP (d === 0), render sword swing BEHIND hero so blade never crosses body or head!
  if (G.sw > 0 && d === 0) {
    drawHeroSwordSwing(g, G, V, x, Y);
  }

  R(g, '#0004', x + 2, y + 13, 12, 3);
  R(g, '#2a1608', x + 3 + l, y + 12, 4, 3);
  R(g, '#2a1608', x + 9 - l, y + 12, 4, 3);
  R(g, '#8a5a2a', x + 4 + l, y + 12, 2, 1);
  R(g, '#8a5a2a', x + 10 - l, y + 12, 2, 1);

  R(g, oc.dark, x + 2, Y + 6, 12, 7);
  R(g, oc.main, x + 3, Y + 7, 10, 5);
  R(g, oc.light, x + 3, Y + 7, 10, 1);
  R(g, oc.shade, x + 3, Y + 11, 10, 1);
  R(g, '#6b3f1d', x + 3, Y + 10, 10, 1);
  R(g, '#ffd84a', x + 7, Y + 10, 2, 1);

  if (!(G.sw > 0 && d === 3)) R(g, '#f5c99a', x + 1, Y + 8 + w, 2, 3);
  if (!(G.sw > 0 && d === 1)) R(g, '#f5c99a', x + 13, Y + 9 - w, 2, 3);
  R(g, '#3a2410', x + 3, Y + 1, 10, 8);
  R(g, '#f5c99a', x + 4, Y + 3, 8, 5);
  R(g, '#d9a441', x + 3, Y + 3, 1, 3);
  R(g, '#d9a441', x + 12, Y + 3, 1, 3);

  R(g, oc.dark, x + 2, Y - 1, 12, 5);
  R(g, oc.cap, x + 3, Y, 10, 3);
  R(g, oc.light, x + 4, Y, 5, 1);
  if (d === 3) {
    R(g, oc.dark, x - 1, Y - 3, 5, 4);
    R(g, oc.cap, x, Y - 2, 3, 3);
  } else {
    R(g, oc.dark, x + 12, Y - 3, 5, 4);
    R(g, oc.cap, x + 13, Y - 2, 3, 3);
  }

  if (d === 2) {
    R(g, '#222', x + 5, Y + 5, 2, 2);
    R(g, '#222', x + 9, Y + 5, 2, 2);
    R(g, '#fff', x + 5, Y + 5, 1, 1);
    R(g, '#fff', x + 9, Y + 5, 1, 1);
    R(g, '#e89', x + 4, Y + 7, 1, 1);
  } else if (d === 1) {
    R(g, '#222', x + 10, Y + 5, 2, 2);
    R(g, '#fff', x + 10, Y + 5, 1, 1);
  } else if (d === 3) {
    R(g, '#222', x + 4, Y + 5, 2, 2);
    R(g, '#fff', x + 4, Y + 5, 1, 1);
  } else {
    R(g, '#d9a441', x + 4, Y + 3, 8, 5);
  }

  // Lit torch in off-hand
  if (V.torchLit) {
    const txPos = d === 1 ? x + 13 : d === 3 ? x : x + 13;
    const tyPos = Y + 4;
    const fl = (t >> 2) & 1;
    R(g, '#6b3f1d', txPos, tyPos + 3, 2, 6);
    R(g, '#ff6a1a', txPos - 1, tyPos + fl, 4, 4);
    R(g, '#ffe98a', txPos, tyPos + 1, 2, 2);
  }

  // Equipped shield (held forward when guarding with B)
  if (V.shield !== 'none' && G.sw === 0) {
    const sc = SHIELD_STATS[V.shield];
    if (G.shielding) {
      if (d === 0) {
        R(g, sc.trim, x + 3, Y - 2, 10, 5);
        R(g, sc.color, x + 4, Y - 1, 8, 3);
      } else if (d === 2) {
        R(g, sc.trim, x + 3, Y + 8, 10, 6);
        R(g, sc.color, x + 4, Y + 9, 8, 4);
        R(g, '#fff8', x + 7, Y + 10, 2, 2);
      } else if (d === 1) {
        R(g, sc.trim, x + 13, Y + 5, 3, 8);
        R(g, sc.color, x + 14, Y + 6, 2, 6);
      } else {
        R(g, sc.trim, x, Y + 5, 3, 8);
        R(g, sc.color, x, Y + 6, 2, 6);
      }
    } else if (d === 2 || d === 3) {
      R(g, sc.trim, x + 1, Y + 7, 4, 6);
      R(g, sc.color, x + 2, Y + 8, 2, 4);
    }
  }

  // When facing DOWN / LEFT / RIGHT, draw sword swing in front of hero
  if (G.sw > 0 && d !== 0) {
    drawHeroSwordSwing(g, G, V, x, Y);
  }
}

function drawEnemy(g: CanvasRenderingContext2D, e: Enemy, t: number, mapId: number): void {
  const x = e.x | 0;
  const Y = e.y | 0;
  const k = e.k | 0;
  const c = ENEMY_PALETTES[k] || ENEMY_PALETTES[0];
  const bob = Math.round(Math.sin(t / 7 + e.x) * 2);

  g.save();
  if (k === 1) {
    // Bat: flying shadow + animated flapping wings + fangs
    const flap = ((t >> 2) & 1) ? 3 : -2;
    g.translate(x, Y - 3 + bob);
    R(g, '#0004', 3, 14 - bob, 10, 2);
    R(g, c[0], -3, 3 + flap, 6, 5);
    R(g, c[1], -2, 4 + flap, 5, 3);
    R(g, c[0], 13, 3 + flap, 6, 5);
    R(g, c[1], 13, 4 + flap, 5, 3);
    R(g, c[0], 4, 2, 8, 9);
    R(g, c[1], 5, 3, 6, 7);
    R(g, c[2], 4, 0, 2, 3);
    R(g, c[2], 10, 0, 2, 3);
    R(g, '#ff3a4a', 5, 5, 2, 2);
    R(g, '#ff3a4a', 9, 5, 2, 2);
    R(g, '#fff', 6, 9, 1, 1);
    R(g, '#fff', 9, 9, 1, 1);
  } else if (k === 2) {
    // Scorpion: armored body, pincers, raised stinger tail
    const step = (t >> 3) & 1;
    g.translate(x, Y);
    R(g, '#0004', 2, 13, 12, 3);
    // Claws
    R(g, c[0], 0, 7 + step, 4, 4);
    R(g, c[2], 1, 8 + step, 2, 2);
    R(g, c[0], 12, 7 - step, 4, 4);
    R(g, c[2], 13, 8 - step, 2, 2);
    // Body & legs
    R(g, c[0], 3, 7, 10, 6);
    R(g, c[1], 4, 8, 8, 4);
    R(g, c[2], 5, 8, 6, 1);
    // Curved tail
    R(g, c[0], 6, 2, 4, 6);
    R(g, c[2], 7, 1, 3, 3);
    R(g, '#ffeb55', 8, 0, 2, 2); // Stinger
    // Eyes
    R(g, '#111', 5, 10, 1, 1);
    R(g, '#111', 10, 10, 1, 1);
  } else if (k === 3) {
    // Skeleton warrior
    const w = (t >> 4) & 1;
    g.translate(x, Y);
    R(g, '#0004', 3, 14, 10, 2);
    R(g, c[0], 4, 1, 8, 6);
    R(g, c[1], 5, 2, 6, 4);
    R(g, '#181828', 6, 3, 1, 2);
    R(g, '#181828', 9, 3, 1, 2);
    R(g, c[0], 4, 7, 8, 6);
    R(g, c[2], 5, 8, 6, 1);
    R(g, c[2], 5, 10, 6, 1);
    R(g, c[1], 5 + w, 13, 2, 2);
    R(g, c[1], 9 - w, 13, 2, 2);
    // Sword
    R(g, '#9fb8e0', 13, 4 + w, 2, 7);
    R(g, '#6b3f1d', 12, 10 + w, 3, 2);
  } else if (k === 4) {
    // Boss Vorak (2x scale)
    const hover = Math.round(Math.sin(t / 10) * 2);
    g.translate(x, Y + hover);
    g.scale(2, 2);
    R(g, '#0005', 2, 13 - hover * 0.5, 12, 3);
    R(g, c[0], 2, 4, 12, 10);
    R(g, c[1], 3, 5, 10, 8);
    R(g, c[3], 4, 7, 8, 6);
    // Horned Crown
    R(g, '#ffd84a', 4, 0, 2, 3);
    R(g, '#ffd84a', 10, 0, 2, 3);
    R(g, '#ffd84a', 5, 2, 6, 2);
    // Glowing eyes
    R(g, '#140814', 4, 4, 8, 4);
    R(g, '#ff4a55', 5, 5, 2, 2);
    R(g, '#ff4a55', 9, 5, 2, 2);
    // Arcane staff
    R(g, '#5a3a1a', 14, 3, 1, 11);
    R(g, ((t >> 3) & 1) ? '#ff5aff' : '#ff9a3a', 13, 1, 3, 3);
  } else if (k === 5) {
    // Stone / Ice Golem
    const stomp = ((t >> 4) & 1) ? 1 : 0;
    g.translate(x, Y - stomp);
    R(g, '#0005', 1, 14 + stomp, 14, 2);
    R(g, c[0], 1, 3, 14, 11);
    R(g, c[1], 2, 4, 12, 9);
    R(g, c[2], 3, 4, 10, 2);
    R(g, c[3], 3, 10, 10, 3);
    R(g, '#6ad0ff', 4, 6, 2, 2);
    R(g, '#6ad0ff', 10, 6, 2, 2);
    R(g, '#6ad0ff', 7, 9, 2, 2);
  } else if (k === 6) {
    // Dark Mage
    const hover = ((t >> 4) & 1) ? -1 : 0;
    g.translate(x, Y + hover);
    R(g, '#0005', 3, 14 - hover, 10, 2);
    R(g, c[0], 3, 3, 10, 11);
    R(g, c[1], 4, 6, 8, 8);
    R(g, c[0], 5, 1, 6, 3);
    R(g, '#0a0414', 4, 4, 8, 4);
    R(g, '#ffea5a', 5, 5, 2, 2);
    R(g, '#ffea5a', 9, 5, 2, 2);
    R(g, ((t >> 3) & 1) ? '#d86aff' : '#ff5a9a', 13, 6, 3, 3);
  } else if (k === 10) {
    // Jacaré do pantano: focinho longo, escamas e cauda com dentes.
    const snap = ((t >> 3) & 1) ? 1 : 0;
    g.translate(x, Y);
    R(g, '#0004', 2, 14, 12, 2);
    // Cauda
    R(g, c[0], 0, 6, 6, 5);
    R(g, c[1], 1, 7, 4, 3);
    // Corpo e escamas
    R(g, c[0], 4, 4, 10, 9);
    R(g, c[1], 5, 5, 8, 7);
    R(g, c[3], 5, 8, 8, 3);
    for (let i = 0; i < 3; i++) R(g, c[2], 6 + i * 2, 5, 1, 2);
    // Focinho e olhos
    R(g, c[1], 12, 7 - snap, 4, 5);
    R(g, c[2], 13, 8 - snap, 3, 2);
    R(g, '#fff', 8, 5, 2, 2);
    R(g, '#111', 9, 5, 1, 1);
    R(g, '#fff', 11, 9, 2, 1);
    R(g, '#d8402e', 14, 6 + snap, 1, 1);
    if (mapId === 232) {
      // O chefe do pantano usa uma coroa de ouro musgosa.
      R(g, '#ffd84a', 6, 1, 7, 2);
      R(g, '#ffd84a', 6, 0, 2, 2);
      R(g, '#ffd84a', 9, 0, 2, 2);
      R(g, '#8cc25c', 7, 1, 1, 1);
    }
  } else {
    // Classic Slime
    const hp = Math.round(Math.abs(Math.sin(t / 8 + e.x)) * 3);
    g.translate(x, Y - hp);
    R(g, '#0004', 2, 13 + hp, 12, 3);
    R(g, c[0], 3, 4, 10, 1);
    R(g, c[0], 1, 5, 14, 10);
    R(g, c[1], 2, 5, 12, 9);
    R(g, c[2], 3, 5, 6, 3);
    R(g, c[3], 2, 12, 12, 2);
    R(g, '#fff', 4, 8, 3, 3);
    R(g, '#fff', 9, 8, 3, 3);
    R(g, '#111', 5, 9, 2, 2);
    R(g, '#111', 10, 9, 2, 2);
  }
  g.restore();

  if (e.hitFlash && e.hitFlash > 0 && (e.hitFlash & 1)) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    const fw = e.k === 4 ? 26 : 14;
    const fh = e.k === 4 ? 26 : 14;
    g.fillStyle = 'rgba(255, 250, 210, 0.72)';
    g.fillRect(x + (e.k === 4 ? 3 : 1), Y + 1, fw, fh);
    g.restore();
  }

  // Dominic do Gelo: casca de gelo azul enquanto congelado
  if (e.frozen && e.frozen > 0) {
    const fw = e.k === 4 ? 28 : 16;
    const fh = e.k === 4 ? 28 : 16;
    const fx = e.k === 4 ? x + 2 : x;
    g.save();
    g.globalAlpha = 0.55;
    g.fillStyle = '#8ce8ff';
    g.fillRect(fx, Y, fw, fh);
    g.globalAlpha = 1;
    g.strokeStyle = '#e6fbff';
    g.strokeRect(fx + 0.5, Y + 0.5, fw - 1, fh - 1);
    g.restore();
    R(g, '#bff4ff', fx + 2, Y - 3, 3, 3);
    R(g, '#eaffff', fx + fw - 6, Y - 2, 3, 3);
  }

  // Dominic do Fogo: chamas lampejando enquanto arde
  if (e.burn && e.burn > 0) {
    const fw = e.k === 4 ? 28 : 16;
    const fh = e.k === 4 ? 28 : 16;
    const fx = e.k === 4 ? x + 2 : x;
    g.save();
    g.globalAlpha = 0.42 + ((t >> 2) & 1) * 0.16;
    g.fillStyle = '#ff7a1a';
    g.fillRect(fx, Y, fw, fh);
    g.restore();
    const fy = Y + ((t >> 2) & 1);
    R(g, '#ffd84a', fx + 1, fy - 4, 3, 4);
    R(g, '#ff9a2a', fx + fw - 4, fy - 5, 3, 5);
  }

  // HP bar for damaged enemies or Boss Vorak
  const maxHp = e.maxHp || getEnemyMaxHp(mapId, e.k);
  if (e.k === 4 || e.hp < maxHp) {
    const bw = e.k === 4 ? 26 : 12;
    const bx = e.k === 4 ? x + 3 : x + 2;
    const by = Math.max(2, Y - 5);
    R(g, '#000a', bx - 1, by - 1, bw + 2, 4);
    R(g, e.k === 4 ? '#ff4a55' : '#2ee06b', bx, by, Math.max(1, ((bw * e.hp) / maxHp) | 0), 2);
  }
}

function drawProjectiles(g: CanvasRenderingContext2D, projectiles: Projectile[], t: number): void {
  for (const p of projectiles) {
    const px = p.x | 0;
    const py = p.y | 0;
    if (p.kind === 'arrow') {
      const horiz = Math.abs(p.vx) >= Math.abs(p.vy);
      if (horiz) {
        R(g, '#8a5a2a', px - 4, py - 1, 8, 2);
        R(g, '#e8f4ff', p.vx > 0 ? px + 3 : px - 5, py - 1, 3, 2);
        R(g, '#fff', p.vx > 0 ? px - 5 : px + 4, py - 2, 2, 4);
      } else {
        R(g, '#8a5a2a', px - 1, py - 4, 2, 8);
        R(g, '#e8f4ff', px - 1, p.vy > 0 ? py + 3 : py - 5, 2, 3);
        R(g, '#fff', px - 2, p.vy > 0 ? py - 5 : py + 4, 4, 2);
      }
    } else if (p.kind === 'bomb') {
      const fast = p.life < 25 ? ((t >> 1) & 1) : ((t >> 3) & 1);
      R(g, '#0005', px - 4, py + 3, 8, 2);
      R(g, fast ? '#c0392b' : '#222230', px - 4, py - 4, 8, 8);
      R(g, fast ? '#ff6a55' : '#4a4a66', px - 3, py - 3, 3, 3);
      R(g, '#ffd84a', px - 1, py - 6, 2, 2);
      R(g, fast ? '#fff' : '#ff7a2a', px, py - 7, 2, 2);
    } else if (p.kind === 'beam') {
      // Raio dos 12 corações: cor definida pelo Dominic atual.
      const c = DOMINIC_BEAM_COLORS[p.element ?? 'none'];
      const pulse = ((t >> 1) & 1) !== 0;
      R(g, '#0008', px - 5, py - 3, 10, 6);
      R(g, c.trail, px - 5 - (p.vx | 0), py - 1 - (p.vy | 0), 8, 2);
      R(g, c.glow, px - 4, py - 3, 8, 6);
      R(g, c.core, px - 3, py - 2, 6, 4);
      R(g, '#fff', px - 1, py - 1, 2, 2);
      if (pulse) R(g, c.core, px - 6, py - 1, 2, 2);
    } else if (p.kind === 'fire') {
      // Dominic do Fogo: bola de fogo com chama tremulante
      const wob = ((t >> 1) & 1) ? 1 : 0;
      R(g, '#7a2a06', px - 5, py - 4 + wob, 10, 8);
      R(g, '#ff5a12', px - 4, py - 4 - wob, 8, 8);
      R(g, '#ff9a2a', px - 3, py - 3 + wob, 6, 6);
      R(g, '#ffe47a', px - 2, py - 2 - wob, 4, 4);
      R(g, '#fffbe0', px - 1, py - 1, 2, 2);
      // Rastro de brasa
      R(g, '#ff7a1aff', px - 6 - (p.vx | 0), py - 1 - (p.vy | 0), 3, 3);
    } else {
      // Magic orb (enemy dark orb or player-deflected counter orb)
      const pulse = ((t >> 2) & 1);
      R(g, p.fromEnemy === false ? '#3ad8ff' : '#ff3a8a', px - 3, py - 3, 6, 6);
      R(g, pulse ? '#fff' : p.fromEnemy === false ? '#b8f4ff' : '#ffb8ff', px - 1, py - 1, 2, 2);
    }
  }
}

function punchLight(
  lctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  strength = 1,
): void {
  const gr = lctx.createRadialGradient(x, y, 2, x, y, r);
  gr.addColorStop(0, `rgba(0,0,0,${strength})`);
  gr.addColorStop(0.55, `rgba(0,0,0,${strength * 0.62})`);
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  lctx.fillStyle = gr;
  lctx.beginPath();
  lctx.arc(x, y, r, 0, Math.PI * 2);
  lctx.fill();
}

function addBloom(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  colorInner: string,
  colorOuter: string,
): void {
  const gr = g.createRadialGradient(x, y, 1, x, y, r);
  gr.addColorStop(0, colorInner);
  gr.addColorStop(1, colorOuter);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
}

function drawLighting(
  g: CanvasRenderingContext2D,
  world: WorldData,
  G: HeroState,
  V: ProgressState,
  t: number,
  worldTime: number,
  weather: WeatherState,
  projectiles: Projectile[],
  particles: Particle[],
): void {
  const layer = getLightLayer();
  if (!layer) return;

  const hh = isHouse(G.map);
  const isCave = !hh && G.map >= 200;
  const { nightFactor, duskFactor } = getCycleInfo(worldTime);
  const map = world.maps[G.map];
  const flicker = Math.sin(t * 0.25) * 2.5 + Math.cos(t * 0.41) * 1.5;

  // Ambient darkness level
  let darkness = 0;
  let ambR = 8;
  let ambG = 11;
  let ambB = 34;

  if (isCave) {
    darkness = G.map === 261 ? 0.96 : 0.94;
    ambR = 3;
    ambG = 3;
    ambB = 14;
  } else if (hh) {
    darkness = 0.2;
    ambR = 12;
    ambG = 9;
    ambB = 26;
  } else {
    // Fixed atmospheric starlit night across Aurora
    darkness = G.map === 4 ? 0.74 : 0.6;
    if (weather.flash > 4) {
      darkness *= Math.max(0.15, 1 - weather.flash / 16);
    }
  }

  // Subtle dusk/moon tint only if duskFactor > 0
  if (!isCave && !hh && duskFactor > 0.05) {
    g.fillStyle = `rgba(255, 130, 50, ${(duskFactor * 0.14).toFixed(3)})`;
    g.fillRect(0, 0, W, H);
  }

  const torchCenterX = G.x + (G.dir === 3 ? 3 : 12);
  const torchCenterY = G.y + 6;
  const hx = V.torchLit ? torchCenterX : G.x + 8;
  const hy = V.torchLit ? torchCenterY : G.y + 8;

  const lctx = layer.ctx;
  if (darkness > 0.02) {
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, W, H);
    lctx.fillStyle = `rgba(${ambR}, ${ambG}, ${ambB}, ${darkness.toFixed(3)})`;
    lctx.fillRect(0, 0, W, H);

    // Punch light cutouts into fixed nocturnal / cave lightmap
    lctx.globalCompositeOperation = 'destination-out';

    if (V.torchLit) {
      // Multi-stage warm hero torch halo cutout
      const torchR = (isCave ? 118 : 126) + flicker * 1.6;
      punchLight(lctx, hx, hy, torchR, 1.0);
      punchLight(lctx, G.x + 8, G.y + 8, 48 + flicker * 0.6, 0.96);
    } else if (isCave) {
      // Tight survival halo when exploring dark caves without a torch
      punchLight(lctx, hx, hy, 31 + flicker * 0.35, 0.9);
    } else {
      // Comfortable moonlit personal halo at night
      punchLight(lctx, hx, hy, 70 + flicker * 0.45, 0.95);
    }

    // Fixed world light emitters interacting seamlessly with hero halo
    if (map) {
      for (let b = 0; b < 10; b++) {
        for (let a = 0; a < 15; a++) {
          const ch = map[b][a];
          const txp = a * 16 + 8;
          const typ = b * 16 + 8;
          if (ch === 't') punchLight(lctx, txp, typ, 62 + flicker, 0.99);
          else if (ch === 'L') punchLight(lctx, txp, typ - 2, 72 + flicker * 0.6, 0.99);
          else if (ch === 'u') punchLight(lctx, txp, typ, 82 + flicker, 1.0);
          else if (ch === 'y') punchLight(lctx, txp, typ - 1, 44, 0.8);
          else if (ch === 'x') punchLight(lctx, txp, typ, 38, 0.78);
          else if (ch === 'S' && !V.sword) punchLight(lctx, txp, typ, 56 + flicker * 0.5, 0.96);
          else if (ch === 'G') punchLight(lctx, txp, typ, 48, 0.88);
          else if (ch === 'V' || (ch === 'D' && (G.map === 35 || G.map === 36))) {
            punchLight(lctx, txp, typ, 54, 0.85);
          } else if (ch === 'Y') {
            punchLight(lctx, txp, typ, 44, 0.76);
          } else if (ch === 'H' && nightFactor > 0.35 && map[b + 1]?.[a] !== 'H') {
            punchLight(lctx, txp, typ, 36, 0.62);
          }
        }
      }
    }

    for (const p of projectiles) {
      punchLight(lctx, p.x, p.y, p.kind === 'orb' ? 34 : p.kind === 'fire' ? 38 : 24, 0.88);
    }
    if (G.sw > 0) {
      const sx = G.x + 8 + (G.dir === 1 ? 14 : G.dir === 3 ? -14 : 0);
      const sy = G.y + 8 + (G.dir === 0 ? -14 : G.dir === 2 ? 14 : 0);
      punchLight(lctx, sx, sy, 20, 0.42);
    }
    for (const pt of particles) {
      if (pt.glow) punchLight(lctx, pt.x, pt.y, pt.kind === 'ring' ? 18 : 14, 0.48);
    }

    g.drawImage(layer.canvas, 0, 0);
  }

  // Cave edge depth vignette for subterranean atmosphere
  if (isCave) {
    const vig = g.createRadialGradient(hx, hy, V.torchLit ? 55 : 22, W / 2, H / 2, 165);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, V.torchLit ? 'rgba(4,2,14,0.38)' : 'rgba(2,1,10,0.68)');
    g.fillStyle = vig;
    g.fillRect(0, 0, W, H);
  }

  // Shader Additive Volumetric Halo & Bloom Pass
  g.save();
  g.globalCompositeOperation = 'lighter';

  if (V.torchLit) {
    const pulse = Math.sin(t * 0.14) * 2.5;
    // Outer warm amber wash
    addBloom(g, hx, hy, 88 + flicker * 1.4, 'rgba(255, 135, 40, 0.22)', 'rgba(255, 70, 10, 0)');
    // Inner golden core halo
    addBloom(g, hx, hy, 38 + flicker * 0.7, 'rgba(255, 225, 115, 0.32)', 'rgba(255, 130, 25, 0)');
    // Volumetric concentric halo rings
    g.strokeStyle = `rgba(255, 190, 90, ${(0.15 + 0.04 * Math.sin(t * 0.16)).toFixed(3)})`;
    g.lineWidth = 1.25;
    g.beginPath();
    g.arc(hx, hy, 26 + pulse, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = 'rgba(255, 130, 45, 0.09)';
    g.beginPath();
    g.arc(hx, hy, 48 + pulse * 1.4, 0, Math.PI * 2);
    g.stroke();
    // Subtle drifting ember motes inside torch halo
    for (let k = 0; k < 4; k++) {
      const ang = t * 0.04 + k * 1.57;
      const dist = 10 + ((t * 0.35 + k * 9) % 24);
      const ex = (hx + Math.cos(ang) * dist) | 0;
      const ey = (hy - ((t * 0.4 + k * 7) % 18) + 4) | 0;
      R(g, k % 2 === 0 ? 'rgba(255, 220, 120, 0.55)' : 'rgba(255, 120, 40, 0.45)', ex, ey, 1, 1);
    }
  } else if (isCave) {
    // Cool faint exploration halo around hero without torch
    addBloom(g, hx, hy, 28 + flicker * 0.3, 'rgba(95, 145, 240, 0.16)', 'rgba(30, 50, 130, 0)');
    g.strokeStyle = 'rgba(120, 170, 255, 0.14)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(hx, hy, 22 + Math.sin(t * 0.08) * 1.5, 0, Math.PI * 2);
    g.stroke();
  } else {
    // Soft moonlit hero halo outdoors at night
    addBloom(g, hx, hy, 44, 'rgba(130, 175, 255, 0.12)', 'rgba(40, 70, 180, 0)');
  }

  if (map) {
    for (let b = 0; b < 10; b++) {
      for (let a = 0; a < 15; a++) {
        const ch = map[b][a];
        const txp = a * 16 + 8;
        const typ = b * 16 + 8;
        if (ch === 't') {
          addBloom(g, txp, typ - 2, 30 + flicker, 'rgba(255, 150, 45, 0.28)', 'rgba(255, 90, 10, 0)');
        } else if (ch === 'L' && (nightFactor > 0.2 || !V.sword || isCave)) {
          addBloom(g, txp, typ - 4, 34 + flicker * 0.5, 'rgba(255, 205, 95, 0.25)', 'rgba(255, 140, 30, 0)');
        } else if (ch === 'u') {
          addBloom(g, txp, typ + 2, 36 + flicker, 'rgba(255, 130, 40, 0.26)', 'rgba(255, 80, 10, 0)');
        } else if (ch === 'V' || (ch === 'D' && (G.map === 35 || G.map === 36))) {
          addBloom(g, txp, typ, 22, 'rgba(255, 195, 90, 0.18)', 'rgba(255, 130, 30, 0)');
        } else if (ch === 'Y') {
          addBloom(g, txp, typ - 2, 20, 'rgba(255, 185, 80, 0.18)', 'rgba(255, 120, 20, 0)');
        } else if (ch === 'x') {
          addBloom(g, txp, typ, 20, 'rgba(110, 195, 255, 0.2)', 'rgba(80, 120, 255, 0)');
        } else if (ch === 'y') {
          addBloom(g, txp, typ - 2, 22, 'rgba(65, 170, 255, 0.28)', 'rgba(20, 90, 255, 0)');
        } else if (ch === 'S' && !V.sword) {
          addBloom(g, txp, typ - 2, 26, 'rgba(140, 220, 255, 0.28)', 'rgba(80, 160, 255, 0)');
        }
      }
    }
  }

  for (const p of projectiles) {
    if (p.kind === 'orb') {
      addBloom(g, p.x, p.y, 18, 'rgba(255, 70, 180, 0.34)', 'rgba(180, 30, 220, 0)');
    } else if (p.kind === 'beam') {
      addBloom(g, p.x, p.y, 30, DOMINIC_BEAM_COLORS[p.element ?? 'none'].bloom, 'rgba(0, 0, 0, 0)');
    } else if (p.kind === 'fire') {
      addBloom(g, p.x, p.y, 26, 'rgba(255, 130, 30, 0.42)', 'rgba(255, 60, 10, 0)');
    } else if (p.kind === 'bomb' && p.life < 20) {
      addBloom(g, p.x, p.y, 16, 'rgba(255, 140, 40, 0.36)', 'rgba(255, 50, 10, 0)');
    }
  }
  if (G.sw > 0) {
    const sx = G.x + 8 + (G.dir === 1 ? 14 : G.dir === 3 ? -14 : 0);
    const sy = G.y + 8 + (G.dir === 0 ? -14 : G.dir === 2 ? 14 : 0);
    const innerCol =
      V.swordTier === 'solar'
        ? 'rgba(255, 185, 70, 0.14)'
        : V.swordTier === 'runica'
          ? 'rgba(95, 220, 255, 0.14)'
          : V.swordTier === 'aco'
            ? 'rgba(255, 225, 110, 0.12)'
            : 'rgba(180, 235, 255, 0.12)';
    addBloom(g, sx, sy, 15, innerCol, 'rgba(60, 140, 255, 0)');
  }
  for (const pt of particles) {
    if (pt.glow) {
      addBloom(g, pt.x, pt.y, pt.kind === 'ring' ? 11 : 8, 'rgba(255, 200, 95, 0.14)', 'rgba(255, 90, 20, 0)');
    }
  }

  g.restore();
}

function drawHud(
  g: CanvasRenderingContext2D,
  G: HeroState,
  V: ProgressState,
  hn: string,
  worldTime: number,
): void {
  // Hearts top-left
  for (let i = 0; i < V.mh; i++) {
    const x = 6 + (i % 7) * 10;
    const y = 4 + ((i / 7) | 0) * 9;
    drawHeart(g, '#000', x + 1, y + 1);
    drawHeart(g, '#4a3a55', x, y);
    if (G.hp >= 2 * i + 2) drawHeart(g, '#ff4a55', x, y);
    else if (G.hp === 2 * i + 1) drawHeart(g, '#ff4a55', x, y, 4);
    if (G.hp >= 2 * i + 2) R(g, '#fff8', x + 1, y + 1, 1, 1);
  }

  // Top-center compact Time of Day + Hero Name
  const { isNight, duskFactor } = getCycleInfo(worldTime);
  const cx = 120;
  R(g, '#080518aa', cx - 34, 2, 68, 12);
  if (isNight) {
    disc(g, '#e8e4ff', cx - 26, 7, 3);
    disc(g, '#080518', cx - 25, 6, 2);
  } else if (duskFactor > 0.25) {
    disc(g, '#ff9a3a', cx - 26, 8, 3);
  } else {
    disc(g, '#ffd84a', cx - 26, 7, 3);
  }
  tx(g, (hn || 'HEROI').slice(0, 6), cx - 19, 4, '#ffe98a');

  // Transient map / loot banner
  if (V.mt > 0 && V.msg) {
    R(g, '#000a', 34, 17, W - 68, 13);
    tx(g, V.msg, W / 2, 20, '#ffe98a', 'center');
  }

  // Bottom-center HUD bar (sits cleanly between bottom-left analog stick & bottom-right A/B/X cluster)
  if (!G.dlg) {
    R(g, '#080518bb', 64, H - 15, 112, 13);
    R(g, '#ffd84a44', 64, H - 15, 112, 1);
    rup(g, 67, H - 13);
    tx(g, p3(G.rp), 77, H - 12, '#fff');

    // Active secondary X tool
    const toolLabel =
      V.secondary === 'arco'
        ? `X:ARC${V.arrows}`
        : V.secondary === 'bomba'
          ? `X:BMB${V.bombs}`
          : V.secondary === 'tocha'
            ? `X:TCH${V.torches}`
            : `X:POC${V.pot}`;
    tx(g, toolLabel, 111, H - 12, V.torchLit && V.secondary === 'tocha' ? '#ffaa44' : '#9ed8ff');
  }
}

/**
 * Legenda estilo filme dublado: texto branco em fonte medieval, centralizado
 * na parte de baixo, sem caixa nem faixa escura. Vale também para as falas
 * gravadas — a dublagem não esconde mais a legenda.
 */
function drawMovieSubtitle(g: CanvasRenderingContext2D, lines: string[], t: number): void {
  g.font = SUBTITLE_FONT;
  const wrapped: string[] = [];
  for (const raw of lines) {
    let cur = '';
    for (const word of raw.split(/\s+/).filter(Boolean)) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (!cur || g.measureText(candidate).width <= 224) {
        cur = candidate;
      } else {
        wrapped.push(cur);
        cur = word;
      }
    }
    if (cur) wrapped.push(cur);
  }
  if (!wrapped.length) return;

  g.textAlign = 'center';
  g.textBaseline = 'top';
  const lineH = 15;
  const top = H - (wrapped.length * lineH + 8);
  wrapped.forEach((line, i) => {
    const y = top + i * lineH;
    // Contorno fino só para leitura sobre a imagem; nenhum fundo é desenhado.
    g.fillStyle = '#000000';
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      g.fillText(line, W / 2 + dx, y + dy);
    }
    g.fillStyle = '#ffffff';
    g.fillText(line, W / 2, y);
  });
  if ((t >> 4) & 1) {
    g.font = FONT;
    g.fillStyle = '#ffffff';
    g.fillText('v', W - 12, H - 12);
  }
}

export function drawDialog(g: CanvasRenderingContext2D, G: HeroState, t: number): void {
  const d = G.dlg;
  if (!d) return;
  drawMovieSubtitle(g, d.p[d.i] ?? [], t);
}

export function drawIntro(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  phase: IntroPhase,
  phaseTick: number,
): void {
  // Never inherit alpha/composite state from a previous screen
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';

  // O GIF da Dominic e o vídeo da Cloud Games são overlays em HTML; o canvas
  // só mantém o fundo preto para não vazar nenhum quadro antigo.
  R(g, '#000', 0, 0, W, H);
}

export function drawMgMenu(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  mgSel: number,
): void {
  drawKingdom(g, t, stars, 0, 1);
  drawTitle(g, t, 1);
  drawPanel(g, ['CORTA-GRAMA', 'CHUVA DE RUPIAS', 'VOLTAR'], mgSel, 104);
}

export function drawHelp(g: CanvasRenderingContext2D, t: number, stars: Star[]): void {
  drawKingdom(g, t, stars, 0, 1);
  drawTitle(g, t, 1);
  R(g, '#0a071be6', 10, 56, 220, 98);
  R(g, '#ffd84a66', 10, 56, 220, 1);
  R(g, '#ffd84a66', 10, 153, 220, 1);
  [
    'ANALOGICO/WASD: MOVER',
    'A (Z/ESP): ESPADA / FALAR',
    'B (X/K): ESCUDO / VOLTAR',
    'X (C/E): ARCO/BOMBA/TOCHA',
    'I: INVENT.   ENTER: START',
  ].forEach((s, i) => tx(g, s, 16, 64 + i * 14));
  tx(g, 'M: SOM   A/B: VOLTAR', 120, 140, '#ffd84a', 'center');
}

export function drawNameEntry(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  nm: string,
  nc: { x: number; y: number },
): void {
  drawScene(g, t, stars, t * 0.3, 0.9, 100, 0, 0);
  R(g, '#000c', 16, 16, 208, 134);
  R(g, '#ffd84a66', 16, 16, 208, 1);
  R(g, '#ffd84a66', 16, 149, 208, 1);
  tx(g, 'NOME DO HERÓI', 120, 22, '#ffd84a', 'center');
  tx(g, nm + (((t >> 4) & 1) ? '_' : ' '), 120, 38, '#fff', 'center');
  R(g, '#ffd84a', 30, 50, 180, 1);

  NAME_ROWS.forEach((r, j) => {
    [...r].forEach((c, i) => {
      const x = 48 + i * 16;
      const y = 58 + j * 14;
      const s = nc.y === j && nc.x === i;
      if (s) R(g, '#ffd84a', x - 3, y - 3, 14, 13);
      tx(g, c === ' ' ? '_' : c, x, y, s ? '#1a1040' : '#fff', 'left', s ? '#ffd84a' : '#000');
    });
  });

  [
    ['APAGAR', 46],
    ['OK', 150],
  ].forEach(([l, x], i) => {
    const s = nc.y === 3 && nc.x === i;
    if (s) R(g, '#ffd84a28', (x as number) - 2, 104, 66, 13);
    tx(g, (s ? '> ' : '  ') + (l as string), x as number, 107, s ? '#ffd84a' : '#fff');
  });

  tx(g, 'DIGITE OU USE A/B  ENTER: OK', 120, 128, '#bbb', 'center');
}

// Títulos curtos das páginas, desenhados em molduras medievais no lugar dos GIFs.
const STORY_TITLES = [
  'MITRIBUQUE',
  'A LENDA',
  'O OESTE',
  'OS DOMINICS',
  'O CICLOPE',
  '',
  'DESPERTE',
] as const;

/**
 * Quebra a narração pela largura real da fonte (e não por número de caracteres),
 * para que nenhuma linha ultrapasse as bordas da placa da história.
 */
function wrapStoryText(g: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  g.font = FONT;
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (!cur || g.measureText(candidate).width <= maxW) {
      cur = candidate;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);

  // Uma palavra isolada maior que a placa (ex.: nome longo) é cortada por letra.
  return lines.flatMap((line) => {
    if (g.measureText(line).width <= maxW) return [line];
    const parts: string[] = [];
    let part = '';
    for (const c of line) {
      if (part && g.measureText(part + c).width > maxW) {
        parts.push(part);
        part = c;
      } else {
        part += c;
      }
    }
    if (part) parts.push(part);
    return parts;
  });
}

export function drawStory(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  sc: number,
  pg: number,
  ch: number,
  tn: number,
  hn: string,
  weather: WeatherState,
): void {
  const count = STORY_PAGES.length;
  const page = STORY_PAGES[pg] ?? STORY_PAGES[count - 1];
  const s = page.replace('{N}', hn);
  // The text-less beat between phase 5 and phase 6 is the Cyclops alone.
  const interlude = pg === STORY_INTERLUDE_AT || s.length === 0;

  // Reset any inherited canvas state — leftover alpha/composite from the
  // previous screen is what makes the picture look "broken".
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  g.lineWidth = 1;

  // Black background
  R(g, '#000000', 0, 0, W, H);

  if (interlude) {
    // Sem texto: o Ciclope ganha uma moldura vermelha só sua.
    drawMedievalFrame(g, 20, 6, 200, 118, 'crimson');
    framedLabel(g, 'O CICLOPE', 120, 52, 1.8, '#ffd0b0', '#2a0608');
    ln(g, 44, 92, 196, 92, '#8a2a20', 1);
    framedLabel(g, 'A SOMBRA DEVORA O REINO', 120, 106, 1, '#e0a080', '#2a0608');
  } else {
    // Uma única placa: título, capítulo e o texto falado ficam dentro dela.
    const style: FrameStyle = pg === 4 ? 'crimson' : 'gold';
    drawMedievalFrame(g, 12, 6, 216, 112, style);
    framedLabel(g, STORY_TITLES[pg] ?? 'A HISTÓRIA', 120, 24, 1.4, FRAME_COLORS[style].ink, '#2a1608');
    ln(g, 32, 38, 208, 38, '#a8782a', 1);
    const shown = pg > STORY_INTERLUDE_AT ? pg : pg + 1;
    framedLabel(g, `CAPITULO ${shown}`, 120, 46, 0.85, '#7a5a20', '#2a1608');
    ln(g, 32, 58, 208, 58, '#a8782a', 1);
  }

  // O texto narrado é escrito na própria placa — nunca como legenda inferior.
  let n = ch | 0;
  if (!interlude) {
    const paper = pg === 4 ? FRAME_COLORS.crimson.paper : FRAME_COLORS.gold.paper;
    const lines = wrapStoryText(g, s, 196);
    // Com mais linhas, o espaçamento diminui para o texto continuar dentro da moldura.
    const lineH = Math.max(1, Math.min(12, Math.floor(46 / lines.length)));
    lines.forEach((line, i) => {
      tx(g, line.slice(0, Math.max(0, n)), 20, 64 + i * lineH, '#3a2a10', 'left', paper);
      n -= line.length + 1;
    });
  }

  // Contador e dica de controle (interface, não legenda da narração).
  if (!interlude) {
    const shown = pg > STORY_INTERLUDE_AT ? pg : pg + 1;
    tx(g, `${shown}/${count - 1}`, 6, H - 11, '#ffd84a');
  }
  tx(
    g,
    interlude ? 'A: CONTINUAR' : ch < s.length ? 'A: TEXTO' : pg < count - 1 ? 'A: PROXIMA' : 'A: INICIAR',
    W - 6,
    H - 11,
    '#e0e0f0',
    'right',
  );
}

function drawBedroomDust(g: CanvasRenderingContext2D, t: number, dust: DustMote[]): void {
  g.save();
  for (const m of dust) {
    const twinkle = 0.55 + 0.45 * Math.sin(t * 0.05 + m.phase);
    const a = (m.alpha * twinkle).toFixed(3);
    g.fillStyle = m.warm
      ? `rgba(255, 224, 150, ${a})`
      : `rgba(175, 215, 255, ${a})`;
    g.fillRect(m.x | 0, m.y | 0, m.size, m.size);
  }
  g.restore();
}

/**
 * Bedroom decoration for map 451, matching the pixel-art reference:
 * Hylian crest shield on the wall, castle painting, green Triforce banner,
 * green curtains, the big green rug with a golden crest, a bedside lamp,
 * flowers on the table and the wood stove. Drawn after the base tiles but
 * before characters, so the hero always stays on top.
 */
function drawBedroomDecor(
  g: CanvasRenderingContext2D,
  t: number,
  world: WorldData,
): void {
  const wall = world.maps[451];
  if (!wall) return;
  // A tile was opened by the hero (chest / stairs): don't paint over it.
  const isOpen = (a: number, b: number) => wall[b]?.[a] !== 'C' && wall[b]?.[a] !== 'E';

  // ── Wall hanging: Hylian shield crest (left of the window) ────────────────
  if (isOpen(4, 1)) {
    const x = 4 * T;
    const y = 0 * T;
    R(g, '#00000030', x + 3, y + 4, 11, 13);
    R(g, '#6b3f1d', x + 3, y + 1, 10, 13);
    R(g, '#c8a83c', x + 4, y + 2, 8, 11);
    R(g, '#1f3f8a', x + 5, y + 3, 6, 9);
    R(g, '#c0392b', x + 5, y + 8, 6, 4);
    // Triforce in gold
    R(g, '#ffd84a', x + 7, y + 3, 2, 2);
    R(g, '#ffd84a', x + 6, y + 5, 2, 2);
    R(g, '#ffd84a', x + 8, y + 5, 2, 2);
    R(g, '#fff4a8', x + 7, y + 3, 1, 1);
  }

  // ── Royal painting (castle) above the table ──────────────────────────────
  if (isOpen(10, 1)) {
    const x = 10 * T;
    const y = 0 * T;
    R(g, '#6b3f1d', x + 1, y + 2, 14, 11);
    R(g, '#c8a83c', x + 2, y + 3, 12, 9);
    R(g, '#8fd0ff', x + 3, y + 4, 10, 7);
    R(g, '#ffffff66', x + 3, y + 4, 4, 2);
    // castle silhouette
    R(g, '#5a5488', x + 6, y + 6, 4, 5);
    R(g, '#3a345a', x + 5, y + 5, 2, 6);
    R(g, '#3a345a', x + 9, y + 5, 2, 6);
    R(g, '#8a5f2e', x + 4, y + 9, 8, 2);
  }

  // ── Green Triforce banner (top right) ────────────────────────────────────
  if (isOpen(13, 1)) {
    const x = 13 * T;
    const y = 0 * T;
    R(g, '#6b3f1d', x + 1, y + 1, 14, 2);
    R(g, '#1e7a44', x + 2, y + 3, 12, 12);
    R(g, '#2a9c58', x + 3, y + 4, 10, 10);
    R(g, '#ffd84a', x + 7, y + 4, 2, 2);
    R(g, '#ffd84a', x + 6, y + 6, 2, 2);
    R(g, '#ffd84a', x + 8, y + 6, 2, 2);
    R(g, '#c8a83c', x + 2, y + 13, 12, 2);
  }

  // ── Green curtains around the window (tile [1][6]) ──────────────────────
  if (wall[1]?.[6] === 'w') {
    const x = 6 * T;
    const y = 0 * T;
    R(g, '#6b3f1d', x, y + 1, T, 1);
    R(g, '#1e7a44', x, y + 2, 4, 12);
    R(g, '#2a9c58', x + 1, y + 3, 2, 10);
    R(g, '#1e7a44', x + 12, y + 2, 4, 12);
    R(g, '#2a9c58', x + 13, y + 3, 2, 10);
    R(g, '#c8a83c', x + 12, y + 12, 4, 1);
    R(g, '#c8a83c', x, y + 12, 4, 1);
  }

  // ── Big green rug with a golden Hylian crest ─────────────────────────────
  const rug = (x: number, y: number) => {
    R(g, '#1e5c36', x, y, T, T);
    R(g, '#2a9c58', x + 1, y + 1, 14, 14);
    R(g, '#c8a83c', x + 1, y + 1, 14, 1);
    R(g, '#c8a83c', x + 1, y + 14, 14, 1);
    R(g, '#c8a83c', x + 1, y + 1, 1, 14);
    R(g, '#c8a83c', x + 14, y + 1, 1, 14);
  };
  for (let b = 5; b < 8; b++) {
    for (let a = 5; a < 11; a++) rug(a * T, b * T);
  }
  // Golden Hylian crest on the central tile [8][6]
  const cx = 8 * T;
  const cy = 6 * T;
  R(g, '#c8a83c', cx + 5, cy + 2, 6, 3);
  R(g, '#c8a83c', cx + 3, cy + 5, 10, 2);
  R(g, '#c8a83c', cx + 1, cy + 7, 14, 3);
  R(g, '#c8a83c', cx + 3, cy + 10, 10, 2);
  R(g, '#c8a83c', cx + 7, cy + 7, 2, 5);
  R(g, '#ffd84a', cx + 6, cy + 3, 4, 1);
  R(g, '#ffd84a', cx + 2, cy + 8, 12, 1);
  R(g, '#1e5c36', cx + 7, cy + 7, 2, 2);

  // ── Bedside lamp on the little table at [3][2] ───────────────────────────
  if (wall[2]?.[3] === 'v') {
    const x = 3 * T;
    const y = 2 * T;
    R(g, '#6b3f1d', x + 2, y + 7, 12, 7);
    R(g, '#c98b3c', x + 3, y + 8, 10, 2);
    R(g, '#ffd84a', x + 5, y + 3, 6, 5);
    R(g, '#fff4a8', x + 6, y + 4, 4, 3);
    R(g, '#c8a83c', x + 7, y + 2, 2, 2);
  }

  // ── Flowers in the pot on the table [1][8]/[2][8] ────────────────────────
  if (wall[1]?.[8] === 'z') {
    const x = 8 * T;
    const y = 1 * T;
    R(g, '#8a4a2a', x + 5, y + 5, 6, 5);
    R(g, '#c8794a', x + 6, y + 6, 4, 3);
    const green = ((t >> 4) & 1) === 0 ? '#2a9c58' : '#27ae60';
    R(g, green, x + 7, y + 2, 2, 5);
    R(g, green, x + 5, y + 3, 2, 3);
    R(g, green, x + 10, y + 3, 2, 3);
    R(g, '#fff', x + 6, y + 1, 3, 3);
    R(g, '#fff', x + 10, y + 2, 3, 3);
    R(g, '#ffd84a', x + 7, y + 2, 1, 1);
    R(g, '#ffd84a', x + 11, y + 3, 1, 1);
  }
}

/**
 * Interior decoration for houses and shops, following the pixel-art refs.
 * Three layouts:
 *  - hero's ground floor (151): stone fireplace, blue curtains, clock,
 *    beige sofa on a red rug, dining table, stairs, sideboard/oven.
 *  - other houses: cosier version with a fireplace, sofa, table and plants.
 *  - shops (135/335/136): potion shelf, sword rack, shields, armour, counter,
 *    merchant's wares and a red carpet.
 * Drawn over the base tiles but before characters, so the hero stays on top.
 */
function drawHouseDecor(
  g: CanvasRenderingContext2D,
  t: number,
  world: WorldData,
  M_: number,
): void {
  const m = world.maps[M_];
  if (!m) return;
  const shop = M_ === 135 || M_ === 335 || M_ === 136;
  const heroHome = M_ === 151;
  const open = (a: number, b: number) => {
    const ch = m[b]?.[a];
    return ch !== 'D' && ch !== 'E' && ch !== 'C' && ch !== 'S';
  };

  // ── Shared: warm wood wainscot along the top wall ────────────────────────
  R(g, '#8a5f2e', 16, 1, 208, 2);
  R(g, '#b5834a', 16, 3, 208, 1);

  if (shop) {
    // ── Shops: stone back wall, merchant counter, potion shelf ─────────────
    R(g, '#8a8878', 16, 4, 208, 34);
    R(g, '#a6a498', 16, 5, 208, 30);
    // Hanging banners
    for (const bx of [22, 206]) {
      R(g, '#8a1c18', bx, 6, 10, 22);
      R(g, '#c0392b', bx + 1, 7, 8, 20);
      R(g, '#ffd84a', bx + 4, 10, 2, 2);
      R(g, '#ffd84a', bx + 3, 12, 2, 2);
      R(g, '#ffd84a', bx + 5, 12, 2, 2);
    }
    // Potion shelf (top-left)
    R(g, '#6b3f1d', 24, 8, 52, 26);
    R(g, '#a8743a', 25, 9, 50, 24);
    R(g, '#2a1608', 25, 18, 50, 2);
    const potionCols = ['#c0392b', '#27ae60', '#8e44ad', '#2e86c1', '#f1c40f'];
    for (let i = 0; i < 5; i++) {
      const px = 28 + i * 10;
      R(g, '#1e5c36', px, 11, 5, 6);
      R(g, potionCols[i], px + 1, 12, 3, 4);
      R(g, '#1e5c36', px, 21, 5, 6);
      R(g, potionCols[(i + 2) % 5], px + 1, 22, 3, 4);
    }
    // Sword rack (top-centre)
    R(g, '#6b3f1d', 84, 8, 48, 16);
    for (let i = 0; i < 4; i++) {
      const sx = 88 + i * 11;
      R(g, '#dff0ff', sx, 9, 2, 12);
      R(g, '#8fa8d8', sx + 1, 9, 1, 12);
      R(g, '#6b3f1d', sx - 1, 20, 4, 2);
    }
    // Pair of shields (top-right)
    for (const [sx, sc] of [[140, '#2e86c1'], [162, '#c0392b']] as const) {
      R(g, '#2a1608', sx, 8, 18, 20);
      R(g, '#c8a83c', sx + 1, 9, 16, 18);
      R(g, sc, sx + 3, 11, 12, 14);
      R(g, '#ffd84a', sx + 8, 12, 2, 4);
      R(g, '#ffd84a', sx + 7, 15, 4, 2);
    }
    // Merchant's counter with a coin and a ledger
    R(g, '#2a1608', 100, 44, 92, 28);
    R(g, '#c98b3c', 101, 45, 90, 8);
    R(g, '#a8743a', 101, 53, 90, 18);
    R(g, '#c0392b', 142, 53, 28, 18);
    R(g, '#ffd84a', 150, 47, 4, 4);
    R(g, '#f5e4b8', 166, 46, 10, 6);
    // Red carpet centre
    R(g, '#8a1c18', 92, 78, 108, 44);
    R(g, '#c0392b', 94, 80, 104, 40);
    R(g, '#ffd84a', 96, 82, 100, 1);
    R(g, '#ffd84a', 96, 117, 100, 1);
    // Wares on the lower shelf / crates
    R(g, '#6b3f1d', 18, 84, 62, 20);
    R(g, '#c8a870', 19, 85, 60, 18);
    for (let i = 0; i < 3; i++) {
      const wx = 24 + i * 18;
      R(g, '#dff0ff', wx, 88, 2, 12);
      R(g, '#a8743a', wx - 2, 99, 6, 2);
    }
    // Armour display (right)
    R(g, '#6b3f1d', 172, 72, 50, 32);
    R(g, '#a8743a', 173, 73, 48, 30);
    R(g, '#8a93a8', 178, 76, 12, 12);
    R(g, '#c8a83c', 198, 76, 12, 12);
    R(g, '#2a1608', 178, 76, 12, 12);
    R(g, '#2a1608', 198, 76, 12, 12);
    R(g, '#8a93a8', 178, 92, 12, 8);
    R(g, '#2e86c1', 198, 92, 12, 8);
    // Treasure chest bottom-right
    if (open(12, 8)) {
      const cx = 12 * T;
      const cy = 8 * T;
      R(g, '#2a1608', cx, cy, T, T);
      R(g, '#a8743a', cx + 1, cy + 2, 14, 12);
      R(g, '#c98b3c', cx + 1, cy + 2, 14, 5);
      R(g, '#ffd84a', cx + 5, cy + 7, 6, 5);
    }
    // Lanterns flanking the entrance
    for (const lx of [92, 140]) {
      R(g, '#6b3f1d', lx, 136, 4, 12);
      R(g, '#ffd84a', lx - 2, 138, 8, 6);
      R(g, '#fff4a8', lx, 139, 4, 4);
    }
  } else {
    // ── Houses: stone fireplace, sofa, table, stairs, curtains ─────────────
    // Stone chimney / fireplace (top-left)
    R(g, '#48485a', 22, -4, 44, 46);
    R(g, '#6c6c80', 24, -2, 40, 42);
    R(g, '#a6a6be', 22, -4, 44, 4);
    R(g, '#222230', 30, 8, 28, 26);
    const fl = (t >> 3) & 1;
    R(g, '#ff6a1a', 34, 16 + fl, 20, 18 - fl);
    R(g, '#ffe98a', 39, 22, 10, 12);
    R(g, '#3a2a1a', 30, 30, 28, 4);
    // Triforce plaque on the mantle
    R(g, '#ffd84a', 40, 2, 3, 3);
    R(g, '#ffd84a', 38, 5, 3, 3);
    R(g, '#ffd84a', 42, 5, 3, 3);
    // Wall clock (far left)
    R(g, '#6b3f1d', 16, 8, 12, 14);
    R(g, '#f5e4b8', 18, 10, 8, 10);
    R(g, '#2a1608', 21, 12, 1, 5);
    R(g, '#2a1608', 21, 14, 3, 1);
    // Blue curtains on the window tile
    if (open(4, 1) || m[1]?.[4] === 'w') {
      R(g, '#1e3f8a', 4 * T, 2, 4, 12);
      R(g, '#2e6ac0', 4 * T + 1, 3, 2, 10);
      R(g, '#1e3f8a', 4 * T + 12, 2, 4, 12);
      R(g, '#2e6ac0', 4 * T + 13, 3, 2, 10);
    }
    // Green rug + beige sofa (centre-left)
    R(g, '#8a1c18', 18, 66, 96, 56);
    R(g, '#c0392b', 20, 68, 92, 52);
    R(g, '#ffd84a', 22, 70, 88, 1);
    R(g, '#ffd84a', 22, 118, 88, 1);
    R(g, '#8a5f2e', 28, 60, 62, 26);
    R(g, '#c8a870', 30, 62, 58, 20);
    R(g, '#e0c890', 30, 62, 58, 6);
    // Green sofa cushions
    R(g, '#1e7a44', 30, 70, 58, 12);
    R(g, '#2a9c58', 32, 72, 26, 8);
    R(g, '#2a9c58', 60, 72, 26, 8);
    // Coffee table with a plant
    R(g, '#6b3f1d', 40, 96, 36, 18);
    R(g, '#a8743a', 41, 97, 34, 16);
    R(g, '#2a9c58', 54, 99, 8, 6);
    R(g, '#8a4a2a', 54, 104, 8, 4);
    // Dining table with flower pot (centre-right)
    R(g, '#6b3f1d', 130, 84, 58, 30);
    R(g, '#c8a870', 132, 86, 54, 26);
    R(g, '#fff', 154, 92, 8, 8);
    R(g, '#2a9c58', 157, 94, 2, 6);
    R(g, '#ffd84a', 157, 94, 1, 1);
    // Green rug under the dining table
    R(g, '#1e5c36', 126, 80, 66, 38);
    R(g, '#2a9c58', 128, 82, 62, 34);
    R(g, '#c8a83c', 128, 82, 62, 1);
    R(g, '#c8a83c', 128, 115, 62, 1);
    // Sideboard with lamp + stove (right)
    R(g, '#6b3f1d', 186, 62, 30, 24);
    R(g, '#c8a870', 187, 63, 28, 22);
    R(g, '#ffd84a', 196, 66, 10, 8);
    R(g, '#fff4a8', 198, 68, 6, 5);
    R(g, '#48485a', 190, 92, 24, 28);
    R(g, '#222230', 194, 100, 16, 16);
    R(g, '#ff6a1a', 196, 104 + fl, 12, 12 - fl);
    // Potted plants in the corners
    for (const [px, py] of [[20, 112], [204, 130]] as const) {
      R(g, '#8a4a2a', px, py, 10, 8);
      R(g, '#2a9c58', px + 2, py - 8, 6, 8);
      R(g, '#27ae60', px, py - 6, 4, 5);
    }
    // Staircase to the upper floor (right, when present)
    if (heroHome || m.some((row) => row.includes('E'))) {
      for (let i = 0; i < 5; i++) {
        R(g, '#6b3f1d', 148 + i * 4, 34 - i * 5, 4, 5 + i * 5);
        R(g, '#a8743a', 148 + i * 4, 34 - i * 5, 3, 4 + i * 5);
      }
    }
  }
}

export function drawGame(
  g: CanvasRenderingContext2D,
  world: WorldData,
  G: HeroState,
  V: ProgressState,
  hn: string,
  t: number,
  input: Record<KeyCode, boolean>,
  analogActive: boolean,
  particles: Particle[],
  projectiles: Projectile[],
  weather: WeatherState,
  worldTime: number,
  dust: DustMote[] = [],
): void {
  const { nightFactor } = getCycleInfo(worldTime);
  const m = world.maps[G.map];
  const roomSrc = roomImageFor(G.map);
  const roomImg = roomSrc ? getRoomImage(roomSrc) : null;
  const cam = updateGameCamera(G);

  // Everything in world space — backdrop, tiles, actors, particles, weather
  // and lighting — is drawn through the gameplay camera. HUD and dialogs are
  // painted afterwards in screen space so they stay readable.
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(W / 2 - cam.x * cam.zoom, H / 2 - cam.y * cam.zoom);
  g.scale(cam.zoom, cam.zoom);

  if (roomImg) {
    // The image supplies the visual furniture; the tile map below it keeps
    // collision, doors, bed, stairs and chest interactions exactly as before.
    g.drawImage(roomImg, 0, 0, W, H);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        const ch = m[y][x];
        // No quarto o baú azul já está pintado no PNG: não desenhamos o baú
        // genérico por cima. A tile 'C' continua ativa para a interação.
        // Na vila inicial as portas, lampiões e o bazar ficam visíveis sobre
        // a imagem para que o jogador encontre a casa do pai e as lojas.
        if (
          ch === 'S' ||
          ch === 'c' ||
          ch === 'G' ||
          ch === 'g' ||
          (ch === 'C' && G.map !== 451) ||
          ((G.map === 51 || G.map === 36) && (ch === 'D' || ch === 'L')) ||
          (G.map === 51 && ch === 'Y')
        ) {
          drawTile(g, world, V, G, t, ch, x, y, weather, nightFactor);
        }
      }
    }
  } else {
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 15; x++) {
        drawTile(g, world, V, G, t, m[y][x], x, y, weather, nightFactor);
      }
    }
    if (G.map === 451) drawBedroomDecor(g, t, world);
    else if (isHouse(G.map)) drawHouseDecor(g, t, world, G.map);
  }

  const drawables: Array<[number, () => void]> = [];
  for (const n of world.npcs[G.map] || []) {
    // Os vendedores foram removidos da praça. Os registros continuam aqui
    // (com stall/shopId) para que as seis barracas abram as lojas normalmente;
    // apenas a pessoa em si deixa de ser desenhada.
    if (n.stall) continue;
    drawables.push([n.y * 16, () => drawPerson(g, n, t)]);
  }
  for (const e of G.en) {
    drawables.push([e.y, () => drawEnemy(g, e, t, G.map)]);
  }
  drawables.push([G.y, () => drawHero(g, G, V, input, analogActive, t)]);
  drawables.sort((a, b) => a[0] - b[0]);

  for (const i of G.it) {
    const val = i.val || 1;
    const bobY = i.y + Math.sin(t / 8) * 1.5;
    if (i.kind === 'heart') {
      floorHeart(g, i.x, bobY);
      continue;
    }
    rup(g, i.x, bobY, val > 1 ? '#58a8ff' : '#2ee06b', val > 1 ? '#2658b8' : '#1fa04c');
    if (((t >> 3) + i.x) % 6 === 0) R(g, '#fff', i.x + 5, i.y, 1, 1);
  }
  drawables.forEach((e) => e[1]());
  drawProjectiles(g, projectiles, t);

  for (const p of particles) {
    const ratio = p.maxL ? Math.max(0, p.l / p.maxL) : 1;
    if (p.kind === 'ring') {
      const maxR = p.size || 13;
      const r = 3 + (1 - ratio) * maxR;
      g.save();
      g.globalAlpha = ratio * 0.9;
      g.strokeStyle = p.c;
      g.lineWidth = Math.max(0.8, ratio * 2);
      g.beginPath();
      g.arc(p.x, p.y, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else if (p.kind === 'slash') {
      const len = (p.size || 9) * (0.65 + (1 - ratio) * 0.55);
      const a = p.ang || 0;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(a);
      g.globalAlpha = ratio;
      g.strokeStyle = p.c;
      g.lineWidth = Math.max(1, ratio * 2.2);
      g.beginPath();
      g.moveTo(-len, -len * 0.45);
      g.lineTo(len, len * 0.45);
      g.moveTo(len * 0.65, -len * 0.75);
      g.lineTo(-len * 0.65, len * 0.75);
      g.stroke();
      g.restore();
    } else if (p.kind === 'leaf') {
      R(g, p.c, p.x | 0, p.y | 0, (p.l & 2) ? 3 : 2, (p.l & 2) ? 1 : 2);
    } else {
      const sz = p.size || (p.glow ? 3 : 2);
      R(g, p.c, p.x | 0, p.y | 0, sz, sz);
      if (p.glow && ratio > 0.45) {
        R(g, '#ffffff', (p.x | 0) + (sz > 2 ? 1 : 0), (p.y | 0) + (sz > 2 ? 1 : 0), 1, 1);
      }
    }
  }

  // No bioma gelado neve sempre; nos demais, a chuva continua até a espada.
  const snowBiome = G.map < 56 && bio(G.map & 7, G.map >> 3) === 'n';
  if (G.map < 100 && snowBiome) {
    drawSnow(g, weather);
  } else if (G.map < 100 && !V.sword) {
    drawWeather(g, weather, 84, false);
  } else if (G.map < 100 && weather.clearBanner > 0) {
    const a = Math.min(0.25, (weather.clearBanner / 120) * 0.25);
    g.fillStyle = `rgba(255, 240, 170, ${a})`;
    g.fillRect(0, 0, W, H);
  }

  // Premium Dynamic Lighting (day/dusk/night + dark caves + flickering torches + lamps + spells)
  drawLighting(g, world, G, V, t, worldTime, weather, projectiles, particles);

  // Floating ambient dust motes inside hero's bedroom (map 451)
  if (G.map === 451 && dust.length > 0) {
    drawBedroomDust(g, t, dust);
  }

  g.restore();

  drawHud(g, G, V, hn, worldTime);
  if (G.sleeping && !G.dlg && !(G.wakeTimer ?? 0) && ((t >> 4) & 1) === 0) {
    R(g, '#080518dd', 36, H - 34, W - 72, 14);
    R(g, '#ffd84a99', 36, H - 34, W - 72, 1);
    R(g, '#ffd84a99', 36, H - 21, W - 72, 1);
    tx(g, 'APERTE QUALQUER BOTAO', W / 2, H - 30, '#ffd84a', 'center');
  }
  drawDialog(g, G, t);
}

export function drawMinigame(g: CanvasRenderingContext2D, mg: MinigameState): void {
  if (mg.id === 1) {
    R(g, '#62b94a', 0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      const gx = 48 + (i % 3) * 48;
      const gy = 26 + ((i / 3) | 0) * 42;
      const p = mg.pop[i];
      R(g, '#3a2410', gx + 2, gy + 22, 36, 14);
      R(g, '#24160a', gx + 4, gy + 24, 32, 10);
      if (p > 0) {
        const h = Math.min(18, (60 - p) * 3 + 4, p * 2 + 2);
        R(g, '#1c6b2a', gx + 6, gy + 26 - h, 28, h + 4);
        R(g, '#34b04a', gx + 8, gy + 28 - h, 24, h);
        R(g, '#7fe58a', gx + 12, gy + 30 - h, 4, 3);
      }
    }
    const cx = 48 + mg.cx * 48;
    const cy = 26 + mg.cy * 42;
    R(g, '#ffd84a', cx, cy, 40, 2);
    R(g, '#ffd84a', cx, cy + 36, 40, 2);
    R(g, '#ffd84a', cx, cy, 2, 38);
    R(g, '#ffd84a', cx + 38, cy, 2, 38);
    if (mg.sw > 0) R(g, '#fff', cx + 4, cy + 10, 32, 3);
  } else {
    R(g, '#7ec8f0', 0, 0, W, H);
    R(g, '#62b94a', 0, H - 14, W, 14);
    for (const i of mg.it) {
      if (i.k === 1) {
        R(g, '#222', i.x + 1, i.y + 2, 8, 8);
        R(g, '#ff9a3a', i.x + 4, i.y, 2, 3);
      } else if (i.k === 2) {
        rup(g, i.x, i.y, '#ff4a55', '#a01f2c');
      } else {
        rup(g, i.x, i.y);
      }
    }
    R(g, '#8a5a2a', mg.bx, H - 26, 24, 12);
    R(g, '#c98b3c', mg.bx, H - 26, 24, 3);
  }

  tx(g, 'TEMPO ' + ((mg.t / 60) | 0), 6, 4);
  tx(g, 'PONTOS ' + mg.sc, W - 6, 4, '#fff', 'right');
  if (mg.end) {
    R(g, '#f0d060', 40, 40, 160, 70);
    R(g, '#2b2350', 42, 42, 156, 66);
    tx(g, 'FIM!', 120, 50, '#ffd84a', 'center');
    tx(g, 'PONTOS: ' + mg.sc, 120, 68, '#fff', 'center');
    tx(g, '+' + mg.sc + ' RUPIAS', 120, 82, '#2ee06b', 'center');
    tx(g, 'A: CONTINUAR', 120, 96, '#fff', 'center');
  }
}

export function drawGameOver(g: CanvasRenderingContext2D, t: number): void {
  R(g, '#09040c', 0, 0, W, H);
  tx(g, 'FIM DE JOGO', 120, 62, '#ff4a55', 'center');
  if ((t >> 5) & 1) tx(g, 'A OU START: RECOMECAR', 120, 90, '#fff', 'center');
}

export function drawVictory(
  g: CanvasRenderingContext2D,
  t: number,
  stars: Star[],
  hn: string,
  G: HeroState,
  V: ProgressState,
  sel: number,
): void {
  drawKingdom(g, t, stars, 0, 1);
  drawSwordArt(g, 8 + Math.sin(t / 18) * 2);
  R(g, '#0a071be0', 22, 22, 196, 118);
  R(g, '#ffd84a', 22, 22, 196, 1);
  R(g, '#ffd84a', 22, 139, 196, 1);
  tx(g, 'REINO SALVO!', 120, 30, '#ffd84a', 'center');
  tx(g, `${hn}, O HERÓI DE AURORA`, 120, 46, '#ffe98a', 'center');
  tx(g, `RUPIAS: ${p3(G.rp)}`, 120, 64, '#2ee06b', 'center');
  tx(g, `FRAGMENTOS: ${V.it.fragmento || 3}/3`, 120, 77, '#9ed8ff', 'center');

  const opts = ['CONTINUAR NO REINO', 'MENU PRINCIPAL'];
  opts.forEach((o, i) => {
    tx(g, (sel === i ? '> ' : '  ') + o, 120, 100 + i * 15, sel === i ? '#ffd84a' : '#fff', 'center');
  });
}

function drawHeroShowcase(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  V: ProgressState,
  t: number,
  dir: number,
): void {
  const oc = OUTFIT_COLORS[V.outfit] || OUTFIT_COLORS.verde;
  const breath = Math.round(Math.sin(t / 14));
  const bob = breath > 0 ? 1 : 0;

  // Dramatic RE4-style floor spotlight & pedestal ring
  addBloom(g, cx, cy + 28, 34, 'rgba(110, 165, 255, 0.22)', 'rgba(20, 30, 70, 0)');
  if (V.torchLit) {
    addBloom(g, cx + 18, cy - 4, 30, 'rgba(255, 165, 55, 0.28)', 'rgba(255, 80, 10, 0)');
  }
  g.strokeStyle = 'rgba(255, 216, 74, 0.45)';
  g.lineWidth = 1;
  g.beginPath();
  g.ellipse(cx, cy + 29, 26, 7, 0, 0, Math.PI * 2);
  g.stroke();

  g.save();
  g.translate(cx - 24, cy - 26 + bob);
  g.scale(3, 3);

  // Shadow
  R(g, '#0006', 2, 14, 12, 3);
  // Boots
  R(g, '#2a1608', 3, 12, 4, 3);
  R(g, '#2a1608', 9, 12, 4, 3);
  R(g, '#8a5a2a', 4, 12, 2, 1);
  R(g, '#8a5a2a', 10, 12, 2, 1);

  // Tunic & Belt
  R(g, oc.dark, 2, 6, 12, 7);
  R(g, oc.main, 3, 7, 10, 5);
  R(g, oc.light, 3, 7, 10, 1);
  R(g, oc.shade, 3, 11, 10, 1);
  R(g, '#6b3f1d', 3, 10, 10, 1);
  R(g, '#ffd84a', 7, 10, 2, 1);

  // Arms
  R(g, '#f5c99a', 1, 8, 2, 3);
  R(g, '#f5c99a', 13, 8, 2, 3);

  // Head & Hair
  R(g, '#3a2410', 3, 1, 10, 8);
  R(g, '#f5c99a', 4, 3, 8, 5);
  R(g, '#d9a441', 3, 3, 1, 3);
  R(g, '#d9a441', 12, 3, 1, 3);

  // Cap
  R(g, oc.dark, 2, -1, 12, 5);
  R(g, oc.cap, 3, 0, 10, 3);
  R(g, oc.light, 4, 0, 5, 1);
  if (dir === 3) {
    R(g, oc.dark, -1, -3, 5, 4);
    R(g, oc.cap, 0, -2, 3, 3);
  } else {
    R(g, oc.dark, 12, -3, 5, 4);
    R(g, oc.cap, 13, -2, 3, 3);
  }

  // Face direction
  if (dir === 2) {
    R(g, '#222', 5, 5, 2, 2);
    R(g, '#222', 9, 5, 2, 2);
    R(g, '#fff', 5, 5, 1, 1);
    R(g, '#fff', 9, 5, 1, 1);
  } else if (dir === 1) {
    R(g, '#222', 10, 5, 2, 2);
    R(g, '#fff', 10, 5, 1, 1);
  } else if (dir === 3) {
    R(g, '#222', 4, 5, 2, 2);
    R(g, '#fff', 4, 5, 1, 1);
  } else {
    R(g, '#d9a441', 4, 3, 8, 5);
  }

  // Equipped Sword shown in hand!
  if (V.sword && V.equipped === 'sword') {
    const sw = SWORD_STATS[V.swordTier] || SWORD_STATS.lendaria;
    const sx = dir === 3 ? 0 : 14;
    R(g, '#6b3f1d', sx, 8, 2, 3);
    R(g, '#ffd84a', sx - 1, 7, 4, 1);
    R(g, sw.blade, sx, 1, 2, 6);
    R(g, sw.edge, sx + 1, 1, 1, 6);
  }

  // Equipped Shield shown on off-arm!
  if (V.shield !== 'none') {
    const sh = SHIELD_STATS[V.shield] || SHIELD_STATS.madeira;
    const shx = dir === 3 ? 11 : -1;
    R(g, sh.trim, shx, 6, 4, 6);
    R(g, sh.color, shx + 1, 7, 2, 4);
  }

  // Lit Torch in showcase
  if (V.torchLit) {
    const fl = (t >> 2) & 1;
    R(g, '#6b3f1d', 14, 5, 1, 5);
    R(g, '#ff6a1a', 13, 2 + fl, 3, 3);
    R(g, '#ffe98a', 14, 3, 1, 2);
  }

  g.restore();
}

export function drawHeroShowcaseStandalone(
  g: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: {
    outfit: OutfitId;
    hasSword: boolean;
    equippedSword: boolean;
    swordTier: SwordTier;
    shieldTier: ShieldTier;
    torchLit: boolean;
    t: number;
    dir: number;
  },
): void {
  g.clearRect(0, 0, width, height);
  const pseudoV = {
    outfit: opts.outfit,
    sword: opts.hasSword ? 1 : 0,
    equipped: opts.equippedSword ? 'sword' : 'none',
    swordTier: opts.swordTier,
    shield: opts.shieldTier,
    torchLit: opts.torchLit,
  } as ProgressState;
  drawHeroShowcase(g, Math.round(width / 2), Math.round(height / 2) + 2, pseudoV, opts.t, opts.dir);
}

export function drawInventory(
  g: CanvasRenderingContext2D,
  world: WorldData,
  G: HeroState,
  V: ProgressState,
  hn: string,
  t: number,
  input: Record<KeyCode, boolean>,
  analogActive: boolean,
  particles: Particle[],
  projectiles: Projectile[],
  weather: WeatherState,
  worldTime: number,
  sel: number,
  invHeroDir = 2,
  dust: DustMote[] = [],
): void {
  drawGame(g, world, G, V, hn, t, input, analogActive, particles, projectiles, weather, worldTime, dust);
  R(g, 'rgba(6, 9, 18, 0.72)', 0, 0, W, H);

  // RE4 Tactical Attaché Frame
  R(g, '#4f5c7a', 6, 6, W - 12, H - 12);
  R(g, '#141926', 7, 7, W - 14, H - 14);
  // Subtle RE4 metallic case grid lines
  g.fillStyle = '#1e2638';
  for (let gx = 10; gx < W - 10; gx += 12) g.fillRect(gx, 10, 1, H - 20);
  for (let gy = 10; gy < H - 10; gy += 12) g.fillRect(10, gy, W - 20, 1);

  // Header
  R(g, '#1c2436', 9, 9, W - 18, 13);
  R(g, '#ffd84a55', 9, 21, W - 18, 1);
  tx(g, 'MALETA RE4', 14, 12, '#ffd84a');
  rup(g, 178, 10);
  tx(g, p3(G.rp), 189, 12, '#2ee06b');

  // LEFT STAGE: Live 3x Hero Showcase (Resident Evil 4 style!)
  R(g, '#0d111b', 10, 25, 86, 122);
  R(g, '#394563', 10, 25, 86, 1);
  R(g, '#394563', 10, 146, 86, 1);
  R(g, '#394563', 10, 25, 1, 122);
  R(g, '#394563', 95, 25, 1, 122);

  tx(g, (hn || 'HEROI').slice(0, 8), 53, 29, '#ffe98a', 'center');
  drawHeroShowcase(g, 53, 72, V, t, invHeroDir);

  const shDef = SHIELD_STATS[V.shield] || SHIELD_STATS.none;
  const swDef = SWORD_STATS[V.swordTier] || SWORD_STATS.none;
  const outDef = OUTFIT_COLORS[V.outfit] || OUTFIT_COLORS.verde;

  // Compact Hero Stats under showcase
  R(g, '#161d2e', 13, 109, 80, 34);
  tx(g, `HP:${G.hp}/${V.mh * 2}`, 16, 112, '#ff7882');
  tx(g, `ATQ:${V.equipped === 'sword' ? V.dmg : 0} DEF:${shDef.def}`, 16, 122, '#9ed8ff');
  tx(g, 'TOQUE:GIRAR', 53, 133, '#8c99bd', 'center');

  // RIGHT PANEL: RE4 Attaché Item Grid (4x2)
  const frag = V.it.fragmento | 0;
  const toolNames: Record<string, string> = {
    arco: `ARCO (${V.arrows} FLECHAS)`,
    bomba: `BOMBAS (${V.bombs})`,
    tocha: `TOCHAS (${V.torches})`,
    pocao: `POCAO RAPIDA (${V.pot})`,
  };

  const slots = [
    {
      title: V.sword ? swDef.name : 'ESPADA (VAZIO)',
      desc: !V.sword
        ? 'Cravada na praça central'
        : V.equipped === 'sword'
          ? `ATQ ${V.dmg}. A: Trocar/Guardar`
          : 'Guardada. A: Equipar',
      badge: V.sword ? (V.equipped === 'sword' ? 'EQ' : `${V.ownedSwords.length}`) : '',
    },
    {
      title: shDef.name,
      desc: V.ownedShields.length
        ? `DEF ${shDef.def}. B: Defender. A: Trocar`
        : 'Compre na Vila ou Forja Real',
      badge: V.shield !== 'none' ? 'EQ' : '',
    },
    {
      title: outDef.name,
      desc:
        V.ownedOutfits.length > 1
          ? 'A: Trocar roupa do heroi'
          : 'Compre na Alfaiataria Real!',
      badge: `${V.ownedOutfits.length}/4`,
    },
    {
      title: `BOTAO X: ${toolNames[V.secondary]}`,
      desc: 'A: Alternar item do botao X',
      badge: V.secondary.slice(0, 3).toUpperCase(),
    },
    {
      title: `POCAO DE VIDA (${V.pot})`,
      desc: V.pot > 0 ? 'A: Beber agora (cura total)' : 'Compre com mercadores',
      badge: V.pot > 0 ? `x${V.pot}` : '',
    },
    {
      title: `TOCHA (${V.torchLit ? 'ACESA' : 'APAGADA'})`,
      desc: V.torches > 0 || V.torchLit ? 'A: Acender / Apagar halo' : 'Compre tochas nas vilas',
      badge: V.torchLit ? 'ON' : `x${V.torches}`,
    },
    {
      title: `FRAGMENTOS (${frag}/3)`,
      desc: frag >= 3 ? 'Abra o castelo do Ciclope!' : 'Derrote chefes das cavernas',
      badge: `${frag}/3`,
    },
    {
      title: 'RELIQUIAS & MISSAO',
      desc: `Cog:${V.it.cogumelo | 0} Anel:${V.it.anel ? 1 : 0} Min:${V.it.minerio ? 1 : 0} Urso:${V.it.ursinho ? 1 : 0}`,
      badge: `${(V.it.cogumelo | 0) + (V.it.anel ? 1 : 0) + (V.it.minerio ? 1 : 0) + (V.it.ursinho ? 1 : 0)}`,
    },
  ];

  const invState = invItemStateFromProgress(V);
  for (let i = 0; i < INV_SLOT_COUNT; i++) {
    const col = i % 4;
    const row = (i / 4) | 0;
    const sx = 101 + col * 32;
    const sy = 27 + row * 28;
    const isSel = i === sel;

    R(g, isSel ? '#3a4668' : '#252d44', sx, sy, 29, 25);
    R(g, isSel ? '#242d46' : '#181e2e', sx + 1, sy + 1, 27, 23);
    if (isSel) {
      // Iconic RE4 yellow corner selection brackets
      R(g, '#ffd84a', sx, sy, 6, 1);
      R(g, '#ffd84a', sx, sy, 1, 6);
      R(g, '#ffd84a', sx + 23, sy, 6, 1);
      R(g, '#ffd84a', sx + 28, sy, 1, 6);
      R(g, '#ffd84a', sx, sy + 24, 6, 1);
      R(g, '#ffd84a', sx, sy + 19, 1, 6);
      R(g, '#ffd84a', sx + 23, sy + 24, 6, 1);
      R(g, '#ffd84a', sx + 28, sy + 19, 1, 6);
    }

    // The item itself is a physical picture — text only stamps the corner.
    drawInvItem(g, i, sx + 6, sy + 1, 1, invState);
    const tag = invItemTag(i, invState);
    if (tag) {
      tx(
        g,
        tag.text,
        sx + 27,
        sy + 17,
        tag.tone === 'green' ? '#2ee06b' : tag.tone === 'grey' ? '#8c99bd' : '#ffe98a',
        'right',
      );
    }
  }

  // Inspector box (bottom right)
  R(g, '#101522', 101, 86, 126, 61);
  R(g, '#4f5c7a', 101, 86, 126, 1);
  const active = slots[sel];
  tx(g, active.title.slice(0, 15), 105, 91, '#ffd84a');
  wrapText(active.desc, 15).slice(0, 3).forEach((lnText, idx) => {
    tx(g, lnText, 105, 104 + idx * 10, '#e8eefc');
  });
  tx(g, 'A:USAR  B/INV:SAIR', 164, 137, '#99a8cc', 'center');
}

export function drawShop(
  g: CanvasRenderingContext2D,
  shopId: ShopId,
  shopSel: number,
  G: HeroState,
  V: ProgressState,
): void {
  const shop = SHOPS[shopId];
  R(g, 'rgba(8, 5, 22, 0.86)', 0, 0, W, H);
  R(g, '#f0d060', 10, 6, 220, 148);
  R(g, '#1c153a', 12, 8, 216, 144);

  tx(g, shop.title, 18, 13, '#ffd84a');
  rup(g, 174, 12);
  tx(g, p3(G.rp), 186, 13, '#2ee06b');
  R(g, '#ffd84a66', 18, 24, 204, 1);

  shop.items.forEach((it, i) => {
    const ry = 28 + i * 17;
    const isSel = i === shopSel;
    const owned =
      (it.kind === 'sword' && V.ownedSwords.includes(it.tier as never)) ||
      (it.kind === 'shield' && V.ownedShields.includes(it.tier as never)) ||
      (it.kind === 'outfit' && V.ownedOutfits.includes(it.tier as never));

    R(g, isSel ? '#3c2e78' : '#241c4a', 18, ry, 204, 15);
    if (isSel) {
      R(g, '#ffd84a', 18, ry, 2, 15);
    }
    tx(g, (isSel ? '> ' : '  ') + it.name, 22, ry + 4, isSel ? '#ffd84a' : '#fff');
    tx(
      g,
      owned ? 'TEM' : `${it.price}R`,
      216,
      ry + 4,
      owned ? '#2ee06b' : G.rp >= it.price ? '#ffe98a' : '#ff6a6a',
      'right',
    );
  });

  const cur = shop.items[shopSel];
  R(g, '#130e2a', 18, 116, 204, 30);
  R(g, '#6a5bb0', 18, 116, 204, 1);
  if (cur) {
    tx(g, cur.desc, 22, 121, '#e8e0ff');
  }
  tx(g, 'A: COMPRAR/TROCAR   B: SAIR', 120, 134, '#ffd84a', 'center');
}
