// マラソン大会データ収集の共通型定義

// LLM抽出の生出力（1ページ分）
export interface ExtractedRace {
  name: string;
  date: string | null;        // 開催日 YYYY-MM-DD（複数日開催は初日）
  prefecture: string;         // 「東京都」形式
  city: string;               // 市区町村。不明は ""
  types: string[];            // "full" | "half" | "10k" | "ultra" | "trail" | "relay" | "walk" | "other"
  entryStart: string | null;  // エントリー開始日
  entryEnd: string | null;    // エントリー締切日
  timeLimit: string | null;   // 制限時間（例: "6時間"）
  certified: boolean | null;  // 陸連公認かどうか
  url: string | null;         // 大会詳細ページURL
  distancesKm: number[] | null;  // 開催距離カテゴリ(km)。降順。距離不明はnull
  elevationGainM: number | null; // 累積標高D+(m)。掲載があるときのみ（最長距離カテゴリの値）
}

// Firestore races/{raceId} に保存するドキュメント
export interface RaceDoc extends ExtractedRace {
  nameNormalized: string;     // 重複排除キー（表記ゆれを正規化した大会名）
  sources: string[];          // このデータの出所（ソースid）
  updatedAt: FirebaseFirestore.FieldValue;
}

// 情報ソースのプラグインインターフェース。
// ソース追加は「このinterfaceを満たすモジュールを1つ書いてSOURCES配列に足す」だけ。
export interface RaceSource {
  id: string;
  // フィールドマージ時の優先度（大きいほど優先）
  fieldPriority: number;
  // 一覧ページの構造をLLMに伝える抽出プロンプトの補足
  extractionHint: string;
  // 取得対象URL。内側の配列は「順にfetchし、新規大会が出なくなったら打ち切る」グループ
  // （ページネーションのあるソースは1県分のページ列を1グループにする）
  urlGroups(): Promise<string[][]>;
}
