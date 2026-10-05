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

export default function BusinessCalendarVersionPage() {
  const params = useParams<{ calendarId: string; versionId: string }>();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("calendar.business.manage");
  const calendarsQuery = useBusinessCalendars();
  const calendar = (calendarsQuery.data ?? []).find(
    (row) => row.id === params.calendarId,
  );

  return (
    <PageContainer>
      <PageHeader
        title={calendar?.calendarName ?? "Calendar version"}
        description="Focused version workspace."
      />
      <WorkspaceShell>
        <BusinessCalendarShell>
          {!calendar ? (
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
              initialVersionId={params.versionId}
            />
          )}
        </BusinessCalendarShell>
      </WorkspaceShell>
    </PageContainer>
  );
}
