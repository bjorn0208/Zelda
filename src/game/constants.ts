import { DominicKind, OutfitId, ShieldTier, ShopId, ShopItem, SwordTier } from './types';

export const W = 240;
export const H = 160;

/**
 * Gameplay camera zoom. 1x keeps the original full-room view; values above 1
 * crop in for a closer camera without changing the 240x160 world coordinates.
 */
export const GAME_ZOOM = 1;
export const T = 16;
export const FONT = '8px "Press Start 2P", monospace';
export const SAVE_KEY = 'lh_save';

/** Vida sempre começa com 12 corações (24 meios-corações). */
export const MAX_HEARTS = 12;

/** A Espada Lendária fica cravada no meio da praça da Vila Central. */
export const SWORD_MAP = 36;
export const SWORD_TILE = { x: 7, y: 5 } as const;

/** Cores do raio disparado com a barra cheia, conforme o Dominic atual. */
export const DOMINIC_BEAM_COLORS: Record<
  DominicKind,
  { core: string; glow: string; trail: string; bloom: string }
> = {
  none: { core: '#ffffff', glow: '#9ed8ff', trail: '#4a8ad8', bloom: 'rgba(150,210,255,0.5)' },
  white: { core: '#fff4b0', glow: '#ff8a2a', trail: '#ff4a12', bloom: 'rgba(255,130,30,0.55)' },
  blue: { core: '#f0ffff', glow: '#8ce8ff', trail: '#2a9cff', bloom: 'rgba(120,230,255,0.55)' },
  green: { core: '#fffbc0', glow: '#b6ff5a', trail: '#5ac82a', bloom: 'rgba(160,255,90,0.55)' },
};

export const DX = [0, 1, 0, -1] as const;
export const DY = [-1, 0, 1, 0] as const;

// Solid tiles including walls, trees, houses, grand stores (U, V), stalls (Y), water, lamps ('L'), cracked rocks ('R'), torches ('t'), pedestals ('S'), TV+PS2 ('y')
export const SOLID_TILES = new Set('TbH~#WCkPKGeuqzvwmxjJASLRtyUVY'.split(''));

// HP per monster kind: 0:slime, 1:bat, 2:scorpion, 3:skeleton, 4:boss, 5:golem, 6:dark_mage, 7:zombie, 8:gosma, 9:giant
export const HPT = [2, 2, 3, 4, 18, 6, 3, 5, 2, 12] as const;

export const ENEMY_PALETTES: readonly [string, string, string, string][] = [
  ['#1a2a80', '#3a5ae0', '#5f82ff', '#2a3fb0'], // Slime
  ['#2a1040', '#6e34a8', '#a868e0', '#4a2070'], // Bat
  ['#5a1a0a', '#d86a2a', '#ff9a5a', '#a04010'], // Scorpion
  ['#3a4458', '#d8dde8', '#ffffff', '#8c96ac'], // Skeleton
  ['#3a0a0a', '#c0262e', '#ff5a5a', '#801018'], // Boss Vorak
  ['#4a2c2c', '#8b4a3a', '#c46a5a', '#5a2520'], // Ciclope
  ['#2a0844', '#6c229a', '#b668ff', '#441068'], // Dark Mage
  ['#2a3a1a', '#5a7a2a', '#8aca4a', '#1a2a0a'], // Zombie
  ['#1a4a2a', '#2ecc71', '#7fffaa', '#0e2a18'], // Gosma
  ['#4a3a2a', '#8a7a5a', '#c8b89a', '#2a2018']  // Giant
];

export const WALL_PALETTES: readonly [string, string, string][] = [
  ['#1d3a2a', '#2f5c3f', '#10241a'],
  ['#8a6a3a', '#b08a50', '#5a4220'],
  ['#4a6a90', '#8ab4e0', '#2a4060'],
  ['#221c44', '#3a3270', '#171233'],
  ['#2a1038', '#4a2a60', '#14081c'],
  ['#221c44', '#3a3270', '#171233'],
];

export const FLOOR_TILES = ['g', 's', 'i', 'c', 'c', 'c'] as const;
export const OBSTACLE_TILES = ['m', 'J', 'j', 'm', 'J', 'm'] as const;

export const CHEST_ITEMS: Record<number, string> = {
  200: 'minerio',
  // Boss da caverna da floresta: Robe Branca + 1º Fragmento (poder do fogo)
  202: 'roupa_branca',
  210: 'pocao',
  220: 'ursinho',
  250: 'anel',
  251: 'rp',
  252: 'bomba_kit',
  253: 'escudo_tesouro',
  451: 'escudo_quarto',
};

