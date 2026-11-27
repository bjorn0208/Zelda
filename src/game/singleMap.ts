// ============================================================
// SINGLE MAP (opção 2): mapa totalmente único.
// Honesto: funde dados, mas NÃO reescreve engine/cavernas ainda.
// ============================================================

import { WorldData, Door, Npc, EnemyKind } from './types';

/** Liga/desliga mapa único. Padrão false para não quebrar atual. */
export const SINGLE_MAP = false;

const TILE = 16;

export interface SingleMapResult {
  world: WorldData;
  /** id original -> id novo (0 para todos se SINGLE_MAP) */
  idRemap: Record<number, number>;
  /** offset (em pixels) por id original para coordenadas globais */
  offsets: Record<number, { ox: number; oy: number }>;
}

function mapSize(m: string[][]): { w: number; h: number } {
  const h = m.length;
  const w = m.reduce((mx, r) => Math.max(mx, r.length), 0);
  return { w, h };
}

function emptyMap(w: number, h: number, fill = '.'): string[][] {
  return Array.from({ length: h }, () => Array.from({ length: w }, () => fill));
}

/**
 * Funde todos os `world.maps` em UM mapa grande.
 * Cavernas/lojas viram salas integradas no mesmo espaço (append em grid abaixo do overworld).
 * NÃO remapeia engine/G.map ainda. Devolve idRemap + offsets.
 */
export function mergeWorldToSingleMap(world: WorldData): SingleMapResult {
  const maps = world.maps.filter(Boolean);
  if (maps.length <= 1) {
    return { world, idRemap: { 0: 0 }, offsets: { 0: { ox: 0, oy: 0 } } };
  }

  // 1) overworld: ids 0..55 são grid 8x7 (ajuste se engine usar outro)
  const OVERWORLD_COUNT = 56; // 8*7
  const OW_GRID_W = 8;

  // medir tamanho padrão (15x10 ou 16x10 etc.)
  const sample = maps[0];
  const { w: mw, h: mh } = mapSize(sample);

  // colunas/linhas para salas appended (cavernas/lojas)
  const roomCols = OW_GRID_W;
  const overworldH = Math.ceil(Math.min(OVERWORLD_COUNT, maps.length) / OW_GRID_W);

  // total salas incluindo interiores appended
  const appended = Math.max(0, maps.length - OVERWORLD_COUNT);
  const appendedRows = Math.ceil(appended / roomCols);

  const totalW = roomCols * mw;
  const totalH = (overworldH + appendedRows) * mh;

  const giant = emptyMap(totalW, totalH, '.');

  const idRemap: Record<number, number> = {};
  const offsets: Record<number, { ox: number; oy: number }> = {};

  for (let id = 0; id < maps.length; id++) {
    const m = maps[id];
    let col: number;
    let row: number;

    if (id < OVERWORLD_COUNT) {
      col = id % OW_GRID_W;
      row = Math.floor(id / OW_GRID_W);
    } else {
      const a = id - OVERWORLD_COUNT; // appended interiors
      col = a % roomCols;
      row = overworldH + Math.floor(a / roomCols);
    }

    const ox = col * mw;
    const oy = row * mh;
    offsets[id] = { ox: ox * TILE, oy: oy * TILE };
    idRemap[id] = 0;

    const sz = mapSize(m);
    for (let y = 0; y < sz.h; y++) {
      for (let x = 0; x < sz.w; x++) {
        const tx = ox + x;
        const ty = oy + y;
        if (ty >= 0 && ty < totalH && tx >= 0 && tx < totalW) {
          giant[ty][tx] = m[y][x] ?? '.';
        }
      }
    }
  }

  const npcs: Npc[][] = [[]];
  const doors: Record<number, Door[]> = { 0: [] };
  const enemies: Record<number, [number, EnemyKind]> = { 0: [0, 0] };

  // merge npcs
  for (let id = 0; id < world.npcs.length; id++) {
    const off = offsets[id] || { ox: 0, oy: 0 };
    for (const n of world.npcs[id] || []) {
      npcs[0].push({ ...n, x: n.x + off.ox / TILE, y: n.y + off.oy / TILE });
    }
  }

  // merge doors -> same map id 0, global coords. NOTE: 'to' remapping NOT solved.
  for (const key of Object.keys(world.doors)) {
    const id = Number(key);
    const off = offsets[id] || { ox: 0, oy: 0 };
    for (const d of world.doors[id] || []) {
      doors[0].push({
        ...d,
        x: d.x + off.ox / TILE,
        y: d.y + off.oy / TILE,
        // px/py destinations NOT remapped (TODO user decides)
      });
    }
  }

  // enemies: keep last per original; cannot merge counts safely. Keep key 0 placeholder.
  // TODO: original per-map spawn lists need conversion. Not safe.

  return {
    world: {
      maps: [giant],
      neighbors: [{}],
      npcs,
      doors,
      enemies,
    },
    idRemap,
    offsets,
  };
}
