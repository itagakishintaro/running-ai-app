import * as admin from "firebase-admin";
import * as crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { ExtractedRace, RaceSource } from "./types";
import { PREFECTURES } from "./prefectures";
import { sportsentry } from "./sources/sportsentry";
import { runnetRuntes } from "./sources/runnetRuntes";
import { runnersBible } from "./sources/runnersBible";
import { trailrunnerJp } from "./sources/trailrunnerJp";

// ソース追加はモジュールを書いてこの配列に足すだけ
const SOURCES: RaceSource[] = [sportsentry, runnetRuntes, runnersBible, trailrunnerJp];

// 1ソース内で同時に処理するURLグループ数（取得先サイトへの負荷配慮）
const GROUP_CONCURRENCY = 3;
// 抽出に使うモデル。一覧の書き写し作業なので最安モデルで十分
const EXTRACTION_MODEL = "claude-haiku-4-5";
const MAX_PAGE_CHARS = 80_000;
// 1回のLLM呼び出しに渡すテキスト量。大きいページを分割しないと
// 出力JSONがmax_tokensを超えて途切れ、パース失敗で0件になる。
const CHUNK_CHARS = 12_000;

const USER_AGENT = "Mozilla/5.0 (compatible; running-ai-coach/1.0; personal use)";

interface SourceStats {
  pagesFetched: number;
  pagesFailed: number;
  racesExtracted: number;
}

export interface CollectionSummary {
  totalRaces: number;
  perSource: Record<string, SourceStats>;
  elapsedSec: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  return htmlToText(html, url).slice(0, MAX_PAGE_CHARS);
}

