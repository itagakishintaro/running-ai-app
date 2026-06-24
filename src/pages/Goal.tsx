import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useGoals } from "../hooks/useGoals";
import { MarathonType, type Goal, GoalInput, parseTimeToSec, formatTime } from "../types";

const emptyForm: GoalInput = {
  marathonType: "full",
  currentTimeSec: 0,
  targetTimeSec: 0,
  targetDate: "",
};

function formatInputTime(totalSec: number): string {
  return totalSec > 0 ? formatTime(totalSec) : "";
}

function goalLabel(goal: Goal): string {
  return `${goal.marathonType === "full" ? "フルマラソン" : "ハーフマラソン"} ${goal.targetDate}まで`;
}

export function Goal() {
  const { user } = useAuth();
  const { goals, loading, migrating, error, addGoal, updateGoal, deleteGoal } = useGoals(user?.uid);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GoalInput>(emptyForm);
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [targetTimeStr, setTargetTimeStr] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Goal | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCurrentTimeStr("");
    setTargetTimeStr("");
    setFormOpen(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingId(goal.id);
    setForm({
      marathonType: goal.marathonType,
      currentTimeSec: goal.currentTimeSec,
      targetTimeSec: goal.targetTimeSec,
      targetDate: goal.targetDate,
    });
    setCurrentTimeStr(formatInputTime(goal.currentTimeSec));
    setTargetTimeStr(formatInputTime(goal.targetTimeSec));
    setFormOpen(true);
  };

  const closeForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setCurrentTimeStr("");
    setTargetTimeStr("");
    setFormOpen(false);
  };

  const handleTimeChange = (value: string, field: "currentTimeSec" | "targetTimeSec") => {
    if (field === "currentTimeSec") setCurrentTimeStr(value);
    else setTargetTimeStr(value);
    setForm((prev) => ({ ...prev, [field]: parseTimeToSec(value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.currentTimeSec <= 0 || form.targetTimeSec <= 0 || !form.targetDate) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateGoal(editingId, form);
      } else {
        await addGoal(form);
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
                  <p className="text-sm text-gray-600 mt-1">
                    現在: {formatTime(goal.currentTimeSec)} →{" "}
                    <span className="font-semibold text-blue-600">
                      目標: {formatTime(goal.targetTimeSec)}
                    </span>
                  </p>
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
              {(["full", "half"] as MarathonType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, marathonType: type }))}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    form.marathonType === type
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                  }`}
                >
                  {type === "full" ? "フルマラソン" : "ハーフマラソン"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              現在のタイム{" "}
              <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
            </label>
            <input
              type="text"
              value={currentTimeStr}
              onChange={(e) => handleTimeChange(e.target.value, "currentTimeSec")}
              placeholder={form.marathonType === "full" ? "4:30:00" : "2:10:00"}
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
              onChange={(e) => handleTimeChange(e.target.value, "targetTimeSec")}
              placeholder={form.marathonType === "full" ? "3:30:00" : "1:45:00"}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">目標達成時期</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm((prev) => ({ ...prev, targetDate: e.target.value }))}
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
