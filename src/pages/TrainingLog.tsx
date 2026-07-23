import { useState, useRef } from "react";
import { Plus, Camera, Footprints } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useTrainings } from "../hooks/useTrainings";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Training, TrainingType, TRAINING_TYPE_OPTIONS, formatTime, parseTimeToSec } from "../types";
import {
  Card,
  Field,
  Input,
  Select,
  Button,
  Modal,
  Spinner,
  EmptyState,
  controlClass,
} from "../components/ui";
import { Markdown } from "../components/Markdown";

interface ParseResult {
  distanceKm?: number;
  durationSec?: number;
  avgPaceSecPerKm?: number;
  elevationGainM?: number;
  notes?: string;
}

const typeInfo = Object.fromEntries(
  TRAINING_TYPE_OPTIONS.map((o) => [o.value, o])
) as Record<TrainingType, (typeof TRAINING_TYPE_OPTIONS)[number]>;

function isRestType(type: TrainingType) {
  return typeInfo[type]?.isRest ?? false;
}

export function TrainingLog() {
  const { user } = useAuth();
  const { trainings, loading, addTraining, updateTraining, deleteTraining } = useTrainings(user?.uid);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TrainingType>("jog");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [pace, setPace] = useState("");
  const [elevationGain, setElevationGain] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 新規登録後の一言アドバイス（モーダル表示）
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setType("jog");
    setDistance("");
    setDuration("");
    setPace("");
    setElevationGain("");
    setNotes("");
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (t: Training) => {
    setEditingId(t.id ?? null);
    setDate(t.date);
    setType(t.type);
    setDistance(t.distanceKm ? String(t.distanceKm) : "");
    setDuration(t.durationSec ? formatTime(t.durationSec) : "");
    setPace(t.avgPaceSecPerKm ? formatTime(t.avgPaceSecPerKm) : "");
    setElevationGain(t.elevationGainM ? String(t.elevationGainM) : "");
    setNotes(t.notes ?? "");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeForm = () => {
    resetForm();
    setShowForm(false);
  };

  const handleImageUpload = async (file: File) => {
    setImageUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const parse = httpsCallable<{ imageBase64: string; mimeType: string }, ParseResult>(
          functions,
          "parseTrainingImage"
        );
        const result = await parse({ imageBase64: base64, mimeType: file.type });
        const data = result.data;
        if (data.distanceKm) setDistance(String(data.distanceKm));
        if (data.durationSec) setDuration(formatTime(data.durationSec));
        if (data.avgPaceSecPerKm) setPace(formatTime(data.avgPaceSecPerKm));
        if (data.elevationGainM) setElevationGain(String(data.elevationGainM));
        if (data.notes) setNotes(data.notes);
      };
      reader.readAsDataURL(file);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const isRest = isRestType(type);
    const durationSec = isRest ? 0 : parseTimeToSec(duration);
    const distanceKm = isRest ? 0 : Number(distance);
    const paceSecPerKm = isRest
      ? 0
      : pace
      ? parseTimeToSec(pace)
      : durationSec && distanceKm
      ? Math.round(durationSec / distanceKm)
      : 0;

    const payload = {
      date,
      type,
      distanceKm,
      durationSec,
      avgPaceSecPerKm: paceSecPerKm,
      elevationGainM: type === "trail" && elevationGain ? Number(elevationGain) : null,
      notes,
    };

    if (editingId) {
      await updateTraining(editingId, payload);
      setSaving(false);
      closeForm();
    } else {
      await addTraining(payload);
      setSaving(false);
      closeForm();
      // 保存は完了済み。付加機能として一言アドバイスを取得（失敗してもUXを阻害しない）
      fetchFeedback(payload);
    }
  };

  const fetchFeedback = async (training: Omit<Training, "id" | "createdAt">) => {
    if (!user) return;
    setFeedback("");
    setFeedbackLoading(true);
    setShowFeedback(true);
    try {
      const fn = httpsCallable<
        { userId: string; training: Omit<Training, "id" | "createdAt"> },
        { feedback: string }
      >(functions, "getTrainingFeedback");
      const result = await fn({ userId: user.uid, training });
      setFeedback(result.data.feedback ?? "");
    } catch (e) {
      console.error("一言アドバイスの取得に失敗しました", e);
      setShowFeedback(false); // 失敗時は静かに閉じる（保存は成功済み）
    } finally {
      setFeedbackLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">トレーニングログ</h2>
        <Button
          size="sm"
          variant={showForm ? "secondary" : "primary"}
          onClick={showForm ? closeForm : openNew}
        >
          {showForm ? (
            "キャンセル"
          ) : (
            <>
              <Plus className="w-4 h-4" />
              追加
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card padding="md" className="mb-5">
          <form onSubmit={handleSubmit} className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">
              {editingId ? "トレーニングを編集" : "新しいトレーニングを記録"}
            </p>

            {!editingId && (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-2">ランニングウォッチの画像から自動入力</p>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imageUploading}
                  className="inline-flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Camera className="w-4 h-4" />
                  {imageUploading ? "解析中..." : "画像をアップロード"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                />
              </div>
            )}

            <Field label="日付">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </Field>
            <Field label="種類">
              <Select value={type} onChange={(e) => setType(e.target.value as TrainingType)}>
                {TRAINING_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.emoji} {o.label}
                  </option>
                ))}
              </Select>
            </Field>

            {!isRestType(type) && (
              <>
                <Field label="距離 (km)">
                  <Input
                    type="number"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    step="0.01"
                    required
                    placeholder="10.5"
                  />
                </Field>
                <Field label="タイム (H:MM:SS)">
                  <Input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    required
                    placeholder="1:00:00"
                  />
                </Field>
                <Field label="平均ペース (MM:SS/km) — 空欄で自動計算">
                  <Input
                    type="text"
                    value={pace}
                    onChange={(e) => setPace(e.target.value)}
                    placeholder="5:42"
                  />
                </Field>
                {type === "trail" && (
                  <Field label="累積標高 (m)">
                    <Input
                      type="number"
                      value={elevationGain}
                      onChange={(e) => setElevationGain(e.target.value)}
                      min="0"
                      placeholder="850"
                    />
                  </Field>
                )}
              </>
            )}

            <Field label="メモ">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="体調、コース、インターバルの本数など"
                className={controlClass}
              />
            </Field>
            <Button type="submit" loading={saving} className="w-full">
              {saving ? "保存中..." : editingId ? "更新する" : "記録する"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <EmptyState message="読み込み中..." />
      ) : trainings.length === 0 ? (
        <EmptyState message="トレーニングの記録がまだありません" />
      ) : (
        <ul className="space-y-3">
          {trainings.map((t) => (
            <TrainingCard
              key={t.id}
              training={t}
              onEdit={() => openEdit(t)}
              onDelete={() => t.id && deleteTraining(t.id)}
            />
          ))}
        </ul>
      )}

      {showFeedback && (
        <FeedbackModal
          loading={feedbackLoading}
          feedback={feedback}
          onClose={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
}

function FeedbackModal({
  loading,
  feedback,
  onClose,
}: {
  loading: boolean;
  feedback: string;
  onClose: () => void;
}) {
  return (
    <Modal
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Footprints className="w-5 h-5 text-primary-600" />
          コーチからの一言
        </span>
      }
    >
      {loading ? (
        <div className="flex items-center gap-2 text-gray-500 py-6 justify-center">
          <Spinner />
          AIが今回のトレーニングを確認しています...
        </div>
      ) : (
        <Markdown compact>{feedback}</Markdown>
      )}

      <Button onClick={onClose} disabled={loading} size="sm" className="w-full mt-4">
        閉じる
      </Button>
    </Modal>
  );
}

function TrainingCard({
  training: t,
  onEdit,
  onDelete,
}: {
  training: Training;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const info = typeInfo[t.type] ?? { label: t.type, emoji: "🏃" };
  const isRest = isRestType(t.type);
  return (
    <Card as="li">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{t.date}</p>
          <p className="font-semibold text-gray-900 mt-0.5">
            {info.emoji} {info.label}
          </p>
          {!isRest && (
            <div className="flex gap-3 text-sm text-gray-600 mt-1 flex-wrap tabular-nums">
              <span>{t.distanceKm} km</span>
              <span>{formatTime(t.durationSec)}</span>
              <span className="text-gray-400">{formatTime(t.avgPaceSecPerKm)}/km</span>
              {t.elevationGainM ? <span>↗ {t.elevationGainM}m</span> : null}
            </div>
          )}
          {t.notes && <p className="text-xs text-gray-400 mt-1 break-words">{t.notes}</p>}
        </div>
        <div className="flex gap-1 ml-2 shrink-0">
          <button
            onClick={onEdit}
            className="text-primary-600 hover:text-primary-800 text-xs px-2 py-1 rounded hover:bg-primary-50 transition-colors"
          >
            編集
          </button>
          <button
            onClick={onDelete}
            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    </Card>
  );
}
