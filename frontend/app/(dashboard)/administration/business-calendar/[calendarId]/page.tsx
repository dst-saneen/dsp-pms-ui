"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  BusinessCalendarShell,
  CalendarVersionWorkspace,
  useBusinessCalendars,
} from "@/features/business-calendar";
import { useAuth } from "@/providers/auth-provider";

export default function BusinessCalendarDetailPage() {
  const params = useParams<{ calendarId: string }>();
  const calendarId = params.calendarId;
  const { hasPermission } = useAuth();
  const canManage = hasPermission("calendar.business.manage");
  const calendarsQuery = useBusinessCalendars();
  const calendar = (calendarsQuery.data ?? []).find(
    (row) => row.id === calendarId,
  );

  return (
    <PageContainer>
      <PageHeader
        title={calendar?.calendarName ?? "Calendar"}
        description="Set working week and holidays, then publish. Edit published calendars with a tracked change."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          {calendarsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading calendar…</p>
          ) : !calendar ? (
            <div className="space-y-2">
              <p className="text-muted-foreground text-sm">
                Calendar not found or out of scope.
              </p>
              <Button type="button" variant="outline" asChild>
                <Link href="/administration/business-calendar">Back to offices</Link>
              </Button>
            </div>
          ) : (
            <CalendarVersionWorkspace
              calendar={calendar}
              canManage={canManage}
            />
          )}
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
