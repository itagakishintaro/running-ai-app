import { Link } from "react-router-dom";
import { Sparkles, Medal, AlertTriangle, Mountain, ArrowRight } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { useGoals } from "../hooks/useGoals";
import { useTrainings } from "../hooks/useTrainings";
import { formatTime, getNearestGoal, isTrailGoal } from "../types";
import { Card } from "../components/ui";

export function Dashboard() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.uid);
  const { goals } = useGoals(user?.uid);
  const { trainings } = useTrainings(user?.uid);

  const recentTrainings = trainings.slice(0, 5);
  const totalDistanceThisMonth = trainings
    .filter((t) => t.date.startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((sum, t) => sum + t.distanceKm, 0);
  const trainingCountThisMonth = trainings.filter((t) =>
    t.date.startsWith(new Date().toISOString().slice(0, 7))
  ).length;

  const nearestGoal = getNearestGoal(goals);
  const isSetupComplete = profile && goals.length > 0;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-gray-900">
        こんにちは、{profile?.name || user?.displayName}さん
      </h2>

      {!isSetupComplete && (
        <Card className="bg-amber-50 border-amber-200">
          <div className="flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-2">初期設定が必要です</p>
              <ul className="space-y-1">
                {!profile && (
                  <li>
                    <Link to="/profile" className="text-primary-700 underline font-medium">
                      プロフィールを登録
                    </Link>
                  </li>
                )}
                {goals.length === 0 && (
                  <li>
                    <Link to="/goal" className="text-primary-700 underline font-medium">
                      目標を設定
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {nearestGoal && (
        <Card>
          <p className="text-xs text-gray-500 font-medium mb-1">現在の目標</p>
          {isTrailGoal(nearestGoal) ? (
            <>
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <Mountain className="w-4 h-4 text-primary-600" />
                {nearestGoal.raceName || "トレイルラン"}
              </p>
              <div className="flex gap-4 mt-2 text-sm text-gray-600 flex-wrap tabular-nums">
                <span>
                  {nearestGoal.distanceKm}km
                  {nearestGoal.elevationGainM
                    ? ` / D+${nearestGoal.elevationGainM.toLocaleString()}m`
                    : ""}
                </span>
                <span className="font-semibold text-primary-600">
                  {nearestGoal.trailTargetType === "time" && nearestGoal.targetTimeSec
                    ? `目標: ${formatTime(nearestGoal.targetTimeSec)}`
                    : "目標: 完走"}
                </span>
                <span className="text-gray-400">({nearestGoal.targetDate}まで)</span>
              </div>
            </>
          ) : (
            <>
              <p className="font-bold text-gray-900">
                {nearestGoal.marathonType === "full" ? "フルマラソン" : "ハーフマラソン"}
              </p>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600 flex-wrap tabular-nums">
                <span>現在: {formatTime(nearestGoal.currentTimeSec ?? 0)}</span>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-primary-600">
                  目標: {formatTime(nearestGoal.targetTimeSec ?? 0)}
                </span>
                <span className="text-gray-400">({nearestGoal.targetDate}まで)</span>
              </div>
            </>
          )}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary-600 tabular-nums">
            {totalDistanceThisMonth.toFixed(1)}
          </p>
          <p className="text-xs text-gray-500 mt-1">今月の走行距離 (km)</p>
        </Card>
        <Card className="text-center">
          <p className="text-2xl font-bold text-primary-600 tabular-nums">
            {trainingCountThisMonth}
          </p>
          <p className="text-xs text-gray-500 mt-1">今月のトレーニング回数</p>
        </Card>
      </div>

      <Link
        to="/stats"
        className="block text-center text-sm text-gray-500 hover:text-gray-700 -mt-2"
      >
        過去の月別・週別統計を見る →
      </Link>

      <Link
        to="/advice"
        className="flex items-center justify-center gap-2 w-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-center rounded-xl py-3.5 font-semibold transition-colors"
      >
        <Sparkles className="w-5 h-5" />
        AIにトレーニングメニューを提案してもらう
      </Link>

      <Link
        to="/races"
        className="flex items-center justify-center gap-2 w-full bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 text-center rounded-xl py-3.5 font-semibold transition-colors"
      >
        <Medal className="w-5 h-5 text-primary-600" />
        出場するマラソン大会を探す
      </Link>

      {recentTrainings.length > 0 && (
        <Card>
          <p className="text-sm font-semibold text-gray-700 mb-3">直近のトレーニング</p>
          <ul className="divide-y divide-gray-100">
            {recentTrainings.map((t) => (
              <li
                key={t.id}
                className="flex justify-between text-sm text-gray-600 py-2 first:pt-0 last:pb-0 tabular-nums"
              >
                <span>{t.date}</span>
                <span>{t.distanceKm} km</span>
                <span>{formatTime(t.durationSec)}</span>
                <span className="text-gray-400">{formatTime(t.avgPaceSecPerKm)}/km</span>
              </li>
            ))}
          </ul>
          <Link
            to="/training"
            className="block mt-3 text-center text-xs text-primary-600 hover:underline font-medium"
          >
            すべて表示 →
          </Link>
        </Card>
      )}
    </div>
  );
}
