"use client";

import { ApplicationStatusBadge } from "../../components/application-status-badge";
import type { ApplicationTimelineEntry } from "../types/job-application";

interface ApplicationTimelineProps {
  entries: ApplicationTimelineEntry[];
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function ApplicationTimeline({ entries }: ApplicationTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        No timeline events yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            {entry.fromStatus ? (
              <>
                <ApplicationStatusBadge status={entry.fromStatus} />
                <span className="text-muted-foreground">→</span>
              </>
            ) : null}
            <ApplicationStatusBadge status={entry.toStatus} />
          </div>
          <p className="mt-2 font-medium">{entry.summary}</p>
          {entry.comment ? (
            <p className="mt-1 text-sm text-muted-foreground">{entry.comment}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            {entry.actorName} · {formatTimestamp(entry.occurredAt)}
          </p>
        </div>
      ))}
    </div>
  );
}
