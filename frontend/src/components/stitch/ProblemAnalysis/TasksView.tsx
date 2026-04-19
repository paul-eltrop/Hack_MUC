// Pixel-perfect Next.js conversion of the Stitch "Problem Analysis — Tasks" screen
import Image from "next/image";
import { ReactNode } from "react";

type BadgeProps = { color: "orange" | "yellow" | "slate"; label: string };

function Badge({ color, label }: BadgeProps) {
  const styles: Record<string, string> = {
    orange: "bg-orange-50 text-orange-600",
    yellow: "bg-yellow-50 text-yellow-600",
    slate:  "bg-slate-100 text-slate-500",
  };
  const dotStyles: Record<string, string> = {
    orange: "bg-orange-600",
    yellow: "bg-yellow-600",
    slate:  "bg-slate-400",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${styles[color]}`}>
      <span className={`w-2 h-2 rounded-full ${dotStyles[color]}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </div>
  );
}

type TaskRowProps = {
  title: string;
  meta: string;
  badge: ReactNode;
};

function TaskRow({ title, meta, badge }: TaskRowProps) {
  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200/60 shadow-sm flex items-center justify-between hover:border-[#00426d]/30 transition-colors">
      <div className="flex items-center gap-4">
        <input
          type="checkbox"
          className="w-5 h-5 rounded border-slate-300 accent-[#00426d] focus:ring-[#00426d]"
        />
        <div>
          <h4 className="text-[#00426d] font-bold">{title}</h4>
          <p className="text-slate-500 text-xs mt-0.5">{meta}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

export default function TasksView() {
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

      {/* Sub-navigation tabs — Tasks active */}
      <div className="bg-white/40 border-b border-slate-200/40">
        <div className="max-w-[1920px] mx-auto px-8 flex gap-8">
          <button className="py-4 text-sm font-medium text-slate-500 hover:text-[#00426d] transition-all">
            Root Causes
          </button>
          <button className="py-4 text-sm font-bold border-b-2 border-amber-400 text-[#00426d] transition-all">
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

        {/* Task list */}
        <div className="grid grid-cols-12 gap-12">
          <div className="col-span-12">
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              <TaskRow
                title="Contact ElektroParts supplier and request batch quality report"
                meta="Sarah M. · Procurement · Due: Today, 17:00"
                badge={<Badge color="orange" label="URGENT" />}
              />
              <TaskRow
                title="Quarantine all units from Batch SB-00009 on Assembly Line 1"
                meta="Tom K. · Line Manager · Due: Today, 15:00"
                badge={<Badge color="orange" label="URGENT" />}
              />
              <TaskRow
                title="Run incoming inspection on next ElektroParts delivery"
                meta="QA Team · Due: Tomorrow, 09:00"
                badge={<Badge color="yellow" label="HIGH" />}
              />
              <TaskRow
                title="Update 8D Report with confirmed root cause findings"
                meta="Lisa B. · Quality Engineer · Due: Tomorrow, 12:00"
                badge={<Badge color="yellow" label="HIGH" />}
              />
              <TaskRow
                title="Schedule calibration check for torque tool at Line 1"
                meta="Maintenance · Plant Munich · Due: This week"
                badge={<Badge color="slate" label="MEDIUM" />}
              />
            </div>

            {/* List footer */}
            <div className="mt-6 flex flex-col gap-4">
              <button className="w-fit flex items-center gap-2 px-4 py-2 border-2 border-[#00426d] text-[#00426d] font-bold text-sm rounded-lg hover:bg-[#00426d]/5 transition-colors">
                <span className="material-symbols-outlined text-lg">add</span>
                Add Task
              </button>
              <p className="text-slate-400 text-sm font-medium">2 of 5 tasks completed</p>
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
