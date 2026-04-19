// Pie-Chart "Problemtypen" (supply / technical_process / technical_design / personnel / other).
// Click auf Segment triggert onSegmentClick(type-key) fuer das Drilldown-Panel.

"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ProblemTypeBucket } from "../_flow/agent-state";
import { PROBLEM_TYPE_COLORS } from "./chart-colors";

type Props = {
  data: ProblemTypeBucket[];
  onSegmentClick: (typeKey: string) => void;
};

export function ProblemTypePieChart({ data, onSegmentClick }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-gray-400">
        Keine Daten im Zeitraum
      </div>
    );
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={95}
            paddingAngle={2}
            onClick={(entry: ProblemTypeBucket) => onSegmentClick(entry.type)}
            className="cursor-pointer"
          >
            {data.map((entry) => (
              <Cell
                key={entry.type}
                fill={PROBLEM_TYPE_COLORS[entry.type] ?? "#9ca3af"}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} Faelle`, name]}
            contentStyle={{ borderRadius: 8, border: "1px solid #f0f0f0", fontSize: 12 }}
          />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            wrapperStyle={{ fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
