import { useState } from "react";
import { Plus, Mountain } from "lucide-react";
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
import { Card, Field, Input, Button, Modal, EmptyState, cn } from "../components/ui";

function formatInputTime(totalSec: number | null | undefined): string {
  return totalSec && totalSec > 0 ? formatTime(totalSec) : "";
}

function goalLabel(goal: Goal): string {
  if (isTrailGoal(goal)) {
    return `${goal.raceName || "トレイルラン"} ${goal.targetDate}まで`;
  }
  return `${goal.marathonType === "full" ? "フルマラソン" : "ハーフマラソン"} ${goal.targetDate}まで`;
}

const segClass = (selected: boolean) =>
  cn(
    "flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border text-sm font-medium transition-colors",
    selected
      ? "bg-primary-600 text-white border-primary-600"
      : "bg-white text-gray-700 border-gray-300 hover:border-primary-400"
  );

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
    return <EmptyState message={migrating ? "データを移行しています..." : "読み込み中..."} />;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">目標設定</h2>
        <Button size="sm" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          目標を追加
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {goals.length === 0 && !formOpen && (
        <Card padding="md" className="text-center text-sm text-gray-500">
          目標が登録されていません。右上の「目標を追加」から登録してください。
        </Card>
      )}

      {goals.length > 0 && !formOpen && (
        <ul className="space-y-3">
          {goals.map((goal) => (
            <Card key={goal.id} as="li">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-gray-900 flex items-center gap-1.5">
                    {isTrailGoal(goal) && <Mountain className="w-4 h-4 text-primary-600" />}
                    {goalLabel(goal)}
                  </p>
                  {isTrailGoal(goal) ? (
                    <p className="text-sm text-gray-600 mt-1 tabular-nums">
                      {goal.distanceKm}km
                      {goal.elevationGainM ? ` / D+${goal.elevationGainM.toLocaleString()}m` : ""} →{" "}
                      <span className="font-semibold text-primary-600">
                        {goal.trailTargetType === "time" && goal.targetTimeSec
                          ? `目標: ${formatTime(goal.targetTimeSec)}`
                          : "目標: 完走（関門内）"}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600 mt-1 tabular-nums">
                      現在: {formatTime(goal.currentTimeSec ?? 0)} →{" "}
                      <span className="font-semibold text-primary-600">
                        目標: {formatTime(goal.targetTimeSec ?? 0)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openEdit(goal)}
                    className="text-sm text-primary-600 hover:text-primary-800 font-medium px-2 py-1"
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
            </Card>
          ))}
        </ul>
      )}

      {(formOpen || goals.length === 0) && (
        <Card padding="md" className="mt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="font-semibold text-gray-900">
              {editingId ? "目標を編集" : "新しい目標を追加"}
            </p>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-2">種目</p>
              <div className="flex gap-3">
                {(
                  [
                    { goalType: "marathon", marathonType: "full", label: "フルマラソン" },
                    { goalType: "marathon", marathonType: "half", label: "ハーフマラソン" },
                    { goalType: "trail", marathonType: null, label: "トレイルラン" },
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
                      className={segClass(selected)}
                    >
                      {opt.goalType === "trail" && <Mountain className="w-4 h-4" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {goalType === "trail" ? (
              <>
                <Field
                  label={
                    <>
                      大会名 <span className="text-gray-400 font-normal">(任意)</span>
                    </>
                  }
                >
                  <Input
                    type="text"
                    value={raceName}
                    onChange={(e) => setRaceName(e.target.value)}
                    placeholder="例: ハセツネCUP"
                  />
                </Field>
                <div className="flex gap-3">
                  <Field label="距離 (km)" className="flex-1">
                    <Input
                      type="number"
                      value={distanceStr}
                      onChange={(e) => setDistanceStr(e.target.value)}
                      min="1"
                      step="0.1"
                      required
                      placeholder="30"
                    />
                  </Field>
                  <Field
                    label={
                      <>
                        累積標高 (m) <span className="text-gray-400 font-normal">(任意)</span>
                      </>
                    }
                    className="flex-1"
                  >
                    <Input
                      type="number"
                      value={elevationStr}
                      onChange={(e) => setElevationStr(e.target.value)}
                      min="0"
                      placeholder="1500"
                    />
                  </Field>
                </div>
                <div>
                  <p className="block text-sm font-medium text-gray-700 mb-2">目標</p>
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
                        className={segClass(trailTargetType === opt.value)}
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
                  <Field
                    label={
                      <>
                        目標タイム{" "}
                        <span className="text-gray-400 font-normal">(H:MM:SS)</span>
                      </>
                    }
                  >
                    <Input
                      type="text"
                      value={targetTimeStr}
                      onChange={(e) => setTargetTimeStr(e.target.value)}
                      placeholder="5:30:00"
                      required
                    />
                  </Field>
                )}
              </>
            ) : (
              <>
                <Field
                  label={
                    <>
                      現在のタイム{" "}
                      <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
                    </>
                  }
                >
                  <Input
                    type="text"
                    value={currentTimeStr}
                    onChange={(e) => setCurrentTimeStr(e.target.value)}
                    placeholder={marathonType === "full" ? "4:30:00" : "2:10:00"}
                    required
                  />
                </Field>
                <Field
                  label={
                    <>
                      目標タイム{" "}
                      <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
                    </>
                  }
                >
                  <Input
                    type="text"
                    value={targetTimeStr}
                    onChange={(e) => setTargetTimeStr(e.target.value)}
                    placeholder={marathonType === "full" ? "3:30:00" : "1:45:00"}
                    required
                  />
                </Field>
              </>
            )}

            <Field label={goalType === "trail" ? "大会開催日（目標日）" : "目標達成時期"}>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                required
              />
            </Field>
            <div className="flex gap-3">
              {goals.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  className="flex-1"
                  onClick={closeForm}
                >
                  キャンセル
                </Button>
              )}
              <Button type="submit" loading={saving} size="lg" className="flex-1">
                {saving ? "保存中..." : editingId ? "更新する" : "保存する"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {deleteTarget && (
        <Modal
          onClose={() => setDeleteTarget(null)}
          closeOnBackdrop={false}
          className="max-w-sm"
          title="目標を削除しますか？"
        >
          <p className="text-sm text-gray-600 mb-4">
            {goalLabel(deleteTarget)} の目標を削除します。この操作は元に戻せません。
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteTarget(null)}
            >
              キャンセル
            </Button>
            <Button variant="danger" className="flex-1" onClick={handleDelete}>
              削除する
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
