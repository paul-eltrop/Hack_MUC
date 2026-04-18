import type { Edge, Node } from "@xyflow/react";

export type FlowKind = "supplier" | "factory" | "field";

export type BatchInfo = {
  id: string;
  batchNumber: string;
  partNumber: string;
  partTitle: string;
  receivedDate: string;
  qty: number;
  status: "ok" | "suspect" | "bad";
  events: number;
};

export type FlowNodeData = {
  kind: FlowKind;
  title: string;
  subtitle?: string;
  emojiCode: string;
  errorCount: number;
  /** Default `true`. Set to `false` um Zoom-In + Sub-Flow für diesen Node zu deaktivieren. */
  zoomable?: boolean;
  /** Intern: triggert Disappear-Animation während des Swaps. */
  _disappearing?: boolean;
  /** Intern: triggert Pop-In-Animation beim Mount (für Back-Animation). */
  _entering?: boolean;
  /** Intern: nur für Bg-Node — triggert Reverse-Skalierung zu 0. */
  _reversing?: boolean;
  batches?: BatchInfo[];
  country?: string;
  bgColor?: string;
};

export type TopFlowNode = Node<FlowNodeData>;

const COL_X = { supplier: 40, augsburg: 440, dresden: 740, field: 1040 };

const elektropartsBatches: BatchInfo[] = [
  {
    id: "SB-00008",
    batchNumber: "B00008",
    partNumber: "PM-00008",
    partTitle: "Kondensator 100uF X7R",
    receivedDate: "2025-11-10",
    qty: 800,
    status: "bad",
    events: 18,
  },
  {
    id: "SB-00009",
    batchNumber: "B00009",
    partNumber: "PM-00008",
    partTitle: "Kondensator 100uF X7R",
    receivedDate: "2026-02-03",
    qty: 600,
    status: "bad",
    events: 19,
  },
  {
    id: "SB-00010",
    batchNumber: "B00010",
    partNumber: "PM-00008",
    partTitle: "Kondensator 100uF X7R",
    receivedDate: "2026-03-01",
    qty: 400,
    status: "suspect",
    events: 0,
  },
  {
    id: "SB-00001",
    batchNumber: "B00001",
    partNumber: "PM-00001",
    partTitle: "Kondensator 10uF 16V",
    receivedDate: "2025-09-15",
    qty: 500,
    status: "ok",
    events: 0,
  },
  {
    id: "SB-00006",
    batchNumber: "B00006",
    partNumber: "PM-00006",
    partTitle: "Mikrocontroller STM32F4",
    receivedDate: "2025-10-15",
    qty: 200,
    status: "ok",
    events: 0,
  },
  {
    id: "SB-00007",
    batchNumber: "B00007",
    partNumber: "PM-00007",
    partTitle: "Spannungsregler LM7805",
    receivedDate: "2025-11-01",
    qty: 250,
    status: "ok",
    events: 0,
  },
  {
    id: "SB-00019",
    batchNumber: "B00019",
    partNumber: "PM-00017",
    partTitle: "Relais 12V SPDT",
    receivedDate: "2025-11-05",
    qty: 200,
    status: "ok",
    events: 0,
  },
];

