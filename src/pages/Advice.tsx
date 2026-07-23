import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { Sparkles } from "lucide-react";
import { functions, db } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { Card, Field, Input, Button, Chip, EmptyState } from "../components/ui";
import { Markdown } from "../components/Markdown";

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

const CONDITION_OPTIONS = [
  { label: "絶好調", tone: "green" },
  { label: "良い", tone: "blue" },
  { label: "普通", tone: "gray" },
  { label: "悪い", tone: "orange" },
  { label: "最悪", tone: "red" },
] as const;

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

  if (initialLoading) return <EmptyState message="読み込み中..." />;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">AIトレーニングアドバイス</h2>
      <p className="text-sm text-gray-500 mb-5">
        あなたのプロフィール・目標・トレーニング履歴をもとに、トレーニングメニューを提案します。
      </p>

      <Card className="mb-4 space-y-4">
        <div className="flex gap-4">
          <Field label="メニュー開始日" className="flex-1">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="メニュー終了日" className="flex-1">
            <Input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">トレーニングできない曜日</p>
          <div className="flex gap-3 flex-wrap">
            {["月", "火", "水", "木", "金", "土", "日"].map((day) => (
              <label key={day} className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={restDays.includes(day)}
                  onChange={(e) => {
                    setRestDays(e.target.checked
                      ? [...restDays, day]
                      : restDays.filter((d) => d !== day));
                  }}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">{day}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">現在の体調</p>
          <div className="flex gap-2 flex-wrap">
            {CONDITION_OPTIONS.map(({ label, tone }) => (
              <Chip
                key={label}
                tone={tone}
                selected={condition === label}
                onClick={() => setCondition(label)}
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <Button
        onClick={getAdvice}
        loading={loading}
        size="lg"
        className="w-full mb-5"
      >
        {loading ? (
          "AIが考えています..."
        ) : (
          <>
            <Sparkles className="w-5 h-5" />
            トレーニングメニューを提案してもらう
          </>
        )}
      </Button>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {advice && (
        <Card padding="md">
          {adviceGeneratedAt && (
            <p className="text-xs text-gray-400 mb-4">
              生成日時: {adviceGeneratedAt.toLocaleString("ja-JP")}
            </p>
          )}
          <Markdown>{advice}</Markdown>
        </Card>
      )}
    </div>
  );
}
