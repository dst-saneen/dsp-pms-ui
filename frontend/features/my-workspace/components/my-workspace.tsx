"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileText,
  FolderKanban,
  Laptop,
  ListChecks,
  LoaderCircle,
  LogIn,
  LogOut,
  MapPin,
  Plane,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { SubmitRegularizationSheet } from "@/features/attendance-exception/dialogs/submit-regularization-sheet";
import { friendlyExceptionType } from "@/features/attendance/lib/attendance-labels";
import { OptionalHolidaySelectionCard } from "@/features/optional-holiday";
import { useOptionalHolidays } from "@/features/optional-holiday/hooks";
import { OwnerEmployeeSelectionDialog } from "@/features/organization-onboarding/components/owner-employee-selection-dialog";
import { organizationOnboardingService } from "@/features/organization-onboarding/organization-onboarding-service";
import { useMyPayslips } from "@/features/payroll/hooks";
import { useMyProjectTasks, useMyTimesheets } from "@/features/projects/hooks/use-projects";
import type { ProjectTask } from "@/features/projects/types/project.types";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useAttendanceActions,
  useMyAssets,
  useMyAttendanceExceptions,
  useMyOvertime,
  useMyWorkspace,
  useSubmitMyRegularization,
} from "../hooks/use-my-workspace";
import type { MyAttendanceException, MyOvertimeRequest } from "../types";
import { MyAssetsCard } from "./my-assets-card";
import { MyPayslipsCard } from "./my-payslips-card";
import { SubmitOvertimeSheet } from "./submit-overtime-sheet";

const panelClass =
  "border-border bg-card rounded-lg border shadow-[0_1px_2px_rgba(16,24,40,0.025)]";

function formatTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}

function formatBusinessDate(value: string | undefined, timezone: string | undefined) {
  if (!value) return "—";
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: timezone ?? undefined,
  });
}

function formatBusinessTime(timezone: string | null | undefined) {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone ?? undefined,
  });
}

