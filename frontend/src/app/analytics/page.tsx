// Platzhalter-Route für Analytics; TopBar verlinkt hierher von Investigations/Errors.
// Inhalt kann später durch Charts und KPIs aus der Manex-API ersetzt werden.
// Nutzt dieselbe Kopfzeile wie die übrigen Stitch-Screens über TopBar.

import TopBar from "@/components/stitch/Investigations/TopBar";

export default function AnalyticsPage() {
  return (
    <div className="bg-[#f8f9ff] text-on-surface font-body min-h-screen">
      <TopBar />
      <main className="w-full max-w-none mx-auto px-4 sm:px-6 lg:px-10 pt-[100px] pb-12">
        <div className="w-full ring-1 ring-[#00426d]/10 rounded-3xl p-8 bg-white/40 shadow-sm">
          <h1 className="text-3xl font-extrabold text-[#00426d] font-headline tracking-tight mb-2">
            Analytics
          </h1>
          <p className="text-slate-600 text-sm max-w-xl">
            Übersichten und Trends folgen hier — z. B. Pareto, Zeitreihen und Kostenrollups aus der
            Qualitätsdatenbank.
          </p>
        </div>
      </main>
    </div>
  );
}