export const VILLAGES: Record<string, number> = {
  '3,6': 1, // Vila Inicial
  '3,4': 1, // Vila Central (Praça & Lojas)
  '4,4': 1, // Vila Central Leste
  '1,2': 1,
  '6,2': 1,
  '1,5': 1,
  '6,5': 1,
};

export const CAVES: Record<string, number> = {
  '7,4': 0,
  '7,1': 1,
  '0,0': 2,
};

export const BONUS_CAVES: Record<string, number> = {
  '0,6': 250,
  '4,3': 251,
  '2,4': 252,
  '5,5': 253,
};

export const SPECIAL_HOUSE_NPCS: Record<number, string> = {
  151: 'pai',
  351: 'maria',
  122: 'ferreiro',
  117: 'crianca',
};

/** O pai espera ao lado da passagem inferior da sala 151 (saída em [8][7]). */
export const FATHER_TILE = { x: 8, y: 8 } as const;
export const FATHER_INTRO_FLAG = 'pai_intro';
export const FATHER_INTRO_LINE =
  'Pai: Filho, vá ao centro da Vila Central, ao norte, e puxe a Espada Lendária cravada na praça. Só assim a tempestade irá parar e a sua aventura poderá começar.';

export const SWORD_STATS: Record<SwordTier, { name: string; dmg: number; blade: string; edge: string }> = {
  none: { name: 'SEM ESPADA', dmg: 0, blade: '#888', edge: '#555' },
  lendaria: { name: 'ESPADA LENDARIA', dmg: 1, blade: '#dff0ff', edge: '#8fa8d8' },
  aco: { name: 'ESPADA DE ACO', dmg: 2, blade: '#ffe98a', edge: '#d49020' },
  runica: { name: 'ESPADA RUNICA', dmg: 3, blade: '#8ce8ff', edge: '#2a90d8' },
  solar: { name: 'LAMINA SOLAR', dmg: 4, blade: '#ffd060', edge: '#ff6a2a' },
};

export const SHIELD_STATS: Record<ShieldTier, { name: string; color: string; trim: string; def: number }> = {
  none: { name: 'SEM ESCUDO', color: '#555', trim: '#333', def: 0 },
  madeira: { name: 'ESCUDO MADEIRA', color: '#8a5a2a', trim: '#c98b3c', def: 1 },
  ferro: { name: 'ESCUDO DE FERRO', color: '#7a8ea8', trim: '#d8e4f4', def: 2 },
  real: { name: 'ESCUDO REAL', color: '#3a66c8', trim: '#ffd84a', def: 3 },
  espelhado: { name: 'ESCUDO ESPELHO', color: '#c8ecff', trim: '#ffffff', def: 4 },
};

export const OUTFIT_COLORS: Record<
  OutfitId,
  { name: string; dark: string; main: string; light: string; shade: string; cap: string }
> = {
  verde: {
    name: 'TUNICA VERDE',
    dark: '#14502a',
    main: '#2fa84a',
    light: '#52d46a',
    shade: '#1f7d36',
    cap: '#3dbb4f',
  },
  carmesim: {
    name: 'TUNICA CARMESIM',
    dark: '#5a141c',
    main: '#c8323c',
    light: '#ff6670',
    shade: '#901c26',
    cap: '#df424c',
  },
  safira: {
    name: 'TUNICA SAFIRA',
    dark: '#14285a',
    main: '#2e62c8',
    light: '#68a2ff',
    shade: '#1e4290',
    cap: '#3c78e0',
  },
  dourada: {
    name: 'ARMADURA REAL',
    dark: '#5c420c',
    main: '#d49e26',
    light: '#ffe478',
    shade: '#a47214',
    cap: '#f0bc3a',
  },
  branco: {
    name: 'ROUPA BRANCA',
    dark: '#8f96ad',
    main: '#e8ecf7',
    light: '#ffffff',
    shade: '#c3c9db',
    cap: '#f4f7ff',
  },
};

