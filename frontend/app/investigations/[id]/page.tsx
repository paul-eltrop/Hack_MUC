// Investigation detail page — client component using live useInvestigations hook.
// Delegates all rendering to InvestigationDetailClient.

"use client";

import { notFound, useParams } from "next/navigation";
import { useInvestigations } from "../../useInvestigations";
import InvestigationDetailClient from "./InvestigationDetailClient";

export default function InvestigationDetail() {
  const { id } = useParams<{ id: string }>();
  const investigations = useInvestigations();
  const inv = investigations.find((i) => i.id === id);
  if (!inv) notFound();

  return <InvestigationDetailClient inv={inv} />;
}
