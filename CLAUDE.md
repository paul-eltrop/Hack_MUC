# Hack MUC 2026 · Manex Quality Copilot

Hackathon-Projekt für **thinc! Hack MUC 2026**, Challenge von **Manex.AI**. Ziel: Interaktiver LLM-Copilot, der den klassischen 8D/FMEA-Excel-Report ablöst — auf Basis eines semantischen Fabrikdaten-Layers.

## Repository-Struktur

```
Hack_MUC/
├── manex-base/           # read-only Starter von Manex — NICHT anfassen
│   ├── docs/             # Case, Schema, Data-Patterns, API-Ref, Quickstart
│   ├── supabase/         # Migrations + 7000-Zeilen Seed
│   ├── data-generation/  # Templates für Claim-/Defect-/Rework-Texte
│   ├── assets/           # 12 echte Defect-Fotos
│   └── scripts/          # Deploy-Skripte pro Team
├── frontend/             # unsere Next.js App — alles spielt hier
└── CLAUDE.md             # diese Datei
```

## Challenge in 3 Pillars

Manex erkennt Pattern in ihren Daten automatisch. Wir bauen den **Bearbeitungs-Layer** — was passiert nach der Erkennung:

1. **Intelligent Generation** — LLM entwirft Report-Inhalte aus DB-Daten
2. **Innovative Visualization** — statt Tabellen: Flow, Fault-Trees, BOM-Traces
3. **Closed-Loop Workflow** — Maßnahmen als `product_action` in DB schreiben + tracken

Flow: `Pattern von Manex → unser On-Demand-Agent matcht offene Fälle → Inbox → Klick → Detail-Canvas → User bearbeitet → Write-Back`.

## Domain / DB-Modell (aus `manex-base/`)

19 Tabellen in einem Postgres-Schema mit strengen ID-Prefixes. Gruppiert nach Domäne:

**Ort** (Where): `factory` (FAC-) → `line` (LIN-) → `section` (SEC-)
**Design** (Recipe): `article` (ART-) → `configuration` (CFG-) → `bom` (BOM-) → `bom_node` (BN-) + `part_master` (PM-)
**Supply** (Material): `supplier_batch` (SB-) → `part` (P-)
**Production**: `production_order` (PO-), `product` (PRD-), `product_part_install` (PPI-)
**Test**: `test` (TST-), `test_result` (TR-)
**Quality Events**: `defect` (DEF-), `field_claim` (FC-), `rework` (RW-)
**Workflow** (das einzige schreibbare): `product_action` (PA-)

**Schreibrechte:** nur `product_action` + `rework` + `CREATE TABLE public.*` (für eigene Pattern/Case-Tabellen).

**Auth:** `apikey`-Header (nicht Bearer), JWT signiert mit Team-Secret, Rolle `team_writer`.

**4 seeded Root-Cause-Stories in den Daten:**
1. **Supply** — Batch SB-00008/9 von ElektroParts (PM-00008 Kondensatoren) → ~25 Defekte + ~12 Claims
2. **Production (Drift)** — Section SEC-00001 (Montage Werk Augsburg), Dez 2025 → ~20 Defekte (Code `VIB_FAIL`)
3. **Design** — Article ART-00001, Position R33 (PM-00015) → ~15 Field-Claims, 0 in-factory
4. **Production (Operator)** — user_042 über POs PO-00012/18/24 → ~15 low-severity Defekte

Vollständige Schema-Referenz: `manex-base/docs/SCHEMA.md`, `manex-base/docs/DATA_PATTERNS.md`.

## Unser Frontend — aktueller Stand

Next.js 15 App Router, TypeScript, Tailwind v4, `@xyflow/react` (React Flow v12).

**Einzige Route bislang:** `/` (Landing) — die **Flow-Overview**.

### Visuelles Konzept

Top-Level-Canvas zeigt die Supply-Chain-Topologie als 7 Nodes:
- 4 **Supplier** (ElektroParts, Mechanik-Werk, TechSupply, PartStream)
- 2 **Werke** (Augsburg Assembly, Dresden Test+Packaging)
- 1 **Kunden** (Field, aggregiert aus 7 Märkten)

