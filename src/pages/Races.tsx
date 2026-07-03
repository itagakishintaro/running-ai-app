import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type RaceMode = "training" | "travel";

interface RaceResult {
  recommendation: string;
  mode: RaceMode;
}

const MODE_OPTIONS: { value: RaceMode; emoji: string; label: string; description: string }[] = [
  { value: "training", emoji: "🏃", label: "トレーニング目的", description: "近場の大会で実戦経験を積む" },
  { value: "travel", emoji: "🧳", label: "旅RUN", description: "旅行を兼ねて楽しむ大会を探す" },
];

export function Races() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.uid);
  const [mode, setMode] = useState<RaceMode>("training");
  const [freeRequest, setFreeRequest] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsPrefecture, setNeedsPrefecture] = useState(false);

  useEffect(() => {
    if (!user) { setInitialLoading(false); return; }
    getDoc(doc(db, "users", user.uid, "data", "raceRecommendation")).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRecommendation(data.recommendation ?? "");
        setGeneratedAt(data.generatedAt?.toDate() ?? null);
        if (data.mode === "training" || data.mode === "travel") setMode(data.mode);
        setFreeRequest(data.freeRequest ?? "");
      }
      setInitialLoading(false);
    });
  }, [user]);

  const prefectureMissing = mode === "training" && !profile?.prefecture;

  const getRecommendations = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setNeedsPrefecture(false);
    try {
      const fn = httpsCallable<
        { userId: string; mode: RaceMode; freeRequest?: string },
        RaceResult
      >(functions, "getRaceRecommendations", { timeout: 180_000 });
      const result = await fn({
        userId: user.uid,
        mode,
        freeRequest: mode === "travel" ? freeRequest : undefined,
      });
      const newRecommendation = result.data.recommendation;
      setRecommendation(newRecommendation);
      setGeneratedAt(new Date());
      await setDoc(doc(db, "users", user.uid, "data", "raceRecommendation"), {
        recommendation: newRecommendation,
        mode,
        freeRequest: mode === "travel" ? freeRequest : "",
        generatedAt: serverTimestamp(),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "";
      if (message.includes("居住地")) {
        setNeedsPrefecture(true);
      } else {
        setError("大会レコメンドの取得に失敗しました。プロフィールと目標が登録されているか確認のうえ、時間をおいて再度お試しください。");
      }
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) return <p className="text-center text-gray-400 py-10">読み込み中...</p>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">マラソン大会レコメンド</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたの目標と現在のタイムをもとに、収集済みの全国大会データベースから出場すべき大会を提案します。エントリー期間もチェックします。
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">目的を選ぶ</label>
          <div className="grid grid-cols-2 gap-3">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMode(opt.value)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  mode === opt.value
                    ? "border-blue-500 bg-blue-50 ring-2 ring-blue-300"
                    : "border-gray-200 bg-white hover:border-gray-400"
                }`}
              >
                <p className="font-semibold text-gray-800 text-sm">{opt.emoji} {opt.label}</p>
                <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
              </button>
            ))}
          </div>
        </div>

        {(prefectureMissing || needsPrefecture) && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm text-yellow-800">
            近場の大会を探すには居住地の登録が必要です。{" "}
            <Link to="/profile" className="text-blue-600 underline">
              プロフィールで居住地（都道府県）を登録する
            </Link>
          </div>
        )}

        {mode === "travel" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">旅のリクエスト（任意）</label>
            <textarea
              value={freeRequest}
              onChange={(e) => setFreeRequest(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="例: 地酒を楽しみたい / 温泉に入りたい / 海沿いを走りたい"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        )}
      </div>

      <button
        onClick={getRecommendations}
        disabled={loading || prefectureMissing}
        className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl py-4 font-semibold transition-colors shadow mb-2"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            大会を検索中...
          </span>
        ) : (
          "🏅 おすすめの大会を探してもらう"
        )}
      </button>
      {loading && (
        <p className="text-xs text-gray-400 text-center mb-4">
          30秒〜1分ほどかかります。このままお待ちください
        </p>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4 mt-3">
          {error}
        </div>
      )}

      {recommendation && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-3">
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {generatedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <div className="prose prose-sm max-w-none prose-headings:font-bold prose-headings:text-gray-800 prose-h2:text-base prose-h3:text-sm prose-h3:text-blue-700 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-li:leading-relaxed prose-strong:text-gray-900 prose-hr:my-4 prose-a:text-blue-600 prose-a:underline">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => <a {...props} target="_blank" rel="noopener noreferrer" />,
              }}
            >
              {recommendation}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
