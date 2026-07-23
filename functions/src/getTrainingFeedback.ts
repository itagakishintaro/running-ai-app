import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { describeGoal, GoalDoc } from "./goalLabel";

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

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

// YYYY-MM-DD を暦日付として解釈し「2026-06-01（月）」形式に整形する。
// T00:00:00Z + getUTCDay() でランタイムのタイムゾーンに依存せず曜日を確定する
// （getProgressReview.ts の weekStart() と同方式）。曜日をLLMの推測任せにしない。
function withWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (isNaN(d.getTime())) return dateStr; // 不正な日付はそのまま返す
  return `${dateStr}（${WEEKDAYS[d.getUTCDay()]}）`;
}

function isIsoDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const d = new Date(`${value}T00:00:00Z`);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function extractMenuDateRange(menuText: string): { startDate: string; endDate: string } | null {
  const dates = Array.from(
    new Set(
      Array.from(menuText.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g), (m) => m[0])
        .filter(isIsoDateString)
    )
  ).sort();

  if (dates.length === 0) return null;
  return { startDate: dates[0], endDate: dates[dates.length - 1] };
}

function dateStringFromTimestampLike(value: unknown): string | null {
  const maybeDate =
    value instanceof Date
      ? value
      : value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof value.toDate === "function"
      ? value.toDate()
      : null;

  if (!(maybeDate instanceof Date) || isNaN(maybeDate.getTime())) return null;
  return maybeDate.toISOString().slice(0, 10);
}

const typeLabel: Record<string, string> = {
  jog:      "ジョグ",
  run:      "ランニング",
  long:     "距離走（LSD）",
  pace:     "ペース走",
  buildup:  "ビルドアップ走",
  tempo:    "テンポ走（閾値走）",
  interval: "インターバルトレーニング",
  trail:    "トレイルラン",
  cross:    "クロストレーニング",
  rest:     "休養",
};

interface FeedbackTraining {
  date: string;
  type: string;
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  elevationGainM?: number | null;
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
    const [profileSnap, goalsSnap, adviceSnap] = await Promise.all([
      db.doc(`users/${userId}/data/profile`).get(),
      db.collection(`users/${userId}/goals`).orderBy("targetDate", "asc").get(),
      db.doc(`users/${userId}/data/advice`).get(),
    ]);

    const profile = profileSnap.exists ? profileSnap.data()! : null;
    const goals = goalsSnap.docs.map((d) => d.data());

    // --- 提案メニューの取得と「今回のトレーニング日にまだ有効か」の判定 ---------
    // 以前は保存済みの提案メニューを無条件でLLMに渡し「実績と比較せよ」と指示していた。
    // しかしメニューには対象期間があり、しばらくアドバイスを更新していないと
    // 保存されているのは過去の期間のメニューになる。今日の日付やメニューの対象期間を
    // LLMに与えていなかったため、古いメニューを現行プランと誤認して比較してしまっていた。
    // ここで対象期間と今回のトレーニング日をコードで突き合わせ、有効なメニューのときだけ
    // 比較させる（日付は YYYY-MM-DD 文字列なので辞書順比較が日付比較として成立する）。
    const today = new Date().toISOString().slice(0, 10);
    const adviceData = adviceSnap.exists ? adviceSnap.data()! : null;
    const proposedMenu = (adviceData?.advice as string) ?? "";
    const storedMenuStartDate = adviceData?.menuStartDate;
    const storedMenuEndDate = adviceData?.menuEndDate;
    const inferredMenuRange = proposedMenu ? extractMenuDateRange(proposedMenu) : null;
    const menuStartDate = isIsoDateString(storedMenuStartDate)
      ? storedMenuStartDate
      : inferredMenuRange?.startDate;
    const menuEndDate = isIsoDateString(storedMenuEndDate)
      ? storedMenuEndDate
      : inferredMenuRange?.endDate;
    const menuPeriodSource =
      isIsoDateString(storedMenuStartDate) && isIsoDateString(storedMenuEndDate)
        ? "saved"
        : inferredMenuRange
        ? "inferred"
        : "unknown";
    const generatedAtStr = dateStringFromTimestampLike(adviceData?.generatedAt);

    // メニューの状態を判定:
    //  none    … 提案メニューが未生成
    //  current … 対象期間が今回のトレーニング日を含む（＝現行プランとして有効）
    //  stale   … 対象期間が今回のトレーニング日を含まない（過去/別期間の古いメニュー）
    //  unknown … 対象期間が保存されておらず、メニュー本文からも推定できない旧データ
    type MenuStatus = "none" | "current" | "stale" | "unknown";
    let menuStatus: MenuStatus = "none";
    if (proposedMenu) {
      if (menuStartDate && menuEndDate) {
        menuStatus =
          training.date >= menuStartDate && training.date <= menuEndDate
            ? "current"
            : "stale";
      } else {
        menuStatus = "unknown";
      }
    }

