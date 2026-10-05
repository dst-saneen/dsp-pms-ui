import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-card",
        compact ? "p-6" : "p-8 sm:p-10",
        className,
      )}
    >
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary ring-1 ring-inset ring-primary/10">
          <Icon className="size-5" aria-hidden="true" />
        </span>

        <h3 className="text-lg font-semibold">
          {title}
        </h3>

        <p className="mt-2 text-sm text-muted-foreground">
          {description}
        </p>

        {actionLabel && (
          <Button
            className="mt-6"
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
