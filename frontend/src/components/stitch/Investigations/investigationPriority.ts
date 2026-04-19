// Prioritäts-Styles P1–P5 (Labels, Text-, Punkt- und Streifenfarben) für Investigation-Zeilen.
// Crucial-Filter zeigt nur P1 und P2; alle anderen Stufen bleiben unter „All“ sichtbar.
// Exportiert Typ und Lookup, damit InvestigationsPage nur Daten pflegt.

export type InvestigationPriority = 1 | 2 | 3 | 4 | 5;

const PRIORITY_LOOKUP: Record<
  InvestigationPriority,
  { label: string; priorityColor: string; dotColor: string; defaultStripe: string }
> = {
  1: {
    label: "Highest",
    priorityColor: "text-error",
    dotColor: "bg-error",
    defaultStripe: "bg-error",
  },
  2: {
    label: "Medium",
    priorityColor: "text-amber-600",
    dotColor: "bg-amber-500",
    defaultStripe: "bg-amber-500",
  },
  3: {
    label: "Moderate",
    priorityColor: "text-yellow-700",
    dotColor: "bg-yellow-500",
    defaultStripe: "bg-yellow-500",
  },
  4: {
    label: "Low",
    priorityColor: "text-emerald-600",
    dotColor: "bg-emerald-500",
    defaultStripe: "bg-emerald-500",
  },
  5: {
    label: "Minimal",
    priorityColor: "text-slate-500",
    dotColor: "bg-slate-400",
    defaultStripe: "bg-slate-400",
  },
};

export function priorityStyles(priority: InvestigationPriority) {
  return PRIORITY_LOOKUP[priority];
}

export function isCrucialPriority(priority: InvestigationPriority) {
  return priority === 1 || priority === 2;
}
