import { InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** input / select / textarea 共通の枠線・フォーカスリングスタイル */
export const controlClass =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-primary-400 transition";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(controlClass, className)} {...props} />;
}
