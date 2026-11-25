import { WorldData } from './types';

/**
 * Collision overlay derived from the bedroom reference image in
 * `public/rooms/hero_bedroom.png`. Only map 451 uses that image; every other
 * interior stays procedural.
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
  bedroom451: BEDROOM_451,
};

/** Interactive tiles must survive the overlay; props sit on `s` cells already. */
const KEEP_TILES = 'DECcS';

function gridFor(mapId: number): PhysicsGrid | null {
  return mapId === 451 ? BEDROOM_451 : null;
}

/** Apply the image-matched collision grid to the one image-backed room. */
export function applyRoomPhysics(world: WorldData): void {
  const m = world.maps[451];
  const grid = gridFor(451);
  if (!m || !grid) return;
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
