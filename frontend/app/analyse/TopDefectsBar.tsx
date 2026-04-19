// Horizontal bar chart of top-10 defect codes in the selected time window.
// Severity controls color; click opens drilldown with raw defect IDs.

"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TopDefect } from "../_flow/agent-state";
import { defectLabel } from "./defect-labels";

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
        No defects in selected period
      </div>
    );
  }

  const chartData = data.map((entry) => ({
    ...entry,
    label: defectLabel(entry.code),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 24, left: 16, bottom: 4 }}
        >
          <XAxis type="number" stroke="#9ca3af" fontSize={11} />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#9ca3af"
            fontSize={11}
            width={210}
          />
          <Tooltip
            formatter={(value: number) => [`${value} defects`, "Count"]}
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
