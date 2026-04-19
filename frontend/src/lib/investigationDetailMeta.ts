// Statische Kopfzeilen-Metadaten pro Investigation-ID für die Detailroute unter /investigations/[id].
// Titel und Kennzahlen entsprechen der Liste auf der Investigations-Übersichtsseite.
// Unbekannte IDs behandeln die Detailseite mit Fallback und Link zurück zur Übersicht.

import type { InvestigationPriority } from "@/components/stitch/Investigations/investigationPriority";

export type InvestigationDetailMeta = {
  title: string;
  priority: InvestigationPriority;
  impactDisplay: string;
  detectedLabel: string;
  severityLabel: string;
  severityDotClass: string;
  severityBgClass: string;
};

export const INVESTIGATION_DETAIL_META: Record<string, InvestigationDetailMeta> = {
  c12: {
    title: "C12 Capacitor Failure — ElektroParts",
    priority: 1,
    impactDisplay: "€8,300 Estimated Impact",
    detectedLabel: "Detected 2 hours ago",
    severityLabel: "CRITICAL",
    severityDotClass: "bg-error",
    severityBgClass: "bg-red-50 text-error",
  },
  screws: {
    title: "Loose Screws on Assembly Line 1",
    priority: 2,
    impactDisplay: "€2,100 Estimated Impact",
    detectedLabel: "Detected yesterday",
    severityLabel: "HIGH",
    severityDotClass: "bg-amber-500",
    severityBgClass: "bg-amber-50 text-amber-800",
  },
  r33: {
    title: "R33 Resistor Thermal Drift",
    priority: 2,
    impactDisplay: "€4,800 Estimated Impact",
    detectedLabel: "Detected 4 hours ago",
    severityLabel: "HIGH",
    severityDotClass: "bg-amber-500",
    severityBgClass: "bg-amber-50 text-amber-800",
  },
  visual: {
    title: "False Positives at Visual Inspection",
    priority: 3,
    impactDisplay: "€0 Estimated Impact",
    detectedLabel: "Detected 3 days ago",
    severityLabel: "MODERATE",
    severityDotClass: "bg-yellow-500",
    severityBgClass: "bg-yellow-50 text-yellow-800",
  },
  torque: {
    title: "Torque wrench recalibration — Montage Linie 1",
    priority: 4,
    impactDisplay: "€450 Estimated Impact",
    detectedLabel: "Detected 1 week ago",
    severityLabel: "LOW",
    severityDotClass: "bg-emerald-500",
    severityBgClass: "bg-emerald-50 text-emerald-800",
  },
  cosmetic: {
    title: "Cosmetic packaging marks — operator handling",
    priority: 5,
    impactDisplay: "€120 Estimated Impact",
    detectedLabel: "Detected 2 weeks ago",
    severityLabel: "MINIMAL",
    severityDotClass: "bg-slate-400",
    severityBgClass: "bg-slate-100 text-slate-700",
  },
};

export function getInvestigationDetailMeta(id: string): InvestigationDetailMeta | null {
  return INVESTIGATION_DETAIL_META[id] ?? null;
}
