import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FilterPanelProps {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function FilterPanel({ children, className, label = "Filters" }: FilterPanelProps) {
  return (
    <section
      aria-label={label}
      className={cn(
        "border-border bg-card rounded-xl border p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)]",
        className
      )}
    >
      {children}
    </section>
  );
}
