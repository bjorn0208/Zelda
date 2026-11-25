import {
  BIOME_LINES,
  BONUS_CAVES,
  CAVES,
  COMMON_LINES,
  FATHER_INTRO_LINE,
  FATHER_TILE,
  FLOOR_TILES,
  HOUSE_LINES,
  HPT,
  OBSTACLE_TILES,
  SAVE_KEY,
  SPECIAL_HOUSE_NPCS,
  VILLAGES,
} from './constants';
import { DominicKind, EnemyKind, HeroState, Npc, NpcKind, ProgressState, WorldData } from './types';
import { applyRoomPhysics } from './roomPhysics';

export const hs = (a: number, b: number): number => ((a * 73856093) ^ (b * 19349663)) >>> 0;
export const rnd = (n: number): number => Math.floor(Math.random() * n);
export const p3 = (n: number): string => String(n).padStart(3, '0');

export const bio = (x: number, y: number): 'd' | 'n' | 's' | 'g' =>
  y === 0 && x >= 3 && x <= 5 ? 'd' : x <= 2 && y <= 3 ? 'n' : x >= 5 && y <= 3 ? 's' : 'g';

export const lake = (x: number, y: number): boolean => x <= 2 && y >= 4;
export const forest = (x: number, y: number): boolean => x >= 5 && y >= 4;

export const isHouse = (m: number): boolean => (m >= 100 && m < 200) || (m >= 300 && m < 500);

export const dungeonTheme = (m: number): number =>
  m >= 260 ? 4 : m === 250 || m === 252 ? 0 : m === 251 || m === 253 ? 5 : m >= 200 ? ((m - 200) / 10) | 0 : 3;

