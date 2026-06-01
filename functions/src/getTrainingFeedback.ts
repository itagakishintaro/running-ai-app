import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const typeLabel: Record<string, string> = {
  jog:      "ジョグ",
  run:      "ランニング",
  long:     "距離走（LSD）",
  pace:     "ペース走",
  buildup:  "ビルドアップ走",
  tempo:    "テンポ走（閾値走）",
  interval: "インターバルトレーニング",
  cross:    "クロストレーニング",
  rest:     "休養",
};

interface FeedbackTraining {
  date: string;
  type: string;
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  notes: string;
}

export const getTrainingFeedback = onCall(
  { secrets: [anthropicApiKey], region: "asia-northeast1" },
  async (request) => {
    const { userId, training } = request.data as {
      userId: string;
      training: FeedbackTraining;
    };
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");
    if (!training) throw new HttpsError("invalid-argument", "training is required");

    const db = admin.firestore();

    // プロフィール・目標・既存の提案メニューを取得（無くてもエラーにしない）
    const [profileSnap, goalSnap, adviceSnap] = await Promise.all([
      db.doc(`users/${userId}/data/profile`).get(),
      db.doc(`users/${userId}/data/goal`).get(),
      db.doc(`users/${userId}/data/advice`).get(),
    ]);

    const profile = profileSnap.exists ? profileSnap.data()! : null;
    const goal = goalSnap.exists ? goalSnap.data()! : null;
    const proposedMenu = adviceSnap.exists ? (adviceSnap.data()!.advice as string) : "";

    // 目標情報（あれば）
    let goalSummary = "（目標未設定）";
    if (goal) {
      const marathonLabel =
        goal.marathonType === "full" ? "フルマラソン(42.195km)" : "ハーフマラソン(21.0975km)";
      goalSummary = `${marathonLabel} / 目標タイム ${formatTime(goal.targetTimeSec)} / 目標日 ${goal.targetDate}`;
    }

    // 今回登録したトレーニングの実績
    const label = typeLabel[training.type] ?? training.type;
    const actualSummary =
      training.type === "rest"
        ? `${training.date}: 休養`
        : `${training.date}: ${label} ${training.distanceKm}km / ${formatTime(training.durationSec)} / ペース${formatTime(training.avgPaceSecPerKm)}/km${training.notes ? ` / メモ: ${training.notes}` : ""}`;

    const userMessage = `
${profile ? `【ランナー】${profile.name}さん` : ""}
【目標】${goalSummary}

【今回記録したトレーニング】
${actualSummary}

【AIが提案していたトレーニングメニュー】
${proposedMenu || "（提案メニューはまだありません）"}

上記をふまえ、今回のトレーニングについて短い「一言アドバイス」を返してください。
特に次の2点を重視してください：
1. 提案メニューと今回の実績にズレがある場合（予定どおりできなかった・強度や距離が違う等）、今後どう調整・リカバリすればよいか。
2. 次回のトレーニングに向けた注意点（疲労・故障予防、ペース配分など）。
提案メニューが無い、またはズレが小さい場合は、今回の内容への前向きな評価と次回への注意点を中心にしてください。

制約：全体で2〜3文程度。励ましつつ実践的に。Markdownの太字を少し使ってよいが、見出しや箇条書きの羅列は避け、簡潔にまとめてください。日本語で。
`.trim();

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:
        "あなたは経験豊富で親しみやすいランニングコーチです。記録されたトレーニングに対して、短く、励ましつつ実践的な一言アドバイスを返します。長々と説明せず、要点を簡潔に伝えてください。",
      messages: [{ role: "user", content: userMessage }],
    });

    const feedback = response.content[0].type === "text" ? response.content[0].text : "";
    return { feedback };
  }
);
