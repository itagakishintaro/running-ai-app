import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTrainings } from "../hooks/useTrainings";
import { groupByMonth, groupByWeek, MonthlyStats, WeeklyStats } from "../types";

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
      <h2 className="text-xl font-bold text-gray-800">走行距離の統計</h2>

      <div className="flex gap-2">
        {(["monthly", "weekly"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {tab === "monthly" ? "月別" : "週別"}
          </button>
        ))}
      </div>

      {loading && (
        <p className="text-center text-gray-400 py-8">読み込み中...</p>
      )}

      {!loading && trainings.length === 0 && (
        <p className="text-center text-gray-400 py-8">まだトレーニングデータがありません</p>
      )}

      {!loading && activeTab === "monthly" && monthlyData.length > 0 && (
        <ul className="space-y-3">
          {monthlyData.map((item: MonthlyStats) => (
            <li key={item.yearMonth} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800">{item.label}</p>
                <span className="text-xs text-gray-400">{item.count}回</span>
              </div>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-2xl font-bold text-blue-600">
                  {item.totalDistanceKm.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500 mb-0.5">km</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${(item.totalDistanceKm / maxMonthlyDistance) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && activeTab === "weekly" && weeklyData.length > 0 && (
        <ul className="space-y-3">
          {weeklyData.map((item: WeeklyStats) => (
            <li key={item.weekKey} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800 text-sm">{item.label}</p>
                <span className="text-xs text-gray-400">{item.count}回</span>
              </div>
              <div className="mt-1 flex items-end gap-1">
                <span className="text-2xl font-bold text-blue-600">
                  {item.totalDistanceKm.toFixed(1)}
                </span>
                <span className="text-sm text-gray-500 mb-0.5">km</span>
              </div>
              <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full"
                  style={{ width: `${(item.totalDistanceKm / maxWeeklyDistance) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
