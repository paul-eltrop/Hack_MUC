// Investigations-Liste: Crucial/All und Statusfilter (inkl. Assigned-Not Started) linksbündig unter der Überschrift.
// Status per erneutem Klick auf dieselbe Option wieder aufheben (any); Sortierung über investigationListSort.
// Daten bleiben statisch bis zur API-Anbindung.

"use client";

import { type ReactNode, useMemo, useState } from "react";

import TopBar from "./TopBar";
import InvestigationCard from "./InvestigationCard";
import {
  type InvestigationPriority,
  isCrucialPriority,
  priorityStyles,
} from "./investigationPriority";
import {
  type InvestigationSortKey,
  sortInvestigationRows,
} from "@/lib/investigationListSort";

type TabKey = "all" | "crucial";

type AssignmentStatus = "not_assigned" | "assigned" | "in_progress";

type StatusFilterKey = "any" | AssignmentStatus;

type Row = {
  id: string;
  priority: InvestigationPriority;
  assignmentStatus: AssignmentStatus;
  hoursSinceUpdate: number;
  riskEuros: number;
  title: string;
  time: string;
  assignment: ReactNode;
  progressWidth: string;
  progressColor: string;
  risk: string;
  badge?: ReactNode;
  ring?: string;
  leftStripeClass?: string;
};

