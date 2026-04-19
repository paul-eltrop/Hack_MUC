// Helper: nimmt die hardgecodeten Layout-Konstanten + den Agent-Snapshot
// und liefert ausschließlich Snapshot-Inhalte. Wenn der Agent nichts geliefert
// hat, sehen die Komponenten leere Inputs (errorCount=0, leere Listen).
// Die Mock-Fallback-Strategie ist bewusst entfernt — Demo soll ehrlich live wirken.

import type {
  ArticleInfo,
  AtRiskProduct,
  FactoryDetailData,
  FieldClaimEntry,
  SupplierDetailData,
  TopFlowNode,
} from "./flow-data";
import type { Investigation } from "../data";
import type { AgentSnapshot } from "./agent-state";

export function applyNodeOverrides(
  baseNodes: TopFlowNode[],
  snap: AgentSnapshot | null,
): TopFlowNode[] {
  return baseNodes.map((n) => {
    const ov = snap?.nodes?.[n.id];
    return {
      ...n,
      data: {
        ...n.data,
        errorCount: ov?.errorCount ?? 0,
        subtitle: ov?.subtitle ?? n.data.subtitle,
      },
    };
  });
}

export function pickSupplierDetail(
  snap: AgentSnapshot | null,
  supplierId: string,
  _fallback?: SupplierDetailData,
): SupplierDetailData | undefined {
  return snap?.supplierDetails?.[supplierId];
}

export function pickFactoryDetail(
  snap: AgentSnapshot | null,
  factoryId: string,
  _fallback?: FactoryDetailData,
): FactoryDetailData | undefined {
  return snap?.factoryDetails?.[factoryId];
}

export function pickArticleCatalog(
  snap: AgentSnapshot | null,
  _fallback?: ArticleInfo[],
): ArticleInfo[] {
  return snap?.articleCatalog ?? [];
}

export function pickFieldClaims(
  snap: AgentSnapshot | null,
  _fallback?: FieldClaimEntry[],
): FieldClaimEntry[] {
  return snap?.fieldClaims ?? [];
}

export function pickAtRisk(
  snap: AgentSnapshot | null,
  _fallback?: AtRiskProduct[],
): AtRiskProduct[] {
  return snap?.atRiskProducts ?? [];
}

export function pickInvestigations(
  snap: AgentSnapshot | null,
  fallback?: Investigation[],
): Investigation[] {
  const agentInvestigations = snap?.investigations ?? [];
  if (agentInvestigations.length > 0) return agentInvestigations;
  return fallback ?? [];
}
