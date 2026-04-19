// Shared top navigation bar for Investigations and Errors screens
import Image from "next/image";

type TopBarProps = { activeLabel: string };

export default function TopBar({ activeLabel }: TopBarProps) {
  return (
    <header className="bg-white/80 backdrop-blur-xl fixed top-0 z-50 w-full border-b border-slate-200/20">
      <div className="flex justify-between items-center w-full px-8 py-3 max-w-[1920px] mx-auto">
        <div className="text-xl font-bold tracking-tighter text-sky-900">Manex AI</div>
        <nav className="hidden md:flex items-center gap-8 mr-auto ml-24">
          <a className="text-sky-900 font-semibold border-b-2 border-amber-400 pb-1 text-sm" href="#">
            {activeLabel}
          </a>
          <a className="text-slate-500 hover:text-sky-900 transition-colors text-sm font-medium" href="#">
            Analytics
          </a>
        </nav>
        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-slate-100/50 rounded-lg transition-all duration-200">
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