export const SHOPS: Record<ShopId, { title: string; items: ShopItem[] }> = {
  items: {
    title: 'MERCADO CENTRAL',
    items: [
      { id: 'pot1', name: 'POCAO DE VIDA', desc: 'Restaura toda a energia', price: 20, kind: 'pot', amount: 1 },
      { id: 'arr15', name: '15 FLECHAS', desc: 'Municao para o arco', price: 25, kind: 'arrows', amount: 15 },
      { id: 'bmb5', name: '5 BOMBAS', desc: 'Explode pedras e monstros', price: 30, kind: 'bombs', amount: 5 },
      { id: 'tch3', name: '3 TOCHAS', desc: 'Ilumina cavernas escuras', price: 18, kind: 'torch', amount: 3 },
    ],
  },
  weapons: {
    title: 'FORJA REAL',
    items: [
      { id: 'sh_mad', name: 'ESCUDO MADEIRA', desc: 'Bloqueia ataques com B (DEF 1)', price: 35, kind: 'shield', tier: 'madeira' },
      { id: 'sh_fer', name: 'ESCUDO DE FERRO', desc: 'Alta resistencia fisica (DEF 2)', price: 55, kind: 'shield', tier: 'ferro' },
      { id: 'sh_real', name: 'ESCUDO REAL', desc: 'Reflete magia sombria (DEF 3)', price: 85, kind: 'shield', tier: 'real' },
      { id: 'sw_runica', name: 'ESPADA RUNICA', desc: 'Dano 3 e brilho azul', price: 95, kind: 'sword', tier: 'runica' },
      { id: 'sw_solar', name: 'LAMINA SOLAR', desc: 'Dano 4! Forja suprema', price: 160, kind: 'sword', tier: 'solar' },
    ],
  },
  tailor: {
    title: 'ALFAIATARIA REAL',
    items: [
      { id: 'out_car', name: 'TUNICA CARMESIM', desc: 'Manto rubi dos campeoes', price: 50, kind: 'outfit', tier: 'carmesim' },
      { id: 'out_saf', name: 'TUNICA SAFIRA', desc: 'Veste noturna azulada', price: 65, kind: 'outfit', tier: 'safira' },
      { id: 'out_dou', name: 'ARMADURA REAL', desc: 'Armadura dourada de elite', price: 120, kind: 'outfit', tier: 'dourada' },
      { id: 'sh_esp', name: 'ESCUDO ESPELHO', desc: 'Escudo lendario brilhante (DEF 4)', price: 130, kind: 'shield', tier: 'espelhado' },
    ],
  },
  bazaar: {
    title: 'MERCADOR DA VILA',
    items: [
      { id: 'baz_pot', name: 'POCAO DE VIDA', desc: 'Restaura todos os coracoes', price: 20, kind: 'pot', amount: 1 },
      { id: 'baz_tch', name: '3 TOCHAS', desc: 'Halos de luz em cavernas', price: 18, kind: 'torch', amount: 3 },
      { id: 'baz_mad', name: 'ESCUDO MADEIRA', desc: 'Defesa inicial com B (DEF 1)', price: 35, kind: 'shield', tier: 'madeira' },
      { id: 'baz_fer', name: 'ESCUDO DE FERRO', desc: 'Escudo resistente (DEF 2)', price: 55, kind: 'shield', tier: 'ferro' },
      { id: 'baz_arr', name: '15 FLECHAS', desc: 'Municao para o arco', price: 25, kind: 'arrows', amount: 15 },
    ],
  },
  fruits: {
    title: 'FRUTAS E VERDURAS',
    items: [
      { id: 'fr_mac', name: 'MAÇÃS FRESCAS', desc: 'Doces e revigorantes', price: 8, kind: 'pot', amount: 1 },
      { id: 'fr_per', name: 'PERAS DOCES', desc: 'Recupera toda a energia', price: 10, kind: 'pot', amount: 1 },
      { id: 'fr_ver', name: 'CESTO DE VERDURAS', desc: 'Duas poções naturais', price: 16, kind: 'pot', amount: 2 },
    ],
  },
  clothes: {
    title: 'ROUPAS',
    items: [
      { id: 'cl_car', name: 'TUNICA CARMESIM', desc: 'Manto rubi dos campeoes', price: 50, kind: 'outfit', tier: 'carmesim' },
      { id: 'cl_saf', name: 'TUNICA SAFIRA', desc: 'Veste noturna azulada', price: 65, kind: 'outfit', tier: 'safira' },
      { id: 'cl_dou', name: 'ARMADURA DOURADA', desc: 'Armadura de elite', price: 120, kind: 'outfit', tier: 'dourada' },
    ],
  },
  potions: {
    title: 'POÇÕES',
    items: [
      { id: 'po_vid', name: 'POÇÃO DE VIDA', desc: 'Restaura todos os corações', price: 20, kind: 'pot', amount: 1 },
      { id: 'po_dua', name: 'POÇÃO DUPLA', desc: 'Duas poções de vida', price: 36, kind: 'pot', amount: 2 },
      { id: 'po_gel', name: 'ELIXIR AZUL', desc: 'Três poções de vida', price: 50, kind: 'pot', amount: 3 },
    ],
  },
  flowers: {
    title: 'FLORES',
    items: [
      { id: 'fl_cha', name: 'CHÁ DE ERVAS', desc: 'Restaura toda a energia', price: 12, kind: 'pot', amount: 1 },
      { id: 'fl_ros', name: 'ROSAS CURATIVAS', desc: 'Duas poções naturais', price: 20, kind: 'pot', amount: 2 },
      { id: 'fl_tor', name: 'RAMO LUMINOSO', desc: 'Três tochas perfumadas', price: 22, kind: 'torch', amount: 3 },
    ],
  },
  ceramics: {
    title: 'CERÂMICA',
    items: [
      { id: 'ce_pot', name: 'POTE DE ÁGUA', desc: 'Restaura toda a energia', price: 10, kind: 'pot', amount: 1 },
      { id: 'ce_jar', name: 'JARRA DE BARRO', desc: 'Duas poções de energia', price: 18, kind: 'pot', amount: 2 },
      { id: 'ce_vas', name: 'VASO ACESO', desc: 'Três tochas de óleo', price: 20, kind: 'torch', amount: 3 },
    ],
  },
  books: {
    title: 'LIVROS E PERGAMINHOS',
    items: [
      { id: 'li_liv', name: 'LIVRO DE CURA', desc: 'Restaura toda a energia', price: 14, kind: 'pot', amount: 1 },
      { id: 'li_map', name: 'MAPA DO REINO', desc: 'Guia do guerreiro', price: 24, kind: 'pot', amount: 2 },
      { id: 'li_per', name: 'PERGAMINHO', desc: 'Três tochas de leitura', price: 26, kind: 'torch', amount: 3 },
    ],
  },
};

