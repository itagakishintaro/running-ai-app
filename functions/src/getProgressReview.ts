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

// 質トレ（強度の高いポイント練習）とみなす種別
const QUALITY_TYPES = new Set(["pace", "tempo", "interval", "buildup"]);

// YYYY-MM-DD の属する週（月曜始まり）の月曜日を返す
function weekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=日 .. 6=土
  const diff = day === 0 ? -6 : 1 - day; // 月曜まで戻す
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

interface Training {
  date: string;
  type: string;
  distanceKm?: number;
  durationSec?: number;
  avgPaceSecPerKm?: number;
  notes?: string;
}

interface WeekAgg {
  distanceKm: number;
  runCount: number;   // 休養以外
  restCount: number;
  qualityCount: number;
  qualityDistanceKm: number;
  qualityDurationSec: number;
}

export const getProgressReview = onCall(
  { secrets: [anthropicApiKey], region: "asia-northeast1" },
  async (request) => {
    const { userId, physicalCondition, motivation, freeNote } = request.data as {
      userId: string;
      physicalCondition?: string;
      motivation?: string;
      freeNote?: string;
    };
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");

    const db = admin.firestore();

    // プロフィールと目標を取得
    const [profileSnap, goalsSnap] = await Promise.all([
      db.doc(`users/${userId}/data/profile`).get(),
      db.collection(`users/${userId}/goals`).orderBy("targetDate", "asc").get(),
    ]);

    const goals = goalsSnap.docs.map((d) => d.data());

    if (!profileSnap.exists || goals.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        "プロフィールと目標を先に登録してください"
      );
    }

    const profile = profileSnap.data()!;

    const today = new Date().toISOString().slice(0, 10);

    // レビュー期間: 最も古い目標の設定時〜現在をベースに、最大52週（364日）で上限
    const oneYearAgo = new Date();
    oneYearAgo.setDate(oneYearAgo.getDate() - 364);
    const oneYearAgoStr = oneYearAgo.toISOString().slice(0, 10);

    const oldestGoalSetDate: string = goals.reduce((min: string, g) => {
      const d =
        g.updatedAt && typeof g.updatedAt.toDate === "function"
          ? g.updatedAt.toDate().toISOString().slice(0, 10)
          : oneYearAgoStr;
      return d < min ? d : min;
    }, oneYearAgoStr);

    // 文字列比較（YYYY-MM-DD は辞書順＝時系列順）で max を取る
    const windowStart = oldestGoalSetDate > oneYearAgoStr ? oldestGoalSetDate : oneYearAgoStr;

    const trainingsSnap = await db
      .collection(`users/${userId}/trainings`)
      .where("date", ">=", windowStart)
      .orderBy("date", "asc")
      .limit(400)
      .get();

    const trainings = trainingsSnap.docs.map((d) => d.data() as Training);

    // ---- 集計 ----
    let totalDistance = 0;
    let totalRuns = 0;
    let totalRest = 0;
    const typeCounts: Record<string, number> = {};
    const weeks = new Map<string, WeekAgg>();

    for (const t of trainings) {
      typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1;
      const ws = weekStart(t.date);
      const w = weeks.get(ws) ?? {
        distanceKm: 0,
        runCount: 0,
        restCount: 0,
        qualityCount: 0,
        qualityDistanceKm: 0,
        qualityDurationSec: 0,
      };

      if (t.type === "rest") {
        totalRest++;
        w.restCount++;
      } else {
        totalRuns++;
        const dist = t.distanceKm ?? 0;
        totalDistance += dist;
        w.distanceKm += dist;
        w.runCount++;
        if (QUALITY_TYPES.has(t.type)) {
          w.qualityCount++;
          w.qualityDistanceKm += dist;
          w.qualityDurationSec += t.durationSec ?? 0;
        }
      }
      weeks.set(ws, w);
    }

    // ---- 週次サマリ（各週1行）----
    const weeklySummary =
      weeks.size === 0
        ? "（対象期間にトレーニング記録がありません）"
        : Array.from(weeks.entries())
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([ws, w]) => {
              const dist = Math.round(w.distanceKm * 10) / 10;
              const qualityPace =
                w.qualityDistanceKm > 0
                  ? `/ 質トレ平均ペース ${formatTime(
                      Math.round(w.qualityDurationSec / w.qualityDistanceKm)
                    )}/km`
                  : "";
              return `${ws}週: ${dist}km / ${w.runCount}回（うち質${w.qualityCount}）${
                w.restCount > 0 ? ` / 休養${w.restCount}日` : ""
              } ${qualityPace}`.trim();
            })
            .join("\n");

    // ---- 全期間サマリ ----
    const typeBreakdown = Object.entries(typeCounts)
      .map(([type, count]) => `${typeLabel[type] ?? type} ${count}回`)
      .join(" / ");

    const overallSummary = [
      `総走行距離: ${Math.round(totalDistance * 10) / 10}km`,
      `総トレーニング回数: ${totalRuns}回（休養 ${totalRest}日）`,
      `種別内訳: ${typeBreakdown || "なし"}`,
    ].join("\n");

    // ---- 直近2週間の詳細 ----
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);
    const twoWeeksAgoStr = twoWeeksAgo.toISOString().slice(0, 10);

    const recent = trainings.filter((t) => t.date >= twoWeeksAgoStr);
    const recentDetail =
      recent.length === 0
        ? "（直近2週間の記録はありません）"
        : recent
            .map((t) => {
              const label = typeLabel[t.type] ?? t.type;
              if (t.type === "rest") return `${t.date}: 休養`;
              return `${t.date}: ${label} ${t.distanceKm}km / ${formatTime(
                t.durationSec ?? 0
              )} / ペース${formatTime(t.avgPaceSecPerKm ?? 0)}/km${
                t.notes ? ` / ${t.notes}` : ""
              }`;
            })
            .join("\n");

    // ---- 目標・期間情報 ----
    const daysElapsed = Math.ceil(
      (new Date(today).getTime() - new Date(windowStart).getTime()) / (1000 * 60 * 60 * 24)
    );

    const goalLines = goals
      .map((g) => {
        const marathonLabel = g.marathonType === "full" ? "フルマラソン(42.195km)" : "ハーフマラソン(21.0975km)";
        const daysUntilGoal = Math.ceil(
          (new Date(g.targetDate).getTime() - new Date(today).getTime()) / (1000 * 60 * 60 * 24)
        );
        return `- 種目: ${marathonLabel}\n  現在のタイム: ${formatTime(g.currentTimeSec)}\n  目標タイム: ${formatTime(g.targetTimeSec)}\n  目標日: ${g.targetDate}（本日から${daysUntilGoal}日後）`;
      })
      .join("\n");

    const age = profile.birthDate ? calcAge(profile.birthDate) : (profile.age ?? "不明");

    // ---- 主観情報 ----
    const subjectiveLines = [
      physicalCondition ? `体調・故障の有無: ${physicalCondition}` : "",
      motivation ? `モチベーション・手応え: ${motivation}` : "",
      freeNote ? `本人コメント: ${freeNote}` : "",
    ].filter(Boolean);
    const subjectiveSummary =
      subjectiveLines.length > 0 ? subjectiveLines.join("\n") : "（特に申告なし）";

    const userMessage = `
【ユーザー情報】
名前: ${profile.name}
年齢: ${age}歳
性別: ${genderLabel(profile.gender)}
身長: ${profile.heightCm}cm
体重: ${profile.weightKg}kg

【目標】
${goalLines}

【ふりかえり対象期間】
${windowStart} 〜 ${today}（約${daysElapsed}日間）

【全期間サマリ】
${overallSummary}

【週次推移】
${weeklySummary}

【直近2週間の詳細】
${recentDetail}

【本人からの主観報告】
${subjectiveSummary}

上記をもとに、目標達成に向けた進捗のふりかえりを行ってください。
`.trim();

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system:
        "あなたは経験豊富なプロのランニングコーチです。ユーザーのトレーニング実績・目標・主観報告を分析し、" +
        "目標達成に向けた進捗のふりかえりを行います。必ず以下の3つの見出し（Markdownの##）でこの順に出力してください。\n" +
        "## 進捗チェック\n目標タイムと目標日までの残り日数に対して、現在のトレーニング量・ペース・自己ベストが順調かどうかを、具体的な数値（必要な改善幅やペースの目安）を交えて評価する。\n" +
        "## ふりかえり\nこの期間にできていること（継続・成長している点）と、課題・気になる点を挙げる。本人の主観報告（体調・故障・モチベーション）も必ず踏まえる。\n" +
        "## 今後のアドバイス\n残り期間にどう取り組むべきか、方針を具体的に示す。故障や体調不良の申告があれば回復を優先するなど、主観報告を反映する。\n" +
        "科学的根拠に基づき、励ましつつも率直に。日本語で、読みやすいMarkdownで答えてください。",
      messages: [{ role: "user", content: userMessage }],
    });

    const review = response.content[0].type === "text" ? response.content[0].text : "";
    return { review };
  }
);
