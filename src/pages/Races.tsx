import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Footprints, Mountain, Plane, Medal } from "lucide-react";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import { Card, Field, Input, Button, EmptyState, controlClass, cn } from "../components/ui";
import { Markdown } from "../components/Markdown";
import type { LucideIcon } from "lucide-react";

type RaceMode = "training" | "travel";
type RaceType = "marathon" | "trail";
type TrailDifficulty = "easy" | "moderate" | "hard";

interface RaceResult {
  recommendation: string;
  mode: RaceMode;
}

const MODE_OPTIONS: { value: RaceMode; icon: LucideIcon; label: string; description: string }[] = [
  { value: "training", icon: Footprints, label: "トレーニング目的", description: "近場の大会で実戦経験を積む" },
  { value: "travel", icon: Plane, label: "旅RUN", description: "旅行を兼ねて楽しむ大会を探す" },
];

const RACE_TYPE_OPTIONS: { value: RaceType; icon: LucideIcon; label: string; description: string }[] = [
  { value: "marathon", icon: Footprints, label: "マラソン", description: "ロードのフル・ハーフなど" },
  { value: "trail", icon: Mountain, label: "トレイルラン", description: "山岳・トレイルの大会" },
];

// 表示専用の難易度係数（条件の正はFunctions側のTRAIL_DIFFICULTYが持つ）
const DIFFICULTY_OPTIONS: { value: TrailDifficulty; label: string; ratio: number }[] = [
  { value: "easy",     label: "やさしめ", ratio: 0.035 },
  { value: "moderate", label: "中程度",   ratio: 0.05 },
  { value: "hard",     label: "ハード",   ratio: 0.065 },
];

const selectCardClass = (selected: boolean) =>
  cn(
    "text-left rounded-xl border p-3 transition-all",
    selected
      ? "border-primary-500 bg-primary-50 ring-2 ring-primary-300"
      : "border-gray-200 bg-white hover:border-gray-400"
  );

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

  if (initialLoading) return <EmptyState message="読み込み中..." />;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">大会レコメンド</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたの目標と現在のタイムをもとに、収集済みの全国大会データベースから出場すべき大会を提案します。エントリー期間もチェックします。
      </p>

      <Card className="mb-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">種目を選ぶ</p>
          <div className="grid grid-cols-2 gap-3">
            {RACE_TYPE_OPTIONS.map(({ value, icon: Icon, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRaceType(value)}
                className={selectCardClass(raceType === value)}
              >
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-primary-600" />
                  {label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {raceType === "trail" && (
          <div className="space-y-3">
            <Field label="希望距離 (km)">
              <Input
                type="number"
                value={trailDistance}
                onChange={(e) => setTrailDistance(e.target.value)}
                min="1"
                placeholder="30"
              />
            </Field>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">難易度</p>
              <div className="grid grid-cols-3 gap-2">
                {DIFFICULTY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTrailDifficulty(opt.value)}
                    className={cn(
                      "rounded-lg border py-2 text-sm font-medium transition-all",
                      trailDifficulty === opt.value
                        ? "border-primary-500 bg-primary-50 text-primary-700 ring-2 ring-primary-300"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                    )}
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
          <p className="text-sm font-medium text-gray-700 mb-2">目的を選ぶ</p>
          <div className="grid grid-cols-2 gap-3">
            {MODE_OPTIONS.map(({ value, icon: Icon, label, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={selectCardClass(mode === value)}
              >
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                  <Icon className="w-4 h-4 text-primary-600" />
                  {label}
                </p>
                <p className="text-xs text-gray-500 mt-1">{description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">対象時期（任意）</p>
          <div className="flex items-center gap-2">
            <Input
              type="month"
              value={periodFrom}
              onChange={(e) => setPeriodFrom(e.target.value)}
              max={periodTo || undefined}
              className="flex-1"
            />
            <span className="text-gray-400 text-sm">〜</span>
            <Input
              type="month"
              value={periodTo}
              onChange={(e) => setPeriodTo(e.target.value)}
              min={periodFrom || undefined}
              className="flex-1"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            未指定なら目標日に合わせて提案します。期間を指定すると、その期間内で時期が偏らないように提案します
          </p>
        </div>

        {(prefectureMissing || needsPrefecture) && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            近場の大会を探すには居住地の登録が必要です。{" "}
            <Link to="/profile" className="text-primary-700 underline font-medium">
              プロフィールで居住地（都道府県）を登録する
            </Link>
          </div>
        )}

        {mode === "travel" && (
          <Field label="旅のリクエスト（任意）">
            <textarea
              value={freeRequest}
              onChange={(e) => setFreeRequest(e.target.value)}
              rows={2}
              maxLength={500}
              placeholder="例: 地酒を楽しみたい / 温泉に入りたい / 海沿いを走りたい"
              className={controlClass}
            />
          </Field>
        )}
      </Card>

      <Button
        onClick={getRecommendations}
        loading={loading}
        disabled={loading || prefectureMissing || trailDistanceMissing}
        size="lg"
        className="w-full mb-2"
      >
        {loading ? (
          "大会を検索中..."
        ) : (
          <>
            <Medal className="w-5 h-5" />
            おすすめの大会を探してもらう
          </>
        )}
      </Button>
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
        <Card padding="md" className="mt-3">
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {generatedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <Markdown>{recommendation}</Markdown>
        </Card>
      )}
    </div>
  );
}
