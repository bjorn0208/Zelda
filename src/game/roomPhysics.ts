import { WorldData } from './types';

/**
 * Collision overlays derived from the two reference images in `public/rooms/`:
 * the hero's ground-floor living room (151) and the bedroom (451). All other
 * interiors stay procedural.
 *
 * Legend:
 *   #  furniture / prop — solid (tile K)
 *   .  open wooden floor — walkable (tile F)
 *   r  rug / carpet — walkable (tile r)
 *   s  keep the tile the game already placed (door, stairs, chest, bed…)
 *
 * Coordinates are row y (0..9), column x (0..14) — exactly `map[y][x]`.
 */
type PhysicsGrid = readonly string[];

const HOUSE_151: PhysicsGrid = [
  'sssssssssssssss',
  's#####.s######s',
  's#####.s#####ss',
  's####.#....##.s',
  's.rrrrr.......s',
  's#rrrrr..##...s',
  's#rrrrr...#...s',
  's#rrrrr......ss',
  's......s....##s',
  'sssssssssssssss',
];

const BEDROOM_451: PhysicsGrid = [
  'sssssssssssssss',
  'sss###sss####ss',
  'ss#s#.#ss.#s#ss',
  'ss........#...s',
  'sss..........#s',
  'sss..rrrrrr..#s',
  'sss..rrrsrr.##s',
  'sss..rrrrrrs.ss',
  's#.....s......s',
  'sssssssssssssss',
];

export const ROOM_PHYSICS: Record<string, PhysicsGrid> = {
  house151: HOUSE_151,
  bedroom451: BEDROOM_451,
};

/** Interactive tiles must survive the overlay; props sit on `s` cells already. */
const KEEP_TILES = 'DECcS';

function gridFor(mapId: number): PhysicsGrid | null {
  if (mapId === 451) return BEDROOM_451;
  if (mapId === 151) return HOUSE_151;
  return null;
}

/** Apply the image-matched collision grid to the two image-backed rooms. */
export function applyRoomPhysics(world: WorldData): void {
  for (const id of [151, 451]) {
    const m = world.maps[id];
    const grid = gridFor(id);
    if (!m || !grid) continue;
    for (let y = 0; y < 10; y++) {
      const row = grid[y];
      const mapRow = m[y];
      if (!row || !mapRow) continue;
      for (let x = 0; x < 15; x++) {
        const cell = row[x];
        if (!cell || cell === 's') continue;
        const current = mapRow[x];
        if (current && KEEP_TILES.includes(current)) continue;
        mapRow[x] = cell === '#' ? 'K' : cell === 'r' ? 'r' : 'F';
      }
    }
  }
}
