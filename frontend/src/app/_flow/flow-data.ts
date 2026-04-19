import { MarkerType, type Edge, type Node } from "@xyflow/react";

export type FlowKind = "supplier" | "factory" | "field" | "design";

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

// --- Supplier-Detail-Modell (strukturell nah an DB: part_master, supplier_batch, part) ---

export type PartMasterInfo = {
  partNumber: string;
  title: string;
  commodity: string;
  emojiCode: string;
};

export type PartQualityStatus = "ok" | "hold" | "reject";

export type PartRow = {
  partId: string;
  serialNumber: string;
  qualityStatus: PartQualityStatus;
};

export type BatchSeverity = "ok" | "suspect" | "bad";

export type BatchRow = {
  batchId: string;
  batchNumber: string;
  partNumber: string;
  receivedDate: string;
  qty: number;
  parts: PartRow[];
};

export type SupplierDetailData = {
  supplierId: string;
  supplierName: string;
  country: string;
  partMasters: PartMasterInfo[];
  batches: BatchRow[];
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

const COL_X = { supplier: 40, factory: 540, field: 1040 };
const FACTORY_Y = { aug: 160, dre: 460 };

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
    position: { x: COL_X.factory, y: FACTORY_Y.aug },
    data: {
      kind: "factory",
      title: "Werk Augsburg",
      subtitle: "FAC-00001 · 2 Linien · 1.698 Installs",
      emojiCode: "1f527",
      errorCount: 2,
    },
  },
  {
    id: "fac-dre",
    type: "flow",
    position: { x: COL_X.factory, y: FACTORY_Y.dre },
    data: {
      kind: "factory",
      title: "Werk Dresden",
      subtitle: "FAC-00002 · 2 Linien · 1.302 Installs",
      emojiCode: "1f527",
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
  {
    id: "articles",
    type: "flow",
    position: { x: 820, y: 20 },
    data: {
      kind: "design",
      title: "Articles",
      subtitle: "5 Designs · BOMs",
      emojiCode: "1f4d0",
      errorCount: 0,
    },
  },
];

const supplierIds = ["sup-01", "sup-02", "sup-03", "sup-04"];
const factoryIds = ["fac-aug", "fac-dre"];

export const initialEdges: Edge[] = [
  // Beide Werke beziehen Material von allen Suppliern (Parts werden in beiden
  // Werken montiert — Augsburg und Dresden haben jeweils eigene Montage-Linien).
  ...supplierIds.flatMap((sid) =>
    factoryIds.map<Edge>((fid) => ({
      id: `${sid}->${fid}`,
      source: sid,
      sourceHandle: "right",
      target: fid,
      targetHandle: "left",
      label: "liefert",
    })),
  ),
  // Test-Pool zwischen den Werken: Produkte werden cross-werks getestet
  // (test_result.section_id zeigt, dass Produkte aus Werk A oft an Pruefung-
  // Sections in Werk B landen). Vertikal zwischen den vertikal gestapelten
  // Werken: Augsburg-bottom ↔ Dresden-top, Pfeile an beiden Enden.
  {
    id: "fac-aug<->fac-dre",
    source: "fac-aug",
    sourceHandle: "bottom",
    target: "fac-dre",
    targetHandle: "top",
    label: "tauschen",
    markerStart: {
      type: MarkerType.ArrowClosed,
      color: "#71717a",
      width: 18,
      height: 18,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: "#71717a",
      width: 18,
      height: 18,
    },
  },
  // Beide Werke versenden direkt an den Kunden (keine sequenzielle Pipeline).
  {
    id: "fac-aug->field",
    source: "fac-aug",
    sourceHandle: "right",
    target: "field",
    targetHandle: "left",
    label: "versendet",
  },
  {
    id: "fac-dre->field",
    source: "fac-dre",
    sourceHandle: "right",
    target: "field",
    targetHandle: "left",
    label: "versendet",
  },
  // Articles (Recipe-Layer): werks-agnostisch, aber konzeptuell "wird in beiden
  // Werken hergestellt". Gestrichelt, damit der Material-Flow optisch dominant
  // bleibt — die Articles sind eine orthogonale Dimension.
  {
    id: "articles->fac-aug",
    source: "articles",
    sourceHandle: "left",
    target: "fac-aug",
    targetHandle: "top",
    label: "wird hergestellt",
    style: { stroke: "#a1a1aa", strokeWidth: 1.2, strokeDasharray: "6 4" },
  },
  {
    id: "articles->fac-dre",
    source: "articles",
    sourceHandle: "left",
    target: "fac-dre",
    targetHandle: "top",
    label: "wird hergestellt",
    style: { stroke: "#a1a1aa", strokeWidth: 1.2, strokeDasharray: "6 4" },
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
  articles: placeholderSubFlow("articles", "Articles"),
};

// ============================================================
// Supplier-Detail: Katalog (PMs), Lieferungen (Batches), Parts
// ============================================================

const PART_MASTERS: Record<string, PartMasterInfo> = {
  "PM-00001": {
    partNumber: "PM-00001",
    title: "Kondensator 10µF 16V",
    commodity: "Kondensator",
    emojiCode: "1f50b",
  },
  "PM-00006": {
    partNumber: "PM-00006",
    title: "Mikrocontroller STM32F4",
    commodity: "IC",
    emojiCode: "1f9e0",
  },
  "PM-00007": {
    partNumber: "PM-00007",
    title: "Spannungsregler LM7805",
    commodity: "IC",
    emojiCode: "1f50c",
  },
  "PM-00008": {
    partNumber: "PM-00008",
    title: "Kondensator 100µF X7R",
    commodity: "Kondensator",
    emojiCode: "1f50b",
  },
  "PM-00017": {
    partNumber: "PM-00017",
    title: "Relais 12V SPDT",
    commodity: "Relais",
    emojiCode: "1f500",
  },
  "PM-00021": {
    partNumber: "PM-00021",
    title: "Gehäuseschraube M3×8",
    commodity: "Mechanik",
    emojiCode: "1f529",
  },
  "PM-00022": {
    partNumber: "PM-00022",
    title: "Kühlkörper Alu 40mm",
    commodity: "Mechanik",
    emojiCode: "1f9ca",
  },
  "PM-00023": {
    partNumber: "PM-00023",
    title: "Steckverbinder 8-pol",
    commodity: "Mechanik",
    emojiCode: "1f50c",
  },
  "PM-00031": {
    partNumber: "PM-00031",
    title: "Widerstand 4,7kΩ 0.25W",
    commodity: "Widerstand",
    emojiCode: "1f4a1",
  },
  "PM-00032": {
    partNumber: "PM-00032",
    title: "Diode 1N4007",
    commodity: "Halbleiter",
    emojiCode: "1f4a1",
  },
  "PM-00033": {
    partNumber: "PM-00033",
    title: "LED grün 5mm",
    commodity: "Optoelektronik",
    emojiCode: "1f7e2",
  },
  "PM-00041": {
    partNumber: "PM-00041",
    title: "Kabelbaum 12-adrig",
    commodity: "Kabel",
    emojiCode: "1f9f5",
  },
  "PM-00042": {
    partNumber: "PM-00042",
    title: "Platinenhalter Nylon",
    commodity: "Mechanik",
    emojiCode: "1f9e9",
  },
  "PM-00043": {
    partNumber: "PM-00043",
    title: "Sicherung 2A träge",
    commodity: "Schutzelement",
    emojiCode: "1f4a5",
  },
};

const UI_PARTS_PER_BATCH = 20;

function generateParts(
  batchId: string,
  severity: BatchSeverity,
  count: number = UI_PARTS_PER_BATCH,
): PartRow[] {
  // Seed deterministisch: letzte zwei Ziffern der Batch-ID als Offset.
  const seed = parseInt(batchId.slice(-2), 10) || 0;
  const rate = {
    ok: { reject: 0, hold: 0 },
    suspect: { reject: 0, hold: 0.15 },
    bad: { reject: 0.25, hold: 0.15 },
  }[severity];

  const rows: PartRow[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministischer Pseudo-Zufall
    const r = ((seed * 17 + i * 31) % 100) / 100;
    let status: PartQualityStatus = "ok";
    if (r < rate.reject) status = "reject";
    else if (r < rate.reject + rate.hold) status = "hold";
    rows.push({
      partId: `P-${String(seed * 1000 + i).padStart(6, "0")}`,
      serialNumber: `SN-${batchId.slice(3)}-${String(i).padStart(3, "0")}`,
      qualityStatus: status,
    });
  }
  return rows;
}

type BatchSpec = {
  batchId: string;
  batchNumber: string;
  partNumber: string;
  receivedDate: string;
  qty: number;
  severity: BatchSeverity;
};

function buildBatches(specs: BatchSpec[]): BatchRow[] {
  return specs.map((s) => ({
    batchId: s.batchId,
    batchNumber: s.batchNumber,
    partNumber: s.partNumber,
    receivedDate: s.receivedDate,
    qty: s.qty,
    parts: generateParts(s.batchId, s.severity),
  }));
}

function pickPartMasters(numbers: string[]): PartMasterInfo[] {
  return numbers.map((n) => PART_MASTERS[n]);
}

export const supplierDetails: Record<string, SupplierDetailData> = {
  "sup-01": {
    supplierId: "SUP-01",
    supplierName: "ElektroParts GmbH",
    country: "DE",
    partMasters: pickPartMasters([
      "PM-00001",
      "PM-00006",
      "PM-00007",
      "PM-00008",
      "PM-00017",
    ]),
    batches: buildBatches([
      {
        batchId: "SB-00001",
        batchNumber: "B00001",
        partNumber: "PM-00001",
        receivedDate: "2025-09-15",
        qty: 500,
        severity: "ok",
      },
      {
        batchId: "SB-00006",
        batchNumber: "B00006",
        partNumber: "PM-00006",
        receivedDate: "2025-10-15",
        qty: 200,
        severity: "ok",
      },
      {
        batchId: "SB-00007",
        batchNumber: "B00007",
        partNumber: "PM-00007",
        receivedDate: "2025-11-01",
        qty: 250,
        severity: "ok",
      },
      {
        batchId: "SB-00019",
        batchNumber: "B00019",
        partNumber: "PM-00017",
        receivedDate: "2025-11-05",
        qty: 200,
        severity: "ok",
      },
      {
        batchId: "SB-00008",
        batchNumber: "B00008",
        partNumber: "PM-00008",
        receivedDate: "2025-11-10",
        qty: 800,
        severity: "bad",
      },
      {
        batchId: "SB-00009",
        batchNumber: "B00009",
        partNumber: "PM-00008",
        receivedDate: "2026-02-03",
        qty: 600,
        severity: "bad",
      },
      {
        batchId: "SB-00010",
        batchNumber: "B00010",
        partNumber: "PM-00008",
        receivedDate: "2026-03-01",
        qty: 400,
        severity: "suspect",
      },
    ]),
  },
  "sup-02": {
    supplierId: "SUP-02",
    supplierName: "Mechanik-Werk AG",
    country: "DE",
    partMasters: pickPartMasters(["PM-00021", "PM-00022", "PM-00023"]),
    batches: buildBatches([
      {
        batchId: "SB-00021",
        batchNumber: "B00021",
        partNumber: "PM-00021",
        receivedDate: "2025-10-02",
        qty: 1200,
        severity: "ok",
      },
      {
        batchId: "SB-00022",
        batchNumber: "B00022",
        partNumber: "PM-00022",
        receivedDate: "2025-11-20",
        qty: 300,
        severity: "ok",
      },
      {
        batchId: "SB-00023",
        batchNumber: "B00023",
        partNumber: "PM-00023",
        receivedDate: "2026-01-12",
        qty: 450,
        severity: "ok",
      },
      {
        batchId: "SB-00024",
        batchNumber: "B00024",
        partNumber: "PM-00021",
        receivedDate: "2026-02-20",
        qty: 1400,
        severity: "ok",
      },
    ]),
  },
  "sup-03": {
    supplierId: "SUP-03",
    supplierName: "TechSupply Europe",
    country: "NL",
    partMasters: pickPartMasters(["PM-00031", "PM-00032", "PM-00033"]),
    batches: buildBatches([
      {
        batchId: "SB-00031",
        batchNumber: "B00031",
        partNumber: "PM-00031",
        receivedDate: "2025-10-22",
        qty: 2000,
        severity: "ok",
      },
      {
        batchId: "SB-00032",
        batchNumber: "B00032",
        partNumber: "PM-00032",
        receivedDate: "2025-12-05",
        qty: 1500,
        severity: "ok",
      },
      {
        batchId: "SB-00033",
        batchNumber: "B00033",
        partNumber: "PM-00033",
        receivedDate: "2026-01-28",
        qty: 800,
        severity: "ok",
      },
    ]),
  },
  "sup-04": {
    supplierId: "SUP-04",
    supplierName: "PartStream Industries",
    country: "IT",
    partMasters: pickPartMasters(["PM-00041", "PM-00042", "PM-00043"]),
    batches: buildBatches([
      {
        batchId: "SB-00041",
        batchNumber: "B00041",
        partNumber: "PM-00041",
        receivedDate: "2025-10-08",
        qty: 350,
        severity: "ok",
      },
      {
        batchId: "SB-00042",
        batchNumber: "B00042",
        partNumber: "PM-00042",
        receivedDate: "2025-11-25",
        qty: 600,
        severity: "ok",
      },
      {
        batchId: "SB-00043",
        batchNumber: "B00043",
        partNumber: "PM-00043",
        receivedDate: "2026-02-14",
        qty: 900,
        severity: "ok",
      },
    ]),
  },
};

export function flaggedPartsInBatch(batch: BatchRow): number {
  return batch.parts.filter((p) => p.qualityStatus !== "ok").length;
}

export function flaggedPartsForPm(
  supplier: SupplierDetailData,
  partNumber: string,
): number {
  return supplier.batches
    .filter((b) => b.partNumber === partNumber)
    .reduce((sum, b) => sum + flaggedPartsInBatch(b), 0);
}

export function partMasterFor(
  supplier: SupplierDetailData,
  partNumber: string,
): PartMasterInfo | undefined {
  return supplier.partMasters.find((pm) => pm.partNumber === partNumber);
}

// ============================================================
// Article-Catalog: 5 Articles + BOMs aus dem Seed (BN-00001..00064)
// ============================================================

export type BomFlag = "design-issue" | "supply-issue";

export type BomComponent = {
  bomNodeId: string;
  findNumber: string;
  partNumber: string;
  partTitle: string;
  commodity: string;
  qty: number;
  flag?: BomFlag;
};

export type BomAssembly = {
  bomNodeId: string;
  name: string;
  components: BomComponent[];
};

export type ArticleInfo = {
  articleId: string;
  name: string;
  emojiCode: string;
  bomId: string;
  bomVersion: string;
  assemblies: BomAssembly[];
};

// Seed-PartMaster (PM-00001..PM-00020) — Quelle: seed.sql Zeile 64-84.
type SeedPmInfo = { title: string; commodity: string };
const SEED_PM: Record<string, SeedPmInfo> = {
  "PM-00001": { title: "Kondensator 10µF 16V", commodity: "capacitor" },
  "PM-00002": { title: "Kondensator 47µF 25V", commodity: "capacitor" },
  "PM-00003": { title: "Widerstand 100R 0.25W", commodity: "resistor" },
  "PM-00004": { title: "Widerstand 1k 0.25W", commodity: "resistor" },
  "PM-00005": { title: "LED 5mm rot", commodity: "diode" },
  "PM-00006": { title: "Mikrocontroller STM32F4", commodity: "ic" },
  "PM-00007": { title: "Spannungsregler LM7805", commodity: "ic" },
  "PM-00008": { title: "Kondensator 100µF X7R", commodity: "capacitor" },
  "PM-00009": { title: "Diode Schottky SK34", commodity: "diode" },
  "PM-00010": { title: "Stecker 10-pin SPH", commodity: "connector" },
  "PM-00011": { title: "Gehäuse Aluminium A200", commodity: "housing" },
  "PM-00012": { title: "Schrauben M3×8 verz.", commodity: "fastener" },
  "PM-00013": { title: "Wärmeleitpaste WLP-G", commodity: "consumable" },
  "PM-00014": { title: "Platine Basis PCB-4L", commodity: "pcb" },
  "PM-00015": { title: "Widerstand 4.7k Thermal", commodity: "resistor" },
  "PM-00016": { title: "Optokoppler PC817", commodity: "ic" },
  "PM-00017": { title: "Relais 12V SPDT", commodity: "relay" },
  "PM-00018": { title: "Sicherung Träge T1A", commodity: "fuse" },
  "PM-00019": { title: "Display OLED 128×64", commodity: "display" },
  "PM-00020": { title: "Tastatur-Modul 4×4", commodity: "input" },
};

function comp(
  bomNodeId: string,
  findNumber: string,
  partNumber: string,
  qty: number = 1,
  flag?: BomFlag,
): BomComponent {
  const pm = SEED_PM[partNumber];
  return {
    bomNodeId,
    findNumber,
    partNumber,
    partTitle: pm?.title ?? partNumber,
    commodity: pm?.commodity ?? "part",
    qty,
    flag,
  };
}

export const articleCatalog: ArticleInfo[] = [
  {
    articleId: "ART-00001",
    name: "Motor Controller MC-200",
    emojiCode: "1f699", // car
    bomId: "BOM-00001",
    bomVersion: "1.0",
    assemblies: [
      {
        bomNodeId: "BN-00001",
        name: "Steuerplatine",
        components: [
          comp("BN-00002", "U1", "PM-00006"),
          comp("BN-00003", "C12", "PM-00008", 1, "supply-issue"),
          comp("BN-00004", "R33", "PM-00015", 1, "design-issue"),
          comp("BN-00005", "U2", "PM-00007"),
        ],
      },
      {
        bomNodeId: "BN-00006",
        name: "Leistungsstufe",
        components: [
          comp("BN-00007", "C5", "PM-00002"),
          comp("BN-00008", "D1", "PM-00009"),
          comp("BN-00009", "K1", "PM-00017"),
        ],
      },
      {
        bomNodeId: "BN-00010",
        name: "Gehäuse_IO",
        components: [
          comp("BN-00011", "H1", "PM-00011"),
          comp("BN-00012", "J1", "PM-00010"),
          comp("BN-00013", "SCR", "PM-00012"),
        ],
      },
    ],
  },
  {
    articleId: "ART-00002",
    name: "Sensor Unit SU-100",
    emojiCode: "1f4e1", // satellite
    bomId: "BOM-00002",
    bomVersion: "1.0",
    assemblies: [
      {
        bomNodeId: "BN-00014",
        name: "Hauptplatine",
        components: [
          comp("BN-00015", "U1", "PM-00006"),
          comp("BN-00016", "C1", "PM-00001"),
          comp("BN-00017", "R1", "PM-00003"),
          comp("BN-00018", "OC1", "PM-00016"),
        ],
      },
      {
        bomNodeId: "BN-00019",
        name: "Sensorik",
        components: [
          comp("BN-00020", "D1", "PM-00009"),
          comp("BN-00021", "LED", "PM-00005"),
          comp("BN-00022", "C2", "PM-00001"),
        ],
      },
      {
        bomNodeId: "BN-00023",
        name: "Gehäuse",
        components: [
          comp("BN-00024", "H1", "PM-00011"),
          comp("BN-00025", "J1", "PM-00010"),
          comp("BN-00026", "SCR", "PM-00012"),
        ],
      },
    ],
  },
  {
    articleId: "ART-00003",
    name: "Power Distribution PD-300",
    emojiCode: "26a1", // high voltage
    bomId: "BOM-00003",
    bomVersion: "1.0",
    assemblies: [
      {
        bomNodeId: "BN-00027",
        name: "Leistungsteil",
        components: [
          comp("BN-00028", "U1", "PM-00007"),
          comp("BN-00029", "C1", "PM-00002"),
          comp("BN-00030", "D1", "PM-00009"),
          comp("BN-00031", "F1", "PM-00018"),
        ],
      },
      {
        bomNodeId: "BN-00032",
        name: "Relais_Stufe",
        components: [
          comp("BN-00033", "K1", "PM-00017"),
          comp("BN-00034", "K2", "PM-00017"),
          comp("BN-00035", "R1", "PM-00004"),
        ],
      },
      {
        bomNodeId: "BN-00036",
        name: "Gehäuse",
        components: [
          comp("BN-00037", "H1", "PM-00011"),
          comp("BN-00038", "J1", "PM-00010"),
          comp("BN-00039", "SCR", "PM-00012"),
        ],
      },
    ],
  },
  {
    articleId: "ART-00004",
    name: "Controller Board CB-150",
    emojiCode: "1f5a5", // desktop computer
    bomId: "BOM-00004",
    bomVersion: "1.0",
    assemblies: [
      {
        bomNodeId: "BN-00040",
        name: "Hauptplatine",
        components: [
          comp("BN-00041", "U1", "PM-00006"),
          comp("BN-00042", "C1", "PM-00001"),
          comp("BN-00043", "R1", "PM-00003"),
          comp("BN-00044", "PCB", "PM-00014"),
        ],
      },
      {
        bomNodeId: "BN-00045",
        name: "Schnittstelle",
        components: [
          comp("BN-00046", "OC1", "PM-00016"),
          comp("BN-00047", "J1", "PM-00010"),
          comp("BN-00048", "LED", "PM-00005"),
        ],
      },
      {
        bomNodeId: "BN-00049",
        name: "Montage",
        components: [
          comp("BN-00050", "H1", "PM-00011"),
          comp("BN-00051", "SCR", "PM-00012"),
          comp("BN-00052", "TIM", "PM-00013"),
        ],
      },
    ],
  },
  {
    articleId: "ART-00005",
    name: "Gateway Module GM-400",
    emojiCode: "1f4e1", // satellite (re-use)
    bomId: "BOM-00005",
    bomVersion: "1.0",
    assemblies: [
      {
        bomNodeId: "BN-00053",
        name: "Funkteil",
        components: [
          comp("BN-00054", "U1", "PM-00006"),
          comp("BN-00055", "C1", "PM-00001"),
          comp("BN-00056", "R1", "PM-00004"),
        ],
      },
      {
        bomNodeId: "BN-00057",
        name: "Anzeige",
        components: [
          comp("BN-00058", "DSP", "PM-00019"),
          comp("BN-00059", "KB", "PM-00020"),
          comp("BN-00060", "LED", "PM-00005"),
        ],
      },
      {
        bomNodeId: "BN-00061",
        name: "Gehäuse",
        components: [
          comp("BN-00062", "H1", "PM-00011"),
          comp("BN-00063", "J1", "PM-00010"),
          comp("BN-00064", "SCR", "PM-00012"),
        ],
      },
    ],
  },
];

export function articleById(articleId: string): ArticleInfo | undefined {
  return articleCatalog.find((a) => a.articleId === articleId);
}

// ============================================================
// Factory-Detail: Lines + Sections + Test-Pins (aus Seed)
// ============================================================

export type FactorySectionType = "montage" | "pruefung" | "verpackung";

export type SectionCaseFlag = {
  kind: "process" | "operator";
  title: string;
  detail: string;
};

export type FactorySection = {
  sectionId: string;
  name: string;
  sectionType: FactorySectionType;
  sequenceNo: number;
  testCount: number;
  caseFlag?: SectionCaseFlag;
};

export type FactoryLine = {
  lineId: string;
  name: string;
  lineType: string; // assembly | test | packaging (Etikett aus Seed)
  area: string;
  sections: FactorySection[];
};

export type FactoryDetailData = {
  factoryId: string;
  name: string;
  country: string;
  siteCode: string;
  lines: FactoryLine[];
};

export const factoryDetails: Record<string, FactoryDetailData> = {
  "fac-aug": {
    factoryId: "FAC-00001",
    name: "Werk Augsburg",
    country: "DE",
    siteCode: "AUG",
    lines: [
      {
        lineId: "LIN-00001",
        name: "Linie 1",
        lineType: "assembly",
        area: "North",
        sections: [
          {
            sectionId: "SEC-00001",
            name: "Montage Linie 1",
            sectionType: "montage",
            sequenceNo: 1,
            testCount: 0,
            caseFlag: {
              kind: "process",
              title: "Drift KW49-52/2025",
              detail:
                "Drehmomentschlüssel out-of-cal, Schrauben unter-torqued → VIB_FAIL Spike, seit KW2/2026 self-corrected",
            },
          },
          {
            sectionId: "SEC-00002",
            name: "Pruefung Linie 1",
            sectionType: "pruefung",
            sequenceNo: 2,
            testCount: 7,
          },
          {
            sectionId: "SEC-00003",
            name: "Verpackung Linie 1",
            sectionType: "verpackung",
            sequenceNo: 3,
            testCount: 1,
          },
        ],
      },
      {
        lineId: "LIN-00002",
        name: "Linie 2",
        lineType: "assembly",
        area: "South",
        sections: [
          {
            sectionId: "SEC-00004",
            name: "Montage Linie 2",
            sectionType: "montage",
            sequenceNo: 1,
            testCount: 0,
          },
          {
            sectionId: "SEC-00005",
            name: "Pruefung Linie 2",
            sectionType: "pruefung",
            sequenceNo: 2,
            testCount: 0,
          },
          {
            sectionId: "SEC-00006",
            name: "Verpackung Linie 2",
            sectionType: "verpackung",
            sequenceNo: 3,
            testCount: 0,
          },
        ],
      },
    ],
  },
  "fac-dre": {
    factoryId: "FAC-00002",
    name: "Werk Dresden",
    country: "DE",
    siteCode: "DRE",
    lines: [
      {
        lineId: "LIN-00003",
        name: "Linie 1",
        lineType: "test",
        area: "East",
        sections: [
          {
            sectionId: "SEC-00007",
            name: "Montage Linie 1",
            sectionType: "montage",
            sequenceNo: 1,
            testCount: 0,
            caseFlag: {
              kind: "operator",
              title: "Operator user_042 · +340% Defektrate",
              detail:
                "Cosmetic-Defekte (VISUAL_SCRATCH, LABEL_MISALIGN) clustern auf POs PO-00012/18/24, low severity",
            },
          },
          {
            sectionId: "SEC-00008",
            name: "Pruefung Linie 1",
            sectionType: "pruefung",
            sequenceNo: 2,
            testCount: 0,
          },
          {
            sectionId: "SEC-00009",
            name: "Verpackung Linie 1",
            sectionType: "verpackung",
            sequenceNo: 3,
            testCount: 0,
          },
        ],
      },
      {
        lineId: "LIN-00004",
        name: "Linie 2",
        lineType: "packaging",
        area: "West",
        sections: [
          {
            sectionId: "SEC-00010",
            name: "Montage Linie 2",
            sectionType: "montage",
            sequenceNo: 1,
            testCount: 0,
          },
          {
            sectionId: "SEC-00011",
            name: "Pruefung Linie 2",
            sectionType: "pruefung",
            sequenceNo: 2,
            testCount: 0,
          },
          {
            sectionId: "SEC-00012",
            name: "Verpackung Linie 2",
            sectionType: "verpackung",
            sequenceNo: 3,
            testCount: 0,
          },
        ],
      },
    ],
  },
};

// ============================================================
// Field-Detail: Field-Claims gruppiert nach Article
// ============================================================

export type FieldClaimEntry = {
  claimId: string;
  productId: string;
  articleId: string;
  complaintText: string;
  market: string;
  buildAgeWeeks: number;
  reportedPart: string;
};

function fc(
  claimId: string,
  productId: string,
  articleId: string,
  complaintText: string,
  market: string,
  buildAgeWeeks: number,
  reportedPart: string,
): FieldClaimEntry {
  return {
    claimId,
    productId,
    articleId,
    complaintText,
    market,
    buildAgeWeeks,
    reportedPart,
  };
}

// Realistic distribution: ART-00001 dominiert (Story 1 + Story 3 zeigen sich
// hier), andere Articles haben Hintergrundrauschen.
export const fieldClaims: FieldClaimEntry[] = [
  // Story 1 — Supply (PM-00008 / SB-00008,9): Totalausfall, Build 4-8 Wochen
  fc("FC-00001", "PRD-00012", "ART-00001", "Totalausfall nach 6 Wochen, Gerät reagiert nicht mehr", "DE", 6, "PM-00008"),
  fc("FC-00002", "PRD-00045", "ART-00001", "Funktion versagte komplett, kein Boot mehr möglich", "IT", 5, "PM-00008"),
  fc("FC-00003", "PRD-00089", "ART-00001", "Plötzlicher Ausfall im Betrieb nach kurzer Nutzung", "US", 7, "PM-00008"),
  fc("FC-00004", "PRD-00123", "ART-00001", "Total-Defekt, lässt sich nicht mehr einschalten", "FR", 4, "PM-00008"),
  fc("FC-00005", "PRD-00156", "ART-00001", "Komplettausfall nach 8 Wochen Einsatz", "DE", 8, "PM-00008"),
  fc("FC-00006", "PRD-00198", "ART-00001", "Gerät tot, Reparatur unmöglich", "UK", 6, "PM-00008"),
  fc("FC-00007", "PRD-00234", "ART-00001", "Funktion nicht mehr gegeben, kalt", "IT", 5, "PM-00008"),
  fc("FC-00008", "PRD-00267", "ART-00001", "Plötzlicher Stillstand mitten im Betrieb", "US", 7, "PM-00008"),
  fc("FC-00009", "PRD-00301", "ART-00001", "Ausfall nach wenigen Wochen, vermutlich Elektronik", "ES", 5, "PM-00008"),
  fc("FC-00010", "PRD-00334", "ART-00001", "Totalausfall, Garantieersatz angefordert", "DE", 6, "PM-00008"),
  fc("FC-00011", "PRD-00367", "ART-00001", "Gerät schaltet ab und reagiert nicht mehr", "IT", 7, "PM-00008"),
  fc("FC-00012", "PRD-00400", "ART-00001", "Defekt nach 8 Wochen Einsatz", "PL", 8, "PM-00008"),

  // Story 3 — Design (PM-00015 / R33 thermal drift): schleichender Ausfall, Build 8-12 Wochen
  fc("FC-00013", "PRD-00033", "ART-00001", "Schleichender Ausfall, wird langsam schlechter über Wochen", "DE", 9, "PM-00015"),
  fc("FC-00014", "PRD-00078", "ART-00001", "Drift bei Belastung, Funktion zunehmend unzuverlässig", "IT", 11, "PM-00015"),
  fc("FC-00015", "PRD-00112", "ART-00001", "Temperaturproblem, Gerät wird heiß, dann Aussetzer", "US", 10, "PM-00015"),
  fc("FC-00016", "PRD-00145", "ART-00001", "Langsame Verschlechterung der Performance", "FR", 12, "PM-00015"),
  fc("FC-00017", "PRD-00179", "ART-00001", "Drift unter Last, vermutlich thermisch", "DE", 10, "PM-00015"),
  fc("FC-00018", "PRD-00212", "ART-00001", "Schleichender Ausfall nach 11 Wochen", "UK", 11, "PM-00015"),
  fc("FC-00019", "PRD-00245", "ART-00001", "Gerät überhitzt unter Last, Funktion driftet", "IT", 9, "PM-00015"),
  fc("FC-00020", "PRD-00278", "ART-00001", "Temperatur zu hoch, Werte instabil", "US", 12, "PM-00015"),
  fc("FC-00021", "PRD-00312", "ART-00001", "Nach 10 Wochen Funktion deutlich verschlechtert", "DE", 10, "PM-00015"),
  fc("FC-00022", "PRD-00345", "ART-00001", "Drift im Steuerverhalten, scheinbar wärmebedingt", "FR", 11, "PM-00015"),
  fc("FC-00023", "PRD-00378", "ART-00001", "Thermische Drift, Werte nicht mehr stabil", "IT", 12, "PM-00015"),
  fc("FC-00024", "PRD-00411", "ART-00001", "Schleichender Performance-Verlust", "ES", 9, "PM-00015"),
  fc("FC-00025", "PRD-00444", "ART-00001", "Gerät wird unzuverlässig bei längerem Einsatz", "DE", 10, "PM-00015"),
  fc("FC-00026", "PRD-00477", "ART-00001", "Temperatur-Drift erkennbar, Funktion eingeschränkt", "PL", 11, "PM-00015"),
  fc("FC-00027", "PRD-00499", "ART-00001", "Schleichender Ausfall, vermutlich Bauteil-Drift", "UK", 12, "PM-00015"),

  // Hintergrundrauschen (andere Articles, gemischte Ursachen)
  fc("FC-00028", "PRD-00501", "ART-00003", "Relais klickt nicht mehr zuverlässig", "DE", 14, "PM-00017"),
  fc("FC-00029", "PRD-00523", "ART-00003", "Sicherung defekt nach Überspannung", "IT", 16, "PM-00018"),
  fc("FC-00030", "PRD-00545", "ART-00003", "Ausfall der Leistungsstufe", "US", 18, "PM-00007"),
  fc("FC-00031", "PRD-00567", "ART-00003", "Kein Schaltsignal mehr", "FR", 12, "PM-00017"),
  fc("FC-00032", "PRD-00589", "ART-00003", "Sporadischer Ausfall des Relais K1", "UK", 15, "PM-00017"),
  fc("FC-00033", "PRD-00611", "ART-00003", "Sicherung wird heiß", "DE", 17, "PM-00018"),
  fc("FC-00034", "PRD-00633", "ART-00002", "Sensor liefert falsche Werte", "IT", 9, "PM-00009"),
  fc("FC-00035", "PRD-00655", "ART-00002", "LED leuchtet nicht mehr", "US", 11, "PM-00005"),
  fc("FC-00036", "PRD-00677", "ART-00002", "Sensorausfall nach kurzer Zeit", "FR", 8, "PM-00009"),
  fc("FC-00037", "PRD-00699", "ART-00002", "Anzeige fällt sporadisch aus", "DE", 13, "PM-00005"),
  fc("FC-00038", "PRD-00721", "ART-00004", "Display schwarz nach Update", "US", 6, "PM-00019"),
  fc("FC-00039", "PRD-00743", "ART-00004", "Tastatur-Eingabe verzögert", "IT", 10, "PM-00020"),
  fc("FC-00040", "PRD-00765", "ART-00004", "Display zeigt Fehler nach 6 Wochen", "DE", 6, "PM-00019"),
];

// Latente / proaktive Risiko-Population: Products im Field, für die wir wegen
// bekannter Issues (Bad-Batch, Design-Drift) Maßnahmen vorbereiten müssen,
// auch wenn der Kunde noch nicht reklamiert hat.
export type AtRiskReason = "supply" | "design";

export type AtRiskProduct = {
  productId: string;
  articleId: string;
  reason: AtRiskReason;
  reasonDetail: string;
  buildAgeWeeks: number;
  market: string;
};

function ar(
  productId: string,
  articleId: string,
  reason: AtRiskReason,
  reasonDetail: string,
  buildAgeWeeks: number,
  market: string,
): AtRiskProduct {
  return { productId, articleId, reason, reasonDetail, buildAgeWeeks, market };
}

export const atRiskProducts: AtRiskProduct[] = [
  // Story 1 latent — Products mit PM-00008 aus SB-00008/9, noch kein Claim.
  // Aus DATA_PATTERNS: ~30 betroffene Products gesamt, ~25 in-factory Defekte,
  // ~12 Claims → ~10-15 sind im Field ohne bisherigen Claim.
  ar("PRD-00021", "ART-00001", "supply", "PM-00008 aus SB-00008", 5, "DE"),
  ar("PRD-00054", "ART-00001", "supply", "PM-00008 aus SB-00008", 6, "IT"),
  ar("PRD-00098", "ART-00001", "supply", "PM-00008 aus SB-00008", 7, "FR"),
  ar("PRD-00132", "ART-00001", "supply", "PM-00008 aus SB-00009", 4, "US"),
  ar("PRD-00165", "ART-00001", "supply", "PM-00008 aus SB-00009", 5, "DE"),
  ar("PRD-00207", "ART-00001", "supply", "PM-00008 aus SB-00009", 6, "UK"),
  ar("PRD-00243", "ART-00001", "supply", "PM-00008 aus SB-00008", 7, "IT"),
  ar("PRD-00276", "ART-00001", "supply", "PM-00008 aus SB-00008", 5, "ES"),
  ar("PRD-00309", "ART-00001", "supply", "PM-00008 aus SB-00009", 8, "DE"),
  ar("PRD-00342", "ART-00001", "supply", "PM-00008 aus SB-00008", 6, "PL"),

  // Story 3 latent — ART-00001 Produkte im Build-Alter-Fenster 8-12w (peak risk),
  // R33/PM-00015 läuft heiß, schleichende Drift. Diese werden bald failen wenn
  // wir nichts tun.
  ar("PRD-00042", "ART-00001", "design", "R33 (PM-00015) thermal drift", 9, "DE"),
  ar("PRD-00087", "ART-00001", "design", "R33 (PM-00015) thermal drift", 10, "IT"),
  ar("PRD-00121", "ART-00001", "design", "R33 (PM-00015) thermal drift", 11, "US"),
  ar("PRD-00154", "ART-00001", "design", "R33 (PM-00015) thermal drift", 8, "FR"),
  ar("PRD-00188", "ART-00001", "design", "R33 (PM-00015) thermal drift", 12, "DE"),
  ar("PRD-00221", "ART-00001", "design", "R33 (PM-00015) thermal drift", 9, "UK"),
  ar("PRD-00254", "ART-00001", "design", "R33 (PM-00015) thermal drift", 10, "IT"),
  ar("PRD-00287", "ART-00001", "design", "R33 (PM-00015) thermal drift", 11, "US"),
  ar("PRD-00321", "ART-00001", "design", "R33 (PM-00015) thermal drift", 12, "DE"),
  ar("PRD-00354", "ART-00001", "design", "R33 (PM-00015) thermal drift", 8, "ES"),
  ar("PRD-00387", "ART-00001", "design", "R33 (PM-00015) thermal drift", 9, "FR"),
  ar("PRD-00420", "ART-00001", "design", "R33 (PM-00015) thermal drift", 11, "PL"),
];

export type AffectedArticle = {
  articleId: string;
  name: string;
  emojiCode: string;
  claims: FieldClaimEntry[];
  atRisk: AtRiskProduct[];
};

export function affectedArticles(): AffectedArticle[] {
  const claimsByArt = new Map<string, FieldClaimEntry[]>();
  for (const c of fieldClaims) {
    const arr = claimsByArt.get(c.articleId) ?? [];
    arr.push(c);
    claimsByArt.set(c.articleId, arr);
  }
  const riskByArt = new Map<string, AtRiskProduct[]>();
  for (const r of atRiskProducts) {
    const arr = riskByArt.get(r.articleId) ?? [];
    arr.push(r);
    riskByArt.set(r.articleId, arr);
  }

  const articleIds = new Set<string>([
    ...claimsByArt.keys(),
    ...riskByArt.keys(),
  ]);

  const result: AffectedArticle[] = [];
  for (const articleId of articleIds) {
    const article = articleCatalog.find((a) => a.articleId === articleId);
    if (!article) continue;
    result.push({
      articleId,
      name: article.name,
      emojiCode: article.emojiCode,
      claims: claimsByArt.get(articleId) ?? [],
      atRisk: riskByArt.get(articleId) ?? [],
    });
  }
  result.sort(
    (a, b) =>
      b.claims.length + b.atRisk.length - (a.claims.length + a.atRisk.length),
  );
  return result;
}
