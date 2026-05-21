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

function genderLabel(g: string): string {
  return g === "male" ? "男性" : g === "female" ? "女性" : "その他";
}

export const getTrainingAdvice = onCall(
  { secrets: [anthropicApiKey], region: "asia-northeast1" },
  async (request) => {
    const { userId } = request.data as { userId: string };
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");

    const db = admin.firestore();

    // プロフィールと目標を取得
    const [profileSnap, goalSnap] = await Promise.all([
      db.doc(`users/${userId}/data/profile`).get(),
      db.doc(`users/${userId}/data/goal`).get(),
    ]);

    if (!profileSnap.exists || !goalSnap.exists) {
      throw new HttpsError(
        "failed-precondition",
        "プロフィールと目標を先に登録してください"
      );
    }

    const profile = profileSnap.data()!;
    const goal = goalSnap.data()!;

    // 直近30日のトレーニングを取得
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const dateStr = thirtyDaysAgo.toISOString().slice(0, 10);

    const trainingsSnap = await db
      .collection(`users/${userId}/trainings`)
      .where("date", ">=", dateStr)
      .orderBy("date", "desc")
      .limit(30)
      .get();

    const trainings = trainingsSnap.docs.map((d) => d.data());

    const trainingsSummary =
      trainings.length === 0
        ? "（まだトレーニング記録がありません）"
        : trainings
            .map((t) => {
              if (t.type === "rest") return `${t.date}: 休養`;
              const typeLabel = t.type === "cross" ? "クロストレーニング" : "ランニング";
              return `${t.date}: ${typeLabel} ${t.distanceKm}km / ${formatTime(t.durationSec)} / ペース${formatTime(t.avgPaceSecPerKm)}/km${t.notes ? ` / ${t.notes}` : ""}`;
            })
            .join("\n");

    const marathonLabel = goal.marathonType === "full" ? "フルマラソン(42.195km)" : "ハーフマラソン(21.0975km)";
    const today = new Date().toISOString().slice(0, 10);
    const daysUntilGoal = Math.ceil(
      (new Date(goal.targetDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    );

    const userMessage = `
【ユーザー情報】
名前: ${profile.name}
年齢: ${profile.age}歳
性別: ${genderLabel(profile.gender)}
身長: ${profile.heightCm}cm
体重: ${profile.weightKg}kg

【目標】
種目: ${marathonLabel}
現在のタイム: ${formatTime(goal.currentTimeSec)}
目標タイム: ${formatTime(goal.targetTimeSec)}
目標日: ${goal.targetDate}（本日から${daysUntilGoal}日後）

【直近30日のトレーニング履歴】
${trainingsSummary}

今週（7日間）の具体的なトレーニングメニューを提案してください。
各日のメニューに、目的・内容（距離やペースの目安）を含めてください。
日本語で答えてください。
`.trim();

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "あなたは経験豊富なプロのランニングコーチです。ユーザーのデータを分析し、科学的根拠に基づいた実践的なトレーニングメニューを提案します。フォーマットはMarkdownを使用し、読みやすく整理してください。",
      messages: [{ role: "user", content: userMessage }],
    });

    const advice = response.content[0].type === "text" ? response.content[0].text : "";
    return { advice };
  }
);
