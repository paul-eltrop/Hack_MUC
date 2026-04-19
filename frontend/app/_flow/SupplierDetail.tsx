"use client";

import { useMemo, useState } from "react";
import {
  flaggedPartsInBatch,
  supplierDetails,
  type BatchRow,
  type PartMasterInfo,
} from "./flow-data";
import { NODE_W, TWEMOJI_BASE } from "./flow-nodes";
import { useAgentState } from "./agent-state";
import { pickSupplierDetail } from "./applyAgentState";

const DATE_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const MONTH_FMT = new Intl.DateTimeFormat("de-DE", { month: "short" });

function formatDate(iso: string) {
  return DATE_FMT.format(new Date(iso));
}

const ARROW_W = 40;
const PM_COL_W = NODE_W + ARROW_W;
const LANE_H = 130;
const TIME_HEADER_H = 60;

type Granularity = "year" | "month" | "week";

const GRANULARITY_LABELS: Record<Granularity, string> = {
  year: "Jahre",
  month: "Monate",
  week: "Wochen",
};

const UNIT_WIDTH: Record<Granularity, number> = {
  year: 280,
  month: 100,
  week: 48,
};

type YearSpan = { year: number; start: number; end: number };
type Scale = { start: number; end: number };

type Props = {
  supplierId: string;
  selectedBatchId: string | null;
  onSelectBatch: (id: string) => void;
};

type PmGroup = { pm: PartMasterInfo; batches: BatchRow[] };

