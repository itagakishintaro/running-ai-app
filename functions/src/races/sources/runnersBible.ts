import { RaceSource } from "../types";

// ランナーズバイブル: フルマラソン中心の大会DB。
// 月別に分かれておらず、1ページ（Marathon.html）に全月分が載っている。
// ページが大きいためパイプライン側のチャンク分割抽出が前提。
export const runnersBible: RaceSource = {
  id: "runnersbible",
  fieldPriority: 20, // 制限時間・公認有無・エントリー期間が整理されている
  extractionHint:
    "これはランナーズバイブルのマラソン大会一覧です。各大会に開催日（例: 2026.1.4）・エントリー期間・大会名・開催地・制限時間・公認有無が表形式で載っています。" +
    "日付は「2026.1.4」形式なのでYYYY-MM-DDに変換してください。「公認」の記載がある大会は certified を true にしてください。",
  async urlGroups() {
    return [["https://www.runnersbible.info/DB/Marathon.html"]];
  },
};
