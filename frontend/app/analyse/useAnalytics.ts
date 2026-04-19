// Hook wrapper: picks the analytics block from the snapshot.
// Returns null until the agent has computed fresh analytics.

"use client";

import { useAgentState } from "../_flow/agent-state";
import type { AnalyticsBlock } from "../_flow/agent-state";

export function useAnalytics(): AnalyticsBlock | null {
  const snap = useAgentState();
  return snap?.analytics ?? null;
}
