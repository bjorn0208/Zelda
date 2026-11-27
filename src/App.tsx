/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Backpack,
  ChevronsRight,
  Flame,
  Gamepad2,
  Heart,
  RotateCw,
  Save,
  Shield,
  Sparkles,
  Sword,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  BONUS_CAVES,
  CAVES,
  H,
  OUTFIT_COLORS,
  SHIELD_STATS,
  SWORD_STATS,
  VILLAGES,
  W,
} from './game/constants';
import { GameEngine } from './game/engine';
import { drawHeroShowcaseStandalone, screenToWorld } from './game/render';
import { INV_ITEM_LABELS, drawInvItem, invItemStateFromUI, invItemTag } from './game/items';
import { EngineUIState, KeyCode } from './game/types';
import { bio, forest, lake } from './game/world';

type MovePadMode = 'both' | 'dpad' | 'analog';
const PAD_MODE_KEY = 'aurora_pad_mode_v1';

/** Áreas clicáveis sobre os botões já desenhados no vídeo do menu (1112x834). */
const MENU_VIDEO_BUTTONS = [
  { label: 'JOGAR', x: 24.3, y: 59.0, w: 21.6, h: 6.5 },
  { label: 'CONTINUAR', x: 24.3, y: 68.1, w: 38.7, h: 6.2 },
  { label: 'MINIJOGOS', x: 24.3, y: 74.3, w: 39.6, h: 6.6 },
  { label: 'CONTROLES', x: 24.3, y: 86.1, w: 37.8, h: 6.2 },
] as const;

const KEY_MAP: Record<string, KeyCode> = {
  arrowup: 'u',
  w: 'u',
  arrowdown: 'd',
  s: 'd',
  arrowleft: 'l',
  a: 'l',
  arrowright: 'r',
  d: 'r',
  z: 'a',
  j: 'a',
  ' ': 'a',
  x: 'b',
  k: 'b',
  c: 'x',
  e: 'x',
  f: 'x',
  enter: 's',
  m: 'm',
  i: 'i',
  tab: 'i',
};

const TOOL_SHORT: Record<EngineUIState['secondary'], string> = {
  arco: 'ARCO',
  bomba: 'BOMBA',
  tocha: 'TOCHA',
  pocao: 'POCAO',
};

interface MapCellMeta {
  id: number;
  sx: number;
  sy: number;
  biome: 'g' | 's' | 'n' | 'd' | 'w';
  isLake: boolean;
  isForest: boolean;
  isCentral: boolean;
  hasVillage: boolean;
  hasCave: boolean;
  isBonusCave: boolean;
  isBossGate: boolean;
}

function buildMiniMapMeta(): MapCellMeta[] {
  const cells: MapCellMeta[] = [];
  for (let sy = 0; sy < 7; sy++) {
    for (let sx = 0; sx < 8; sx++) {
      const id = sy * 8 + sx;
      const k = `${sx},${sy}`;
      const biome = bio(sx, sy);
      const isCentral = k === '3,4' || k === '4,4';
      const hasVillage = Boolean(VILLAGES[k]);
      const isBonusCave = BONUS_CAVES[k] != null;
      const hasCave = CAVES[k] != null || isBonusCave;
      const isBossGate = sx === 4 && sy === 0;

      cells.push({
        id,
        sx,
        sy,
        biome,
        isLake: lake(sx, sy),
        isForest: forest(sx, sy),
        isCentral,
        hasVillage,
        hasCave,
        isBonusCave,
        isBossGate,
      });
    }
  }
  return cells;
}

