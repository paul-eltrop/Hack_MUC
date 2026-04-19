// Hook für die Investigations-Liste — fetcht den Agent-Snapshot
// (geteilt mit dem Flow-Canvas) und fällt auf die hartgecodeten
// Demo-Investigations aus data.ts zurück, wenn der Snapshot leer ist.

"use client";

import { investigations as defaultInvestigations, type Investigation } from "./data";
import { useAgentState } from "./_flow/agent-state";
import { pickInvestigations } from "./_flow/applyAgentState";

export function useInvestigations(): Investigation[] {
  const snap = useAgentState();
  return pickInvestigations(snap, defaultInvestigations);
}
