"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  articleCatalog as defaultArticleCatalog,
  type ArticleInfo,
  type BomComponent,
  type BomFlag,
} from "./flow-data";
import { TWEMOJI_BASE } from "./flow-nodes";
import { useAgentState } from "./agent-state";
import { pickArticleCatalog } from "./applyAgentState";

// ---------- Twemoji-Maps ----------

const COMMODITY_EMOJI: Record<string, string> = {
  capacitor: "1f50b", // 🔋
  resistor: "1f4a1", // 💡
  diode: "1f538", // 🔸
  ic: "1f9e0", // 🧠
  connector: "1f50c", // 🔌
  housing: "1f4e6", // 📦
  fastener: "1f529", // 🔩
  consumable: "1f9f4", // 🧴
  pcb: "1f7e9", // 🟩
  relay: "1f504", // 🔄
  fuse: "1f4a5", // 💥
  display: "1f4fa", // 📺
  input: "2328", // ⌨️
  part: "1f9e9", // 🧩
};

function emojiForCommodity(commodity: string): string {
  return COMMODITY_EMOJI[commodity] ?? COMMODITY_EMOJI.part;
}

function emojiForAssembly(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("steuer")) return "1f9e0"; // 🧠 Steuerplatine = brain
  if (n.includes("leistung")) return "26a1"; // ⚡ Leistung
  if (n.includes("haupt")) return "1f4be"; // 💾 Hauptplatine
  if (n.includes("relais")) return "1f504"; // 🔄
  if (n.includes("gehäus") || n.includes("gehaeus")) return "1f4e6"; // 📦
  if (n.includes("sensor")) return "1f4e1"; // 📡
  if (n.includes("funk")) return "1f4fb"; // 📻
  if (n.includes("anzeige") || n.includes("display")) return "1f4fa"; // 📺
  if (n.includes("schnittstelle")) return "1f50c"; // 🔌
  if (n.includes("montage")) return "1f6e0"; // 🛠
  return "1f9e9"; // 🧩 generic
}

// ---------- Flag-Styles ----------

const FLAG_LABEL: Record<BomFlag, string> = {
  "design-issue": "Design Issue",
  "supply-issue": "Supply Issue",
};

const FLAG_RING: Record<BomFlag, string> = {
  "design-issue": "ring-2 ring-rose-400",
  "supply-issue": "ring-2 ring-orange-400",
};

const FLAG_BADGE: Record<BomFlag, string> = {
  "design-issue": "bg-rose-500 text-white",
  "supply-issue": "bg-orange-500 text-white",
};

const FLAG_EDGE: Record<BomFlag, string> = {
  "design-issue": "#fb7185",
  "supply-issue": "#fb923c",
};

// ---------- Layout (Single-Flower Tab-View) ----------

const ASSEMBLY_W = 240;
const ASSEMBLY_H = 200;
const COMP_W = 180;
const COMP_H = 170;
const PETAL_RADIUS = 340;
const FLOWER_CENTER = { x: 0, y: 0 };

// ---------- Catalog-Container ----------

export function ArticleCatalog() {
  const snap = useAgentState();
  const articleCatalog = pickArticleCatalog(snap, defaultArticleCatalog);
  const [selectedId, setSelectedId] = useState<string | null>(
    articleCatalog[0]?.articleId ?? null,
  );
  const selected = selectedId
    ? articleCatalog.find((a) => a.articleId === selectedId)
    : null;

  return (
    <div className="absolute inset-0 flex flex-col p-8 pointer-events-none">
      <div className="pointer-events-auto mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Engineering
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">Articles · Designs</h1>
        <div className="text-sm text-zinc-600">
          {articleCatalog.length} Articles · BOM with assembly flowers
        </div>
      </div>

      <div className="flex-1 pointer-events-auto min-h-0 grid grid-cols-[280px_1fr] gap-6">
        <div className="overflow-y-auto pr-2 space-y-2">
          {articleCatalog.map((a) => (
            <ArticleCard
              key={a.articleId}
              article={a}
              selected={a.articleId === selectedId}
              onClick={() => setSelectedId(a.articleId)}
            />
          ))}
        </div>

        <div className="relative border border-zinc-300/70 rounded-xl bg-white/40 backdrop-blur-[2px] shadow-sm overflow-hidden">
          {selected ? (
            <BomCanvas article={selected} />
          ) : (
            <EmptyHint />
          )}
        </div>
      </div>
    </div>
  );
}

