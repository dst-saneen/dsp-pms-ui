"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/services/api-client";

import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { useReadyToHireQueue } from "../hooks/use-ready-to-hire";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

export function ReadyToHireWorkspace() {
  const router = useRouter();
  const queueQuery = useReadyToHireQueue();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <UserCheck className="size-4" aria-hidden />
          Ready to hire
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Candidates with accepted offers awaiting conversion to employee records.
        </p>
      </CardHeader>
      <CardContent>
        {queueQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading ready-to-hire queue…</p>
        ) : null}

        {queueQuery.error ? (
          <ErrorState
            title="Ready-to-hire queue unavailable"
            description={getApiErrorMessage(
              queueQuery.error,
              "We could not load the ready-to-hire queue.",
            )}
            onRetry={() => void queueQuery.refetch()}
          />
        ) : null}

        {!queueQuery.isLoading && !queueQuery.error && (queueQuery.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No candidates ready to hire"
            description="Accepted offers will appear here for preflight and conversion."
          />
        ) : null}

        {!queueQuery.isLoading && !queueQuery.error && (queueQuery.data?.length ?? 0) > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Opening</TableHead>
                <TableHead>Accepted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queueQuery.data?.map((item) => (
                <TableRow
                  key={item.applicationId}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(
                      `${RECRUITMENT_ROUTES.applications.detail(item.applicationId)}?tab=offer`,
                    )
                  }
                >
                  <TableCell className="font-medium">{item.applicationNumber}</TableCell>
                  <TableCell>{item.candidateName}</TableCell>
                  <TableCell>
                    <div>{item.openingTitle}</div>
                    {item.branchName ? (
                      <div className="text-xs text-muted-foreground">{item.branchName}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>{formatDate(item.acceptedAt)}</TableCell>
                  <TableCell className="text-right">
                    {item.existingEmployeeId ? (
                      <Button asChild variant="outline" size="sm" onClick={(event) => event.stopPropagation()}>
                        <Link
                          href={RECRUITMENT_ROUTES.employeeDetail(
                            item.existingEmployeeId,
                            "onboarding",
                          )}
                        >
                          View employee
                        </Link>
                      </Button>
                    ) : item.canConvert ? (
                      <Button asChild size="sm" onClick={(event) => event.stopPropagation()}>
                        <Link
                          href={`${RECRUITMENT_ROUTES.applications.detail(item.applicationId)}?tab=offer`}
                        >
                          Convert
                        </Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Blocked</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </CardContent>
    </Card>
  );
}
