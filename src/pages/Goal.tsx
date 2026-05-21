import { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useGoal } from "../hooks/useGoal";
import { MarathonType, parseTimeToSec, formatTime } from "../types";

export function Goal() {
  const { user } = useAuth();
  const { goal, loading, saveGoal } = useGoal(user?.uid);

  const [marathonType, setMarathonType] = useState<MarathonType>("full");
  const [currentTime, setCurrentTime] = useState("");
  const [targetTime, setTargetTime] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (goal) {
      setMarathonType(goal.marathonType);
      setCurrentTime(formatTime(goal.currentTimeSec));
      setTargetTime(formatTime(goal.targetTimeSec));
      setTargetDate(goal.targetDate);
    }
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await saveGoal({
      marathonType,
      currentTimeSec: parseTimeToSec(currentTime),
      targetTimeSec: parseTimeToSec(targetTime),
      targetDate,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p className="text-center text-gray-400 py-10">読み込み中...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-5">目標設定</h2>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">種目</label>
          <div className="flex gap-3">
            {(["full", "half"] as MarathonType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMarathonType(type)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  marathonType === type
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
            現在のタイム <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
          </label>
          <input
            type="text"
            value={currentTime}
            onChange={(e) => setCurrentTime(e.target.value)}
            placeholder={marathonType === "full" ? "4:30:00" : "2:10:00"}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            目標タイム <span className="text-gray-400 font-normal">(H:MM:SS または MM:SS)</span>
          </label>
          <input
            type="text"
            value={targetTime}
            onChange={(e) => setTargetTime(e.target.value)}
            placeholder={marathonType === "full" ? "3:30:00" : "1:45:00"}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">目標達成時期</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg py-3 font-semibold transition-colors"
        >
          {saving ? "保存中..." : saved ? "✓ 保存しました" : "保存する"}
        </button>
      </form>
    </div>
  );
}
