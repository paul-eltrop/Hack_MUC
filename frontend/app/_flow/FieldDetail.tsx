"use client";

import { useMemo } from "react";
import {
  affectedArticles,
  atRiskProducts,
  fieldClaims,
  type AffectedArticle,
  type AtRiskProduct,
  type AtRiskReason,
  type FieldClaimEntry,
} from "./flow-data";
import { TWEMOJI_BASE } from "./flow-nodes";

const REASON_LABEL: Record<AtRiskReason, string> = {
  supply: "Supply",
  design: "Design",
};

const REASON_TINT: Record<AtRiskReason, string> = {
  supply: "border-orange-200 bg-orange-50/60",
  design: "border-amber-200 bg-amber-50/60",
};

const REASON_BADGE: Record<AtRiskReason, string> = {
  supply: "bg-orange-500 text-white",
  design: "bg-amber-500 text-white",
};

export function FieldDetail() {
  const articles = useMemo(() => affectedArticles(), []);
  const totalClaims = fieldClaims.length;
  const totalAtRisk = atRiskProducts.length;
  const totalProducts = new Set([
    ...fieldClaims.map((c) => c.productId),
    ...atRiskProducts.map((r) => r.productId),
  ]).size;
  const totalMarkets = new Set([
    ...fieldClaims.map((c) => c.market),
    ...atRiskProducts.map((r) => r.market),
  ]).size;

  return (
    <div className="absolute inset-0 flex flex-col p-8 pointer-events-none">
      <div className="pointer-events-auto mb-6 flex items-end justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Field
          </div>
          <h1 className="text-2xl font-bold text-zinc-900">
            Kunden · Field-Claims & Risiko-Population
          </h1>
          <div className="text-sm text-zinc-600">
            {totalClaims} Claims · {totalAtRisk} latent at-risk ·{" "}
            {totalProducts} Products gesamt · {totalMarkets} Märkte ·{" "}
            {articles.length} Articles
          </div>
        </div>
      </div>

      <div className="flex-1 pointer-events-auto min-h-0 overflow-y-auto pr-1 space-y-5">
        {articles.map((art) => (
          <ArticleClaimsBlock key={art.articleId} article={art} />
        ))}
      </div>
    </div>
  );
}

function ArticleClaimsBlock({ article }: { article: AffectedArticle }) {
  const productCount = new Set([
    ...article.claims.map((c) => c.productId),
    ...article.atRisk.map((r) => r.productId),
  ]).size;
  return (
    <section className="rounded-2xl border border-zinc-300 bg-white/80 backdrop-blur-[2px] shadow-sm">
      <header className="flex items-center gap-3 px-5 py-3 border-b border-zinc-200">
        <img
          src={`${TWEMOJI_BASE}/${article.emojiCode}.svg`}
          alt=""
          width={36}
          height={36}
          draggable={false}
          className="select-none drop-shadow-sm shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono text-zinc-500">
            {article.articleId}
          </div>
          <h2 className="text-base font-bold text-zinc-900 leading-tight">
            {article.name}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Stat label="Claims" value={article.claims.length} accent="rose" />
          <Stat label="Risiko" value={article.atRisk.length} accent="amber" />
          <Stat label="Products" value={productCount} accent="zinc" />
        </div>
      </header>

      {article.claims.length > 0 && (
        <SubBlock label="Reklamiert" sublabel="Kunde hat gemeldet" tone="rose">
          <Grid>
            {article.claims.map((c) => (
              <ClaimCard key={c.claimId} claim={c} />
            ))}
          </Grid>
        </SubBlock>
      )}

      {article.atRisk.length > 0 && (
        <SubBlock
          label="Risiko-Population"
          sublabel="Bekanntes Issue, kein Claim — proaktive Maßnahme nötig"
          tone="amber"
        >
          <Grid>
            {article.atRisk.map((r) => (
              <AtRiskCard key={r.productId} risk={r} />
            ))}
          </Grid>
        </SubBlock>
      )}
    </section>
  );
}

function SubBlock({
  label,
  sublabel,
  tone,
  children,
}: {
  label: string;
  sublabel: string;
  tone: "rose" | "amber";
  children: React.ReactNode;
}) {
  const dot = tone === "rose" ? "bg-rose-500" : "bg-amber-500";
  return (
    <div className="px-4 pt-3 pb-4 border-b border-zinc-100 last:border-b-0">
      <div className="flex items-baseline gap-2 mb-2 px-1">
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} aria-hidden />
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-700">
          {label}
        </h3>
        <span className="text-[10px] text-zinc-500">{sublabel}</span>
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
      {children}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "rose" | "amber" | "zinc";
}) {
  const cls =
    accent === "rose"
      ? "bg-rose-50 border-rose-200 text-rose-700"
      : accent === "amber"
        ? "bg-amber-50 border-amber-200 text-amber-700"
        : "bg-zinc-50 border-zinc-200 text-zinc-700";
  return (
    <div className={`rounded-lg border px-2.5 py-1 text-center ${cls}`}>
      <div className="text-base font-bold leading-none">{value}</div>
      <div className="text-[9px] uppercase tracking-widest font-semibold mt-0.5">
        {label}
      </div>
    </div>
  );
}

function ClaimCard({ claim }: { claim: FieldClaimEntry }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 hover:border-zinc-300 hover:shadow-sm transition flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono font-bold text-zinc-900">
          {claim.productId}
        </div>
        <MarketPill market={claim.market} />
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
        <span>{claim.claimId}</span>
        <span>·</span>
        <span>{claim.reportedPart}</span>
        <span>·</span>
        <span>{claim.buildAgeWeeks}w</span>
      </div>
      <div className="text-[11px] text-zinc-700 leading-snug line-clamp-2">
        {claim.complaintText}
      </div>
    </div>
  );
}

function AtRiskCard({ risk }: { risk: AtRiskProduct }) {
  const tint = REASON_TINT[risk.reason];
  const badge = REASON_BADGE[risk.reason];
  return (
    <div
      className={`rounded-lg border px-2.5 py-2 hover:shadow-sm transition flex flex-col gap-1.5 ${tint}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-mono font-bold text-zinc-900">
          {risk.productId}
        </div>
        <span
          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badge}`}
        >
          {REASON_LABEL[risk.reason]}
        </span>
      </div>
      <div className="text-[11px] font-medium text-zinc-800 leading-snug">
        {risk.reasonDetail}
      </div>
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500">
        <span>Build {risk.buildAgeWeeks}w</span>
        <span>·</span>
        <MarketPill market={risk.market} />
      </div>
    </div>
  );
}

function MarketPill({ market }: { market: string }) {
  return (
    <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 border border-zinc-200">
      {market}
    </span>
  );
}
