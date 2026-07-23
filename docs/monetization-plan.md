# マネタイズ計画（保留中・将来実装）

> 状態: **保留**（2026-07-06時点。検討済み・未実装）
> 目的: 儲けることではなく、友人に使ってもらってもAPI課金が怖くない状態を作る（API実費の回収）。

## 検討の経緯と結論

- **広告（AdSense）を今のアプリにそのまま入れるのは不成立**: 全ページがログインの内側にありクローラーがコンテンツを読めないため審査に通りにくい。また収益はPV比例で、友人数人の利用では月数十円にしかならない。
- **匿名認証でログインレスにしても解決しない**: コンテンツが個人ごとに違う点は変わらず、機種変更でデータが消えるデメリットのみ。
- **採用した方向性（2本立て）**:
  1. **月次クォータ** — ユーザーごとに月のAI利用回数上限を設け、最悪ケースの請求額を「上限×単価×人数」で確定させる。即効性のある根本対策。
  2. **公開大会一覧ページ** — 毎月自動収集している大会DB（約705件）をログイン不要の公開ページとして出し、検索流入とAdSense審査の土台を作る。広告掲載はページのインデックス後にAdSense申請してから（第2段）。
- 見送った案: Stripe自動課金（手数料・特商法表記・解約導線のコストが友人規模に見合わない）、BYOK（友人全員のAnthropicアカウント作成はハードルが高い）、招待制＋手動集金（必要になったら決済実装ゼロで併用可能）。

## 現状のAPI単価目安（1回あたり）

| 機能 | モデル | 概算 |
|---|---|---|
| メニュー提案 / ふりかえり | Sonnet 4.6 | 約¥6 |
| 大会レコメンド | Sonnet 4.6（入力8千トークン級） | 約¥15 |
| 記録フィードバック | Sonnet 4.6 | 約¥3 |
| 画像取込 | Haiku 4.5 | 約¥1 |
| 大会データ収集バッチ（固定費） | Haiku 4.5・月1回 | 約¥300〜500/月 |

アクティブユーザー1人あたり月¥100〜300程度。友人5〜10人で固定費込み月¥1,000〜3,000程度が現実ライン。

---

## Part 1: 月次クォータ

### 新規 `functions/src/quota.ts`

```ts
export const QUOTA_LIMITS = {
  advice: 20,      // getTrainingAdvice
  feedback: 40,    // getTrainingFeedback
  review: 10,      // getProgressReview
  races: 10,       // getRaceRecommendations
  imageParse: 60,  // parseTrainingImage
} as const;
export type QuotaFeature = keyof typeof QUOTA_LIMITS;
export async function consumeQuota(uid: string, feature: QuotaFeature): Promise<void>
```

- 最悪ケース: 20×6 + 40×3 + 10×6 + 10×15 + 60×1 ≈ **¥510/人/月**（定数で調整可能）
- 月キーは **JST** で算出（`new Date(Date.now() + 9*3600*1000).toISOString().slice(0,7)`）
- `consumeQuota` は Firestore トランザクションで `users/{uid}/usage/{YYYY-MM}` の `counts.{feature}` をインクリメント。ドキュメントには `limits`（QUOTA_LIMITSのスナップショット。フロント表示用）と `updatedAt` も書く
- 上限超過時: `HttpsError("resource-exhausted", "今月の◯◯の利用上限（N回）に達しました。毎月1日にリセットされます")`
- **除外リスト**: `meta/quotaExempt` ドキュメント `{ uids: string[] }` に載っているuidはスキップ（Firestoreコンソールで管理。初回にオーナー自身のuidを登録する）

### 各Functionへの組み込み（5ファイル）

Anthropic呼び出しの直前（入力検証・前提チェックの後）に `await consumeQuota(uid, "...")` を挿入:
`getTrainingAdvice.ts` / `getTrainingFeedback.ts` / `getProgressReview.ts` / `getRaceRecommendations.ts` / `parseTrainingImage.ts`

**併せて認証チェックを追加**（クォータの実効性に必須）:

- 現状、各onCallは `request.data.userId` を無検証で信用しており、他人のuidを渡せばクォータも他人のデータも使えてしまう
- 全onCall関数の冒頭に `if (!request.auth) throw unauthenticated` と `request.auth.uid !== userId → permission-denied` を追加。クォータは必ず `request.auth.uid` に対して消費する
- `parseTrainingImage` は現状userIdを受け取っていない → `request.auth.uid` をそのまま使う（フロント変更不要）

### `firestore.rules` の再構成

現在の `users/{userId}/{document=**}` ワイルドカードのままでは、クライアントが自分のusageカウンタを書き換え（リセット）できてしまう。クライアント使用パスは `data`・`goals`・`trainings` のみと確認済み（2026-07時点のgrep結果）なので、明示的に分割:

```
match /users/{userId}/data/{docId}       → owner read/write
match /users/{userId}/goals/{goalId}     → owner read/write
match /users/{userId}/trainings/{tid}    → owner read/write
match /users/{userId}/usage/{month}      → owner read のみ（write: if false）
```

※ 実装時はクライアントのFirestoreパス使用箇所を再grepして差分がないか確認すること。

### フロントエンド

