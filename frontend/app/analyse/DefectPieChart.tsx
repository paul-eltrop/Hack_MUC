// Pie-Chart "Defekte nach Produktgruppe".
// Click auf Segment triggert onSegmentClick(articleId) fuer das Drilldown-Panel.

"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { DefectsByProductGroup } from "../_flow/agent-state";
import { PRODUCT_GROUP_COLORS } from "./chart-colors";

type Props = {
  data: DefectsByProductGroup[];
  onSegmentClick: (articleId: string) => void;
};

export function DefectPieChart({ data, onSegmentClick }: Props) {
  if (data.length === 0) {
    return <EmptyState text="Keine Defekte im Zeitraum" />;
  }

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={95}
            paddingAngle={2}
            onClick={(entry: DefectsByProductGroup) => onSegmentClick(entry.articleId)}
            className="cursor-pointer"
          >
            {data.map((entry, idx) => (
              <Cell
                key={entry.articleId}
                fill={PRODUCT_GROUP_COLORS[idx % PRODUCT_GROUP_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number, name: string) => [`${value} Defekte`, name]}
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

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-72 items-center justify-center text-sm text-gray-400">
      {text}
    </div>
  );
}
