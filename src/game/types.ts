export type KeyCode = 'u' | 'd' | 'l' | 'r' | 'a' | 'b' | 'x' | 's' | 'm' | 'i';

export type ScreenState =
  | 'intro'
  | 'menu'
  | 'mgmenu'
  | 'help'
  | 'name'
  | 'story'
  | 'game'
  | 'inv'
  | 'shop'
  | 'mg'
  | 'over'
  | 'victory';

export type IntroPhase = 'logo' | 'fade' | 'video' | 'rise';

export type NpcKind =
  | 'elder'
  | 'villager'
  | 'guard'
  | 'merchant'
  | 'blacksmith'
  | 'child'
  | 'mage'
  | 'explorer';

// 0: slime, 1: bat, 2: scorpion, 3: skeleton, 4: boss Vorak, 5: golem, 6: dark_mage
export type EnemyKind = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type SwordTier = 'none' | 'lendaria' | 'aco' | 'runica' | 'solar';
export type ShieldTier = 'none' | 'madeira' | 'ferro' | 'real' | 'espelhado';
export type OutfitId = 'verde' | 'carmesim' | 'safira' | 'dourada' | 'branco';
export type SecondaryTool = 'arco' | 'bomba' | 'tocha' | 'pocao';

export interface Door {
  x: number;
  y: number;
  to: number | 'ret';
  px: number;
  py: number;
}

export interface Npc {
  x: number;
  y: number;
  c: string;
  s: string;
  kind?: NpcKind;
  name?: string;
  heal?: number;
  q?: string;
  el?: number;
  shopId?: ShopId;
  /** Barraca do mercado central: cores da cobertura listrada. */
  stall?: { awning: string; stripe: string };
  chat?: string[];
  /** Pessoas ao redor da espada: afastam-se quando o herói chega perto. */
  swordCrowd?: boolean;
  home?: { x: number; y: number };
}

export interface Enemy {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  k: EnemyKind;
  dx: number;
  dy: number;
  t: number;
  cd?: number;
  hitFlash?: number;
  /** Dominic do Fogo: dano por tempo enquanto a chama arde */
  burn?: number;
  /** Dominic do Gelo: congela o inimigo (não anda) */
  frozen?: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'arrow' | 'bomb' | 'orb' | 'fire' | 'beam';
  life: number;
  fromEnemy?: boolean;
  /** Dominic que deu cor ao raio da barra cheia. */
  element?: DominicKind;
}

export interface RupeeDrop {
  x: number;
  y: number;
  val?: number;
  kind?: 'rupee' | 'heart';
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
  maxL?: number;
  c: string;
  glow?: boolean;
  size?: number;
  kind?: 'spark' | 'ring' | 'leaf' | 'slash';
  ang?: number;
}

export interface DustMote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
  alpha: number;
  warm: boolean;
}

export interface RainDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  layer: 0 | 1 | 2;
}

export interface RainSplash {
  x: number;
  y: number;
  life: number;
}

export interface LightningBolt {
  segments: Array<[number, number, number, number]>;
  life: number;
}

export interface WeatherState {
  drops: RainDrop[];
  splashes: RainSplash[];
  flash: number;
  nextLightning: number;
  thunderDelay: number;
  thunderIntensity: number;
  bolt: LightningBolt | null;
  clearBanner: number;
}

export interface DialogState {
  p: string[][];
  i: number;
  speaker?: string;
}

export interface FallingItem {
  x: number;
  y: number;
  k: 0 | 1 | 2;
}

export interface MinigameState {
  id: 1 | 2;
  from: 'game' | 'mgmenu';
  t: number;
  sc: number;
  pop: number[];
  cx: number;
  cy: number;
  sw: number;
  it: FallingItem[];
  bx: number;
  end: number;
}

export type DominicKind = 'none' | 'white' | 'blue' | 'green';

export interface DominicState {
  owned: DominicKind[];
  current: DominicKind;
  activeEffect: 'single' | 'all' | 'none';
  flashTimer: number;
}

export interface ProgressState {
  it: Record<string, number>;
  fl: Record<string, number>;
  dominic: DominicState;
  dmg: number;
  pot: number;
  mh: number;
  msg: string;
  mt: number;
  sword: number;
  equipped: 'sword' | 'none';
  swordTier: SwordTier;
  ownedSwords: SwordTier[];
  shield: ShieldTier;
  ownedShields: ShieldTier[];
  outfit: OutfitId;
  ownedOutfits: OutfitId[];
  arrows: number;
  bombs: number;
  torches: number;
  torchLit: boolean;
  secondary: SecondaryTool;
  explored: number[];
}

export interface HeroState {
  map: number;
  x: number;
  y: number;
  dir: number;
  hp: number;
  rp: number;
  inv: number;
  sw: number;
  wk: number;
  shielding: boolean;
  hitFlash?: number;
  sleeping?: boolean;
  wakeTimer?: number;
  it: RupeeDrop[];
  en: Enemy[];
  dlg: DialogState | null;
  ret: { map: number; x: number; y: number };
}

export interface WorldData {
  maps: string[][][];
  neighbors: Array<Partial<Record<'l' | 'r' | 'u' | 'd', number>>>;
  npcs: Npc[][];
  doors: Record<number, Door[]>;
  enemies: Record<number, [number, EnemyKind]>;
}

export type ShopId =
  | 'items'
  | 'weapons'
  | 'tailor'
  | 'bazaar'
  | 'fruits'
  | 'clothes'
  | 'potions'
  | 'flowers'
  | 'ceramics'
  | 'books';

export interface ShopItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  kind: 'pot' | 'arrows' | 'bombs' | 'torch' | 'sword' | 'shield' | 'outfit';
  tier?: SwordTier | ShieldTier | OutfitId;
  amount?: number;
}

export interface EngineUIState {
  screen: ScreenState;
  introPhase: IntroPhase;
  showLogoGif: boolean;
  muted: boolean;
  hasSave: boolean;
  heroName: string;
  secondary: SecondaryTool;
  torchLit: boolean;
  isNight: boolean;
  explored: number[];
  currentMap: number;
  overworldMap: number;
  locationName: string;
  rp: number;
  fragments: number;
  pot: number;
  arrows: number;
  bombs: number;
  torches: number;
  swordName: string;
  shieldName: string;
  heroNormX: number;
  heroNormY: number;
  heroDir: number;
  hp: number;
  maxHp: number;
  torchFuelRatio: number;
  isCave: boolean;
  invSel: number;
  invHeroDir: number;
  hasSword: boolean;
  equippedSword: boolean;
  swordTier: SwordTier;
  ownedSwords: SwordTier[];
  dmg: number;
  shieldTier: ShieldTier;
  ownedShields: ShieldTier[];
  outfit: OutfitId;
  ownedOutfits: OutfitId[];
  mushrooms: number;
  hasRing: boolean;
  hasOre: boolean;
  hasBear: boolean;
}
