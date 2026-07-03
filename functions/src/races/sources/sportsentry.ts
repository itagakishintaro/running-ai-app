import { RaceSource } from "../types";
import { PREFECTURES } from "../prefectures";

// スポーツエントリー: keyword1のGET検索が機能し、一覧にエントリー期間が表示される。
// 「東京都」より「東京」の方がキーワードとしてヒットしやすいため接尾辞を除く。
const MAX_PAGES_PER_PREF = 5;

export const sportsentry: RaceSource = {
  id: "sportsentry",
  fieldPriority: 30, // エントリー期間の信頼性が高い
  extractionHint:
    "これはスポーツエントリーの大会検索結果一覧です。各大会に大会名・開催日・開催地（都道府県 市区町村）・エントリー期間が表示されています。" +
    "マラソン・ランニング系以外のイベント（自転車・トライアスロン・スイム等）は除外してください。",
  async urlGroups() {
    return PREFECTURES.map((pref) => {
      const keyword = `マラソン ${pref.replace(/[都府県]$/u, "")}`;
      const base = `https://www.sportsentry.ne.jp/events/search?keyword1=${encodeURIComponent(keyword)}&s_search=1`;
      return Array.from({ length: MAX_PAGES_PER_PREF }, (_, i) =>
        i === 0 ? base : `${base}&page=${i + 1}`
      );
    });
  },
};
