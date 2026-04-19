"use client";

import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useInvestigations } from "./useInvestigations";

// FlowView nutzt @xyflow/react — client-only via dynamic import.
const FlowView = dynamic(() => import("./_flow/FlowView"), { ssr: false });

type Filter = "All" | "Critical" | "Not Assigned" | "Assigned";

const FILTERS: Filter[] = ["Critical", "Not Assigned", "Assigned", "All"];

const NOT_ASSIGNED_STATUSES = new Set(["Action Required", "Awaiting Owner"]);
const ASSIGNED_STATUSES = new Set(["In Progress", "Monitoring"]);

function applyFilter(filter: Filter, investigations: ReturnType<typeof useInvestigations>) {
  if (filter === "Critical") return investigations.filter((i) => i.severity === "critical");
  if (filter === "Not Assigned") return investigations.filter((i) => NOT_ASSIGNED_STATUSES.has(i.status));
  if (filter === "Assigned") return investigations.filter((i) => ASSIGNED_STATUSES.has(i.status));
  return investigations;
}

const severityBar: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-amber-500",
  low: "bg-gray-300",
};

const statusPill: Record<string, string> = {
  "Action Required": "bg-red-50 text-red-600",
  "Awaiting Owner": "bg-amber-50 text-amber-700",
  "In Progress": "bg-blue-50 text-blue-700",
  "Monitoring": "bg-gray-100 text-gray-500",
};

export default function Home() {
  const investigations = useInvestigations();
  const [filter, setFilter] = useState<Filter>("Critical");
  const visible = applyFilter(filter, investigations);
  const totalRisk = investigations.reduce((s, i) => s + i.risk, 0);
  const criticalCount = investigations.filter((i) => i.severity === "critical").length;

  return (
    <div
      className="flex bg-white overflow-hidden"
      style={{ height: "calc(100vh - 64px)" }}
    >
      {/* LEFT: Investigations-Liste, scrollt eigenständig */}
      <aside className="w-[680px] flex-shrink-0 overflow-y-auto border-r border-gray-100">
        <div className="px-6">

        <div className="pt-12 pb-8">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
            Manex · Quality Co-Pilot
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-gray-950 leading-tight">
            Investigations
          </h1>
        </div>

        <div className="grid grid-cols-3 gap-px bg-gray-100 rounded-2xl overflow-hidden mb-5">
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Open cases</p>
            <p className="text-2xl font-bold text-gray-950">{investigations.length}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Critical</p>
            <p className="text-2xl font-bold text-red-600">{criticalCount}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Est. risk</p>
            <p className="text-2xl font-bold text-gray-950">€{(totalRisk / 1000).toFixed(1)}k</p>
          </div>
        </div>

        {/* Filter chips */}
        <div style={{ height: 20 }} />
        <div className="flex items-center gap-2 mb-1 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 ${
                filter === f
                  ? "bg-gray-950 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="divide-y divide-gray-100">
          {visible.length === 0 && (
            <p className="py-10 text-sm text-gray-400 text-center">No investigations match this filter.</p>
          )}
          {visible.map((inv) => (
            <Link key={inv.id} href={`/investigations/${inv.id}`} className="py-6 flex gap-4 group block">
              <div className="pt-1 flex-shrink-0">
                <div className={`w-1 h-14 rounded-full ${severityBar[inv.severity]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-4 mb-1">
                  <div>
                    <span className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase">
                      {inv.source}
                    </span>
                    <h2 className="text-base font-semibold text-gray-950 group-hover:text-black">
                      {inv.title}
                    </h2>
                  </div>
                  <span className="text-[11px] text-gray-400 flex-shrink-0 pt-px">{inv.age}</span>
                </div>
                <p className="text-sm text-gray-500 leading-snug mb-3">{inv.summary}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    {inv.defects > 0 && <span>{inv.defects} defects</span>}
                    {inv.claims > 0 && <span>{inv.claims} field claims</span>}
                    <span className="font-semibold text-gray-700">€{inv.risk.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}</span>
                  </div>
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${statusPill[inv.status]}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 flex items-center text-gray-200 group-hover:text-gray-400 transition-colors">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="h-16" />
        </div>
      </aside>

      {/* RIGHT: Flow-Canvas (Suppliers/Factories/Articles/Field) */}
      <main className="flex-1 relative min-w-0">
        <FlowView />
      </main>
    </div>
  );
}
