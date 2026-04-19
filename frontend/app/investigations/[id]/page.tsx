"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";

import { useInvestigations } from "../../useInvestigations";

const severityColor: Record<string, string> = {
  critical: "bg-red-600",
  high: "bg-amber-500",
  low: "bg-gray-400",
};

const severityLabel: Record<string, string> = {
  critical: "Critical",
  high: "High",
  low: "Low",
};

const timelineDot: Record<string, string> = {
  defect: "bg-red-500",
  claim: "bg-amber-500",
  action: "bg-blue-500",
  detection: "bg-gray-400",
};

export default function InvestigationDetail() {
  const { id } = useParams<{ id: string }>();
  const investigations = useInvestigations();
  const inv = investigations.find((i) => i.id === id);
  if (!inv) notFound();

  return (
    <div className="min-h-screen bg-white animate-slide-up">
      <div className="max-w-2xl mx-auto px-6">

        {/* Back nav */}
        <div className="pt-10 pb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Investigations
          </Link>
        </div>

        {/* Title block */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className={`inline-block w-2 h-2 rounded-full ${severityColor[inv.severity]}`} />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              {severityLabel[inv.severity]} · {inv.id}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950 mb-1">{inv.title}</h1>
          <p className="text-sm text-gray-400">{inv.source} · {inv.age}</p>
        </div>

        {/* Impact metrics */}
        <div className="grid grid-cols-3 gap-px bg-gray-100 rounded-2xl overflow-hidden mb-10">
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Defects</p>
            <p className="text-2xl font-bold text-gray-950">{inv.defects}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Field claims</p>
            <p className="text-2xl font-bold text-gray-950">{inv.claims}</p>
          </div>
          <div className="bg-white px-5 py-4">
            <p className="text-xs text-gray-400 mb-1">Est. risk</p>
            <p className="text-2xl font-bold text-gray-950">€{inv.risk.toLocaleString()}</p>
          </div>
        </div>

        {/* Root cause — LLM block */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Root Cause Analysis</p>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">AI generated</span>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">{inv.rootCause}</p>
        </section>

        {/* Timeline */}
        <section className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">Timeline</p>
          <div className="relative">
            <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-100" />
            <div className="space-y-5">
              {inv.timeline.map((event, i) => (
                <div key={i} className="flex gap-4">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`w-[11px] h-[11px] rounded-full border-2 border-white ring-1 ring-gray-200 ${timelineDot[event.type]}`} />
                  </div>
                  <div className="flex-1 pb-1">
                    <p className="text-[11px] font-semibold text-gray-400 mb-0.5">{event.date}</p>
                    <p className="text-sm text-gray-700">{event.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Affected products */}
        <section className="mb-10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Affected Products</p>
          <div className="space-y-2">
            {inv.affectedProducts.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5 border-b border-gray-50">
                <span className="text-sm text-gray-700">{p.name}</span>
                <span className="text-xs font-mono text-gray-400">{p.id}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Suggested actions */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Suggested Actions</p>
            <span className="text-[10px] font-semibold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">AI generated</span>
          </div>
          <div className="space-y-3">
            {inv.suggestedActions.map((action, i) => (
              <div key={i} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-950 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-700 leading-snug">{action}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm pt-4 pb-8 -mx-6 px-6">
          <Link href={`/investigations/${inv.id}/action`} className="block w-full bg-gray-950 text-white text-sm font-semibold py-4 rounded-2xl hover:bg-gray-800 transition-colors text-center">
            Create Action
          </Link>
        </div>

      </div>
    </div>
  );
}
