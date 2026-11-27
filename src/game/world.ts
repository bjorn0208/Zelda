import { mergeWorldToSingleMap, SINGLE_MAP } from './singleMap';
import {
  BAZAAR_LINE,
  BIOME_LINES,
  BLACKSMITH_LINE,
  BONUS_CAVES,
  CAVES,
  COMMON_LINES,
  FATHER_INTRO_LINE,
  FATHER_TILE,
  FLOOR_TILES,
  GUARD_LINE,
  HOUSE_LINES,
  HPT,
  MARKET_STALLS,
  MAX_HEARTS,
  MERCHANT_THEO_LINE,
  OBSTACLE_TILES,
  SAVE_KEY,
  SPECIAL_HOUSE_NPCS,
  SWORD_MAP,
  SWORD_TILE,
  TAILOR_LINE,
  VILLAGES,
} from './constants';
import { DominicKind, EnemyKind, HeroState, Npc, NpcKind, ProgressState, WorldData } from './types';
import { applyRoomPhysics } from './roomPhysics';

export const hs = (a: number, b: number): number => ((a * 73856093) ^ (b * 19349663)) >>> 0;
export const rnd = (n: number): number => Math.floor(Math.random() * n);
export const p3 = (n: number): string => String(n).padStart(3, '0');

export const bio = (x: number, y: number): 'd' | 'n' | 's' | 'w' | 'g' =>
  y === 0 && x >= 3 && x <= 5
    ? 'd'
    : x <= 2 && y <= 3
      ? 'n'
      : x >= 5 && y <= 3
        ? 's'
        : swamp(x, y)
          ? 'w'
          : 'g';

export const lake = (x: number, y: number): boolean => x <= 2 && y >= 4;
export const forest = (x: number, y: number): boolean => x >= 5 && y >= 4 && !swamp(x, y);
/** Sudeste do mapa: lama, poças e jacarés. */
export const swamp = (x: number, y: number): boolean => x >= 5 && y >= 5;

export const isHouse = (m: number): boolean => (m >= 100 && m < 200) || (m >= 300 && m < 500);

export const dungeonTheme = (m: number): number =>
  m >= 260
    ? 4
    : m === 250 || m === 252
      ? 0
      : m === 251 || m === 253
        ? 5
        : m >= 230 && m < 240
          ? 6
          : m >= 200
            ? ((m - 200) / 10) | 0
            : 3;

export function mapDisplayName(m: number): string {
  if (m === 451) return 'SEU QUARTO (2o ANDAR)';
  if (m === 151) return 'SUA CASA (1o ANDAR)';
  if (m === 351) return 'CASA DE MARIA';
  if (m === 135) return 'MERCADO CENTRAL';
  if (m === 335) return 'FORJA REAL';
  if (m === 136) return 'ALFAIATARIA REAL';
  if (isHouse(m)) return 'INTERIOR DE CASA';
  if (m >= 260) return m === 261 ? 'SALAO DE VORAK' : 'CASTELO DE VORAK';
  if (m === 250) return 'CAVERNA DO LAGO';
  if (m === 251) return 'CAVERNA SECRETA';
  if (m === 252) return 'GRUTA DO TESOURO';
  if (m === 253) return 'COFRE ANTIGO';
  if (m >= 230 && m < 240) return m === 232 ? 'COVA DO JACARÉ GIGANTE' : 'CAVERNA DO PANTANO';
  if (m >= 220) return 'CAVERNA DE GELO';
  if (m >= 210) return 'RUINAS DO DESERTO';
  if (m >= 200) return 'CAVERNA DA FLORESTA';
  if (m === 35 || m === 36) return 'VILA CENTRAL';
  if (m === 51) return 'VILA INICIAL';
  if (m === 4) return 'PORTAO DE VORAK';
  if (m >= 0 && m < 56) {
    const sx = m & 7;
    const sy = m >> 3;
    const k = `${sx},${sy}`;
    if (VILLAGES[k]) return 'VILAREJO';
    const b = bio(sx, sy);
    if (b === 'd') return 'TERRAS SOMBRIAS';
    if (b === 'n') return 'TERRA GELADA';
    if (b === 's') return 'DESERTO';
    if (b === 'w') return 'PANTANO';
    if (lake(sx, sy)) return 'REGIAO DO LAGO';
    if (forest(sx, sy)) return 'FLORESTA';
    return 'PLANICIE';
  }
  return 'AURORA';
}

