"use client";

import Link from "next/link";

import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

export function businessCalendarHref(calendarId?: string | null) {
  return calendarId
    ? `/administration/business-calendar/${calendarId}`
    : "/administration/business-calendar";
}

export function holidaySourceLabel(source?: string | null) {
  return source === "LEGACY_HOLIDAYS" ? "Old holiday list" : "Business Calendar";
}

export function HolidayCalendarLink({
  holidayName,
  source,
  calendarId,
  className,
}: {
  holidayName?: string | null;
  source?: string | null;
  calendarId?: string | null;
  className?: string;
}) {
  const { hasPermission } = useAuth();
  if (!holidayName) return null;
  const canOpenBusiness = hasPermission("calendar.business.read");
  const canOpenHolidays = hasPermission("hr.holidays.read");
  const href = canOpenBusiness
    ? businessCalendarHref(calendarId)
    : canOpenHolidays
      ? "/hr/leave/holidays"
      : null;

  if (!href) {
    return (
      <span className={className}>
        {holidayName}
        <span className="text-muted-foreground">
          {" "}
          · {holidaySourceLabel(source)}
        </span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "text-primary font-medium underline-offset-4 hover:underline",
        className,
      )}
    >
      {holidayName}
      <span className="text-muted-foreground font-normal">
        {" "}
        · {holidaySourceLabel(source)}
      </span>
    </Link>
  );
}
