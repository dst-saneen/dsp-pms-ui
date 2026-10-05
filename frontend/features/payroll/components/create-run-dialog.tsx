"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage } from "@/services/api-client";

import { useCreatePayrollRun, usePayrollPreflight } from "../hooks";
import { summarizePayrollWarnings } from "../lib/preflight-copy";

interface CreateRunDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function uniqueByCode<T extends { code: string; message: string }>(rows: T[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}

type FixCard = {
  key: string;
  title: string;
  meaning: string;
  href: string;
  linkLabel: string;
  how: string;
};

export function CreateRunDialog({ open, onOpenChange }: CreateRunDialogProps) {
  const router = useRouter();
  const create = useCreatePayrollRun();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [remarks, setRemarks] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAllWarnings, setShowAllWarnings] = useState(false);
  const preflight = usePayrollPreflight(year, month, open);

  const blockers = useMemo(
    () => uniqueByCode(preflight.data?.blockers ?? []),
    [preflight.data?.blockers]
  );
  const warnings = useMemo(() => preflight.data?.warnings ?? [], [preflight.data?.warnings]);
  const eligible = preflight.data?.eligibleEmployeeCount ?? 0;
  const createBlocked =
    preflight.isLoading ||
    preflight.isError ||
    blockers.length > 0 ||
    (preflight.data != null && eligible === 0);
  const createBlockReason = preflight.isLoading
    ? "Waiting for checklist…"
    : preflight.isError
      ? "Readiness check failed. Retry before creating a run."
      : blockers.length > 0
        ? `Fix ${blockers.length} red item(s) first`
        : eligible === 0
          ? "No employees ready for this month."
          : undefined;

  const fixCards = useMemo(() => {
    const cards: FixCard[] = [];
    const codes = blockers.map((row) => row.code);

    if (codes.some((code) => code.includes("FINANCE") || code.includes("PAYMENT"))) {
      cards.push({
        key: "finance",
        title: "1. Office Finance link",
        meaning:
          "Payroll needs a place to post salary cost later. Your finance profile is missing the Payroll Expense link.",
        href: "/office-finance/setup?tab=categories",
        linkLabel: "Open Categories",
        how: "Create Expense category “Payroll Expense” → Profile → set Payroll expense category to that → keep Petty Cash/Bank + an OPEN period.",
      });
    }

    if (codes.some((code) => code.includes("ATTENDANCE"))) {
      cards.push({
        key: "attendance",
        title: `${cards.length + 1}. Attendance month not ready`,
        meaning:
          "Payroll only runs when attendance for that month is finished enough (PAYROLL_PENDING or CLOSED).",
        href: "/hr/attendance/periods",
        linkLabel: "Open Attendance Periods",
        how: `For ${year}-${String(month).padStart(2, "0")}, move each applicable branch period to PAYROLL_PENDING or CLOSED.`,
      });
    }

    if (codes.includes("SALARY_REVISION_OVERLAP")) {
      cards.push({
        key: "salary-overlap",
        title: `${cards.length + 1}. Salary dates overlap`,
        meaning:
          "Someone has two salary packages covering the same days. Review the revision dates before calculating payroll.",
        href: "/hr/payroll?tab=salaries",
        linkLabel: "Open Employee Salaries",
        how: "Pick the employee and review the dated revisions. End a current package only on its real last effective date; historical data corrections require an administrator.",
      });
    }

    return cards;
  }, [blockers, month, year]);

  const warningSummary = useMemo(() => summarizePayrollWarnings(warnings), [warnings]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (createBlocked) return;
    setError(null);
    try {
      const run = await create.mutateAsync({
        year,
        month,
        remarks: remarks.trim() || undefined,
        operationId: createOperationId(),
      });
      onOpenChange(false);
      router.push(`/hr/payroll/runs/${run.id}`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create payroll run."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New payroll run"
      description="A run = pay everyone for one month. Fix only the red checklist below — yellow warnings are optional."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-payroll-run"
            disabled={create.isPending || createBlocked}
            title={createBlockReason}
          >
            {create.isPending ? "Creating…" : "Create run"}
          </Button>
        </div>
      }
    >
      <form id="create-payroll-run" onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="run-year">Year</Label>
            <Input
              id="run-year"
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="run-month">Month</Label>
            <Input
              id="run-month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          Selected pay period:{" "}
          <strong>
            {year}-{String(month).padStart(2, "0")}
          </strong>
          .
        </p>
        <div className="space-y-2">
          <Label htmlFor="run-remarks">Remarks (optional)</Label>
          <Input
            id="run-remarks"
            value={remarks}
            placeholder="Optional note for this run"
            onChange={(event) => setRemarks(event.target.value)}
          />
        </div>

        {preflight.isLoading ? (
          <p className="text-muted-foreground text-sm">Checking readiness…</p>
        ) : null}

        {preflight.isError ? (
          <div className="border-destructive/40 bg-destructive/5 space-y-2 rounded-lg border p-3 text-sm">
            <p className="text-destructive font-medium">Readiness check unavailable</p>
            <p className="text-muted-foreground text-xs">
              Payroll readiness could not be verified. Retry before creating a run.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void preflight.refetch()}
            >
              Retry readiness check
            </Button>
          </div>
        ) : null}

        {preflight.data ? (
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            <div>
              <p className="font-medium">Ready check</p>
              <p className="text-muted-foreground text-xs">
                {eligible} people can be included this month.
              </p>
            </div>

            {fixCards.length > 0 ? (
              <div className="space-y-3">
                <p className="text-destructive text-xs font-medium">
                  Stop — fix these {fixCards.length} item(s), then Create turns on
                </p>
                {fixCards.map((card) => (
                  <div
                    key={card.key}
                    className="border-destructive/30 bg-destructive/5 space-y-1 rounded-md border px-3 py-2"
                  >
                    <p className="text-sm font-medium">{card.title}</p>
                    <p className="text-muted-foreground text-xs">{card.meaning}</p>
                    <p className="text-xs">
                      <strong>Do this:</strong> {card.how}
                    </p>
                    <Link href={card.href} className="text-xs font-medium underline">
                      {card.linkLabel}
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-emerald-700">
                All required checks passed. You can Create run now.
              </p>
            )}

            {warningSummary.total > 0 ? (
              <div className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                <p className="text-xs font-medium text-amber-900">
                  Yellow notes ({warningSummary.total}) — do not block Create
                </p>
                <ul className="text-muted-foreground list-inside list-disc text-xs">
                  {warningSummary.noSalary > 0 ? (
                    <li>
                      {warningSummary.noSalary} employee(s) have no salary for this month and will
                      not be included until a revision is added.
                    </li>
                  ) : null}
                  {warningSummary.noTax > 0 ? (
                    <li>
                      {warningSummary.noTax} employee(s) have no tax profile (tax remains zero until
                      a profile is added).
                    </li>
                  ) : null}
                  {warningSummary.other > 0 ? <li>{warningSummary.other} other note(s).</li> : null}
                </ul>
                <button
                  type="button"
                  className="text-xs underline"
                  onClick={() => setShowAllWarnings((value) => !value)}
                >
                  {showAllWarnings ? "Hide full list" : "Show full list"}
                </button>
                {showAllWarnings
                  ? warnings.map((warning, index) => (
                      <p
                        key={`${warning.code}-${warning.entityId ?? index}`}
                        className="text-xs text-amber-900"
                      >
                        {warning.message}
                      </p>
                    ))
                  : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
