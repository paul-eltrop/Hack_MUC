// Reusable investigation/error card row used in both Investigations and Errors screens
import { ReactNode } from "react";

type Props = {
  priority: number;
  priorityLabel: string;
  priorityColor: string;
  dotColor: string;
  title: string;
  badge?: ReactNode;
  time: string;
  assignment: ReactNode;
  progressWidth: string;
  progressColor: string;
  risk: string;
  accentBar?: boolean;
  ring?: string;
};

export default function InvestigationCard({
  priority, priorityLabel, priorityColor, dotColor,
  title, badge, time, assignment,
  progressWidth, progressColor, risk,
  accentBar, ring,
}: Props) {
  return (
    <div className={`bg-surface-container-low p-6 rounded-xl grid grid-cols-12 gap-6 items-center group hover:bg-surface-container transition-all duration-300 relative overflow-hidden ${ring ?? ""}`}>
      {accentBar && <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500" />}

      <div className="col-span-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-1">
          <span className={`text-xl font-extrabold ${priorityColor}`}>{priority}</span>
          <span className={`text-[8px] font-bold uppercase ${priorityColor}`}>{priorityLabel}</span>
        </div>
      </div>

      <div className="col-span-8">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            <span className={`block w-2 h-2 rounded-full ${dotColor}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-on-surface">{title}</h3>
              {badge}
            </div>
            <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                {time}
              </span>
              {assignment}
            </div>
            <div className="w-48 h-1 bg-surface-container-high rounded-full mt-3 overflow-hidden">
              <div className={`h-full ${progressWidth} ${progressColor}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-2 text-right">
        <div className="text-[#00426d] font-extrabold text-lg">{risk}</div>
      </div>

      <div className="col-span-1 text-right">
        <button className="material-symbols-outlined text-slate-400 hover:text-[#00426d] transition-colors">
          chevron_right
        </button>
      </div>
    </div>
  );
}