- `src/pages/Settings.tsx` に「今月のAI利用状況」セクション: `users/{uid}/usage/{当月}` を読み、機能ごとに `count / limit` をプログレスバー表示（limitsはusage doc内のスナップショットを使用。docが無い月は「まだ利用なし」）
- AI呼び出し4ページ（`Advice.tsx` / `Review.tsx` / `Races.tsx` / `TrainingLog.tsx`）のcatchで、`(e as FirebaseError).code === "functions/resource-exhausted"` の場合はサーバーのメッセージをそのまま表示（`Races.tsx` の「居住地」分岐と同じパターン）

---

## Part 2: 公開大会一覧ページ（SSR Function）

SPAに組み込むとログイン境界とSEO（AdSense審査クローラー）の両方で不利なので、**HTTP FunctionがプレーンなHTMLを返すSSR方式**にする。データはadmin SDKで読むため `races` コレクションの公開ルール変更は不要。

### 新規 `functions/src/racesPublic.ts`（onRequest / asia-northeast1）

ルーティング（1関数内でパス分岐）:

- `/taikai` — トップ: 直近3ヶ月のピックアップ + 都道府県リンク47件 + 月別リンク
- `/taikai/p/{romaji}` — 都道府県別一覧（例 `/taikai/p/tokyo`。`races/prefectures.ts` に romajiスラッグ対応表を追加）
- `/taikai/m/{yyyy-mm}` — 月別一覧
- `/taikai/sitemap.xml` — 全ページのURL一覧を動的生成

実装ポイント:

- Firestoreから `date >= today` を `orderBy date` で最大2000件読み、コード内でフィルタ（現状全件約705件なので1クエリで足りる）
- HTMLはテンプレートリテラル + 最小限のインラインCSS（Tailwind不使用）。テーブルで 日付・大会名（公式URLへリンク）・開催地・種目・エントリー期間・制限時間 を表示
- SEO: ページ別 `<title>` / `<meta name="description">` / canonical / viewport。フッターに「エントリー情報は変わるため公式サイトで要確認」+ アプリ（https://running-ai-app-7e5ec.web.app/）への導線
- **`Cache-Control: public, max-age=3600, s-maxage=86400`** を付け、Hosting CDNにキャッシュさせる → 公開トラフィックが増えてもFunctions起動・Firestore読み取りがほぼ増えない（広告で回収する前にコストが増えては本末転倒なので重要）

### `firebase.json`

- rewrites の **`**` キャッチオールより前に** `{"source": "/taikai", "function": {...}}` と `{"source": "/taikai/**", "function": {...}}` を追加（v2 function・region指定）
- リスク: Hosting→v2 Functionsのrewriteがregion指定で弾かれた場合は `racesPublic` のみ `us-central1` にデプロイして回避（データはFirestore経由なので支障なし）

### その他

- `public/robots.txt` 新規: 全許可 + `Sitemap: https://running-ai-app-7e5ec.web.app/taikai/sitemap.xml`
- `functions/src/index.ts` に `export { racesPublic }` 追加
- `Login.tsx` のフッターと `Settings.tsx` に公開ページ `/taikai` へのリンクを追加（ログイン不要で見られる導線）

---

## 第2段（さらに後・ユーザー本人の作業を含む）

- Google AdSense申請は本人のアカウントで行う（住所・支払い情報が必要）。ページがGoogleにインデックスされてから申請するのが通りやすい
- Search Consoleへのsitemap登録
- 承認後: `public/ads.txt` 設置、taikaiページへの広告タグ差し込み
- 広告で足りない分の短期回収が必要になったら: 招待制（許可リスト）＋PayPay等での手動集金を追加（決済実装不要）

## 変更ファイル一覧

| 種別 | ファイル | 内容 |
|---|---|---|
| 新規 | `functions/src/quota.ts` | QUOTA_LIMITS / consumeQuota（トランザクション+除外リスト） |
| 変更 | `functions/src/getTrainingAdvice.ts` ほかAI関数4つ | 認証チェック + consumeQuota挿入 |
| 変更 | `firestore.rules` | ワイルドカード分割、usageはread専用 |
| 変更 | `src/pages/Settings.tsx` | 利用状況表示 + 公開ページリンク |
| 変更 | `src/pages/Advice.tsx` / `Review.tsx` / `Races.tsx` / `TrainingLog.tsx` | resource-exhaustedエラー表示 |
| 新規 | `functions/src/racesPublic.ts` | 公開大会一覧SSR + sitemap |
| 変更 | `functions/src/races/prefectures.ts` | romajiスラッグ対応表 |
| 変更 | `functions/src/index.ts` | racesPublic再エクスポート |
| 変更 | `firebase.json` | /taikai rewrite追加（キャッチオールより前） |
| 新規 | `public/robots.txt` | sitemap案内 |
| 変更 | `src/pages/Login.tsx` | 公開ページへの導線 |

## 検証手順

1. `cd functions && node_modules/.bin/tsc` → `npx firebase-tools@latest deploy --only functions,firestore:rules`、フロントは `npm run build` → hosting deploy
2. **クォータ**: `meta/quotaExempt` にオーナーuidを登録 → AI機能を実行し `users/{uid}/usage/{当月}` が作られない（除外が効く）ことを確認 → 除外を外して1回実行しカウント=1を確認 → usage docのcountを上限値に手動セットし、再実行で「上限に達しました」表示を確認 → 元に戻す
3. **ルール**: クライアントからusage docへの書き込みがpermission-deniedになること
4. **公開ページ**: 未ログイン（シークレットウィンドウ）で `/taikai`・都道府県ページ・月別ページ・`sitemap.xml` が表示されること、レスポンスヘッダにCache-Controlが付くこと
