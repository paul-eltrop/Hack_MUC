"use client";

import { useEffect, useState } from "react";
import {
  Handle,
  Position,
  useViewport,
  type NodeProps,
} from "@xyflow/react";
import type { FlowKind, FlowNodeData } from "./flow-data";

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

export const NODE_W = 220;
export const NODE_H = 170;
export const MINI_W = 60;
export const MINI_H = 60;
// Bg-Node-Größe: 10× NODE_W, Aspect-Ratio wie NODE → groß genug, um bei finalem
// Zoom den ganzen Viewport abzudecken, Initial-Scale = NODE_W/BG_W matcht dabei
// exakt den geklickten Node-Footprint.
export const BG_W = 2200;
export const BG_H = Math.round(BG_W * (NODE_H / NODE_W));

export function nodeSize(type: string | undefined): { w: number; h: number } {
  if (type === "flowMini") return { w: MINI_W, h: MINI_H };
  if (type === "bg") return { w: BG_W, h: BG_H };
  return { w: NODE_W, h: NODE_H };
}

export const kindLabel: Record<FlowKind, string> = {
  supplier: "Supplier",
  factory: "Factory",
  field: "Field",
};

export function FlowNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const hasError = d.errorCount > 0;
  const zoomable = d.zoomable !== false;
  const disappearing = d._disappearing === true;
  const entering = d._entering === true;

  return (
    <div
      className={`relative ${
        zoomable ? "cursor-pointer" : "cursor-default"
      }`}
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <div
        className={`w-full h-full flex flex-col items-center text-center ${
          disappearing ? "animate-node-disappear" : ""
        } ${entering ? "animate-node-pop-in" : ""}`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {kindLabel[d.kind]}
        </div>
        <div className="text-sm font-semibold text-zinc-900 leading-tight mt-0.5">
          {d.title}
        </div>
        <div className="relative mt-1">
          <img
            src={`${TWEMOJI_BASE}/${d.emojiCode}.svg`}
            alt={d.title}
            width={92}
            height={92}
            draggable={false}
            className="select-none drop-shadow-sm"
          />
          <div
            className={`absolute -top-1 -right-2 min-w-[34px] h-8 px-2 rounded-full flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white ${
              hasError ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-500"
            }`}
          >
            {d.errorCount}
          </div>
        </div>
        {d.subtitle && (
          <div className="text-[11px] text-zinc-600 mt-1 leading-tight">
            {d.subtitle}
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
    </div>
  );
}

export function FlowMiniNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div
      className="relative"
      style={{ width: MINI_W, height: MINI_H }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded-lg border border-zinc-200 shadow-sm animate-node-pop-in">
        <img
          src={`${TWEMOJI_BASE}/${d.emojiCode}.svg`}
          alt={d.title}
          width={30}
          height={30}
          draggable={false}
          className="select-none"
        />
        <div className="text-[8px] font-medium text-zinc-700 leading-none mt-0.5 px-1 truncate max-w-full">
          {d.title}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
    </div>
  );
}

const BG_ANIM_DURATION = 1000;
const BG_REVERSE_DURATION = 500;

export function BgNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  // Live-Camera-Zoom: wir kompensieren ihn, damit die Bg-Größe auf dem Screen
  // nicht durch den Kamera-Zoom aufgebläht wird, sondern rein durch unsere
  // zeitbasierte Progression wächst.
  const { zoom } = useViewport();
  const reversing = d._reversing === true;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    // Richtungswechsel: Ziel 0 (reverse) oder 1 (forward), Start = aktueller progress.
    const target = reversing ? 0 : 1;
    const startProgress = progress;
    const distance = Math.abs(target - startProgress);
    if (distance < 0.001) return;
    const baseDuration = reversing ? BG_REVERSE_DURATION : BG_ANIM_DURATION;
    const duration = baseDuration * distance;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setProgress(startProgress + (target - startProgress) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reversing]);

  const color =
    d.kind === "supplier"
      ? "bg-purple-200/50"
      : d.kind === "factory"
        ? "bg-sky-200/50"
        : "bg-emerald-200/50";

  // Wir interpolieren die GEWÜNSCHTE Screen-Pixel-Größe (von Node-at-initial-zoom
  // bis Viewport-überdeckend) und rechnen dann die Flow-Scale zurück — durch
  // Division durch den live-Zoom wird die Kamera herausgerechnet.
  // Bg-Wrapper hat mittlerweile Bildschirm-Aspect (via style in FlowView),
  // daher deckt scale(1) das Viewport sauber ab. Overshoot 1.3 für den Rand.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1400;
  const startPx = 0;
  const endPx = vw * 1.3;
  const currentPx = startPx + (endPx - startPx) * progress;
  const scale = currentPx / (BG_W * (zoom || 1));

  return (
    <div
      className={`w-full h-full ${color}`}
      style={{
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    />
  );
}

export const nodeTypes = {
  flow: FlowNode,
  flowMini: FlowMiniNode,
  bg: BgNode,
};
