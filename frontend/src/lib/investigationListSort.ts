// Gemeinsame Sortierung für Investigation-Zeilen: Dringlichkeit, Aktualität oder Risiko.
// Tie-Breaker über id hält die Reihenfolge bei Gleichstand deterministisch.
// Von Investigations- und Errors-Seite genutzt; nur numerische Vergleichsfelder nötig.

export type InvestigationSortKey = "urgency" | "creation_date" | "estimated_risk";

export type InvestigationSortableRow = {
  id: string;
  priority: number;
  riskEuros: number;
  hoursSinceUpdate: number;
};

function tieBreak<T extends InvestigationSortableRow>(a: T, b: T) {
  return a.id.localeCompare(b.id);
}

export function sortInvestigationRows<T extends InvestigationSortableRow>(
  rows: T[],
  sortKey: InvestigationSortKey
): T[] {
  const sorted = [...rows];
  if (sortKey === "urgency") {
    sorted.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if (b.riskEuros !== a.riskEuros) return b.riskEuros - a.riskEuros;
      return tieBreak(a, b);
    });
  } else if (sortKey === "creation_date") {
    sorted.sort((a, b) => {
      if (a.hoursSinceUpdate !== b.hoursSinceUpdate) return a.hoursSinceUpdate - b.hoursSinceUpdate;
      return tieBreak(a, b);
    });
  } else {
    sorted.sort((a, b) => {
      if (b.riskEuros !== a.riskEuros) return b.riskEuros - a.riskEuros;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return tieBreak(a, b);
    });
  }
  return sorted;
}
