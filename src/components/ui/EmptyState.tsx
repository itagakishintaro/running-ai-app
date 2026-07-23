import { ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  icon?: ReactNode;
  message: ReactNode;
  className?: string;
}

export function EmptyState({ icon, message, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-center text-gray-400 py-12",
        className
      )}
    >
      {icon}
      <p className="text-sm">{message}</p>
    </div>
  );
}
