import { type LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({
  title,
  value,
  delta,
  deltaPositive = true,
  icon: Icon,
  iconColor = "#10b981",
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-800 p-3.5 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] sm:text-xs font-medium text-gray-400 uppercase tracking-wide truncate">{title}</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-white truncate">{value}</p>
          {delta && (
            <p className={`mt-0.5 text-xs font-medium ${deltaPositive ? "text-emerald-500" : "text-red-500"}`}>
              {deltaPositive ? "▲" : "▼"} {delta}
            </p>
          )}
        </div>
        <div
          className="shrink-0 flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg"
          style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30` }}
        >
          <Icon size={16} className="sm:hidden" style={{ color: iconColor }} />
          <Icon size={20} className="hidden sm:block" style={{ color: iconColor }} />
        </div>
      </div>
    </div>
  );
}