export const initialNodes: TopFlowNode[] = [
  {
    id: "sup-01",
    type: "flow",
    position: { x: COL_X.supplier, y: 20 },
    data: {
      kind: "supplier",
      title: "ElektroParts GmbH",
      subtitle: "SUP-01 · 7 Batches",
      emojiCode: "1f3ed",
      errorCount: 1,
      country: "DE",
      batches: elektropartsBatches,
    },
  },
  {
    id: "sup-02",
    type: "flow",
    position: { x: COL_X.supplier, y: 210 },
    data: {
      kind: "supplier",
      title: "Mechanik-Werk AG",
      subtitle: "SUP-02 · 4 Batches",
      emojiCode: "1f3ed",
      errorCount: 0,
      country: "DE",
    },
  },
  {
    id: "sup-03",
    type: "flow",
    position: { x: COL_X.supplier, y: 400 },
    data: {
      kind: "supplier",
      title: "TechSupply Europe",
      subtitle: "SUP-03 · 6 Batches",
      emojiCode: "1f3ed",
      errorCount: 0,
      country: "NL",
    },
  },
  {
    id: "sup-04",
    type: "flow",
    position: { x: COL_X.supplier, y: 590 },
    data: {
      kind: "supplier",
      title: "PartStream Industries",
      subtitle: "SUP-04 · 5 Batches",
      emojiCode: "1f3ed",
      errorCount: 0,
      country: "IT",
    },
  },
  {
    id: "fac-aug",
    type: "flow",
    position: { x: COL_X.augsburg, y: 305 },
    data: {
      kind: "factory",
      title: "Werk Augsburg",
      subtitle: "FAC-00001 · Assembly",
      emojiCode: "1f527",
      errorCount: 2,
    },
  },
  {
    id: "fac-dre",
    type: "flow",
    position: { x: COL_X.dresden, y: 305 },
    data: {
      kind: "factory",
      title: "Werk Dresden",
      subtitle: "FAC-00002 · Test & Packaging",
      emojiCode: "1f9ea",
      errorCount: 1,
    },
  },
  {
    id: "field",
    type: "flow",
    position: { x: COL_X.field, y: 305 },
    data: {
      kind: "field",
      title: "Kunden",
      subtitle: "7 Märkte · 40 Claims",
      emojiCode: "1f30d",
      errorCount: 0,
    },
  },
];

const supplierIds = ["sup-01", "sup-02", "sup-03", "sup-04"];

export const initialEdges: Edge[] = [
  ...supplierIds.map<Edge>((id) => ({
    id: `${id}->fac-aug`,
    source: id,
    target: "fac-aug",
    label: "liefert",
  })),
  {
    id: "fac-aug->fac-dre",
    source: "fac-aug",
    target: "fac-dre",
    label: "montiert",
  },
  {
    id: "fac-dre->field",
    source: "fac-dre",
    target: "field",
    label: "versendet",
  },
];

// --- Sub-Flow Platzhalter ---
// Echten Content (Batches für Supplier, Sections für Factory, Märkte für Field)
// in separater Iteration ersetzen. Shape bleibt TopFlowNode, damit dieselben
// nodeTypes/edgeTypes ohne Anpassung greifen.

export type SubFlow = { nodes: TopFlowNode[]; edges: Edge[] };

function placeholderSubFlow(parentId: string, parentTitle: string): SubFlow {
  const id = (n: number) => `${parentId}-sub-${n}`;
  // 3 Mini-Nodes (60×60) horizontal: Gesamt-Footprint 220×60, passt in 1 Main-Node.
  const makeNode = (n: number, x: number): TopFlowNode => ({
    id: id(n),
    type: "flowMini",
    position: { x, y: 0 },
    data: {
      kind: "supplier",
      title: `Sub ${String.fromCharCode(64 + n)}`,
      subtitle: parentTitle,
      emojiCode: "1f4e6",
      errorCount: 0,
    },
  });
  return {
    nodes: [makeNode(1, 0), makeNode(2, 80), makeNode(3, 160)],
    edges: [
      { id: `${id(1)}->${id(2)}`, source: id(1), target: id(2) },
      { id: `${id(2)}->${id(3)}`, source: id(2), target: id(3) },
    ],
  };
}

export const subFlows: Record<string, SubFlow> = {
  "sup-01": placeholderSubFlow("sup-01", "ElektroParts GmbH"),
  "sup-02": placeholderSubFlow("sup-02", "Mechanik-Werk AG"),
  "sup-03": placeholderSubFlow("sup-03", "TechSupply Europe"),
  "sup-04": placeholderSubFlow("sup-04", "PartStream Industries"),
  "fac-aug": placeholderSubFlow("fac-aug", "Werk Augsburg"),
  "fac-dre": placeholderSubFlow("fac-dre", "Werk Dresden"),
  field: placeholderSubFlow("field", "Kunden"),
};