function formatPayslipPeriod(year: number | undefined, month: number | undefined) {
  if (!year || !month || month < 1 || month > 12) return null;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function readableStatus(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function workStatusTone(value: string): StatusTone {
  const status = value.toUpperCase();
  if (status.includes("PROGRESS")) return "success";
  if (status.includes("DUE") || status.includes("OVERDUE")) return "danger";
  if (status.includes("UPCOMING") || status.includes("REVIEW")) return "information";
  return "neutral";
}

function dueWithinSevenDays(dueDate: string | null, businessDate?: string) {
  if (!dueDate || !businessDate) return false;
  const start = new Date(`${businessDate}T00:00:00.000Z`).getTime();
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00.000Z`).getTime();
  return due >= start && due <= start + 7 * 24 * 60 * 60 * 1000;
}

function projectForWorkItem(title: string, tasks: ProjectTask[]) {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  return tasks.find((task) => task.taskName.trim().toLocaleLowerCase() === normalizedTitle)
    ?.projectName;
}

function MetaItem({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs sm:text-sm">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </span>
  );
}

function SummaryLink({
  href,
  icon: Icon,
  iconClassName,
  label,
  value,
  detail,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  value: ReactNode;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        panelClass,
        "group focus-visible:ring-ring/25 hover:bg-muted/25 flex min-h-28 items-center gap-3 p-4 transition-colors outline-none focus-visible:ring-3 max-sm:min-h-24"
      )}
      aria-label={`${label}: ${String(value)} ${detail}`}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg",
          iconClassName
        )}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-muted-foreground block text-sm">{label}</span>
        <span className="text-foreground mt-0.5 block text-2xl leading-none font-semibold">
          {value}
        </span>
        <span className="text-muted-foreground mt-1 block text-xs">{detail}</span>
      </span>
      <ArrowRight
        className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

const quickActionToneClasses = {
  leave: {
    container:
      "border-orange-200/70 bg-orange-50/70 hover:bg-orange-100/70 dark:border-orange-800/50 dark:bg-orange-950/25 dark:hover:bg-orange-950/40",
    icon: "text-orange-600 dark:text-orange-400",
  },
  timesheet: {
    container:
      "border-emerald-200/70 bg-emerald-50/70 hover:bg-emerald-100/70 dark:border-emerald-800/50 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  request: {
    container:
      "border-blue-200/70 bg-blue-50/70 hover:bg-blue-100/70 dark:border-blue-800/50 dark:bg-blue-950/25 dark:hover:bg-blue-950/40",
    icon: "text-blue-600 dark:text-blue-400",
  },
  approvals: {
    container:
      "border-amber-200/70 bg-amber-50/70 hover:bg-amber-100/70 dark:border-amber-800/50 dark:bg-amber-950/25 dark:hover:bg-amber-950/40",
    icon: "text-amber-600 dark:text-amber-400",
  },
  projects: {
    container:
      "border-violet-200/70 bg-violet-50/70 hover:bg-violet-100/70 dark:border-violet-800/50 dark:bg-violet-950/25 dark:hover:bg-violet-950/40",
    icon: "text-violet-600 dark:text-violet-400",
  },
  assets: {
    container:
      "border-cyan-200/70 bg-cyan-50/70 hover:bg-cyan-100/70 dark:border-cyan-800/50 dark:bg-cyan-950/25 dark:hover:bg-cyan-950/40",
    icon: "text-cyan-600 dark:text-cyan-400",
  },
} as const;

type QuickActionTone = keyof typeof quickActionToneClasses;

function QuickAction({
  href,
  icon: Icon,
  label,
  detail,
  tone,
  onClick,
}: {
  href: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  detail?: string;
  tone: QuickActionTone;
  onClick?: () => void;
}) {
  const toneClasses = quickActionToneClasses[tone];

  return (
    <Link
      href={href}
      onClick={() => onClick?.()}
      className={cn(
        "focus-visible:ring-ring/25 flex min-h-12 items-center gap-2 rounded-md border px-3 py-2 transition-colors outline-none focus-visible:ring-3 max-sm:min-h-11",
        toneClasses.container
      )}
    >
      <Icon className={cn("size-4 shrink-0", toneClasses.icon)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        {detail ? (
          <span className="text-muted-foreground block truncate text-[11px]">{detail}</span>
        ) : null}
      </span>
      <ArrowRight className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
    </Link>
  );
}

function PersonalRecordRow({
  id,
  icon: Icon,
  iconClassName,
  label,
  detail,
  loading = false,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string }>;
  iconClassName: string;
  label: string;
  detail: string;
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const contentId = `${id}-content`;
  return (
    <div id={id} className="border-border border-t first:border-t-0">
      <button
        type="button"
        className="focus-visible:ring-ring/25 hover:bg-muted/25 grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left transition-colors outline-none focus-visible:ring-3 sm:grid-cols-[auto_minmax(180px,0.8fr)_minmax(0,1.2fr)_auto]"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={onToggle}
      >
        <Icon className={cn("size-4", iconClassName)} aria-hidden="true" />
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="text-muted-foreground col-start-2 min-w-0 truncate text-xs sm:col-start-3">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
              {detail}
            </span>
          ) : (
            detail
          )}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground row-span-2 size-4 transition-transform sm:row-span-1",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={contentId}
          className="border-border bg-muted/10 border-t p-3"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

interface AttentionItem {
  key: string;
  icon: ComponentType<{ className?: string }>;
  tone: "danger" | "warning" | "information" | "neutral";
  title: string;
  detail: string;
  action: ReactNode;
}

const attentionToneClasses: Record<AttentionItem["tone"], string> = {
  danger: "bg-danger-soft text-destructive",
  warning: "bg-warning-soft text-warning-foreground",
  information: "bg-information-soft text-information-foreground",
  neutral: "bg-muted text-muted-foreground",
};

export function MyWorkspace() {
  const router = useRouter();
  const { user, refreshSession, hasPermission } = useAuth();
  const capabilities = useModuleCapabilities();
  const linked = Boolean(user?.employeeId);
  const isOrganizationOwner = Boolean(user?.authorization.roles.includes("ORGANIZATION_OWNER"));
  const canRepairOwnerLink = isOrganizationOwner && hasPermission("organization.structure.manage");

  const linkStatusQuery = useQuery({
    queryKey: ["organization-onboarding", "owner-link", user?.id],
    queryFn: organizationOnboardingService.status,
    enabled: !linked && canRepairOwnerLink,
    retry: 1,
  });

  const [repairOpen, setRepairOpen] = useState(false);
  const { data, isLoading, error, refetch, isFetching } = useMyWorkspace(linked);
  const exceptionsQuery = useMyAttendanceExceptions(linked);
  const overtimeQuery = useMyOvertime(linked);
  const assetEnabled =
    linked && Boolean(capabilities.data?.assetSelfNav || capabilities.data?.assetsNav);
  const assetsQuery = useMyAssets(assetEnabled);
  const projectsEnabled = linked && Boolean(capabilities.data?.projectsNav);
  const projectTasksQuery = useMyProjectTasks(projectsEnabled);
  const timesheetsQuery = useMyTimesheets(undefined, projectsEnabled);
  const payslipsEnabled =
    linked && Boolean(capabilities.data?.payroll && capabilities.data?.payrollNav);
  const payslipsQuery = useMyPayslips(payslipsEnabled);
  const optionalHolidayYear = Number(data?.businessDate?.slice(0, 4)) || new Date().getFullYear();
  const optionalHolidaysQuery = useOptionalHolidays(optionalHolidayYear, linked);
  const submitMyRegularization = useSubmitMyRegularization();
  const { checkIn, checkOut, errorMessage } = useAttendanceActions();
  const [regularizeTarget, setRegularizeTarget] = useState<MyAttendanceException | null>(null);
  const [regularizeOpen, setRegularizeOpen] = useState(false);
  const [overtimeTarget, setOvertimeTarget] = useState<MyOvertimeRequest | null>(null);
  const [overtimeOpen, setOvertimeOpen] = useState(false);
  const [openRecord, setOpenRecord] = useState<"assets" | "payslips" | "holidays" | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date());

  const repairMutation = useMutation({
    mutationFn: organizationOnboardingService.repairOwnerEmployee,
    onSuccess: async (status) => {
      setRepairOpen(false);
      await refreshSession();
      if (status.ownerEmployeeLink?.state === "LINKED") {
        toast.success("Employee profile linked.");
        void refetch();
      } else if (status.ownerEmployeeLink?.supportCode) {
        toast.error(`Link still incomplete. Support code: ${status.ownerEmployeeLink.supportCode}`);
      }
    },
    onError: (caught) =>
      toast.error(getApiErrorMessage(caught, "Could not repair the employee link.")),
  });

  if (!linked) {
    const linkState = linkStatusQuery.data?.ownerEmployeeLink?.state;
    const supportCode = linkStatusQuery.data?.ownerEmployeeLink?.supportCode;
    let title = "Employee link required";
    let description =
      "Your user account is not linked to an employee record, so self-service is unavailable. Ask an administrator to link your employee profile.";

    if (canRepairOwnerLink) {
      if (linkState === "AWAITING_SETUP") {
        title = "Finish organization setup first";
        description =
          "Your owner employee profile is created when required setup is complete. Open Organization setup, finish Branch and Department, then return here.";
      } else if (linkState === "NEEDS_REPAIR" || supportCode) {
        title = "Employee profile needs repair";
        description = supportCode
          ? `Automatic linking did not finish. Retry below, or share support code ${supportCode} with an administrator.`
          : "Automatic linking did not finish. Retry below, or ask an administrator for help.";
      } else {
        title = "Employee profile needs repair";
        description =
          "Your owner account is not linked to an employee record yet. Retry the automatic link if you have already finished organization setup.";
      }
    }

    return (
      <>
        <EmptyState
          icon={Briefcase}
          title={title}
          description={description}
          actionLabel={
            canRepairOwnerLink
              ? linkState === "AWAITING_SETUP"
                ? "Open organization setup"
                : "Choose assignment and retry"
              : undefined
          }
          onAction={
            canRepairOwnerLink
              ? () => {
                  if (linkState === "AWAITING_SETUP") {
                    router.push("/onboarding");
                    return;
                  }
                  setRepairOpen(true);
                }
              : undefined
          }
        />
        <OwnerEmployeeSelectionDialog
          open={repairOpen}
          onOpenChange={setRepairOpen}
          title="Repair owner employee assignment"
          description="Choose the active Company, Branch, Department, and Designation that belong to this owner employee record."
          submitLabel="Repair employee link"
          isPending={repairMutation.isPending}
          onSubmit={async (selection) => {
            await repairMutation.mutateAsync(selection);
          }}
        />
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4" aria-label="Loading My Work">
        <div className="bg-muted h-24 rounded-lg" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="bg-muted h-28 rounded-lg md:col-span-2" />
          <div className="bg-muted h-28 rounded-lg" />
          <div className="bg-muted h-28 rounded-lg" />
        </div>
        <div className="grid gap-4 xl:grid-cols-5">
          <div className="bg-muted h-72 rounded-lg xl:col-span-3" />
          <div className="bg-muted h-72 rounded-lg xl:col-span-2" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Could not load workspace"
        description={getApiErrorMessage(error, "We could not load your self-service workspace.")}
        actionLabel="Retry"
        onAction={() => void refetch()}
      />
    );
  }

  const {
    identity,
    todayAttendance,
    todayShift,
    todayWorkPlan,
    leave,
    onboarding,
    documents,
    punchReadiness,
    businessDate,
  } = data;
  const checkedIn = Boolean(todayAttendance?.checkInTime);
  const checkedOut = Boolean(todayAttendance?.checkOutTime);
  const canCheckIn = punchReadiness?.canCheckIn ?? !(checkedIn || checkIn.isPending || isFetching);
  const canCheckOut =
    punchReadiness?.canCheckOut ?? (checkedIn && !checkedOut && !checkOut.isPending && !isFetching);
  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const attendanceStatus = checkedOut
    ? "Workday complete"
    : checkedIn
      ? "Checked in"
      : "Not checked in";
  const attendanceBlockedReason = !checkedIn
    ? punchReadiness?.checkInBlockedReason
    : !checkedOut
      ? punchReadiness?.checkOutBlockedReason
      : null;
  const visibleAttendanceBlockedReason = todayShift ? attendanceBlockedReason : null;
  const projectTasks = projectTasksQuery.data?.items ?? [];
  const dueThisWeek = projectTasks.filter((task) =>
    dueWithinSevenDays(task.dueDate, businessDate)
  ).length;
  const assignedProjects = new Set(projectTasks.map((task) => task.projectId)).size;
  const openExceptions = (exceptionsQuery.data ?? []).filter((item) => item.status === "OPEN");
  const calculatedOvertime = (overtimeQuery.data ?? []).filter(
    (item) => item.status.toUpperCase() === "CALCULATED"
  );
  const pendingTimesheets = (timesheetsQuery.data?.items ?? []).filter((item) =>
    ["DRAFT", "RETURNED"].includes(item.status.toUpperCase())
  );
  const incompleteOnboarding = onboarding.tasks.filter(
    (item) => !["COMPLETED", "CANCELLED"].includes(item.status.toUpperCase())
  );
  const assetSummary = assetsQuery.data?.summary;
  const assignedAssetCount =
    (assetSummary?.physicalAssigned ?? 0) + (assetSummary?.activeLicenses ?? 0);
  const latestPayslip = [...(payslipsQuery.data ?? [])].sort((left, right) => {
    const leftValue =
      (left.payrollYear ?? left.year ?? 0) * 100 + (left.payrollMonth ?? left.month ?? 0);
    const rightValue =
      (right.payrollYear ?? right.year ?? 0) * 100 + (right.payrollMonth ?? right.month ?? 0);
    return rightValue - leftValue;
  })[0];
  const payslipPeriod = latestPayslip
    ? formatPayslipPeriod(
        latestPayslip.payrollYear ?? latestPayslip.year,
        latestPayslip.payrollMonth ?? latestPayslip.month
      )
    : null;
  const optionalCatalog = optionalHolidaysQuery.data;
  const hasOptionalHolidayDecision = Boolean(
    optionalCatalog &&
    optionalCatalog.remainingCount > 0 &&
    optionalCatalog.holidays.some((holiday) => !holiday.selected && !holiday.locked)
  );

  async function refreshOverview() {
    setRefreshing(true);
    const refreshers = [
      () => refetch(),
      () => exceptionsQuery.refetch(),
      () => overtimeQuery.refetch(),
      () => capabilities.refetch(),
      ...(projectsEnabled
        ? [() => projectTasksQuery.refetch(), () => timesheetsQuery.refetch()]
        : []),
      ...(assetEnabled ? [() => assetsQuery.refetch()] : []),
      ...(payslipsEnabled ? [() => payslipsQuery.refetch()] : []),
      () => optionalHolidaysQuery.refetch(),
    ];
    await Promise.allSettled(refreshers.map((run) => run()));
    setLastRefreshedAt(new Date());
    setRefreshing(false);
  }

  function openPersonalRecord(record: "assets" | "payslips" | "holidays") {
    setOpenRecord(record);
    window.setTimeout(() => {
      document.getElementById(`personal-records-${record}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 0);
  }

  const attentionItems: AttentionItem[] = [];
  const nextException = openExceptions[0];
  if (nextException) {
    const attendanceId = nextException.attendanceId ?? nextException.attendance?.id;
    attentionItems.push({
      key: `attendance-${nextException.id}`,
      icon: AlertCircle,
      tone: "danger",
      title: `${friendlyExceptionType(nextException.type).label} · ${formatShortDate(nextException.businessDate)}`,
      detail: "Your attendance record is incomplete.",
      action: attendanceId ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => {
            setRegularizeTarget(nextException);
            setRegularizeOpen(true);
          }}
        >
          Request correction
        </Button>
      ) : null,
    });
  } else if (exceptionsQuery.isError) {
    attentionItems.push({
      key: "attendance-error",
      icon: AlertCircle,
      tone: "warning",
      title: "Attendance attention unavailable",
      detail: "This widget could not be refreshed.",
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => void exceptionsQuery.refetch()}
        >
          Retry
        </Button>
      ),
    });
  }

  const nextOvertime = calculatedOvertime[0];
  if (nextOvertime) {
    attentionItems.push({
      key: `overtime-${nextOvertime.id}`,
      icon: Clock3,
      tone: "warning",
      title: `${nextOvertime.eligibleMinutes} min overtime ready`,
      detail: "Calculated and ready to submit.",
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => {
            setOvertimeTarget(nextOvertime);
            setOvertimeOpen(true);
          }}
        >
          Submit
        </Button>
      ),
    });
  } else if (overtimeQuery.isError) {
    attentionItems.push({
      key: "overtime-error",
      icon: Clock3,
      tone: "warning",
      title: "Overtime attention unavailable",
      detail: "This widget could not be refreshed.",
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => void overtimeQuery.refetch()}
        >
          Retry
        </Button>
      ),
    });
  }

  if (pendingTimesheets.length > 0 && projectsEnabled) {
    attentionItems.push({
      key: "timesheet",
      icon: FileText,
      tone: "information",
      title: "Timesheet pending",
      detail: `${pendingTimesheets.length} draft or returned timesheet${pendingTimesheets.length === 1 ? "" : "s"}.`,
      action: (
        <Button size="sm" variant="outline" className="rounded-md" asChild>
          <Link href="/my-workspace/timesheets">Open</Link>
        </Button>
      ),
    });
  } else if (timesheetsQuery.isError && projectsEnabled) {
    attentionItems.push({
      key: "timesheet-error",
      icon: FileText,
      tone: "warning",
      title: "Timesheet status unavailable",
      detail: "This widget could not be refreshed.",
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => void timesheetsQuery.refetch()}
        >
          Retry
        </Button>
      ),
    });
  }

  if (
    incompleteOnboarding.length > 0 &&
    (capabilities.data?.onboardingNav || onboarding.tasks.length > 0)
  ) {
    attentionItems.push({
      key: "onboarding",
      icon: ClipboardCheck,
      tone: "information",
      title: `${incompleteOnboarding.length} onboarding task${incompleteOnboarding.length === 1 ? "" : "s"}`,
      detail: "Complete the remaining tasks.",
      action: (
        <Button size="sm" variant="outline" className="rounded-md" asChild>
          <Link href="/my-workspace/onboarding">Continue</Link>
        </Button>
      ),
    });
  }

  const documentAttentionCount = documents.summary.pending + documents.expired;
  if (documentAttentionCount > 0) {
    const canOpenDocuments = hasPermission("hr.documents.read");
    attentionItems.push({
      key: "documents",
      icon: FileText,
      tone: documents.expired > 0 ? "danger" : "warning",
      title: `${documentAttentionCount} document${documentAttentionCount === 1 ? "" : "s"} ${documentAttentionCount === 1 ? "needs" : "need"} attention`,
      detail: documents.expired > 0 ? `${documents.expired} expired.` : "Verification is pending.",
      action: canOpenDocuments ? (
        <Button size="sm" variant="outline" className="rounded-md" asChild>
          <Link href="/hr/employee-documents">Open</Link>
        </Button>
      ) : (
        <span className="text-muted-foreground text-xs font-medium">Contact HR</span>
      ),
    });
  }

  if ((assetSummary?.acknowledgementPending ?? 0) > 0 && assetEnabled) {
    attentionItems.push({
      key: "assets",
      icon: Laptop,
      tone: "warning",
      title: `${assetSummary?.acknowledgementPending} asset acknowledgement pending`,
      detail: "Review the assigned item and acknowledge it.",
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => openPersonalRecord("assets")}
        >
          Review
        </Button>
      ),
    });
  }

  if (hasOptionalHolidayDecision) {
    attentionItems.push({
      key: "optional-holidays",
      icon: CalendarDays,
      tone: "information",
      title: "Optional holiday selection",
      detail: `${optionalCatalog?.selectedCount ?? 0} of ${optionalCatalog?.optionalAllowance ?? 0} selected.`,
      action: (
        <Button
          size="sm"
          variant="outline"
          className="rounded-md"
          onClick={() => openPersonalRecord("holidays")}
        >
          Review
        </Button>
      ),
    });
  }

  const quickActions: Array<{
    href: string;
    icon: ComponentType<{ className?: string }>;
    label: string;
    detail?: string;
    tone: QuickActionTone;
    show: boolean;
    onClick?: () => void;
  }> = [
    {
      href: "/my-workspace/leave?action=apply",
      icon: Plane,
      label: "Apply leave",
      detail: `${leave.summary.totalBalance} days available`,
      tone: "leave" as const,
      show: true,
    },
    {
      href: "/my-workspace/timesheets",
      icon: Clock3,
      label: "Submit timesheet",
      tone: "timesheet" as const,
      show: projectsEnabled,
    },
    {
      href: "/my-workspace/hr-requests",
      icon: FileText,
      label: "HR request",
      tone: "request" as const,
      show: true,
    },
    {
      href: "/my-workspace/approvals",
      icon: ShieldCheck,
      label: "My approvals",
      tone: "approvals" as const,
      show: true,
    },
    {
      href: "/my-workspace/projects",
      icon: FolderKanban,
      label: "My projects",
      tone: "projects" as const,
      show: projectsEnabled,
    },
    {
      href: "#personal-records-assets",
      icon: Laptop,
      label: "My assets",
      tone: "assets" as const,
      show: assetEnabled,
      onClick: () => openPersonalRecord("assets"),
    },
  ].filter((item) => item.show);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.025em] sm:text-[28px]">
            {greeting}, {identity.fullName}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Let&apos;s make it a productive day.</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5 sm:gap-x-5">
            <MetaItem icon={UserRound}>
              {identity.designation?.designationName ?? "—"} · {identity.department.departmentName}
            </MetaItem>
            <MetaItem icon={Building2}>{identity.company.companyName}</MetaItem>
            <MetaItem icon={MapPin}>{identity.branch.branchName}</MetaItem>
            <MetaItem icon={CalendarDays}>
              {formatBusinessDate(businessDate, data.timezone)}
            </MetaItem>
            <MetaItem icon={Clock3}>
              {formatBusinessTime(data.timezone ?? identity.timezone)} ·{" "}
              {data.timezone ?? identity.timezone ?? "—"}
            </MetaItem>
          </div>
        </div>
        <div className="flex shrink-0 flex-row items-center justify-between gap-3 lg:flex-col lg:items-end lg:justify-start">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-md"
            disabled={refreshing}
            onClick={() => void refreshOverview()}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} aria-hidden="true" />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <p className="text-muted-foreground text-xs">
            Last refreshed{" "}
            {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" aria-label="Workday summary">
        <div
          className={cn(
            panelClass,
            "flex min-h-28 flex-col gap-3 border-primary/15 bg-primary-soft/45 p-4 sm:flex-row sm:items-center md:col-span-2 xl:col-span-2"
          )}
        >
          <span className="bg-primary-soft text-primary flex size-12 shrink-0 items-center justify-center rounded-lg">
            <Clock3 className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-sm">Attendance</p>
            <p className={cn("mt-0.5 text-lg font-semibold", !checkedIn && "text-primary")}>
              {attendanceStatus}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {todayShift
                ? `${todayShift.shiftName ?? todayShift.dayType} · ${formatTime(todayShift.scheduledStartAt)} – ${formatTime(todayShift.scheduledEndAt)}`
                : "No published shift today"}
            </p>
            {visibleAttendanceBlockedReason ? (
              <p
                className="mt-1 text-xs text-amber-700"
                role="status"
                data-testid="check-in-blocked-reason"
              >
                {visibleAttendanceBlockedReason}
                {punchReadiness?.setupHref ? (
                  <>
                    {" "}
                    <Link
                      className="font-medium underline underline-offset-2"
                      href={punchReadiness.setupHref}
                    >
                      Open my calendar
                    </Link>
                  </>
                ) : null}
              </p>
            ) : null}
          </div>
          {canCheckIn ? (
            <Button
              type="button"
              className="h-11 min-w-32 rounded-md"
              onClick={() => checkIn.mutate()}
              disabled={checkIn.isPending || isFetching}
              title="Check in for today"
            >
              <LogIn className="size-4" aria-hidden="true" />
              {checkIn.isPending ? "Checking in…" : "Check in"}
            </Button>
          ) : canCheckOut ? (
            <Button
              type="button"
              className="h-11 min-w-36 rounded-md sm:h-10"
              onClick={() => checkOut.mutate()}
              disabled={checkOut.isPending || isFetching}
              title="Check out for today"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {checkOut.isPending ? "Checking out…" : "Check out"}
            </Button>
          ) : (
            <div
              className="bg-muted text-muted-foreground flex min-h-10 min-w-36 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium"
              role="status"
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {checkedOut ? "Completed" : "Unavailable"}
            </div>
          )}
        </div>

        {projectsEnabled ? (
          <>
            <SummaryLink
              href="/my-workspace/projects"
              icon={ListChecks}
              iconClassName="bg-information-soft text-information-foreground"
              label="My tasks"
              value={projectTasksQuery.isError || projectTasksQuery.isLoading ? "—" : dueThisWeek}
              detail={
                projectTasksQuery.isError
                  ? "Could not load"
                  : projectTasksQuery.isLoading
                    ? "Loading…"
                    : "due this week"
              }
            />
            <SummaryLink
              href="/my-workspace/projects"
              icon={FolderKanban}
              iconClassName="bg-brand-secondary-soft text-brand-secondary-strong"
              label="My projects"
              value={
                projectTasksQuery.isError || projectTasksQuery.isLoading ? "—" : assignedProjects
              }
              detail={
                projectTasksQuery.isError
                  ? "Could not load"
                  : projectTasksQuery.isLoading
                    ? "Loading…"
                    : "assigned projects"
              }
            />
          </>
        ) : null}
      </section>

      {errorMessage ? <p className="text-destructive text-sm">{errorMessage}</p> : null}

      <div className="grid gap-4 xl:grid-cols-5">
        <section
          className={cn(panelClass, "min-w-0 overflow-hidden xl:col-span-3")}
          aria-labelledby="todays-work-heading"
          role="region"
        >
          <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2
                id="todays-work-heading"
                className="flex items-center gap-2 text-base font-semibold"
              >
                <CalendarDays className="text-primary size-[18px] shrink-0" aria-hidden="true" />
                Today&apos;s work
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Your schedule and priority work for today.
              </p>
            </div>
            <Link
              href="/my-workspace/calendar"
              className="text-primary flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
            >
              View calendar <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </div>

          <div role="table" aria-label="Today's work items">
            <div
              className="bg-muted/35 text-muted-foreground hidden grid-cols-[120px_minmax(0,1.5fr)_minmax(120px,1fr)_110px] gap-3 px-4 py-2 text-xs md:grid"
              role="row"
            >
              <span role="columnheader">Time</span>
              <span role="columnheader">Task or event</span>
              <span role="columnheader">Project or module</span>
              <span role="columnheader">Status</span>
            </div>
            {(todayWorkPlan?.items ?? []).length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle2 className="text-success mx-auto size-6" aria-hidden="true" />
                <p className="mt-2 text-sm font-medium">No work scheduled</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  No work-plan items scheduled for today.
                </p>
              </div>
            ) : (
              todayWorkPlan?.items.slice(0, 6).map((item) => {
                const projectName = projectForWorkItem(item.title, projectTasks);
                return (
                  <div
                    key={item.id}
                    role="row"
                    className="border-border grid gap-2 border-t px-4 py-3 first:border-t-0 md:grid-cols-[120px_minmax(0,1.5fr)_minmax(120px,1fr)_110px] md:items-center md:gap-3 md:py-2.5"
                  >
                    <span className="text-muted-foreground text-xs md:text-sm" role="cell">
                      {item.plannedStartTime || item.plannedEndTime
                        ? `${formatTime(item.plannedStartTime)} – ${formatTime(item.plannedEndTime)}`
                        : "Today"}
                    </span>
                    <span className="text-sm font-medium" role="cell">
                      {item.title}
                    </span>
                    <span className="text-muted-foreground text-xs md:text-sm" role="cell">
                      {projectName ?? "—"}
                    </span>
                    <span role="cell">
                      <StatusBadge
                        label={readableStatus(item.status)}
                        tone={workStatusTone(item.status)}
                        showDot={false}
                      />
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section
          className={cn(panelClass, "min-w-0 overflow-hidden xl:col-span-2")}
          aria-labelledby="attention-heading"
        >
          <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-3">
            <div>
              <h2
                id="attention-heading"
                className="flex items-center gap-2 text-base font-semibold"
              >
                <AlertCircle className="text-primary size-[18px] shrink-0" aria-hidden="true" />
                Needs your attention
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Follow up on items that need action.
              </p>
            </div>
            <span className="text-muted-foreground text-xs">
              {attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {attentionItems.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <CheckCircle2 className="text-success mx-auto size-6" aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">Nothing needs action</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Your current workday records are clear.
              </p>
            </div>
          ) : (
            <div>
              {attentionItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="border-border flex flex-col gap-3 border-t px-4 py-3 first:border-t-0 sm:flex-row sm:items-center"
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        attentionToneClasses[item.tone]
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-muted-foreground mt-0.5 text-xs">{item.detail}</p>
                    </div>
                    <div className="shrink-0 sm:ml-auto">{item.action}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <section
          className={cn(panelClass, "p-4")}
          aria-labelledby="quick-self-service-heading"
        >
          <div className="mb-3">
            <h2
              id="quick-self-service-heading"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <Zap className="text-primary size-[18px] shrink-0" aria-hidden="true" />
              Quick self-service
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Shortcuts for common employee actions.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((item) => (
              <QuickAction key={item.label} {...item} />
            ))}
          </div>
        </section>

        <section
          className={cn(panelClass, "overflow-hidden bg-white dark:bg-card")}
          aria-labelledby="personal-records-heading"
        >
          <div className="px-4 py-3">
            <h2
              id="personal-records-heading"
              className="flex items-center gap-2 text-base font-semibold"
            >
              <FileText className="text-primary size-[18px] shrink-0" aria-hidden="true" />
              Personal records
            </h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Your assets, payslips, and holiday selections.
            </p>
          </div>
          <div className="border-border border-t">
            {assetEnabled ? (
              <PersonalRecordRow
                id="personal-records-assets"
                icon={Laptop}
                iconClassName="text-cyan-600 dark:text-cyan-400"
                label="My assets & licences"
                loading={assetsQuery.isLoading}
                detail={
                  assetsQuery.isLoading
                    ? "Loading records"
                    : assetsQuery.isError
                      ? "Could not load"
                      : `${assignedAssetCount} assigned · ${assetSummary?.acknowledgementPending ?? 0} acknowledgement needed`
                }
                open={openRecord === "assets"}
                onToggle={() =>
                  setOpenRecord((current) => (current === "assets" ? null : "assets"))
                }
              >
                <MyAssetsCard embedded />
              </PersonalRecordRow>
            ) : null}
            {payslipsEnabled ? (
              <PersonalRecordRow
                id="personal-records-payslips"
                icon={ReceiptText}
                iconClassName="text-emerald-600 dark:text-emerald-400"
                label="Payslips"
                loading={payslipsQuery.isLoading}
                detail={
                  payslipsQuery.isLoading
                    ? "Loading payslips"
                    : payslipsQuery.isError
                      ? "Could not load"
                      : payslipPeriod
                        ? `${payslipPeriod} payslip ${latestPayslip?.status === "AVAILABLE" ? "available" : readableStatus(latestPayslip?.status ?? "")}`
                        : "No payslips available"
                }
                open={openRecord === "payslips"}
                onToggle={() =>
                  setOpenRecord((current) => (current === "payslips" ? null : "payslips"))
                }
              >
                <MyPayslipsCard embedded />
              </PersonalRecordRow>
            ) : null}
            {optionalCatalog || optionalHolidaysQuery.isLoading || optionalHolidaysQuery.isError ? (
              <PersonalRecordRow
                id="personal-records-holidays"
                icon={CalendarDays}
                iconClassName="text-violet-600 dark:text-violet-400"
                label="Optional holidays"
                loading={optionalHolidaysQuery.isLoading}
                detail={
                  optionalHolidaysQuery.isError
                    ? "Could not load"
                    : optionalCatalog
                      ? `${optionalCatalog.selectedCount} of ${optionalCatalog.optionalAllowance} selected`
                      : "Loading selections"
                }
                open={openRecord === "holidays"}
                onToggle={() =>
                  setOpenRecord((current) => (current === "holidays" ? null : "holidays"))
                }
              >
                <OptionalHolidaySelectionCard embedded />
              </PersonalRecordRow>
            ) : null}
          </div>
        </section>
      </div>

      <SubmitOvertimeSheet
        open={overtimeOpen}
        onOpenChange={setOvertimeOpen}
        request={overtimeTarget}
      />
      <SubmitRegularizationSheet
        open={regularizeOpen}
        onOpenChange={setRegularizeOpen}
        exception={
          regularizeTarget
            ? {
                id: regularizeTarget.id,
                type: regularizeTarget.type,
                businessDate: regularizeTarget.businessDate,
                attendanceId:
                  regularizeTarget.attendanceId ?? regularizeTarget.attendance?.id ?? "",
                status: regularizeTarget.status,
              }
            : null
        }
        onSubmit={async (input) => {
          await submitMyRegularization.mutateAsync(input);
          await exceptionsQuery.refetch();
        }}
      />
    </div>
  );
}
