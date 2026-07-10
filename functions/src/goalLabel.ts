// 目標（マラソン/トレラン）をAIプロンプト用テキストに整形する共有ヘルパー。
// goalTypeのない既存ドキュメントはマラソン扱い。

export interface GoalDoc {
  goalType?: string;
  marathonType?: string | null;
  currentTimeSec?: number | null;
  targetTimeSec?: number | null;
  targetDate: string;
  raceName?: string | null;
  distanceKm?: number | null;
  elevationGainM?: number | null;
  trailTargetType?: string | null;
}

function formatTime(totalSec: number): string {
  totalSec = Math.round(totalSec);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 種目・現在/目標タイムを「- 種目: ...\n  ...」形式の複数行で返す（目標日は呼び出し側で付ける）
export function describeGoal(g: GoalDoc): string {
  if (g.goalType === "trail") {
    const race = g.raceName ? `「${g.raceName}」` : "";
    // 累積標高100m ≒ 平地1km の換算で練習負荷の目安を伝える
    const flatEquivalent =
      g.distanceKm && g.elevationGainM
        ? `（平地換算 約${Math.round(g.distanceKm + g.elevationGainM / 100)}km相当）`
        : "";
    const course = [
      g.distanceKm ? `${g.distanceKm}km` : "距離不明",
      g.elevationGainM ? `累積標高${g.elevationGainM}m` : "累積標高不明",
    ].join(" / ");
    const target =
      g.trailTargetType === "time" && g.targetTimeSec
        ? `目標タイム ${formatTime(g.targetTimeSec)}`
        : "完走（関門内）";
    return `種目: トレイルラン${race} ${course}${flatEquivalent}\n  目標: ${target}`;
  }
  const marathonLabel =
    g.marathonType === "full" ? "フルマラソン(42.195km)" : "ハーフマラソン(21.0975km)";
  return `種目: ${marathonLabel}\n  現在のタイム: ${formatTime(g.currentTimeSec ?? 0)}\n  目標タイム: ${formatTime(g.targetTimeSec ?? 0)}`;
}
