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
  // 画像解析等で割り切れない秒数（例: 1867.9000...）が渡ると剰余演算に
  // 浮動小数点誤差が残るため、先に整数秒へ四捨五入してから分解する。
  totalSec = Math.round(totalSec);
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

export interface MonthlyStats {
  yearMonth: string;
  label: string;
  totalDistanceKm: number;
  count: number;
}

export interface WeeklyStats {
  weekKey: string;
  label: string;
  startDate: string;
  endDate: string;
  totalDistanceKm: number;
  count: number;
}

function getMondayOfWeek(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatJpDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}月${d.getDate()}日(${days[d.getDay()]})`;
}

export function groupByMonth(trainings: Training[]): MonthlyStats[] {
  const map = new Map<string, { total: number; count: number }>();
  for (const t of trainings) {
    if (!t.date) continue;
    const ym = t.date.slice(0, 7);
    const prev = map.get(ym) ?? { total: 0, count: 0 };
    map.set(ym, { total: prev.total + t.distanceKm, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, { total, count }]) => ({
      yearMonth: ym,
      label: `${ym.slice(0, 4)}年${parseInt(ym.slice(5, 7))}月`,
      totalDistanceKm: Math.round(total * 10) / 10,
      count,
    }));
}

export function groupByWeek(trainings: Training[]): WeeklyStats[] {
  const map = new Map<string, { start: Date; total: number; count: number }>();
  for (const t of trainings) {
    if (!t.date) continue;
    const monday = getMondayOfWeek(t.date);
    const key = toDateString(monday);
    const prev = map.get(key) ?? { start: monday, total: 0, count: 0 };
    map.set(key, { start: monday, total: prev.total + t.distanceKm, count: prev.count + 1 });
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, { start, total, count }]) => {
      const sunday = new Date(start);
      sunday.setDate(sunday.getDate() + 6);
      const endStr = toDateString(sunday);
      return {
        weekKey: key,
        label: `${formatJpDate(key)}〜${formatJpDate(endStr)}`,
        startDate: key,
        endDate: endStr,
        totalDistanceKm: Math.round(total * 10) / 10,
        count,
      };
    });
}
