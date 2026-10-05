"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  Plane,
  RefreshCw,
  Umbrella,
  UserRoundX,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/common/empty-state";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { friendlyLeaveStatus } from "../lib/personal-leave-calendar";
import { useMyLeave, useMyWorkspace } from "../hooks/use-my-workspace";
import type { MyLeaveData, MyLeaveHistory } from "../types";
import { ApplyLeaveSheet } from "./apply-leave-sheet";

export interface MyLeaveWorkspaceProps {
  initialYear?: number;
  initialApplyOpen?: boolean;
  initialFromDate?: string;
}

type RequestFilter = "all" | "draft" | "pending" | "approved" | "closed";

const PAGE_SIZE = 5;

const requestFilters: Array<{ value: RequestFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "closed", label: "Rejected/Cancelled" },
];

function currentYear() {
  return new Date().getFullYear();
}

function validYear(value: number) {
  return Number.isInteger(value) && value >= 1900 && value <= 9999;
}

function formatDate(value: string) {
  const dateKey = value.slice(0, 10);
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateRange(fromDate: string, toDate: string) {
  const fromKey = fromDate.slice(0, 10);
  const toKey = toDate.slice(0, 10);
  if (fromKey === toKey) return formatDate(fromDate);

  const from = new Date(`${fromKey}T00:00:00Z`);
  const to = new Date(`${toKey}T00:00:00Z`);
  if (from.getUTCFullYear() === to.getUTCFullYear() && from.getUTCMonth() === to.getUTCMonth()) {
    const startDay = String(from.getUTCDate()).padStart(2, "0");
    return `${startDay}–${formatDate(toDate)}`;
  }

  return `${formatDate(fromDate)} – ${formatDate(toDate)}`;
}

function leaveStatusLabel(status: string) {
  return friendlyLeaveStatus(status) ?? status;
}

function isPending(status: string) {
  return status === "SUBMITTED" || status === "PENDING";
}

function matchesFilter(request: MyLeaveHistory, filter: RequestFilter) {
  if (filter === "all") return true;
  if (filter === "draft") return request.status === "DRAFT";
  if (filter === "pending") return isPending(request.status);
  if (filter === "approved") return request.status === "APPROVED";
  return request.status === "REJECTED" || request.status === "CANCELLED";
}

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-700";
  if (status === "REJECTED" || status === "CANCELLED") return "bg-rose-50 text-rose-700";
  if (status === "DRAFT") return "bg-slate-100 text-slate-700";
  return "bg-amber-50 text-amber-700";
}

function requestCountLabel(count: number) {
  return `${count} ${count === 1 ? "request" : "requests"}`;
}

function CompactPanelEmptyState({
  icon: Icon,
  title,
  description,
  iconClassName,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  iconClassName: string;
}) {
  return (
    <div role="status" aria-label={title} className="flex min-h-28 flex-col items-center justify-center px-4 py-5 text-center">
      <span className={cn("flex size-9 items-center justify-center rounded-md", iconClassName)}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <p className="mt-2 font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 text-sm">{description}</p>
    </div>
  );
}

