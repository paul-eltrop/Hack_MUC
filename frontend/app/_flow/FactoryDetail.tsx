"use client";

import { useEffect, useMemo } from "react";
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
  factoryDetails,
  type FactoryDetailData,
  type FactorySection,
  type FactorySectionType,
  type SectionCaseFlag,
} from "./flow-data";
import { TWEMOJI_BASE } from "./flow-nodes";
import { useAgentState } from "./agent-state";
import { pickFactoryDetail } from "./applyAgentState";

// ---------- Layout-Konstanten ----------

const SECTION_W = 200;
const SECTION_H = 150;
const SECTION_GAP_X = 100; // Pfeil-Atemraum zwischen Sections
const LINE_PADDING_X = 32;
const LINE_HEADER_H = 56;
const LINE_PADDING_BOTTOM = 90; // Platz für optionalen caseFlag-Banner unter Sections
const LINE_GAP_Y = 60;

const LINE_INNER_W =
  3 * SECTION_W + 2 * SECTION_GAP_X; // = 800
const LINE_W = LINE_INNER_W + 2 * LINE_PADDING_X; // = 864
const LINE_H = LINE_HEADER_H + SECTION_H + LINE_PADDING_BOTTOM; // = 296

// ---------- Twemoji pro section_type ----------

const SECTION_EMOJI: Record<FactorySectionType, string> = {
  montage: "1f6e0", // 🛠 hammer + wrench
  pruefung: "1f9ea", // 🧪 test tube
  verpackung: "1f4e6", // 📦 package
};

const SECTION_TINT: Record<FactorySectionType, string> = {
  montage: "bg-sky-50 border-sky-300",
  pruefung: "bg-violet-50 border-violet-300",
  verpackung: "bg-emerald-50 border-emerald-300",
};

const SECTION_LABEL: Record<FactorySectionType, string> = {
  montage: "Montage",
  pruefung: "Prüfung",
  verpackung: "Verpackung",
};

// ---------- Container ----------

type Props = { factoryId: string };

export function FactoryDetail({ factoryId }: Props) {
  const snap = useAgentState();
  const data = pickFactoryDetail(snap, factoryId, factoryDetails[factoryId]);
  if (!data) return null;
  return (
    <div className="absolute inset-0 flex flex-col p-8 pointer-events-none">
      <div className="pointer-events-auto mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Factory
        </div>
        <h1 className="text-2xl font-bold text-zinc-900">{data.name}</h1>
        <div className="text-sm text-zinc-600">
          {data.factoryId} · {data.country} · {data.siteCode} ·{" "}
          {data.lines.length} Linien ·{" "}
          {data.lines.reduce((n, l) => n + l.sections.length, 0)} Sections
        </div>
      </div>

      <div className="flex-1 pointer-events-auto min-h-0 relative border border-zinc-300/70 rounded-xl bg-white/40 backdrop-blur-[2px] shadow-sm overflow-hidden">
        <ReactFlowProvider>
          <FactoryCanvas data={data} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}

// ---------- React-Flow-Canvas ----------

function buildFactoryFlow(data: FactoryDetailData): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  data.lines.forEach((line, lineIdx) => {
    const lineY = lineIdx * (LINE_H + LINE_GAP_Y);
    const lineNodeId = `line-${line.lineId}`;

    nodes.push({
      id: lineNodeId,
      type: "factoryLine",
      position: { x: 0, y: lineY },
      style: { width: LINE_W, height: LINE_H },
      data: {
        lineId: line.lineId,
        lineName: line.name,
        lineType: line.lineType,
        area: line.area,
        sectionCount: line.sections.length,
      },
      selectable: false,
      draggable: false,
    });

    line.sections.forEach((section, secIdx) => {
      const sx = LINE_PADDING_X + secIdx * (SECTION_W + SECTION_GAP_X);
      const sy = LINE_HEADER_H;
      const secNodeId = `section-${section.sectionId}`;

      nodes.push({
        id: secNodeId,
        type: "factorySection",
        position: { x: sx, y: sy },
        parentId: lineNodeId,
        extent: "parent",
        data: section,
        selectable: false,
        draggable: false,
      });

      if (secIdx > 0) {
        const prevSecId = `section-${line.sections[secIdx - 1].sectionId}`;
        edges.push({
          id: `${prevSecId}->${secNodeId}`,
          source: prevSecId,
          sourceHandle: "section-right",
          target: secNodeId,
          targetHandle: "section-left",
        });
      }
    });
  });

  return { nodes, edges };
}

