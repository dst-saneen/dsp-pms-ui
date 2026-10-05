import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type KpiColumns = 2 | 3 | 4;

interface KpiGridProps {
  children: ReactNode;
  columns?: KpiColumns;
  className?: string;
}

const columnClass: Record<KpiColumns, string> = {
  2: "md:grid-cols-2",
  3: "md:grid-cols-2 xl:grid-cols-3",
  4: "md:grid-cols-2 xl:grid-cols-4",
};

/** Equal-gap KPI / summary card grid used across list workspaces. */
export function KpiGrid({
  children,
  columns = 3,
  className,
}: KpiGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 md:gap-5",
        columnClass[columns],
        className
      )}
    >
      {children}
    </div>
  );
}