Kanten: 4 Supplier → Werk Augsburg (dünn grau), Augsburg → Dresden (animiert), Dresden → Field (animiert).

Jeder Node: Kind-Label oben, Titel, Twemoji-Illustration (SVGs von jsdelivr), Fehler-Badge oben rechts (rot wenn >0, grau wenn 0), Subtitle + Event-Count darunter.

### Interaktion

**Keine User-Zoom/Pan-Gesten.** Alles klick-getriggert:

- **Click auf einen Node** → Node wechselt Typ zu `flowDetail` (wird zu 900×600 großem Frame), alle anderen Nodes + Edges faden auf Opacity 0, Kamera fitView'd auf den Detail-Node (~1.2× Zoom). Fühlt sich wie "in den Node reinzoomen auf freien Canvas" an — der Detail-Frame ist ein echter React-Flow-Node, kein Overlay.
- **Detail-Frame:** dünner akzentuierter Border (`border` rounded-3xl), Kind-Tint als Hintergrund, subtiler Shadow. Oben links im Frame: runder `←`-Button + Kind-Chip + Titel.
- **Click auf `←`** → setFocusedId(null) → Detail schrumpft, andere Nodes/Edges erscheinen wieder, Kamera zoomt auf Overview zurück.

### Die vier konzeptuellen Fehler-Domänen

Jeder Case hat seine Root in **einer** von vier Domänen (konsolidiert aus den 19 Tabellen):

1. **Supply** — Supplier + Batch + Part → Material kam fehlerhaft rein
2. **Design** — Article + Config + BOM + BOM-Node → Rezept ist fehlerhaft
3. **Production** — Section + Install + Operator → Ausführung in der Fabrik fehlerhaft
4. **Detection** — Test + Test_Result → Prüfung selbst fehlerhaft (seltener)

**Response-Ebene** (keine Ursache, nur Dokumentation + Reaktion): `defect`, `field_claim`, `rework`, `product_action`.

Die Linien sind uninteressant als eigene Entität — sie sind nur Gruppierungs-Container für Sections und werden als Metadata behandelt. Auf dem Canvas erscheinen Linien nicht als Knoten.

### Datei-Layout im Frontend

```
src/app/
├── page.tsx                    # rendert <FlowView />
├── layout.tsx, globals.css
└── _flow/                      # private (nicht geroutet)
    ├── FlowView.tsx            # React-Flow Container + State für focusedId
    ├── flow-context.tsx        # FlowUiContext für {focusedId, setFocusedId}
    ├── flow-nodes.tsx          # FlowNode (compact) + DetailNode (900×600)
    └── flow-data.ts            # 7 Nodes + 6 Edges + Mock-Batches für ElektroParts
```

Der Detail-Node ist aktuell **leer** — `DetailNode` rendert nur Header. Batches/Details für Supplier / Sections für Factory / Markt-Breakdown für Field sind der nächste logische Schritt.

## Design-Entscheidungen (Stand)

- **Visueller Canvas > Excel-Report** — das ist die ganze Idee
- **Kein Auto-Layout** (kein dagre/elkjs) — Positions werden per Regelwerk definiert, vom Agent später
- **Dünner Code-Footprint** — pure React Flow, Zustand-Lib nicht eingebaut (yet)
- **Manex-Topologie ist "agent-generated"** im Pitch — für die Demo hardcoded, später über einen Crawler aus `supplier_batch` + `product_part_install` + `test_result` ableitbar
- **Die drei Top-Level-Views** (geplant): Flow (Default, aktuell gebaut), Inbox (Case-Liste), Factory-Tree — Inbox + Tree sind noch nicht implementiert
- **Agent-Ready-UI** (für V3) — Pure Operations + Shared Dispatch + Stabile IDs würden reinkommen, wenn der Agent-Mode dran ist; jetzt noch nicht nötig

## How to Run

