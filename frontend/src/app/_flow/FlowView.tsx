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
  type TopFlowNode,
} from "./flow-data";
import { edgeTypes } from "./flow-edges";
import { nodeTypes } from "./flow-nodes";

const OVERVIEW_PADDING = 0.15;
const SUB_FLOW_PADDING = 0.2;
const FOCUS_PADDING = 0.3;
const ZOOM_DURATION = 500;
const EDGE_COLOR = "#71717a";

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
      const sub = subFlows[node.id];
      if (!sub) return;

      setFocusedId(node.id);
      setNodes((prev) =>
        prev.map((n) =>
          n.id === node.id
            ? n
            : { ...n, style: { ...(n.style ?? {}), opacity: 0 } },
        ),
      );
      setEdges((prev) =>
        prev.map((e) => ({
          ...e,
          style: { ...(e.style ?? {}), opacity: 0 },
        })),
      );
      reactFlow.fitView({
        nodes: [{ id: node.id }],
        duration: ZOOM_DURATION,
        padding: FOCUS_PADDING,
      });

      setTimeout(() => {
        setNodes(sub.nodes);
        setEdges(sub.edges);
        setViewMode("sub-flow");
        requestAnimationFrame(() => {
          reactFlow.fitView({
            duration: ZOOM_DURATION,
            padding: SUB_FLOW_PADDING,
          });
        });
      }, ZOOM_DURATION);
    },
    [focusedId, reactFlow, setNodes, setEdges],
  );

  const onBack = useCallback(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    setViewMode("overview");
    setFocusedId(null);
    requestAnimationFrame(() => {
      reactFlow.fitView({
        duration: ZOOM_DURATION,
        padding: OVERVIEW_PADDING,
      });
    });
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
