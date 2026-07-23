import { ReactNode } from "react";
import { cn } from "./cn";

interface ModalProps {
  onClose: () => void;
  title?: ReactNode;
  /** 背景クリックで閉じるか。呼び出し側の従来挙動を厳密に再現するため明示指定 */
  closeOnBackdrop?: boolean;
  children: ReactNode;
  className?: string;
}

export function Modal({
  onClose,
  title,
  closeOnBackdrop = true,
  children,
  className,
}: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={cn("bg-white rounded-2xl shadow-overlay w-full max-w-md p-5", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="font-bold text-gray-900 mb-3">{title}</div>}
        {children}
      </div>
    </div>
  );
}
