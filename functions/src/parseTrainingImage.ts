import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import Anthropic from "@anthropic-ai/sdk";

const anthropicApiKey = defineSecret("ANTHROPIC_API_KEY");

interface ParseRequest {
  imageBase64: string;
  mimeType: string;
}

interface ParseResult {
  distanceKm?: number;
  durationSec?: number;
  avgPaceSecPerKm?: number;
  elevationGainM?: number;
  notes?: string;
}

function parseTimeToSec(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

export const parseTrainingImage = onCall(
  { secrets: [anthropicApiKey], region: "asia-northeast1" },
  async (request) => {
    const { imageBase64, mimeType } = request.data as ParseRequest;
    if (!imageBase64) throw new HttpsError("invalid-argument", "imageBase64 is required");

    const validMimeTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!validMimeTypes.includes(mimeType)) {
      throw new HttpsError("invalid-argument", "Unsupported image type");
    }

    const client = new Anthropic({ apiKey: anthropicApiKey.value() });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `このランニングウォッチ・アプリのスクリーンショットから走行データを読み取り、以下のJSON形式で返してください。
読み取れない項目はnullにしてください。タイムはHH:MM:SS または MM:SS形式で返してください。

{
  "distanceKm": 数値（km）,
  "duration": "HH:MM:SS または MM:SS",
  "avgPace": "MM:SS（1kmあたりのペース）",
  "elevationGainM": 数値（累積標高・獲得標高・上昇量・Total Ascent などの表示があればm単位。なければnull）,
  "notes": "その他の特記事項（心拍数など）"
}

JSONのみを返してください。説明文は不要です。`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text.trim() : "{}";
    let parsed: { distanceKm?: number; duration?: string; avgPace?: string; elevationGainM?: number; notes?: string } = {};

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch {
      // 解析失敗時は空オブジェクトを返す
    }

    const result: ParseResult = {
      distanceKm: parsed.distanceKm ?? undefined,
      durationSec: parsed.duration ? parseTimeToSec(parsed.duration) : undefined,
      avgPaceSecPerKm: parsed.avgPace ? parseTimeToSec(parsed.avgPace) : undefined,
      elevationGainM: typeof parsed.elevationGainM === "number" ? parsed.elevationGainM : undefined,
      notes: parsed.notes ?? undefined,
    };

    return result;
  }
);