function LeavePosition({ data, year }: { data: MyLeaveData; year: number }) {
  const hasBalances = data.balances.length > 0;
  const totals = data.balances.reduce(
    (result, balance) => ({
      available: result.available + Number(balance.balance || 0),
      used: result.used + Number(balance.used || 0),
      pending: result.pending + Number(balance.pending || 0),
    }),
    { available: 0, used: 0, pending: 0 }
  );
  const yearHistory = data.history.filter((request) => request.fromDate.startsWith(`${year}-`));
  const pendingRequests = yearHistory.filter((request) => isPending(request.status));
  const pendingDays = pendingRequests.reduce(
    (sum, request) => sum + Number(request.requestedDays || 0),
    0
  );
  const nextUpcoming = [...data.upcoming].sort((left, right) => left.fromDate.localeCompare(right.fromDate))[0];

  return (
    <section
      aria-label={`Leave position · ${year}`}
      className="border-border bg-card overflow-hidden rounded-lg border"
    >
      <h2 className="px-4 pt-3 text-sm font-semibold">Leave position · {year}</h2>
      <div
        data-testid="leave-position-grid"
        className="grid gap-2 px-3 pb-3 pt-2 sm:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.45fr)]"
      >
        <article aria-label="Available leave" className="flex min-h-[72px] items-center gap-2 rounded-md border-0 bg-emerald-50/70 p-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700">
            <Umbrella className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-medium">Available leave</p>
            <p className="mt-0.5 text-lg font-semibold">{hasBalances ? `${totals.available} days` : "Not available"}</p>
            <p className="text-muted-foreground text-xs">
              {hasBalances ? `across ${data.balances.length} leave ${data.balances.length === 1 ? "type" : "types"}` : `No balances for ${year}`}
            </p>
          </div>
        </article>

        <article aria-label="Used leave" className="flex min-h-[72px] items-center gap-2 rounded-md border-0 bg-sky-50/70 p-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-sky-100 text-sky-700">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Used leave</p>
            <p className="mt-0.5 text-lg font-semibold">{hasBalances ? `${totals.used} days` : "Not available"}</p>
            <p className="text-muted-foreground text-xs">in {year}</p>
          </div>
        </article>

        <article aria-label="Pending leave" className="flex min-h-[72px] items-center gap-2 rounded-md border-0 bg-amber-50/70 p-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
            <Clock3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Pending</p>
            <p className="mt-0.5 text-lg font-semibold">{pendingDays} days</p>
            <p className="text-muted-foreground text-xs">{requestCountLabel(pendingRequests.length)}</p>
          </div>
        </article>

        <article aria-label="Next upcoming leave" className="flex min-h-[72px] items-center gap-2 rounded-md border-0 bg-violet-50/70 p-2">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium">Next upcoming leave</p>
            {nextUpcoming ? (
              <>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{formatDateRange(nextUpcoming.fromDate, nextUpcoming.toDate)}</p>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", statusTone(nextUpcoming.status))}>
                    {leaveStatusLabel(nextUpcoming.status)}
                  </span>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {nextUpcoming.leaveType} · {nextUpcoming.approvedDays} {nextUpcoming.approvedDays === 1 ? "day" : "days"}
                </p>
              </>
            ) : (
              <><p className="mt-0.5 font-semibold">None scheduled</p><p className="text-muted-foreground text-xs">No upcoming leave</p></>
            )}
          </div>
          {nextUpcoming ? (
            <Link
              href="/my-workspace/calendar"
              aria-label="View next upcoming leave in calendar"
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring flex size-8 shrink-0 items-center justify-center rounded-md outline-none focus-visible:ring-2"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
        </article>
      </div>
    </section>
  );
}

function LeaveBalances({ data, year }: { data: MyLeaveData; year: number }) {
  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <h2 className="font-semibold">Leave balances · {year}</h2>
      </div>
      {data.balances.length === 0 ? (
        <CompactPanelEmptyState
          icon={Umbrella}
          title="No leave balances"
          description={`Leave balances will appear when a policy is assigned for ${year}.`}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
      ) : (
        <>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Leave balances by type</caption>
            <thead className="bg-muted/40 text-muted-foreground text-xs">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Leave type</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Entitlement</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Used</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Pending</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Available</th>
              </tr>
            </thead>
            <tbody>
              {data.balances.map((balance) => (
                <tr key={balance.leaveTypeId} className="border-border border-t">
                  <th scope="row" className="px-4 py-3 font-medium">{balance.leaveName} <span className="text-muted-foreground text-xs">({balance.leaveCode})</span></th>
                  <td className="px-3 py-3">{balance.entitlement} days</td>
                  <td className="px-3 py-3">{balance.used} days</td>
                  <td className="px-3 py-3">{balance.pending} days</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2 py-1 font-medium text-emerald-700">{balance.balance} days</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul aria-label="Leave balances mobile" className="divide-border divide-y md:hidden">
          {data.balances.map((balance) => (
            <li key={balance.leaveTypeId} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{balance.leaveName}</p>
                  <p className="text-muted-foreground text-xs">{balance.leaveCode}</p>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                  {balance.balance} days available
                </span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-muted/40 rounded-md p-2">
                  <dt className="text-muted-foreground text-xs">Entitlement</dt>
                  <dd className="mt-0.5 font-medium">{balance.entitlement} days</dd>
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <dt className="text-muted-foreground text-xs">Used</dt>
                  <dd className="mt-0.5 font-medium">{balance.used} days</dd>
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <dt className="text-muted-foreground text-xs">Pending</dt>
                  <dd className="mt-0.5 font-medium">{balance.pending} days</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
        </>
      )}
    </section>
  );
}

function UpcomingLeave({ data }: { data: MyLeaveData }) {
  const upcoming = [...data.upcoming]
    .sort((left, right) => left.fromDate.localeCompare(right.fromDate))
    .slice(0, 3);

  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">Upcoming leave</h2>
        <Link href="/my-workspace/calendar" className="text-primary inline-flex items-center gap-1.5 text-sm font-medium hover:underline">
          View calendar <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {upcoming.length === 0 ? (
        <CompactPanelEmptyState
          icon={CalendarDays}
          title="No upcoming leave"
          description="Approved or pending leave will appear here."
          iconClassName="bg-violet-50 text-violet-700"
        />
      ) : (
        <ul className="px-4">
          {upcoming.map((request) => (
            <li key={request.id} className="border-border flex items-center gap-3 border-b py-3 last:border-b-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <CalendarDays className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{request.leaveType}</p>
                <p className="text-muted-foreground text-xs">{formatDateRange(request.fromDate, request.toDate)} ({request.approvedDays} {request.approvedDays === 1 ? "day" : "days"})</p>
              </div>
              <span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusTone(request.status))}>
                {leaveStatusLabel(request.status)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LeaveRequests({
  data,
  year,
}: {
  data: MyLeaveData;
  year: number;
}) {
  const [filter, setFilter] = useState<RequestFilter>("all");
  const [requestedPage, setRequestedPage] = useState(1);
  const history = data.history
    .filter((request) => request.fromDate.startsWith(`${year}-`))
    .sort((left, right) => right.fromDate.localeCompare(left.fromDate));
  const counts = Object.fromEntries(requestFilters.map(({ value }) => [
    value,
    history.filter((request) => matchesFilter(request, value)).length,
  ])) as Record<RequestFilter, number>;
  const filtered = history.filter((request) => matchesFilter(request, filter));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filtered.length);

  function selectFilter(value: RequestFilter) {
    setFilter(value);
    setRequestedPage(1);
  }

  return (
    <section className="border-border bg-card overflow-hidden rounded-lg border">
      <div className="border-border border-b px-4 py-3">
        <h2 className="font-semibold">My leave requests · {year}</h2>
        {history.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter leave requests">
            {requestFilters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => selectFilter(item.value)}
                aria-pressed={filter === item.value}
                className={cn(
                  "focus-visible:ring-ring inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition focus-visible:ring-2 focus-visible:outline-none",
                  filter === item.value ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted"
                )}
              >
                {item.label}<span className="rounded-full bg-background/80 px-1.5 py-0.5 text-[11px]">{counts[item.value]}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        history.length === 0 ? (
          <CompactPanelEmptyState
            icon={FileText}
            title={`No leave requests for ${year}`}
            description="Your applications and approval results will appear here."
            iconClassName="bg-sky-50 text-sky-700"
          />
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="font-medium">No requests match this status</p>
            <p className="text-muted-foreground mt-1 text-sm">Choose another request status to continue.</p>
          </div>
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <caption className="sr-only">Leave requests</caption>
              <thead className="bg-muted/40 text-muted-foreground text-xs">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Date or range</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Leave type</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Duration</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Created on</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => (
                  <tr key={request.id} className="border-border border-t">
                    <td className="px-4 py-3"><time dateTime={request.fromDate}>{formatDateRange(request.fromDate, request.toDate)}</time></td>
                    <td className="px-3 py-3 font-medium">{request.leaveType}</td>
                    <td className="px-3 py-3">{request.requestedDays} {request.requestedDays === 1 ? "day" : "days"}</td>
                    <td className="px-3 py-3"><time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2 py-1 text-xs font-medium", statusTone(request.status))}>{leaveStatusLabel(request.status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label="Leave requests mobile" className="divide-border divide-y md:hidden">
            {rows.map((request) => (
              <li key={request.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{request.leaveType}</p>
                    <time dateTime={request.fromDate} className="text-muted-foreground text-sm">
                      {formatDateRange(request.fromDate, request.toDate)}
                    </time>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium", statusTone(request.status))}>
                    {leaveStatusLabel(request.status)}
                  </span>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground text-xs">Duration</dt>
                    <dd className="mt-0.5 font-medium">{request.requestedDays} {request.requestedDays === 1 ? "day" : "days"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Created on</dt>
                    <dd className="mt-0.5 font-medium"><time dateTime={request.createdAt}>{formatDate(request.createdAt)}</time></dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
          <div className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs">
            <span>Showing {rangeStart}–{rangeEnd} of {filtered.length} requests</span>
            {pageCount > 1 ? (
              <div className="flex items-center gap-1" aria-label="Leave request pages">
                <Button type="button" variant="outline" size="icon-sm" aria-label="Previous request page" disabled={page === 1} onClick={() => setRequestedPage(page - 1)}><ChevronLeft className="size-4" aria-hidden="true" /></Button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => (
                  <Button key={pageNumber} type="button" variant={pageNumber === page ? "secondary" : "outline"} size="icon-sm" aria-label={`Request page ${pageNumber}`} aria-current={pageNumber === page ? "page" : undefined} onClick={() => setRequestedPage(pageNumber)}>{pageNumber}</Button>
                ))}
                <Button type="button" variant="outline" size="icon-sm" aria-label="Next request page" disabled={page === pageCount} onClick={() => setRequestedPage(page + 1)}><ChevronRight className="size-4" aria-hidden="true" /></Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </section>
  );
}

function LeaveWorkspaceContent({
  data,
  year,
}: {
  data: MyLeaveData;
  year: number;
}) {
  return (
    <div className="space-y-4">
      <LeavePosition data={data} year={year} />
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
        <LeaveBalances data={data} year={year} />
        <UpcomingLeave data={data} />
      </div>
      <LeaveRequests data={data} year={year} />
    </div>
  );
}

export function MyLeaveWorkspace({
  initialYear,
  initialApplyOpen = false,
  initialFromDate,
}: MyLeaveWorkspaceProps) {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const linked = Boolean(user?.employeeId);
  const canApplyLeave = hasPermission("hr.self.manage");
  const [fallbackYear] = useState(currentYear);
  const [yearOverride, setYearOverride] = useState(initialYear);
  const [applyOpen, setApplyOpen] = useState(initialApplyOpen);
  const [applyFromDate, setApplyFromDate] = useState(initialFromDate);
  const workspace = useMyWorkspace(linked);
  const businessYear = Number(String(workspace.data?.businessDate ?? "").slice(0, 4));
  const defaultYear = validYear(businessYear) ? businessYear : fallbackYear;
  const year = yearOverride ?? defaultYear;
  const yearOptions = Array.from(new Set([defaultYear - 2, defaultYear - 1, defaultYear, defaultYear + 1, year]))
    .filter(validYear)
    .sort((left, right) => right - left);
  const leave = useMyLeave(year, linked && !workspace.isLoading);

  if (!linked) {
    return <PageContainer>
      <PageHeader title="My leave" description="Check your leave balance, track requests, and apply when you need time away." />
      <section className="border-border bg-card flex min-h-48 flex-col items-center justify-center rounded-lg border px-4 py-8 text-center">
        <span className="bg-muted text-muted-foreground flex size-11 items-center justify-center rounded-md"><UserRoundX className="size-5" aria-hidden="true" /></span>
        <h2 className="mt-3 text-base font-semibold">Employee profile not linked</h2>
        <p className="text-muted-foreground mt-1 max-w-md text-sm">Leave information becomes available after your user account is linked to an employee profile.</p>
      </section>
    </PageContainer>;
  }

  const refreshing = workspace.isFetching || leave.isFetching;

  function yearHref(nextYear: number) {
    return `/my-workspace/leave?year=${nextYear}`;
  }

  function changeYear(nextValue: string) {
    const nextYear = Number(nextValue);
    if (!validYear(nextYear)) return;
    setYearOverride(nextYear);
    router.replace(yearHref(nextYear), { scroll: false });
  }

  function openApplyLeave() {
    if (!canApplyLeave) return;
    setApplyFromDate(undefined);
    setApplyOpen(true);
    router.replace(`${yearHref(year)}&action=apply`, { scroll: false });
  }

  function setApplyLeaveOpen(open: boolean) {
    setApplyOpen(open);
    if (!open) {
      setApplyFromDate(undefined);
      router.replace(yearHref(year), { scroll: false });
    }
  }

  function refresh() {
    void Promise.all([workspace.refetch(), leave.refetch()]);
  }

  return <PageContainer>
    <PageHeader
      title="My leave"
      description="Check your leave balance, track requests, and apply when you need time away."
      actions={<>
        <label className="border-input bg-card flex h-8 items-center gap-2 rounded-lg border px-2.5 text-sm max-sm:h-11">
          <CalendarDays className="text-muted-foreground size-4" aria-hidden="true" />
          <span className="sr-only">Leave year</span>
          <select aria-label="Leave year" value={year} onChange={(event) => changeYear(event.target.value)} className="bg-transparent font-medium outline-none">
            {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </label>
        <Button type="button" variant="outline" size="sm" aria-label="Refresh My leave" disabled={refreshing} onClick={refresh}>
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          {refreshing ? "Refreshing" : "Refresh"}
        </Button>
        {canApplyLeave ? <Button type="button" size="sm" onClick={openApplyLeave}><Plane className="size-4" aria-hidden="true" />Apply leave</Button> : null}
      </>}
    />

    {leave.isLoading ? <div className="space-y-4" role="status" aria-label="Loading My leave"><Skeleton className="h-32 rounded-lg" /><div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]"><Skeleton className="h-56 rounded-lg" /><Skeleton className="h-56 rounded-lg" /></div><Skeleton className="h-72 rounded-lg" /></div> : null}
    {!leave.isLoading && leave.error ? <EmptyState icon={CircleAlert} title="Could not load My leave" description={getApiErrorMessage(leave.error, "Leave information is unavailable.")} actionLabel="Retry leave" onAction={() => { void leave.refetch(); }} /> : null}
    {!leave.isLoading && !leave.error && leave.data ? <LeaveWorkspaceContent data={leave.data} year={year} /> : null}

    {canApplyLeave && applyOpen ? <ApplyLeaveSheet key={applyFromDate ?? "blank"} open onOpenChange={setApplyLeaveOpen} defaultFromDate={applyFromDate} /> : null}
  </PageContainer>;
}
