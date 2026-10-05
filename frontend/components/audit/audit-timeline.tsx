"use client";

import { AuditEmpty } from "./audit-empty";
import { AuditItem } from "./audit-item";

import type { AuditEntry } from "./types";

interface Props {
  entries: AuditEntry[];
}

export function AuditTimeline({
  entries,
}: Props) {
  if (entries.length === 0) {
    return <AuditEmpty />;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <AuditItem
          key={entry.id}
          entry={entry}
        />
      ))}
    </div>
  );
}