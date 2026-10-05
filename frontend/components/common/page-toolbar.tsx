import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageToolbarProps {
  children: ReactNode;
  className?: string;
}

export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-col gap-3 rounded-xl border p-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)] sm:p-4 md:flex-row md:items-center md:justify-between md:gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}
