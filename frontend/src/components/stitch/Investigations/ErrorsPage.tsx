// Errors-Übersicht mit derselben Sortierlogik wie Investigations über investigationListSort.
// Sort-Dropdown steuert die Reihenfolge der drei Beispielzeilen deterministisch nach Meta-Feldern.
// Crucial/All und Statusfilter bleiben vorerst rein optisch ohne Filterlogik auf dieser Seite.

"use client";

import { useMemo, useState } from "react";

import TopBar from "./TopBar";
import InvestigationCard from "./InvestigationCard";
import {
  type InvestigationSortKey,
  sortInvestigationRows,
} from "@/lib/investigationListSort";

type ErrorRowMeta = {
  id: string;
  priority: number;
  riskEuros: number;
  hoursSinceUpdate: number;
};

const ERROR_ROW_META: ErrorRowMeta[] = [
  { id: "c12", priority: 1, riskEuros: 8300, hoursSinceUpdate: 2 },
  { id: "screws", priority: 2, riskEuros: 2100, hoursSinceUpdate: 26 },
  { id: "r33", priority: 2, riskEuros: 4800, hoursSinceUpdate: 4 },
];

export default function ErrorsPage() {
  const [sortKey, setSortKey] = useState<InvestigationSortKey>("urgency");

  const orderedIds = useMemo(
    () => sortInvestigationRows(ERROR_ROW_META, sortKey).map((r) => r.id),
    [sortKey]
  );

  return (
    <div className="bg-[#f8f9ff] text-on-surface font-body min-h-screen">
      <TopBar />

      <main className="max-w-[1920px] mx-auto px-8 pt-[100px] pb-12 grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-9">
          <div className="ring-1 ring-[#00426d]/10 rounded-3xl p-8 bg-white/40 shadow-sm">
            <div className="mb-8">
              <span className="text-[#573900] font-bold text-[11px] uppercase tracking-[0.2em] mb-2 block">
                OVERVIEW
              </span>
              <h1 className="text-4xl font-extrabold tracking-tighter text-[#00426d] mb-6 font-headline">
                Errors
              </h1>

              <div className="flex flex-col md:flex-row md:items-center justify-between border-surface-container/30">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between border-b border-surface-container/30">
                    <div className="flex gap-8">
                      <button
                        type="button"
                        className="pb-4 text-sm font-semibold text-[#00426d] border-b-2 border-amber-400"
                      >
                        Crucial
                      </button>
                      <button
                        type="button"
                        className="pb-4 text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors"
                      >
                        All
                      </button>
                    </div>
                    <div className="flex items-center gap-4 pb-4">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <span className="material-symbols-outlined text-[18px]">sort</span>
                        <span>Sorting:</span>
                      </div>
                      <select
                        value={sortKey}
                        onChange={(e) => setSortKey(e.target.value as InvestigationSortKey)}
                        className="text-xs font-bold text-[#00426d] bg-transparent border-none focus:ring-0 cursor-pointer p-0"
                      >
                        <option value="urgency">Urgency</option>
                        <option value="creation_date">Creation date (newest)</option>
                        <option value="estimated_risk">Estimated risk</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-8 py-3 mt-1">
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors"
                    >
                      Not Assigned
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors"
                    >
                      Assigned
                    </button>
                    <button
                      type="button"
                      className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors"
                    >
                      In Progress
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6 px-6 mb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="col-span-1">Priority</div>
              <div className="col-span-8">Investigation Details</div>
              <div className="col-span-2 text-right">Estimated Risk</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-4">
              {orderedIds.map((id) =>
                id === "c12" ? (
                  <InvestigationCard
                    key="c12"
                    priority={1}
                    priorityLabel="Highest"
                    priorityColor="text-error"
                    dotColor="bg-error"
                    title="C12 Capacitor Failure — ElektroParts"
                    badge={
                      <div className="flex items-center bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold gap-1 animate-pulse">
                        <span
                          className="material-symbols-outlined text-[14px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          warning
                        </span>
                        <span>ACTION REQUIRED</span>
                      </div>
                    }
                    time="2 hours ago"
                    assignment={
                      <span className="flex items-center gap-1 text-amber-600 font-bold">
                        <span className="material-symbols-outlined text-sm">assignment</span>
                        12 Field Claims · Motor Controller MC-200
                      </span>
                    }
                    progressWidth="w-3/4"
                    progressColor="bg-[#00426d]"
                    risk="€8,300"
                    leftStripeClass="bg-error"
                    detailHref="/investigations/c12"
                  />
                ) : id === "screws" ? (
                  <InvestigationCard
                    key="screws"
                    priority={2}
                    priorityLabel="Medium"
                    priorityColor="text-amber-500"
                    dotColor="bg-amber-400"
                    title="Loose Screws on Assembly Line 1"
                    time="Yesterday"
                    assignment={
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">assignment</span>
                        20 Defects · End-of-Line Vibration Test
                      </span>
                    }
                    progressWidth="w-1/4"
                    progressColor="bg-[#00426d]"
                    risk="€2,100"
                    detailHref="/investigations/screws"
                  />
                ) : (
                  <InvestigationCard
                    key="r33"
                    priority={2}
                    priorityLabel="Medium"
                    priorityColor="text-amber-500"
                    dotColor="bg-amber-400"
                    title="R33 Resistor Thermal Drift"
                    badge={
                      <div className="text-red-400 flex items-center gap-0.5">
                        <span
                          className="material-symbols-outlined text-[20px]"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          priority_high
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Staff</span>
                      </div>
                    }
                    time="4 hours ago"
                    assignment={
                      <span className="flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">
                        <span className="material-symbols-outlined text-sm">assignment</span>
                        5 Field Claims · MC-200 Performance Loss
                      </span>
                    }
                    progressWidth="w-0"
                    progressColor="bg-slate-300"
                    risk="€4,800"
                    ring="ring-2 ring-red-100"
                    detailHref="/investigations/r33"
                  />
                )
              )}
            </div>
          </div>
        </div>
        <aside className="col-span-12 lg:col-span-3" />
      </main>

      <button
        type="button"
        className="fixed bottom-8 right-8 bg-[#00426d] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200"
      >
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
          add
        </span>
      </button>
    </div>
  );
}
