import type { Edge, Node } from "@xyflow/react";

export type NodeKind =
  | "supplier"
  | "batch"
  | "part"
  | "machine"
  | "product"
  | "defect"
  | "claim"
  | "test"
  | "action";

export type FlowNodeData = {
  kind: NodeKind;
  label: string;
  sub?: string;
  meta?: string;
};

export type FlowNode = Node<FlowNodeData>;

export const initialNodes: FlowNode[] = [
  {
    id: "sup-acme",
    type: "entity",
    position: { x: 40, y: 60 },
    data: { kind: "supplier", label: "ACME Metals", sub: "Supplier · DE-72" },
  },
  {
    id: "batch-774",
    type: "entity",
    position: { x: 320, y: 60 },
    data: { kind: "batch", label: "Batch B-774", sub: "Shipped 2026-04-02" },
  },
  {
    id: "part-2042",
    type: "entity",
    position: { x: 600, y: 60 },
    data: {
      kind: "part",
      label: "Part P-2042",
      sub: "Housing Bracket",
      meta: "Cpk 0.87",
    },
  },
  {
    id: "machine-m3",
    type: "entity",
    position: { x: 600, y: 260 },
    data: {
      kind: "machine",
      label: "Section M-3",
      sub: "Welding Station",
      meta: "OEE 82%",
    },
  },
  {
    id: "product-x",
    type: "entity",
    position: { x: 900, y: 60 },
    data: {
      kind: "product",
      label: "Product PRD-X",
      sub: "eDrive Module v2",
    },
  },
  {
    id: "defect-9912",
    type: "entity",
    position: { x: 900, y: 260 },
    data: {
      kind: "defect",
      label: "Defect #9912",
      sub: "Weld porosity",
      meta: "Severity 4",
    },
  },
  {
    id: "test-5531",
    type: "entity",
    position: { x: 1200, y: 60 },
    data: {
      kind: "test",
      label: "Test T-5531",
      sub: "Leak check",
      meta: "Fail rate 7.2%",
    },
  },
  {
    id: "claim-4481",
    type: "entity",
    position: { x: 1200, y: 260 },
    data: {
      kind: "claim",
      label: "Field Claim F-4481",
      sub: "Customer: Delta-Auto",
      meta: "3 units affected",
    },
  },
];

export const initialEdges: Edge[] = [
  {
    id: "e1",
    source: "sup-acme",
    target: "batch-774",
    label: "shipped",
    animated: true,
  },
  { id: "e2", source: "batch-774", target: "part-2042", label: "contains" },
  { id: "e3", source: "part-2042", target: "product-x", label: "bom" },
  { id: "e4", source: "machine-m3", target: "defect-9912", label: "detected" },
  { id: "e5", source: "part-2042", target: "defect-9912", label: "on part" },
  { id: "e6", source: "product-x", target: "test-5531", label: "validated by" },
  {
    id: "e7",
    source: "product-x",
    target: "claim-4481",
    label: "claim on",
    animated: true,
  },
  {
    id: "e8",
    source: "defect-9912",
    target: "claim-4481",
    label: "suspected cause",
    style: { stroke: "#ef4444", strokeDasharray: "6 4" },
  },
];

export const paletteStickers: Array<{
  kind: "containment" | "corrective" | "preventive";
  label: string;
  emoji: string;
  color: string;
}> = [
  {
    kind: "containment",
    label: "Containment (D3)",
    emoji: "🚫",
    color: "bg-amber-100 text-amber-900 border-amber-400",
  },
  {
    kind: "corrective",
    label: "Corrective (D5)",
    emoji: "🔄",
    color: "bg-blue-100 text-blue-900 border-blue-400",
  },
  {
    kind: "preventive",
    label: "Preventive (D7)",
    emoji: "🛡️",
    color: "bg-emerald-100 text-emerald-900 border-emerald-400",
  },
];
