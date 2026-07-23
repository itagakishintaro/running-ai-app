import { SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { controlClass } from "./Input";

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(controlClass, "bg-white", className)} {...props}>
      {children}
    </select>
  );
}
