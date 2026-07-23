import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTrainings } from "../hooks/useTrainings";
import { groupByMonth, groupByWeek, MonthlyStats, WeeklyStats } from "../types";
import { cardClass, EmptyState, cn } from "../components/ui";

type TabType = "monthly" | "weekly";

export function Stats() {
  const { user } = useAuth();
  const { trainings, loading } = useTrainings(user?.uid, 500);
  const [activeTab, setActiveTab] = useState<TabType>("monthly");

  const monthlyData = groupByMonth(trainings);
  const weeklyData = groupByWeek(trainings);

  const maxMonthlyDistance = monthlyData.reduce((max, d) => Math.max(max, d.totalDistanceKm), 1);
  const maxWeeklyDistance = weeklyData.reduce((max, d) => Math.max(max, d.totalDistanceKm), 1);

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">走行距離の統計</h2>

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(["monthly", "weekly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-white text-gray-900 shadow-card"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            {tab === "monthly" ? "月別" : "週別"}
          </button>
        ))}
      </div>

      {loading && <EmptyState message="読み込み中..." />}

      {!loading && trainings.length === 0 && (
        <EmptyState message="まだトレーニングデータがありません" />
      )}

      {!loading && activeTab === "monthly" && monthlyData.length > 0 && (
        <ul className="space-y-3">
          {monthlyData.map((item: MonthlyStats) => (
            <StatRow
              key={item.yearMonth}
              label={item.label}
              count={item.count}
              distance={item.totalDistanceKm}
              ratio={item.totalDistanceKm / maxMonthlyDistance}
            />
          ))}
        </ul>
      )}

      {!loading && activeTab === "weekly" && weeklyData.length > 0 && (
        <ul className="space-y-3">
          {weeklyData.map((item: WeeklyStats) => (
            <StatRow
              key={item.weekKey}
              label={item.label}
              count={item.count}
              distance={item.totalDistanceKm}
              ratio={item.totalDistanceKm / maxWeeklyDistance}
              smallLabel
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function StatRow({
  label,
  count,
  distance,
  ratio,
  smallLabel = false,
}: {
  label: string;
  count: number;
  distance: number;
  ratio: number;
  smallLabel?: boolean;
}) {
  return (
    <li className={`${cardClass} p-4`}>
      <div className="flex justify-between items-center">
        <p className={cn("font-semibold text-gray-900", smallLabel && "text-sm")}>{label}</p>
        <span className="text-xs text-gray-400 tabular-nums">{count}回</span>
      </div>
      <div className="mt-1 flex items-end gap-1">
        <span className="text-2xl font-bold text-primary-600 tabular-nums">
          {distance.toFixed(1)}
        </span>
        <span className="text-sm text-gray-500 mb-0.5">km</span>
      </div>
      <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full"
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </li>
  );
}
