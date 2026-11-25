// ---------------------------------------------------------------------------
// Physical inventory items (Resident Evil 4 style attaché case).
//
// Every item is a 16x16 pixel-art map drawn with fillRect, so it stays crisp
// at any integer scale: scale 1 for the in-canvas case, scale 4-6 for the
// React overlay. No text is used to represent an item — the picture is the item.
// ---------------------------------------------------------------------------
import { OUTFIT_COLORS, SHIELD_STATS, SWORD_STATS } from './constants';
import type { EngineUIState, OutfitId, ProgressState, SecondaryTool, ShieldTier, SwordTier } from './types';

export const INV_SLOT_COUNT = 8;
export const INV_ICON_PX = 16;

/** Everything the icons need to know about the hero, from either UI source. */
export interface InvItemState {
  hasSword: boolean;
  equippedSword: boolean;
  swordTier: SwordTier;
  shield: ShieldTier;
  outfit: OutfitId;
  secondary: SecondaryTool;
  ownedSwords: number;
  ownedShields: number;
  ownedOutfits: number;
  pot: number;
  torchLit: boolean;
  torches: number;
  arrows: number;
  bombs: number;
  fragments: number;
  mushrooms: number;
  hasRing: boolean;
  hasOre: boolean;
  hasBear: boolean;
}

export function invItemStateFromProgress(V: ProgressState): InvItemState {
  return {
    hasSword: Boolean(V.sword),
    equippedSword: V.equipped === 'sword',
    swordTier: V.swordTier,
    shield: V.shield,
    outfit: V.outfit,
    secondary: V.secondary,
    ownedSwords: V.ownedSwords.length,
    ownedShields: V.ownedShields.length,
    ownedOutfits: V.ownedOutfits.length,
    pot: V.pot,
    torchLit: V.torchLit,
    torches: V.torches,
    arrows: V.arrows,
    bombs: V.bombs,
    fragments: V.it.fragmento | 0,
    mushrooms: V.it.cogumelo | 0,
    hasRing: Boolean(V.it.anel),
    hasOre: Boolean(V.it.minerio),
    hasBear: Boolean(V.it.ursinho),
  };
}

export function invItemStateFromUI(ui: EngineUIState): InvItemState {
  return {
    hasSword: ui.hasSword,
    equippedSword: ui.equippedSword,
    swordTier: ui.swordTier,
    shield: ui.shieldTier,
    outfit: ui.outfit,
    secondary: ui.secondary,
    ownedSwords: ui.ownedSwords.length,
    ownedShields: ui.ownedShields.length,
    ownedOutfits: ui.ownedOutfits.length,
    pot: ui.pot,
    torchLit: ui.torchLit,
    torches: ui.torches,
    arrows: ui.arrows,
    bombs: ui.bombs,
    fragments: ui.fragments,
    mushrooms: ui.mushrooms,
    hasRing: ui.hasRing,
    hasOre: ui.hasOre,
    hasBear: ui.hasBear,
  };
}

/** Short spoken labels — used for accessibility, never as the item itself. */
export const INV_ITEM_LABELS = [
  'Espada',
  'Escudo',
  'Túnica',
  'Ferramenta do botão X',
  'Poção de vida',
  'Tocha',
  'Fragmento do cristal',
  'Relíquias',
] as const;

// --- pixel maps (16 wide x 16 tall, '.' = transparent) ---------------------

const SWORD_MAP = [
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '.......ab.......',
  '..gggggabggggg..',
  '.......cc.......',
  '.......cc.......',
  '.......cc.......',
  '......gggg......',
  '................',
];

const SHIELD_MAP = [
  '................',
  '................',
  '...tttttttttt...',
  '..tmmmmmmmmmmt..',
  '..tmmmmeemmmmt..',
  '..tmmmeeeemmmt..',
  '..tmmeeeeeemmt..',
  '..tmmmeeeemmmt..',
  '..tmmmmeemmmmt..',
  '...tmmmmmmmmt...',
  '....tmmmmmmt....',
  '....tmmmmmmt....',
  '.....tmmmmt.....',
  '......tttt......',
  '.......tt.......',
  '................',
];

