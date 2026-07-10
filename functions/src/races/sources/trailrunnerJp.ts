import { RaceSource } from "../types";

// トレイルランナー.JP: 月別のトレイルランニング大会一覧。1ページに全月分。
// エントリー期間・制限時間の掲載はない。D+はバーティカル系のみ掲載。
// 年表記がページ冒頭に一度しか出ずチャンク分割で失われるため、
// 実行時の日付を基準に年を補完させる。
const todayStr = new Date().toISOString().slice(0, 10);

export const trailrunnerJp: RaceSource = {
  id: "trailrunnerjp",
  fieldPriority: 25, // トレラン専門: 距離・D+・開催日の信頼性が高い。エントリー期間はsportsentry(30)に譲る
  extractionHint:
    `これはトレイルランナー.JPのトレイルランニング大会一覧です。「7月4日(土) 大会名 (岐阜)【22k･11k･3k】 HP」の形式で月別に並んでいます。` +
    `年の表記が見当たらない場合は、本日（${todayStr}）以降で最も近い該当月日の年としてください。` +
    `types には必ず "trail" を含めてください。` +
    `括弧内は開催都道府県です。「岐阜」→「岐阜県」のように正式名称にし、複数県（例: 大阪･奈良）は最初の県を採用してください。` +
    `【】内の距離（22k、約27k 等）を distancesKm に、「930mD+」のような累積標高表記があれば elevationGainM に入れてください。` +
    `大会名の後の「HP」直前にある (LINK:...) が公式サイトURLです。エントリー期間・制限時間は掲載がないので null にしてください。`,
  async urlGroups() {
    return [["https://trailrunner.jp/taikai.html"]];
  },
};
