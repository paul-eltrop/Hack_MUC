"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowKind, FlowNodeData } from "./flow-data";

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

export const NODE_W = 220;
export const NODE_H = 170;

export const kindLabel: Record<FlowKind, string> = {
  supplier: "Supplier",
  factory: "Factory",
  field: "Field",
};

export function FlowNode({ data }: NodeProps) {
  const d = data as FlowNodeData;
  const hasError = d.errorCount > 0;

  return (
    <div
      className="relative flex flex-col items-center text-center cursor-pointer"
      style={{ width: NODE_W, height: NODE_H }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ opacity: 0 }}
      />
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {kindLabel[d.kind]}
      </div>
      <div className="text-sm font-semibold text-zinc-900 leading-tight mt-0.5">
        {d.title}
      </div>
      <div className="relative mt-1">
        <img
          src={`${TWEMOJI_BASE}/${d.emojiCode}.svg`}
          alt={d.title}
          width={92}
          height={92}
          draggable={false}
          className="select-none drop-shadow-sm"
        />
        <div
          className={`absolute -top-1 -right-2 min-w-[34px] h-8 px-2 rounded-full flex items-center justify-center text-sm font-bold shadow-md ring-2 ring-white ${
            hasError ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-500"
          }`}
        >
          {d.errorCount}
        </div>
      </div>
      {d.subtitle && (
        <div className="text-[11px] text-zinc-600 mt-1 leading-tight">
          {d.subtitle}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ opacity: 0 }}
      />
    </div>
  );
}

export const nodeTypes = { flow: FlowNode };
