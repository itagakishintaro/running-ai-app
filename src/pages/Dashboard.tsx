import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useGoal } from "../hooks/useGoal";
import { useTrainings } from "../hooks/useTrainings";
import { formatTime } from "../types";

export function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.uid);
  const { goal } = useGoal(user?.uid);
  const { trainings } = useTrainings(user?.uid);

  const recentTrainings = trainings.slice(0, 5);
  const totalDistanceThisMonth = trainings
    .filter((t) => t.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, t) => sum + t.distanceKm, 0);

  const isSetupComplete = profile && goal;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-800">
        こんにちは、{profile?.name || user?.displayName}さん 👋
      </h2>

      {!isSetupComplete && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          <p className="font-semibold mb-2">⚠️ 初期設定が必要です</p>
          <ul className="space-y-1">
            {!profile && (
              <li>
                <Link to="/profile" className="text-blue-600 underline">
                  プロフィールを登録
                </Link>
              </li>
            )}
            {!goal && (
              <li>
                <Link to="/goal" className="text-blue-600 underline">
                  目標を設定
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}

      {goal && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 font-medium mb-1">現在の目標</p>
          <p className="font-bold text-gray-800">
            {goal.marathonType === "full" ? "フルマラソン" : "ハーフマラソン"}
          </p>
          <div className="flex gap-4 mt-2 text-sm text-gray-600">
            <span>現在: {formatTime(goal.currentTimeSec)}</span>
            <span>→</span>
            <span className="font-semibold text-blue-600">
              目標: {formatTime(goal.targetTimeSec)}
            </span>
            <span className="text-gray-400">({goal.targetDate}まで)</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {totalDistanceThisMonth.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 mt-1">今月の走行距離 (km)</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">
            {trainings.filter((t) =>
              t.date.startsWith(new Date().toISOString().slice(0, 7))
            ).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">今月のトレーニング回数</p>
        </div>
      </div>

      <Link
        to="/advice"
        className="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center rounded-xl py-4 font-semibold transition-colors shadow"
      >
        🤖 AIにトレーニングメニューを提案してもらう
      </Link>

      {recentTrainings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">直近のトレーニング</p>
          <ul className="space-y-2">
            {recentTrainings.map((t) => (
              <li key={t.id} className="flex justify-between text-sm text-gray-600">
                <span>{t.date}</span>
                <span>{t.distanceKm} km</span>
                <span>{formatTime(t.durationSec)}</span>
                <span className="text-gray-400">{formatTime(t.avgPaceSecPerKm)}/km</span>
              </li>
            ))}
          </ul>
          <Link
            to="/training"
            className="block mt-3 text-center text-xs text-blue-600 hover:underline"
          >
            すべて表示 →
          </Link>
        </div>
      )}
    </div>
  );
}
