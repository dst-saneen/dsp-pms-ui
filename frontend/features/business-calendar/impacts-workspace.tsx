"use client";

import { useMemo, useState } from "react";

import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { LookupSelect } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCompanies } from "@/features/lookups/hooks/use-companies";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useBusinessCalendarImpacts,
  useResolveCalendarImpact,
} from "./hooks";
import {
  friendlyEntityType,
  friendlyImpactCode,
  friendlyImpactStatus,
} from "./labels";
import type { CalendarImpactRow } from "./types";
import { usePersistedCompanyId } from "./use-persisted-selection";

export function BusinessCalendarImpactsWorkspace() {
  const { hasPermission } = useAuth();
  const canReview = hasPermission("calendar.business.review");
  const { companyId, setCompanyId, ready: companyReady } =
    usePersistedCompanyId();
  const [status, setStatus] = useState<"PENDING" | "RESOLVED" | "ALL">(
    "PENDING",
  );
  const companies = useCompanies();
  const companyItems = useMemo(
    () => [
      { id: "", code: "ALL", name: "All companies" },
      ...(companies.data ?? []).map((company) => ({
        id: company.id,
        code: company.code,
        name: company.name,
      })),
    ],
    [companies.data],
  );

  const impactsQuery = useBusinessCalendarImpacts({
    companyId: companyId || undefined,
    status: status === "ALL" ? undefined : status,
  });
  const resolve = useResolveCalendarImpact();
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [detailsOpenId, setDetailsOpenId] = useState<string | null>(null);

  const rows = useMemo(
    () => (impactsQuery.data ?? []) as CalendarImpactRow[],
    [impactsQuery.data],
  );
  const pendingCount = useMemo(
    () => rows.filter((row) => row.status === "PENDING").length,
    [rows],
  );

  return (
    <div className="space-y-4 overflow-x-hidden">
      <p className="text-muted-foreground text-sm">
        When a published calendar is edited, leave or shift rows may need HR
        follow-up. Mark each item when you have checked it — locked history is
        never rewritten automatically.
      </p>

      <PageToolbar>
        <div className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-xl">
          <div className="space-y-1">
            <Label htmlFor="business-calendar-impact-company">Company</Label>
            <LookupSelect
              id="business-calendar-impact-company"
              value={companyId}
              onChange={setCompanyId}
              items={companyItems}
              placeholder="Company"
              loading={companies.isLoading || !companyReady}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="business-calendar-impact-status">Status</Label>
            <LookupSelect
              id="business-calendar-impact-status"
              value={status}
              onChange={(value) =>
                setStatus(value as "PENDING" | "RESOLVED" | "ALL")
              }
              items={[
                { id: "PENDING", code: "PENDING", name: "Needs review" },
                { id: "RESOLVED", code: "RESOLVED", name: "Done" },
                { id: "ALL", code: "ALL", name: "All" },
              ]}
              placeholder="Status"
            />
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void impactsQuery.refetch()}
        >
          Refresh
        </Button>
      </PageToolbar>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Follow-up list{" "}
            <span className="text-muted-foreground text-sm font-normal">
              ({pendingCount} needing review)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {impactsQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : impactsQuery.isError ? (
            <div className="space-y-2">
              <p className="text-destructive text-sm">
                {getApiErrorMessage(
                  impactsQuery.error,
                  "Could not load review items.",
                )}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void impactsQuery.refetch()}
              >
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nothing to review. Items appear after you publish an edit to a
              published calendar.
            </p>
          ) : (
            <>
              <div className="text-muted-foreground hidden gap-3 border-b border-border pb-2 text-xs font-medium md:grid md:grid-cols-[110px_100px_1fr_140px_110px]">
                <span>Date</span>
                <span>Type</span>
                <span>What changed</span>
                <span>Office</span>
                <span>Status</span>
              </div>
              {rows.map((impact) => {
                const detailsOpen = detailsOpenId === impact.id;
                return (
                  <div
                    key={impact.id}
                    className="rounded-lg border border-border p-3 space-y-2"
                  >
                    <div className="grid gap-2 md:grid-cols-[110px_100px_1fr_140px_110px] md:items-start">
                      <div>
                        <p className="text-muted-foreground text-xs md:hidden">
                          Date
                        </p>
                        <p className="text-sm font-medium">
                          {impact.businessDate.slice(0, 10)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs md:hidden">
                          Type
                        </p>
                        <p className="text-sm">
                          {friendlyEntityType(impact.entityType)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs md:hidden">
                          What changed
                        </p>
                        <p className="text-sm">{impact.impactSummary}</p>
                        <p className="text-muted-foreground text-xs">
                          {friendlyImpactCode(impact.impactCode)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs md:hidden">
                          Office
                        </p>
                        <p className="text-sm">
                          {impact.branch?.branchName ?? "Company-wide"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs md:hidden">
                          Status
                        </p>
                        <StatusBadge
                          label={friendlyImpactStatus(impact.status)}
                          tone={
                            impact.status === "PENDING"
                              ? "warning"
                              : impact.status === "RESOLVED"
                                ? "success"
                                : "neutral"
                          }
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDetailsOpenId(detailsOpen ? null : impact.id)
                        }
                      >
                        {detailsOpen ? "Hide details" : "Details"}
                      </Button>
                      {canReview && impact.status === "PENDING" ? (
                        <>
                          <div className="min-w-0 flex-1 space-y-1 sm:max-w-xs">
                            <Label
                              htmlFor={`res-${impact.id}`}
                              className="sr-only"
                            >
                              Review note
                            </Label>
                            <Input
                              id={`res-${impact.id}`}
                              value={reasonById[impact.id] ?? ""}
                              onChange={(e) =>
                                setReasonById((current) => ({
                                  ...current,
                                  [impact.id]: e.target.value,
                                }))
                              }
                              placeholder="Optional note"
                            />
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            disabled={resolve.isPending}
                            onClick={() =>
                              void resolve.mutateAsync({
                                impactId: impact.id,
                                resolutionReason: reasonById[impact.id],
                              })
                            }
                          >
                            Mark reviewed
                          </Button>
                        </>
                      ) : null}
                    </div>

                    {detailsOpen ? (
                      <div className="bg-muted/40 rounded-md px-3 py-2 text-xs space-y-1">
                        {impact.amendment ? (
                          <p>
                            Change reason: {impact.amendment.reason} (from{" "}
                            {impact.amendment.effectiveDate.slice(0, 10)})
                          </p>
                        ) : (
                          <p className="text-muted-foreground">
                            No amendment notes on this item.
                          </p>
                        )}
                        <p className="text-muted-foreground">
                          Linked record: {friendlyEntityType(impact.entityType)}
                        </p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
