"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { FlowNodeData, NodeKind } from "./flow-data";

const TWEMOJI_BASE =
  "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";

const styles: Record<NodeKind, { code: string; label: string }> = {
  supplier: { code: "1f3ed", label: "Supplier" },
  batch: { code: "1f4e6", label: "Batch" },
  part: { code: "1f529", label: "Part" },
  machine: { code: "2699", label: "Machine" },
  product: { code: "1f527", label: "Product" },
  defect: { code: "26a0", label: "Defect" },
  claim: { code: "1f4ee", label: "Field Claim" },
  test: { code: "1f9ea", label: "Test" },
  action: { code: "1f4cc", label: "Action" },
};

function twemojiUrl(code: string) {
  return `${TWEMOJI_BASE}/${code}.svg`;
}

export function EntityNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  const s = styles[d.kind];
  return (
    <div
      className={`w-[160px] flex flex-col items-center text-center transition-all ${
        selected ? "scale-[1.05]" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2 !h-2 !bg-zinc-400 !border-0"
      />

      {/* Title */}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {s.label}
      </div>
      <div className="text-sm font-semibold text-zinc-900 leading-tight mt-0.5">
        {d.label}
      </div>

      {/* Illustration */}
      <img
        src={twemojiUrl(s.code)}
        alt={s.label}
        width={88}
        height={88}
        draggable={false}
        className={`select-none mt-2 transition-all ${
          selected ? "drop-shadow-md" : ""
        }`}
      />

      {/* Details */}
      {(d.sub || d.meta) && (
        <div className="mt-2 leading-tight">
          {d.sub && (
            <div className="text-xs text-zinc-700">{d.sub}</div>
          )}
          {d.meta && (
            <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
              {d.meta}
            </div>
          )}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!w-2 !h-2 !bg-zinc-400 !border-0"
      />
    </div>
  );
}

export function ActionNode({ data, selected }: NodeProps) {
  const d = data as FlowNodeData;
  return (
    <div
      className={`w-[140px] flex flex-col items-center text-center rotate-[-2deg] transition-all ${
        selected ? "scale-[1.05]" : ""
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-yellow-500 !border-0"
      />
      <div className="text-[10px] font-semibold uppercase tracking-widest text-yellow-700">
        Action
      </div>
      <img
        src={twemojiUrl("1f4cc")}
        alt="action"
        width={64}
        height={64}
        draggable={false}
        className="select-none mt-1 drop-shadow-sm"
      />
      <div className="text-xs font-semibold text-zinc-800 mt-1">
        {d.label}
      </div>
      {d.sub && (
        <div className="text-[10px] text-zinc-500 mt-0.5">{d.sub}</div>
      )}
    </div>
  );
}

export const nodeTypes = {
  entity: EntityNode,
  action: ActionNode,
};
