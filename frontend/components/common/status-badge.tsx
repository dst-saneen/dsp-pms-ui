import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone =
  | "neutral"
  | "accent"
  | "progress"
  | "information"
  | "success"
  | "warning"
  | "danger";

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
  className?: string;
}

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-secondary-foreground",
  accent: "border-primary/15 bg-primary-soft text-accent-foreground",
  progress:
    "border-brand-secondary/15 bg-brand-secondary-soft text-brand-secondary-strong",
  information:
    "border-information/15 bg-information-soft text-information-foreground",
  success: "border-success/15 bg-success-soft text-success-foreground",
  warning: "border-warning/15 bg-warning-soft text-warning-foreground",
  danger: "border-destructive/15 bg-danger-soft text-destructive",
};

const dotClasses: Record<StatusTone, string> = {
  neutral: "bg-muted-foreground",
  accent: "bg-primary",
  progress: "bg-brand-secondary",
  information: "bg-information",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function StatusBadge({
  label,
  tone = "neutral",
  showDot = true,
  className,
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-6 gap-1.5 rounded-md px-2 font-medium",
        toneClasses[tone],
        className,
      )}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", dotClasses[tone])}
        />
      ) : null}
      {label}
    </Badge>
  );
}
