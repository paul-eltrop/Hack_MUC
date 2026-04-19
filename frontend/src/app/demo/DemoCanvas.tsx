"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";

import "@xyflow/react/dist/style.css";
import {
  initialEdges,
  initialNodes,
  type FlowNode,
} from "./flow-data";
import { nodeTypes } from "./flow-nodes";

function Inner() {
  const [nodes, , onNodesChange] = useNodesState<FlowNode>(initialNodes);
  const [edges] = useEdgesState<Edge>(initialEdges);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onNodeClick: NodeMouseHandler = useCallback((_, clicked) => {
    setSelectedId((prev) => (prev === clicked.id ? null : clicked.id));
  }, []);

  const styledEdges = useMemo<Edge[]>(() => {
    if (!selectedId) return edges;
    return edges.map((e) => {
      const active = e.source === selectedId || e.target === selectedId;
      return {
        ...e,
        animated: active || e.animated,
        style: {
          ...(e.style ?? {}),
          stroke: active ? "#111" : "#d4d4d8",
          strokeWidth: active ? 2.5 : 1,
        },
        labelStyle: { fontSize: 11, fill: active ? "#111" : "#a1a1aa" },
      };
    });
  }, [edges, selectedId]);

  const styledNodes = useMemo<FlowNode[]>(() => {
    if (!selectedId) return nodes;
    const connected = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) connected.add(e.target);
      if (e.target === selectedId) connected.add(e.source);
    });
    return nodes.map((n) => ({
      ...n,
      style: {
        ...(n.style ?? {}),
        opacity: connected.has(n.id) ? 1 : 0.25,
      },
    }));
  }, [nodes, edges, selectedId]);

  return (
    <div className="fixed inset-0 bg-zinc-50">
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => setSelectedId(null)}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        preventScrolling={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#d4d4d8"
        />
      </ReactFlow>
    </div>
  );
}

export default function DemoCanvas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
