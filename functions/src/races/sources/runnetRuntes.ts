import { RaceSource } from "../types";

// RUNNETのメルマガ用「RUNTES大会予定一覧」。地域別の静的HTMLページ。
// 地域スラッグはページ内リンクから動的に発見する（関東ページを起点にする）。
const SEED_URL = "https://runnet.jp/smp/mailmagazine/runtes/kantou.html";

async function discoverRegionUrls(): Promise<string[]> {
  const res = await fetch(SEED_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; running-ai-coach/1.0; personal use)" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return [SEED_URL];
  const html = await res.text();
  const found = new Set<string>([SEED_URL]);
  const re = /href="([^"]*?runtes\/([a-z_\-]+)\.html)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const abs = href.startsWith("http")
      ? href
      : new URL(href, SEED_URL).toString();
    found.add(abs);
  }
  return Array.from(found).slice(0, 10);
}

export const runnetRuntes: RaceSource = {
  id: "runnet",
  fieldPriority: 10,
  extractionHint:
    "これはRUNNETの大会予定一覧（RUNTES）です。各大会に大会名・開催日・開催地（都道府県・市区町村）・コース特徴などが表示されています。" +
    "エントリー期間は書かれていないことが多いので、その場合はnullにしてください。",
  async urlGroups() {
    const urls = await discoverRegionUrls();
    // 各地域ページは1ページ完結なので、1URL=1グループ
    return urls.map((u) => [u]);
  },
};
