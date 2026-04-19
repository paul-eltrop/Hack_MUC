// Proxies proof file downloads from the portal to avoid cross-origin issues.

export const runtime = "nodejs";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8080";

export async function GET(req: Request) {
  const linkId = new URL(req.url).searchParams.get("linkId");
  if (!linkId) return new Response("Missing linkId", { status: 400 });

  try {
    const res = await fetch(`${PORTAL_URL}/share/links/${linkId}/proof-file`);
    if (!res.ok) return new Response("File not found", { status: 404 });

    const disposition = res.headers.get("content-disposition") ?? "attachment";
    const contentType = res.headers.get("content-type") ?? "application/octet-stream";

    return new Response(res.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": disposition,
      },
    });
  } catch {
    return new Response("Portal unreachable", { status: 503 });
  }
}