/** Barracas do novo centro (mapa 36). Posições adaptadas da grade 20x20 da imagem para a tela 15x10. */
export interface MarketStall {
  id: string;
  name: string;
  shopId: ShopId;
  x: number;
  y: number;
  awning: string;
  stripe: string;
  goods: string;
}

export const MARKET_STALLS: MarketStall[] = [
  { id: 'frutas', name: 'Frutas e Verduras', shopId: 'fruits', x: 3, y: 1, awning: '#d6453d', stripe: '#fff5e6', goods: 'maçãs, peras e vegetais' },
  { id: 'roupas', name: 'Roupas', shopId: 'clothes', x: 3, y: 4, awning: '#2e6fc8', stripe: '#f4f8ff', goods: 'túnicas e vestimentas medievais' },
  { id: 'pocoes', name: 'Poções', shopId: 'potions', x: 3, y: 7, awning: '#7b3fb5', stripe: '#c69ae8', goods: 'frascos de poções mágicas' },
  { id: 'flores', name: 'Flores', shopId: 'flowers', x: 11, y: 1, awning: '#3f9b46', stripe: '#f2d13c', goods: 'flores, vasos e plantas' },
  { id: 'ceramica', name: 'Cerâmica', shopId: 'ceramics', x: 11, y: 4, awning: '#c9a26a', stripe: '#fdf6e6', goods: 'potes, vasos e recipientes' },
  { id: 'livros', name: 'Livros e Pergaminhos', shopId: 'books', x: 11, y: 7, awning: '#2f8f46', stripe: '#f4fff6', goods: 'livros, mapas e pergaminhos' },
];

export const COMMON_LINES = [
  'Os tres Dominics despertaram em Mitribuque! O Guerreiro Policolor precisa da Espada Lendaria da praca para enfrentar o Ciclope.',
  'A tempestade nasceu no castelo ao norte. Leve tochas e bombas antes de descer as cavernas!',
  'Corte arbustos: as vezes caem cogumelos e rupias para a sua jornada.',
  'Nas cavernas a escuridao e total! Acenda uma tocha ou siga as tochas acesas nas paredes.',
  'Use B para erguer o escudo e X para atirar flechas ou jogar bombas!',
  'No centro da Vila Central ha seis barracas - frutas, roupas, pocoes, flores, ceramica e livros - ao redor da espada.',
];

export const BIOME_LINES: Record<'n' | 's' | 'g', string[]> = {
  n: [
    'Brrr! O frio vem do castelo do Ciclope. A noite aqui e congelante!',
    'A caverna de gelo fica no canto noroeste. Os servos do Ciclope guardam o caminho!',
    'Esqueletos e slimes gelados rondam a neve a noite.',
  ],
  s: [
    'De dia o sol castiga, mas a noite os escorpioes saem das sombras!',
    'As ruinas a nordeste escondem relikias dos tres Dominics e varios baus.',
    'Leve um bom escudo antes de enfrentar os magos sombrios.',
  ],
  g: [
    'Ha cavernas secretas com tesouros e rochas rachadas para explodir!',
    'A Vila Central fica bem no coracao de Mitribuque, ao norte daqui.',
    'A praca central fica vazia desde que a espada foi cravada la. Os guardas patrulham a entrada.',
  ],
};