```bash
cd frontend
npm install           # falls nicht schon gelaufen
npm run dev           # startet auf :3000 (bzw. nächstem freien Port)
```

Dev-Server läuft im Hintergrund und hot-reloaded Änderungen.

**Typecheck:**
```bash
cd frontend && npx tsc --noEmit
```

## Next Steps

In ungefähr dieser Reihenfolge:

1. **Detail-Node mit Content füllen** — für Supplier (ElektroParts): die 7 Batches als Sub-Cards im Detail-Frame rendern, mit Bad/Suspect/Ok-Status
2. **Supabase/PostgREST-Anbindung** — die hardcoded Node-Counts durch Live-Queries ersetzen (API-Ref: `manex-base/docs/API_REFERENCE.md`). `.env.local` mit Team-Secret + Base-URL
3. **Case-Modell aufbauen** — `failure_pattern`, `case_assignment`, `report_draft` als eigene Tabellen via `CREATE TABLE public.*`
4. **Inbox-View (Route `/inbox`)** — Liste aktiver Cases, filter- und sortierbar, mit Domänen-Chips
5. **Per-Case-Detail-Canvas** — der eigentliche 8D-Canvas pro Fall mit Produkt, Problem, Station, Material, Action (als Nodes) und Edges
6. **LLM-Integration** — Claude Sonnet 4.6 mit Tool-Use für Node-Annotations und Action-Vorschläge
7. **Write-Back** — `product_action` INSERT aus Action-Stickern auf dem Canvas
8. **Polish:** Drag-Drop-Sticker, Timeline-Scrubber, Similar-Cases-Overlay

## React Flow v12 Reference (`@xyflow/react`)

Diese Sektion ist die **Ground Truth** für alle React-Flow-Arbeit in diesem Projekt. Package heißt `@xyflow/react` (nicht mehr `reactflow`). Wir sind auf `12.10.2`.

### Setup-Regeln

- **Immer** `import "@xyflow/react/dist/style.css";` — ohne die CSS rendern Edges gar nicht.
- **Container braucht Größe** — `<div>` um `<ReactFlow>` muss explizite `height`/`width` haben (in unserer App: `fixed inset-0`). Sonst: leerer Canvas.
- **`<ReactFlowProvider>` wrappen**, wenn `useReactFlow()`/`useNodesState()` außerhalb von `<ReactFlow>` genutzt werden (unser `FlowView`-Pattern).
- **`nodeTypes`/`edgeTypes` NIE inline im JSX definieren** — entweder Modul-Level `const` oder `useMemo`. Sonst Warning + Performance-Hit durch Remount aller Nodes bei jedem Render.

### Node-Typ (Pflichtfelder + was wir nutzen)

```ts
type Node<DataT = {}, TypeKey extends string = string> = {
  id: string;              // pflicht, unique
  position: { x, y };      // pflicht, Flow-Koordinaten
  data: DataT;             // pflicht (kann {} sein)
  type?: TypeKey;          // Key aus nodeTypes-Map; ohne → "default"
  style?: CSSProperties;   // inline CSS — HIER width/height setzen, NICHT auf Node.width
  className?: string;
  hidden?, draggable?, selectable?, connectable?, deletable?, focusable?;
  zIndex?: number;         // Stacking
  parentId?: string;       // für Sub-Flows (war früher parentNode)
  extent?: "parent" | [[x1,y1],[x2,y2]];
  origin?: [0..1, 0..1];   // Anchor (0,0)=top-left, (0.5,0.5)=center
  measured?: { width, height };  // READ-ONLY, von RF gesetzt
  sourcePosition?, targetPosition?: Position;  // nur für default-Nodes
};
```

**Wichtig:** `width`/`height` auf dem Node-Objekt **nicht direkt setzen** — via `style.width`/`style.height` oder CSS. RF berechnet `measured` selbst.

### Edge-Typ

