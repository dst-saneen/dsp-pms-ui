import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface FormSectionProps {
  title: string;
  children: ReactNode;
  id?: string;
  highlighted?: boolean;
  description?: string;
}

export function FormSection({
  title,
  children,
  id,
  highlighted = false,
  description,
}: FormSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "border-border bg-card overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_18px_rgba(16,24,40,0.03)] transition-shadow",
        highlighted && "ring-2 ring-warning ring-offset-2",
      )}
    >
      <div className="border-border border-b px-4 py-3.5 sm:px-5">
        <h2 className="text-foreground text-base font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {description ? (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
