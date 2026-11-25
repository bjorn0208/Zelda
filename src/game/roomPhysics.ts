import { WorldData } from './types';

/**
 * Collision overlays derived from the pixel-art room references in
 * `public/rooms/`. The images are the visual backdrop; these grids are the
 * matching "physics": furniture from the art blocks the hero, while rugs and
 * the wooden floor stay walkable.
 *
 * Legend:
 *   #  furniture / prop — solid (tile K)
 *   .  open wooden floor — walkable (tile F)
 *   r  rug / carpet — walkable (tile r)
 *   s  keep the tile the game already placed (door, stairs, chest, window…)
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
  'sss###sss####ss', // cama (x1-x2) preservada
  'ss#s#.#ss.#s#ss',
  's.........#...s',
  's............#s',
  's##..rrrrrr..#s',
  's##..rrrsrr.##s',
  'sss..rrrrrrs.ss', // fogão/lareira (x1-x2) preservado
  's#.....#......s',
  'sssssssssssssss',
];

const GENERIC_HOUSE: PhysicsGrid = [
  'sssssssssssssss',
  's######s######s',
  's######s######s',
  's.##........##s',
  's...##......##s',
  's.#....s....##s',
  's.......####.#s',
  's.......####.ss',
  's.###..s......s',
  'sssssssssssssss',
];

const SHOP: PhysicsGrid = [
  'sssssssssssssss',
  's####..s######s',
  's####..s.#.###s',
  's####...##....s',
  's.##s....#s.#.s',
  's.#...#rrrr###s',
  's.....#rrrr...s',
  's#.....rrrr.#ss',
  's......s......s',
  'sssssssssssssss',
];

export const ROOM_PHYSICS: Record<string, PhysicsGrid> = {
  house151: HOUSE_151,
  bedroom451: BEDROOM_451,
  generic: GENERIC_HOUSE,
  shop: SHOP,
};

/** Interactive tiles must survive the overlay; props sit on `s` cells already. */
const KEEP_TILES = 'DECcS';

function gridFor(mapId: number): PhysicsGrid | null {
  if (mapId === 451) return BEDROOM_451;
  if (mapId === 151) return HOUSE_151;
  if (mapId === 135 || mapId === 335 || mapId === 136) return SHOP;
  // 301 looks like a house ID but is a dungeon room (h=false in createRoom).
  const isHouseInterior = (mapId >= 100 && mapId < 200) || (mapId >= 300 && mapId < 500);
  if (isHouseInterior && mapId !== 301) return GENERIC_HOUSE;
  return null;
}

/** Apply the image-matched collision grid to every room backed by an image. */
export function applyRoomPhysics(world: WorldData): void {
  for (let id = 100; id < 500; id++) {
    const m = world.maps[id];
    const grid = gridFor(id);
    if (!m || !grid) continue;
    for (let y = 0; y < 10; y++) {
      const row = grid[y];
      if (!row) continue;
      const mapRow = m[y];
      if (!mapRow) continue;
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
