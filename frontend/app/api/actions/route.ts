// Generates investigation action cards: RAG retrieval for past similar cases + LLM synthesis.
// Returns a JSON array of suggested action strings grounded in historical context.

export const runtime = "nodejs";

import type { Investigation } from "../../data";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8000";

async function fetchRagContext(investigation: Investigation): Promise<string> {
  const query = `${investigation.title}. ${investigation.rootCause}`;
  try {
    const res = await fetch(`${PORTAL_URL}/investigation/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, investigation_id: investigation.id }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return "";
    const chunks = await res.json() as { text: string; source: string }[];
    if (!chunks.length) return "";
    return chunks.map((c) => `[${c.source}]: ${c.text}`).join("\n\n");
  } catch {
    return "";
  }
}

export async function POST(req: Request) {
  const { investigation } = await req.json() as { investigation: Investigation };

  const ragContext = await fetchRagContext(investigation);

  const systemPrompt = `You are a quality engineering expert at Manex, a manufacturer.
Your task is to generate concrete, actionable corrective and preventive actions for a quality investigation.
${ragContext ? `\nRelevant findings from past investigations and uploaded documents:\n${ragContext}\n\nUse this historical context to ground your recommendations.` : ""}

Respond ONLY with a valid JSON array of strings. Each string is one specific action.
No explanations, no markdown, just the raw JSON array.
Example: ["Action one description.", "Action two description."]

Rules:
- Maximum 6 actions
- Each action is one clear sentence starting with an imperative verb
- Reference specific IDs, parts, suppliers, or processes from the investigation where relevant
- If historical context shows a past solution, reference it explicitly`;

  const userPrompt = `Investigation: ${investigation.id} — ${investigation.title}
Severity: ${investigation.severity}
Summary: ${investigation.summary}
Root cause: ${investigation.rootCause}
Defects: ${investigation.defects}, Field claims: ${investigation.claims}, Risk: €${investigation.risk}
Affected products: ${investigation.affectedProducts.map((p) => p.name).join(", ")}

Generate the action list.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "[]";

  let actions: string[];
  try {
    actions = JSON.parse(raw);
  } catch {
    actions = investigation.suggestedActions;
  }

  return Response.json({
    actions,
    rag_used: ragContext.length > 0,
    rag_chunks: ragContext ? ragContext.split("\n\n").length : 0,
  });
}