```ts
type Edge<DataT = {}, TypeKey extends string = string> = {
  id: string;              // pflicht
  source: string;          // pflicht, Node-ID
  target: string;          // pflicht, Node-ID
  sourceHandle?: string;   // bei mehreren Handles pro Node zwingend
  targetHandle?: string;
  type?: "default" | "straight" | "step" | "smoothstep" | "simplebezier" | custom;
  animated?, hidden?, selectable?, deletable?, focusable?;
  style?: CSSProperties;   // { stroke, strokeWidth }
  label?: ReactNode;       // + labelStyle, labelShowBg, labelBgStyle etc.
  markerStart?, markerEnd?: EdgeMarkerType;
  zIndex?, interactionWidth?;
  data?: DataT;
};
```

### Custom Nodes — die Regeln

```tsx
// 1. Node-Typ mit Data + Type-Key definieren
type BatchData = { batchNumber: string; status: "ok"|"bad" };
type BatchNode = Node<BatchData, "batch">;

// 2. Komponente erhält NodeProps<BatchNode>
function BatchCard({ data, selected }: NodeProps<BatchNode>) {
  return (
    <div style={{ width: 220, height: 120 }}>
      <Handle type="target" position={Position.Left} />
      {data.batchNumber}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

// 3. nodeTypes Modul-Level
export const nodeTypes = { batch: BatchCard };
```

**NodeProps (wird automatisch injected):** `id`, `data`, `type`, `selected`, `dragging`, `isConnectable`, `positionAbsoluteX/Y`, `width`, `height`, `sourcePosition`, `targetPosition`, `dragHandle`, `zIndex`, `parentId`, `deletable`, `draggable`, `selectable`. **Keine Position-Props für relative x/y** — nutze `positionAbsoluteX/Y`, wenn nötig.

**Handle-Rezepte:**
- Immer `type` (`"source"|"target"`) + `position` (`Position.Left|Right|Top|Bottom`) setzen.
- Bei >1 Handle pro Seite: `id` setzen — sonst können Edges nicht eindeutig zuordnen.
- Interne Elemente, die Klicks/Drags brauchen: CSS-Klasse `nodrag` (sonst schluckt RF den Event). `nopan`/`nowheel` analog, wenn ein Scrollbereich im Node existiert.

### Hooks — wann was

| Hook | Nutzen | Re-Render-Verhalten |
|------|--------|---------------------|
| `useReactFlow()` | Imperative API (fitView, setNodes, getNode…) | re-rendert nicht bei Node-Changes |
| `useNodesState(initial)` / `useEdgesState(initial)` | Controlled state + `onChange`-Handler | re-rendert bei jeder Change |
| `useNodes()` / `useEdges()` | Reines Lesen | re-rendert bei **jeder** Änderung (auch Selection/Dragging) — **teuer!** |
| `useStore(selector, eq?)` | Selektives State-Abo (Zustand-Store) | re-rendert nur bei Selector-Diff — **bevorzugt für fokussierte Reads** |
| `useStoreApi()` | Imperativer Store-Access (`.getState()`) | nie |
| `useViewport()` | `{x,y,zoom}` | bei jedem Viewport-Tick |
| `useNodesInitialized()` | `true` wenn alle Nodes gemessen | einmalig |
| `useOnSelectionChange({ onChange })` | Selection-Callback | nie selbst |
| `useUpdateNodeInternals()` | Trigger-Funktion nach Handle-Mutation | — |
| `useNodeConnections({ nodeId })` | Edges an einem Node | bei Edge-Changes |
| `useHandleConnections({ type, nodeId, id })` | Edges an einem Handle | bei Edge-Changes |
| `useNodesData(ids)` | `data` mehrerer Nodes | bei Data-Change |

### `useReactFlow()` — imperative Methoden (am häufigsten gebraucht)

