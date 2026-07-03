import * as functions from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

export { getTrainingAdvice } from "./getTrainingAdvice";
export { getProgressReview } from "./getProgressReview";
export { getTrainingFeedback } from "./getTrainingFeedback";
export { parseTrainingImage } from "./parseTrainingImage";
export { getRaceRecommendations } from "./getRaceRecommendations";
export { fetchRaces } from "./fetchRaces";

// ヘルスチェック用
export const ping = functions.onCall(() => ({ status: "ok" }));
