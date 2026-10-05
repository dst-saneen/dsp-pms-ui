"use client";

import { ReactNode } from "react";

interface Props {
  title: string;

  subtitle?: string;

  actions?: ReactNode;
}

export function EditorHeader({
  title,
  subtitle,
  actions,
}: Props) {
  return (
    <div className="flex items-start justify-between border-b px-6 py-5">
      <div>
        <h1 className="text-2xl font-semibold">
          {title}
        </h1>

        {subtitle && (
          <p className="mt-1 text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}