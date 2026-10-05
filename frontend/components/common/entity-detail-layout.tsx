import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EntityDetailLayoutProps {
  header: ReactNode;
  summary: ReactNode;
  children: ReactNode;
  className?: string;
}

export function EntityDetailLayout({
  header,
  summary,
  children,
  className,
}: EntityDetailLayoutProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-5", className)}>
      {header}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0">{summary}</aside>
        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