export function mapDisplayName(m: number): string {
  if (m === 451) return 'SEU QUARTO (2o ANDAR)';
  if (m === 151) return 'SUA CASA (1o ANDAR)';
  if (m === 351) return 'CASA AO LADO';
  if (m === 135) return 'MERCADO CENTRAL';
  if (m === 335) return 'FORJA REAL';
  if (m === 136) return 'ALFAIATARIA REAL';
  if (isHouse(m)) return 'INTERIOR DE CASA';
  if (m >= 260) return m === 261 ? 'SALAO DE VORAK' : 'CASTELO DE VORAK';
  if (m === 250) return 'CAVERNA DO LAGO';
  if (m === 251) return 'CAVERNA SECRETA';
  if (m === 252) return 'GRUTA DO TESOURO';
  if (m === 253) return 'COFRE ANTIGO';
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
    mh: 3,
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
    x: 20,
    y: 46,
    dir: 2,
    hp: 6,
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
  back?: number;
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
  const bs = Boolean(o.en && o.en[1] === 4);
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
      // Cama alinhada à imagem: lado esquerdo, linhas 2-3 (bem no topo).
      m[2][1] = 'e';
      m[2][2] = 'e';
      m[3][1] = 'e';
      m[3][2] = 'e';
      m[2][3] = 'v'; // mesinha de cabeceira + lâmpada
      m[1][6] = 'w'; // janela com cortinas verdes
      m[1][8] = 'z'; // mesa com vaso de flores
      m[2][8] = 'z';
      m[8][7] = 'C'; // baú do Escudo de Madeira (centro inferior da imagem)
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
      if (id === 351) {
        m[5][7] = 'S';
      }
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

  if (id !== 451 && id !== 151) {
    m[8][7] = 'D';
  }
  if (o.fwd) m[1][7] = 'D';

  world.maps[id] = m;
  world.neighbors[id] = {};
  world.npcs[id] = [];
  world.enemies[id] = o.en || [0, 0];
  if (id === 451) {
    // Volta da escada do quarto: desembarca ao lado da escada do 1o andar.
    world.doors[id] = [{ x: 13, y: 7, to: 151, px: 112, py: 32 }];
  } else if (id === 151) {
    // Porta na direita (saída) e escada no centro do topo (2o andar).
    world.doors[id] = [
      { x: 13, y: 7, to: o.back || 'ret', px: 180, py: 112 },
      { x: 7, y: 1, to: 451, px: 180, py: 112 },
    ];
  } else {
    world.doors[id] = [{ x: 7, y: 8, to: o.back || 'ret', px: 112, py: 24 }];
  }
  if (o.fwd && id !== 151) {
    world.doors[id].push({ x: 7, y: 1, to: o.fwd, px: 112, py: 112 });
  }
  if (!h || (id !== 451 && id !== 151)) {
    // Stair to bedroom (2nd floor) for the other houses / dungeons
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
  const fl = b === 's' ? 's' : b === 'n' ? 'n' : b === 'd' ? 'c' : '.';
  const dc = () => (b === 's' ? (r() < 0.5 ? 'k' : '#') : b === 'n' ? 'P' : b === 'd' ? '#' : 'T');
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

  const dn = isCentral ? 0.04 : forest(sx, sy) ? 0.3 : b === 'd' ? 0.16 : 0.1;
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

  // Central Village grand cobblestone plaza & lanterns
  if (isCentral) {
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
  } else if (vil) {
    m[4][5] = 'L';
    m[4][9] = 'L';
  }

  world.doors[i] = [];
  world.npcs[i] = [];

  if (b === 'd' && sx === 4) {
    for (let x = 4; x <= 10; x++) m[1][x] = 'W';
    for (const x of [4, 5, 6, 8, 9, 10]) m[2][x] = 'W';
    m[2][7] = 'G';
  }

  if (i === 35 || i === 36) {
    // Grand Stores (5x3 storefronts — clearly distinct from normal houses!)
    const stores = i === 35 ? [0, 1] : [0];
    for (const s of stores) {
      const x0 = s ? 9 : 1;
      const id = (s ? 300 : 100) + i;
      for (let y = 1; y <= 3; y++) {
        for (let x = x0; x < x0 + 5; x++) {
          m[y][x] = y < 3 ? 'U' : x === x0 + 2 ? 'D' : 'V';
        }
      }
      world.doors[i].push({ x: x0 + 2, y: 3, to: id, px: 112, py: 112 });
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
            s: 'Bem-vindo ao Mercado Central! Tenho pocoes, flechas, bombas e tochas!',
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
            s: 'Aqui forjamos os melhores escudos e espadas do reino!',
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
            s: 'Roupas dignas de um heroi! Veja nossas tunicas e o Escudo Espelho!',
          },
        ];
      }
    }
    if (i === 36) {
      // Outdoor Bazaar Merchant Stall on East Plaza
      m[2][10] = 'Y';
      m[2][11] = 'Y';
      m[3][10] = 'p';
      m[3][11] = 'p';
      world.npcs[i].push({
        x: 10,
        y: 3,
        c: '#d98a2a',
        kind: 'merchant',
        name: 'Mercador Caio',
        shopId: 'bazaar',
        s: 'Troco suas rupias por escudos resistentes, pocoes e tochas!',
      });
    }
  } else {
    const hsd = vil ? [0, 1] : b === 'd' || ci != null || bn ? [] : r() < 0.4 ? [r() < 0.5 ? 0 : 1] : [];
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
      if (id === 351) {
        // Curiosos ao redor da espada cravada no centro da casa.
        const around: Array<[number, number, string]> = [
          [6, 4, '#d0a84a'],
          [8, 4, '#a866c8'],
          [6, 6, '#4a90c8'],
          [9, 5, '#c85a52'],
        ];
        for (const [x, y, c] of around) {
          world.npcs[id].push({
            x,
            y,
            c,
            kind: 'villager',
            swordCrowd: true,
            home: { x, y },
            s: 'Eu também tentei puxar essa espada... não houve jeito. Vai você, Herói!',
          });
        }
      }
    }

    // Outdoor Merchant Stall & interactive Merchant NPC in all villages!
    if (vil) {
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
        s: 'Tenho escudos resistentes, pocoes e tochas em troca de suas rupias!',
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
        s: 'A Vila Central esta protegida! Entre nas lojas acima para comprar armas, pocoes e equipamentos.',
        chat: [
          'Guarda Marcos: Fique atento ao anoitecer! Criaturas sombrias rondam fora das muralhas.',
          'Mercadora (ao lado): Tambem temos bombas que abrem pedras rachadas nas cavernas!',
        ],
      },
      {
        x: 11,
        y: 6,
        c: '#27ae60',
        kind: 'villager',
        name: 'Aldea Sofia',
        s: 'A loja da esquerda vende pocoes, flechas, bombas e tochas. A da direita forja espadas e escudos!',
      },
    );
  } else if (k === '4,4') {
    world.npcs[i].push(
      {
        x: 4,
        y: 5,
        c: '#8e44ad',
        kind: 'mage',
        name: 'Sabio Orion',
        s: 'Sabia que o sol e a lua se alternam em Aurora? A noite, acenda uma tocha com X para iluminar o caminho!',
        chat: [
          'Sabio Orion: As cavernas escondem tesouros e fragmentos do Cristal de Luz.',
          'Crianca Lino: Eu ouvi dizer que a Alfaiataria aqui em cima vende uma Armadura Dourada!',
        ],
      },
      {
        x: 10,
        y: 6,
        c: '#e67e22',
        kind: 'child',
        name: 'Lino',
        s: 'Uau! Quando eu crescer quero ter a Lamina Solar e usar a Tunica Safira!',
      },
    );
  } else if (b !== 'd') {
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
          : ['villager', 'guard', 'child', 'mage'];
    const kind: NpcKind = k === '3,6' ? 'elder' : npcKinds[hs(i, 7) % npcKinds.length];
    const nn: Npc = {
      x: sp[0],
      y: sp[1],
      kind,
      c: { g: '#c0392b', n: '#5aa0d8', s: '#d98a2a' }[b],
      s: pool[hs(i, 5) % pool.length],
      el: k === '3,6' ? 1 : undefined,
    };
    if (k === '3,6') {
      nn.name = 'Anciao Aldor';
      nn.s =
        'Heroi! Vorak partiu o Cristal de Luz em 3 fragmentos. Explore as cavernas e visite a Vila Central ao norte!';
      // Add a village guard chatting nearby in the starting village
      m[6][10] = fl;
      world.npcs[i].push({
        x: 10,
        y: 6,
        c: '#2e86c1',
        kind: 'guard',
        name: 'Sentinela',
        s: 'A casa da direita guarda a Espada Lendaria! Depois siga ao norte ate a Vila Central para se equipar.',
        chat: [
          'Sentinela: Voce ouviu o Anciao? Ninguem alem de voce consegue puxar aquela espada.',
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
        s: 'Sou o cacador. Traga-me 10 essencias de gosma!',
        q: 'hunter',
      });
    }
  }

  // Varied enemy species per biome (expanded roster)!
  let enemyKind: EnemyKind = 0;
  if (b === 'd') enemyKind = ([6, 3, 7][i % 3]) as EnemyKind; // Dark mage, skeleton, zombie
  else if (b === 'n') enemyKind = ([5, 3, 1][i % 3]) as EnemyKind; // Ciclope, skeleton, bat
  else if (b === 's') enemyKind = ([2, 9, 5][i % 3]) as EnemyKind; // Scorpion, giant, ciclope
  else enemyKind = (forest(sx, sy) ? ([1, 7, 5][i % 3]) : ([0, 8, 5][i % 3])) as EnemyKind; // Bats/zombies/gosmas in forest; slimes/gosmas in plains; ciclope also appears

  world.enemies[i] = vil ? [0, 0] : [1 + (hs(i, 9) % 3), enemyKind];
  world.maps[i] = m;
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

  return world;
}

export function getEnemyMaxHp(mapId: number, kind: EnemyKind): number {
  if (mapId === 261 && kind === 4) return 22;
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
    for (const refreshId of [35, 36, 51, 135, 335, 136, 451]) {
      if (baseMaps[refreshId]?.length) {
        world.maps[refreshId] = baseMaps[refreshId];
      }
    }
    // Older saves had the pre-image bedroom layout; realign its physics too.
    applyRoomPhysics(world);
    if ((V.fl['ch_451_7_8'] || V.fl['main_451']) && world.maps[451]?.[8]) {
      world.maps[451][8][7] = 'F';
    }
    if (world.maps[151]?.[2] && world.maps[151]?.[1] && world.maps[151]?.[7]) {
      // Save antigo: moves a escada para o topo, centro, e a saída para a direita.
      world.maps[151][2][13] = 'F';
      world.maps[151][8][7] = 'F';
      world.maps[151][7][13] = 'D';
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

    return { heroName, world, G, V, worldTime: parsed.worldTime ?? 600 };
  } catch {
    return null;
  }
}
