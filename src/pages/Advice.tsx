import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface AdviceResult {
  advice: string;
  startDate: string;
  endDate: string;
}

function defaultStartDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function defaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

export function Advice() {
  const { user } = useAuth();
  const [advice, setAdvice] = useState("");
  const [adviceGeneratedAt, setAdviceGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [restDays, setRestDays] = useState<string[]>([]);
  const [condition, setCondition] = useState<string>("普通");

  useEffect(() => {
    if (!user) { setInitialLoading(false); return; }
    getDoc(doc(db, "users", user.uid, "data", "advice")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAdvice(data.advice ?? "");
        setAdviceGeneratedAt(data.generatedAt?.toDate() ?? null);
      }
      setInitialLoading(false);
    });
  }, [user]);

  const getAdvice = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const fn = httpsCallable<{ userId: string; startDate: string; endDate: string; restDays: string[]; condition: string }, AdviceResult>(functions, "getTrainingAdvice");
      const result = await fn({ userId: user.uid, startDate, endDate, restDays, condition });
      const newAdvice = result.data.advice;
      setAdvice(newAdvice);
      const now = new Date();
      setAdviceGeneratedAt(now);
      await setDoc(doc(db, "users", user.uid, "data", "advice"), {
        advice: newAdvice,
        generatedAt: serverTimestamp(),
        // メニューの対象期間を保存しておく。トレーニング登録後の一言アドバイス
        // （getTrainingFeedback）が、この期間に今回のトレーニング日が含まれるかで
        // 「提案メニューがまだ有効か／過去のものか」を正しく判定できるようにするため。
        menuStartDate: result.data.startDate ?? startDate,
        menuEndDate: result.data.endDate ?? endDate,
      });
    } catch (e) {
      setError("アドバイスの取得に失敗しました。プロフィールと目標が登録されているか確認してください。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <p className="text-center text-gray-400 py-10">読み込み中...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">AIトレーニングアドバイス</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたのプロフィール・目標・トレーニング履歴をもとに、トレーニングメニューを提案します。
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">メニュー開始日</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1">メニュー終了日</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">トレーニングできない曜日</label>
          <div className="flex gap-2 flex-wrap">
            {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
              <label key={day} className="flex items-center gap-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={restDays.includes(day)}
                  onChange={(e) => {
                    setRestDays(e.target.checked
                      ? [...restDays, day]
                      : restDays.filter((d) => d !== day));
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-700">{day}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">現在の体調</label>
          <div className="flex gap-2 flex-wrap">
            {[
              { label: "絶好調", color: "bg-green-100 text-green-800 border-green-300" },
              { label: "良い", color: "bg-blue-100 text-blue-800 border-blue-300" },
              { label: "普通", color: "bg-gray-100 text-gray-800 border-gray-300" },
              { label: "悪い", color: "bg-orange-100 text-orange-800 border-orange-300" },
              { label: "最悪", color: "bg-red-100 text-red-800 border-red-300" },
            ].map(({ label, color }) => (
              <button
                key={label}
                type="button"
                onClick={() => setCondition(label)}
                className={`px-3 py-1 rounded-full text-sm border font-medium transition-all ${
                  condition === label
                    ? `${color} ring-2 ring-offset-1 ring-current`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={getAdvice}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl py-4 font-semibold transition-colors shadow mb-5"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AIが考えています...
          </span>
        ) : (
          "🤖 トレーニングメニューを提案してもらう"
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {advice && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          {adviceGeneratedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {adviceGeneratedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-h2:text-base prose-h3:text-sm prose-h3:text-blue-700 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-hr:my-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{advice}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
