// Detailansicht einer Investigation: TopBar, kompakter Zurück-Link, Tabs Root Causes / Tasks, Stepper.
// Stepper zweite Phase heißt Tasks (Zuweisungen); kein Stakeholder-Routing mehr im Wording.
// Root-Causes-Tab zeigt den eingebetteten Flow; Tasks-Tab bleibt Platzhalter bis zur Umsetzung.

"use client";

import { useState } from "react";
import Link from "next/link";

import FlowView from "@/app/_flow/FlowView";
import { getInvestigationDetailMeta } from "@/lib/investigationDetailMeta";

import TopBar from "./TopBar";

const HERO_BORDER_BG = `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='%23C1C7D0FF' stroke-width='3' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`;

type Props = { investigationId: string };

type DetailTab = "roots" | "tasks";

const backLinkClass =
  "inline-flex items-center gap-0.5 text-sm font-medium text-[#00426d] hover:text-sky-900 transition-colors";

export default function InvestigationDetailPage({ investigationId }: Props) {
  const [detailTab, setDetailTab] = useState<DetailTab>("roots");
  const meta = getInvestigationDetailMeta(investigationId);

  if (!meta) {
    return (
      <div className="bg-[#f8f9ff] text-on-surface font-body min-h-screen">
        <TopBar />
        <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 pt-24 pb-16">
          <p className="text-slate-600 mb-3">Unbekannte Investigation.</p>
          <Link href="/investigations" className={backLinkClass} aria-label="Zurück zur Investigations-Liste">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-[#f8f9ff] font-body text-on-surface antialiased min-h-screen">
      <TopBar />

      <div className="pt-20 bg-white/40 border-b border-slate-200/40">
        <div className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 py-2">
          <Link href="/investigations" className={backLinkClass} aria-label="Zurück zur Investigations-Liste">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
          <div className="mt-2 flex gap-6">
            <button
              type="button"
              onClick={() => setDetailTab("roots")}
              className={`py-2.5 text-sm transition-all border-b-2 ${
                detailTab === "roots"
                  ? "font-bold border-amber-400 text-[#00426d]"
                  : "font-medium border-transparent text-slate-500 hover:text-[#00426d]"
              }`}
            >
              Root Causes
            </button>
            <button
              type="button"
              onClick={() => setDetailTab("tasks")}
              className={`py-2.5 text-sm transition-all border-b-2 ${
                detailTab === "tasks"
                  ? "font-bold border-amber-400 text-[#00426d]"
                  : "font-medium border-transparent text-slate-500 hover:text-[#00426d]"
              }`}
            >
              Tasks
            </button>
          </div>
        </div>
      </div>

      <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 py-8 pb-20">
        <div className="mb-8">
          <p className="text-[11px] font-bold tracking-widest text-[#fdba49] uppercase font-label mb-1.5">
            STEP 1 OF 2
          </p>
          <div className="flex gap-2 mb-2 max-w-4xl">
            <div className="h-1.5 flex-1 bg-[#00426d] rounded-full" />
            <div className="h-1.5 flex-1 bg-slate-200 rounded-full" />
          </div>
          <div className="flex justify-between max-w-4xl text-xs uppercase tracking-widest mb-8">
            <span className="text-[#00426d] font-bold">Problem Analysis</span>
            <span className="text-slate-400 font-medium">Tasks</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-headline font-extrabold tracking-tight text-[#00426d] mb-4 max-w-5xl">
            {meta.title}
          </h1>
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${meta.severityBgClass}`}>
              <span className={`w-2 h-2 rounded-full ${meta.severityDotClass}`} />
              <span className="text-xs font-bold uppercase tracking-wider">{meta.severityLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-sm">payments</span>
              <span className="text-slate-600 font-body font-semibold text-sm">{meta.impactDisplay}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-sm">schedule</span>
              <span className="text-slate-600 font-body text-sm">{meta.detectedLabel}</span>
            </div>
          </div>
        </div>

        {detailTab === "roots" ? (
          <div
            className="bg-white p-4 sm:p-6 relative overflow-hidden shadow-sm"
            style={{ backgroundImage: HERO_BORDER_BG, borderRadius: "16px" }}
          >
            <div
              className="absolute inset-0 opacity-[0.07] pointer-events-none rounded-2xl"
              style={{
                backgroundImage: "radial-gradient(circle, #94a3b8 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <div className="relative z-[1] min-h-[420px]">
              <FlowView embedded />
            </div>
          </div>
        ) : (
          <div className="bg-white min-h-[320px] flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm font-medium">
            Hier können Aufgaben zugewiesen und nachverfolgt werden — Inhalt folgt.
          </div>
        )}
      </main>
    </div>
  );
}