export default function InvestigationsPage() {
  const [tab, setTab] = useState<TabKey>("crucial");
  const [statusFilter, setStatusFilter] = useState<StatusFilterKey>("any");
  const [sortKey, setSortKey] = useState<InvestigationSortKey>("urgency");

  const rows: Row[] = useMemo(
    () => [
      {
        id: "c12",
        priority: 1,
        assignmentStatus: "not_assigned",
        hoursSinceUpdate: 2,
        riskEuros: 8300,
        title: "C12 Capacitor Failure — ElektroParts",
        badge: (
          <div className="flex items-center bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold gap-1 animate-pulse">
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              warning
            </span>
            <span>ACTION REQUIRED</span>
          </div>
        ),
        time: "2 hours ago",
        assignment: (
          <span className="flex items-center gap-1 text-amber-600 font-bold">
            <span className="material-symbols-outlined text-sm">assignment</span>
            12 Field Claims · Motor Controller MC-200
          </span>
        ),
        progressWidth: "w-3/4",
        progressColor: "bg-[#00426d]",
        risk: "€8,300",
        leftStripeClass: "bg-error",
      },
      {
        id: "screws",
        priority: 2,
        assignmentStatus: "in_progress",
        hoursSinceUpdate: 26,
        riskEuros: 2100,
        title: "Loose Screws on Assembly Line 1",
        time: "Yesterday",
        assignment: (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">assignment</span>
            20 Defects · End-of-Line Vibration Test
          </span>
        ),
        progressWidth: "w-1/4",
        progressColor: "bg-[#00426d]",
        risk: "€2,100",
        leftStripeClass: "bg-amber-500",
      },
      {
        id: "r33",
        priority: 2,
        assignmentStatus: "assigned",
        hoursSinceUpdate: 4,
        riskEuros: 4800,
        title: "R33 Resistor Thermal Drift",
        badge: (
          <div className="text-red-400 flex items-center gap-0.5">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              priority_high
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Staff</span>
          </div>
        ),
        time: "4 hours ago",
        assignment: (
          <span className="flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">
            <span className="material-symbols-outlined text-sm">assignment</span>
            5 Field Claims · MC-200 Performance Loss
          </span>
        ),
        progressWidth: "w-0",
        progressColor: "bg-slate-300",
        risk: "€4,800",
        ring: "ring-2 ring-red-100",
        leftStripeClass: "bg-amber-500",
      },
      {
        id: "visual",
        priority: 3,
        assignmentStatus: "assigned",
        hoursSinceUpdate: 72,
        riskEuros: 0,
        title: "False Positives at Visual Inspection",
        badge: (
          <div className="text-amber-500">
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              priority_high
            </span>
          </div>
        ),
        time: "3 days ago",
        assignment: (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-amber-500">assignment</span>
            10 Defects · No confirmed failures
          </span>
        ),
        progressWidth: "w-full",
        progressColor: "bg-[#00426d]",
        risk: "€0",
        leftStripeClass: "bg-yellow-500",
      },
      {
        id: "torque",
        priority: 4,
        assignmentStatus: "assigned",
        hoursSinceUpdate: 168,
        riskEuros: 450,
        title: "Torque wrench recalibration — Montage Linie 1",
        time: "1 week ago",
        assignment: (
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">assignment</span>
            3 Defects · VIB_FAIL trend resolved
          </span>
        ),
        progressWidth: "w-full",
        progressColor: "bg-[#00426d]",
        risk: "€450",
        leftStripeClass: "bg-emerald-500",
      },
      {
        id: "cosmetic",
        priority: 5,
        assignmentStatus: "in_progress",
        hoursSinceUpdate: 336,
        riskEuros: 120,
        title: "Cosmetic packaging marks — operator handling",
        time: "2 weeks ago",
        assignment: (
          <span className="flex items-center gap-1 text-slate-500">
            <span className="material-symbols-outlined text-sm">assignment</span>
            8 Defects · PO-00012, PO-00018
          </span>
        ),
        progressWidth: "w-2/3",
        progressColor: "bg-slate-400",
        risk: "€120",
        leftStripeClass: "bg-slate-400",
      },
    ],
    []
  );

  const visibleRows = useMemo(() => {
    let list = rows.filter((r) =>
      tab === "crucial" ? isCrucialPriority(r.priority) : true
    );
    if (statusFilter !== "any") {
      list = list.filter((r) => r.assignmentStatus === statusFilter);
    }
    return sortInvestigationRows(list, sortKey);
  }, [rows, tab, statusFilter, sortKey]);

  const selectTab = (key: TabKey) => {
    setTab(key);
    setStatusFilter("any");
  };

  const tabBtn = (key: TabKey, label: string) => {
    const active = tab === key;
    return (
      <button
        type="button"
        onClick={() => selectTab(key)}
        className={`pb-1.5 text-xs sm:text-sm transition-colors border-b-2 ${
          active
            ? "font-semibold text-[#00426d] border-amber-400"
            : "font-medium text-slate-400 border-transparent hover:text-[#00426d]"
        }`}
      >
        {label}
      </button>
    );
  };

  const statusBtn = (key: AssignmentStatus, label: string) => {
    const active = statusFilter === key;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter((prev) => (prev === key ? "any" : key))}
        className={`text-xs sm:text-sm transition-colors ${
          active ? "font-semibold text-[#00426d]" : "font-medium text-slate-400 hover:text-[#00426d]"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="bg-[#f8f9ff] text-on-surface font-body min-h-screen">
      <TopBar />

      <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 pt-[88px] pb-10">
        <div className="w-full ring-1 ring-[#00426d]/10 rounded-2xl p-4 sm:p-5 lg:p-6 bg-white/40 shadow-sm">
          <div className="mb-3 border-b border-slate-200/70 pb-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#00426d] mb-2 font-headline">
              Investigations
            </h1>
            <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap items-end gap-x-4 sm:gap-x-5">
                {tabBtn("crucial", "Crucial")}
                {tabBtn("all", "All")}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="material-symbols-outlined text-slate-500 text-[16px]">sort</span>
                <span className="text-[11px] font-semibold text-slate-500">Sort</span>
                <select
                  value={sortKey}
                  onChange={(e) => setSortKey(e.target.value as InvestigationSortKey)}
                  className="text-[11px] font-bold text-[#00426d] bg-transparent border-none focus:ring-0 cursor-pointer py-0 pr-5 pl-0 max-w-[9.5rem] sm:max-w-none"
                >
                  <option value="urgency">Urgency</option>
                  <option value="creation_date">Newest</option>
                  <option value="estimated_risk">Risk</option>
                </select>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap justify-start items-center gap-x-3 sm:gap-x-4 gap-y-1">
              {statusBtn("not_assigned", "Not Assigned")}
              {statusBtn("assigned", "Assigned-Not Started")}
              {statusBtn("in_progress", "In Progress")}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 px-3 sm:px-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="col-span-1">Priority</div>
            <div className="col-span-8">Investigation Details</div>
            <div className="col-span-2 text-right">Estimated Risk</div>
            <div className="col-span-1" />
          </div>

          {visibleRows.length === 0 ? (
            <p className="text-sm text-slate-500 px-3 py-6">
              Keine Investigations für die gewählte Kombination aus Ansicht, Status und Sortierung.
            </p>
          ) : (
            <div className="space-y-2">
              {visibleRows.map((row) => {
                const ps = priorityStyles(row.priority);
                const stripe = row.leftStripeClass ?? ps.defaultStripe;
                return (
                  <InvestigationCard
                    key={row.id}
                    priority={row.priority}
                    priorityLabel={ps.label}
                    priorityColor={ps.priorityColor}
                    dotColor={ps.dotColor}
                    title={row.title}
                    badge={row.badge}
                    time={row.time}
                    assignment={row.assignment}
                    progressWidth={row.progressWidth}
                    progressColor={row.progressColor}
                    risk={row.risk}
                    ring={row.ring}
                    leftStripeClass={stripe}
                    detailHref={`/investigations/${row.id}`}
                  />
                );
              })}
            </div>
          )}
        </div>
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
