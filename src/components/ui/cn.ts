/** 真値のクラス文字列だけを連結する軽量ヘルパー */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