function rg(i: number): () => number {
  let s = i * 7919 + 1013;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function createInitialProgress(): ProgressState {
  return {
    it: {},
    fl: {},
    dmg: 1,
    pot: 1,
    mh: MAX_HEARTS,
    msg: '',
    mt: 0,
    sword: 0,
    equipped: 'none',
    swordTier: 'none',
    ownedSwords: [],
    shield: 'none',
    ownedShields: [],
    outfit: 'verde',
    ownedOutfits: ['verde'],
    arrows: 5,
    bombs: 2,
    torches: 2,
    hasBoomerang: false,
    torchLit: false,
    secondary: 'tocha',
    explored: [51],
    dominic: {
      owned: ['none', 'none', 'none'] as DominicKind[],
      current: 'none' as DominicKind,
      activeEffect: 'none' as 'single' | 'all' | 'none',
      flashTimer: 0,
    },
  };
}

export function createInitialHero(): HeroState {
  return {
    map: 451,
    x: 30,
    y: 52,
    dir: 2,
    hp: MAX_HEARTS * 2,
    rp: 40, // Starting pocket money for central village shops
    inv: 0,
    hitFlash: 0,
    sw: 0,
    wk: 0,
    shielding: false,
    sleeping: true,
    wakeTimer: 0,
    it: [],
    en: [],
    dlg: null,
    ret: { map: 51, x: 32, y: 68 },
  };
}

interface RoomOptions {
  chest?: boolean | number;
  back?: number | 'ret';
  fwd?: number;
  en?: [number, EnemyKind];
  treasureVault?: boolean;
}

function createRoom(
  world: WorldData,
  id: number,
  h: boolean,
  r: () => number,
  o: RoomOptions,
): void {
  const T_ = h ? 3 : dungeonTheme(id);
  const f = h ? 'F' : FLOOR_TILES[T_];
  const ob = h ? 'K' : OBSTACLE_TILES[T_];
  const m = Array.from({ length: 10 }, () => Array<string>(15).fill(f));
  // O jacaré gigante da caverna do pantano também é chefe (sala 232).
  const bs = Boolean(o.en && (o.en[1] === 4 || o.en[1] === 10));
  const q = id % 10;

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      if (!x || !y || x === 14 || y === 9) m[y][x] = 'W';
    }
  }

  if (h) {
    const isShop = id === 135 || id === 335 || id === 136;
    m[0][3] = 'w';
    m[0][11] = 'w';

    if (id === 451) {
      // ── Quatro paredes, piso de madeira, decoração estilo Zelda (refs imgur) ──
      // Cama (esquerda, 2 tiles largos), mesinha de cabeceira com lâmpada,
      // estante com livros, janela com cortinas, quadro, bandeira Hylian,
      // tapete verde com brasão, mesa com vaso de flores, baú do escudo,
      // fogão/chaminé (lareira) e planta no canto.
      // Cama apenas como desenho do fundo: colisão cobre as linhas 3-4.
      m[3][1] = 'e';
      m[3][2] = 'e';
      m[3][3] = 'e';
      m[4][1] = 'e';
      m[4][2] = 'e';
      m[4][3] = 'e';
      m[2][3] = 'v'; // mesinha de cabeceira + lâmpada
      m[1][6] = 'w'; // janela com cortinas verdes
      m[1][8] = 'z'; // mesa com vaso de flores
      m[2][8] = 'z';
      m[2][11] = 'C'; // baú azul do Escudo de Madeira, no desenho do quarto
      m[1][13] = 'q'; // estante de livros
      m[2][13] = 'q';
      // Tapete verde central com brasão Hylian
      for (let y = 5; y < 8; y++) {
        for (let x = 5; x < 11; x++) m[y][x] = 'r';
      }
      m[6][8] = 'd'; // brasão dourado no centro do tapete
      m[7][1] = 'u'; // fogão / lareira com chaminé
      m[7][2] = 'u';
      m[7][13] = 'E'; // escada descendo para o 1o andar
      // Vasos de planta nos cantos (o da esquerda fica abaixo da cama)
      m[6][1] = 'v';
      m[4][13] = 'v';
    } else if (isShop) {
      // Grand Emporium Interior: wide counter, display racks, lanterns & crimson runner
      m[1][1] = 'q';
      m[1][2] = 'q';
      m[1][10] = 'u';
      m[1][12] = 'q';
      m[1][13] = 'q';
      m[2][1] = 'K';
      m[3][1] = 'K';
      m[2][13] = 'K';
      m[3][13] = 'K';
      m[3][5] = 'z';
      m[3][6] = 'z';
      m[3][7] = 'z';
      m[3][8] = 'z';
      m[3][9] = 'z';
      m[4][4] = 'L';
      m[4][10] = 'L';
      m[6][1] = 'v';
      m[7][1] = 'v';
      m[6][13] = 'v';
      m[7][13] = 'v';
      for (let y = 4; y < 8; y++) {
        for (let x = 5; x < 10; x++) m[y][x] = 'r';
      }
    } else {
      const v =
        SPECIAL_HOUSE_NPCS[id] === 'ferreiro'
          ? 2
          : SPECIAL_HOUSE_NPCS[id] === 'marta' || SPECIAL_HOUSE_NPCS[id] === 'pai'
            ? 1
            : hs(id, 2) % 3;
      const layouts: Array<Array<[number, number, string]>> = [
        [
          [1, 2, 'e'],
          [2, 2, 'e'],
          [11, 1, 'q'],
          [12, 1, 'q'],
          [13, 7, 'v'],
          [1, 7, 'v'],
          [3, 7, 'z'],
          [12, 6, 'z'],
        ],
        [
          [12, 1, 'u'],
          [1, 1, 'z'],
          [2, 1, 'z'],
          [1, 6, 'e'],
          [2, 6, 'e'],
          [13, 7, 'v'],
          [12, 7, 'v'],
          [1, 3, 'v'],
          [11, 6, 'z'],
        ],
        [
          [1, 1, 'q'],
          [2, 1, 'q'],
          [12, 1, 'u'],
          [12, 6, 'K'],
          [13, 6, 'K'],
          [1, 7, 'K'],
          [1, 6, 'K'],
          [11, 7, 'v'],
        ],
      ];
      layouts[v].forEach(([x, y, c]) => {
        if (c === 'e' || c === 'v') m[y][x] = 'F';
        else m[y][x] = c;
      });
      // Kitchen area on lower floor
      m[5][2] = 'L'; // stove
      m[5][3] = 'z'; // pot on stove
      m[5][4] = 'z';
      m[2][11] = 'K'; // cabinet
      m[2][12] = 'K';
      m[3][11] = 'K';
      m[3][12] = 'K';
      m[7][13] = 'E'; // stairs to bedroom (2nd floor)
      for (let y = 4; y < 7; y++) {
        for (let x = 5; x < 10; x++) m[y][x] = 'r';
      }
      m[7][7] = 'r';
      if (id !== 451) {
        m[7][13] = 'E'; // Escada para o quarto (2o andar)
      }
      if (id === 151) {
        // Sua casa: escada no centro do topo e porta de saída à direita.
        m[2][13] = 'F';
        m[7][13] = 'D';
        m[1][7] = 'E';
      }
    }
  } else {
    for (let n = 0; n < 8; n++) {
      const x = 1 + ((r() * 13) | 0);
      const y = 2 + ((r() * 6) | 0);
      if ((x < 6 || x > 8) && !(x >= 9 && y >= 2 && y <= 4) && m[y][x] === f) {
        m[y][x] = ob;
      }
    }
    if (bs) {
      for (const [x, y] of [
        [3, 2],
        [3, 5],
        [11, 2],
        [11, 5],
      ]) {
        m[y][x] = ob;
      }
      m[2][7] = 'A';
      for (let y = 3; y < 8; y++) m[y][7] = 'r';
    } else if (q || id >= 250) {
      for (const [x, y] of [
        [3, 3],
        [3, 6],
        [11, 3],
        [11, 6],
      ]) {
        m[y][x] = ob;
      }
    }
    // Wall & floor torches inside caves to illuminate entrances & key alcoves
    m[7][5] = 't';
    m[7][9] = 't';
    m[2][2] = 't';
    m[2][12] = 't';

    const cr = [
      [1, 3],
      [13, 3],
      [1, 6],
      [13, 6],
      [4, 1],
      [10, 1],
    ];
    for (let n = 0; n < 3; n++) {
      const [x, y] = cr[(r() * 6) | 0];
      if (m[y][x] === f) m[y][x] = 'x';
    }
    if (T_ === 0) {
      const px = r() < 0.5 ? 2 : 11;
      for (let y = 6; y < 8; y++) {
        for (let x = px; x < px + 2; x++) m[y][x] = '~';
      }
    }
    // Tema 6: cova alagada, com poças e juncos entre as pedras musgosas.
    if (T_ === 6) {
      for (const [px, py] of [
        [2, 2],
        [11, 2],
        [2, 7],
        [11, 7],
      ]) {
        for (let y = py; y < py + 2; y++) {
          for (let x = px; x < px + 2; x++) m[y][x] = '~';
        }
      }
      for (let n = 0; n < 8; n++) {
        const x = 1 + ((r() * 13) | 0);
        const y = 1 + ((r() * 8) | 0);
        if (m[y][x] === f) m[y][x] = 'l';
      }
    }
    for (let n = 0; n < 3; n++) {
      const x = 1 + ((r() * 13) | 0);
      const y = 2 + ((r() * 6) | 0);
      if (m[y][x] === f) m[y][x] = 'o';
    }
    for (const [x, y] of [
      [10, 3],
      [12, 3],
      [11, 2],
      [11, 4],
    ]) {
      m[y][x] = f;
    }
    m[3][11] = o.chest ? 'C' : f;

    // Extra treasure chests & bomb-breakable cracked boulders in treasure vaults!
    if (o.treasureVault || id >= 250) {
      m[3][3] = 'C';
      m[4][2] = 'R';
      m[4][3] = 'R';
      m[3][4] = 'R';
    }
    if (q === 1) {
      m[6][2] = 'C';
    }
  }

  if (id === 151) {
    // Passagem inferior no meio, visível no PNG da sala.
    m[8][7] = 'D';
    m[7][13] = 'F';
  } else if (id !== 451) {
    m[8][7] = 'D';
  }
  if (o.fwd) m[1][7] = 'D';

  world.maps[id] = m;
  world.neighbors[id] = {};
  world.npcs[id] = [];
  world.enemies[id] = o.en || [0, 0];
  if (id === 451) {
    // Ao descer, o herói chega já ao lado da passagem inferior e do pai.
    world.doors[id] = [{ x: 13, y: 7, to: 151, px: 112, py: 112 }];
  } else if (id === 151) {
    // Saída no meio da parte de baixo e escada no centro do topo.
    world.doors[id] = [
      { x: 7, y: 8, to: o.back || 'ret', px: 112, py: 24 },
      { x: 7, y: 1, to: 451, px: 112, py: 112 },
    ];
  } else {
    world.doors[id] = [{ x: 7, y: 8, to: o.back || 'ret', px: 112, py: 24 }];
  }
  if (o.fwd && id !== 151) {
    world.doors[id].push({ x: 7, y: 1, to: o.fwd, px: 112, py: 112 });
  }
  if (h && id !== 451 && id !== 151) {
    // Só as casas têm escada para o quarto. Cavernas não podem teleportar
    // o herói para o quarto ao pisar no canto inferior direito.
    world.doors[id].push({ x: 13, y: 7, to: 451, px: 180, py: 42 });
  }
}

