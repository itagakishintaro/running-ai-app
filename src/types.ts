export type MarathonType = "full" | "half";
export type Gender = "male" | "female" | "other";
export type TrainingType = "run" | "rest" | "cross";

export interface UserProfile {
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  updatedAt: Date;
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
