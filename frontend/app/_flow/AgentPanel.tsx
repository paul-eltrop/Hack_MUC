"use client";

import { useState } from "react";
import {
  flaggedPartsInBatch,
  partMasterFor,
  supplierDetails,
  type FlowKind,
} from "./flow-data";

type AgentPanelProps = {
  focusedKind: FlowKind | null;
  focusedId: string | null;
  selectedBatchId: string | null;
};

type Issue = {
  batchId: string;
  supplierId: string;
  supplierName: string;
  supplierNodeId: string;
  partTitle: string;
  partNumber: string;
  severity: "bad" | "suspect";
  flagged: number;
  qty: number;
  priority: number;
};

const OPEN_ISSUES: Issue[] = (() => {
  const issues: Omit<Issue, "priority">[] = [];
  for (const supplierNodeId of Object.keys(supplierDetails)) {
    const supplier = supplierDetails[supplierNodeId];
    for (const batch of supplier.batches) {
      const flagged = flaggedPartsInBatch(batch);
      if (flagged === 0) continue;
      const ratio = flagged / Math.max(batch.parts?.length ?? 0, 1);
      const severity: "bad" | "suspect" = ratio >= 0.2 ? "bad" : "suspect";
      const pm = partMasterFor(supplier, batch.partNumber);
      issues.push({
        batchId: batch.batchId,
        supplierId: supplier.supplierId,
        supplierName: supplier.supplierName,
        supplierNodeId,
        partTitle: pm?.title ?? batch.partNumber,
        partNumber: batch.partNumber,
        severity,
        flagged,
        qty: batch.qty,
      });
    }
  }
  issues.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "bad" ? -1 : 1;
    return b.flagged * b.qty - a.flagged * a.qty;
  });
  return issues.map((iss, i) => ({ ...iss, priority: i + 1 }));
})();

export function AgentPanel({
  focusedKind,
  focusedId,
  selectedBatchId,
}: AgentPanelProps) {
  return (
    <aside className="w-96 shrink-0 h-full flex flex-col border-l border-zinc-200 bg-white shadow-sm">
      <Header
        focusedKind={focusedKind}
        focusedId={focusedId}
        selectedBatchId={selectedBatchId}
      />
      <IssuesSection />
      <ChatSection />
    </aside>
  );
}

function Header({
  focusedKind,
  focusedId,
  selectedBatchId,
}: AgentPanelProps) {
  let focusLine = "No focus";
  if (focusedKind === "supplier" && focusedId) {
    const supplier = supplierDetails[focusedId];
    if (supplier) {
      if (selectedBatchId) {
        focusLine = `Focus: ${selectedBatchId} · ${supplier.supplierName}`;
      } else {
        focusLine = `Focus: ${supplier.supplierName}`;
      }
    }
  } else if (focusedKind === "factory") {
    focusLine = "Focus: Werk";
  } else if (focusedKind === "field") {
    focusLine = "Focus: Feld";
  }

  return (
    <header className="px-5 py-4 border-b border-zinc-200 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-900 to-zinc-700 text-white text-sm font-bold flex items-center justify-center">
        ✨
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-zinc-900">
          Quality Copilot
        </div>
        <div className="text-[11px] text-zinc-500 truncate">{focusLine}</div>
      </div>
    </header>
  );
}

function IssuesSection() {
  return (
    <section className="flex-[1] min-h-0 flex flex-col border-b border-zinc-200">
      <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Open Issues
        </div>
        <div className="text-[11px] text-zinc-500">
          {OPEN_ISSUES.length} prioritized
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {OPEN_ISSUES.length === 0 ? (
          <div className="p-5 text-sm text-zinc-400">
            No open issues.
          </div>
        ) : (
          OPEN_ISSUES.map((issue) => (
            <IssueRow key={issue.batchId} issue={issue} />
          ))
        )}
      </div>
    </section>
  );
}

function IssueRow({ issue }: { issue: Issue }) {
  return (
    <div className="w-full text-left px-5 py-3 border-b border-zinc-100 hover:bg-zinc-50 flex items-start gap-3 cursor-default">
      <PriorityBadge priority={issue.priority} severity={issue.severity} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono text-zinc-500">{issue.batchId}</span>
          <span className="text-zinc-400">·</span>
          <span className="text-red-600 font-semibold">
            {issue.flagged} flagged
          </span>
        </div>
        <div className="text-sm font-medium text-zinc-900 truncate mt-0.5">
          {issue.partTitle}
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 truncate">
          {issue.supplierName}
        </div>
      </div>
    </div>
  );
}

function PriorityBadge({
  priority,
  severity,
}: {
  priority: number;
  severity: "bad" | "suspect";
}) {
  const style =
    severity === "bad"
      ? "bg-red-500 text-white"
      : "bg-amber-400 text-amber-950";
  return (
    <div
      className={`w-9 h-9 rounded-lg shrink-0 flex flex-col items-center justify-center leading-none ${style}`}
    >
      <span className="text-[9px] font-semibold opacity-80">P</span>
      <span className="text-sm font-bold -mt-0.5">{priority}</span>
    </div>
  );
}

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    text: "Hello, I am your Quality Copilot. Select an issue above or ask me a question.",
  },
];

function ChatSection() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text },
    ]);
    setDraft("");
  };

  return (
    <section className="flex-[2] min-h-0 flex flex-col">
      <div className="px-5 py-3 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Chat
        </div>
        <div className="text-[10px] uppercase tracking-widest text-zinc-400">
          bald
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>
      <form
        onSubmit={onSubmit}
        className="border-t border-zinc-200 p-3 bg-zinc-50"
      >
        <div className="relative">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="w-full bg-white border border-zinc-200 rounded-lg pl-3 pr-11 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
            placeholder="Nachricht an den Copilot…"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md bg-zinc-900 text-white text-sm flex items-center justify-center disabled:bg-zinc-200 disabled:text-zinc-400 transition"
            aria-label="Senden"
          >
            →
          </button>
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm ${
          isUser
            ? "bg-zinc-900 text-white rounded-br-sm"
            : "bg-zinc-100 text-zinc-800 rounded-bl-sm"
        }`}
      >
        {message.text}
      </div>
    </div>
  );
}