```ts
const rf = useReactFlow();

// State
rf.getNodes(); rf.getEdges(); rf.getNode(id); rf.getEdge(id);
rf.setNodes(arr | (prev) => next);
rf.addNodes(node | node[]); rf.addEdges(edge | edge[]);
rf.updateNode(id, patch | (n) => n);
rf.updateNodeData(id, patch | (d) => d);
rf.updateEdge(id, patch); rf.updateEdgeData(id, patch);
rf.deleteElements({ nodes, edges }); // Promise<{deletedNodes,deletedEdges}>

// Viewport — alle options: { duration, interpolate?: "smooth"|"linear" }
rf.fitView({ nodes: [{id}], padding, duration, maxZoom, minZoom });
rf.zoomIn(opts); rf.zoomOut(opts); rf.zoomTo(level, opts);
rf.setViewport({x,y,zoom}, opts); rf.getViewport();
rf.setCenter(x, y, { zoom, duration });
rf.fitBounds({x,y,width,height}, opts);

// Koordinaten
rf.screenToFlowPosition({x,y});  // Pixel → Flow
rf.flowToScreenPosition({x,y});  // Flow → Pixel
rf.getNodesBounds(nodes);

// Serialisierung
rf.toObject(); // { nodes, edges, viewport }

// Connections
rf.getNodeConnections({ type?, nodeId, handleId? });
rf.getHandleConnections({ type, nodeId, id });

// Intersection
rf.getIntersectingNodes(nodeOrRect, partially?);
rf.isNodeIntersecting(nodeOrRect, area, partially?);
```

### `<ReactFlow>`-Props, die wir tatsächlich brauchen

- **Daten:** `nodes`, `edges`, `nodeTypes`, `edgeTypes` (alle memoized/stable).
- **Viewport:** `fitView` (bool, initial-fit), `fitViewOptions` (`{ padding, nodes?, minZoom?, maxZoom?, duration? }`), `defaultViewport`, `minZoom`/`maxZoom`.
- **Interaktions-Lock (unser Read-Only-Canvas):** `panOnDrag={false}`, `panOnScroll={false}`, `zoomOnScroll={false}`, `zoomOnPinch={false}`, `zoomOnDoubleClick={false}`, `nodesDraggable={false}`, `nodesConnectable={false}`, `elementsSelectable={false}`.
- **Events:** `onNodeClick: NodeMouseHandler`, `onPaneClick`, `onNodesChange`, `onEdgesChange`, `onConnect`, `onInit`.
- **Misc:** `proOptions={{ hideAttribution: true }}` (wir haben MIT-Version, aber entfernt Branding), `preventScrolling` (default `true`, blockt Page-Scroll über Canvas), `onlyRenderVisibleElements` (Performance bei großen Graphs), `colorMode: "light"|"dark"|"system"`.

### `<Background>`-Props

```tsx
<Background
  variant={BackgroundVariant.Dots}  // | Lines | Cross
  gap={18}                           // number oder [x, y]
  size={1}                           // Dot-Radius / Cross-Größe
  color="#d4d4d8"
  bgColor="..."  offset={0}  lineWidth={1}
/>
```

### TypeScript-Muster, die wir durchziehen

```ts
// 1. Node-Typen als Union, wenn mehrere Custom-Types
type SupplierNode = Node<SupplierData, "flow">;
type DetailNode   = Node<SupplierData, "flowDetail">;
type AppNode      = SupplierNode | DetailNode;

// 2. State-Hooks typisieren
const [nodes, setNodes, onNodesChange] = useNodesState<AppNode>(initialNodes);
const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

// 3. useReactFlow generisch
const rf = useReactFlow<AppNode, Edge>();

// 4. NodeProps mit Union funktioniert nicht direkt — pro Komponente einzeln typen:
function SupplierNodeView({ data }: NodeProps<SupplierNode>) { … }
```

### Die Fehler, die wir garantiert machen werden (und ihre Fixes)

