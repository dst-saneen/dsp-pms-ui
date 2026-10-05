"use client";

import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface EditorSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function EditorSection({
  title,
  description,
  children,
  className,
}: EditorSectionProps) {
  return (
    <section
      className={cn(
        "rounded-lg border bg-background",
        className,
      )}
    >
      <div className="border-b px-6 py-4">
        <h2 className="text-base font-semibold">
          {title}
        </h2>

        {description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {description}
          </p>
        )}
      </div>

      <div className="p-6">
        {children}
      </div>
    </section>
  );
}