import type { CareerTimelineEvent } from "../types/career-timeline";

/** Strip HR-only fields for employee self-service projections. */
export function sanitizeCareerTimeline(events: CareerTimelineEvent[]): CareerTimelineEvent[] {
  return events.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    occurredAt: event.occurredAt,
    summary: event.summary,
    sourceModule: event.sourceModule,
    sourceRecordId: event.sourceRecordId,
  }));
}

export function containsConfidentialCareerDetail(events: CareerTimelineEvent[]) {
  return events.some((event) => Boolean(event.hrDetail?.trim()));
}
