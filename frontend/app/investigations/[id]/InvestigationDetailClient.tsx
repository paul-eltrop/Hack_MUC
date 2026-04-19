// Client wrapper for investigation detail — holds reactive timeline state updated via chat.
// Renders the two-column layout and passes a timeline callback to InvestigationChat.

"use client";

import { useState } from "react";
import type { Investigation, TimelineEvent } from "../../data";

type TimelineUpdate = TimelineEvent & { find_text: string };
import InvestigationChat from "./InvestigationChat";
import Link from "next/link";

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

export default function InvestigationDetailClient({ inv }: { inv: Investigation }) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>(inv.timeline);
  const [highlightedIdx, setHighlightedIdx] = useState<number | null>(null);

  function addTimelineEvent(event: TimelineEvent) {
    setTimeline((prev) => {
      const sorted = [...prev, event].sort((a, b) => a.date.localeCompare(b.date));
      const newIdx = sorted.findIndex((e) => e === event);
      setHighlightedIdx(newIdx);
      setTimeout(() => setHighlightedIdx(null), 3000);
      return sorted;
    });
  }

  function updateTimelineEvent({ find_text, date, event, type }: TimelineUpdate) {
    setTimeline((prev) => {
      const idx = prev.findIndex((e) =>
        e.event.toLowerCase().includes(find_text.toLowerCase())
      );
      if (idx === -1) {
        addTimelineEvent({ date, event, type });
        return prev;
      }
      const updated = prev.map((e, i) => (i === idx ? { date, event, type } : e));
      const sorted = [...updated].sort((a, b) => a.date.localeCompare(b.date));
      const newIdx = sorted.findIndex((e) => e.date === date && e.event === event);
      setHighlightedIdx(newIdx);
      setTimeout(() => setHighlightedIdx(null), 3000);
      return sorted;
    });
  }

  return (
    <>
      <div className="min-h-screen bg-white pb-40">
        <div className="max-w-6xl mx-auto px-8">

          <div className="pt-10 pb-6 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Investigations
            </Link>
            <Link href={`/investigations/${inv.id}/action`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
              Create Action
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>

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

          <div className="grid grid-cols-5 gap-12">

            <div className="col-span-3 space-y-10">
              <div className="grid grid-cols-3 gap-px bg-gray-100 rounded-2xl overflow-hidden">
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
                  <p className="text-2xl font-bold text-gray-950">
                    €{inv.risk.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}
                  </p>
                </div>
              </div>

              <section>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Root Cause Analysis</p>
                  <span className="text-[10px] font-semibold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full">AI generated</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{inv.rootCause}</p>
              </section>

              <section>
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
            </div>

            <div className="col-span-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-6">Timeline</p>
              <div className="relative">
                <div className="absolute left-[5px] top-2 bottom-2 w-px bg-gray-100" />
                <div className="space-y-6">
                  {timeline.map((event, i) => (
                    <div
                      key={i}
                      className={`flex gap-4 transition-all duration-700 ${
                        highlightedIdx === i ? "opacity-100" : "opacity-100"
                      }`}
                    >
                      <div className="flex-shrink-0 mt-0.5 relative">
                        {highlightedIdx === i && (
                          <span className="absolute inset-0 rounded-full animate-ping bg-blue-400 opacity-75" />
                        )}
                        <div className={`w-[11px] h-[11px] rounded-full border-2 border-white ring-1 ring-gray-200 ${timelineDot[event.type]}`} />
                      </div>
                      <div className={`flex-1 pb-1 rounded-lg transition-colors duration-700 ${highlightedIdx === i ? "bg-blue-50 px-2 -mx-2" : ""}`}>
                        <p className="text-[11px] font-semibold text-gray-400 mb-0.5">{event.date}</p>
                        <p className="text-sm text-gray-700">{event.event}</p>
                        {highlightedIdx === i && (
                          <span className="text-[10px] font-semibold text-blue-500">AI hinzugefügt</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <InvestigationChat inv={inv} onTimelineAdd={addTimelineEvent} onTimelineUpdate={updateTimelineEvent} />
    </>
  );
}
