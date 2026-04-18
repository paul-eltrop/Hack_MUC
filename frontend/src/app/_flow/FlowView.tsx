"use client";

import { useCallback, useState } from "react";
import {
  Background,
  BackgroundVariant,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import {
  initialEdges,
  initialNodes,
  subFlows,
  type FlowNodeData,
  type TopFlowNode,
} from "./flow-data";
import { edgeTypes } from "./flow-edges";
import { BG_W, NODE_H, NODE_W, nodeSize, nodeTypes } from "./flow-nodes";

const OVERVIEW_PADDING = 0.15;
const SUB_FLOW_PADDING = 0.2;
const ZOOM_DURATION = 500;
const EDGE_COLOR = "#71717a";

// Overview-Bounds ein mal vorberechnet (statisch, basiert auf initialNodes-Positionen).
// Wird fürs Zoom-Out beim Back gebraucht, wenn die Overview-Nodes noch nicht
// wieder im State sind (erst ab Phase 2 des Reverse-Flows).
const OVERVIEW_BOUNDS = (() => {
  const xs = initialNodes.flatMap((n) => [
    n.position.x,
    n.position.x + NODE_W,
  ]);
  const ys = initialNodes.flatMap((n) => [
    n.position.y,
    n.position.y + NODE_H,
  ]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
})();

const defaultEdgeOptions = {
  type: "labeled",
  style: { stroke: EDGE_COLOR, strokeWidth: 1.5 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: EDGE_COLOR,
    width: 18,
    height: 18,
  },
};

type ViewMode = "overview" | "sub-flow";

function Inner() {
  const [nodes, setNodes, onNodesChange] =
    useNodesState<TopFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const reactFlow = useReactFlow();

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (focusedId !== null) return;
      const data = node.data as FlowNodeData;
      if (data.zoomable === false) return;
      const sub = subFlows[node.id];
      if (!sub) return;

      // Sub-Flow so verschieben, dass sein Bounding-Box-Center auf dem
      // geklickten Node landet — es fühlt sich an, als würde der Node selbst
      // zum Sub-Flow "aufklappen".
      const clickedCenterX = node.position.x + NODE_W / 2;
      const clickedCenterY = node.position.y + NODE_H / 2;
      const xs = sub.nodes.flatMap((n) => {
        const { w } = nodeSize(n.type);
        return [n.position.x, n.position.x + w];
      });
      const ys = sub.nodes.flatMap((n) => {
        const { h } = nodeSize(n.type);
        return [n.position.y, n.position.y + h];
      });
      const subMinX = Math.min(...xs);
      const subMaxX = Math.max(...xs);
      const subMinY = Math.min(...ys);
      const subMaxY = Math.max(...ys);
      const subWidth = subMaxX - subMinX;
      const subHeight = subMaxY - subMinY;
      const offsetX = clickedCenterX - (subMinX + subMaxX) / 2;
      const offsetY = clickedCenterY - (subMinY + subMaxY) / 2;
      const positionedSubNodes = sub.nodes.map((n) => ({
        ...n,
        position: {
          x: n.position.x + offsetX,
          y: n.position.y + offsetY,
        },
      }));

      // Bg-Node: Aspect-Ratio matched zur Bildschirmfläche, damit er bei
      // voller Skalierung den Viewport sauber abdeckt (nicht zu schmal/hoch).
      const bgAspect =
        typeof window !== "undefined"
          ? window.innerHeight / window.innerWidth
          : 9 / 16;
      const bgH = BG_W * bgAspect;
      const bgNode: TopFlowNode = {
        id: `${node.id}-bg`,
        type: "bg",
        position: {
          x: clickedCenterX - BG_W / 2,
          y: clickedCenterY - bgH / 2,
        },
        style: { width: BG_W, height: bgH },
        zIndex: -1,
        data: {
          kind: data.kind,
          title: "",
          emojiCode: "",
          errorCount: 0,
        },
      };

      setFocusedId(node.id);
      setNodes((prev) => [
        ...prev.map((n) => ({
          ...n,
          data: { ...n.data, _disappearing: true },
        })),
        bgNode,
      ]);
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          data: { ...(e.data ?? {}), _disappearing: true },
        })),
      );
      // Direkt auf das Region-Center zoomen, wo der Sub-Flow landen wird —
      // kein Rein-und-wieder-Raus-Yo-Yo. Bg-Node definiert den Container.
      reactFlow.fitBounds(
        {
          x: node.position.x,
          y: node.position.y,
          width: NODE_W,
          height: NODE_H,
        },
        { duration: ZOOM_DURATION, padding: SUB_FLOW_PADDING },
      );

      setTimeout(() => {
        setNodes([bgNode, ...positionedSubNodes]);
        setEdges(sub.edges);
        setViewMode("sub-flow");
      }, ZOOM_DURATION / 2);
    },
    [focusedId, reactFlow, setNodes, setEdges],
  );

  const onBack = useCallback(() => {
    // Phase 1: Minis wegploppen, Bg reverst, Kamera zoomt raus.
    setNodes((prev) =>
      prev.map((n) =>
        n.type === "bg"
          ? { ...n, data: { ...n.data, _reversing: true } }
          : { ...n, data: { ...n.data, _disappearing: true } },
      ),
    );
    setEdges((prev) =>
      prev.map((e) => ({
        ...e,
        data: { ...(e.data ?? {}), _disappearing: true },
      })),
    );
    // `fitBounds` mit den vorberechneten Overview-Bounds — die Overview-Nodes
    // sind in diesem Moment noch gar nicht im State (nur bg + minis), daher
    // können wir nicht `fitView({ nodes: [...] })` benutzen.
    reactFlow.fitBounds(OVERVIEW_BOUNDS, {
      duration: ZOOM_DURATION,
      padding: OVERVIEW_PADDING,
    });

    // Phase 2 (Halbzeit): Overview-Nodes und Edges gleichzeitig rein — Nodes
    // poppen, Edges faden. Stabil, da RF die Nodes gegen unscaled Outer misst.
    setTimeout(() => {
      setNodes((prev) => {
        const bg = prev.find((n) => n.type === "bg");
        const overview = initialNodes.map((n) => ({
          ...n,
          data: { ...n.data, _entering: true },
        }));
        return bg ? [bg, ...overview] : overview;
      });
      setEdges(
        initialEdges.map((e) => ({
          ...e,
          data: { ...(e.data ?? {}), _entering: true },
        })),
      );
      setViewMode("overview");
      setFocusedId(null);
    }, ZOOM_DURATION / 2);

    // Phase 3 (Bg fertig geschrumpft): clean final state ohne Bg und ohne Flags.
    setTimeout(() => {
      setNodes(initialNodes);
      setEdges(initialEdges);
    }, 1000);
  }, [reactFlow, setNodes, setEdges]);

  return (
    <div className="fixed inset-0 bg-zinc-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: OVERVIEW_PADDING }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        minZoom={0.1}
        maxZoom={4}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#d4d4d8"
        />
      </ReactFlow>
      {viewMode === "sub-flow" && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-10 px-3 py-2 bg-white border border-zinc-200 rounded-lg shadow-sm hover:bg-zinc-50 transition text-sm text-zinc-700 font-medium"
        >
          ← Zurück
        </button>
      )}
    </div>
  );
}

export default function FlowView() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
