"use client";

import { Button } from "@/components/ui/button";

interface Action<T> {
  id: string;
  label: string;
  onClick(row: T): void;
}

interface Props<T> {
  row: T;
  actions: Action<T>[];
}

export function ActionsRenderer<T>({
  row,
  actions,
}: Props<T>) {
  return (
    <div className="flex gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          size="sm"
          variant="ghost"
          onClick={() =>
            action.onClick(row)
          }
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}