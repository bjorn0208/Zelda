/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  biome: 'g' | 's' | 'n' | 'd';
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

    const CW = 20;
    const CH = 16;
    g.fillStyle = '#070514';
    g.fillRect(0, 0, 160, 112);

    const exploredSet = new Set(ui.explored);

    for (const c of cells) {
      const ox = c.sx * CW;
      const oy = c.sy * CH;
      const exp = exploredSet.has(c.id);

      if (!exp) {
        g.fillStyle = '#0e0a22';
        g.fillRect(ox, oy, CW, CH);
        g.fillStyle = '#181236';
        g.fillRect(ox + ((c.id * 5) % 12) + 2, oy + ((c.id * 3) % 9) + 2, 3, 2);
        g.fillRect(ox + ((c.id * 7) % 11) + 5, oy + ((c.id * 11) % 8) + 5, 2, 1);
        g.fillStyle = '#1f1844';
        g.fillRect(ox, oy, CW, 1);
        g.fillRect(ox, oy, 1, CH);
        continue;
      }

      let base = '#3b8c47';
      let accent = '#2c6e37';
      if (c.biome === 'd') {
        base = '#322254';
        accent = '#22163b';
      } else if (c.biome === 'n') {
        base = '#8cc2ec';
        accent = '#c9e6ff';
      } else if (c.biome === 's') {
        base = '#cfa552';
        accent = '#a97d31';
      } else if (c.isForest) {
        base = '#1f6438';
        accent = '#144726';
      }

      g.fillStyle = base;
      g.fillRect(ox, oy, CW, CH);

      g.fillStyle = accent;
      g.fillRect(ox + 2, oy + 3, 4, 2);
      g.fillRect(ox + 13, oy + 10, 4, 3);

      if (c.isLake && !c.isCentral) {
        g.fillStyle = '#2560c4';
        g.fillRect(ox + 4, oy + 4, 10, 7);
        g.fillStyle = '#5ba2ff';
        g.fillRect(ox + 5, oy + 5, 4, 2);
      }

      if (c.isCentral) {
        g.fillStyle = '#9c8f78';
        g.fillRect(ox + 1, oy + 7, CW - 2, 4);
        g.fillRect(ox + 8, oy + 1, 4, CH - 2);
        g.fillStyle = '#ffd84a';
        g.fillRect(ox + 2, oy + 2, 5, 4);
        if (c.sx === 3) {
          g.fillStyle = '#ff5858';
          g.fillRect(ox + 13, oy + 2, 5, 4);
        } else {
          g.fillStyle = '#a860ff';
          g.fillRect(ox + 13, oy + 3, 4, 3);
        }
      } else if (c.hasVillage) {
        g.fillStyle = '#b84232';
        g.fillRect(ox + 3, oy + 3, 4, 3);
        g.fillRect(ox + 12, oy + 3, 4, 3);
        g.fillStyle = '#ffd84a';
        g.fillRect(ox + 14, oy + 11, 3, 2);
      }

      if (c.hasCave) {
        g.fillStyle = '#1b162a';
        g.fillRect(ox + 3, oy + 2, 5, 4);
        g.fillStyle = c.isBonusCave ? '#ffb84d' : '#4ce0ff';
        g.fillRect(ox + 4, oy + 3, 3, 2);
      }

      if (c.isBossGate) {
        g.fillStyle = '#1d1236';
        g.fillRect(ox + 4, oy + 2, 12, 6);
        g.fillStyle = '#b84dff';
        g.fillRect(ox + 8, oy + 4, 4, 4);
      }

      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(ox, oy, CW, 1);
      g.fillRect(ox, oy, 1, CH);
    }

    const hsx = ui.overworldMap & 7;
    const hsy = ui.overworldMap >> 3;
    const ox = hsx * CW;
    const oy = hsy * CH;

    g.strokeStyle = ui.currentMap >= 100 ? '#5ce1ff' : '#ffd84a';
    g.lineWidth = 1;
    g.strokeRect(ox + 0.5, oy + 0.5, CW - 1, CH - 1);

    const px = Math.round(ox + 2 + ui.heroNormX * (CW - 4));
    const py = Math.round(oy + 2 + ui.heroNormY * (CH - 4));

    if (ui.torchLit) {
      g.fillStyle = 'rgba(255, 175, 65, 0.45)';
      g.fillRect(px - 3, py - 3, 6, 6);
    }

    g.fillStyle = '#090614';
    g.fillRect(px - 2, py - 2, 5, 5);
    g.fillStyle = ui.currentMap >= 100 ? '#6ae8ff' : '#ffd84a';
    g.fillRect(px - 1, py - 1, 3, 3);

    const fdx = ui.heroDir === 1 ? 2 : ui.heroDir === 3 ? -2 : 0;
    const fdy = ui.heroDir === 2 ? 2 : ui.heroDir === 0 ? -2 : 0;
    g.fillStyle = '#ffffff';
    g.fillRect(px + fdx, py + fdy, 1, 1);
  }, [cells, ui]);

  return (
    <div className="rounded border border-[#525252] bg-[#050508] p-0.5 shadow-inner">
      <canvas
        ref={mapCanvasRef}
        width={160}
        height={112}
        className="pixel-canvas block w-[112px] sm:w-[132px] h-auto rounded-[2px]"
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
        ? 'A Espada Lendária está cravada no centro da casa ao lado. Vá até lá para puxá-la e encerrar a tempestade.'
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
          : 'Túnica inicial de Aurora. Visite a Alfaiataria Real na Vila Central para comprar novos trajes!',
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
      label: 'Cristais',
      title: `Fragmentos do Cristal (${ui.fragments}/3)`,
      badge: `${ui.fragments}/3`,
      active: ui.fragments > 0,
      desc:
        ui.fragments >= 3
          ? 'Você reuniu todos os 3 Fragmentos! Vá ao norte até o Portão de Vorak para enfrentar o lorde sombrio.'
          : 'Derrote os guardiões das três grandes cavernas (Floresta, Ruínas do Deserto e Terra Gelada) para reunir os cristais.',
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
        ? 'border-white bg-white/25 text-white scale-95 shadow-[0_0_12px_rgba(255,255,255,0.25)]'
        : 'border-[#8c8c8c] bg-[#0e0e0e] hover:border-[#c4c4c4] text-[#e4e4e4]'
    }`;

  const padModeLabel = padMode === 'both' ? 'SETAS + ANALÓGICO' : padMode === 'dpad' ? 'SÓ SETAS' : 'SÓ ANALÓGICO';

  return (
    <main className="h-dvh w-full bg-black flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Locked Portrait Handheld Shell (Fixed size matching screenshot) */}
      <div
        className="w-full max-w-[460px] flex flex-col items-center gap-2.5 bg-black px-2 py-2"
        style={{
          paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* Top Control Row: Sound icon | Two Capsule Pills (INV / START) | Save icon */}
        <div className="w-full flex items-center justify-between px-1">
          <button
            type="button"
            aria-label={ui.muted ? 'Ativar som' : 'Silenciar som'}
            onClick={() => engineRef.current?.toggleMute()}
            className={wireframeSquareBtn(false)}
          >
            {ui.muted ? <VolumeX className="w-5 h-5 text-white/50" /> : <Volume2 className="w-5 h-5" />}
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
            <Save className="w-5 h-5" />
          </button>
        </div>

        {/* ONLY Map Above Screen During Gameplay */}
        {ui.screen === 'game' && <TopWorldMap cells={miniMapMeta} ui={ui} />}

        {/* Main 3:2 Gameplay Screen */}
        <div className="relative w-full bg-black border-y border-[#2a2a2a] overflow-hidden">
          <canvas
            ref={canvasRef}
            width={W}
            height={H}
            onPointerDown={handleCanvasPointerDown}
            onContextMenu={(e) => e.preventDefault()}
            className="pixel-canvas block w-full h-auto bg-black cursor-pointer touch-none"
            style={{ aspectRatio: '3 / 2' }}
          />

          {ui.introPhase === 'video' && (
            <video
              key="intro-video"
              src="/intro_video.mp4"
              className="pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
              autoPlay
              muted
              playsInline
              preload="auto"
              onEnded={() => engineRef.current?.introVideoDone()}
              onError={() => engineRef.current?.introVideoDone()}
              ref={(el) => {
                if (!el) return;
                const p = el.play();
                if (p && typeof p.catch === 'function') {
                  // Autoplay blocked (common on mobile): never stall the intro
                  p.catch(() => engineRef.current?.introVideoDone());
                }
              }}
            />
          )}

          {ui.screen === 'intro' && ui.introPhase === 'logo' && !logoBroken && (
            <img
              src="/assets/dominic-games.gif"
              alt="Dominic Games"
              onError={() => setLogoBroken(true)}
              className="animate-logo-fade pointer-events-none absolute inset-0 h-full w-full bg-black object-contain"
            />
          )}

          {ui.screen === 'menu' && (
            <div className="absolute inset-0 overflow-hidden bg-black">
              {menuVideoBroken ? (
                <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-[12%]">
                  <span className="text-sm font-bold tracking-[0.3em] text-[#ffd84a]">MITRIBUQUE</span>
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
                      ? 'border-[#ffd84a] bg-[#ffd84a22] shadow-[0_0_12px_rgba(255,216,74,0.45)]'
                      : 'border-transparent hover:border-[#ffd84a88]'
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
                <span className="pointer-events-none absolute bottom-[2%] left-[3%] text-[9px] font-bold text-red-400/90">
                  SEM JOGO SALVO
                </span>
              )}
            </div>
          )}
        </div>

        {/* Fixed Large Controls Directly Below Screen */}
        <div className="w-full flex flex-col gap-2.5 pt-0.5">
          {/* Shoulder Strip: L (Inventário) | Center Icon (Item Rápido X) | R (Item Rápido X) */}
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              aria-label="L - Inventário"
              className={`flex items-center justify-start pl-4 w-[112px] h-[44px] rounded-tl-xl rounded-tr-sm rounded-bl-sm rounded-br-[24px] border-2 text-base font-bold tracking-wider touch-none cursor-pointer transition-all duration-100 ${
                activeKeys.i || ui.screen === 'inv'
                  ? 'border-white bg-white/20 text-white scale-95'
                  : 'border-[#8f8f8f] bg-[#0e0e0e] hover:border-[#c4c4c4] text-[#e5e5e5]'
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
              <ChevronsRight className="w-6 h-6" />
            </button>

            <button
              type="button"
              aria-label="R - Usar Item X"
              className={`flex items-center justify-end pr-4 w-[112px] h-[44px] rounded-tr-xl rounded-tl-sm rounded-br-sm rounded-bl-[24px] border-2 text-base font-bold tracking-wider touch-none cursor-pointer transition-all duration-100 ${
                activeKeys.x
                  ? 'border-white bg-white/20 text-white scale-95'
                  : 'border-[#8f8f8f] bg-[#0e0e0e] hover:border-[#c4c4c4] text-[#e5e5e5]'
              }`}
              {...makeBtnHandlers('x')}
            >
              R
            </button>
          </div>

          {/* Main Large Thumb Controls: Analog + Arrows (Left) & X / B / A Cluster (Right) */}
          <div className="flex items-center justify-between px-1 sm:px-2 pt-0.5">
            {/* Left Fixed 158x158 (sm:172x172) Movement Pad */}
            {padMode === 'dpad' ? (
              <div className="relative w-[158px] h-[158px] sm:w-[172px] sm:h-[172px] shrink-0">
                <button
                  type="button"
                  aria-label="Cima"
                  className={`absolute left-1/2 -translate-x-1/2 top-0 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] ${dpadArrowBtn(
                    Boolean(activeKeys.u),
                  )}`}
                  {...makeBtnHandlers('u')}
                >
                  <ArrowUp className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  aria-label="Esquerda"
                  className={`absolute left-0 top-1/2 -translate-y-1/2 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] ${dpadArrowBtn(
                    Boolean(activeKeys.l),
                  )}`}
                  {...makeBtnHandlers('l')}
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  aria-label="Direita"
                  className={`absolute right-0 top-1/2 -translate-y-1/2 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] ${dpadArrowBtn(
                    Boolean(activeKeys.r),
                  )}`}
                  {...makeBtnHandlers('r')}
                >
                  <ArrowRight className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  aria-label="Baixo"
                  className={`absolute left-1/2 -translate-x-1/2 bottom-0 w-[52px] h-[52px] sm:w-[56px] sm:h-[56px] ${dpadArrowBtn(
                    Boolean(activeKeys.d),
                  )}`}
                  {...makeBtnHandlers('d')}
                >
                  <ArrowDown className="w-6 h-6" />
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
                className="relative flex items-center justify-center w-[158px] h-[158px] sm:w-[172px] sm:h-[172px] rounded-full border-2 border-[#8f8f8f] bg-[#0a0a0a] touch-none cursor-grab active:cursor-grabbing shrink-0"
              >
                <div className="pointer-events-none absolute inset-6 rounded-full border border-[#3a3a3a]" />

                {padMode === 'both' && (
                  <>
                    <button
                      type="button"
                      aria-label="Seta Cima"
                      className={`absolute top-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-7 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.u || knobOffset.y < -14
                          ? 'border-white bg-white/25 text-white'
                          : 'border-[#5a5a5a] bg-[#141414]/90 text-[#d8d8d8]'
                      }`}
                      {...makeBtnHandlers('u')}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Baixo"
                      className={`absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-7 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.d || knobOffset.y > 14
                          ? 'border-white bg-white/25 text-white'
                          : 'border-[#5a5a5a] bg-[#141414]/90 text-[#d8d8d8]'
                      }`}
                      {...makeBtnHandlers('d')}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Esquerda"
                      className={`absolute left-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-9 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.l || knobOffset.x < -14
                          ? 'border-white bg-white/25 text-white'
                          : 'border-[#5a5a5a] bg-[#141414]/90 text-[#d8d8d8]'
                      }`}
                      {...makeBtnHandlers('l')}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Seta Direita"
                      className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center w-7 h-9 rounded-lg border touch-none cursor-pointer ${
                        activeKeys.r || knobOffset.x > 14
                          ? 'border-white bg-white/25 text-white'
                          : 'border-[#5a5a5a] bg-[#141414]/90 text-[#d8d8d8]'
                      }`}
                      {...makeBtnHandlers('r')}
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                )}

                <div
                  className={`pointer-events-none absolute w-[54px] h-[54px] sm:w-[60px] sm:h-[60px] rounded-full border-2 ${
                    stickEngaged
                      ? 'border-white bg-white/25 scale-105'
                      : 'border-[#bababa] bg-[#1e1e1e] transition-transform duration-150 ease-out'
                  }`}
                  style={{
                    transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
                  }}
                />
              </div>
            )}

            {/* Right: Extra-Large Angled Wireframe Action Cluster (X / B / A) */}
            <div className="relative w-[176px] sm:w-[190px] h-[158px] sm:h-[168px] shrink-0">
              <button
                type="button"
                aria-label="Botão X (Item Rápido)"
                className={`absolute left-[54px] sm:left-[60px] top-0 ${wireframeCircle(
                  Boolean(activeKeys.x),
                  'w-[62px] h-[62px] sm:w-[66px] sm:h-[66px]',
                )}`}
                {...makeBtnHandlers('x')}
              >
                <span className="text-lg font-bold leading-none">X</span>
                <span className="text-[9px] font-semibold tracking-wider opacity-85 leading-none mt-0.5">
                  {TOOL_SHORT[ui.secondary]}
                </span>
              </button>

              <button
                type="button"
                aria-label="Botão B (Escudo / Voltar)"
                className={`absolute left-0 bottom-1 ${wireframeCircle(
                  Boolean(activeKeys.b),
                  'w-[68px] h-[68px] sm:w-[72px] sm:h-[72px]',
                )}`}
                {...makeBtnHandlers('b')}
              >
                <span className="text-2xl font-medium leading-none">B</span>
              </button>

              <button
                type="button"
                aria-label="Botão A (Espada / Ação)"
                className={`absolute right-0 bottom-1 ${wireframeCircle(
                  Boolean(activeKeys.a),
                  'w-[68px] h-[68px] sm:w-[72px] sm:h-[72px]',
                )}`}
                {...makeBtnHandlers('a')}
              >
                <span className="text-2xl font-medium leading-none">A</span>
              </button>
            </div>
          </div>

          {/* Compact Directional Mode Toggle Pill (Setas + Analógico / Só Setas / Só Analógico) */}
          <div className="flex justify-center pt-0.5">
            <button
              type="button"
              onClick={cyclePadMode}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-[#686868] bg-[#0b0b0b] hover:border-[#b0b0b0] text-[10px] font-bold tracking-wider text-[#cfcfcf] cursor-pointer touch-none transition-colors"
            >
              <Gamepad2 className="w-3.5 h-3.5" />
              <span>CONTROLE: {padModeLabel}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Responsive RE4-Style Attaché Inventory Overlay */}
      {ui.screen === 'inv' && <ResponsiveInventoryModal ui={ui} engine={engineRef.current} />}
    </main>
  );
}
