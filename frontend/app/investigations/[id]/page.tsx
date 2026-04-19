// Investigation detail page — delegates all rendering to InvestigationDetailClient.
// Stays as a server component for params resolution and notFound handling.

import { notFound } from "next/navigation";
import { investigations } from "../../data";
import InvestigationDetailClient from "./InvestigationDetailClient";

export default async function InvestigationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = investigations.find((i) => i.id === id);
  if (!inv) notFound();

  return <InvestigationDetailClient inv={inv} />;
}
