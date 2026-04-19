// Proxies share-link completion status checks to the Python portal.

export const runtime = "nodejs";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return Response.json({ completed: false });
  try {
    const res = await fetch(`${PORTAL_URL}/share/links/${linkId}/status`, {
      signal: AbortSignal.timeout(3000),
    });
    return Response.json(await res.json());
  } catch {
    return Response.json({ completed: false });
  }
}