function genOverworldScreen(world: WorldData, sx: number, sy: number): void {
  const i = sy * 8 + sx;
  const k = `${sx},${sy}`;
  const b = bio(sx, sy);
  const r = rg(i + 7);
  const vil = VILLAGES[k];
  const ci = CAVES[k];
  const bn = BONUS_CAVES[k];
  const isCentral = k === '3,4' || k === '4,4';
  const fl = b === 's' ? 's' : b === 'n' ? 'n' : b === 'd' ? 'c' : b === 'w' ? 'a' : '.';
  const dc = () =>
    b === 's'
      ? r() < 0.5
        ? 'k'
        : '#'
      : b === 'n'
        ? 'P'
        : b === 'd'
          ? '#'
          : b === 'w'
            ? (r() < 0.6 ? 'T' : '#')
            : 'T';
  const bd = b === 'd' ? 'W' : b === 's' ? '#' : b === 'n' ? 'P' : 'T';

  const m = Array.from({ length: 10 }, () => Array<string>(15).fill(fl));
  const gp = (x: number, y: number) =>
    (x >= 6 && x <= 8 && ((!y && sy > 0) || (y === 9 && sy < 6))) ||
    (y >= 4 && y <= 5 && ((!x && sx > 0) || (x === 14 && sx < 7)));

  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      if ((!x || !y || x === 14 || y === 9) && !gp(x, y)) m[y][x] = bd;
    }
  }

  world.neighbors[i] = {};
  if (sx > 0) world.neighbors[i].l = i - 1;
  if (sx < 7) world.neighbors[i].r = i + 1;
  if (sy > 0) world.neighbors[i].u = i - 8;
  if (sy < 6) world.neighbors[i].d = i + 8;

  const dn = isCentral ? 0.04 : forest(sx, sy) ? 0.3 : b === 'd' || b === 'w' ? 0.16 : 0.1;
  for (let y = 1; y < 9; y++) {
    for (let x = 1; x < 14; x++) {
      if ((x >= 6 && x <= 8) || (y >= 4 && y <= 5)) continue;
      const q = r();
      if (q < dn) m[y][x] = q < dn * 0.3 && b === 'g' ? 'b' : dc();
      else if (b === 'g' && q < dn + 0.05) m[y][x] = 'f';
    }
  }

  if (lake(sx, sy) && !isCentral && !bn) {
    const ox = r() < 0.5 ? 2 : 9;
    const oy = r() < 0.5 ? 1 : 6;
    for (let y = oy; y < oy + 2; y++) {
      for (let x = ox; x < ox + 3; x++) m[y][x] = '~';
    }
  }

  // Pântano: várias poças de água/lama e juncos pelo cenário. As poças são
  // sólidas, mas nunca cobrem as passagens centrais do mapa.
  if (b === 'w' && !isCentral) {
    const spots = [
      [1, 1],
      [10, 1],
      [1, 6],
      [10, 6],
      [2, 7],
      [11, 2],
    ];
    const start = hs(i, 11) % spots.length;
    for (let p = 0; p < 3; p++) {
      const [px, py] = spots[(start + p) % spots.length];
      const pw = 2 + (hs(i, p) % 2);
      for (let y = py; y < py + 2; y++) {
        for (let x = px; x < px + pw; x++) {
          if (x < 14 && y < 9) m[y][x] = '~';
        }
      }
    }
    for (let n = 0; n < 12; n++) {
      const x = 1 + ((r() * 13) | 0);
      const y = 1 + ((r() * 8) | 0);
      if (m[y][x] === 'a') m[y][x] = 'l';
    }
  }

  // Novo centro: quadrado murado com quatro saídas e sem postes.
  if (isCentral) {
    if (i === SWORD_MAP) {
      for (let x = 0; x < 15; x++) {
        m[0][x] = 'W';
        m[9][x] = 'W';
      }
      for (let y = 0; y < 10; y++) {
        m[y][0] = 'W';
        m[y][14] = 'W';
      }
      for (let y = 1; y < 9; y++) {
        for (let x = 1; x < 14; x++) m[y][x] = 'p';
      }
      // Portões alinhados com as saídas do mundo (norte, sul, oeste, leste).
      for (const x of [6, 7, 8]) {
        m[0][x] = 'p';
        m[9][x] = 'p';
      }
      for (const y of [4, 5]) {
        m[y][0] = 'p';
        m[y][14] = 'p';
      }
    } else {
      for (let y = 4; y <= 6; y++) {
        for (let x = 1; x < 14; x++) m[y][x] = 'p';
      }
      for (let y = 1; y < 9; y++) {
        for (let x = 6; x <= 8; x++) m[y][x] = 'p';
      }
      m[5][5] = 'L';
      m[5][9] = 'L';
      m[7][5] = 'L';
      m[7][9] = 'L';
    }
  } else if (vil) {
    m[4][5] = 'L';
    m[4][9] = 'L';
  }

  // A Espada Lendária é o centro da praça da Vila Central.
  if (i === SWORD_MAP) m[SWORD_TILE.y][SWORD_TILE.x] = 'S';

  world.doors[i] = [];
  world.npcs[i] = [];

  if (b === 'd' && sx === 4) {
    for (let x = 4; x <= 10; x++) m[1][x] = 'W';
    for (const x of [4, 5, 6, 8, 9, 10]) m[2][x] = 'W';
    m[2][7] = 'G';
  }

  if (i === 35 || i === 36) {
    // Grand Stores: só o mapa 35 mantém fachadas. O novo centro é um pátio murado.
    const stores = i === 35 ? [0, 1] : [0];
    for (const s of stores) {
      const x0 = s ? 9 : 1;
      const id = (s ? 300 : 100) + i;
      if (i !== 36) {
        for (let y = 1; y <= 3; y++) {
          for (let x = x0; x < x0 + 5; x++) {
            m[y][x] = y < 3 ? 'U' : x === x0 + 2 ? 'D' : 'V';
          }
        }
        world.doors[i].push({ x: x0 + 2, y: 3, to: id, px: 112, py: 112 });
      }
      createRoom(world, id, true, rg(id), {});

      if (id === 135) {
        world.npcs[id] = [
          {
            x: 7,
            y: 2,
            c: '#d35400',
            kind: 'merchant',
            name: 'Mercador Theo',
            shopId: 'items',
            s: MERCHANT_THEO_LINE,
          },
        ];
      } else if (id === 335) {
        world.npcs[id] = [
          {
            x: 7,
            y: 2,
            c: '#b03a2e',
            kind: 'blacksmith',
            name: 'Mestre Ferreiro',
            shopId: 'weapons',
            s: BLACKSMITH_LINE,
          },
        ];
      } else if (id === 136) {
        world.npcs[id] = [
          {
            x: 7,
            y: 2,
            c: '#8e44ad',
            kind: 'merchant',
            name: 'Costureira Clara',
            shopId: 'tailor',
            s: TAILOR_LINE,
          },
        ];
      }
    }
    if (i === 36) {
      // Seis barracas interativas: grade 20x20 da imagem adaptada para a tela 15x10.
      for (const stall of MARKET_STALLS) {
        world.npcs[i].push({
          x: stall.x,
          y: stall.y,
          c: stall.awning,
          kind: 'merchant',
          name: stall.name,
          shopId: stall.shopId,
          stall: { awning: stall.awning, stripe: stall.stripe },
          s: `Na barraca de ${stall.name} eu vendo ${stall.goods}. Escolha o que levar para a jornada dos tres Dominics!`,
        });
        m[stall.y][stall.x] = 'Y';
      }
    }
  } else {
    const hsd = vil
      ? [0, 1]
      : b === 'd' || b === 'w' || ci != null || bn
        ? []
        : r() < 0.4
          ? [r() < 0.5 ? 0 : 1]
          : [];
    for (const s of hsd) {
      const x0 = s ? 10 : 1;
      const id = (s ? 300 : 100) + i;
      for (let y = 1; y < 4; y++) {
        for (let x = x0; x < x0 + 3; x++) {
          m[y][x] = y < 3 || x !== x0 + 1 ? 'H' : 'D';
        }
      }
      world.doors[i].push({ x: x0 + 1, y: 3, to: id, px: 112, py: 112 });
      createRoom(world, id, true, rg(id), {});

      const hKind: NpcKind =
        SPECIAL_HOUSE_NPCS[id] === 'ferreiro'
          ? 'blacksmith'
          : SPECIAL_HOUSE_NPCS[id] === 'crianca'
            ? 'child'
            : 'villager';
      world.npcs[id] = [
        {
          x: 7,
          y: 3,
          c: '#8e44ad',
          kind: hKind,
          heal: 1,
          q: SPECIAL_HOUSE_NPCS[id],
          s: HOUSE_LINES[hs(id, 1) % HOUSE_LINES.length],
        },
      ];
      if (id === 151) {
        // O pai fica ao lado da porta de saída, fora da escada central.
        world.npcs[id] = [
          {
            x: FATHER_TILE.x,
            y: FATHER_TILE.y,
            c: '#b06a34',
            kind: 'elder',
            name: 'Pai',
            heal: 1,
            q: SPECIAL_HOUSE_NPCS[id],
            s: FATHER_INTRO_LINE,
          },
        ];
      }
    }

    // Outdoor Merchant Stall & interactive Merchant NPC in all villages!
    // O novo centro (36) não tem mercador avulso: só as seis barracas.
    if (vil && i !== 36) {
      m[6][12] = 'Y';
      m[6][13] = 'Y';
      m[7][12] = fl;
      m[7][13] = fl;
      world.npcs[i].push({
        x: 12,
        y: 7,
        c: '#d35400',
        kind: 'merchant',
        name: i === 51 ? 'Mercador Breno' : 'Mercador da Vila',
        shopId: 'bazaar',
        s: BAZAAR_LINE,
      });
    }
  }

  if (ci != null || bn) {
    for (const [x, y] of [
      [2, 1],
      [3, 1],
      [4, 1],
      [2, 2],
      [4, 2],
    ]) {
      m[y][x] = '#';
    }
    m[2][3] = 'D';
    m[3][2] = fl;
    m[3][3] = fl;
    m[3][4] = fl;
    // Torch outside cave entrance
    m[2][1] = 'L';
    world.doors[i].push({
      x: 3,
      y: 2,
      to: ci != null ? 200 + ci * 10 : bn!,
      px: 112,
      py: 112,
    });
  }

  // Diverse NPCs & lively multi-NPC dialogues!
  if (k === '3,4') {
    world.npcs[i].push(
      {
        x: 5,
        y: 5,
        c: '#2e86c1',
        kind: 'guard',
        name: 'Guarda Marcos',
        s: GUARD_LINE,
        chat: [
          'Guarda Marcos: Fique atento ao anoitecer! Os servos do Ciclope rondam fora das muralhas.',
          'Mercadora (ao lado): Tambem temos bombas que abrem pedras rachadas nas cavernas!',
        ],
      },
      {
        x: 11,
        y: 6,
        c: '#27ae60',
        kind: 'villager',
        name: 'Aldea Sofia',
        s: 'A loja da esquerda vende pocoes, flechas, bombas e tochas. A da direita forja espadas e escudos para a luta contra o Ciclope!',
      },
    );
  } else if (k === '4,4' && i !== 36) {
    world.npcs[i].push(
      {
        x: 4,
        y: 5,
        c: '#8e44ad',
        kind: 'mage',
        name: 'Sabio Orion',
        s: 'O Guerreiro Policolor desperta quando os tres Dominics se unem. A noite, acenda uma tocha com X para iluminar o caminho!',
        chat: [
          'Sabio Orion: As cavernas escondem relikias dos Dominics e tesouros de Mitribuque.',
          'Crianca Lino: Eu ouvi dizer que a Alfaiataria aqui em cima vende uma Armadura Dourada!',
        ],
      },
      {
        x: 10,
        y: 6,
        c: '#e67e22',
        kind: 'child',
        name: 'Lino',
        s: 'Uau! Quando eu crescer quero empunhar a Lamina Solar e usar a Tunica Safira como o Guerreiro Policolor!',
      },
    );
  } else if (b !== 'd' && i !== 36) {
    const sp = [
      [3, 7],
      [2, 7],
      [3, 7],
      [2, 7],
    ][hs(i, 3) % 4];
    const pool = COMMON_LINES.concat(BIOME_LINES[b]);
    const npcKinds: NpcKind[] =
      b === 'n'
        ? ['explorer', 'mage', 'guard']
        : b === 's'
          ? ['explorer', 'merchant', 'villager']
          : b === 'w'
            ? ['explorer', 'villager', 'mage']
            : ['villager', 'guard', 'child', 'mage'];
    const kind: NpcKind = k === '3,6' ? 'elder' : npcKinds[hs(i, 7) % npcKinds.length];
    const nn: Npc = {
      x: sp[0],
      y: sp[1],
      kind,
      c: { g: '#c0392b', n: '#5aa0d8', s: '#d98a2a', w: '#4f9e57' }[b],
      s: pool[hs(i, 5) % pool.length],
      el: k === '3,6' ? 1 : undefined,
    };
    if (k === '3,6') {
      nn.name = 'Anciao Aldor';
      nn.s =
        'Heroi! Os tres Dominics foram despertados, mas o Ciclope ainda assola Mitribuque. Vá à Vila Central, ao norte, e puxe a espada da praça!';
      // Add a village guard chatting nearby in the starting village
      m[6][10] = fl;
      world.npcs[i].push({
        x: 10,
        y: 6,
        c: '#2e86c1',
        kind: 'guard',
        name: 'Sentinela',
        s: 'A Espada Lendaria esta cravada na praca do centro da Vila Central, ao norte! E so dela que o Ciclope teme.',
        chat: [
          'Sentinela: Voce ouviu o Anciao? Ninguem alem do Guerreiro Policolor consegue puxar aquela espada.',
          'Anciao Aldor: E nao esqueca de levar tochas antes de entrar nas cavernas!',
        ],
      });
    }
    m[sp[1]][sp[0]] = fl;
    world.npcs[i].push(nn);
    if (k === '3,4') {
      world.npcs[i].push({
        x: Math.max(1, Math.min(13, sp[0] + 2)),
        y: sp[1],
        c: '#2a6a2a',
        kind: 'explorer',
        s: 'Sou o cacador. Traga-me 10 essencias de gosma para eu estudar as criaturas do Ciclope!',
        q: 'hunter',
      });
    }
  }

  // Varied enemy species per biome (expanded roster)!
  let enemyKind: EnemyKind = 0;
  if (b === 'd') enemyKind = ([6, 3, 7][i % 3]) as EnemyKind; // Dark mage, skeleton, zombie
  else if (b === 'n') enemyKind = ([5, 3, 1][i % 3]) as EnemyKind; // Ciclope, skeleton, bat
  else if (b === 's') enemyKind = ([2, 9, 5][i % 3]) as EnemyKind; // Scorpion, giant, ciclope
  else if (b === 'w') enemyKind = ([10, 11, 10][i % 3]) as EnemyKind; // Jacarés e porcos no pântano
  else enemyKind = (forest(sx, sy) ? ([1, 7, 5][i % 3]) : ([0, 8, 5][i % 3])) as EnemyKind; // Bats/zombies/gosmas in forest; slimes/gosmas in plains; ciclope also appears

  world.enemies[i] = vil ? [0, 0] : [1 + (hs(i, 9) % 3), enemyKind];
  world.maps[i] = m;
}

