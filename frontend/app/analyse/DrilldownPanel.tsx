// Slide-in side panel for chart clicks.
// Shows label + count + raw IDs; closes via X button or backdrop click.

"use client";

import { useEffect } from "react";

export type DrilldownSelection = {
  title: string;
  subtitle: string;
  items: string[];
  accent: "red" | "amber" | "blue" | "purple" | "gray" | "green";
};

const accentBg: Record<DrilldownSelection["accent"], string> = {
  red: "bg-red-600",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  gray: "bg-gray-400",
  green: "bg-green-500",
};

type Props = {
  selection: DrilldownSelection | null;
  onClose: () => void;
};

export function DrilldownPanel({ selection, onClose }: Props) {
  useEffect(() => {
    if (!selection) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [selection, onClose]);

  const open = selection !== null;

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/20 transition-opacity z-40 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-[480px] max-w-[92vw] bg-white shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {selection ? (
          <div className="flex h-full flex-col">
            <header className="flex items-start justify-between border-b border-gray-100 px-6 pt-6 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${accentBg[selection.accent]}`} />
                <span className="text-xs font-semibold tracking-widest text-gray-400 uppercase">
                  {selection.subtitle}
                </span>
                </div>
                <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
                  {selection.title}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-900 transition-colors"
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <p className="text-xs font-semibold tracking-widest text-gray-400 uppercase mb-3">
                Affected defects · {selection.items.length}
              </p>
              {selection.items.length === 0 ? (
                <p className="text-sm text-gray-400">No individual IDs available.</p>
              ) : (
                <ul className="space-y-1">
                  {selection.items.map((id) => (
                    <li
                      key={id}
                      className="font-mono text-xs text-gray-700 px-3 py-2 rounded-md bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      {id}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </>
  );
}
