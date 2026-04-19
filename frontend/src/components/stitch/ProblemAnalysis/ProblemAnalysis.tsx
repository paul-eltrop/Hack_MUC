// Pixel-perfect Next.js conversion of the Stitch "Problem Analysis" screen
import Image from "next/image";

const HERO_BORDER_BG = `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='%23C1C7D0FF' stroke-width='3' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e")`;

export default function ProblemAnalysis() {
  return (
    <div className="bg-[#f8f9ff] font-body text-on-surface antialiased min-h-screen">

      {/* Fixed background decoration */}
      <div className="fixed top-0 right-0 -z-10 w-1/3 h-full opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-l from-slate-200 to-transparent" />
      </div>

      {/* Top navigation */}
      <header className="bg-white/80 backdrop-blur-xl fixed top-0 z-50 w-full border-b border-slate-200/20">
        <div className="flex justify-between items-center w-full px-8 py-3 max-w-[1920px] mx-auto">
          <div className="text-xl font-bold tracking-tighter text-sky-900">Manex AI</div>
          <nav className="hidden md:flex items-center gap-8 mr-auto ml-24">
            <a className="text-sky-900 font-semibold border-b-2 border-amber-400 pb-1 text-sm" href="#">
              Investigations
            </a>
            <a className="text-slate-500 hover:text-sky-900 transition-colors text-sm font-medium" href="#">
              Analytics
            </a>
          </nav>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-slate-100/50 rounded-lg transition-all duration-200">
              <span className="material-symbols-outlined text-slate-600">notifications</span>
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

      {/* Sub-header breadcrumb */}
      <header className="pt-20 bg-white/40 border-b border-slate-200/40">
        <div className="flex items-center w-full px-8 py-3">
          <span
            className="material-symbols-outlined text-amber-500 mr-2 text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <span className="text-sky-900 font-medium font-body text-sm">Investigations</span>
        </div>
      </header>

      {/* Sub-navigation tabs */}
      <div className="bg-white/40 border-b border-slate-200/40">
        <div className="max-w-[1920px] mx-auto px-8 flex gap-8">
          <button className="py-4 text-sm font-bold border-b-2 border-amber-400 text-[#00426d] transition-all">
            Root Causes
          </button>
          <button className="py-4 text-sm font-medium text-slate-500 hover:text-[#00426d] transition-all">
            Tasks
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-[1920px] mx-auto px-8 py-12">

        {/* Progress bar section */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-8">
            <a className="flex items-center text-secondary hover:text-[#00426d] transition-colors text-sm font-medium" href="#">
              <span className="material-symbols-outlined text-sm mr-1">arrow_back</span>
              Back to Investigations
            </a>
          </div>
          <div className="flex gap-2 mb-4">
            <div className="h-1.5 w-1/2 bg-[#00426d] rounded-full" />
            <div className="h-1.5 w-1/2 bg-slate-200 rounded-full" />
          </div>
          <div className="flex justify-between">
            <span className="text-[#00426d] font-bold text-xs uppercase tracking-widest">PROBLEM ANALYSIS</span>
            <span className="text-slate-400 font-medium text-xs uppercase tracking-widest">Stakeholder Routing</span>
          </div>
        </div>

        {/* Headline & status */}
        <div className="mb-16">
          <p className="text-[11px] font-bold tracking-widest text-[#fdba49] uppercase font-label mb-2">
            STEP 1 OF 2
          </p>
          <h1 className="text-5xl font-headline font-extrabold tracking-tight text-[#00426d] mb-4">
            C12 Capacitor Failure — Assembly Line 1
          </h1>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-error rounded-full">
              <span className="w-2 h-2 rounded-full bg-error" />
              <span className="text-xs font-bold uppercase tracking-wider">CRITICAL</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-sm">payments</span>
              <span className="text-slate-600 font-body font-semibold">€8,300 Estimated Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400 text-sm">schedule</span>
              <span className="text-slate-600 font-body">Detected 2 hours ago</span>
            </div>
          </div>
        </div>

        {/* Hero visualization */}
        <div className="grid grid-cols-12 gap-12">
          <div className="col-span-12">
            <div
              className="bg-white min-h-[600px] flex flex-col items-center justify-center relative overflow-hidden group shadow-sm"
              style={{ backgroundImage: HERO_BORDER_BG, borderRadius: "16px" }}
            >
              {/* Dot grid overlay */}
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              {/* Center content */}
              <div className="relative z-10 flex flex-col items-center text-center px-12">
                <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-8 group-hover:scale-105 transition-transform duration-500">
                  <span className="material-symbols-outlined text-[#00426d] text-4xl animate-pulse">biotech</span>
                </div>
                <h3 className="text-2xl font-headline font-extrabold text-[#00426d] mb-3">
                  Interactive Root Cause Analysis
                </h3>
                <p className="text-slate-500 max-w-md text-lg font-medium leading-relaxed">
                  Analyzing defect patterns across 25 affected units...
                </p>
                <div className="mt-8 flex gap-2">
                  <div className="w-2 h-2 bg-[#00426d] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-[#00426d] rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-[#00426d] rounded-full animate-bounce" />
                </div>
              </div>

              {/* Decorative bottom elements */}
              <div className="absolute bottom-12 left-12 right-12 flex justify-between items-end opacity-20">
                <div className="flex flex-col gap-3">
                  <div className="h-2.5 w-48 bg-slate-200 rounded-full" />
                  <div className="h-2.5 w-32 bg-slate-200 rounded-full" />
                </div>
                <div className="flex gap-2 items-end">
                  <div className="w-8 h-16 bg-[#00426d]/10 rounded-t-lg" />
                  <div className="w-8 h-28 bg-[#00426d]/10 rounded-t-lg" />
                  <div className="w-8 h-20 bg-[#00426d]/10 rounded-t-lg" />
                  <div className="w-8 h-32 bg-[#00426d]/10 rounded-t-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer action */}
        <footer className="mt-20 pt-10 border-t border-slate-200/40 flex justify-end">
          <button className="bg-[#00426d] text-white px-8 py-4 rounded-xl font-headline font-bold flex items-center gap-3 hover:bg-[#1e5a8a] transition-all active:scale-95 shadow-lg shadow-[#00426d]/20">
            PROCEED TO STAKEHOLDER ROUTING
            <span className="material-symbols-outlined">arrow_forward</span>
          </button>
        </footer>

      </main>
    </div>
  );
}
