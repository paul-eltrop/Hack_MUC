// Fixierte Kopfzeile mit Manex AI Branding; Investigations und Analytics als gleich hohe Links.
// Aktiver Zustand folgt der URL (usePathname); Errors-Seite hebt keinen der beiden Reiter hervor.
// Profil und Suche rechts; Navigation nutzt next/link für echte Routenwechsel.

"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinkBase =
  "inline-flex items-center pb-1 text-sm border-b-2 transition-colors leading-none min-h-[1.25rem]";

export default function TopBar() {
  const pathname = usePathname();
  const investigationsActive = pathname === "/investigations";
  const analyticsActive = pathname === "/analytics";

  const investigationsClass = investigationsActive
    ? `${navLinkBase} border-amber-400 font-semibold text-sky-900`
    : `${navLinkBase} border-transparent font-medium text-slate-500 hover:text-sky-900`;

  const analyticsClass = analyticsActive
    ? `${navLinkBase} border-amber-400 font-semibold text-sky-900`
    : `${navLinkBase} border-transparent font-medium text-slate-500 hover:text-sky-900`;

  return (
    <header className="bg-white/80 backdrop-blur-xl fixed top-0 z-50 w-full border-b border-slate-200/20">
      <div className="flex justify-between items-center w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 py-3">
        <Link href="/" className="text-xl font-bold tracking-tighter text-sky-900 shrink-0">
          Manex AI
        </Link>
        <nav className="hidden md:flex items-center gap-8 mr-auto ml-16 lg:ml-24">
          <Link href="/investigations" className={investigationsClass}>
            Investigations
          </Link>
          <Link href="/analytics" className={analyticsClass}>
            Analytics
          </Link>
        </nav>
        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            className="p-2 hover:bg-slate-100/50 rounded-lg transition-all duration-200"
          >
            <span className="material-symbols-outlined text-slate-600">search</span>
          </button>
          <div className="w-10 h-10 rounded-full overflow-hidden bg-surface-container-highest border border-outline-variant/15">
            <Image
              src="/assets/stitch/investigations/avatar-lukas-weber.jpg"
              alt="Lukas Weber"
              width={40}
              height={40}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
