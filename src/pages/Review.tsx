import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ReviewResult {
  review: string;
}

const CONDITION_OPTIONS = [
  { label: "問題なし", color: "bg-green-100 text-green-800 border-green-300" },
  { label: "軽い違和感", color: "bg-orange-100 text-orange-800 border-orange-300" },
  { label: "故障・離脱あり", color: "bg-red-100 text-red-800 border-red-300" },
];

const MOTIVATION_OPTIONS = [
  { label: "高い", color: "bg-green-100 text-green-800 border-green-300" },
  { label: "普通", color: "bg-gray-100 text-gray-800 border-gray-300" },
  { label: "低下気味", color: "bg-orange-100 text-orange-800 border-orange-300" },
];

export function Review() {
  const { user } = useAuth();
  const [review, setReview] = useState("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [physicalCondition, setPhysicalCondition] = useState("問題なし");
  const [motivation, setMotivation] = useState("普通");
  const [freeNote, setFreeNote] = useState("");

  useEffect(() => {
    if (!user) { setInitialLoading(false); return; }
    getDoc(doc(db, "users", user.uid, "data", "review")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setReview(data.review ?? "");
        setGeneratedAt(data.generatedAt?.toDate() ?? null);
      }
      setInitialLoading(false);
    });
  }, [user]);

  const getReview = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const fn = httpsCallable<
        { userId: string; physicalCondition: string; motivation: string; freeNote: string },
        ReviewResult
      >(functions, "getProgressReview");
      const result = await fn({ userId: user.uid, physicalCondition, motivation, freeNote });
      const newReview = result.data.review;
      setReview(newReview);
      const now = new Date();
      setGeneratedAt(now);
      await setDoc(doc(db, "users", user.uid, "data", "review"), {
        review: newReview,
        generatedAt: serverTimestamp(),
      });
    } catch (e) {
      setError("ふりかえりの生成に失敗しました。プロフィールと目標が登録されているか確認してください。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <p className="text-center text-gray-400 py-10">読み込み中...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">進捗ふりかえり</h2>
      <p className="text-sm text-gray-500 mb-5">
        これまでのトレーニング実績と目標をもとに、進捗チェック・ふりかえり・今後のアドバイスをAIが作成します。
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">体調・故障の有無</label>
          <div className="flex gap-2 flex-wrap">
            {CONDITION_OPTIONS.map(({ label, color }) => (
              <button
                key={label}
                type="button"
                onClick={() => setPhysicalCondition(label)}
                className={`px-3 py-1 rounded-full text-sm border font-medium transition-all ${
                  physicalCondition === label
                    ? `${color} ring-2 ring-offset-1 ring-current`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">モチベーション・手応え</label>
          <div className="flex gap-2 flex-wrap">
            {MOTIVATION_OPTIONS.map(({ label, color }) => (
              <button
                key={label}
                type="button"
                onClick={() => setMotivation(label)}
                className={`px-3 py-1 rounded-full text-sm border font-medium transition-all ${
                  motivation === label
                    ? `${color} ring-2 ring-offset-1 ring-current`
                    : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            自由記述メモ（任意）
          </label>
          <textarea
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
            rows={3}
            placeholder="この期間で一番大きかった変化、気になっていること、生活面の状況など"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
      </div>

      <button
        onClick={getReview}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl py-4 font-semibold transition-colors shadow mb-5"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            AIがふりかえり中...
          </span>
        ) : (
          "📈 ふりかえりを生成する"
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {review && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {generatedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-h2:text-base prose-h3:text-sm prose-h3:text-blue-700 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-hr:my-4">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{review}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
