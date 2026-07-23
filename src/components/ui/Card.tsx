import { ElementType, ComponentPropsWithoutRef } from "react";
import { cn } from "./cn";

/** カード共通スタイル。Link 等 div 以外の要素で使い回すため定数化 */
export const cardClass = "bg-white rounded-2xl border border-gray-100 shadow-card";

const paddingClass = {
  none: "",
  sm: "p-4",
  md: "p-5",
} as const;

type CardProps<T extends ElementType> = {
  /** 描画する要素。デフォルト div（<ul> 直下では "li" を指定） */
  as?: T;
  padding?: keyof typeof paddingClass;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "padding">;

export function Card<T extends ElementType = "div">({
  as,
  padding = "sm",
  className,
  children,
  ...props
}: CardProps<T>) {
  const Component = (as || "div") as ElementType;
  return (
    <Component className={cn(cardClass, paddingClass[padding], className)} {...props}>
      {children}
    </Component>
  );
}
