// Hook wrapper: pickt den analytics-Block aus dem Snapshot.
// Liefert null solange der Agent noch nicht frisch computed hat.

"use client";

import { useAgentState } from "../_flow/agent-state";
import type { AnalyticsBlock } from "../_flow/agent-state";

export function useAnalytics(): AnalyticsBlock | null {
  const snap = useAgentState();
  return snap?.analytics ?? null;
}
