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
type RaceType = "marathon" | "trail";
type TrailDifficulty = "easy" | "moderate" | "hard";

interface RaceResult {
  recommendation: string;
  mode: RaceMode;
}

const MODE_OPTIONS: { value: RaceMode; emoji: string; label: string; description: string }[] = [
  { value: "training", emoji: "🏃", label: "トレーニング目的", description: "近場の大会で実戦経験を積む" },
  { value: "travel", emoji: "🧳", label: "旅RUN", description: "旅行を兼ねて楽しむ大会を探す" },
];

const RACE_TYPE_OPTIONS: { value: RaceType; emoji: string; label: string; description: string }[] = [
  { value: "marathon", emoji: "🏃", label: "マラソン", description: "ロードのフル・ハーフなど" },
  { value: "trail", emoji: "⛰️", label: "トレイルラン", description: "山岳・トレイルの大会" },
];

// 表示専用の難易度係数（条件の正はFunctions側のTRAIL_DIFFICULTYが持つ）
const DIFFICULTY_OPTIONS: { value: TrailDifficulty; label: string; ratio: number }[] = [
  { value: "easy",     label: "やさしめ", ratio: 0.035 },
  { value: "moderate", label: "中程度",   ratio: 0.05 },
  { value: "hard",     label: "ハード",   ratio: 0.065 },
];

export function Races() {
  const { user } = useAuth();
  const { profile } = useProfile(user?.uid);
  const [mode, setMode] = useState<RaceMode>("training");
  const [raceType, setRaceType] = useState<RaceType>("marathon");
  const [trailDistance, setTrailDistance] = useState("");
  const [trailDifficulty, setTrailDifficulty] = useState<TrailDifficulty>("moderate");
  const [freeRequest, setFreeRequest] = useState("");
  const [periodFrom, setPeriodFrom] = useState(""); // YYYY-MM
  const [periodTo, setPeriodTo] = useState("");
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
        // raceTypeフィールドのない既存ドキュメントはマラソン扱いのまま
        if (data.raceType === "trail") {
          setRaceType("trail");
          if (data.trailDistanceKm) setTrailDistance(String(data.trailDistanceKm));
          if (data.trailDifficulty === "easy" || data.trailDifficulty === "moderate" || data.trailDifficulty === "hard") {
            setTrailDifficulty(data.trailDifficulty);
          }
        }
        setFreeRequest(data.freeRequest ?? "");
        setPeriodFrom(data.periodFrom ?? "");
        setPeriodTo(data.periodTo ?? "");
      }
      setInitialLoading(false);
    });
  }, [user]);

  const prefectureMissing = mode === "training" && !profile?.prefecture;
  const trailDistanceMissing = raceType === "trail" && !(Number(trailDistance) > 0);
  const difficultyRatio = DIFFICULTY_OPTIONS.find((o) => o.value === trailDifficulty)?.ratio ?? 0.05;
  const targetElevationM = Number(trailDistance) > 0 ? Math.round(Number(trailDistance) * 1000 * difficultyRatio) : 0;

  const getRecommendations = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setNeedsPrefecture(false);
    try {
      const fn = httpsCallable<
        {
          userId: string;
          mode: RaceMode;
          freeRequest?: string;
          periodFrom?: string;
          periodTo?: string;
          raceType: RaceType;
          trailDistanceKm?: number;
          trailDifficulty?: TrailDifficulty;
        },
        RaceResult
      >(functions, "getRaceRecommendations", { timeout: 180_000 });
      const result = await fn({
        userId: user.uid,
        mode,
        freeRequest: mode === "travel" ? freeRequest : undefined,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        raceType,
        trailDistanceKm: raceType === "trail" ? Number(trailDistance) : undefined,
        trailDifficulty: raceType === "trail" ? trailDifficulty : undefined,
      });
      const newRecommendation = result.data.recommendation;
      setRecommendation(newRecommendation);
      setGeneratedAt(new Date());
      await setDoc(doc(db, "users", user.uid, "data", "raceRecommendation"), {
        recommendation: newRecommendation,
        mode,
        freeRequest: mode === "travel" ? freeRequest : "",
        periodFrom,
        periodTo,
        raceType,
        trailDistanceKm: raceType === "trail" ? Number(trailDistance) : null,
        trailDifficulty: raceType === "trail" ? trailDifficulty : null,
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
      <h2 className="text-xl font-bold text-gray-800 mb-2">大会レコメンド</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたの目標と現在のタイムをもとに、収集済みの全国大会データベースから出場すべき大会を提案します。エントリー期間もチェックします。
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">種目を選ぶ</label>
          <div className="grid grid-cols-2 gap-3">
            {RACE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRaceType(opt.value)}
                className={`text-left rounded-xl border p-3 transition-all ${
                  raceType === opt.value
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

        {raceType === "trail" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">希望距離 (km)</label>
              <input
                type="number"
                value={trailDistance}
                onChange={(e) => setTrailDistance(e.target.value)}
                min="1"
                placeholder="30"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">難易度</label>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTrailDifficulty(opt.value)}
                    className={`rounded-lg border py-2 text-sm font-medium transition-all ${
                      trailDifficulty === opt.value
                        ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                難易度は距離に対する累積標高の割合が目安: 〜3.5% やさしめ / 5%前後 中程度 / 6.5%〜 ハード（例: 30kmで約1,500m＝中程度）
                {targetElevationM > 0 && (
                  <span className="block mt-1 font-medium text-gray-700">
                    この条件の累積標高目安: 約{targetElevationM.toLocaleString()}m
                  </span>
                )}
              </p>
            </div>
          </div>
        )}

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

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">対象時期（任意）</label>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              max={periodTo || undefined}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <input
              type="month"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              min={periodFrom || undefined}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            未指定なら目標日に合わせて提案します。期間を指定すると、その期間内で時期が偏らないように提案します
          </p>
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
        disabled={loading || prefectureMissing || trailDistanceMissing}
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