// HTMLをLLMに渡せるテキストへ変換する。
// aタグのhrefは「(LINK:URL)」として本文に残し、大会詳細URLの抽出を可能にする。
function htmlToText(html: string, baseUrl: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<a\b[^>]*?href="([^"#][^"]*)"[^>]*>/gi, (_m, href: string) => {
      try {
        return ` (LINK:${new URL(href, baseUrl).toString()}) `;
      } catch {
        return " ";
      }
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, " ");
  return s.replace(/[ \t　]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

function extractionPrompt(hint: string, pageText: string): string {
  return `以下はマラソン・トレイルランニング等のランニング大会一覧ページのテキストです。掲載されている大会をすべてJSON配列として抽出してください。

ソースに関する補足: ${hint}

各要素のスキーマ:
{
  "name": "大会名（回数表記含めそのまま）",
  "date": "開催日 YYYY-MM-DD（複数日開催は初日。年月日が読み取れなければnull）",
  "prefecture": "開催都道府県（「東京都」「大阪府」のような正式名称）",
  "city": "開催市区町村（不明なら空文字）",
  "types": ["full", "half", "10k", "ultra", "trail", "relay", "walk", "other" のうち該当するもの。大会名や距離表記から判断。不明なら ["other"]],
  "entryStart": "エントリー開始日 YYYY-MM-DD またはnull",
  "entryEnd": "エントリー締切日 YYYY-MM-DD またはnull",
  "timeLimit": "制限時間の記載（例: 6時間）またはnull",
  "certified": 公認大会の記載があればtrue、非公認と明記ならfalse、不明ならnull,
  "url": "大会名の近くにある (LINK:...) のURL。なければnull",
  "distancesKm": [開催距離カテゴリ（km単位の数値）の配列。例:【50k･32k･18k】→ [50, 32, 18]、「約27k」→ 27。距離が数値で明記されていなければnull（「フル」「ハーフ」からの換算は不要）],
  "elevationGainM": 累積標高（「D+」「累積標高」等）がm単位で明記されていれば数値（複数距離がある場合は最長距離のもの）。なければnull
}

ルール:
- テキストに書かれている情報だけを使うこと。書かれていない項目は推測せずnull（cityは空文字）にすること。
- 開催日が過去の大会もそのまま含めること（フィルタは後段で行う）。
- 広告・ナビゲーション・大会以外のイベント（自転車・トライアスロン等）は含めないこと。
- 出力はJSON配列のみ。前後に説明文を付けないこと。大会が1件もなければ [] を出力すること。

--- ページテキスト ---
${pageText}`;
}

function parseExtracted(raw: string): ExtractedRace[] {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];
  let items: unknown;
  try {
    items = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const results: ExtractedRace[] = [];
  for (const it of items) {
    if (typeof it !== "object" || it === null) continue;
    const o = it as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const asDate = (v: unknown) => (typeof v === "string" && dateRe.test(v) ? v : null);
    const distances = Array.isArray(o.distancesKm)
      ? o.distancesKm
          .filter((n): n is number => typeof n === "number" && isFinite(n) && n > 0 && n < 400)
          .map((n) => Math.round(n * 10) / 10)
          .sort((a, b) => b - a)
          .slice(0, 10)
      : [];
    results.push({
      name,
      date: asDate(o.date),
      prefecture: typeof o.prefecture === "string" && PREFECTURES.includes(o.prefecture) ? o.prefecture : "",
      city: typeof o.city === "string" ? o.city.trim() : "",
      types: Array.isArray(o.types) ? o.types.filter((t): t is string => typeof t === "string") : ["other"],
      entryStart: asDate(o.entryStart),
      entryEnd: asDate(o.entryEnd),
      timeLimit: typeof o.timeLimit === "string" && o.timeLimit ? o.timeLimit : null,
      certified: typeof o.certified === "boolean" ? o.certified : null,
      url: typeof o.url === "string" && o.url.startsWith("http") ? o.url : null,
      distancesKm: distances.length > 0 ? distances : null,
      elevationGainM:
        typeof o.elevationGainM === "number" && isFinite(o.elevationGainM) && o.elevationGainM > 0 && o.elevationGainM < 20000
          ? Math.round(o.elevationGainM)
          : null,
    });
  }
  return results;
}

// 大会名の表記ゆれを正規化して重複排除キーを作る
export function normalizeRaceName(name: string): string {
  return name
    .replace(/第\s*\d+\s*回(記念)?/g, "")
    .replace(/\d{4}年?/g, "")
    .replace(/[Vv]ol\.?\s*\d+/g, "")
    .replace(/[\s　、。・･~〜\-－—!！?？'"“”()（）\[\]【】<>《》「」]/g, "")
    .toLowerCase();
}

function raceId(nameNormalized: string, date: string): string {
  return crypto.createHash("sha1").update(`${nameNormalized}|${date}`).digest("hex");
}

// テキストを行単位でチャンクに分割する（大会1件の途中で切れにくいよう改行境界で切る）
function chunkText(text: string): string[] {
  if (text.length <= CHUNK_CHARS) return [text];
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (current.length + line.length + 1 > CHUNK_CHARS && current.length > 0) {
      chunks.push(current);
      current = "";
    }
    current += line + "\n";
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

async function extractFromText(
  client: Anthropic,
  source: RaceSource,
  text: string
): Promise<ExtractedRace[]> {
  const results: ExtractedRace[] = [];
  for (const chunk of chunkText(text)) {
    const response = await client.messages.create({
      model: EXTRACTION_MODEL,
      // スキーマにdistancesKm/elevationGainMを追加して1大会あたりの出力が伸びたため、
      // 大会密度の高いチャンクで途切れ→パース失敗0件にならないよう余裕を持たせる
      max_tokens: 16384,
      messages: [{ role: "user", content: extractionPrompt(source.extractionHint, chunk) }],
    });
    const raw = response.content[0]?.type === "text" ? response.content[0].text : "";
    results.push(...parseExtracted(raw));
  }
  return results;
}

// GCPのIPがWAFにブロックされるサイト（403）向けフォールバック:
// Anthropicのweb_fetchサーバーツールでAnthropic側インフラから取得させ、同じ呼び出しで抽出まで行う。
// Haiku＋basic版が使えればそれを使い、非対応なら Sonnet＋新版へ自動で切り替える。
let toolFetchMode: "haiku" | "sonnet" = "haiku";

async function extractViaFetchTool(
  client: Anthropic,
  source: RaceSource,
  url: string
): Promise<ExtractedRace[]> {
  const prompt = `まず web_fetch ツールで次のURLを取得してください: ${url}\n\n取得したページについて、以下の指示に従って大会を抽出してください。\n\n${extractionPrompt(source.extractionHint, "（ページ内容はweb_fetchの結果を参照）")}`;
  const attempt = async (model: string, toolType: string) => {
    const response = await client.messages.create({
      model,
      max_tokens: 16384,
      tools: [{ type: toolType, name: "web_fetch", max_uses: 2 } as unknown as Anthropic.Messages.ToolUnion],
      messages: [{ role: "user", content: prompt }],
    });
    const raw = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return parseExtracted(raw);
  };

  if (toolFetchMode === "haiku") {
    try {
      return await attempt(EXTRACTION_MODEL, "web_fetch_20250910");
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError) {
        console.log("web_fetch basic not available on haiku; switching to sonnet");
        toolFetchMode = "sonnet";
      } else {
        throw e;
      }
    }
  }
  return attempt("claude-sonnet-4-6", "web_fetch_20260209");
}

// ソースごとの直接fetch連続403回数。閾値を超えたら以降はツール経由に固定する
const direct403Count = new Map<string, number>();
const DIRECT_403_THRESHOLD = 3;

async function extractFromUrl(
  client: Anthropic,
  source: RaceSource,
  url: string
): Promise<ExtractedRace[]> {
  if ((direct403Count.get(source.id) ?? 0) < DIRECT_403_THRESHOLD) {
    try {
      const text = await fetchPageText(url);
      if (text.length < 200) return []; // 実質空ページ
      return await extractFromText(client, source, text);
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("HTTP 403")) {
        direct403Count.set(source.id, (direct403Count.get(source.id) ?? 0) + 1);
        // 403はツール経由で再試行（下へフォールスルー）
      } else {
        throw e;
      }
    }
  }
  return extractViaFetchTool(client, source, url);
}

// 単純な並列数制限つきワーカープール
async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item === undefined) break;
      await worker(item);
    }
  });
  await Promise.all(runners);
}

