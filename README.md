# Running AI Coach

ランニング目標の達成をAIがサポートするWebアプリ。フルマラソン・ハーフマラソンに対応し、ユーザーのプロフィール・目標・トレーニング履歴をもとにClaude APIがパーソナライズされたトレーニングメニューを提案します。

## 主な機能

- Google アカウントでログイン
- プロフィール登録（年齢・性別・身長・体重）
- 目標設定（種目・現在のタイム・目標タイム・目標時期）
- トレーニングログ記録（テキスト入力 or ランニングウォッチ画像から自動入力）
- AIによる週次トレーニングメニュー提案

---

## システムアーキテクチャ

```
Firebase Hosting
  └─ React + Vite (SPA)
        │
        ├─ Firebase Auth (Google Sign-in)
        ├─ Firestore (ユーザーデータ永続化)
        └─ Firebase Functions (asia-northeast1)
              ├─ getTrainingAdvice  ── Firestoreからデータ取得 → Claude API
              └─ parseTrainingImage ── 画像 → Claude Vision → 走行データJSON
```

### 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | React 19 + Vite + TypeScript + Tailwind CSS |
| バックエンド | Firebase Functions (Node.js 20) |
| AI | Claude API (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| DB | Firestore |
| 認証 | Firebase Auth (Google Sign-in) |
| ホスティング | Firebase Hosting |

### Firestoreデータモデル

```
users/{userId}/
  data/profile  : { name, age, gender, heightCm, weightKg, updatedAt }
  data/goal     : { marathonType, currentTimeSec, targetTimeSec, targetDate, updatedAt }
  trainings/{id}: { date, type, distanceKm, durationSec, avgPaceSecPerKm, notes, createdAt }
```

---

## 開発環境のセットアップ

### 前提条件

- Node.js 20+
- Firebase CLI (`npm install -g firebase-tools`)
- Firebase プロジェクト: `running-ai-app-7e5ec`
- Anthropic APIキーが Firebase Secret Manager に登録済み

### インストール

```bash
# フロントエンド依存関係
npm install

# Firebase Functions 依存関係
npm install --prefix functions
```

### ローカル開発

```bash
# フロントエンド開発サーバー（http://localhost:5173）
npm run dev
```

> Firestoreや認証はデプロイ済みの本番Firebaseプロジェクトに接続されます。  
> エミュレーターを使う場合は `firebase emulators:start` を別ターミナルで起動し、`src/firebase.ts` でエミュレーター接続設定を有効にしてください。

### ビルド確認

```bash
# フロントエンドのビルド（dist/ に出力）
npm run build

# Functions の TypeScript コンパイル確認（lib/ に出力）
npm run build --prefix functions
# または
cd functions && node_modules/.bin/tsc
```

---

## デプロイ手順

### 初回のみ: Claude APIキーの登録

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
# プロンプトに Anthropic API キー（sk-ant-...）を入力
```

### 通常デプロイ（全リソース一括）

```bash
# フロントエンドをビルドしてからデプロイ
npm run build
firebase deploy
```

### 個別デプロイ

```bash
# Hostingのみ
npm run build
firebase deploy --only hosting

# Functionsのみ
firebase deploy --only functions

# Firestoreルールのみ
firebase deploy --only firestore:rules
```

---

## Claude API の使い方

Claude API は **Firebase Functions 側でのみ呼び出します**。フロントエンドからは直接呼ばず、APIキーは Firebase Secret Manager に保存することで漏洩を防いでいます。

### SDK のセットアップ（`functions/src/*.ts` 共通）

```ts
import Anthropic from "@anthropic-ai/sdk";
import { defineSecret } from "firebase-functions/params";

// Secret Manager からAPIキーを参照（コード内にキーを書かない）
const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

const client = new Anthropic({ apiKey: anthropicApiKey.value() });
```

---

### 1. トレーニングメニュー生成 — `functions/src/getTrainingAdvice.ts`

フロントの「AIにメニューを提案してもらう」ボタンから呼ばれる Function です。

**処理の流れ:**

```
フロント → Firebase Function
  ↓ Firestoreからユーザーデータを取得
    ・プロフィール（年齢・性別・身長・体重）
    ・目標（種目・現在タイム・目標タイム・目標日）
    ・直近30日のトレーニング履歴
  ↓ 取得したデータをプロンプトに埋め込み
  ↓ Claude API (claude-sonnet-4-6) に送信
  ↓ 週次トレーニングメニュー（Markdown）を返却
```

**Claude API の呼び出し:**

```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 2048,
  system: "あなたは経験豊富なプロのランニングコーチです...",
  messages: [
    {
      role: "user",
      content: `
【ユーザー情報】年齢・性別・身長・体重...
【目標】種目・現在タイム・目標タイム・残り日数...
【直近30日のトレーニング履歴】日付・距離・ペース...

今週（7日間）の具体的なトレーニングメニューを提案してください。
      `,
    },
  ],
});
```

**ポイント:** Firestoreから取得したユーザー固有のデータをプロンプトに含めることで、CLAUDEアプリでは実現できないパーソナライズされたアドバイスを生成します。

---

### 2. ランニングウォッチ画像の解析 — `functions/src/parseTrainingImage.ts`

トレーニングログの追加フォームで画像をアップロードしたときに呼ばれる Function です。Claude の Vision 機能を使います。

**処理の流れ:**

```
フロント（画像選択）→ Firebase Function
  ↓ 画像を base64 エンコードして送信
  ↓ Claude API に画像 + テキスト指示を送信（Vision）
  ↓ 距離・タイム・ペース等をJSON形式で返却
  ↓ フロントのフォームに自動入力
```

**Claude API の呼び出し（画像 + テキストのマルチモーダル）:**

```ts
const response = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 512,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",           // 画像をbase64で渡す
          source: {
            type: "base64",
            media_type: "image/jpeg",
            data: imageBase64,
          },
        },
        {
          type: "text",            // 構造化して返すよう指示
          text: `走行データをJSON形式で返してください:
{ "distanceKm": 数値, "duration": "HH:MM:SS", "avgPace": "MM:SS", "notes": "..." }`,
        },
      ],
    },
  ],
});
// レスポンスのJSONをパースしてフォームに反映
```

**ポイント:** テキストと画像を同時に送れるマルチモーダル機能を使い、ランニングウォッチのスクリーンショットから数値データを自動抽出します。返答はJSON形式に限定しているため、フロント側でそのままパースできます。

---

## プロジェクト構成

```
run/
├── src/                        # フロントエンド (React + Vite)
│   ├── firebase.ts             # Firebase 初期化
│   ├── types.ts                # 型定義・ユーティリティ関数
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useProfile.ts
│   │   ├── useGoal.ts
│   │   └── useTrainings.ts
│   ├── components/
│   │   └── Layout.tsx          # 共通レイアウト・ナビゲーション
│   └── pages/
│       ├── Login.tsx
│       ├── Dashboard.tsx
│       ├── Profile.tsx
│       ├── Goal.tsx
│       ├── TrainingLog.tsx
│       └── Advice.tsx
├── functions/src/              # Firebase Functions
│   ├── index.ts
│   ├── getTrainingAdvice.ts    # Firestore取得 + Claude API でメニュー生成
│   └── parseTrainingImage.ts  # Claude Vision で画像から走行データを抽出
├── firebase.json
├── firestore.rules             # Firestoreセキュリティルール
└── .firebaserc
```
