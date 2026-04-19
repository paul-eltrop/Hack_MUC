// Proxies file uploads to the Python portal for RAG indexing

export const runtime = "nodejs";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const formData = await req.formData();

  const portalForm = new FormData();
  portalForm.append("investigation_id", formData.get("investigation_id") as string);
  portalForm.append("file", formData.get("file") as Blob, (formData.get("file") as File).name);

  try {
    const res = await fetch(`${PORTAL_URL}/investigation/upload`, {
      method: "POST",
      body: portalForm,
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ ok: false, error: "Portal unreachable" }, { status: 503 });
  }
}
