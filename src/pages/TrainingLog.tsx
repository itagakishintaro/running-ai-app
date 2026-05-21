import { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useTrainings } from "../hooks/useTrainings";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { Training, TrainingType, formatTime, parseTimeToSec } from "../types";

interface ParseResult {
  distanceKm?: number;
  durationSec?: number;
  avgPaceSecPerKm?: number;
  notes?: string;
}

export function TrainingLog() {
  const { user } = useAuth();
  const { trainings, loading, addTraining, deleteTraining } = useTrainings(user?.uid);

  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TrainingType>("run");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [pace, setPace] = useState("");
  const [notes, setNotes] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
    const durationSec = parseTimeToSec(duration);
    const paceSecPerKm = pace ? parseTimeToSec(pace) : Math.round(durationSec / Number(distance));
    await addTraining({
      date,
      type,
      distanceKm: Number(distance),
      durationSec,
      avgPaceSecPerKm: paceSecPerKm,
      notes,
    });
    setSaving(false);
    setShowForm(false);
    setDistance(""); setDuration(""); setPace(""); setNotes("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-800">トレーニングログ</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? "キャンセル" : "+ 追加"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5 space-y-3">
          <p className="text-sm font-semibold text-gray-700">新しいトレーニングを記録</p>

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

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">日付</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">種類</label>
            <select value={type} onChange={(e) => setType(e.target.value as TrainingType)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="run">ランニング</option>
              <option value="rest">休養</option>
              <option value="cross">クロストレーニング</option>
            </select>
          </div>
          {type !== "rest" && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">距離 (km)</label>
                <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)}
                  step="0.01" required placeholder="10.5"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">タイム (H:MM:SS)</label>
                <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)}
                  required placeholder="1:00:00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">平均ペース (MM:SS/km) — 空欄で自動計算</label>
                <input type="text" value={pace} onChange={(e) => setPace(e.target.value)}
                  placeholder="5:42"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">メモ</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="体調、コースなど"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-2 text-sm font-semibold transition-colors">
            {saving ? "保存中..." : "記録する"}
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
            <TrainingCard key={t.id} training={t} onDelete={() => t.id && deleteTraining(t.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TrainingCard({ training: t, onDelete }: { training: Training; onDelete: () => void }) {
  const typeLabel: Record<TrainingType, string> = { run: "🏃 ランニング", rest: "😴 休養", cross: "🚴 クロス" };
  return (
    <li className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-xs text-gray-500">{t.date}</p>
          <p className="font-semibold text-gray-800 mt-0.5">{typeLabel[t.type]}</p>
          {t.type !== "rest" && (
            <div className="flex gap-3 text-sm text-gray-600 mt-1">
              <span>{t.distanceKm} km</span>
              <span>{formatTime(t.durationSec)}</span>
              <span className="text-gray-400">{formatTime(t.avgPaceSecPerKm)}/km</span>
            </div>
          )}
          {t.notes && <p className="text-xs text-gray-400 mt-1">{t.notes}</p>}
        </div>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 text-xs px-2 py-1">削除</button>
      </div>
    </li>
  );
}
