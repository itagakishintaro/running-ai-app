# Running AI Coach

ランニングトレーニング支援AIアプリ。Firestoreに保存したユーザーデータをClaude APIが参照し、パーソナライズされたトレーニングメニューを提案する。

## アカウント

- GitHub: 個人アカウント `itagakishintaro` / SSH経由 (`git@github.com-personal:itagakishintaro/running-ai-app.git`)
- Firebase プロジェクトID: `running-ai-app-7e5ec`
- 利用アカウント: `itagaki.shintaro@gmail.com`

## 主要コマンド

```bash
# 開発サーバー起動
npm run dev

# フロントエンドビルド
npm run build

# デプロイ（ビルド後に実行）
firebase deploy

# Functionsのみデプロイ
firebase deploy --only functions

# Claude APIキーの登録（初回のみ）
firebase functions:secrets:set ANTHROPIC_API_KEY
```

## 技術スタック

- フロントエンド: React + Vite + TypeScript + Tailwind CSS
- バックエンド: Firebase Functions (Node.js 20) + `@anthropic-ai/sdk`
- DB: Firestore / 認証: Firebase Auth (Google) / ホスティング: Firebase Hosting
- Claudeモデル: `claude-sonnet-4-6`

## 重要な注意点

- **APIキーはコードに書かない**: `ANTHROPIC_API_KEY` は Firebase Secret Manager に保管
- **Claude APIはFunctions経由のみ**: フロントから直接呼ばない
- **git push は個人SSH鍵を使用**: `github.com-personal` ホストエイリアス経由
- Functions の predeploy は `cd functions && node_modules/.bin/tsc`（npm v11バグ回避）

## ファイル構成

```
src/                  # フロントエンド
  firebase.ts         # Firebase初期化
  types.ts            # 型定義
  hooks/              # useAuth / useProfile / useGoal / useTrainings
  pages/              # Login / Dashboard / Profile / Goal / TrainingLog / Advice
functions/src/        # Firebase Functions
  getTrainingAdvice.ts   # Firestoreデータ取得 → Claude API → メニュー生成
  parseTrainingImage.ts  # Claude Vision → 走行データJSON抽出
```
