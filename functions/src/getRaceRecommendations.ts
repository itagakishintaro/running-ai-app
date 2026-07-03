import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { nearbyPrefectures } from "./races/prefectures";

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

const TYPE_LABEL: Record<string, string> = {
  full: "フル",
  half: "ハーフ",
  "10k": "10km前後",
  ultra: "ウルトラ",
  trail: "トレイル",
  relay: "リレー/駅伝",
  walk: "ウォーク",
  other: "その他",
};

// プロンプトに載せる候補大会数の上限（多すぎると選定精度と速度が落ちる）
const MAX_CANDIDATES = 80;

export const getRaceRecommendations = onCall(
  {
    secrets: [anthropicApiKey],
    region: "asia-northeast1",
    timeoutSeconds: 120,
  },
  async (request) => {
    const { userId, mode, freeRequest, periodFrom, periodTo } = request.data as {
      userId: string;
      mode: "training" | "travel";
      freeRequest?: string;
      periodFrom?: string; // YYYY-MM。指定した月以降の大会に絞る
      periodTo?: string;   // YYYY-MM。指定した月末までの大会に絞る
    };
    if (!userId) throw new HttpsError("invalid-argument", "userId is required");
    if (mode !== "training" && mode !== "travel") {
      throw new HttpsError("invalid-argument", "mode must be 'training' or 'travel'");
    }
    const trimmedRequest = (freeRequest ?? "").trim().slice(0, 500);

    const monthRe = /^\d{4}-\d{2}$/;
    const validFrom = periodFrom && monthRe.test(periodFrom) ? periodFrom : null;
    const validTo = periodTo && monthRe.test(periodTo) ? periodTo : null;
    if (validFrom && validTo && validFrom > validTo) {
      throw new HttpsError("invalid-argument", "対象時期の開始月が終了月より後になっています");
    }

    const db = admin.firestore();

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
    const prefecture: string = profile.prefecture ?? "";
    const city: string = profile.city ?? "";

    if (mode === "training" && !prefecture) {
      throw new HttpsError(
        "failed-precondition",
        "近場の大会を探すには、プロフィールで居住地（都道府県）を登録してください"
      );
    }

    const today = new Date().toISOString().slice(0, 10);

    // 対象時期: 開始は「指定月の1日と本日の遅い方」、終了は指定月の末日（未指定なら制限なし）
    const rangeStart = validFrom && `${validFrom}-01` > today ? `${validFrom}-01` : today;
    let rangeEnd: string | null = null;
    if (validTo) {
      const [y, m] = validTo.split("-").map(Number);
      rangeEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // 月末日
    }

    // ---- 収集済みの大会DBから候補を絞り込む ----
    const racesSnap = await db
      .collection("races")
      .where("date", ">=", rangeStart)
      .orderBy("date", "asc")
      .limit(2000)
      .get();

    const targetPrefs = mode === "training" ? new Set(nearbyPrefectures(prefecture)) : null;

    const candidates = racesSnap.docs
      .map((d) => d.data())
      .filter((r) => {
        if (rangeEnd && r.date > rangeEnd) return false;
        if (targetPrefs && !targetPrefs.has(r.prefecture)) return false;
        // 締切が判明していて既に過ぎているものは除外（不明なものは残して要確認扱い）
        if (r.entryEnd && r.entryEnd < today) return false;
        return true;
      })
      .slice(0, MAX_CANDIDATES);

    const metaSnap = await db.doc("meta/racesCollection").get();
    const lastRunAt: Date | null = metaSnap.exists
      ? metaSnap.data()!.lastRunAt?.toDate() ?? null
      : null;

    if (candidates.length === 0) {
      throw new HttpsError(
        "failed-precondition",
        lastRunAt
          ? (validFrom || validTo
              ? "指定した時期に合う大会が見つかりませんでした。対象時期を広げてお試しください"
              : "条件に合う大会データが見つかりませんでした。旅RUNモードもお試しください")
          : "大会データがまだ収集されていません。しばらくしてからお試しください"
      );
    }

    const candidateLines = candidates
      .map((r) => {
        const types = (r.types ?? []).map((t: string) => TYPE_LABEL[t] ?? t).join("・");
        const entry =
          r.entryStart || r.entryEnd
            ? `エントリー期間: ${r.entryStart ?? "?"} 〜 ${r.entryEnd ?? "?"}`
            : "エントリー期間: 不明";
        const extras = [
          r.timeLimit ? `制限時間: ${r.timeLimit}` : "",
          r.certified === true ? "公認" : "",
          r.url ? `URL: ${r.url}` : "",
        ].filter(Boolean).join(" / ");
        return `- ${r.name} | ${r.date} | ${r.prefecture}${r.city ?? ""} | 種目: ${types || "不明"} | ${entry}${extras ? " / " + extras : ""}`;
      })
      .join("\n");

    // ---- ユーザー情報 ----
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
    const residence = prefecture ? `${prefecture}${city}` : "未登録";

    const modeInstruction =
      mode === "training"
        ? `【モード: トレーニング目的（近場）】
ユーザーの居住地は ${residence} です。候補は居住地の近隣（自県・隣接県）の大会に絞ってあります。
目的はトレーニングと実戦経験の獲得です。目標レースに向けた調整レース・ステップレースとして使えるかを重視してください。`
        : `【モード: 旅RUN（楽しみ目的）】
目的は旅として大会を楽しむことです。ユーザーの希望: ${trimmedRequest || "特になし"}
希望に合う地域・特色のある大会（ご当地グルメ・観光名所・温泉など）を優先してください。
各大会について、以下も提案してください（web検索はできないため、一般知識に基づく提案でよい。料金はあくまで目安と明記すること）:
- 宿泊: 大会会場へのアクセスが良いエリアと1泊の相場感。予約は楽天トラベル（https://travel.rakuten.co.jp/）やじゃらん（https://www.jalan.net/）での検索を案内する
- 移動手段: ${prefecture ? `${prefecture}発` : "出発地が未登録のため東京発を仮定し、その旨を明記すること"}。新幹線・飛行機・車などの目安時間・概算料金`;

    const userMessage = `
【ユーザー情報】
名前: ${profile.name}
年齢: ${age}歳
性別: ${genderLabel(profile.gender)}
居住地: ${residence}

【目標】
${goalLines}

${modeInstruction}

【対象時期】
${validFrom || validTo
  ? `ユーザーは ${validFrom ?? "現在"} 〜 ${validTo ?? "指定なし"} の時期の大会を希望しています。この場合は目標日との近さよりも指定時期内での適合を優先し、期間が複数月にわたるときは開催月が偏らないよう分散して提案してください（毎月レースに出たいというニーズにも応えられるように）。`
  : "時期の指定はありません。目標日から逆算して最適なタイミングの大会を提案してください。"}

【候補大会リスト（当アプリが収集した大会DBより。データ取得日: ${lastRunAt ? lastRunAt.toISOString().slice(0, 10) : "不明"}）】
${candidateLines}

上記の候補大会リストの中から、ユーザーに最適な大会を3件選んで提案してください。
`.trim();

    const system = `あなたは経験豊富なランニングコーチ兼、マラソン大会のコンシェルジュです。
提供された候補大会リストの中から、ユーザーの目標・走力・希望に最適な大会を3件選んで提案します。

必ず守るルール:
- 候補リストにある大会だけを提案すること。リストにない大会を作り出さないこと。
- 本日の日付は ${today} です。
- エントリー期間を重視すること:
  - 締切が近い（30日以内）大会は「⚠️ 締切間近」と明示すること。
  - エントリーがまだ開始前の大会は「エントリー開始日」を明示し、開始したらすぐ申し込むよう促すこと。
  - エントリー期間が不明な大会を選ぶ場合は「エントリー期間は公式サイトで要確認」と明記すること。
- ユーザーの目標日と開催日の整合を評価すること（目標レース本番に使えるか、調整レースとして使えるか）。
- ユーザーの現在のタイムに対して制限時間が現実的かを確認すること（制限時間不明なら要確認と書く）。
- 出力は日本語のMarkdown。大会ごとに見出し（##）を立て、以下を含めること:
  開催日 / 開催地 / 種目 / エントリー期間（残り日数も） / 制限時間 / おすすめ理由（現在タイム・目標タイム・目標日との整合） / URL（リストにあれば）
- 各大会の説明は要点を簡潔に。冗長な前置きやまとめは不要。
- 最後に「エントリー情報は変わることがあるため、申込前に必ず公式ページで最新情報をご確認ください」と添えること。`;

    const client = new Anthropic({ apiKey: anthropicApiKey.value(), timeout: 90_000 });

    const startedAt = Date.now();
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userMessage }],
    });

    console.log(
      `getRaceRecommendations: mode=${mode} candidates=${candidates.length} ` +
      `stop_reason=${response.stop_reason} elapsedSec=${Math.round((Date.now() - startedAt) / 1000)}`
    );

    const recommendation = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    if (!recommendation.trim()) {
      throw new HttpsError("internal", "大会情報の生成に失敗しました。時間をおいて再度お試しください。");
    }

    return { recommendation, mode };
  }
);
