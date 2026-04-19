// Dynamische Route: eine Investigation öffnet die Detailseite mit eingebettetem Root-Cause-Flow.
// Die ID entspricht den Keys in investigationDetailMeta und den Zeilen-IDs auf der Übersicht.
// Client-Page liest useParams, damit keine async-params-Abhängigkeit vom Next-Router nötig ist.

"use client";

import { useParams } from "next/navigation";

import InvestigationDetailPage from "@/components/stitch/Investigations/InvestigationDetailPage";

export default function InvestigationDetailRoutePage() {
  const params = useParams();
  const raw = params?.id;
  const id = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";

  return <InvestigationDetailPage investigationId={id} />;
}