/**
 * Caverna do pantano feita à parte: lama, canais d'água, juncos e pedras
 * musgosas. Não reaproveita a sala genérica das outras cavernas e, por isso,
 * não ganha a escada de casa que teleportava o herói para o quarto.
 */
function createSwampCaveRoom(world: WorldData, id: number, o: RoomOptions): void {
  const m = Array.from({ length: 10 }, () => Array<string>(15).fill('a'));
  for (let y = 0; y < 10; y++) {
    for (let x = 0; x < 15; x++) {
      if (!x || !y || x === 14 || y === 9) m[y][x] = 'W';
    }
  }

  const pools: Array<[number, number, number, number]> =
    id === 232
      ? [
          [2, 2, 3, 2],
          [10, 2, 3, 2],
          [2, 6, 3, 2],
          [10, 6, 3, 2],
        ]
      : [
          [2, 2, 3, 2],
          [10, 2, 3, 2],
          [2, 6, 2, 2],
          [11, 6, 2, 2],
        ];
  for (const [px, py, pw, ph] of pools) {
    for (let y = py; y < py + ph; y++) {
      for (let x = px; x < px + pw; x++) m[y][x] = '~';
    }
  }

  for (const [px, py] of [
    [4, 4],
    [10, 4],
    [4, 7],
    [10, 7],
  ]) {
    m[py][px] = '#';
  }
  for (const [px, py] of [
    [3, 1],
    [11, 1],
    [3, 8],
    [11, 8],
    [1, 4],
    [13, 4],
    [5, 2],
    [9, 7],
  ]) {
    if (m[py][px] === 'a') m[py][px] = 'l';
  }
  for (const [px, py] of [
    [2, 4],
    [12, 4],
    [7, 5],
  ]) {
    m[py][px] = 't';
  }

  // Corredor central sempre livre entre as duas portas.
  for (let y = 2; y <= 8; y++) m[y][7] = 'a';
  m[8][7] = 'D';
  if (o.fwd) m[1][7] = 'D';

  m[3][11] = 'C';
  if (id === 231) m[6][3] = 'C';
  if (id === 232) {
    // Ninhos e crânios em volta da Cová do Jacaré Gigante.
    for (const [px, py] of [
      [3, 2],
      [5, 3],
      [9, 2],
      [11, 7],
    ]) {
      if (m[py][px] === 'a') m[py][px] = 'o';
    }
  }

  world.maps[id] = m;
  world.neighbors[id] = {};
  world.npcs[id] = [];
  world.enemies[id] = o.en || [0, 0];
  world.doors[id] = [{ x: 7, y: 8, to: o.back || 'ret', px: 112, py: 24 }];
  if (o.fwd) world.doors[id].push({ x: 7, y: 1, to: o.fwd, px: 112, py: 112 });
}

