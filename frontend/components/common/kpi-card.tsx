import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/components/common/status-badge";

export interface KpiTrend {
  value: string | number;
  direction?: "up" | "down" | "neutral";
  label?: string;
}

export interface KpiSeriesPoint {
  label: string;
  value: number;
}

export type KpiDensity = "compact" | "standard";

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  helperText?: string;
  trend?: KpiTrend;
  series?: KpiSeriesPoint[];
  tone?: StatusTone;
  density?: KpiDensity;
  className?: string;
}

const toneClasses: Record<StatusTone, { icon: string; bar: string }> = {
  neutral: {
    icon: "bg-muted text-muted-foreground ring-border",
    bar: "bg-muted-foreground/45",
  },
  accent: {
    icon: "bg-primary-soft text-primary ring-primary/10",
    bar: "bg-brand/75",
  },
  progress: {
    icon: "bg-brand-secondary-soft text-brand-secondary-strong ring-brand-secondary/10",
    bar: "bg-brand-secondary/75",
  },
  information: {
    icon: "bg-information-soft text-information ring-information/10",
    bar: "bg-information/75",
  },
  success: {
    icon: "bg-success-soft text-success ring-success/10",
    bar: "bg-success/75",
  },
  warning: {
    icon: "bg-warning-soft text-warning ring-warning/10",
    bar: "bg-warning-accent/75",
  },
  danger: {
    icon: "bg-danger-soft text-destructive ring-destructive/10",
    bar: "bg-danger-accent/75",
  },
};

export function KpiCard({
  title,
  value,
  icon: Icon,
  helperText,
  trend,
  series,
  tone = "accent",
  density = "standard",
  className,
}: KpiCardProps) {
  const trendTone =
    trend?.direction === "down"
      ? "text-destructive"
      : trend?.direction === "up"
        ? "text-success"
        : "text-muted-foreground";
  const compact = density === "compact";
  const toneStyle = toneClasses[tone];
  const hasSeries = Boolean(series?.length);

  return (
    <Card className={cn("gap-0 py-0", className)}>
      <CardContent
        className={cn(
          "flex flex-col",
          hasSeries
            ? "min-h-44 p-4 sm:p-5"
            : compact
              ? "min-h-28 justify-between gap-3 p-4"
              : "min-h-32 justify-between gap-4 p-5"
        )}
      >
        <div className="flex items-center gap-3">
          {Icon ? (
            <span
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                toneStyle.icon
              )}
            >
              <Icon className="size-4.5" aria-hidden="true" />
            </span>
          ) : null}
          <p className="text-foreground text-sm font-semibold">{title}</p>
        </div>

        <div className={cn("flex flex-wrap items-end gap-x-3 gap-y-1", hasSeries && "mt-4")}>
          <p
            className={cn(
              "text-foreground font-semibold tracking-[-0.025em]",
              compact ? "text-[1.75rem] leading-none" : "text-2xl"
            )}
          >
            {value}
          </p>
          {trend ? (
            <p className="flex items-center gap-1 text-xs">
              <span className={cn("font-semibold", trendTone)}>{trend.value}</span>
              {trend.label ? <span className="text-muted-foreground">{trend.label}</span> : null}
            </p>
          ) : null}
        </div>

        {helperText ? <p className="text-muted-foreground mt-1.5 text-xs">{helperText}</p> : null}

        {series?.length ? (
          <div className="mt-4">
            <div className="flex h-12 items-end justify-between gap-2" aria-hidden="true">
              {series.map((point, index) => (
                <span
                  key={`${point.label}-${index}`}
                  className={cn("w-2.5 min-w-1.5 rounded-full sm:w-3", toneStyle.bar)}
                  style={{ height: `${Math.max(Math.min(point.value, 100), 18)}%` }}
                />
              ))}
            </div>
            <div
              className="text-muted-foreground mt-2 flex justify-between gap-2 text-[11px] font-medium"
              aria-hidden="true"
            >
              {series.map((point, index) => (
                <span key={`${point.label}-label-${index}`} className="w-2.5 text-center sm:w-3">
                  {point.label}
                </span>
              ))}
            </div>
            <p className="sr-only">
              Values: {series.map((point) => `${point.label} ${point.value}`).join(", ")}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