function TopWorldMap({
  cells,
  ui,
}: {
  cells: MapCellMeta[];
  ui: EngineUIState;
}) {
  const mapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;

    // Mesma proporção da tela do jogo (240x160 = 3:2) e mapa inteiro liberado.
    const CW = 30;
    const CH = 20;
    const GRID_H = CH * 7;
    g.fillStyle = '#070514';
    g.fillRect(0, 0, 240, 160);

    for (const c of cells) {
      const ox = c.sx * CW;
      const oy = c.sy * CH;

      let base = '#3b8c47';
      let accent = '#2c6e37';
      if (c.biome === 'd') {
        base = '#322254';
        accent = '#22163b';
      } else if (c.biome === 'n') {
        base = '#8cc2ec';
        accent = '#e8f6ff';
      } else if (c.biome === 's') {
        base = '#cfa552';
        accent = '#a97d31';
      } else if (c.biome === 'w') {
        base = '#4b6535';
        accent = '#324a26';
      } else if (c.isForest) {
        base = '#1f6438';
        accent = '#144726';
      }

      g.fillStyle = base;
      g.fillRect(ox, oy, CW, CH);

      // Estradas ligando o centro de cada tela às quatro saídas.
      g.fillStyle = 'rgba(236, 214, 160, 0.32)';
      g.fillRect(ox + 12, oy, 6, CH);
      g.fillRect(ox, oy + 8, CW, 4);

      // Detalhes determinísticos do terreno.
      g.fillStyle = accent;
      for (let i = 0; i < 5; i++) {
        const dx = (c.id * 7 + i * 11) % (CW - 6);
        const dy = (c.id * 3 + i * 7) % (CH - 5);
        g.fillRect(ox + dx, oy + dy, 4 + (i % 2), 2);
      }
      if (c.biome === 'n') {
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 3; i++) {
          g.fillRect(ox + 3 + ((c.id * 5 + i * 9) % 22), oy + 2 + ((c.id + i * 6) % 14), 3, 2);
        }
      } else if (c.biome === 'w') {
        // Poças espalhadas pelo pântano.
        g.fillStyle = '#2b6d72';
        for (let i = 0; i < 3; i++) {
          const px = ox + 2 + ((c.id * 11 + i * 13) % 20);
          const py = oy + 2 + ((c.id * 5 + i * 8) % 14);
          g.fillRect(px, py, 7, 4);
        }
        g.fillStyle = '#7ec46a';
        for (let i = 0; i < 4; i++) {
          g.fillRect(ox + 3 + ((c.id * 3 + i * 7) % 24), oy + 3 + ((c.id * 9 + i * 5) % 14), 1, 3);
        }
      } else if (c.isForest && !c.isCentral) {
        g.fillStyle = '#0e3b26';
        for (let i = 0; i < 4; i++) {
          g.fillRect(ox + 2 + ((c.id * 13 + i * 6) % 24), oy + 2 + ((c.id * 4 + i * 7) % 14), 4, 4);
        }
      }

      if (c.isLake && !c.isCentral) {
        g.fillStyle = '#2560c4';
        g.fillRect(ox + 5, oy + 4, 18, 11);
        g.fillStyle = '#5ba2ff';
        g.fillRect(ox + 7, oy + 6, 7, 3);
        g.fillStyle = '#bfe4ff';
        g.fillRect(ox + 16, oy + 11, 5, 1);
      }

      if (c.isCentral) {
        g.fillStyle = '#9c8f78';
        g.fillRect(ox + 2, oy + 3, CW - 4, 14);
        g.fillStyle = '#cbbca0';
        g.fillRect(ox + 11, oy + 1, 8, CH - 2);
        g.fillStyle = '#ffd84a';
        g.fillRect(ox + 4, oy + 4, 8, 6);
        g.fillStyle = '#ff5858';
        g.fillRect(ox + 21, oy + 4, 6, 5);
        g.fillStyle = '#ffffff';
        g.fillRect(ox + 6, oy + 2, 2, 8);
      } else if (c.hasVillage) {
        g.fillStyle = '#b84232';
        g.fillRect(ox + 5, oy + 4, 6, 4);
        g.fillRect(ox + 19, oy + 4, 6, 4);
        g.fillRect(ox + 12, oy + 12, 6, 4);
        g.fillStyle = '#ffd84a';
        g.fillRect(ox + 6, oy + 2, 4, 2);
      }

      if (c.hasCave) {
        const cave = c.isBonusCave ? '#ffb84d' : c.biome === 'w' ? '#7ee06a' : '#4ce0ff';
        g.fillStyle = '#11101e';
        g.fillRect(ox + 3, oy + 2, 8, 6);
        g.fillStyle = cave;
        g.fillRect(ox + 5, oy + 3, 4, 3);
      }

      if (c.isBossGate) {
        g.fillStyle = '#1d1236';
        g.fillRect(ox + 7, oy + 2, 16, 8);
        g.fillStyle = '#b84dff';
        g.fillRect(ox + 13, oy + 4, 5, 4);
      }

      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.fillRect(ox, oy, CW, 1);
      g.fillRect(ox, oy, 1, CH);
    }

    const hsx = ui.overworldMap & 7;
    const hsy = ui.overworldMap >> 3;
    const ox = hsx * CW;
    const oy = hsy * CH;

    g.strokeStyle = ui.currentMap >= 100 ? '#5ce1ff' : '#ffd84a';
    g.lineWidth = 2;
    g.strokeRect(ox + 1, oy + 1, CW - 2, CH - 2);

    const px = Math.round(ox + 3 + ui.heroNormX * (CW - 6));
    const py = Math.round(oy + 3 + ui.heroNormY * (CH - 6));

    if (ui.torchLit) {
      g.fillStyle = 'rgba(255, 175, 65, 0.45)';
      g.fillRect(px - 4, py - 4, 9, 9);
    }

    g.fillStyle = '#090614';
    g.fillRect(px - 3, py - 3, 7, 7);
    g.fillStyle = ui.currentMap >= 100 ? '#6ae8ff' : '#ffd84a';
    g.fillRect(px - 2, py - 2, 5, 5);

    const fdx = ui.heroDir === 1 ? 3 : ui.heroDir === 3 ? -3 : 0;
    const fdy = ui.heroDir === 2 ? 3 : ui.heroDir === 0 ? -3 : 0;
    g.fillStyle = '#ffffff';
    g.fillRect(px + fdx, py + fdy, 1, 1);

    // Rodapé com legenda, no mesmo tamanho da tela do jogo.
    g.fillStyle = '#0b0a16';
    g.fillRect(0, GRID_H, 240, 160 - GRID_H);
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = '#ffd84a';
    g.fillText('MAPA DE MITRIBUQUE', 4, GRID_H + 10);
    const legend: Array<[string, string]> = [
      ['#ffd84a', 'HEROI'],
      ['#4ce0ff', 'CAVERNA'],
      ['#b84dff', 'CHEFE'],
      ['#7ec46a', 'PANTANO'],
    ];
    let lx = 4;
    for (const [color, label] of legend) {
      g.fillStyle = color;
      g.fillRect(lx, GRID_H + 15, 4, 4);
      g.fillStyle = '#d8d8e8';
      g.fillText(label, lx + 6, GRID_H + 17);
      lx += 6 + label.length * 6 + 6;
    }
  }, [cells, ui]);

  return (
    <div className="rounded border border-[#525252] bg-[#050508] p-0.5 shadow-inner">
      <canvas
        ref={mapCanvasRef}
        width={240}
        height={160}
        className="pixel-canvas block w-full h-auto rounded-[2px]"
        style={{ aspectRatio: '3 / 2', maxWidth: 240, maxHeight: 160 }}
      />
    </div>
  );
}

function HeroPreviewCanvas({ ui }: { ui: EngineUIState }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let raf = 0;
    let tick = 0;
    const render = () => {
      tick++;
      const canvas = ref.current;
      if (canvas) {
        const g = canvas.getContext('2d');
        if (g) {
          g.imageSmoothingEnabled = false;
          drawHeroShowcaseStandalone(g, canvas.width, canvas.height, {
            outfit: ui.outfit,
            hasSword: ui.hasSword,
            equippedSword: ui.equippedSword,
            swordTier: ui.swordTier,
            shieldTier: ui.shieldTier,
            torchLit: ui.torchLit,
            t: tick,
            dir: ui.invHeroDir,
          });
        }
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [
    ui.outfit,
    ui.hasSword,
    ui.equippedSword,
    ui.swordTier,
    ui.shieldTier,
    ui.torchLit,
    ui.invHeroDir,
  ]);

  return (
    <canvas
      ref={ref}
      width={92}
      height={84}
      className="pixel-canvas block w-[108px] h-[98px] sm:w-[134px] sm:h-[122px]"
    />
  );
}

/**
 * A physical inventory item drawn straight from the shared 16x16 pixel-art
 * maps (see src/game/items.ts). The canvas is an integer multiple of the art
 * so every pixel stays square, and `.pixel-canvas` keeps responsive
 * rescaling sharp instead of blurry.
 */
function InvItemCanvas({
  slot,
  ui,
  size,
  scale,
  className = '',
}: {
  slot: number;
  ui: EngineUIState;
  size: number;
  scale: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, canvas.width, canvas.height);
    drawInvItem(g, slot, 0, 0, scale, invItemStateFromUI(ui));
  }, [slot, scale, ui]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      className={`pixel-canvas block ${className}`}
      aria-hidden="true"
    />
  );
}

