// Kanban board for AI-suggested actions per investigation.
// Cards can be dragged, clicked to edit/delete, and share links can be generated per card.

"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { investigations } from "../../../data";

type Column = "New" | "In Progress" | "In Review" | "Completed";
const COLUMNS: Column[] = ["New", "In Progress", "In Review", "Completed"];

const columnStyle: Record<Column, { dot: string; badge: string; drop: string; addBtn: string }> = {
  "New":         { dot: "bg-gray-400",    badge: "bg-gray-100 text-gray-500",      drop: "border-gray-300 bg-gray-50",       addBtn: "text-gray-400 hover:text-gray-600 hover:bg-gray-100" },
  "In Progress": { dot: "bg-blue-500",    badge: "bg-blue-50 text-blue-500",       drop: "border-blue-300 bg-blue-50/40",    addBtn: "text-blue-400 hover:text-blue-600 hover:bg-blue-50" },
  "In Review":   { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-600",     drop: "border-amber-300 bg-amber-50/40", addBtn: "text-amber-400 hover:text-amber-600 hover:bg-amber-50" },
  "Completed":   { dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-600", drop: "border-emerald-300 bg-emerald-50/40", addBtn: "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" },
};

const OWNERS = [
  { name: "Anna Fischer",  role: "Quality Lead" },
  { name: "Markus Bauer",  role: "Process Engineer" },
  { name: "Sarah Klein",   role: "Supplier Manager" },
  { name: "Tom Richter",   role: "Production Manager" },
  { name: "Lisa Wagner",   role: "Design Engineer" },
];

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("");
}

type Card = {
  id: number; text: string; status: Column; assignees: string[];
  linkId?: string; proofDescription?: string; proofFileName?: string;
};

type PanelState =
  | { mode: "edit"; card: Card }
  | { mode: "add"; column: Column }
  | null;

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:8000";

export default function KanbanBoard() {
  const { id } = useParams<{ id: string }>();
  const inv = investigations.find((i) => i.id === id);

  const [cards, setCards] = useState<Card[]>([]);
  const [nextId, setNextId] = useState(0);
  const [generating, setGenerating] = useState(true);
  const [ragUsed, setRagUsed] = useState(false);
  useEffect(() => {
    if (!inv) { setGenerating(false); return; }

    const saved = localStorage.getItem(`kanban-${id}`);
    if (saved) {
      try {
        const parsed: Card[] = JSON.parse(saved);
        if (parsed.length > 0) {
          setCards(parsed);
          setNextId(Math.max(...parsed.map((c) => c.id)) + 1);
          setGenerating(false);
          return;
        }
      } catch { /* corrupted — fall through to AI */ }
    }

    fetch("/api/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ investigation: inv }),
    })
      .then((r) => r.json())
      .then((data) => {
        const actions: string[] = data.actions ?? inv.suggestedActions;
        setCards(actions.map((text, i) => ({ id: i, text, status: "New" as Column, assignees: [] })));
        setNextId(actions.length);
        setRagUsed(data.rag_used ?? false);
      })
      .catch(() => {
        const fallback = inv.suggestedActions;
        setCards(fallback.map((text, i) => ({ id: i, text, status: "New" as Column, assignees: [] })));
        setNextId(fallback.length);
      })
      .finally(() => setGenerating(false));
  }, []);

  useEffect(() => {
    cardsRef.current = cards;
    if (cards.length > 0) {
      localStorage.setItem(`kanban-${id}`, JSON.stringify(cards));
    }
  }, [cards]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = cardsRef.current.filter(
        (c) => c.linkId && c.status !== "In Review" && c.status !== "Completed"
      );
      if (!pending.length) return;
      for (const card of pending) {
        try {
          const res = await fetch(`/api/share-status?linkId=${card.linkId}`);
          const data = await res.json();
          if (data.completed) {
            setCards((prev) => prev.map((c) => c.id === card.id ? {
              ...c, status: "In Review",
              proofDescription: data.description || undefined,
              proofFileName: data.file_name || undefined,
            } : c));
            setPanel((prev) => prev?.mode === "edit" && prev.card.id === card.id ? {
              mode: "edit", card: {
                ...prev.card, status: "In Review",
                proofDescription: data.description || undefined,
                proofFileName: data.file_name || undefined,
              }
            } : prev);
            setProofSubmitted(true);
          }
        } catch { /* best-effort */ }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const [dragOver, setDragOver] = useState<Column | null>(null);
  const [panel, setPanel] = useState<PanelState>(null);
  const [editText, setEditText] = useState("");
  const [editAssignees, setEditAssignees] = useState<string[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusChecking, setStatusChecking] = useState(false);
  const [proofSubmitted, setProofSubmitted] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const cardsRef = useRef(cards);
  const draggingId = useRef<number | null>(null);

  function openEdit(card: Card) {
    setPanel({ mode: "edit", card });
    setEditText(card.text);
    setEditAssignees(card.assignees);
    setShareLink(card.linkId ? `${PORTAL_URL}/share/${card.linkId}` : null);
    setShareError(null);
    setCopied(false);
    setProofSubmitted(false);
    setDownloadError(false);
    if (card.linkId) checkProofStatus(card.id, card.linkId);
  }

  function openAdd(column: Column) {
    setPanel({ mode: "add", column });
    setEditText("");
    setEditAssignees([]);
    setShareLink(null);
    setCopied(false);
  }

  async function checkProofStatus(cardId: number, linkId: string) {
    setStatusChecking(true);
    try {
      const res = await fetch(`/api/share-status?linkId=${linkId}`);
      const data = await res.json();
      if (data.completed) {
        setProofSubmitted(true);
        setCards((prev) => prev.map((c) => c.id === cardId ? {
          ...c, status: "In Review",
          proofDescription: data.description || undefined,
          proofFileName: data.file_name || undefined,
        } : c));
        setPanel((prev) => prev?.mode === "edit" ? { mode: "edit", card: {
          ...prev.card, status: "In Review",
          proofDescription: data.description || undefined,
          proofFileName: data.file_name || undefined,
        }} : prev);
      }
    } catch { /* best-effort */ }
    setStatusChecking(false);
  }

  function toggleAssignee(name: string) {
    setEditAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function closePanel() {
    setPanel(null);
    setShareLink(null);
    setCopied(false);
  }

  function saveEdit() {
    if (!editText.trim() || panel?.mode !== "edit") return;
    setCards((prev) => prev.map((c) => (c.id === panel.card.id ? { ...c, text: editText.trim(), assignees: editAssignees } : c)));
    closePanel();
  }

  function addCard() {
    if (!editText.trim() || panel?.mode !== "add") return;
    const newCard: Card = { id: nextId, text: editText.trim(), status: panel.column, assignees: editAssignees };
    setCards((prev) => [...prev, newCard]);
    setNextId((n) => n + 1);
    closePanel();
  }

  function deleteCard() {
    if (panel?.mode !== "edit") return;
    setCards((prev) => prev.filter((c) => c.id !== panel.card.id));
    closePanel();
  }

  function moveCard(cardId: number, col: Column) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, status: col } : c)));
  }

  function onDragStart(cardId: number) { draggingId.current = cardId; }

  function onDrop(col: Column) {
    if (draggingId.current === null) return;
    moveCard(draggingId.current, col);
    draggingId.current = null;
    setDragOver(null);
  }

  async function generateShareLink() {
    if (panel?.mode !== "edit") return;
    setShareLoading(true);
    setShareError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: "manex",
          welcome_message: `Action: ${panel.card.text}`,
          topic: `Investigation ${id}: ${inv?.title ?? ""}`,
        }),
      });
      const data = await res.json();
      if (data.id) {
        setShareLink(`${PORTAL_URL}/share/${data.id}`);
        setCards((prev) => prev.map((c) => (c.id === panel.card.id ? { ...c, linkId: data.id } : c)));
      } else {
        setShareError(data.error ?? "Link konnte nicht erstellt werden");
      }
    } catch {
      setShareError("Portal nicht erreichbar — läuft uvicorn auf Port 8000?");
    }
    setShareLoading(false);
  }

  async function copyLink() {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Link kopieren (Ctrl+C):", shareLink);
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ height: "100vh" }}>
      <div className="max-w-7xl mx-auto px-8 w-full flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <div className="pt-6 pb-4 flex items-center justify-between flex-shrink-0">
          <Link href={`/investigations/${id}`} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-gray-700 transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {inv?.title ?? "Investigation"}
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight text-gray-950">AI-Suggested Actions</h1>
            {inv && <span className="text-xs text-gray-400">{inv.id}</span>}
            {generating ? (
              <span className="text-xs font-semibold bg-blue-50 text-blue-500 px-2 py-0.5 rounded-full animate-pulse">
                Generating…
              </span>
            ) : ragUsed ? (
              <span className="text-xs font-semibold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full" title="Actions grounded in past investigation data from RAG">
                RAG-grounded
              </span>
            ) : (
              <span className="text-xs font-semibold bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">
                AI generated
              </span>
            )}
          </div>
          <div className="w-32" />
        </div>

        {/* Board */}
        <div className="grid grid-cols-4 gap-4 pb-6 flex-1 overflow-hidden">
          {generating && COLUMNS.map((col) => (
            <div key={col} className="rounded-2xl border-2 border-dashed border-gray-100 p-3 flex flex-col h-full">
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className={`w-2 h-2 rounded-full ${columnStyle[col].dot}`} />
                <span className="text-sm font-semibold text-gray-700">{col}</span>
              </div>
              <div className="space-y-2.5 flex-1">
                {col === "New" && [1, 2, 3].map((n) => (
                  <div key={n} className="bg-gray-50 rounded-xl h-16 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
          {!generating && COLUMNS.map((col) => {
            const colCards = cards.filter((c) => c.status === col);
            const style = columnStyle[col];
            const isOver = dragOver === col;

            return (
              <div
                key={col}
                onDragOver={(e) => { e.preventDefault(); setDragOver(col); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => onDrop(col)}
                className={`rounded-2xl border-2 border-dashed transition-all duration-150 p-3 flex flex-col h-full ${
                  isOver ? style.drop : "border-gray-100 bg-transparent"
                }`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${style.dot}`} />
                    <span className="text-sm font-semibold text-gray-700">{col}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                      {colCards.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openAdd(col)}
                    title="Add card"
                    className="w-6 h-6 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>

                {/* Scrollable cards area */}
                <div className="space-y-2.5 overflow-y-auto flex-1 pr-0.5">
                  {colCards.map((card) => (
                    <div
                      key={card.id}
                      draggable
                      onDragStart={() => onDragStart(card.id)}
                      onDragEnd={() => setDragOver(null)}
                      onClick={() => openEdit(card)}
                      className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm cursor-pointer hover:shadow-md hover:border-gray-200 transition-all group"
                    >
                      <p className="text-sm text-gray-800 leading-relaxed mb-2">{card.text}</p>
                      {(card.proofDescription || card.proofFileName) && (
                        <div className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 space-y-1">
                          {card.proofDescription && (
                            <p className="text-xs text-emerald-800 leading-snug">"{card.proofDescription}"</p>
                          )}
                          {card.proofFileName && (
                            <div className="flex items-center gap-1.5">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                              </svg>
                              <span className="text-[10px] font-semibold text-emerald-700 truncate">{card.proofFileName}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {card.assignees.length > 0 && (
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="flex -space-x-1.5">
                            {card.assignees.map((name) => (
                              <div key={name} className="w-5 h-5 rounded-full bg-gray-950 ring-2 ring-white flex items-center justify-center">
                                <span className="text-[9px] font-bold text-white">{initials(name)}</span>
                              </div>
                            ))}
                          </div>
                          {card.assignees.length === 1 && (
                            <span className="text-xs text-gray-400">{card.assignees[0]}</span>
                          )}
                        </div>
                      )}
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {COLUMNS.filter((c) => c !== card.status).map((c) => (
                          <button
                            key={c}
                            onClick={(e) => { e.stopPropagation(); moveCard(card.id, c); }}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${columnStyle[c].badge}`}
                          >
                            → {c}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  {colCards.length === 0 && !isOver && (
                    <p className="text-center text-xs text-gray-200 py-6">Drop here</p>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      </div>

      {/* Side panel overlay */}
      {panel && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40" onClick={closePanel} />
          <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col">

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-950">
                {panel.mode === "edit" ? "Edit Card" : `Add to "${panel.column}"`}
              </span>
              <button onClick={closePanel} className="text-gray-300 hover:text-gray-600 text-xl leading-none">×</button>
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {/* Status badge (edit mode) */}
              {panel.mode === "edit" && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`w-2 h-2 rounded-full ${columnStyle[panel.card.status].dot}`} />
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${columnStyle[panel.card.status].badge}`}>
                    {panel.card.status}
                  </span>
                  {panel.card.status === "In Review" && panel.card.linkId && (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                      ✓ Proof submitted
                    </span>
                  )}
                </div>
              )}

              {/* Text editor */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                  Description
                </label>
                <textarea
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-950 resize-none"
                  placeholder="Describe the action…"
                />
              </div>

              {/* Assignee */}
              <div>
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                  Assignee
                </label>
                <div className="space-y-1">
                  {OWNERS.map((o) => {
                    const active = editAssignees.includes(o.name);
                    return (
                      <button
                        key={o.name}
                        onClick={() => toggleAssignee(o.name)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                          active ? "bg-gray-950 text-white" : "hover:bg-gray-50 text-gray-700"
                        }`}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${active ? "bg-white/20" : "bg-gray-100"}`}>
                          <span className={`text-[10px] font-bold ${active ? "text-white" : "text-gray-600"}`}>{initials(o.name)}</span>
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-xs font-semibold leading-none mb-0.5">{o.name}</p>
                          <p className="text-[10px] text-gray-400">{o.role}</p>
                        </div>
                        {active && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Move to column (edit mode) */}
              {panel.mode === "edit" && (
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                    Move to
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COLUMNS.filter((c) => c !== panel.card.status).map((c) => (
                      <button
                        key={c}
                        onClick={() => { moveCard(panel.card.id, c); setPanel({ mode: "edit", card: { ...panel.card, status: c } }); }}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${columnStyle[c].badge}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Share link (edit mode) */}
              {panel.mode === "edit" && (
                <div>
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-widest block mb-2">
                    Share Link
                  </label>
                  {shareError && (
                    <p className="text-xs text-red-500 mb-2">{shareError}</p>
                  )}
                  {!shareLink ? (
                    <button
                      onClick={generateShareLink}
                      disabled={shareLoading}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {shareLoading ? (
                        <span className="animate-pulse">Generating…</span>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                          </svg>
                          Generate Share Link
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                        <span className="text-xs text-gray-600 flex-1 truncate font-mono">{shareLink}</span>
                        <button onClick={copyLink} className="text-xs font-semibold text-gray-950 shrink-0">
                          {copied ? "✓ Copied" : "Copy"}
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <a href={shareLink} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">
                          Open link →
                        </a>
                        {proofSubmitted ? (
                          <span className="text-xs font-semibold text-emerald-600">✓ Proof received — moved to In Review</span>
                        ) : (
                          <button
                            onClick={() => panel?.mode === "edit" && panel.card.linkId && checkProofStatus(panel.card.id, panel.card.linkId)}
                            disabled={statusChecking}
                            className="text-xs font-semibold text-gray-500 hover:text-gray-800 disabled:opacity-40 transition-colors"
                          >
                            {statusChecking ? "Checking…" : "↻ Check status"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

              {/* Proof section */}
              {panel.mode === "edit" && (panel.card.proofDescription || panel.card.proofFileName) && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <span className="text-xs font-semibold text-emerald-700">Proof submitted</span>
                  </div>

                  {panel.card.proofDescription && (
                    <p className="text-sm text-emerald-900 leading-relaxed border-l-2 border-emerald-300 pl-3 italic">
                      {panel.card.proofDescription}
                    </p>
                  )}

                  {panel.card.proofFileName && (
                    <button
                      onClick={async () => {
                        setDownloadError(false);
                        try {
                          const res = await fetch(`/api/proof-download?linkId=${panel.card.linkId}`);
                          if (!res.ok) { setDownloadError(true); return; }
                          const blob = await res.blob();
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url; a.download = panel.card.proofFileName!;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch { setDownloadError(true); }
                      }}
                      className="w-full flex items-center gap-2.5 bg-white rounded-lg px-3 py-2 border border-emerald-100 hover:border-emerald-300 transition-colors group text-left"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <span className="text-xs font-semibold text-emerald-800 flex-1 truncate">{panel.card.proofFileName}</span>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                    </button>
                  )}
                  {downloadError && (
                    <div className="space-y-1">
                      <p className="text-xs text-red-500">Datei nicht auf Server — bitte nochmal einreichen.</p>
                      {panel.mode === "edit" && panel.card.linkId && (
                        <a
                          href={`${PORTAL_URL}/share/${panel.card.linkId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold text-blue-500 hover:underline"
                        >
                          → Share-Link öffnen &amp; Datei nochmal hochladen
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

            {/* Panel footer */}
            <div className="px-6 py-5 border-t border-gray-100 space-y-2">
              {panel.mode === "edit" ? (
                <>
                  <button
                    onClick={saveEdit}
                    disabled={!editText.trim()}
                    className="w-full bg-gray-950 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={deleteCard}
                    className="w-full text-red-500 text-sm font-semibold py-3 rounded-xl hover:bg-red-50 transition-colors"
                  >
                    Delete Card
                  </button>
                </>
              ) : (
                <button
                  onClick={addCard}
                  disabled={!editText.trim()}
                  className="w-full bg-gray-950 text-white text-sm font-semibold py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40"
                >
                  Add Card
                </button>
              )}
            </div>

          </div>
        </>
      )}
    </div>
  );
}
