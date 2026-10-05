"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { useHiringDecisionQueue } from "../hooks/use-hiring-decisions";

export function HiringDecisionsWorkspace() {
  const { user } = useAuth();
  const employeeId = user?.employeeId;
  const queueQuery = useHiringDecisionQueue(employeeId);

  if (!employeeId) {
    return (
      <p className="text-sm text-muted-foreground">
        Link your user account to an employee record to see hiring decisions.
      </p>
    );
  }

  if (queueQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading hiring decisions…</p>;
  }

  const queue = queueQuery.data ?? [];
  if (queue.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hiring decisions are waiting on your openings right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <div key={item.jobOpeningId} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">
                {item.openingCode} · {item.openingTitle}
              </p>
              <p className="text-sm text-muted-foreground">
                {item.branchName ?? "—"} · {item.pendingDecisionCount} awaiting
                decision · {item.inPipelineCount} in pipeline · Headcount
                remaining: {item.headcountRemaining}
              </p>
              {item.decisionOwnerName ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  Decision owner: {item.decisionOwnerName}
                </p>
              ) : null}
            </div>
            <Button asChild size="sm">
              <Link href={RECRUITMENT_ROUTES.hiringDecisions.opening(item.jobOpeningId)}>
                Compare candidates
              </Link>
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