export function buildWorld(): WorldData {
  const world: WorldData = {
    maps: [],
    neighbors: [],
    npcs: [],
    doors: {},
    enemies: {},
  };

  for (let sy = 0; sy < 7; sy++) {
    for (let sx = 0; sx < 8; sx++) {
      genOverworldScreen(world, sx, sy);
    }
  }

  // 3 main dungeons with varied monster rosters (0: Forest, 1: Desert, 2: Ice)
  const dungeonEnemies: Array<[EnemyKind, EnemyKind, EnemyKind]> = [
    [1, 3, 4], // Forest cave: bats, skeletons, boss
    [2, 6, 4], // Desert ruins: scorpions, dark mages, boss
    [1, 5, 4], // Ice cave: bats, golems, boss
  ];
  for (let d = 0; d < 3; d++) {
    for (let q = 0; q < 3; q++) {
      const id = 200 + d * 10 + q;
      const eKind = dungeonEnemies[d][q];
      createRoom(world, id, false, rg(id), {
        // Chests live in rooms 0 and 1; the first dungeon's boss room also gets
        // one — it holds the White Robe + the 1st Crystal Fragment.
        chest: !q || q === 1 || (d === 0 && q === 2),
        back: q ? id - 1 : 0,
        fwd: q < 2 ? id + 1 : 0,
        en: q === 2 ? [1, 4] : [2 + q, eKind],
      });
    }
  }

  // Caverna do Pantano (230-232): jacarés, poças e o Jacaré Gigante no fim.
  for (let q = 0; q < 3; q++) {
    const id = 230 + q;
    createSwampCaveRoom(world, id, {
      back: q === 2 ? 'ret' : q ? id - 1 : 0,
      fwd: q < 2 ? id + 1 : 0,
      en: q === 2 ? [1, 10] : [2 + q, 10],
    });
  }

  // Treasure caves (250, 251, 252, 253)
  createRoom(world, 250, false, rg(250), { chest: 1, en: [3, 1], treasureVault: true });
  createRoom(world, 251, false, rg(251), { chest: 1, en: [3, 3], treasureVault: true });
  createRoom(world, 252, false, rg(252), { chest: 1, en: [3, 5], treasureVault: true });
  createRoom(world, 253, false, rg(253), { chest: 1, en: [3, 6], treasureVault: true });

  // Fire Dominion Angelic Room (301) - appears after obtaining all 3 Dominics
  createRoom(world, 301, false, rg(301), {
    chest: 1, // White Dominic Robe
    en: [5, 5], // Cyclops guard
    treasureVault: true,
    fwd: 250, // Return to first dungeon
  });

  // Hero's 2nd Floor Bedroom (above 151)
  createRoom(world, 451, true, rg(451), {});

  // Vorak's Castle (260, 261)
  createRoom(world, 260, false, rg(260), { fwd: 261, en: [4, 6] });
  createRoom(world, 261, false, rg(261), { back: 260, en: [1, 4] });

  // Make the bedroom collision match the furniture in its reference image.
  applyRoomPhysics(world);

  if (SINGLE_MAP) {
    // opção 2: mapa totalmente único (honesto: não reescreve engine ainda)
    return mergeWorldToSingleMap(world).world;
  }
  return world;
}

