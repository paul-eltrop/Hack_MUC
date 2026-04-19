// Fixed-bottom AI chat panel for investigations.
// Parses [TIMELINE_ADD] blocks from the stream and calls onTimelineAdd to update the parent timeline.

"use client";

import { useEffect, useRef, useState } from "react";
import type { Investigation, TimelineEvent } from "../../data";

type TimelineUpdate = TimelineEvent & { find_text: string };

type Props = {
  inv: Investigation;
  onTimelineAdd?: (event: TimelineEvent) => void;
  onTimelineUpdate?: (update: TimelineUpdate) => void;
};

function extractTimelineBlocks(text: string): { clean: string; adds: TimelineEvent[]; updates: TimelineUpdate[] } {
  const adds: TimelineEvent[] = [];
  const updates: TimelineUpdate[] = [];

  let clean = text.replace(/\[TIMELINE_ADD\]([\s\S]*?)\[\/TIMELINE_ADD\]/g, (_, json) => {
    try {
      const evt = JSON.parse(json.trim()) as TimelineEvent;
      if (evt.date && evt.event && evt.type) adds.push(evt);
    } catch { /* ignore */ }
    return "";
  });

  clean = clean.replace(/\[TIMELINE_UPDATE\]([\s\S]*?)\[\/TIMELINE_UPDATE\]/g, (_, json) => {
    try {
      const upd = JSON.parse(json.trim()) as TimelineUpdate;
      if (upd.find_text && upd.date && upd.event && upd.type) updates.push(upd);
    } catch { /* ignore */ }
    return "";
  });

  return { clean: clean.trim(), adds, updates };
}

export default function InvestigationChat({ inv, onTimelineAdd, onTimelineUpdate }: Props) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const form = new FormData();
    form.append("investigation_id", inv.id);
    form.append("file", file);

    setOpen(true);
    setMessages((prev) => [...prev, { role: "assistant", content: `📎 Uploading "${file.name}" to RAG…` }]);

    const res = await fetch("/api/upload", { method: "POST", body: form });
    const data = await res.json();

    setMessages((prev) => [
      ...prev.slice(0, -1),
      {
        role: "assistant",
        content: res.ok
          ? `✓ "${file.name}" indexed (${data.chunks} chunks). You can ask about it now.`
          : `✗ Upload failed: ${data.error ?? "Unknown error"}`,
      },
    ]);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    setOpen(true);
    const userMsg = { role: "user" as const, content: input };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setIsLoading(true);

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, investigation: inv }),
    });

    if (!res.ok || !res.body) { setIsLoading(false); return; }

    let rawContent = "";
    const reader = res.body.getReader();
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
        try {
          const data = JSON.parse(line.slice(5).trim());
          if (data.delta) {
            rawContent += data.delta;
            const { clean } = extractTimelineBlocks(rawContent);
            setMessages([...history, { role: "assistant", content: clean || rawContent }]);
          }
        } catch { continue; }
      }
    }

    const { clean, adds, updates } = extractTimelineBlocks(rawContent);
    if (clean !== rawContent) {
      setMessages([...history, { role: "assistant", content: clean }]);
    }
    adds.forEach((evt) => onTimelineAdd?.(evt));
    updates.forEach((upd) => onTimelineUpdate?.(upd));

    setIsLoading(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center">
      <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.pptx" onChange={handleUpload} className="hidden" />

      {open && messages.length > 0 && (
        <div className="w-full max-w-2xl px-4 mb-0">
          <div className="bg-white border border-gray-200 border-b-0 rounded-t-2xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">AI Assistant</span>
              <button onClick={() => setOpen(false)} className="text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none">×</button>
            </div>
            <div className="max-h-64 overflow-y-auto px-4 py-3 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-800"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 rounded-2xl px-4 py-2.5 text-sm text-gray-400">
                    <span className="animate-pulse">Thinking…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-2xl px-4 pb-5">
        <div className={`flex items-center gap-3 bg-white border border-gray-200 px-4 py-3 shadow-lg ${open && messages.length > 0 ? "rounded-b-2xl" : "rounded-2xl"}`}>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="grid size-8 shrink-0 place-items-center rounded-full text-gray-300 hover:text-gray-500 transition-colors"
            title="Upload file"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Frag mich zu dieser Investigation…"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-gray-950 text-white hover:bg-gray-800 disabled:opacity-40 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
