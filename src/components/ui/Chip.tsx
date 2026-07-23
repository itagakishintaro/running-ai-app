import { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

/** 体調・モチベーション選択などの意味を持つ色分け。primary には統一しない */
type Tone = "green" | "blue" | "gray" | "orange" | "red";

const toneClass: Record<Tone, string> = {
  green: "bg-green-100 text-green-800 border-green-300",
  blue: "bg-blue-100 text-blue-800 border-blue-300",
  gray: "bg-gray-100 text-gray-800 border-gray-300",
  orange: "bg-orange-100 text-orange-800 border-orange-300",
  red: "bg-red-100 text-red-800 border-red-300",
};

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  selected: boolean;
}

export function Chip({ tone = "gray", selected, className, children, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "px-3.5 py-1.5 rounded-full text-sm border font-medium transition-all",
        selected
          ? cn(toneClass[tone], "ring-2 ring-offset-1 ring-current")
          : "bg-white text-gray-500 border-gray-200 hover:border-gray-400",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
