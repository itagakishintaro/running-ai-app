import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import ReactMarkdown from "react-markdown";

interface AdviceResult {
  advice: string;
}

export function Advice() {
  const { user } = useAuth();
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const getAdvice = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setAdvice("");
    try {
      const fn = httpsCallable<{ userId: string }, AdviceResult>(functions, "getTrainingAdvice");
      const result = await fn({ userId: user.uid });
      setAdvice(result.data.advice);
    } catch (e) {
      setError("アドバイスの取得に失敗しました。プロフィールと目標が登録されているか確認してください。");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">AIトレーニングアドバイス</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたのプロフィール・目標・トレーニング履歴をもとに、今週のメニューを提案します。
      </p>

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
          "🤖 今週のトレーニングメニューを提案してもらう"
        )}
      </button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {advice && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 prose prose-sm max-w-none">
          <ReactMarkdown>{advice}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