const TUNIC_MAP = [
  '................',
  '................',
  '................',
  '...ddd....ddd...',
  '..dddddmmddddd..',
  '.dllmmmmmmmmmmd.',
  '.dmmmmmmmmmmmmd.',
  '.dmmmmmmmmmmmmd.',
  '..gggggggggggg..',
  '..mmmmmmmmmmmm..',
  '...mmmmmmmmmm...',
  '...mmmmmmmmmm...',
  '....mmmmmmmm....',
  '.....mmmmmm.....',
  '......mmmm......',
  '................',
];

const BOW_MAP = [
  '................',
  '................',
  '....wwwwwwwws...',
  '...ww.......s...',
  '..ww........s...',
  '.ww.........s...',
  '.ww.........s...',
  '.ww.aaaaaaaaahh.',
  '.ww.........s...',
  '.ww.........s...',
  '..ww........s...',
  '...ww.......s...',
  '....wwwwwwwws...',
  '................',
  '................',
  '................',
];

const BOMB_MAP = [
  '............F...',
  '...........f....',
  '..........f.....',
  '.........f......',
  '....bbbbbbbb....',
  '...bbbbbbbbbb...',
  '..bbbbbbbbbbbb..',
  '..bbHHHbbbbbbb..',
  '..bbbbbbbbbbbb..',
  '..bbbbbbbbbbbb..',
  '...bbbbbbbbbb...',
  '....bbbbbbbb....',
  '......bbbb......',
  '................',
  '................',
  '................',
];

const TORCH_MAP = [
  '.......ff.......',
  '......fFFf......',
  '.....fFFFFf.....',
  '.....fFFFFf.....',
  '......fFFf......',
  '.......ff.......',
  '......WWWW......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '.......ww.......',
  '......wwww......',
  '.......ww.......',
  '.......ww.......',
  '................',
];

const POTION_MAP = [
  '.......cc.......',
  '......cccc......',
  '.......gg.......',
  '......gggg......',
  '.....gg..gg.....',
  '....gg....gg....',
  '...ggRRRRRRgg...',
  '...gRRRRRRRRg...',
  '...gRRwwRRRRg...',
  '...gRRRRRRRRg...',
  '...gRRRRRRRRg...',
  '....gRRRRRRg....',
  '.....gggggg.....',
  '................',
  '................',
  '................',
];

const CRYSTAL_MAP = [
  '................',
  '.......dd.......',
  '......oddo......',
  '.....oddddo.....',
  '....odwwdddo....',
  '...oddddddddo...',
  '...oddwwddddo...',
  '...oddddddddo...',
  '...oddddddddo...',
  '....oddddddo....',
  '.....oddddo.....',
  '......oddo......',
  '.......oo.......',
  '................',
  '................',
  '................',
];

// Relic mini-items, each 8x8, composited into the 16x16 slot.
const MUSHROOM_MAP = [
  '..rrrr..',
  '.rrrrrr.',
  'rrrrrrrr',
  'dddddddd',
  '..ssss..',
  '..ssss..',
  '..ssss..',
  '..dddd..',
];

const RING_MAP = [
  '..gggg..',
  '.g....g.',
  'g..cc..g',
  'g..cc..g',
  'g......g',
  '.g....g.',
  '..gggg..',
  '........',
];

const ORE_MAP = [
  '..kkkk..',
  '.kjjkkk.',
  'kjjkkkkk',
  'kkcccckk',
  'kkkkkkkk',
  '.kkkkkk.',
  '..kkkk..',
  '........',
];

const BEAR_MAP = [
  '..b..b..',
  '.bbbbbb.',
  'bbebbebb',
  'bbssssbb',
  'bbbnnbbb',
  '..bbbb..',
  '.bbbbbb.',
  'b.bbbb.b',
];

// --- palettes ---------------------------------------------------------------

const GREY = '#3a3a4a';
const GREY_2 = '#4a4a5e';

function swordPalette(s: InvItemState): Record<string, string> {
  if (!s.hasSword) return { a: GREY, b: GREY_2, g: GREY_2, c: GREY };
  const sw = SWORD_STATS[s.swordTier] || SWORD_STATS.lendaria;
  return { a: sw.blade, b: sw.edge, g: '#ffd84a', c: '#6b3f1d' };
}

