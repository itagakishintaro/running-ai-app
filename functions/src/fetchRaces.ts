import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import { collectRaces } from "./races/pipeline";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

// マラソン大会データの月次収集バッチ。
// デプロイするとCloud Schedulerジョブが自動作成される。
// 初回実行や手動再実行は: gcloud scheduler jobs run <job> --location=asia-northeast1
export const fetchRaces = onSchedule(
  {
    schedule: "0 4 1 * *", // 毎月1日 4:00 JST
    timeZone: "Asia/Tokyo",
    region: "asia-northeast1",
    secrets: [anthropicApiKey],
    timeoutSeconds: 1740, // スケジュールトリガーの上限は1800秒
    memory: "512MiB",
    retryCount: 1,
  },
  async () => {
    await collectRaces(anthropicApiKey.value());
  }
);
