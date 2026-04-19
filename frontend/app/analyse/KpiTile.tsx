// Eine KPI-Kachel im Analytics-Grid.
// Label oben (uppercase tracking-widest), Wert gross, optional Unit/Hint darunter.

type Props = {
  label: string;
  value: string;
  hint?: string;
  accent?: "gray" | "red" | "amber" | "blue" | "green";
};

const accentClass: Record<NonNullable<Props["accent"]>, string> = {
  gray: "text-gray-950",
  red: "text-red-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
  green: "text-green-600",
};

export function KpiTile({ label, value, hint, accent = "gray" }: Props) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-2">{label}</p>
      <p className={`text-3xl font-bold tracking-tight ${accentClass[accent]}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
    </div>
  );
}
