import { Boxes } from "lucide-react";

import { cn } from "@/lib/utils";

interface AppBrandProps {
  compact?: boolean;
  name?: string;
  description?: string;
  className?: string;
}

export function AppBrand({
  compact = false,
  name = "Group ERP",
  description = "Enterprise Platform",
  className,
}: AppBrandProps) {
  return (
    <div
      className={cn("flex min-w-0 items-center", compact ? "justify-center" : "gap-3", className)}
    >
      <span
        className={cn(
          "bg-brand ring-brand/15 flex shrink-0 items-center justify-center text-white shadow-[0_4px_12px_rgba(231,111,81,0.18)] ring-1",
          compact ? "size-9 rounded-lg" : "size-10 rounded-xl"
        )}
      >
        <Boxes className="size-4.5" aria-hidden="true" />
      </span>
      {!compact ? (
        <span className="min-w-0">
          <span className="text-foreground block truncate text-[15px] font-semibold tracking-[-0.015em]">
            {name}
          </span>
          <span className="text-muted-foreground block truncate text-xs">{description}</span>
        </span>
      ) : null}
    </div>
  );
}
