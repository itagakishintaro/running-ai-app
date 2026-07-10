import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useGoals } from "../hooks/useGoals";
import {
  MarathonType,
  GoalType,
  TrailTargetType,
  type Goal,
  GoalInput,
  isTrailGoal,
  parseTimeToSec,
  formatTime,
} from "../types";

function formatInputTime(totalSec: number | null | undefined): string {
  return totalSec && totalSec > 0 ? formatTime(totalSec) : "";
}

function goalLabel(goal: Goal): string {
  if (isTrailGoal(goal)) {
    return `⛰️ ${goal.raceName || "トレイルラン"} ${goal.targetDate}まで`;
  }
  return `${goal.marathonType === "full" ? "フルマラソン" : "ハーフマラソン"} ${goal.targetDate}まで`;
}

export function Goal() {
  const { user } = useAuth();
  const { goals, loading, migrating, error, addGoal, updateGoal, deleteGoal } = useGoals(user?.uid);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [goalType, setGoalType] = useState<GoalType>("marathon");
  const [marathonType, setMarathonType] = useState<MarathonType>("full");
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [targetTimeStr, setTargetTimeStr] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [raceName, setRaceName] = useState("");
  const [distanceStr, setDistanceStr] = useState("");
  const [elevationStr, setElevationStr] = useState("");
  const [trailTargetType, setTrailTargetType] = useState<TrailTargetType>("finish");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setGoalType("marathon");
    setMarathonType("full");
    setCurrentTimeStr("");
    setTargetTimeStr("");
    setTargetDate("");
    setRaceName("");
    setDistanceStr("");
    setElevationStr("");
    setTrailTargetType("finish");
  };

  const openAdd = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    resetForm();
    setEditingId(goal.id);
    setGoalType(isTrailGoal(goal) ? "trail" : "marathon");
    setMarathonType(goal.marathonType ?? "full");
    setCurrentTimeStr(formatInputTime(goal.currentTimeSec));
    setTargetTimeStr(formatInputTime(goal.targetTimeSec));
    setTargetDate(goal.targetDate);
    setRaceName(goal.raceName ?? "");
    setDistanceStr(goal.distanceKm ? String(goal.distanceKm) : "");
    setElevationStr(goal.elevationGainM ? String(goal.elevationGainM) : "");
    setTrailTargetType(goal.trailTargetType ?? "finish");
    setFormOpen(true);
  };

  const closeForm = () => {
    resetForm();
    setFormOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) return;

    let payload: GoalInput;
    if (goalType === "trail") {
      const distanceKm = Number(distanceStr);
      const targetTimeSec = parseTimeToSec(targetTimeStr);
      if (!(distanceKm > 0)) return;
      if (trailTargetType === "time" && targetTimeSec <= 0) return;
      payload = {
        goalType: "trail",
        marathonType: null,
        currentTimeSec: null,
        targetTimeSec: trailTargetType === "time" ? targetTimeSec : null,
        targetDate,
        raceName: raceName.trim() || null,
        distanceKm,
        elevationGainM: elevationStr ? Number(elevationStr) : null,
        trailTargetType,
      };
    } else {
      const currentTimeSec = parseTimeToSec(currentTimeStr);
      const targetTimeSec = parseTimeToSec(targetTimeStr);
      if (currentTimeSec <= 0 || targetTimeSec <= 0) return;
      payload = {
        goalType: "marathon",
        marathonType,
        currentTimeSec,
        targetTimeSec,
        targetDate,
        raceName: null,
        distanceKm: null,
        elevationGainM: null,
        trailTargetType: null,
      };
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateGoal(editingId, payload);
      } else {
        await addGoal(payload);
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteGoal(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (loading || migrating) {
    return (
      <p className="text-center text-gray-400 py-10">
        {migrating ? "データを移行しています..." : "読み込み中..."}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800">目標設定</h2>
        <button
          onClick={openAdd}
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 font-medium transition-colors"
        >
          ＋ 目標を追加
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {goals.length === 0 && !formOpen && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-center text-sm text-gray-500">
          目標が登録されていません。右上の「目標を追加」から登録してください。
        </div>
      )}

      {goals.length > 0 && !formOpen && (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <li
              key={goal.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-800">{goalLabel(goal)}</p>
                  {isTrailGoal(goal) ? (
                    <p className="text-sm text-gray-600 mt-1">
                      {goal.distanceKm}km
                      {goal.elevationGainM ? ` / D+${goal.elevationGainM.toLocaleString()}m` : ""} →{" "}
                      <span className="font-semibold text-blue-600">
                        {goal.trailTargetType === "time" && goal.targetTimeSec
                          ? `目標: ${formatTime(goal.targetTimeSec)}`
                          : "目標: 完走（関門内）"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 mt-1">
                      現在: {formatTime(goal.currentTimeSec ?? 0)} →{" "}
                      <span className="font-semibold text-blue-600">
                        目標: {formatTime(goal.targetTimeSec ?? 0)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEdit(goal)}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-2 py-1"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => setDeleteTarget(goal)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium px-2 py-1"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(formOpen || goals.length === 0) && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4 mt-4"
        >
          <p className="font-semibold text-gray-800">
            {editingId ? "目標を編集" : "新しい目標を追加"}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">種目</label>
            <div className="flex gap-3">
              {(
                [
                  { goalType: "marathon", marathonType: "full", label: "フルマラソン" },
                  { goalType: "marathon", marathonType: "half", label: "ハーフマラソン" },
                  { goalType: "trail", marathonType: null, label: "⛰️ トレイルラン" },
                ] as const
              ).map((opt) => {
                const selected =
                  goalType === opt.goalType &&
                  (opt.goalType === "trail" || marathonType === opt.marathonType);
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      setGoalType(opt.goalType);
                      if (opt.marathonType) setMarathonType(opt.marathonType);
                    }}
                    className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      selected
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {goalType === "trail" ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大会名 <span className="text-gray-400 font-normal">(任意)</span>
                </label>
                <input
                  type="text"
                  value={raceName}
                  onChange={(e) => setRaceName(e.target.value)}
                  placeholder="例: ハセツネCUP"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">距離 (km)</label>
                  <input
                    type="number"
                    value={distanceStr}
                    onChange={(e) => setDistanceStr(e.target.value)}
                    min="1"
                    step="0.1"
                    required
                    placeholder="30"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    累積標高 (m) <span className="text-gray-400 font-normal">(任意)</span>
                  </label>
                  <input
                    type="number"
                    value={elevationStr}
                    onChange={(e) => setElevationStr(e.target.value)}
                    min="0"
                    placeholder="1500"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">目標</label>
                <div className="flex gap-3">
                  {(
                    [
                      { value: "finish", label: "完走（関門内）" },
                      { value: "time", label: "目標タイム" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTrailTargetType(opt.value)}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        trailTargetType === opt.value
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  トレランはコースごとに条件が違うため、初挑戦の大会は「完走」目標がおすすめです
                </p>
              </div>
              {trailTargetType === "time" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    目標タイム{" "}
                    <span className="text-gray-400 font-normal">(H:MM:SS)</span>
                  </label>
                  <input
                    type="text"
                    value={targetTimeStr}
                    onChange={(e) => setTargetTimeStr(e.target.value)}
                    placeholder="5:30:00"
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  現在のタイム{" "}
                  <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
                </label>
                <input
                  type="text"
                  value={currentTimeStr}
                  onChange={(e) => setCurrentTimeStr(e.target.value)}
                  placeholder={marathonType === "full" ? "4:30:00" : "2:10:00"}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  目標タイム{" "}
                  <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
                </label>
                <input
                  type="text"
                  value={targetTimeStr}
                  onChange={(e) => setTargetTimeStr(e.target.value)}
                  placeholder={marathonType === "full" ? "3:30:00" : "1:45:00"}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {goalType === "trail" ? "大会開催日（目標日）" : "目標達成時期"}
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex gap-3">
            {goals.length > 0 && (
              <button
                type="button"
                onClick={closeForm}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-3 font-semibold transition-colors"
              >
                キャンセル
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-3 font-semibold transition-colors"
            >
              {saving ? "保存中..." : editingId ? "更新する" : "保存する"}
            </button>
          </div>
        </form>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-xl p-5 max-w-sm w-full">
            <p className="font-semibold text-gray-800 mb-2">目標を削除しますか？</p>
            <p className="text-sm text-gray-600 mb-4">
              {goalLabel(deleteTarget)} の目標を削除します。この操作は元に戻せません。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2 font-medium transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 font-medium transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