function shieldPalette(s: InvItemState): Record<string, string> {
  if (s.shield === 'none') return { t: GREY, m: GREY_2, e: '#6a6a80' };
  const sh = SHIELD_STATS[s.shield] || SHIELD_STATS.none;
  return { t: sh.trim, m: sh.color, e: '#fff8c4' };
}

function tunicPalette(s: InvItemState): Record<string, string> {
  const oc = OUTFIT_COLORS[s.outfit] || OUTFIT_COLORS.verde;
  return { d: oc.dark, m: oc.main, l: oc.light, g: '#ffd84a' };
}

function toolPalette(s: InvItemState): Record<string, string> {
  if (s.secondary === 'arco') {
    return { w: '#c98b3c', s: '#e8f4ff', a: '#9a6a34', h: '#dfe8f4' };
  }
  if (s.secondary === 'bomba') {
    return { b: '#222230', H: '#4a4a66', f: '#ff9a2a', F: '#ffe47a' };
  }
  if (s.secondary === 'tocha') {
    return torchPalette(s);
  }
  return potionPalette(s);
}

function potionPalette(s: InvItemState): Record<string, string> {
  const full = s.pot > 0;
  return {
    c: '#c98b3c',
    g: '#d8e8ff',
    R: full ? '#ff4a55' : '#4a4468',
    w: full ? '#ffb8be' : '#6a6a80',
  };
}

function torchPalette(s: InvItemState): Record<string, string> {
  const lit = s.torchLit;
  return {
    w: '#6b3f1d',
    W: '#8a5a2a',
    f: lit ? '#ff6a1a' : '#3f3a44',
    F: lit ? '#ffe98a' : '#565060',
  };
}

function crystalPalette(s: InvItemState): Record<string, string> {
  const has = s.fragments > 0;
  return {
    o: has ? '#1b4a8a' : '#2e2e3e',
    d: has ? '#3ad0ff' : '#4a4a5e',
    w: has ? '#eaffff' : '#6a6a80',
  };
}

function mushroomPalette(): Record<string, string> {
  return { r: '#e0453c', d: '#9c241d', s: '#f0e2c4' };
}

function ringPalette(has: boolean): Record<string, string> {
  return has ? { g: '#f0bc3a', c: '#5ad8ff' } : { g: GREY, c: GREY_2 };
}

function orePalette(has: boolean): Record<string, string> {
  return has ? { k: '#6d7488', j: '#aab4c8', c: '#5ad8ff' } : { k: GREY, j: GREY_2, c: '#5a5a70' };
}

function bearPalette(has: boolean): Record<string, string> {
  return has
    ? { b: '#a4713a', s: '#f0dfc0', n: '#3a2412' }
    : { b: GREY, s: GREY_2, n: '#2a2a38' };
}

// --- drawing ----------------------------------------------------------------

