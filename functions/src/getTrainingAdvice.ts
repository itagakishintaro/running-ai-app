import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

function formatTime(totalSec: number): string {
  // 画像解析等で割り切れない秒数が渡ると剰余演算に浮動小数点誤差が残るため、
  // 先に整数秒へ四捨五入してから分解する。
  totalSec = Math.round(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function genderLabel(g: string): string {
  return g === "male" ? "男性" : g === "female" ? "女性" : "その他";
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// YYYY-MM-DD を暦日付として解釈し「2026-06-01（月）」形式に整形する。
// T00:00:00Z + getUTCDay() でランタイムのタイムゾーンに依存せず曜日を確定する
// （getProgressReview.ts の weekStart() と同方式）。曜日をLLMの推測任せにしない。
function withWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateStr; // 不正な日付はそのまま返す
  return `${dateStr}（${WEEKDAYS[d.getUTCDay()]}）`;
}

function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age--;
  return age;
}

export const getTrainingAdvice = onCall(
  { secrets: [anthropicApiKey], region: "asia-northeast1" },
  async (request) => {
    const { userId, startDate, endDate, restDays, condition } = request.data as {
      userId: string;
      startDate?: string;
      endDate?: string;
      restDays?: string[];
      condition?: string;
    };
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");

    const today = new Date().toISOString().slice(0, 10);
    const menuStart = startDate ?? today;
    const menuEndDate = new Date(menuStart);
    menuEndDate.setDate(menuEndDate.getDate() + 6);
    const menuEnd = endDate ?? menuEndDate.toISOString().slice(0, 10);

    // メニュー対象期間の各日付と曜日をコードで確定し、LLMが曜日を自前計算しないようにする。
    const menuDateLines: string[] = [];
    const cursor = new Date(`${menuStart}T00:00:00Z`);
    const lastDay = new Date(`${menuEnd}T00:00:00Z`);
    while (cursor <= lastDay) {
      menuDateLines.push(withWeekday(cursor.toISOString().slice(0, 10)));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const menuDateList = menuDateLines.join("\n");

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

    const trainingsSummary =
      trainings.length === 0
        ? "（まだトレーニング記録がありません）"
        : trainings
            .map((t) => {
              const label = typeLabel[t.type] ?? t.type;
              if (t.type === "rest") return `${withWeekday(t.date)}: 休養`;
              return `${withWeekday(t.date)}: ${label} ${t.distanceKm}km / ${formatTime(t.durationSec)} / ペース${formatTime(t.avgPaceSecPerKm)}/km${t.notes ? ` / ${t.notes}` : ""}`;
            })
            .join("\n");

    const marathonLabel = goal.marathonType === "full" ? "フルマラソン(42.195km)" : "ハーフマラソン(21.0975km)";
    const daysUntilGoal = Math.ceil(
      (new Date(goal.targetDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
    );

    const age = profile.birthDate ? calcAge(profile.birthDate) : (profile.age ?? "不明");

    const userMessage = `
【ユーザー情報】
名前: ${profile.name}
年齢: ${age}歳
性別: ${genderLabel(profile.gender)}
身長: ${profile.heightCm}cm
体重: ${profile.weightKg}kg

【目標】
種目: ${marathonLabel}
現在のタイム: ${formatTime(goal.currentTimeSec)}
目標タイム: ${formatTime(goal.targetTimeSec)}
目標日: ${withWeekday(goal.targetDate)}（本日から${daysUntilGoal}日後）

【直近30日のトレーニング履歴】
${trainingsSummary}

【現在の体調】: ${condition ?? "普通"}
${condition === "絶好調" ? "体調が絶好調のため、このチャンスを活かして強くなるためのメニューにしてください。" : ""}
${condition === "良い" ? "体調が良いため、やや強度を上げたメニューにしてください。" : ""}
${condition === "普通" ? "体調が普通のため、標準的なメニューにしてください。" : ""}
${condition === "悪い" ? "体調が悪いため、負荷を下げた軽めのメニューにしてください。" : ""}
${condition === "最悪" ? "体調が最悪のため、トレーニング量を大幅に減らし、回復を優先するメニューにしてください。" : ""}

${menuStart}から${menuEnd}までの期間のトレーニングメニューを提案してください。
対象期間の日付と曜日（必ずこの対応を使い、曜日を自分で計算し直さないこと）:
${menuDateList}

各日付を明示した上で、その日のメニューに目的・内容（距離やペースの目安）を含めてください。
日付には上記一覧の曜日をそのまま付けてください。
${restDays && restDays.length > 0 ? `【トレーニングできない曜日】: ${restDays.join("・")}曜日はトレーニング不可のため、その日は必ず「休養」としてください。` : ""}
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
