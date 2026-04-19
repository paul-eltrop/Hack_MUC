// Proxies investigation closure summaries to the Python portal for RAG ingestion.

export const runtime = "nodejs";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const res = await fetch(`${PORTAL_URL}/investigation/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Portal unreachable" }, { status: 503 });
  }
}