function ResponsiveInventoryModal({
  ui,
  engine,
}: {
  ui: EngineUIState;
  engine: GameEngine | null;
}) {
  const swDef = SWORD_STATS[ui.swordTier] || SWORD_STATS.none;
  const shDef = SHIELD_STATS[ui.shieldTier] || SHIELD_STATS.none;
  const outDef = OUTFIT_COLORS[ui.outfit] || OUTFIT_COLORS.verde;
  const invState = invItemStateFromUI(ui);

  const toolNames: Record<EngineUIState['secondary'], string> = {
    arco: `Arco (${ui.arrows} flechas)`,
    bomba: `Bombas (${ui.bombs} un.)`,
    tocha: `Tocha (${ui.torches} un.)`,
    pocao: `Poção Rápida (${ui.pot} un.)`,
  };

  const slots = [
    {
      id: 0,
      label: 'Espada',
      title: ui.hasSword ? swDef.name : 'Espada (Não obtida)',
      badge: ui.hasSword ? (ui.equippedSword ? 'EQ' : `${ui.ownedSwords.length}`) : '—',
      active: ui.equippedSword,
      desc: !ui.hasSword
        ? 'A Espada Lendária está cravada no pedestal da praça, no centro da Vila Central. Vá até lá para puxá-la e encerrar a tempestade.'
        : ui.equippedSword
          ? `Ataque: ${ui.dmg}. Toque novamente ou pressione A para alternar entre suas espadas (${ui.ownedSwords.length}) ou guardar.`
          : 'Espada guardada na maleta. Pressione Equipar (A) para empunhá-la.',
      actionLabel: !ui.hasSword ? 'Bloqueado' : ui.equippedSword ? 'Trocar / Guardar' : 'Equipar Espada',
      accent: 'text-amber-300',
    },
    {
      id: 1,
      label: 'Escudo',
      title: shDef.name,
      badge: ui.shieldTier !== 'none' ? `DEF ${shDef.def}` : '—',
      active: ui.shieldTier !== 'none',
      desc: ui.ownedShields.length
        ? `Defesa: ${shDef.def}. Segure B em combate para bloquear investidas e feitiços. Pressione A para alternar escudos (${ui.ownedShields.length}).`
        : 'Você ainda não possui escudo. Visite o Mercado Central, o Bazar da Vila ou a Forja Real para adquirir um!',
      actionLabel: ui.ownedShields.length ? 'Alternar Escudo' : 'Sem Escudos',
      accent: 'text-sky-300',
    },
    {
      id: 2,
      label: 'Túnica',
      title: outDef.name,
      badge: `${ui.ownedOutfits.length}/5`,
      active: true,
      desc:
        ui.ownedOutfits.length > 1
          ? `Traje atual: ${outDef.name}. Pressione A ou toque para trocar entre as ${ui.ownedOutfits.length} roupas compradas na Alfaiataria Real.`
          : 'Túnica inicial de Mitribuque. Visite a Alfaiataria Real na Vila Central para comprar novos trajes!',
      actionLabel: ui.ownedOutfits.length > 1 ? 'Trocar Roupa' : 'Traje Único',
      accent: 'text-emerald-300',
    },
    {
      id: 3,
      label: 'Botão X',
      title: `Item Rápido: ${toolNames[ui.secondary]}`,
      badge: TOOL_SHORT[ui.secondary],
      active: true,
      desc: 'Define qual ferramenta é ativada imediatamente pelo botão X durante a exploração (Arco, Bomba, Tocha ou Poção).',
      actionLabel: 'Alternar Botão X',
      accent: 'text-cyan-300',
    },
    {
      id: 4,
      label: 'Poção',
      title: `Poção de Vida (${ui.pot} disponíveis)`,
      badge: `x${ui.pot}`,
      active: ui.pot > 0,
      desc:
        ui.pot > 0
          ? 'Restaura imediatamente toda a vida do herói. Pressione A para beber agora ou equipe no botão X.'
          : 'Sem poções no momento. Compre novas com os mercadores da Vila Central.',
      actionLabel: ui.pot > 0 ? 'Beber Poção' : 'Vazio',
      accent: 'text-rose-300',
    },
    {
      id: 5,
      label: 'Tocha',
      title: `Tocha (${ui.torchLit ? 'Acesa' : 'Apagada'} · ${ui.torches} restantes)`,
      badge: ui.torchLit ? 'ON' : `x${ui.torches}`,
      active: ui.torchLit,
      desc:
        ui.torches > 0 || ui.torchLit
          ? 'Ilumina cavernas escuras e trilhas noturnas com um halo de fogo ao redor do herói.'
          : 'Sem tochas extras. Compre tochas nas lojas ou bazar antes de entrar em cavernas.',
      actionLabel: ui.torchLit ? 'Apagar Tocha' : 'Acender Tocha',
      accent: 'text-orange-300',
    },
    {
      id: 6,
      label: 'Dominics',
      title: `Dominics (${ui.fragments}/3)`,
      badge: `${ui.fragments}/3`,
      active: ui.fragments > 0,
      desc:
        ui.fragments >= 3
          ? 'Você despertou todos os 3 Dominics! Vá ao norte até o castelo do Ciclope para enfrentar o monstro e salvar Mitribuque.'
          : 'Derrote os guardiões das três grandes cavernas (Floresta, Ruínas do Deserto e Terra Gelada) para despertar os Dominics.',
      actionLabel: 'Item de Missão',
      accent: 'text-indigo-300',
    },
    {
      id: 7,
      label: 'Relíquias',
      title: 'Relíquias & Bolsos',
      badge: `${ui.mushrooms + (ui.hasRing ? 1 : 0) + (ui.hasOre ? 1 : 0) + (ui.hasBear ? 1 : 0)}`,
      active: ui.mushrooms > 0 || ui.hasRing || ui.hasOre || ui.hasBear,
      desc: `Cogumelos: ${ui.mushrooms} · Anel Real: ${ui.hasRing ? 'Sim' : 'Não'} · Minério Raro: ${ui.hasOre ? 'Sim' : 'Não'} · Ursinho: ${ui.hasBear ? 'Sim' : 'Não'}.`,
      actionLabel: 'Colecionáveis',
      accent: 'text-fuchsia-300',
    },
  ];

  const activeSlot = slots[ui.invSel] || slots[0];

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-2.5 sm:p-4 bg-[#060914]/88 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) engine?.closeInv();
      }}
    >
      <div className="w-full max-w-[780px] max-h-[92dvh] flex flex-col rounded-2xl border-2 border-[#5a6b92] bg-[#121726]/95 text-[#e9eefc] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 bg-[#1b2338] border-b border-[#ffd84a]/35">
          <div className="flex items-center gap-2 min-w-0">
            <Backpack className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffd84a] shrink-0" />
            <span className="text-xs sm:text-sm font-extrabold tracking-widest text-[#ffd84a] truncate">
              MALETA TÁTICA · {ui.locationName}
            </span>
            {/* Fechos metálicos da maleta (temática RE4) */}
            <span className="ml-1 hidden shrink-0 gap-1 sm:flex" aria-hidden="true">
              <span className="block h-3.5 w-6 rounded-[3px] border border-[#0a0d14] bg-gradient-to-b from-[#e6ecfb] via-[#97a3bd] to-[#5a6480] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />
              <span className="block h-3.5 w-6 rounded-[3px] border border-[#0a0d14] bg-gradient-to-b from-[#e6ecfb] via-[#97a3bd] to-[#5a6480] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]" />
            </span>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1 rounded-lg bg-[#0d1220] border border-emerald-400/35 px-2 py-1 text-xs font-bold text-emerald-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{ui.rp}R</span>
            </div>
            <button
              type="button"
              onClick={() => engine?.closeInv()}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/90 cursor-pointer"
              aria-label="Fechar inventário"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="sm:w-[210px] shrink-0 flex flex-row sm:flex-col items-center justify-between sm:justify-start gap-3 rounded-xl border border-[#3a486b] bg-[#0c101b] p-2.5 sm:p-3">
            <div className="flex flex-col items-center">
              <span className="text-xs sm:text-sm font-bold tracking-wider text-[#ffe98a] mb-1">
                {ui.heroName || 'HERÓI'}
              </span>
              <button
                type="button"
                onClick={() => engine?.rotateInvHero()}
                className="relative flex flex-col items-center justify-center rounded-xl border border-white/10 bg-[#13192b]/75 p-1 hover:border-[#ffd84a]/50 cursor-pointer transition-colors"
                title="Girar herói (X)"
              >
                <HeroPreviewCanvas ui={ui} />
                <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-300/85 pb-1">
                  <RotateCw className="w-3 h-3 text-[#ffd84a]" />
                  Girar (X)
                </span>
              </button>
            </div>

            <div className="flex-1 w-full grid grid-cols-2 gap-1.5 text-[11px] sm:text-xs">
              <div className="flex items-center gap-1 rounded-lg bg-[#161e31] px-2 py-1.5 border border-white/5">
                <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="font-bold text-rose-200">
                  {ui.hp}/{ui.maxHp}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#161e31] px-2 py-1.5 border border-white/5">
                <Sword className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="font-bold text-amber-100">
                  ATQ {ui.equippedSword ? ui.dmg : 0}
                </span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#161e31] px-2 py-1.5 border border-white/5">
                <Shield className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <span className="font-bold text-sky-100">DEF {shDef.def}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg bg-[#161e31] px-2 py-1.5 border border-white/5">
                <Flame
                  className={`w-3.5 h-3.5 shrink-0 ${ui.torchLit ? 'text-orange-400' : 'text-slate-400'}`}
                />
                <span className="font-bold text-slate-200">{ui.torchLit ? 'Acesa' : `x${ui.torches}`}</span>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
            {/* RE4 attaché case: padded interior + physical items, no text slots */}
            <div
              className="mx-auto grid w-full max-w-[440px] grid-cols-4 gap-1.5 rounded-xl border border-[#0a0d14] bg-[#161c2a] p-1.5 shadow-[inset_0_3px_14px_rgba(0,0,0,0.75)] sm:gap-2"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 28px), repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 28px)',
              }}
            >
              {slots.map((slot) => {
                const selected = ui.invSel === slot.id;
                const tag = invItemTag(slot.id, invState);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => engine?.selectInvSlot(slot.id)}
                    title={INV_ITEM_LABELS[slot.id]}
                    aria-label={INV_ITEM_LABELS[slot.id]}
                    aria-pressed={selected}
                    className={`relative flex aspect-square cursor-pointer items-center justify-center rounded-lg border transition-all ${
                      selected
                        ? 'z-10 border-[#ffd84a] bg-[#26314e] shadow-[0_0_18px_rgba(255,216,74,0.3),inset_0_1px_0_rgba(255,255,255,0.14)]'
                        : 'border-[#2b3550] bg-[#0f1522]/85 hover:border-[#6274a3] hover:bg-[#182135]'
                    }`}
                  >
                    <InvItemCanvas
                      slot={slot.id}
                      ui={ui}
                      size={64}
                      scale={4}
                      className={`h-[76%] w-[76%] max-h-16 max-w-16 drop-shadow-[2px_3px_0_rgba(0,0,0,0.6)] transition-transform ${
                        selected ? 'scale-110' : ''
                      }`}
                    />
                    {tag && (
                      <span
                        className={`absolute bottom-0.5 right-1 rounded-[3px] border px-1 py-px text-[9px] font-extrabold leading-none tracking-wider sm:text-[10px] ${
                          tag.tone === 'green'
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : tag.tone === 'grey'
                              ? 'border-white/10 bg-white/5 text-slate-400'
                              : 'border-amber-400/40 bg-[#1a1408] text-[#ffd84a]'
                        }`}
                      >
                        {tag.text}
                      </span>
                    )}
                    {selected && (
                      <>
                        <span className="pointer-events-none absolute left-0 top-0 h-3.5 w-3.5 border-l-2 border-t-2 border-[#ffd84a]" />
                        <span className="pointer-events-none absolute right-0 top-0 h-3.5 w-3.5 border-r-2 border-t-2 border-[#ffd84a]" />
                        <span className="pointer-events-none absolute bottom-0 left-0 h-3.5 w-3.5 border-b-2 border-l-2 border-[#ffd84a]" />
                        <span className="pointer-events-none absolute bottom-0 right-0 h-3.5 w-3.5 border-b-2 border-r-2 border-[#ffd84a]" />
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 flex flex-col justify-between gap-3 rounded-xl border border-[#495980] bg-[#0e1422] p-3 sm:p-4">
              <div className="flex gap-3 sm:gap-4">
                <div className="relative shrink-0 self-start rounded-lg border border-[#33405f] bg-[#0a0f1a] p-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.7)]">
                  <InvItemCanvas
                    slot={activeSlot.id}
                    ui={ui}
                    size={96}
                    scale={6}
                    className="h-20 w-20 drop-shadow-[3px_4px_0_rgba(0,0,0,0.65)] sm:h-24 sm:w-24"
                  />
                  <span className="pointer-events-none absolute inset-x-2 -bottom-2 h-1 rounded-full bg-gradient-to-r from-transparent via-[#5a6b92] to-transparent" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <h3 className={`text-sm sm:text-base font-extrabold tracking-wide ${activeSlot.accent}`}>
                      {activeSlot.title}
                    </h3>
                    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/90">
                      {activeSlot.badge}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                    {activeSlot.desc}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                <span className="text-[11px] text-slate-400">
                  Setas/Analógico: Selecionar · X: Girar Herói
                </span>
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => engine?.activateInvSlot(ui.invSel)}
                    className="rounded-lg bg-[#ffd84a] hover:bg-[#ffe57a] px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-extrabold text-[#15102b] cursor-pointer transition-colors"
                  >
                    {activeSlot.actionLabel} (A)
                  </button>
                  <button
                    type="button"
                    onClick={() => engine?.closeInv()}
                    className="rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-bold text-white cursor-pointer transition-colors"
                  >
                    Fechar (B)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  // Ref estável: o vídeo da logo só é montado na fase de vídeo e não reinicia
  // quando o React renderiza novamente nem quando o menu é aberto.
  const attachCloudVideo = useCallback((el: HTMLVideoElement | null) => {
    if (!el) return;
    el.currentTime = 0;
    const p = el.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => engineRef.current?.introVideoDone());
    }
  }, []);

  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const stickPointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [stickEngaged, setStickEngaged] = useState(false);
  // Se o GIF da Dominic Games falhar, o logo desenhado no canvas continua visível.
  const [logoBroken, setLogoBroken] = useState(false);
  // Sem vídeo, o menu desenhado no canvas permanece como fallback.
  const [menuVideoBroken, setMenuVideoBroken] = useState(false);

  const [padMode, setPadMode] = useState<MovePadMode>(() => {
    try {
      const saved = localStorage.getItem(PAD_MODE_KEY);
      if (saved === 'both' || saved === 'dpad' || saved === 'analog') return saved;
    } catch {
      // Ignore storage errors
    }
    return 'both';
  });

  const cyclePadMode = () => {
    setPadMode((prev) => {
      const next: MovePadMode = prev === 'both' ? 'dpad' : prev === 'dpad' ? 'analog' : 'both';
      try {
        localStorage.setItem(PAD_MODE_KEY, next);
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const miniMapMeta = useMemo(() => buildMiniMapMeta(), []);

  const [activeKeys, setActiveKeys] = useState<Partial<Record<KeyCode, boolean>>>({});
  const [ui, setUi] = useState<EngineUIState>({
    screen: 'intro',
    introPhase: 'logo',
    menuSel: 0,
    muted: false,
    hasSave: false,
    heroName: '',
    secondary: 'tocha',
    torchLit: false,
    isNight: true,
    explored: [51],
    currentMap: 451,
    overworldMap: 51,
    locationName: 'SEU QUARTO (2o ANDAR)',
    rp: 40,
    fragments: 0,
    pot: 1,
    arrows: 5,
    bombs: 2,
    torches: 2,
    swordName: 'SEM ESPADA',
    shieldName: 'SEM ESCUDO',
    heroNormX: 0.5,
    heroNormY: 0.5,
    heroDir: 2,
    hp: 6,
    maxHp: 6,
    torchFuelRatio: 0,
    isCave: false,
    invSel: 0,
    invHeroDir: 2,
    hasSword: false,
    equippedSword: false,
    swordTier: 'none',
    ownedSwords: [],
    dmg: 1,
    shieldTier: 'none',
    ownedShields: [],
    outfit: 'verde',
    ownedOutfits: ['verde'],
    mushrooms: 0,
    hasRing: false,
    hasOre: false,
    hasBear: false,
  });

  // A fonte medieval das legendas precisa estar pronta antes do canvas desenhá-la.
  useEffect(() => {
    if (typeof document !== 'undefined' && document.fonts) {
      void document.fonts.load('12px MedievalSharp');
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new GameEngine(canvas, (nextUi) => {
      setUi(nextUi);
    });
    engineRef.current = engine;
    engine.start();

    const onKeyDown = (e: KeyboardEvent) => {
      if (engine.handleTextKey(e)) {
        e.preventDefault();
        return;
      }
      const mapped = KEY_MAP[e.key.toLowerCase()];
      if (mapped) {
        e.preventDefault();
        engine.setKey(mapped, true);
        setActiveKeys((prev) => (prev[mapped] ? prev : { ...prev, [mapped]: true }));
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = KEY_MAP[e.key.toLowerCase()];
      if (mapped) {
        engine.setKey(mapped, false);
        setActiveKeys((prev) => (!prev[mapped] ? prev : { ...prev, [mapped]: false }));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // The browser blocks audible autoplay until the player interacts with the
    // page. Any first gesture anywhere (including the logo or the name field)
    // must unlock the already-playing music — not just the canvas/stick.
    const unlockAudio = () => engineRef.current?.audio.unlock();
    window.addEventListener('pointerdown', unlockAudio, true);
    window.addEventListener('touchstart', unlockAudio, true);
    window.addEventListener('keydown', unlockAudio, true);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointerdown', unlockAudio, true);
      window.removeEventListener('touchstart', unlockAudio, true);
      window.removeEventListener('keydown', unlockAudio, true);
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  const pressVirtualKey = (key: KeyCode, down: boolean) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setKey(key, down);
    setActiveKeys((prev) => (Boolean(prev[key]) === down ? prev : { ...prev, [key]: down }));
  };

  const makeBtnHandlers = (key: KeyCode) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on unsupported browsers
      }
      pressVirtualKey(key, true);
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.stopPropagation();
      pressVirtualKey(key, false);
    },
    onPointerCancel: () => pressVirtualKey(key, false),
    onLostPointerCapture: () => pressVirtualKey(key, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });

  const updateAnalogFromPointer = (clientX: number, clientY: number) => {
    const zone = stickZoneRef.current;
    const engine = engineRef.current;
    if (!zone || !engine) return;

    const rect = zone.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width * 0.34;

    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, maxR);
    const angle = Math.atan2(dy, dx);

    const px = dist > 0.001 ? Math.cos(angle) * clamped : 0;
    const py = dist > 0.001 ? Math.sin(angle) * clamped : 0;

    setKnobOffset({ x: px, y: py });
    engine.setAnalog(px / maxR, py / maxR);
  };

  const releaseAnalog = () => {
    stickPointerId.current = null;
    setStickEngaged(false);
    setKnobOffset({ x: 0, y: 0 });
    engineRef.current?.setAnalog(0, 0);
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    engineRef.current?.audio.unlock();
    stickPointerId.current = e.pointerId;
    setStickEngaged(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    updateAnalogFromPointer(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    updateAnalogFromPointer(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stickPointerId.current !== e.pointerId) return;
    e.preventDefault();
    releaseAnalog();
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const engine = engineRef.current;
    if (!canvas || !engine) return;
    const rect = canvas.getBoundingClientRect();
    let cx = ((e.clientX - rect.left) / rect.width) * W;
    let cy = ((e.clientY - rect.top) / rect.height) * H;
    // Menus, inventory and dialogs are drawn in screen space; only the live
    // world is seen through the zoomed camera.
    if (ui.screen === 'game') {
      const world = screenToWorld(cx, cy);
      cx = world.x;
      cy = world.y;
    }
    engine.handleCanvasTap(cx, cy);
  };

  const wireframeCircle = (active: boolean, sizeClass: string) =>
    `flex flex-col items-center justify-center rounded-full border-2 touch-none cursor-pointer transition-all duration-100 select-none ${sizeClass} ${
      active
        ? 'border-white bg-white/20 text-white scale-95 shadow-[0_0_18px_rgba(255,255,255,0.28)]'
        : 'border-[#969696] bg-[#0e0e0e] hover:border-[#c8c8c8] text-[#eaeaea]'
    }`;

  const wireframeSquareBtn = (active = false) =>
    `flex items-center justify-center w-11 h-11 rounded-xl border-2 touch-none cursor-pointer transition-all duration-100 select-none ${
      active
        ? 'border-white bg-white/20 text-white scale-95'
        : 'border-[#8c8c8c] bg-[#0e0e0e] hover:border-[#c2c2c2] text-[#e0e0e0]'
    }`;

  const topCapsulePill = (active: boolean) =>
    `flex items-center justify-center w-20 h-8 rounded-full border-2 text-[11px] font-bold tracking-wider touch-none cursor-pointer transition-all duration-100 select-none ${
      active
        ? 'border-white bg-white/20 text-white scale-95'
        : 'border-[#8c8c8c] bg-[#0e0e0e] hover:border-[#c2c2c2] text-[#e0e0e0]'
    }`;

  const dpadArrowBtn = (active: boolean) =>
    `flex items-center justify-center rounded-xl border-2 touch-none cursor-pointer transition-all duration-100 select-none ${
      active
        ? 'border-[#ffd700] bg-[#ffd700]/25 text-[#ffd700]'
        : 'border-[#5a5a5a] bg-[#1a3a1a]/90 text-[#8bc34a]'
    }`;

  const padModeLabel = padMode === 'both' ? 'SETAS + ANALÓGICO' : padMode === 'dpad' ? 'SÓ SETAS' : 'SÓ ANALÓGICO';

  const [remoteControlUrl, setRemoteControlUrl] = useState<string>('');

  // Listen for remote control inputs via WebSocket
  useEffect(() => {
    // Dynamically load socket.io client if available
    if (typeof window !== 'undefined') {
      const socketScript = document.createElement('script');
      socketScript.src = `http://${window.location.hostname}:3001/socket.io/socket.io.js`;
      socketScript.onload = () => {
        const socket = (window as any).io?.(`http://${window.location.hostname}:3001`);
        if (socket) {
          socket.on('remote-input', (data: { key: KeyCode; down: boolean }) => {
            const engine = engineRef.current;
            if (engine) engine.setKey(data.key, data.down);
          });
          socket.on('remote-analog', (data: { x: number; y: number }) => {
            const engine = engineRef.current;
            if (engine) engine.setAnalog(data.x, data.y);
          });
        }
      };
      socketScript.onerror = () => {}; // Silently fail if no WS server
      document.head.appendChild(socketScript);
    }
  }, []);
  
  // Gera QR code para controle remoto
  useEffect(() => {
    // URL que o segundo celular vai escanear
    const controlUrl = `${window.location.origin}/controller/index.html`;
    QRCode.toDataURL(controlUrl).then((url) => {
      setRemoteControlUrl(url);
    });
  }, []);

  return (
    <main className="h-dvh w-full bg-[#061a06] flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Nintendo DS Handheld Shell — Tema Zelda */}
      <div
        className="w-full max-w-[520px] flex flex-col items-center gap-1 bg-[#1a1a1a] px-2 py-2 rounded-2xl border-4 border-[#6b9e5a]/60 shadow-[0_0_50px_rgba(0,60,0,0.7)]"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Top Control Row: Som | INV | START | Salvar */}
        <div className="w-full flex items-center justify-between px-2">
          <button
            type="button"
            aria-label={ui.muted ? 'Ativar som' : 'Silenciar som'}
            onClick={() => engineRef.current?.toggleMute()}
            className={wireframeSquareBtn(false)}
          >
            {ui.muted ? <VolumeX className="w-5 h-5 text-[#ffd700]/50" /> : <Volume2 className="w-5 h-5 text-[#ffd700]" />}
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Inventário"
              className={topCapsulePill(Boolean(activeKeys.i) || ui.screen === 'inv')}
              {...makeBtnHandlers('i')}
            >
              INV
            </button>
            <button
              type="button"
              aria-label="Start"
              className={topCapsulePill(Boolean(activeKeys.s))}
              {...makeBtnHandlers('s')}
            >
              START
            </button>
          </div>

          <button
            type="button"
            aria-label="Salvar jogo"
            onClick={() => engineRef.current?.quickSave()}
            className={wireframeSquareBtn(false)}
          >
            <Save className="w-5 h-5 text-[#ffd700]" />
          </button>
        </div>

        {/* ================= DS TOP SCREEN: Mapa + Inventário ================= */}
        <div className="w-full max-w-[640px] flex-1 flex flex-col items-center gap-1 bg-[#3a3a3a] border-y border-[#5a5a5a]/50 rounded-t-xl overflow-hidden">
          <div className="relative bg-[#0a0a0a] border-2 border-[#5a5a5a]/70 rounded-lg overflow-hidden">
            {/* Mapa de Mitribuque (apenas durante o jogo) */}
            {ui.screen === 'game' && <TopWorldMap cells={miniMapMeta} ui={ui} />}

            {/* Barra de status do inventário */}
            <div className="flex items-center justify-between px-2 py-1 bg-[#2a2a2a] border-t border-[#5a5a5a]/40">
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#ff4444] tracking-wider">
                <Heart className="w-2 h-2" />
                <span className="text-xs">{ui.hp}/{ui.maxHp}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#ffd700] tracking-wider">
                <span className="text-xs">R{ui.rp}</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#8bc34a] tracking-wider">
                <span className="text-xs">DOM {ui.fragments}/3</span>
                <span className="text-xs">{ui.fragments}/3</span>
              </div>
              <div className="flex items-center gap-1 text-[10px] font-extrabold text-[#bb86fc] tracking-wider">
                <Sword className="w-2 h-2" />
                <span className="text-xs">{ui.swordTier !== 'none' ? ui.swordTier.toUpperCase() : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= DS BOTTOM SCREEN: Jogo + Controles ================= */}
        <div
          className="relative bg-[#000000] border-2 border-[#5a5a5a]/70 rounded-lg overflow-hidden flex items-center justify-center min-h-[200px]"
        >
          {/* Esquerda: Analógico / Setas (Movimento) */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 z-10 hidden">
            {padMode === 'dpad' ? (
              <div className="relative w-[160px] h-[160px] shrink-0">
                <button
                  type="button"
                  aria-label="Cima"
                  className={`absolute left-1/2 -translate-x-1/2 top-0 w-[48px] h-[48px] ${dpadArrowBtn(
                    Boolean(activeKeys.u),
                  )}`}
                  {...makeBtnHandlers('u')}
                >
                  <ArrowUp className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Esquerda"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[48px] h-[48px] ${dpadArrowBtn(
                    Boolean(activeKeys.l),
                  )}`}
                  {...makeBtnHandlers('l')}
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Direita"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 w-[48px] h-[48px] ${dpadArrowBtn(
                    Boolean(activeKeys.r),
                  )}`}
                  {...makeBtnHandlers('r')}
                >
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Baixo"
                  className={`absolute left-1/2 -translate-x-1/2 bottom-0 w-[48px] h-[48px] ${dpadArrowBtn(
                    Boolean(activeKeys.d),
                  )}`}
                  {...makeBtnHandlers('d')}
                >
                  <ArrowDown className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div
                ref={stickZoneRef}
                aria-label="Controle Analógico"
                onPointerDown={handleStickDown}
                onPointerMove={handleStickMove}
                onPointerUp={handleStickUp}
                onPointerCancel={handleStickUp}
                onLostPointerCapture={releaseAnalog}
                onContextMenu={(e) => e.preventDefault()}
                className="relative flex items-center justify-center w-[160px] h-[160px] shrink-0 rounded-full border-2 border-[#5a5a5a] bg-[#1a1a1a] touch-none cursor-grab active:cursor-grabbing"
              >
                <div className="pointer-events-none absolute inset-6 rounded-full border border-[#2a5a2a]" />

                {padMode === 'both' && (
                  <>
                    <button
                      type="button"
                      aria-label="Seta Cima"
                      className={`absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-6 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.u || knobOffset.y < -14
                          ? 'border-[#ffd700] bg-[#ffd700]/25 text-[#ffd700]'
                          : 'border-[#2a5a2a] bg-[#1a3a1a]/90 text-[#8bc34a]'
                      }`}
                      {...makeBtnHandlers('u')}
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Baixo"
                      className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-8 h-6 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.d || knobOffset.y > 14
                          ? 'border-[#ffd700] bg-[#ffd700]/25 text-[#ffd700]'
                          : 'border-[#2a5a2a] bg-[#1a3a1a]/90 text-[#8bc34a]'
                      }`}
                      {...makeBtnHandlers('d')}
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Esquerda"
                      className={`absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-8 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.l || knobOffset.x < -14
                          ? 'border-[#ffd700] bg-[#ffd700]/25 text-[#ffd700]'
                          : 'border-[#2a5a2a] bg-[#1a3a1a]/90 text-[#8bc34a]'
                      }`}
                      {...makeBtnHandlers('l')}
                    >
                      <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Direita"
                      className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-8 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.r || knobOffset.x > 14
                          ? 'border-[#ffd700] bg-[#ffd700]/25 text-[#ffd700]'
                          : 'border-[#2a5a2a] bg-[#1a3a1a]/90 text-[#8bc34a]'
                      }`}
                      {...makeBtnHandlers('r')}
                    >
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </>
                )}

                <div
                  className={`pointer-events-none absolute w-[52px] h-[52px] rounded-full border-2 ${
                    stickEngaged
                      ? 'border-[#ffd700] bg-[#ffd700]/25 scale-105'
                      : 'border-[#6b9e5a] bg-[#1e3a1e] transition-transform duration-150 ease-out'
                  }`}
                  style={{
                    transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Tela principal do jogo (canvas central) */}
          <div className="relative w-full bg-black overflow-hidden">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              onPointerDown={handleCanvasPointerDown}
              onContextMenu={(e) => e.preventDefault()}
              className="pixel-canvas block w-full h-auto bg-black cursor-pointer touch-none"
              style={{ aspectRatio: '3 / 2', maxWidth: 240, maxHeight: 160 }}
            />

            {/* QR Code for remote control */}
            {remoteControlUrl && (
              <div className="absolute bottom-2 right-2 bg-white p-1 rounded shadow-lg z-50">
                <img src={remoteControlUrl} alt="QR Code - Escaneie com outro celular" className="w-16 h-16" />
                <p className="text-[8px] text-gray-700 text-center mt-0.5">Controle Remoto</p>
              </div>
            )}

            {ui.screen === 'intro' && ui.introPhase === 'logo' && !logoBroken && (
              <img
                src="/assets/dominic-games.gif"
                alt="Dominic Games"
                onError={() => setLogoBroken(true)}
                className="animate-logo-fade pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
              />
            )}

            {ui.screen === 'intro' && ui.introPhase === 'video' && (
              <video
                key="cloud-games-video"
                ref={attachCloudVideo}
                src="/cloud_games.mp4"
                className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
                autoPlay
                muted
                playsInline
                preload="auto"
                onEnded={() => engineRef.current?.introVideoDone()}
                onError={() => engineRef.current?.introVideoDone()}
              />
            )}

            {ui.screen === 'menu' && (
              <div className="absolute inset-0 overflow-hidden bg-black">
                {menuVideoBroken ? (
                  <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[12%]">
                    <span className="text-sm font-bold tracking-[0.3em] text-[#ffd700]">MITRIBUQUE</span>
                  </div>
                ) : (
                  <video
                    key="menu-video"
                    src="/menu_video.mp4"
                    className="pointer-events-none absolute inset-0 h-full w-full bg-black object-fill"
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    onError={() => setMenuVideoBroken(true)}
                  />
                )}
                {MENU_VIDEO_BUTTONS.map((b, idx) => (
                  <button
                    key={b.label}
                    type="button"
                    aria-label={b.label}
                    title={b.label}
                    onClick={() => engineRef.current?.activateMenuButton(idx)}
                    className={`absolute flex cursor-pointer touch-none items-center justify-center rounded-sm border-2 transition-colors ${
                      ui.menuSel === idx
                        ? 'border-[#ffd700] bg-[#ffd70022] shadow-[0_0_12px_rgba(255,215,0,0.45)]'
                        : 'border-transparent hover:border-[#ffd70088]'
                    } ${menuVideoBroken ? 'bg-[#0a071bcc] text-[11px] font-bold text-white' : ''}`}
                    style={{
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      width: `${b.w}%`,
                      height: `${b.h}%`,
                    }}
                  >
                    {menuVideoBroken && b.label}
                  </button>
                ))}
                {!ui.hasSave && (
                  <span className="pointer-events-none absolute bottom-[2%] left-[3%] text-[9px] font-bold text-[#ff4444]/90">
                    SEM JOGO SALVO
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Direita: Botões de Ação (X / B / A) */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 hidden">
            <div className="relative w-[170px] h-[160px] shrink-0">
              <button
                type="button"
                aria-label="Botão X (Item Rápido)"
                className={`absolute left-[48px] top-0 ${wireframeCircle(
                  Boolean(activeKeys.x),
                  'w-[56px] h-[56px]',
                )}`}
                {...makeBtnHandlers('x')}
              >
                <span className="text-lg font-bold leading-none text-[#ffd700]">X</span>
                <span className="text-[8px] font-semibold tracking-wider opacity-90 leading-none mt-0.5 text-[#8bc34a]">
                  {TOOL_SHORT[ui.secondary]}
                </span>
              </button>

              <button
                type="button"
                aria-label="Botão B (Escudo / Voltar)"
                className={`absolute left-0 bottom-1 ${wireframeCircle(
                  Boolean(activeKeys.b),
                  'w-[64px] h-[64px]',
                )}`}
                {...makeBtnHandlers('b')}
              >
                <span className="text-2xl font-medium leading-none text-[#ffd700]">B</span>
              </button>

              <button
                type="button"
                aria-label="Botão A (Espada / Ação)"
                className={`absolute right-0 bottom-1 ${wireframeCircle(
                  Boolean(activeKeys.a),
                  'w-[64px] h-[64px]',
                )}`}
                {...makeBtnHandlers('a')}
              >
                <span className="text-2xl font-medium leading-none text-[#ffd700]">A</span>
              </button>
            </div>
          </div>
        </div>

        {/* Shoulder Strip: L (Inventário) | Centro (Item Rápido X) | R (Item Rápido X) */}
        <div className="w-full flex items-center justify-between px-2">
          <button
            type="button"
            aria-label="L - Inventário"
            className={`flex items-center justify-start pl-3 w-[100px] h-[40px] rounded-tl-xl rounded-tr-sm rounded-bl-sm rounded-br-[22px] border-2 border-[#5a5a5a] text-base font-bold tracking-wider touch-none cursor-pointer transition-all duration-100 ${
              activeKeys.i || ui.screen === 'inv'
                ? 'bg-[#5a5a5a]/40 text-[#ffd700] shadow-[0_0_12px_rgba(76,175,80,0.4)]'
                : 'bg-[#1a1a1a]/60 text-[#8bc34a] hover:border-[#8bc34a]'
            }`}
            {...makeBtnHandlers('i')}
          >
            L
          </button>

          <button
            type="button"
            aria-label="Item Rápido X"
            className={wireframeSquareBtn(Boolean(activeKeys.x))}
            {...makeBtnHandlers('x')}
          >
            <ChevronsRight className="w-5 h-5 text-[#ffd700]" />
          </button>

          <button
            type="button"
            aria-label="R - Usar Item X"
            className={`flex items-center justify-end pr-3 w-[100px] h-[40px] rounded-tr-xl rounded-tl-sm rounded-br-sm rounded-bl-[22px] border-2 border-[#5a5a5a] text-base font-bold tracking-wider touch-none cursor-pointer transition-all duration-100 ${
              activeKeys.x
                ? 'bg-[#5a5a5a]/40 text-[#ffd700] shadow-[0_0_12px_rgba(76,175,80,0.4)]'
                : 'bg-[#1a1a1a]/60 text-[#8bc34a] hover:border-[#8bc34a]'
            }`}
            {...makeBtnHandlers('x')}
          >
            R
          </button>
        </div>

        {/* Botão de alternar modo de controle */}
        <div className="flex justify-center pt-0.5">
          <button
            type="button"
            onClick={cyclePadMode}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#5a5a5a]/50 bg-[#1a1a1a] hover:border-[#8bc34a] text-[10px] font-bold tracking-wider text-[#8bc34a] cursor-pointer touch-none transition-colors"
          >
            <Gamepad2 className="w-3 h-3 text-[#8bc34a]" />
            <span>CONTROLE: {padModeLabel}</span>
          </button>
        </div>
      </div>

      {/* Overlay de Inventário (RE4 Attaché) */}
      {ui.screen === 'inv' && <ResponsiveInventoryModal ui={ui} engine={engineRef.current} />}
    </main>
  );
}
