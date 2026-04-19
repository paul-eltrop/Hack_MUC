// Streaming chat API — forwards messages to OpenAI with investigation context + RAG retrieval

import type { Investigation } from "../../data";

export const runtime = "nodejs";

const PORTAL_URL = process.env.PORTAL_URL ?? "http://localhost:8000";

type Message = { role: "user" | "assistant"; content: string };

async function retrieveRagContext(query: string, investigationId: string): Promise<string> {
  try {
    const res = await fetch(`${PORTAL_URL}/investigation/retrieve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, investigation_id: investigationId }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return "";
    const chunks = await res.json() as { text: string; source: string }[];
    if (!chunks.length) return "";
    return "\n\nAdditional context from uploaded documents:\n" +
      chunks.map((c) => `[${c.source}]: ${c.text}`).join("\n\n");
  } catch {
    return "";
  }
}

function buildSystemPrompt(inv: Investigation, ragContext = ""): string {
  return `You are a quality engineering assistant for Manex, a manufacturer. You help analyze quality investigations.

Current investigation:
- ID: ${inv.id}
- Title: ${inv.title}
- Summary: ${inv.summary}
- Severity: ${inv.severity}
- Source: ${inv.source}
- Status: ${inv.status}
- Defects: ${inv.defects}
- Field claims: ${inv.claims}
- Estimated risk: €${inv.risk}
- Root cause: ${inv.rootCause}
- Timeline: ${inv.timeline.map((t) => `${t.date}: ${t.event}`).join("; ")}
- Affected products: ${inv.affectedProducts.map((p) => `${p.name} (${p.id})`).join(", ")}
- Suggested actions: ${inv.suggestedActions.join("; ")}${ragContext}

Answer concisely and precisely. Focus on actionable insights. Respond in the same language the user writes in.

When the user provides information about the timeline, include one of these blocks at the END of your response:

To ADD a genuinely new event not already in the timeline:
[TIMELINE_ADD]{"date":"YYYY-MM-DD","event":"concise description","type":"action|defect|claim|detection"}[/TIMELINE_ADD]

To UPDATE/CORRECT an existing timeline event (wrong date, wrong description, correction):
[TIMELINE_UPDATE]{"find_text":"partial text of the existing event to find","date":"YYYY-MM-DD","event":"corrected description","type":"action|defect|claim|detection"}[/TIMELINE_UPDATE]

Rules:
- Prefer TIMELINE_UPDATE over TIMELINE_ADD when the user is correcting or adjusting an existing event.
- Only include these blocks when the user explicitly provides the information. Do not invent events.
- find_text must uniquely identify the existing event (a few distinctive words suffice).`;
}

export async function POST(req: Request) {
  const { messages, investigation } = await req.json() as { messages: Message[]; investigation: Investigation };

  const lastUserMessage = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const ragContext = await retrieveRagContext(lastUserMessage, investigation.id);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      stream: true,
      messages: [
        { role: "system", content: buildSystemPrompt(investigation, ragContext) },
        ...messages,
      ],
    }),
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            const delta = evt.choices?.[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }
          } catch { continue; }
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  });
}
