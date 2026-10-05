import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  description = "An unexpected error occurred.",
  onRetry,
  className,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-destructive/20 bg-danger-soft/40 px-6 text-center",
        compact ? "py-6" : "py-10 sm:py-12",
        className,
      )}
    >
      <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-destructive">
        <AlertCircle className="size-5" aria-hidden="true" />
      </span>

      <h3 className="text-lg font-semibold">
        {title}
      </h3>

      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>

      {onRetry && (
        <Button
          className="mt-6"
          variant="outline"
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}