    // 目標情報（あれば）
    let goalSummary = "（目標未設定）";
    if (goals.length > 0) {
      goalSummary = goals
        .map((g) => `- ${describeGoal(g as GoalDoc)}\n  目標日: ${withWeekday(g.targetDate)}`)
        .join("\n");
    }

    // 今回登録したトレーニングの実績
    const label = typeLabel[training.type] ?? training.type;
    const actualSummary =
      training.type === "rest"
        ? `${withWeekday(training.date)}: 休養`
        : `${withWeekday(training.date)}: ${label} ${training.distanceKm}km / ${formatTime(training.durationSec)} / ペース${formatTime(training.avgPaceSecPerKm)}/km${training.elevationGainM ? ` / 累積標高${training.elevationGainM}m` : ""}${training.notes ? ` / メモ: ${training.notes}` : ""}`;

    // メニューの状態に応じて「提案メニュー」ブロックと比較指示を組み立てる。
    // 期間の分かる形で提示し、古い/対象外のメニューは比較させない。
    let menuBlock: string;
    let compareInstruction: string;
    if (menuStatus === "current") {
      const sourceNote = menuPeriodSource === "inferred" ? "メニュー本文の日付から推定" : "保存済み期間";
      menuBlock = `【AIが提案していたトレーニングメニュー（対象期間 ${menuStartDate}〜${menuEndDate}／${sourceNote}／今回のトレーニング日を含む・現行プラン）】\n${proposedMenu}`;
      compareInstruction =
        "1. この提案メニューは今回のトレーニング日を含む有効な期間のものです。提案メニューの同じ日付の内容と今回の実績にズレがある場合（予定どおりできなかった・強度や距離が違う等）は、今後どう調整・リカバリすればよいか。ズレが小さい場合は前向きに評価してください。";
    } else if (menuStatus === "stale") {
      // 対象期間が分かっていて、今回のトレーニング日を含まない = 明確に古い/別期間。
      const sourceNote = menuPeriodSource === "inferred" ? "メニュー本文の日付から推定" : "保存済み期間";
      menuBlock =
        `【以前に提案したトレーニングメニューの扱い】\n` +
        `保存済みの提案メニューは対象期間 ${menuStartDate}〜${menuEndDate}（${sourceNote}）で、今回のトレーニング日（${withWeekday(training.date)}）を含みません。\n` +
        "これは現在有効な提案メニューではなく、過去（または別期間）に作成した古いものです。古いメニュー本文は比較対象から除外しています。";
      compareInstruction =
        "1. 上記の提案メニューは今回のトレーニング日を含まない古いものです。今回の実績と比較・照合しないでください。今回のトレーニングそのものを評価し、必要であれば「最新のトレーニングメニューを生成し直すと今後の計画が立てやすい」旨をやんわり添えてください。";
    } else if (menuStatus === "unknown") {
      // 旧データで対象期間が保存されておらず、メニュー本文からも推定できない。
      // 有効性を判断できないものを比較対象にすると誤判定の温床になるため、比較させない。
      const genNote = generatedAtStr ? `生成日 ${generatedAtStr}` : "生成時期不明";
      menuBlock =
        `【以前に提案したトレーニングメニューの扱い】\n` +
        `保存済みの提案メニューはありますが、対象期間を確認できません（${genNote}）。有効な現行プランか判断できないため、古いメニュー本文は比較対象から除外しています。`;
      compareInstruction =
        "1. 保存済みの提案メニューは対象期間を確認できないため、今回の実績と比較・照合しないでください。今回のトレーニングそのものを評価し、必要であれば「最新のトレーニングメニューを生成し直すと今後の計画が立てやすい」旨をやんわり添えてください。";
    } else {
      menuBlock = "【AIが提案していたトレーニングメニュー】\n（提案メニューはまだありません）";
      compareInstruction =
        "1. 提案メニューはまだありません。今回のトレーニング内容を前向きに評価してください。";
    }

    const userMessage = `
【本日の日付】${withWeekday(today)}
${profile ? `【ランナー】${profile.name}さん` : ""}
【目標】${goalSummary}

【今回記録したトレーニング】
${actualSummary}

${menuBlock}

上記をふまえ、今回のトレーニングについて短い「一言アドバイス」を返してください。
日付の解釈に注意し、「本日の日付」「今回記録したトレーニング」「提案メニューの対象期間」の前後関係を踏まえてコメントしてください。
特に次の2点を重視してください：
${compareInstruction}
2. 次回のトレーニングに向けた注意点（疲労・故障予防、ペース配分など）。

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