function ArticleCard({
  article,
  selected,
  onClick,
}: {
  article: ArticleInfo;
  selected: boolean;
  onClick: () => void;
}) {
  const flagged = article.assemblies
    .flatMap((a) => a.components)
    .filter((c) => c.flag).length;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-3 flex items-center gap-3 transition shadow-sm ${
        selected
          ? "border-amber-500 bg-amber-50 ring-2 ring-amber-300/60"
          : "border-zinc-300 bg-white hover:bg-amber-50/50 hover:border-amber-400"
      }`}
    >
      <img
        src={`${TWEMOJI_BASE}/${article.emojiCode}.svg`}
        alt=""
        width={36}
        height={36}
        draggable={false}
        className="select-none drop-shadow-sm shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-mono text-zinc-500">
          {article.articleId}
        </div>
        <div className="text-sm font-semibold text-zinc-900 leading-tight truncate">
          {article.name}
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">
          {article.bomId} v{article.bomVersion} · {article.assemblies.length}{" "}
          assemblies
        </div>
      </div>
      {flagged > 0 && (
        <div className="shrink-0 rounded-full bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5">
          {flagged} ⚠
        </div>
      )}
    </button>
  );
}

function EmptyHint() {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-zinc-400 text-sm">
      Choose an article on the left.
    </div>
  );
}

// ---------- BOM Canvas (React Flow, Flower-Layout) ----------

type AssemblyNodeData = {
  assemblyName: string;
  bomNodeId: string;
  componentCount: number;
  flagCount: number;
  emojiCode: string;
};

type ComponentNodeData = BomComponent;

type BomNode =
  | Node<AssemblyNodeData, "bomAssembly">
  | Node<ComponentNodeData, "bomComponent">;

type Side = "top" | "right" | "bottom" | "left";
const OPPOSITE: Record<Side, Side> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left",
};

function sideForAngle(angle: number): Side {
  // Angle: 0 = right, π/2 = down, π = left, -π/2 = up.
  // Normalize to [-π, π].
  const a = Math.atan2(Math.sin(angle), Math.cos(angle));
  if (a >= -Math.PI / 4 && a < Math.PI / 4) return "right";
  if (a >= Math.PI / 4 && a < (3 * Math.PI) / 4) return "bottom";
  if (a >= (3 * Math.PI) / 4 || a < -(3 * Math.PI) / 4) return "left";
  return "top";
}

function buildBomFlow(
  article: ArticleInfo,
  assemblyIndex: number,
): {
  nodes: BomNode[];
  edges: Edge[];
} {
  const asm = article.assemblies[assemblyIndex];
  if (!asm) return { nodes: [], edges: [] };

  const nodes: BomNode[] = [];
  const edges: Edge[] = [];
  const cx = FLOWER_CENTER.x;
  const cy = FLOWER_CENTER.y;
  const assemblyId = `asm-${asm.bomNodeId}`;
  const flagCount = asm.components.filter((c) => c.flag).length;

  nodes.push({
    id: assemblyId,
    type: "bomAssembly",
    position: { x: cx - ASSEMBLY_W / 2, y: cy - ASSEMBLY_H / 2 },
    data: {
      assemblyName: asm.name,
      bomNodeId: asm.bomNodeId,
      componentCount: asm.components.length,
      flagCount,
      emojiCode: emojiForAssembly(asm.name),
    },
  });

  asm.components.forEach((c, j) => {
    const angle = (2 * Math.PI * j) / asm.components.length - Math.PI / 2;
    const px = cx + PETAL_RADIUS * Math.cos(angle);
    const py = cy + PETAL_RADIUS * Math.sin(angle);
    const compId = `comp-${c.bomNodeId}`;
    const asmSide = sideForAngle(angle);
    const compSide = OPPOSITE[asmSide];

    nodes.push({
      id: compId,
      type: "bomComponent",
      position: { x: px - COMP_W / 2, y: py - COMP_H / 2 },
      data: c,
    });

    const stroke = c.flag ? FLAG_EDGE[c.flag] : "#71717a";
    edges.push({
      id: `${assemblyId}->${compId}`,
      source: assemblyId,
      sourceHandle: `assembly-${asmSide}`,
      target: compId,
      targetHandle: `comp-${compSide}`,
      style: { stroke, strokeWidth: c.flag ? 2.5 : 1.5 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
        width: 18,
        height: 18,
      },
    });
  });

  return { nodes, edges };
}

function BomCanvas({ article }: { article: ArticleInfo }) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Beim Article-Wechsel: Tab zurück auf erste Baugruppe — bevorzugt eine mit Flags.
  useEffect(() => {
    const firstFlagged = article.assemblies.findIndex((a) =>
      a.components.some((c) => c.flag),
    );
    setActiveIndex(firstFlagged >= 0 ? firstFlagged : 0);
  }, [article.articleId, article.assemblies]);

  const safeIndex = Math.min(activeIndex, article.assemblies.length - 1);

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-zinc-200/70 bg-white/60 backdrop-blur-[2px] flex items-center gap-2 overflow-x-auto">
        {article.assemblies.map((asm, i) => {
          const flags = asm.components.filter((c) => c.flag).length;
          const active = i === safeIndex;
          return (
            <button
              key={asm.bomNodeId}
              onClick={() => setActiveIndex(i)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 border transition ${
                active
                  ? "bg-amber-500 text-white border-amber-500 shadow"
                  : "bg-white text-zinc-700 border-zinc-300 hover:border-amber-400 hover:bg-amber-50"
              }`}
            >
              <span>{asm.name}</span>
              <span
                className={`text-[10px] font-mono ${
                  active ? "text-amber-100" : "text-zinc-500"
                }`}
              >
                {asm.components.length}
              </span>
              {flags > 0 && (
                <span
                  className={`min-w-[18px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                    active
                      ? "bg-white text-rose-600"
                      : "bg-rose-500 text-white"
                  }`}
                >
                  {flags}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 relative min-h-0">
        <ReactFlowProvider>
          <BomCanvasInner article={article} assemblyIndex={safeIndex} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

function BomCanvasInner({
  article,
  assemblyIndex,
}: {
  article: ArticleInfo;
  assemblyIndex: number;
}) {
  const { nodes, edges } = useMemo(
    () => buildBomFlow(article, assemblyIndex),
    [article, assemblyIndex],
  );
  const rf = useReactFlow();

  useEffect(() => {
    const t = setTimeout(() => {
      rf.fitView({ padding: 0.18, duration: 350 });
    }, 30);
    return () => clearTimeout(t);
  }, [article.articleId, assemblyIndex, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={bomNodeTypes}
      edgeTypes={bomEdgeTypes}
      defaultEdgeOptions={{
        type: "bomGapped",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#71717a",
          width: 18,
          height: 18,
        },
      }}
      fitView
      fitViewOptions={{ padding: 0.18 }}
      proOptions={{ hideAttribution: true }}
      panOnDrag={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      minZoom={0.2}
      maxZoom={2}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={16}
        size={1}
        color="#e4e4e7"
      />
    </ReactFlow>
  );
}

// ---------- Node-Komponenten (gleicher Stil wie FlowNode) ----------

function BomAssemblyNode({ data }: NodeProps) {
  const d = data as AssemblyNodeData;
  const hasFlag = d.flagCount > 0;
  return (
    <div
      className="relative select-none"
      style={{ width: ASSEMBLY_W, height: ASSEMBLY_H }}
    >
      <Handle
        id="assembly-top"
        type="source"
        position={Position.Top}
        style={{ opacity: 0 }}
      />
      <Handle
        id="assembly-right"
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
      <Handle
        id="assembly-bottom"
        type="source"
        position={Position.Bottom}
        style={{ opacity: 0 }}
      />
      <Handle
        id="assembly-left"
        type="source"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <div className="w-full h-full flex flex-col items-center text-center pt-1">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">
          Baugruppe
        </div>
        <div className="text-base font-bold text-zinc-900 leading-tight mt-0.5 px-2">
          {d.assemblyName}
        </div>
        <div className="relative mt-1">
          <img
            src={`${TWEMOJI_BASE}/${d.emojiCode}.svg`}
            alt=""
            width={104}
            height={104}
            draggable={false}
            className="select-none drop-shadow-sm"
          />
          <div
            className={`absolute -top-1 -right-2 min-w-[34px] h-8 px-2 rounded-full flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white ${
              hasFlag ? "bg-rose-500 text-white" : "bg-zinc-200 text-zinc-500"
            }`}
          >
            {hasFlag ? `${d.flagCount}⚠` : d.componentCount}
          </div>
        </div>
        <div className="text-[11px] font-mono text-zinc-500 mt-1">
          {d.bomNodeId}
        </div>
      </div>
    </div>
  );
}

function BomComponentNode({ data }: NodeProps) {
  const d = data as ComponentNodeData;
  const flagged = !!d.flag;
  const ringClass = flagged ? FLAG_RING[d.flag!] : "";
  return (
    <div
      className={`relative select-none rounded-2xl bg-white border border-zinc-200 shadow-sm ${ringClass}`}
      style={{ width: COMP_W, height: COMP_H }}
      title={flagged ? FLAG_LABEL[d.flag!] : undefined}
    >
      <Handle
        id="comp-top"
        type="target"
        position={Position.Top}
        style={{ opacity: 0 }}
      />
      <Handle
        id="comp-right"
        type="target"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
      <Handle
        id="comp-bottom"
        type="target"
        position={Position.Bottom}
        style={{ opacity: 0 }}
      />
      <Handle
        id="comp-left"
        type="target"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <div className="w-full h-full flex flex-col items-center text-center px-2 pt-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {d.commodity}
        </div>
        <div className="relative mt-0.5">
          <img
            src={`${TWEMOJI_BASE}/${emojiForCommodity(d.commodity)}.svg`}
            alt=""
            width={68}
            height={68}
            draggable={false}
            className="select-none drop-shadow-sm"
          />
          <div
            className={`absolute -top-1 -right-2 min-w-[32px] h-7 px-2 rounded-full flex items-center justify-center text-xs font-bold shadow ring-2 ring-white ${
              flagged ? FLAG_BADGE[d.flag!] : "bg-zinc-200 text-zinc-700"
            }`}
          >
            {d.findNumber}
          </div>
        </div>
        <div className="text-xs font-semibold text-zinc-800 leading-tight mt-1 px-1 line-clamp-1">
          {d.partTitle}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
          {d.partNumber}
        </div>
      </div>
    </div>
  );
}

const bomNodeTypes = {
  bomAssembly: BomAssemblyNode,
  bomComponent: BomComponentNode,
};

// Gerade Edge mit Lücke an Source und Target — damit Pfeil + Linie nicht direkt
// am Node anliegen, sondern visuell "Atemraum" haben.
const SOURCE_GAP_PX = 8;
const TARGET_GAP_PX = 14;

function BomGappedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style,
  markerEnd,
}: EdgeProps) {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const len = Math.hypot(dx, dy);
  if (len < SOURCE_GAP_PX + TARGET_GAP_PX + 1) {
    return null;
  }
  const ux = dx / len;
  const uy = dy / len;
  const sx = sourceX + ux * SOURCE_GAP_PX;
  const sy = sourceY + uy * SOURCE_GAP_PX;
  const tx = targetX - ux * TARGET_GAP_PX;
  const ty = targetY - uy * TARGET_GAP_PX;
  return (
    <BaseEdge
      id={id}
      path={`M ${sx} ${sy} L ${tx} ${ty}`}
      style={style}
      markerEnd={markerEnd}
    />
  );
}

const bomEdgeTypes = {
  bomGapped: BomGappedEdge,
};
