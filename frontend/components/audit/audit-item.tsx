"use client";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import type {
  AuditEntry,
} from "./types";

interface Props {
  entry: AuditEntry;
}

export function AuditItem({
  entry,
}: Props) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <div className="font-medium">
            {entry.action}
          </div>

          <div className="text-sm text-muted-foreground">
            {entry.timestamp.toLocaleString()}
          </div>
        </div>

        <div className="text-sm">
          {entry.user}
        </div>

        {entry.description && (
          <div className="text-sm text-muted-foreground">
            {entry.description}
          </div>
        )}
      </CardContent>
    </Card>
  );
}