function FactoryCanvas({ data }: { data: FactoryDetailData }) {
  const { nodes, edges } = useMemo(() => buildFactoryFlow(data), [data]);
  const rf = useReactFlow();

  useEffect(() => {
    const t = setTimeout(() => {
      rf.fitView({ padding: 0.12, duration: 350 });
    }, 30);
    return () => clearTimeout(t);
  }, [data.factoryId, rf]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={factoryNodeTypes}
      edgeTypes={factoryEdgeTypes}
      defaultEdgeOptions={{
        type: "factoryGapped",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#71717a",
          width: 18,
          height: 18,
        },
        style: { stroke: "#71717a", strokeWidth: 1.6 },
      }}
      fitView
      fitViewOptions={{ padding: 0.12 }}
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

// ---------- Node-Komponenten ----------

type LineNodeData = {
  lineId: string;
  lineName: string;
  lineType: string;
  area: string;
  sectionCount: number;
};

function FactoryLineNode({ data }: NodeProps) {
  const d = data as LineNodeData;
  return (
    <div className="w-full h-full rounded-2xl border-2 border-zinc-300 bg-zinc-50/50 relative">
      <div className="absolute -top-3 left-5 px-3 py-0.5 bg-white rounded-full text-xs font-semibold text-zinc-700 border border-zinc-300 shadow-sm flex items-center gap-1.5">
        <span className="font-mono text-[10px] text-zinc-500">{d.lineId}</span>
        <span>·</span>
        <span>{d.lineName}</span>
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">
          {d.lineType}
        </span>
        <span className="text-[10px] text-zinc-500">· {d.area}</span>
      </div>
    </div>
  );
}

function FactorySectionNode({ data }: NodeProps) {
  const d = data as FactorySection;
  const tint = SECTION_TINT[d.sectionType];
  const hasTests = d.testCount > 0;
  const flag = d.caseFlag;
  return (
    <div
      className="relative select-none"
      style={{ width: SECTION_W, height: SECTION_H }}
    >
      <Handle
        id="section-left"
        type="target"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <Handle
        id="section-right"
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
      <div
        className={`w-full h-full rounded-2xl border-2 shadow-sm ${tint} ${
          flag ? "ring-4 ring-rose-400/70" : ""
        } flex flex-col items-center text-center pt-2 px-2`}
      >
        <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          {SECTION_LABEL[d.sectionType]}
        </div>
        <div className="text-sm font-bold text-zinc-900 leading-tight mt-0.5">
          {d.name}
        </div>
        <div className="relative mt-1">
          <img
            src={`${TWEMOJI_BASE}/${SECTION_EMOJI[d.sectionType]}.svg`}
            alt=""
            width={56}
            height={56}
            draggable={false}
            className="select-none drop-shadow-sm"
          />
          {hasTests && (
            <div className="absolute -top-1 -right-2 min-w-[28px] h-6 px-1.5 rounded-full flex items-center justify-center text-[11px] font-bold shadow ring-2 ring-white bg-violet-500 text-white">
              {d.testCount}🧪
            </div>
          )}
          {flag && (
            <div className="absolute -top-2 -left-2 w-7 h-7 rounded-full flex items-center justify-center text-sm shadow ring-2 ring-white bg-rose-500 text-white font-bold">
              ⚠
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono text-zinc-500 mt-1">
          {d.sectionId} · seq {d.sequenceNo}
        </div>
      </div>
      {flag && <CaseFlagBanner flag={flag} />}
    </div>
  );
}

function CaseFlagBanner({ flag }: { flag: SectionCaseFlag }) {
  return (
    <div
      className="absolute left-0 right-0 mt-2 rounded-lg bg-rose-500 text-white shadow-md px-2.5 py-1.5 leading-tight"
      style={{ top: "100%" }}
      title={flag.detail}
    >
      <div className="text-[9px] font-bold uppercase tracking-widest opacity-80">
        {flag.kind === "process" ? "Process Issue" : "Operator Issue"}
      </div>
      <div className="text-[11px] font-semibold mt-0.5 line-clamp-2">
        {flag.title}
      </div>
    </div>
  );
}

const factoryNodeTypes = {
  factoryLine: FactoryLineNode,
  factorySection: FactorySectionNode,
};

// ---------- Edge mit Gap (kopiert aus ArticleCatalog-Pattern) ----------

const SOURCE_GAP_PX = 8;
const TARGET_GAP_PX = 14;

function FactoryGappedEdge({
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
  if (len < SOURCE_GAP_PX + TARGET_GAP_PX + 1) return null;
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

const factoryEdgeTypes = {
  factoryGapped: FactoryGappedEdge,
};