export function SupplierDetail({
  supplierId,
  selectedBatchId,
  onSelectBatch,
}: Props) {
  const snap = useAgentState();
  const data = pickSupplierDetail(snap, supplierId, supplierDetails[supplierId]);
  const [granularity, setGranularity] = useState<Granularity>("month");

  const { pmGroups, scale, years, ticks } = useMemo(() => {
    if (!data) {
      return {
        pmGroups: [] as PmGroup[],
        scale: { start: 0, end: 1 } as Scale,
        years: [] as YearSpan[],
        ticks: [] as Date[],
      };
    }

    const groups = new Map<string, BatchRow[]>();
    for (const batch of data.batches) {
      const arr = groups.get(batch.partNumber) ?? [];
      arr.push(batch);
      groups.set(batch.partNumber, arr);
    }
    for (const arr of groups.values()) {
      arr.sort(
        (a, b) =>
          new Date(a.receivedDate).getTime() -
          new Date(b.receivedDate).getTime(),
      );
    }
    const pmGroupsList: PmGroup[] = data.partMasters
      .map((pm) => ({ pm, batches: groups.get(pm.partNumber) ?? [] }))
      .filter((g) => g.batches.length > 0);
    pmGroupsList.sort((a, b) => {
      const af = a.batches.reduce((s, x) => s + flaggedPartsInBatch(x), 0);
      const bf = b.batches.reduce((s, x) => s + flaggedPartsInBatch(x), 0);
      return bf - af;
    });

    const times = data.batches.map((b) => new Date(b.receivedDate).getTime());
    const s = computeScale(
      Math.min(...times),
      Math.max(...times),
      granularity,
    );

    const yearsList: YearSpan[] = [];
    const startYear = new Date(s.start).getFullYear();
    const endYear = new Date(s.end).getFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const ys = Math.max(s.start, new Date(y, 0, 1).getTime());
      const ye = Math.min(s.end, new Date(y + 1, 0, 1).getTime() - 1);
      yearsList.push({ year: y, start: ys, end: ye });
    }

    const tickList = generateTicks(s, granularity);

    return {
      pmGroups: pmGroupsList,
      scale: s,
      years: yearsList,
      ticks: tickList,
    };
  }, [data, granularity]);

  if (!data) return null;

  const minTimelineW = Math.max(
    400,
    ticks.length * UNIT_WIDTH[granularity],
  );

  return (
    <div className="absolute inset-0 flex flex-col p-8 pointer-events-none">
      <div className="pointer-events-auto mb-6 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Lieferant
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {data.supplierName}
          </h1>
          <div className="text-sm text-zinc-600">
            {data.supplierId} · {data.country} · {data.batches.length} Lieferungen ·{" "}
            {data.partMasters.length} Part-Typen
          </div>
        </div>
        <GranularitySwitcher
          value={granularity}
          onChange={setGranularity}
        />
      </div>

      <div className="flex-1 pointer-events-auto min-h-0 flex items-start gap-4">
        <div
          className="shrink-0 flex flex-col"
          style={{ width: PM_COL_W }}
        >
          <div style={{ height: TIME_HEADER_H }} />
          {pmGroups.map((g) => (
            <div
              key={g.pm.partNumber}
              style={{ height: LANE_H }}
              className="flex items-center"
            >
              <PMNode pm={g.pm} batches={g.batches} />
              <ArrowConnector />
            </div>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden border border-zinc-400/70 rounded-xl bg-white/30 backdrop-blur-[2px] shadow-sm">
          <div
            className="relative"
            style={{ minWidth: minTimelineW }}
          >
            <GridLines
              scale={scale}
              ticks={ticks}
              years={years}
              granularity={granularity}
            />
            <TimeAxis
              scale={scale}
              ticks={ticks}
              years={years}
              granularity={granularity}
            />
            {pmGroups.map((g) => (
              <LaneTrack
                key={g.pm.partNumber}
                batches={g.batches}
                scale={scale}
                selectedBatchId={selectedBatchId}
                onSelect={onSelectBatch}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GranularitySwitcher({
  value,
  onChange,
}: {
  value: Granularity;
  onChange: (g: Granularity) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-300 bg-white/70 backdrop-blur text-xs overflow-hidden shadow-sm">
      {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
        <button
          key={g}
          onClick={() => onChange(g)}
          className={`px-3 py-1.5 font-medium transition ${
            value === g
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100"
          }`}
        >
          {GRANULARITY_LABELS[g]}
        </button>
      ))}
    </div>
  );
}

function GridLines({
  scale,
  ticks,
  years,
  granularity,
}: {
  scale: Scale;
  ticks: Date[];
  years: YearSpan[];
  granularity: Granularity;
}) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {ticks.map((tick, i) => {
        const xPct = xPos(tick.getTime(), scale);
        const isMonthStart =
          tick.getDate() === 1 && granularity !== "year";
        const lineClass =
          granularity === "year" || isMonthStart
            ? "w-px bg-zinc-300"
            : "w-px bg-zinc-200";
        return (
          <div
            key={i}
            className={`absolute top-0 bottom-0 ${lineClass}`}
            style={{ left: `${xPct}%` }}
          />
        );
      })}
      {/* Year boundaries above everything else — thicker */}
      {years.slice(1).map((y) => (
        <div
          key={y.year}
          className="absolute top-0 bottom-0 w-[2px] bg-zinc-400"
          style={{ left: `${xPos(y.start, scale)}%` }}
        />
      ))}
    </div>
  );
}

function TimeAxis({
  scale,
  ticks,
  years,
  granularity,
}: {
  scale: Scale;
  ticks: Date[];
  years: YearSpan[];
  granularity: Granularity;
}) {
  return (
    <div
      className="relative border-b-2 border-zinc-400/70"
      style={{ height: TIME_HEADER_H }}
    >
      <div className="relative h-7 border-b border-zinc-300">
        {years.map((y) => {
          const centerPct = (xPos(y.start, scale) + xPos(y.end, scale)) / 2;
          return (
            <div
              key={y.year}
              className="absolute top-1.5 text-sm font-bold text-zinc-800 whitespace-nowrap"
              style={{
                left: `${centerPct}%`,
                transform: "translateX(-50%)",
              }}
            >
              {y.year}
            </div>
          );
        })}
      </div>
      <div className="relative h-7">
        {ticks.map((tick, i) => {
          if (granularity === "week" && i % 2 !== 0) return null;
          const xPct = xPos(tick.getTime(), scale);
          return (
            <div
              key={i}
              className="absolute top-1.5 text-[10px] uppercase tracking-widest text-zinc-600 font-semibold whitespace-nowrap pl-1.5"
              style={{ left: `${xPct}%` }}
            >
              {labelFor(tick, granularity)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LaneTrack({
  batches,
  scale,
  selectedBatchId,
  onSelect,
}: {
  batches: BatchRow[];
  scale: Scale;
  selectedBatchId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      style={{ height: LANE_H }}
      className="relative border-t border-zinc-300/70"
    >
      {batches.map((batch) => (
        <BatchPill
          key={batch.batchId}
          batch={batch}
          xPct={xPos(new Date(batch.receivedDate).getTime(), scale)}
          selected={selectedBatchId === batch.batchId}
          onClick={() => onSelect(batch.batchId)}
        />
      ))}
    </div>
  );
}

function PMNode({
  pm,
  batches,
}: {
  pm: PartMasterInfo;
  batches: BatchRow[];
}) {
  const totalFlagged = batches.reduce(
    (sum, b) => sum + flaggedPartsInBatch(b),
    0,
  );
  const hasError = totalFlagged > 0;
  return (
    <div
      className="shrink-0 flex flex-col items-center text-center"
      style={{ width: NODE_W }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
        {pm.commodity}
      </div>
      <div className="text-sm font-semibold text-zinc-900 leading-tight mt-0.5 px-2 line-clamp-1">
        {pm.title}
      </div>
      <div className="relative mt-1">
        <img
          src={`${TWEMOJI_BASE}/${pm.emojiCode}.svg`}
          alt=""
          width={56}
          height={56}
          draggable={false}
          className="select-none drop-shadow-sm"
        />
        <div
          className={`absolute -top-1 -right-2 min-w-[28px] h-6 px-1.5 rounded-full flex items-center justify-center text-xs font-bold shadow-md ring-2 ring-white ${
            hasError ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-500"
          }`}
        >
          {totalFlagged}
        </div>
      </div>
      <div className="text-[10px] font-mono text-zinc-500 mt-0.5">
        {pm.partNumber}
      </div>
    </div>
  );
}

function BatchPill({
  batch,
  xPct,
  selected,
  onClick,
}: {
  batch: BatchRow;
  xPct: number;
  selected: boolean;
  onClick: () => void;
}) {
  const flagged = flaggedPartsInBatch(batch);
  const hasError = flagged > 0;
  return (
    <button
      onClick={onClick}
      style={{ left: `${xPct}%` }}
      title={`${batch.batchId} · ${formatDate(batch.receivedDate)} · ${batch.qty} Stück${
        hasError ? ` · ${flagged} flagged` : ""
      }`}
      className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer transition ${
        selected
          ? "scale-[1.15] z-10"
          : "opacity-90 hover:opacity-100 hover:scale-[1.05]"
      }`}
    >
      <div className="relative">
        <img
          src={`${TWEMOJI_BASE}/1f4e6.svg`}
          alt=""
          width={48}
          height={48}
          draggable={false}
          className="select-none drop-shadow-sm"
        />
        <div
          className={`absolute -top-1 -right-1.5 min-w-[22px] h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold shadow ring-2 ring-white ${
            hasError ? "bg-red-500 text-white" : "bg-zinc-200 text-zinc-500"
          }`}
        >
          {flagged}
        </div>
      </div>
      <div className="text-[10px] font-mono font-semibold text-zinc-700 mt-1 whitespace-nowrap">
        {batch.batchId}
      </div>
      <div className="text-[10px] text-zinc-500 whitespace-nowrap">
        {formatDate(batch.receivedDate)}
      </div>
    </button>
  );
}

function ArrowConnector() {
  return (
    <svg
      className="shrink-0"
      width={ARROW_W}
      height={12}
      viewBox={`0 0 ${ARROW_W} 12`}
      aria-hidden
    >
      <line
        x1={0}
        y1={6}
        x2={ARROW_W - 12}
        y2={6}
        stroke="#71717a"
        strokeWidth={1.5}
      />
      <polygon
        points={`${ARROW_W - 12},0 ${ARROW_W},6 ${ARROW_W - 12},12`}
        fill="#71717a"
      />
    </svg>
  );
}

function xPos(t: number, scale: Scale): number {
  return ((t - scale.start) / (scale.end - scale.start)) * 100;
}

function computeScale(
  minT: number,
  maxT: number,
  granularity: Granularity,
): Scale {
  const minD = new Date(minT);
  const maxD = new Date(maxT);

  if (granularity === "year") {
    const start = new Date(minD.getFullYear(), 0, 1).getTime();
    const end = new Date(maxD.getFullYear() + 1, 0, 1).getTime() - 1;
    return { start, end };
  }
  if (granularity === "month") {
    const start = new Date(minD.getFullYear(), minD.getMonth(), 1).getTime();
    const end =
      new Date(maxD.getFullYear(), maxD.getMonth() + 1, 1).getTime() - 1;
    return { start, end };
  }
  // week: snap to Monday start and Sunday end.
  const start = new Date(minD);
  start.setHours(0, 0, 0, 0);
  const startOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - startOffset);
  const end = new Date(maxD);
  end.setHours(23, 59, 59, 999);
  const endOffset = (end.getDay() + 6) % 7;
  end.setDate(end.getDate() + (6 - endOffset));
  return { start: start.getTime(), end: end.getTime() };
}

function generateTicks(scale: Scale, granularity: Granularity): Date[] {
  const ticks: Date[] = [];
  const cursor = new Date(scale.start);
  cursor.setHours(0, 0, 0, 0);

  if (granularity === "year") {
    cursor.setMonth(0);
    cursor.setDate(1);
  } else if (granularity === "month") {
    cursor.setDate(1);
  } else {
    // week: Monday
    const day = cursor.getDay();
    const offset = (day + 6) % 7;
    cursor.setDate(cursor.getDate() - offset);
  }

  while (cursor.getTime() <= scale.end) {
    ticks.push(new Date(cursor));
    if (granularity === "year") {
      cursor.setFullYear(cursor.getFullYear() + 1);
    } else if (granularity === "month") {
      cursor.setMonth(cursor.getMonth() + 1);
    } else {
      cursor.setDate(cursor.getDate() + 7);
    }
  }

  return ticks;
}

function labelFor(tick: Date, granularity: Granularity): string {
  if (granularity === "year") return String(tick.getFullYear());
  if (granularity === "month") return MONTH_FMT.format(tick);
  return `KW ${isoWeek(tick)}`;
}

function isoWeek(d: Date): number {
  const date = new Date(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()),
  );
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
}
