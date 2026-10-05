"use client";

interface FormValidationSummaryProps {
  /** Human-readable blocking errors (already resolved from RHF / Zod). */
  errors: string[];
  title?: string;
}

export function FormValidationSummary({
  errors,
  title = "Fix the following before saving",
}: FormValidationSummaryProps) {
  if (errors.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="border-destructive/40 bg-destructive/5 text-destructive rounded-lg border px-4 py-3 text-sm"
    >
      <p className="font-medium">{title}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </div>
  );
}
