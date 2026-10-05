"use client";

import { formatCareerEventType } from "../utils/career-labels";
import type { CareerTimelineEvent } from "../types/career-timeline";

interface CareerTimelineProps {
  events: CareerTimelineEvent[];
  showHrDetail?: boolean;
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function CareerTimeline({ events, showHrDetail = false }: CareerTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        No career milestones recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <div key={event.id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {formatCareerEventType(event.eventType)}
            </p>
            <p className="text-xs text-muted-foreground">{formatTimestamp(event.occurredAt)}</p>
          </div>
          <p className="mt-2 font-medium">{event.summary}</p>
          {showHrDetail && event.hrDetail ? (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-muted-foreground">
              {event.hrDetail}
            </p>
          ) : null}
          {event.actorName ? (
            <p className="mt-2 text-xs text-muted-foreground">{event.actorName}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
