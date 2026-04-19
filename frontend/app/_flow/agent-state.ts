// Client-side hook: pollt /agent_state.json alle 10 Sekunden.
// Liefert ein typisiertes Snapshot-Objekt; bei leerem/fehlendem File
// gibt es null zurück und die Detail-Komponenten fallen auf ihre
// hardgecodeten defaultContent-Imports zurück.

"use client";

import { useEffect, useState } from "react";
import type {
  ArticleInfo,
  AtRiskProduct,
  FactoryDetailData,
  FieldClaimEntry,
  SupplierDetailData,
} from "./flow-data";
import type { Investigation } from "../data";

export type NodeOverride = {
  errorCount?: number;
  subtitle?: string;
};

export type AgentSnapshot = {
  schemaVersion: number;
  generatedAt: string | null;
  model: string | null;
  runId: string | null;
  summary: string | null;
  nodes: Record<string, NodeOverride>;
  supplierDetails: Record<string, SupplierDetailData>;
  factoryDetails: Record<string, FactoryDetailData>;
  articleCatalog: ArticleInfo[];
  fieldClaims: FieldClaimEntry[];
  atRiskProducts: AtRiskProduct[];
  investigations: Investigation[];
};

const POLL_INTERVAL_MS = 10_000;

function isPopulated(snap: AgentSnapshot | null): boolean {
  if (!snap) return false;
  if (!snap.generatedAt) return false;
  return (
    Object.keys(snap.nodes).length > 0 ||
    snap.investigations.length > 0 ||
    snap.fieldClaims.length > 0 ||
    snap.articleCatalog.length > 0
  );
}

export function useAgentState(): AgentSnapshot | null {
  const [snap, setSnap] = useState<AgentSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/agent_state.json?ts=${Date.now()}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data: AgentSnapshot = await res.json();
        if (!cancelled && isPopulated(data)) {
          setSnap(data);
        }
      } catch {
        // ignore — fallback wird verwendet
      }
    }

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return snap;
}