| Symptom | Ursache | Fix |
|---|---|---|
| Leerer Canvas | Container ohne `height` | Parent-Div explizite Höhe geben |
| Edges unsichtbar | `dist/style.css` nicht importiert | Import in Root oder Component |
| Warning "nodeTypes created on every render" | Inline-Objekt im JSX | Modul-Level `const` oder `useMemo` |
| Edges mit falschem Handle | Mehrere Handles ohne `id` | Jedem Handle `id` geben + `sourceHandle`/`targetHandle` auf Edge |
| Custom-Node hat keine Edges | Kein `<Handle>` im Custom-Component | Handle hinzufügen |
| Drag auf internen Controls geht nicht | RF fängt Drag ab | `className="nodrag"` auf Element |
| Scroll in Node-Content zoomt Canvas | Wheel durchgereicht | `className="nowheel"` auf Scrollbereich |
| `fitView` klappt nicht beim ersten Render | Nodes noch nicht gemessen | `useNodesInitialized()` abwarten oder `setTimeout`/`requestAnimationFrame` |
| "Parent node not found" | `extent: "parent"` ohne `parentId` | `parentId` setzen oder `extent` weg |
| `useReactFlow` throw't | `ReactFlowProvider` fehlt | Provider außen rum |
| Nodes bewegen sich nicht bei `setNodes` | Controlled-Mode erwartet frische Array-Referenz | Immer neuen Array zurückgeben, nicht mutieren |

### v12-Gotchas (andere Training-Data-Versionen)

- Package heißt **`@xyflow/react`**, nicht `reactflow`. CSS-Import: `@xyflow/react/dist/style.css`.
- `parentNode` → **`parentId`**.
- `project()` → **`screenToFlowPosition()`**.
- `NodeProps` nutzt **`positionAbsoluteX/Y`**, nicht `xPos/yPos`.
- `width`/`height` auf dem Node sind **read-only-computed** — für initiale Größe `style.width`/`style.height` oder CSS.
- `fitView`-Options: `nodes: [{ id }]` filtert auf Teilmenge — praktisch für Focus-Animationen.
- Handle-Default-Type ist `"source"`, Default-Position `Position.Top` — **beide immer explizit setzen**, lesbarer + weniger Überraschungen.

### Referenz-Links (falls mal tiefer gegraben werden muss)

- https://reactflow.dev/api-reference/react-flow — alle Props
- https://reactflow.dev/api-reference/types/node — Node-Type
- https://reactflow.dev/api-reference/types/edge — Edge-Type
- https://reactflow.dev/api-reference/hooks — alle Hooks
- https://reactflow.dev/learn/customization/custom-nodes — Custom Nodes Guide
- https://reactflow.dev/learn/advanced-use/typescript — TS-Patterns
- https://reactflow.dev/learn/troubleshooting/common-errors — Fehlerliste

## Wichtige Constraints

- **`manex-base/` ist read-only** — nur daraus lesen, nie ändern
- Migrations haben Team-Isolation — wir können `CREATE TABLE` in unserem `public`-Schema, andere Teams sehen das nicht
- Schreibrechte über die API nur auf `product_action` + `rework` — alle anderen Seed-Tabellen read-only
- Der dev-server läuft als Background-Task; hot-reload funktioniert, aber nach strukturellen Änderungen lieber einmal `curl -sI http://localhost:3000/` checken
- Twemoji-SVGs werden live von `cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/<code>.svg` geladen — offline-Demo würde die brauchen

## Referenz-Dokumente

- [manex-base/docs/CASE.md](manex-base/docs/CASE.md) — Challenge + Bewertungskriterien
- [manex-base/docs/SCHEMA.md](manex-base/docs/SCHEMA.md) — ER-Diagramm, 19 Tabellen
- [manex-base/docs/DATA_PATTERNS.md](manex-base/docs/DATA_PATTERNS.md) — die 4 Root-Cause-Stories
- [manex-base/docs/API_REFERENCE.md](manex-base/docs/API_REFERENCE.md) — PostgREST + Auth
- [manex-base/docs/QUICKSTART.md](manex-base/docs/QUICKSTART.md) — Team-Setup
- [manex-base/supabase/migrations/00001_create_schema.sql](manex-base/supabase/migrations/00001_create_schema.sql) — Ground-Truth Schema
- [manex-base/supabase/migrations/00002_create_views.sql](manex-base/supabase/migrations/00002_create_views.sql) — 4 Convenience-Views
