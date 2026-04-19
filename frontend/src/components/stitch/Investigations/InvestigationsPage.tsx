// Pixel-perfect Next.js conversion of the Stitch "Investigations" screen
import TopBar from "./TopBar";
import InvestigationCard from "./InvestigationCard";

export default function InvestigationsPage() {
  return (
    <div className="bg-[#f8f9ff] text-on-surface font-body min-h-screen">
      <TopBar activeLabel="Investigations" />

      <main className="max-w-[1920px] mx-auto px-8 pt-[100px] pb-12 grid grid-cols-12 gap-12">
        <div className="col-span-12 lg:col-span-9">
          <div className="ring-1 ring-[#00426d]/10 rounded-3xl p-8 bg-white/40 shadow-sm">
            <div className="mb-8">
              <span className="text-[#573900] font-bold text-[11px] uppercase tracking-[0.2em] mb-2 block">
                OVERVIEW
              </span>
              <h1 className="text-4xl font-extrabold tracking-tighter text-[#00426d] mb-6 font-headline">
                Investigations
              </h1>

              <div className="flex flex-col md:flex-row md:items-center justify-between border-surface-container/30">
                <div className="flex flex-col flex-1">
                  <div className="flex items-center justify-between border-b border-surface-container/30">
                    <div className="flex gap-8">
                      <button className="pb-4 text-sm font-semibold text-[#00426d] border-b-2 border-amber-400">All</button>
                      <button className="pb-4 text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors">Crucial</button>
                    </div>
                    <div className="flex items-center gap-4 pb-4">
                      <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <span className="material-symbols-outlined text-[18px]">sort</span>
                        <span>Sorting:</span>
                      </div>
                      <select className="text-xs font-bold text-[#00426d] bg-transparent border-none focus:ring-0 cursor-pointer p-0">
                        <option>Urgency</option>
                        <option>Creation Date</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-8 py-3 mt-1">
                    <button className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors">Not Assigned</button>
                    <button className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors">Assigned</button>
                    <button className="text-sm font-medium text-slate-400 hover:text-[#00426d] transition-colors">In Progress</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6 px-6 mb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <div className="col-span-1">Priority</div>
              <div className="col-span-8">Investigation Details</div>
              <div className="col-span-2 text-right">Estimated Risk</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-4">
              <InvestigationCard
                priority={1} priorityLabel="Highest" priorityColor="text-error" dotColor="bg-error"
                title="C12 Capacitor Failure — ElektroParts"
                badge={
                  <div className="flex items-center bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold gap-1 animate-pulse">
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    <span>ACTION REQUIRED</span>
                  </div>
                }
                time="2 hours ago"
                assignment={
                  <span className="flex items-center gap-1 text-amber-600 font-bold">
                    <span className="material-symbols-outlined text-sm">assignment</span>
                    12 Field Claims · Motor Controller MC-200
                  </span>
                }
                progressWidth="w-3/4" progressColor="bg-[#00426d]"
                risk="€8,300" accentBar
              />

              <InvestigationCard
                priority={2} priorityLabel="Medium" priorityColor="text-amber-500" dotColor="bg-amber-400"
                title="Loose Screws on Assembly Line 1"
                time="Yesterday"
                assignment={
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">assignment</span>
                    20 Defects · End-of-Line Vibration Test
                  </span>
                }
                progressWidth="w-1/4" progressColor="bg-[#00426d]"
                risk="€2,100"
              />

              <InvestigationCard
                priority={2} priorityLabel="Medium" priorityColor="text-amber-500" dotColor="bg-amber-400"
                title="R33 Resistor Thermal Drift"
                badge={
                  <div className="text-red-400 flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Staff</span>
                  </div>
                }
                time="4 hours ago"
                assignment={
                  <span className="flex items-center gap-1 text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded">
                    <span className="material-symbols-outlined text-sm">assignment</span>
                    5 Field Claims · MC-200 Performance Loss
                  </span>
                }
                progressWidth="w-0" progressColor="bg-slate-300"
                risk="€4,800" ring="ring-2 ring-red-100"
              />

              <InvestigationCard
                priority={3} priorityLabel="Low" priorityColor="text-emerald-500" dotColor="bg-emerald-500"
                title="False Positives at Visual Inspection"
                badge={
                  <div className="text-amber-500">
                    <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>priority_high</span>
                  </div>
                }
                time="3 days ago"
                assignment={
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-amber-500">assignment</span>
                    10 Defects · No confirmed failures
                  </span>
                }
                progressWidth="w-full" progressColor="bg-[#00426d]"
                risk="€0"
              />
            </div>
          </div>
        </div>
        <aside className="col-span-12 lg:col-span-3" />
      </main>

      <button className="fixed bottom-8 right-8 bg-[#00426d] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200">
        <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>add</span>
      </button>
    </div>
  );
}
