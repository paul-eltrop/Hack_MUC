// Pixel-perfect Next.js conversion of the Stitch "Task Confirmation" modal screen
export default function TaskConfirmation() {
  return (
    <div className="bg-surface font-body text-on-surface selection:bg-primary-fixed selection:text-on-primary-fixed min-h-screen">

      {/* Blurred background — mockup of the underlying task execution page */}
      <div className="fixed inset-0 z-0 overflow-hidden blur-md saturate-50 opacity-60">
        <header className="w-full h-16 bg-white/70 flex justify-between items-center px-8 shadow-sm">
          <div className="text-xl font-bold tracking-tighter text-blue-900">Precision Architect</div>
          <div className="flex gap-6">
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-24 h-4 bg-slate-200 rounded" />
            <div className="w-24 h-4 bg-slate-200 rounded" />
          </div>
        </header>
        <div className="flex h-[calc(100vh-64px)]">
          <aside className="w-64 border-r border-slate-200 bg-slate-50 p-8 flex flex-col gap-6">
            <div className="w-full h-12 bg-slate-200 rounded-lg" />
            <div className="flex flex-col gap-2">
              <div className="w-full h-8 bg-slate-200 rounded" />
              <div className="w-full h-8 bg-slate-200 rounded" />
              <div className="w-full h-8 bg-slate-200 rounded" />
              <div className="w-full h-8 bg-slate-200 rounded" />
            </div>
          </aside>
          <main className="flex-1 p-12 overflow-y-auto">
            <div className="max-w-4xl mx-auto space-y-12">
              <div className="space-y-4">
                <div className="w-32 h-6 bg-[#fdba49]/20 rounded" />
                <div className="w-3/4 h-12 bg-slate-300 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-8">
                <div className="col-span-2 h-96 bg-surface-container-low rounded-xl" />
                <div className="h-96 bg-surface-container-low rounded-xl" />
              </div>
              <div className="space-y-6">
                <div className="w-full h-20 bg-white shadow-sm rounded-xl" />
                <div className="w-full h-20 bg-white shadow-sm rounded-xl" />
                <div className="w-full h-20 bg-white shadow-sm rounded-xl" />
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Modal overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-on-background/20 backdrop-blur-sm">
        <div className="bg-surface-container-lowest w-full max-w-[440px] rounded-xl shadow-[0_40px_80px_-20px_rgba(11,28,48,0.15)] overflow-hidden flex flex-col items-center text-center p-10 relative">

          {/* Gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00426d] to-[#1e5a8a]" />

          {/* Icon */}
          <div className="mb-6">
            <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center text-[#1e5a8a]">
              <span className="material-symbols-outlined text-[32px]">task_alt</span>
            </div>
          </div>

          {/* Typography */}
          <div className="space-y-3 mb-8">
            <h1 className="font-headline text-2xl font-bold text-on-background tracking-tight">
              Confirm task completion?
            </h1>
            <p className="font-body text-on-surface-variant text-sm leading-relaxed px-2">
              Please confirm that all steps have been carried out correctly.
            </p>
          </div>

          {/* Actions */}
          <div className="w-full flex flex-col gap-3">
            <button className="w-full h-12 bg-[#1e5a8a] hover:bg-[#00426d] text-white font-semibold rounded-xl transition-all duration-200 active:scale-[0.98] shadow-sm">
              Yes, complete task
            </button>
            <button className="w-full h-12 bg-surface-container-high hover:bg-surface-container-highest text-on-secondary-container font-medium rounded-xl transition-all duration-200 active:scale-[0.98]">
              Cancel
            </button>
          </div>

        </div>
      </div>

      {/* Decorative dot grid */}
      <div className="fixed inset-0 pointer-events-none z-[60] opacity-[0.03]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(#00426d 0.5px, transparent 0.5px)",
            backgroundSize: "24px 24px",
          }}
        />
      </div>

    </div>
  );
}
