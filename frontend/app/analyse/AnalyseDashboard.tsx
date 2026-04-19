// Dashboard client for /analyse.
// Orchestrates KPIs, pie charts, top-defects bar, and drilldown panel.

"use client";

import { useMemo, useState } from "react";
import { useAnalytics } from "./useAnalytics";
import { KpiTile } from "./KpiTile";
import { DefectPieChart } from "./DefectPieChart";
import { ProblemTypePieChart } from "./ProblemTypePieChart";
import { TopDefectsBar } from "./TopDefectsBar";
import { DrilldownPanel, type DrilldownSelection } from "./DrilldownPanel";
import { defectLabel } from "./defect-labels";

function formatHours(h: number): string {
  if (h >= 100) return `${Math.round(h)} h`;
  if (h >= 10) return `${h.toFixed(1)} h`;
  return `${h.toFixed(1)} h`;
}

function formatEur(v: number): string {
  if (v >= 1_000_000) return `€${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `€${(v / 1_000).toFixed(1)}k`;
  return `€${v}`;
}

export function AnalyseDashboard() {
  const analytics = useAnalytics();
  const [selection, setSelection] = useState<DrilldownSelection | null>(null);

  const kpiRow = useMemo(() => {
    if (!analytics) return null;
    const { kpis } = analytics;
    const topCode = kpis.topDefects[0]?.code;
    return (
      <div className="grid grid-cols-2 gap-px bg-gray-100 rounded-2xl overflow-hidden md:grid-cols-3 lg:grid-cols-5">
        <KpiTile
          label="Time Saved"
          value={formatHours(kpis.timeSavedHours)}
          hint={`via ${analytics.windowDays}-day repeat detection`}
          accent="green"
        />
        <KpiTile
          label="Money Saved"
          value={formatEur(kpis.moneySavedEur)}
          hint={`${kpis.preventedClaims} prevented claims`}
          accent="green"
        />
        <KpiTile
          label="Avg. Resolution"
          value={`${kpis.avgResolutionHours.toFixed(1)} h`}
          hint="Defect → Rework"
        />
        <KpiTile
          label="Issues 30d"
          value={`${kpis.issuesLast30Days}`}
          hint="Defects + claims"
          accent={kpis.issuesLast30Days > 50 ? "amber" : "gray"}
        />
        <KpiTile
          label="Top Defect"
          value={topCode ? defectLabel(topCode) : "—"}
          hint={`${kpis.topDefects[0]?.count ?? 0} cases`}
          accent="red"
        />
      </div>
    );
  }, [analytics]);

  if (!analytics) {
    return <EmptyState />;
  }

  return (
    <div className="min-h-screen bg-white animate-slide-up">
      <div className="max-w-6xl mx-auto px-6 pt-10 pb-20">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
            Manex · Quality Co-Pilot
          </p>
          <div className="flex items-baseline justify-between">
            <h1 className="text-4xl font-bold tracking-tight text-gray-950">Analytics</h1>
            <span className="text-xs text-gray-400">
              {analytics.windowDays}-day window · updated{" "}
              {new Date(analytics.computedAt).toLocaleString("en-US", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {analytics.kpis.narrative ? (
            <p className="mt-3 text-sm text-gray-700 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
              <span className="font-semibold text-blue-600 mr-2">AI</span>
              {analytics.kpis.narrative}
            </p>
          ) : null}
        </div>

        <section className="mb-10">{kpiRow}</section>

        <section className="grid grid-cols-1 gap-6 mb-10 lg:grid-cols-2">
          <ChartCard title="Defects by Product Group" subtitle="Click for defect IDs">
            <DefectPieChart
              data={analytics.charts.defectsByProductGroup}
              onSegmentClick={(articleId) => {
                const bucket = analytics.charts.defectsByProductGroup.find(
                  (b) => b.articleId === articleId,
                );
                if (!bucket) return;
                setSelection({
                  title: bucket.name,
                  subtitle: `${bucket.articleId} · ${bucket.count} defects`,
                  items: bucket.defects,
                  accent: "red",
                });
              }}
            />
          </ChartCard>

          <ChartCard title="Problem Types" subtitle="Classified by root cause">
            <ProblemTypePieChart
              data={analytics.charts.problemTypes}
              onSegmentClick={(typeKey) => {
                const bucket = analytics.charts.problemTypes.find((b) => b.type === typeKey);
                if (!bucket) return;
                const accentMap = {
                  supply: "red",
                  technical_process: "amber",
                  technical_design: "purple",
                  personnel: "blue",
                  other: "gray",
                } as const;
                setSelection({
                  title: bucket.label,
                  subtitle: `${bucket.count} cases`,
                  items: bucket.defects,
                  accent: accentMap[bucket.type] ?? "gray",
                });
              }}
            />
          </ChartCard>
        </section>

        <ChartCard title="Top 10 Defect Codes" subtitle="Last 90 days">
          <TopDefectsBar
            data={analytics.kpis.topDefects}
            onBarClick={(code) => {
              const entry = analytics.kpis.topDefects.find((d) => d.code === code);
              if (!entry) return;
              setSelection({
                title: defectLabel(code),
                subtitle: `Severity: ${entry.severity ?? "—"}`,
                items: [],
                accent: entry.severity === "critical" ? "red" : "amber",
              });
            }}
          />
        </ChartCard>

        <footer className="mt-10 text-xs text-gray-400">
          Assumptions: {analytics.assumptions.hourlyReworkRateEur} €/h rework rate ·{" "}
          {analytics.assumptions.preventedClaimCostEur.toLocaleString("en-US")} € per prevented
          field claim
        </footer>
      </div>

      <DrilldownPanel selection={selection} onClose={() => setSelection(null)} />
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-2xl p-6 bg-white">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-950">{title}</h2>
        {subtitle ? <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-6 pt-24 text-center">
        <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
          Manex · Quality Co-Pilot
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-gray-950 mb-4">Analytics</h1>
        <p className="text-sm text-gray-500 mb-6">
          No analytics computed yet. Start{" "}
          <code className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-700 text-xs">
            python3 -m agent_service.refresh
          </code>{" "}
          to populate KPIs and charts.
        </p>
      </div>
    </div>
  );
}
