// Shared investigation data with full detail fields

export type Severity = "critical" | "high" | "low";
export type TimelineEvent = { date: string; event: string; type: "defect" | "claim" | "action" | "detection" };

export type Investigation = {
  id: string;
  severity: Severity;
  title: string;
  source: string;
  summary: string;
  defects: number;
  claims: number;
  risk: number;
  status: string;
  age: string;
  rootCause: string;
  timeline: TimelineEvent[];
  affectedProducts: { id: string; name: string }[];
  suggestedActions: string[];
};

export const investigations: Investigation[] = [
  {
    id: "INV-001",
    severity: "critical",
    title: "Capacitor Batch Failure",
    source: "ElektroParts GmbH · SB-00007",
    summary: "Bad C12 capacitors causing cold solder joints across motor controllers.",
    defects: 25,
    claims: 12,
    risk: 8300,
    status: "Action Required",
    age: "2h ago",
    rootCause:
      "Batch SB-00007 from ElektroParts GmbH (part PM-00008) contains capacitors with non-conforming lead-tin ratios, resulting in cold solder joints during reflow. The defect manifests as SOLDER_COLD failures on the Motor Controller MC-200 board, predominantly at position C12. In-factory AOI detected 25 units; 12 further units escaped to field and generated warranty claims within weeks 5–6 of 2026.",
    timeline: [
      { date: "2026-01-27", event: "Batch SB-00007 received at goods-in, QC passed visual check", type: "action" },
      { date: "2026-02-03", event: "First SOLDER_COLD defect detected at AOI station", type: "defect" },
      { date: "2026-02-05", event: "11 further defects flagged — batch quarantined", type: "defect" },
      { date: "2026-02-10", event: "First field claim received (MC-200 power failure)", type: "claim" },
      { date: "2026-02-14", event: "12 field claims confirmed linked to batch SB-00007", type: "claim" },
      { date: "2026-02-17", event: "Investigation opened · supplier notified", type: "action" },
    ],
    affectedProducts: [
      { id: "PRD-00142", name: "Motor Controller MC-200" },
      { id: "PRD-00158", name: "Motor Controller MC-200" },
      { id: "PRD-00163", name: "Motor Controller MC-200" },
    ],
    suggestedActions: [
      "Issue formal 8D report to ElektroParts GmbH and request root-cause analysis within 5 business days.",
      "Quarantine all remaining units from batch SB-00007 and initiate 100% re-inspection.",
      "Trigger customer recall for the 12 affected field units and arrange replacement shipment.",
    ],
  },
  {
    id: "INV-002",
    severity: "high",
    title: "Torque Wrench Drift",
    source: "Montage Linie 1 · SEC-00001",
    summary: "Calibration drift in weeks 49–52 causing vibration test failures.",
    defects: 20,
    claims: 0,
    risk: 3200,
    status: "In Progress",
    age: "3d ago",
    rootCause:
      "The torque wrench at assembly section SEC-00001 (Augsburg, Montage Linie 1) exhibited progressive calibration drift between weeks 49–52 of 2025. Fasteners applied during this window were under-torqued by an estimated 15–22%, causing looseness that triggered VIB_FAIL at end-of-line vibration testing. The issue self-corrected after the wrench was serviced in January 2026; no affected units reached the field.",
    timeline: [
      { date: "2025-12-02", event: "First VIB_FAIL defect at end-of-line test (week 49)", type: "defect" },
      { date: "2025-12-16", event: "Rate increases to 4 VIB_FAIL per week — not yet flagged", type: "defect" },
      { date: "2026-01-06", event: "Torque wrench calibration check — drift confirmed", type: "detection" },
      { date: "2026-01-07", event: "Wrench replaced, defect rate drops to 0", type: "action" },
      { date: "2026-04-16", event: "Pattern identified in retrospective analysis · investigation opened", type: "action" },
    ],
    affectedProducts: [
      { id: "PRD-00089", name: "Drive Unit DU-400" },
      { id: "PRD-00094", name: "Drive Unit DU-400" },
    ],
    suggestedActions: [
      "Implement weekly calibration log for all torque tools at SEC-00001.",
      "Add SPC control chart for VIB_FAIL rate to catch drift earlier (target: alert at 2σ).",
      "Review rework records for the 20 affected units — confirm all were remediated before shipment.",
    ],
  },
  {
    id: "INV-003",
    severity: "high",
    title: "R33 Thermal Drift",
    source: "Article ART-00001 · BOM pos. R33",
    summary: "Design weakness in resistor PM-00015. Zero in-factory detection — only field.",
    defects: 0,
    claims: 15,
    risk: 4800,
    status: "Awaiting Owner",
    age: "4h ago",
    rootCause:
      "Resistor PM-00015 at BOM position R33 has a thermal drift coefficient that exceeds tolerance under sustained high-load conditions. The failure mode is silent in factory testing (ambient temperature, short test cycles) but manifests as performance degradation in customer environments after 200–400 operating hours. All 15 field claims describe identical symptom: MC-200 output power loss under load. Design change or component substitution required.",
    timeline: [
      { date: "2025-11-14", event: "First field claim: MC-200 performance loss under load", type: "claim" },
      { date: "2026-01-08", event: "5 further claims — pattern flagged by warranty team", type: "claim" },
      { date: "2026-02-20", event: "Engineering analysis: PM-00015 thermal coefficient out of spec", type: "detection" },
      { date: "2026-04-19", event: "15 total claims confirmed · investigation opened", type: "action" },
    ],
    affectedProducts: [
      { id: "PRD-00031", name: "Motor Controller MC-200" },
      { id: "PRD-00047", name: "Motor Controller MC-200" },
    ],
    suggestedActions: [
      "Initiate ECO (Engineering Change Order) to qualify a replacement resistor with tighter thermal spec.",
      "Add thermal soak cycle to end-of-line test profile to surface this failure mode in-factory.",
      "Proactively contact customers with units from affected production window — offer inspection.",
    ],
  },
  {
    id: "INV-004",
    severity: "low",
    title: "Operator Cosmetic Defects",
    source: "Packaging · user_042",
    summary: "Handling damage on PO-00012, PO-00018, PO-00024. Low severity, no field impact.",
    defects: 15,
    claims: 0,
    risk: 900,
    status: "Monitoring",
    age: "1w ago",
    rootCause:
      "Operator user_042 is associated with 15 cosmetic defects (scratches, surface marks) across three production orders. The defects appear during the packaging step and are consistently caught at final visual inspection. No units escaped to field. The pattern suggests improper handling technique or missing protective tooling at the packaging workstation rather than a systemic process failure.",
    timeline: [
      { date: "2026-03-12", event: "3 cosmetic defects on PO-00012 — logged, reworked", type: "defect" },
      { date: "2026-03-26", event: "6 further defects on PO-00018 — same operator shift", type: "defect" },
      { date: "2026-04-09", event: "6 defects on PO-00024 · pattern identified", type: "defect" },
      { date: "2026-04-12", event: "Investigation opened · operator notified for coaching", type: "action" },
    ],
    affectedProducts: [
      { id: "PRD-00201", name: "Drive Unit DU-400" },
      { id: "PRD-00209", name: "Drive Unit DU-400" },
    ],
    suggestedActions: [
      "Schedule targeted handling training for user_042.",
      "Evaluate anti-scratch padding at packaging workstation — low-cost fix.",
      "Monitor defect rate for this operator over the next 4 weeks.",
    ],
  },
];
