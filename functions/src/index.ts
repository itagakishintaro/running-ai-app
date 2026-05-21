import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export { getTrainingAdvice } from "./getTrainingAdvice";
export { parseTrainingImage } from "./parseTrainingImage";

// ヘルスチェック用
export const ping = functions.onCall(() => ({ status: "ok" }));