export const HOUSE_LINES = [
  'Seja bem-vindo a minha casa! Sinta o calor da lareira enquanto a tempestade passa.',
  'Descanse, heroi. Quando a noite cai, as sombras do Ciclope ficam mais agitadas.',
  'Meu avo dizia que so o Guerreiro Policolor consegue unir os tres Dominics.',
  'Dizem que a costureira da Vila Central faz tunicas que brilham na escuridao!',
  'Esta sopa aquecera seu corpo antes de descer as cavernas. A espada esta na praca, nao mais aqui.',
];

export interface QuestDef {
  need: string;
  n: number;
  ask: string;
  ok: string;
  done: string;
  rew: { rp?: number; pot?: number; mh?: number; dmg?: number; arrows?: number; bombs?: number };
}

export const QUESTS: Record<string, QuestDef> = {
  marta: {
    need: 'cogumelo',
    n: 5,
    ask: 'Preciso de 5 cogumelos para a sopa dos viajantes! Corte arbustos la fora.',
    ok: 'Que delicia! Tome uma pocao, 30 rupias e 3 tochas para a sua jornada!',
    done: 'A sopa ficou otima, obrigada! Que os tres Dominics te acompanhem.',
    rew: { rp: 30, pot: 1 },
  },
  maria: {
    need: 'anel',
    n: 1,
    ask: 'Perdi meu anel na caverna do lago, ao sudoeste. Com a tempestade, ninguem mais entra la. Ajude-me!',
    ok: 'Meu anel! Voce ganha um coracao extra para enfrentar o Ciclope!',
    done: 'Obrigada, heroi. Minha casa ficou tranquila desde que a espada foi para a praca.',
    rew: { mh: 1 },
  },
  ferreiro: {
    need: 'minerio',
    n: 1,
    ask: 'Preciso de minerio da caverna da floresta, a leste, para forjar armas contra o Ciclope.',
    ok: 'Perfeito! Forjei a ESPADA DE ACO para voce!',
    done: 'Aquela espada e minha obra-prima. Cuide bem dela na jornada.',
    rew: { dmg: 2 },
  },
  crianca: {
    need: 'ursinho',
    n: 1,
    ask: 'Perdi meu ursinho na caverna de gelo... Voce busca para mim, heroi do Guerreiro Policolor?',
    ok: 'Meu ursinho! Ganhe um coracao extra e flechas!',
    done: 'Eu amo meu ursinho! Obrigada por enfrentar o frio por mim.',
    rew: { mh: 1, arrows: 10 },
  },
  hunter: {
    need: 'slime',
    n: 10,
    ask: 'Cace 10 gosmas nas florestas e traga-me suas essencias! O Ciclope envia criaturas a cada noite.',
    ok: 'Incrivel! Tome 50 rupias, flechas e uma pocao!',
    done: 'Obrigado, heroi. As florestas estao mais seguras para Mitribuque.',
    rew: { rp: 50, arrows: 15, pot: 1 },
  },
};

export const STORY_PAGES = [
  'A muito tempo existia uma vila antiga escondida dos olhos humanos: Mitribuque.',
  'Dizia a lenda que ao juntar dos tres Dominics, qualquer mal se combatia.',
  'Mitribuque fica ao oeste das montanhas rochosas, onde hoje e conhecido como Brasil.',
  'Quem despertar a alma dos tres Dominics tera o Guerreiro Policolor encarnado em si!',
  'Herdara os tres poderes e salvara o Reino de Mitribuque do Monstro Ciclope.',
  // Interlúdio sem texto: só o Ciclope, entre a fase 5 e a fase 6
  '',
  'Desperte, {N}! O destino do reino esta em suas maos.',
];

// Must stay the same length as STORY_PAGES — a missing entry makes tn = NaN and
// poisons every colour calculation that follows.
export const STORY_TONES = [0.22, 0.85, 0.95, 0.72, 0.48, 0.9, 0.3] as const;

// Index of the text-less interlude inside STORY_PAGES.
export const STORY_INTERLUDE_AT = 5;

export const NAME_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ '] as const;

export const INTRO_LOGO_FRAMES = 180;
// O vídeo da logo normalmente termina via introVideoDone(); este limite só
// evita que a intro trave se o autoplay for bloqueado ou o arquivo falhar.
export const INTRO_VIDEO_FRAMES = 900;

export const DAY_CYCLE_FRAMES = 4200; // ~70s full day/dusk/night/dawn cycle