export async function collectRaces(apiKey: string): Promise<CollectionSummary> {
  const startedAt = Date.now();
  const client = new Anthropic({ apiKey, timeout: 120_000 });
  const db = admin.firestore();

  // key: nameNormalized|date → マージ済み大会
  const merged = new Map<string, { race: ExtractedRace; priority: number; sources: Set<string> }>();
  const perSource: Record<string, SourceStats> = {};

  await Promise.all(
    SOURCES.map(async (source) => {
      const stats: SourceStats = { pagesFetched: 0, pagesFailed: 0, racesExtracted: 0 };
      perSource[source.id] = stats;
      let groups: string[][];
      try {
        groups = await source.urlGroups();
      } catch (e) {
        console.error(`[${source.id}] urlGroups failed:`, e);
        return;
      }

      await runPool(groups, GROUP_CONCURRENCY, async (group) => {
        const seenInGroup = new Set<string>();
        for (const url of group) {
          try {
            const races = await extractFromUrl(client, source, url);
            stats.pagesFetched++;
            // ページネーション打ち切り: このページから新規大会が出なければ以降は同内容とみなす
            const newOnes = races.filter((r) => !seenInGroup.has(normalizeRaceName(r.name)));
            if (newOnes.length === 0) break;
            for (const race of races) {
              seenInGroup.add(normalizeRaceName(race.name));
              if (!race.date || !race.prefecture) continue; // 日付・県が特定できないものは保存しない
              stats.racesExtracted++;
              const key = `${normalizeRaceName(race.name)}|${race.date}`;
              const existing = merged.get(key);
              if (!existing) {
                merged.set(key, { race: { ...race }, priority: source.fieldPriority, sources: new Set([source.id]) });
              } else {
                existing.sources.add(source.id);
                // フィールド単位のマージ: 優先度の高いソースの非null値を採用し、欠けは低優先ソースで補完
                const base = existing.race;
                const incoming = race;
                const incomingWins = source.fieldPriority > existing.priority;
                const pick = <K extends keyof ExtractedRace>(k: K) => {
                  const a = incomingWins ? incoming[k] : base[k];
                  const b = incomingWins ? base[k] : incoming[k];
                  return (a !== null && a !== "" && !(Array.isArray(a) && a.length === 0)) ? a : b;
                };
                existing.race = {
                  name: incomingWins ? incoming.name : base.name,
                  date: base.date,
                  prefecture: pick("prefecture") as string,
                  city: pick("city") as string,
                  types: pick("types") as string[],
                  entryStart: pick("entryStart") as string | null,
                  entryEnd: pick("entryEnd") as string | null,
                  timeLimit: pick("timeLimit") as string | null,
                  certified: pick("certified") as boolean | null,
                  url: pick("url") as string | null,
                  distancesKm: pick("distancesKm") as number[] | null,
                  elevationGainM: pick("elevationGainM") as number | null,
                };
                existing.priority = Math.max(existing.priority, source.fieldPriority);
              }
            }
          } catch (e) {
            stats.pagesFailed++;
            console.error(`[${source.id}] page failed: ${url}`, e instanceof Error ? e.message : e);
          }
          await sleep(500); // 同一グループ内の連続アクセス間隔（取得先への配慮）
        }
      });
      console.log(`[${source.id}] done: pages=${stats.pagesFetched} failed=${stats.pagesFailed} races=${stats.racesExtracted}`);
    })
  );

  // Firestoreへupsert（500件ずつバッチ書き込み）
  const entries = Array.from(merged.entries());
  for (let i = 0; i < entries.length; i += 400) {
    const batch = db.batch();
    for (const [key, { race, sources }] of entries.slice(i, i + 400)) {
      const nameNormalized = key.split("|")[0];
      const ref = db.collection("races").doc(raceId(nameNormalized, race.date!));
      batch.set(ref, {
        ...race,
        nameNormalized,
        sources: Array.from(sources),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    await batch.commit();
  }

  // 開催日が30日以上過去の大会を削除
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const oldSnap = await db.collection("races").where("date", "<", cutoff).limit(400).get();
  if (!oldSnap.empty) {
    const batch = db.batch();
    oldSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  const summary: CollectionSummary = {
    totalRaces: merged.size,
    perSource,
    elapsedSec: Math.round((Date.now() - startedAt) / 1000),
  };

  // 収集メタ情報（レコメンド側で鮮度表示に使う）
  await db.doc("meta/racesCollection").set({
    lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
    ...summary,
  });

  console.log(`collectRaces done: total=${summary.totalRaces} elapsedSec=${summary.elapsedSec}`, JSON.stringify(perSource));
  return summary;
}
