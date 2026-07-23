import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { TrendingUp } from "lucide-react";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { Card, Field, Button, Chip, EmptyState, controlClass } from "../components/ui";
import { Markdown } from "../components/Markdown";

interface ReviewResult {
  review: string;
}

const CONDITION_OPTIONS = [
  { label: "問題なし", tone: "green" },
  { label: "軽い違和感", tone: "orange" },
  { label: "故障・離脱あり", tone: "red" },
] as const;

const MOTIVATION_OPTIONS = [
  { label: "高い", tone: "green" },
  { label: "普通", tone: "gray" },
  { label: "低下気味", tone: "orange" },
] as const;

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

  if (initialLoading) return <EmptyState message="読み込み中..." />;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">進捗ふりかえり</h2>
      <p className="text-sm text-gray-500 mb-5">
        これまでのトレーニング実績と目標をもとに、進捗チェック・ふりかえり・今後のアドバイスをAIが作成します。
      </p>

      <Card className="mb-4 space-y-4">
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">体調・故障の有無</p>
          <div className="flex gap-2 flex-wrap">
            {CONDITION_OPTIONS.map(({ label, tone }) => (
              <Chip
                key={label}
                tone={tone}
                selected={physicalCondition === label}
                onClick={() => setPhysicalCondition(label)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">モチベーション・手応え</p>
          <div className="flex gap-2 flex-wrap">
            {MOTIVATION_OPTIONS.map(({ label, tone }) => (
              <Chip
                key={label}
                tone={tone}
                selected={motivation === label}
                onClick={() => setMotivation(label)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="自由記述メモ（任意）">
          <textarea
            value={freeNote}
            onChange={(e) => setFreeNote(e.target.value)}
            rows={3}
            placeholder="この期間で一番大きかった変化、気になっていること、生活面の状況など"
            className={controlClass}
          />
        </Field>
      </Card>

      <Button onClick={getReview} loading={loading} size="lg" className="w-full mb-5">
        {loading ? (
          "AIがふりかえり中..."
        ) : (
          <>
            <TrendingUp className="w-5 h-5" />
            ふりかえりを生成する
          </>
        )}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {review && (
        <Card padding="md">
          {generatedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {generatedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <Markdown>{review}</Markdown>
        </Card>
      )}
    </div>
  );
}