function drawPixels(
  g: CanvasRenderingContext2D,
  map: readonly string[],
  pal: Record<string, string>,
  ox = 0,
  oy = 0,
): void {
  for (let y = 0; y < map.length; y++) {
    const row = map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row.charAt(x);
      if (ch === '.') continue;
      const c = pal[ch];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

/** Relics share one cell: owned ones are composited like a stacked pile. */
function drawRelics(g: CanvasRenderingContext2D, s: InvItemState): void {
  const pile: Array<{ map: readonly string[]; pal: Record<string, string> }> = [];
  if (s.mushrooms > 0) pile.push({ map: MUSHROOM_MAP, pal: mushroomPalette() });
  if (s.hasRing) pile.push({ map: RING_MAP, pal: ringPalette(true) });
  if (s.hasOre) pile.push({ map: ORE_MAP, pal: orePalette(true) });
  if (s.hasBear) pile.push({ map: BEAR_MAP, pal: bearPalette(true) });

  if (!pile.length) {
    // Empty cell: a dimmed crate outline so the slot still reads as physical.
    drawPixels(g, BEAR_MAP, bearPalette(false), 4, 4);
    return;
  }

  const spots: Array<[number, number]> =
    pile.length === 1
      ? [[4, 4]]
      : pile.length === 2
        ? [
            [0, 4],
            [8, 4],
          ]
        : pile.length === 3
          ? [
              [0, 0],
              [8, 0],
              [4, 8],
            ]
          : [
              [0, 0],
              [8, 0],
              [0, 8],
              [8, 8],
            ];

  pile.forEach((it, i) => {
    const [ox, oy] = spots[i];
    // Drop the item behind the others first so the pile reads as depth.
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillRect(ox + 1, oy + 2, 7, 6);
    drawPixels(g, it.map, it.pal, ox, oy);
  });
}

function drawSlotLocal(g: CanvasRenderingContext2D, slot: number, s: InvItemState): void {
  switch (slot) {
    case 0:
      drawPixels(g, SWORD_MAP, swordPalette(s));
      break;
    case 1:
      drawPixels(g, SHIELD_MAP, shieldPalette(s));
      break;
    case 2:
      drawPixels(g, TUNIC_MAP, tunicPalette(s));
      break;
    case 3:
      if (s.secondary === 'arco') drawPixels(g, BOW_MAP, toolPalette(s));
      else if (s.secondary === 'bomba') drawPixels(g, BOMB_MAP, toolPalette(s));
      else if (s.secondary === 'tocha') drawPixels(g, TORCH_MAP, toolPalette(s));
      else drawPixels(g, POTION_MAP, toolPalette(s));
      break;
    case 4:
      drawPixels(g, POTION_MAP, potionPalette(s));
      break;
    case 5:
      drawPixels(g, TORCH_MAP, torchPalette(s));
      break;
    case 6:
      drawPixels(g, CRYSTAL_MAP, crystalPalette(s));
      break;
    default:
      drawRelics(g, s);
      break;
  }
}

/**
 * Draws one physical item. `x`/`y` is the top-left of the 16x16 cell in the
 * caller's coordinate space; `scale` must be an integer to keep pixels crisp.
 */
export function drawInvItem(
  g: CanvasRenderingContext2D,
  slot: number,
  x: number,
  y: number,
  scale: number,
  s: InvItemState,
): void {
  const sc = Math.max(1, Math.round(scale));
  g.save();
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(x), Math.round(y));
  g.scale(sc, sc);
  drawSlotLocal(g, slot, s);
  g.restore();
}

/** Physical count/quality tag stamped on the corner of a cell (RE4 style). */
export function invItemTag(
  slot: number,
  s: InvItemState,
): { text: string; tone: 'green' | 'amber' | 'grey' } | null {
  switch (slot) {
    case 0:
      if (!s.hasSword) return { text: '—', tone: 'grey' };
      if (s.equippedSword) return { text: 'EQ', tone: 'green' };
      return { text: `${s.ownedSwords}`, tone: 'amber' };
    case 1:
      if (s.shield === 'none') return { text: '—', tone: 'grey' };
      return { text: `DEF ${SHIELD_STATS[s.shield]?.def ?? 0}`, tone: 'amber' };
    case 2:
      return { text: `${s.ownedOutfits}/5`, tone: 'amber' };
    case 3: {
      const n =
        s.secondary === 'arco'
          ? s.arrows
          : s.secondary === 'bomba'
            ? s.bombs
            : s.secondary === 'tocha'
              ? s.torches
              : s.pot;
      return { text: `x${n}`, tone: n > 0 ? 'amber' : 'grey' };
    }
    case 4:
      return { text: `x${s.pot}`, tone: s.pot > 0 ? 'green' : 'grey' };
    case 5:
      return s.torchLit
        ? { text: 'ON', tone: 'green' }
        : { text: `x${s.torches}`, tone: s.torches > 0 ? 'amber' : 'grey' };
    case 6:
      return { text: `${s.fragments}/3`, tone: s.fragments >= 3 ? 'green' : 'amber' };
    default: {
      const n =
        (s.mushrooms > 0 ? 1 : 0) + (s.hasRing ? 1 : 0) + (s.hasOre ? 1 : 0) + (s.hasBear ? 1 : 0);
      return { text: n ? `${n}` : '—', tone: n ? 'amber' : 'grey' };
    }
  }
}
