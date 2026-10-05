import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface WorkspaceShellProps {
  children: ReactNode;
  className?: string;
}

/** Consistent vertical rhythm for toolbar → KPIs → table/content. */
export function WorkspaceShell({
  children,
  className,
}: WorkspaceShellProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-5 md:gap-6",
        className
      )}
    >
      {children}
    </div>
  );
}
