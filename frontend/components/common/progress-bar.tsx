"use client";

interface ProgressBarProps {
  value: number;
  label?: string;
  showValue?: boolean;
}

export function ProgressBar({
  value,
  label = "Progress",
  showValue = true,
}: ProgressBarProps) {
  const percentage = Math.min(
    Math.max(value, 0),
    100,
  );

  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] motion-reduce:transition-none"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>

      {showValue ? (
        <div className="mt-1 text-xs text-muted-foreground">
          {percentage}%
        </div>
      ) : null}
    </div>
  );
}
