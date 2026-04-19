// Horizontaler Bar-Chart der Top-10-Defect-Codes im Zeitfenster.
// Severity steuert die Farbe; Klick oeffnet Drilldown mit den rohen defect-Ids.

"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopDefect } from "../_flow/agent-state";

const severityColor: Record<string, string> = {
  critical: "#dc2626",
  high: "#d97706",
  medium: "#0ea5e9",
  low: "#9ca3af",
};

type Props = {
  data: TopDefect[];
  onBarClick: (code: string) => void;
};

export function TopDefectsBar({ data, onBarClick }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-gray-400">
        Keine Defekte im Zeitraum
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 16, bottom: 4 }}
        >
          <XAxis type="number" stroke="#9ca3af" fontSize={11} />
          <YAxis
            type="category"
            dataKey="code"
            stroke="#9ca3af"
            fontSize={11}
            width={140}
          />
          <Tooltip
            formatter={(value: number) => [`${value} Defekte`, "Anzahl"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", fontSize: 12 }}
          />
          <Bar
            dataKey="count"
            radius={[0, 4, 4, 0]}
            onClick={(entry: TopDefect) => onBarClick(entry.code)}
            className="cursor-pointer"
          >
            {data.map((entry) => (
              <Cell
                key={entry.code}
                fill={severityColor[entry.severity ?? "low"] ?? severityColor.low}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
