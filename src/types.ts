export type MarathonType = "full" | "half";
export type Gender = "male" | "female" | "other";
export type TrainingType =
  | "jog"       // ジョグ（デフォルト）
  | "run"       // 汎用ランニング
  | "long"      // 距離走（LSD）
  | "pace"      // ペース走
  | "buildup"   // ビルドアップ走
  | "tempo"     // テンポ走（閾値走）
  | "interval"  // インターバルトレーニング
  | "cross"     // クロストレーニング
  | "rest";     // 休養

export const TRAINING_TYPE_OPTIONS: { value: TrainingType; label: string; emoji: string; isRest?: boolean }[] = [
  { value: "jog",      label: "ジョグ",                  emoji: "🐢" },
  { value: "long",     label: "距離走（LSD）",            emoji: "🏔" },
  { value: "pace",     label: "ペース走",                 emoji: "⏱" },
  { value: "buildup",  label: "ビルドアップ走",            emoji: "📈" },
  { value: "tempo",    label: "テンポ走（閾値走）",         emoji: "🔥" },
  { value: "interval", label: "インターバルトレーニング",    emoji: "⚡" },
  { value: "run",      label: "ランニング（その他）",        emoji: "🏃" },
  { value: "cross",    label: "クロストレーニング",         emoji: "🚴" },
  { value: "rest",     label: "休養",                     emoji: "😴", isRest: true },
];

export interface UserProfile {
  name: string;
  birthDate: string; // YYYY-MM-DD
  gender: Gender;
  heightCm: number;
  weightKg: number;
  updatedAt: Date;
}

export function calcAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const hasBirthdayPassed =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hasBirthdayPassed) age--;
  return age;
}

export interface Goal {
  marathonType: MarathonType;
  currentTimeSec: number;
  targetTimeSec: number;
  targetDate: string; // YYYY-MM-DD
  updatedAt: Date;
}

export interface Training {
  id?: string;
  date: string; // YYYY-MM-DD
  type: TrainingType;
  distanceKm: number;
  durationSec: number;
  avgPaceSecPerKm: number;
  notes: string;
  imageUrl?: string;
  createdAt: Date;
}

export function formatTime(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseTimeToSec(timeStr: string): number {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
