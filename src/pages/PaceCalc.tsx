import { useState } from "react";
import { Timer } from "lucide-react";
import { MarathonType, formatTime, parseTimeToSec } from "../types";
import { Card, Field, Input, cn } from "../components/ui";

const DISTANCE_KM: Record<MarathonType, number> = {
  full: 42.195,
  half: 21.0975,
};

type PaceUnit = "perKm" | "kmh";

const segClass = (selected: boolean) =>
  cn(
    "flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border text-sm font-medium transition-colors",
    selected
      ? "bg-primary-600 text-white border-primary-600"
      : "bg-white text-gray-700 border-gray-300 hover:border-primary-400"
  );

export function PaceCalc() {
  const [marathonType, setMarathonType] = useState<MarathonType>("full");
  const [timeStr, setTimeStr] = useState("");
  const [unit, setUnit] = useState<PaceUnit>("perKm");

  const totalSec = parseTimeToSec(timeStr);
  const distanceKm = DISTANCE_KM[marathonType];
  const valid = totalSec > 0;

  const paceSecPerKm = valid ? totalSec / distanceKm : 0;
  const speedKmh = valid ? (distanceKm / totalSec) * 3600 : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <Timer className="w-5 h-5 text-primary-600" />
        ペース計算
      </h2>

      <Card className="space-y-4">
        <Field label="種目">
          <div className="flex gap-2">
            <button
              type="button"
              className={segClass(marathonType === "full")}
              onClick={() => setMarathonType("full")}
            >
              フルマラソン
            </button>
            <button
              type="button"
              className={segClass(marathonType === "half")}
              onClick={() => setMarathonType("half")}
            >
              ハーフマラソン
            </button>
          </div>
        </Field>

        <Field
          label="目標タイム"
          hint="時:分:秒 の形式で入力（例: 4:30:00）"
        >
          <Input
            type="text"
            inputMode="numeric"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            placeholder={marathonType === "full" ? "4:30:00" : "2:10:00"}
          />
        </Field>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">必要ペース</p>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(
              [
                { key: "perKm", label: "分/km" },
                { key: "kmh", label: "km/h" },
              ] as const
            ).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setUnit(key)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                  unit === key
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center py-2">
          {valid ? (
            <>
              <p className="text-4xl font-bold text-primary-600 tabular-nums">
                {unit === "perKm"
                  ? formatTime(paceSecPerKm)
                  : speedKmh.toFixed(2)}
                <span className="text-lg font-semibold text-gray-500 ml-1">
                  {unit === "perKm" ? "/km" : "km/h"}
                </span>
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {marathonType === "full" ? "フルマラソン" : "ハーフマラソン"}（
                {distanceKm}km）を {formatTime(totalSec)} で完走するペース
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400 py-4">
              目標タイムを入力するとペースが表示されます
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