export function getEnemyMaxHp(mapId: number, kind: EnemyKind): number {
  if (mapId === 261 && kind === 4) return 22;
  if (mapId === 232 && kind === 10) return 20;
  return HPT[kind] || 2;
}

interface SavedPayload {
  hn: string;
  worldTime?: number;
  G: {
    map: number;
    x: number;
    y: number;
    hp: number;
    rp: number;
    ret: { map: number; x: number; y: number };
    dir: number;
  };
  V: Partial<ProgressState>;
  M: Array<string[] | null>;
}

export function hasSavedGame(): boolean {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}

export function saveGame(
  heroName: string,
  G: HeroState,
  V: ProgressState,
  world: WorldData,
  worldTime = 0,
): void {
  try {
    const payload: SavedPayload = {
      hn: heroName,
      worldTime,
      G: {
        map: G.map,
        x: G.x,
        y: G.y,
        hp: G.hp,
        rp: G.rp,
        ret: G.ret,
        dir: G.dir,
      },
      V,
      M: world.maps.map((m) => (m ? m.map((r) => r.join('')) : null)),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSavedGame(): {
  heroName: string;
  world: WorldData;
  G: HeroState;
  V: ProgressState;
  worldTime: number;
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedPayload;
    if (!parsed || !parsed.M || !parsed.G) return null;

    const world = buildWorld();
    const V = Object.assign(createInitialProgress(), parsed.V);
    // A barra de corações é fixa em 12, mesmo em saves antigos.
    V.mh = MAX_HEARTS;
    // Saves com o bug dos fragmentos podiam passar de 3; o contador interno
    // agora acompanha apenas os Dominics realmente despertos.
    const ownedDominics = V.dominic?.owned?.filter((k) => k !== 'none').length ?? 0;
    V.it.fragmento = Math.min(3, Math.max(V.it.fragmento | 0, ownedDominics));
    if (!V.equipped) V.equipped = V.sword ? 'sword' : 'none';
    if (!V.swordTier) V.swordTier = V.sword ? (V.dmg > 1 ? 'aco' : 'lendaria') : 'none';
    if (!V.ownedSwords || !V.ownedSwords.length) {
      V.ownedSwords = V.sword ? [V.swordTier] : [];
    }
    if (!V.ownedShields) V.ownedShields = V.shield !== 'none' ? [V.shield] : [];
    if (!V.ownedOutfits || !V.ownedOutfits.length) V.ownedOutfits = ['verde'];
    if (!V.explored || !V.explored.length) {
      V.explored = [parsed.G.map < 56 ? parsed.G.map : parsed.G.ret?.map ?? 51];
    }

    const heroName = parsed.hn || 'HEROI';

    const baseMaps = world.maps;
    world.maps = parsed.M.map((m) => (m ? m.map((r) => [...r]) : [])) as string[][][];
    for (const refreshId of [
      35, 36, 51, 135, 335, 136, 351, 451,
      // Pântano e caverna do pântano: versões antigas tinham casas/caverna
      // genéricas e a escada invisível para o quarto.
      45, 46, 47, 53, 54, 55, 230, 231, 232,
    ]) {
      if (baseMaps[refreshId]?.length) {
        world.maps[refreshId] = baseMaps[refreshId];
      }
    }
    // A espada mudou da casa 351 para a praça: saves antigos não podem
    // deixar o pedestal antigo nem fazer a espada reaparecer depois de puxada.
    if (V.sword) {
      if (world.maps[SWORD_MAP]?.[SWORD_TILE.y]) {
        world.maps[SWORD_MAP][SWORD_TILE.y][SWORD_TILE.x] = 'r';
      }
      // A multidão não volta a tentar puxar uma espada que já foi retirada.
      for (const list of world.npcs) {
        if (!list) continue;
        for (const n of list) {
          if (!n.swordCrowd) continue;
          if (n.home) {
            n.x = n.home.x;
            n.y = n.home.y;
          }
          n.swordCrowd = false;
        }
      }
    }
    // Older saves had the pre-image bedroom layout; realign its physics too.
    applyRoomPhysics(world);
    if (world.maps[451]?.[2] && (V.fl['ch_451_11_2'] || V.fl['main_451'])) {
      // O baú azul continua no quarto mesmo depois de aberto.
      world.maps[451][2][11] = 'C';
    }
    if (world.maps[151]?.[2] && world.maps[151]?.[1] && world.maps[151]?.[7]) {
      // Save antigo: escada no topo e saída no meio da parte de baixo.
      world.maps[151][2][13] = 'F';
      world.maps[151][7][13] = 'F';
      world.maps[151][8][7] = 'D';
      world.maps[151][1][7] = 'E';
    }
    if (world.maps[4] && world.maps[4][2] && world.maps[4][2][7] === 'D') {
      world.doors[4].push({ x: 7, y: 2, to: 260, px: 112, py: 112 });
    }

    const G: HeroState = Object.assign(createInitialHero(), parsed.G, {
      inv: 0,
      sw: 0,
      wk: 0,
      shielding: false,
      sleeping: false,
      dlg: null,
      it: [],
      en: [],
    });
    G.hp = Math.max(1, Math.min(G.hp, V.mh * 2));

    return { heroName, world, G, V, worldTime: parsed.worldTime ?? 600 };
  } catch {
    return null;
  }
}
