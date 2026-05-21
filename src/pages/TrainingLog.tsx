import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTrainings } from "../hooks/useTrainings";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Training, TrainingType, TRAINING_TYPE_OPTIONS, formatTime, parseTimeToSec } from "../types";

interface ParseResult {
  distanceKm?: number;
  durationSec?: number;
  avgPaceSecPerKm?: number;
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
  const [notes, setNotes] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setType("jog");
    setDistance("");
    setDuration("");
    setPace("");
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

    const payload = { date, type, distanceKm, durationSec, avgPaceSecPerKm: paceSecPerKm, notes };

    if (editingId) {
      await updateTraining(editingId, payload);
    } else {
      await addTraining(payload);
    }
    setSaving(false);
    closeForm();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800">トレーニングログ</h2>
        <button
          onClick={showForm ? closeForm : openNew}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "キャンセル" : "+ 追加"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">
            {editingId ? "トレーニングを編集" : "新しいトレーニングを記録"}
          </p>

          {!editingId && (
            <div className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center">
              <p className="text-xs text-gray-500 mb-2">ランニングウォッチの画像から自動入力</p>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={imageUploading}
                className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg transition-colors"
              >
                {imageUploading ? "解析中..." : "📷 画像をアップロード"}
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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">種類</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TrainingType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              {TRAINING_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.emoji} {o.label}
                </option>
              ))}
            </select>
          </div>

          {!isRestType(type) && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">距離 (km)</label>
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  step="0.01"
                  required
                  placeholder="10.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイム (H:MM:SS)</label>
                <input
                  type="text"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  required
                  placeholder="1:00:00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  平均ペース (MM:SS/km) — 空欄で自動計算
                </label>
                <input
                  type="text"
                  value={pace}
                  onChange={(e) => setPace(e.target.value)}
                  placeholder="5:42"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="体調、コース、インターバルの本数など"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2 text-sm font-semibold transition-colors"
          >
            {saving ? "保存中..." : editingId ? "更新する" : "記録する"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-center text-gray-400 py-10">読み込み中...</p>
      ) : trainings.length === 0 ? (
        <p className="text-center text-gray-400 py-10">トレーニングの記録がまだありません</p>
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
    </div>
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
    <li className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500">{t.date}</p>
          <p className="font-semibold text-gray-800 mt-0.5">
            {info.emoji} {info.label}
          </p>
          {!isRest && (
            <div className="flex gap-3 text-sm text-gray-600 mt-1 flex-wrap">
              <span>{t.distanceKm} km</span>
              <span>{formatTime(t.durationSec)}</span>
              <span className="text-gray-400">{formatTime(t.avgPaceSecPerKm)}/km</span>
            </div>
          )}
          {t.notes && <p className="text-xs text-gray-400 mt-1 break-words">{t.notes}</p>}
        </div>
        <div className="flex gap-2 ml-2 shrink-0">
          <button
            onClick={onEdit}
            className="text-blue-500 hover:text-blue-700 text-xs px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            編集
          </button>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
          >
            削除
          </button>
        </div>
      </div>
    </li>
  );
}
