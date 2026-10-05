"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Info,
  Loader2,
  Send,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useCreateMyLeaveRequest,
  useLeaveTypes,
  useMyCompOff,
  usePreviewMyLeaveRequest,
} from "../hooks/use-my-workspace";
import type { MyLeavePreview } from "../types";

interface ApplyLeaveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFromDate?: string;
  defaultToDate?: string;
}

function formatDay(dateKey: string) {
  return new Date(`${dateKey.slice(0, 10)}T00:00:00Z`).toLocaleDateString(
    undefined,
    { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" },
  );
}

function StepProgress({ currentStep }: { currentStep: 1 | 2 }) {
  return (
    <ol aria-label="Leave application progress" className="grid grid-cols-2 gap-3 border-b pb-4">
      {([1, 2] as const).map((step) => {
        const active = currentStep === step;
        const complete = currentStep > step;
        return (
          <li
            key={step}
            aria-current={active ? "step" : undefined}
            className={cn(
              "relative flex items-center gap-2.5 pb-2 text-sm font-medium after:absolute after:inset-x-0 after:-bottom-4 after:h-0.5 after:bg-transparent",
              active && "text-primary after:bg-primary",
              complete && "text-emerald-700 after:bg-emerald-500",
              !active && !complete && "text-muted-foreground",
            )}
          >
            <span
              className={cn(
                "border-input bg-background flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                active && "border-primary bg-primary text-primary-foreground",
                complete && "border-emerald-500 bg-emerald-500 text-white",
              )}
            >
              {complete ? <CheckCircle2 className="size-4" aria-hidden="true" /> : step}
            </span>
            <span>{step === 1 ? "Details" : "Preview & submit"}</span>
          </li>
        );
      })}
    </ol>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-md">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      <span>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <span className="text-muted-foreground mt-0.5 block text-xs">{description}</span> : null}
      </span>
    </div>
  );
}

function ChoiceCard({
  name,
  label,
  checked,
  onSelect,
  compact = false,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "border-input bg-card relative flex cursor-pointer gap-3 rounded-md border p-2 transition-colors",
        compact ? "items-center p-2.5" : "items-start",
        checked && "border-primary bg-primary/5 ring-primary/10 ring-1",
      )}
    >
      <input
        type="radio"
        name={name}
        aria-label={label}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
      </span>
      <span
        className={cn(
          "border-input mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
          checked && "border-primary",
        )}
        aria-hidden="true"
      >
        {checked ? <span className="bg-primary size-2 rounded-full" /> : null}
      </span>
    </label>
  );
}

export function ApplyLeaveSheet({
  open,
  onOpenChange,
  defaultFromDate = "",
  defaultToDate = "",
}: ApplyLeaveSheetProps) {
  const { data: leaveTypes = [], isLoading } = useLeaveTypes();
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate || defaultFromDate);
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [reason, setReason] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [localError, setLocalError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    key: string;
    value: MyLeavePreview;
  } | null>(null);
  const previewMutation = usePreviewMyLeaveRequest();
  const createMutation = useCreateMyLeaveRequest(() => {
    /* keep sheet open briefly to show match confirmation via toast */
  });

  const selectedType = leaveTypes.find((type) => type.id === leaveTypeId);
  const isCompOffType = selectedType?.category === "COMP_OFF";
  const compOffQuery = useMyCompOff(open && isCompOffType);
  const activeTypes = leaveTypes.filter((type) => type.isActive !== false);
  const canPreview = Boolean(leaveTypeId && fromDate && toDate);
  const previewKey = `${leaveTypeId}:${fromDate}:${toDate}:${isHalfDay}`;
  const preview =
    open && canPreview && previewResult?.key === previewKey
      ? previewResult.value
      : null;

  const compOffCredits = useMemo(() => {
    const rows = compOffQuery.data ?? [];
    return rows.filter(
      (row) =>
        Number(row.availableDays) > 0 &&
        row.status.toUpperCase() === "AVAILABLE",
    );
  }, [compOffQuery.data]);

  const totalCompOffAvailable = compOffCredits.reduce(
    (sum, row) => sum + Number(row.availableDays || 0),
    0,
  );

  function reset() {
    setLeaveTypeId("");
    setFromDate(defaultFromDate);
    setToDate(defaultToDate || defaultFromDate);
    setIsHalfDay(false);
    setReason("");
    setCurrentStep(1);
    setLocalError(null);
    setPreviewResult(null);
  }

  useEffect(() => {
    if (!open || !canPreview) {
      return;
    }
    let cancelled = false;
    const requestKey = previewKey;
    const timer = window.setTimeout(() => {
      void previewMutation
        .mutateAsync({
          leaveTypeId,
          fromDate,
          toDate,
          isHalfDay,
        })
        .then((result) => {
          if (cancelled) return;
          setPreviewResult({ key: requestKey, value: result });
          setLocalError(null);
        })
        .catch((error) => {
          if (cancelled) return;
          setPreviewResult(null);
          setLocalError(
            getApiErrorMessage(error, "Could not preview leave days."),
          );
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounce on field changes only
  }, [open, leaveTypeId, fromDate, toDate, isHalfDay, canPreview]);

  function handleReview() {
    setLocalError(null);

    if (!leaveTypeId || !fromDate || !toDate) {
      setLocalError("Leave type and dates are required.");
      return;
    }
    if (!preview) {
      setLocalError("Wait for the leave preview before continuing.");
      return;
    }
    if (!preview.canSubmit) {
      setLocalError(preview.blockReason || "This leave cannot be submitted.");
      return;
    }
    setCurrentStep(2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLocalError(null);

    if (currentStep !== 2 || !preview || !preview.canSubmit) {
      setLocalError(preview?.blockReason || "Review the leave request before submitting.");
      return;
    }

    try {
      const created = (await createMutation.mutateAsync({
        leaveTypeId,
        fromDate,
        toDate,
        isHalfDay,
        reason: reason.trim() || undefined,
        submitNow: true,
      })) as { requestedDays?: number | string };
      const days = Number(created.requestedDays ?? preview?.requestedWorkingDays);
      toast.success(`Leave submitted · ${days} working day${days === 1 ? "" : "s"} (matches preview).`);
      reset();
      onOpenChange(false);
    } catch (error) {
      setLocalError(getApiErrorMessage(error, "Could not create leave request."));
    }
  }

  const reviewDisabled =
    isLoading ||
    !canPreview ||
    previewMutation.isPending ||
    !preview ||
    !preview.canSubmit;
  const submitDisabled =
    createMutation.isPending ||
    !preview ||
    !preview.canSubmit;

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title="Apply leave"
      description="Choose details, preview impact, and submit your request."
      size="md"
      bodyClassName="px-5 py-4 sm:px-5 sm:py-4"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <Info className="size-4 shrink-0" aria-hidden="true" />
            {currentStep === 1
              ? "Your request will be sent for approval after review."
              : "Confirm the calculated days before submitting."}
          </p>
          <div className="flex justify-end gap-2">
            {currentStep === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={reviewDisabled}
                  onClick={(event) => {
                    event.preventDefault();
                    handleReview();
                  }}
                  title={
                    preview?.blockReason ||
                    (!canPreview
                      ? "Choose leave type and dates first"
                      : previewMutation.isPending
                        ? "Waiting for leave preview"
                        : "Review this leave request")
                  }
                >
                  {previewMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                  Review request
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLocalError(null);
                    setCurrentStep(1);
                  }}
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back
                </Button>
                <Button
                  type="submit"
                  form="apply-leave-form"
                  disabled={submitDisabled}
                  title={preview?.blockReason || "Submit for manager approval"}
                >
                  {createMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Send className="size-4" aria-hidden="true" />
                  )}
                  {createMutation.isPending ? "Submitting…" : "Submit request"}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <form id="apply-leave-form" className="space-y-4" onSubmit={handleSubmit}>
        <StepProgress currentStep={currentStep} />

        {currentStep === 1 ? (
          <div className="space-y-5">
            <section className="space-y-3" aria-labelledby="leave-details-heading">
              <div id="leave-details-heading">
                <SectionHeading
                  icon={CalendarDays}
                  title="Leave details"
                  description="Select a leave type and the dates you need."
                />
              </div>
              <div className="space-y-3 pl-12">
            <div className="space-y-2">
              <Label htmlFor="leaveTypeId">Leave type</Label>
              <select
                id="leaveTypeId"
                className="border-input bg-card h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 max-sm:h-11"
                value={leaveTypeId}
                disabled={isLoading}
                onChange={(event) => {
                  const nextTypeId = event.target.value;
                  setLeaveTypeId(nextTypeId);
                  if (!activeTypes.find((type) => type.id === nextTypeId)?.allowHalfDay) setIsHalfDay(false);
                }}
                required
              >
                <option value="">{isLoading ? "Loading leave types…" : "Select leave type"}</option>
                {activeTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.leaveName} ({type.leaveCode})
                    {type.category === "COMP_OFF" ? " · Comp-off" : ""}
                  </option>
                ))}
              </select>
              {activeTypes.length === 0 && !isLoading ? (
                <div role="status" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                  No leave types are available right now.
                </div>
              ) : null}
            </div>

            {isCompOffType ? (
              <div className="border-border bg-muted/30 space-y-2 rounded-md border p-3 text-sm">
                <p className="font-medium">Comp-off credits</p>
                {compOffQuery.isLoading ? (
                  <p className="text-muted-foreground flex items-center gap-2 text-xs"><Loader2 className="size-3.5 animate-spin" aria-hidden="true" />Loading credits…</p>
                ) : totalCompOffAvailable > 0 ? (
                  <>
                    <p><strong>{totalCompOffAvailable}</strong> day{totalCompOffAvailable === 1 ? "" : "s"} available</p>
                    <ul className="text-muted-foreground space-y-1 text-xs">
                      {compOffCredits.slice(0, 5).map((row) => (
                        <li key={row.id}>
                          {Number(row.availableDays)} day{Number(row.availableDays) === 1 ? "" : "s"} · earned {formatDay(row.sourceDate)} · expires {formatDay(row.expiresOn)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-amber-800 text-xs">No Comp-off credits are available.</p>
                )}
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fromDate">From</Label>
                <Input id="fromDate" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="toDate">To</Label>
                <Input id="toDate" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required />
              </div>
            </div>

            {selectedType?.allowHalfDay ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Day length</legend>
                <div className="grid grid-cols-2 gap-2">
                  <ChoiceCard name="day-length" label="Full day" checked={!isHalfDay} onSelect={() => setIsHalfDay(false)} compact />
                  <ChoiceCard name="day-length" label="Half day" checked={isHalfDay} onSelect={() => setIsHalfDay(true)} compact />
                </div>
                <p className="text-muted-foreground text-xs">Half-day leave applies to one date.</p>
              </fieldset>
            ) : null}
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="request-note-heading">
              <div id="request-note-heading">
                <SectionHeading
                  icon={Info}
                  title="Request note (optional)"
                  description="Add context for your manager."
                />
              </div>
              <div className="pl-12">
                <Label htmlFor="reason" className="sr-only">Request note (optional)</Label>
                <Textarea
                  id="reason"
                  rows={3}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Add a note for your manager (optional)"
                  className="min-h-20 resize-y"
                />
              </div>
            </section>

            {canPreview && previewMutation.isPending ? (
              <div role="status" className="text-muted-foreground flex items-center gap-2 rounded-md border px-3 py-2.5 text-xs">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Calculating leave impact…
              </div>
            ) : null}
          </div>
        ) : (

          <section className="space-y-4" aria-labelledby="leave-preview-heading">
            <div id="leave-preview-heading">
              <SectionHeading
                icon={CalendarCheck2}
                title="Preview & submit"
                description="Confirm these details before sending your request for approval."
              />
            </div>

            <dl className="grid gap-x-4 gap-y-3 rounded-md border p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground text-xs">Leave type</dt>
                <dd className="mt-1 font-medium">
                  {selectedType ? `${selectedType.leaveName} (${selectedType.leaveCode})` : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Date or range</dt>
                <dd className="mt-1 font-medium">
                  {fromDate === toDate ? formatDay(fromDate) : `${formatDay(fromDate)} – ${formatDay(toDate)}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Day length</dt>
                <dd className="mt-1 font-medium">{isHalfDay ? "Half day" : "Full day"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Request note</dt>
                <dd className="mt-1 font-medium">{reason.trim() || "No note added"}</dd>
              </div>
            </dl>

            <div className="space-y-4 rounded-md border p-4 text-sm">
              <div className="flex items-start gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Ready to submit</p>
                  <p className="mt-0.5 text-xs">This request passed the current leave checks.</p>
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x text-center">
                <div className="px-2">
                  <p className="text-muted-foreground text-xs">Working days</p>
                  <p className="mt-1 text-xl font-semibold">{preview?.requestedWorkingDays ?? 0}</p>
                  <p className="text-muted-foreground text-xs">day{preview?.requestedWorkingDays === 1 ? "" : "s"}</p>
                </div>
                <div className="px-2">
                  <p className="text-muted-foreground text-xs">Excluded</p>
                  <p className="mt-1 text-xl font-semibold">
                    {(preview?.excludedHolidays.length ?? 0) + (preview?.excludedNonWorkingDays.length ?? 0)}
                  </p>
                  <p className="text-muted-foreground text-xs">holidays/week-offs</p>
                </div>
                <div className="px-2">
                  <p className="text-muted-foreground text-xs">Balance after request</p>
                  <p className="mt-1 text-xl font-semibold">
                    {preview?.balance ? `${preview.balance.afterSubmit.available} days` : "—"}
                  </p>
                  {!preview?.balance ? <p className="text-muted-foreground text-xs">not available</p> : null}
                </div>
              </div>

              {preview && (preview.excludedHolidays.length || preview.excludedNonWorkingDays.length) ? (
                <p className="text-muted-foreground border-t pt-3 text-xs">
                  Excluded: {[
                    ...preview.excludedHolidays.map((date) => `${formatDay(date)} holiday`),
                    ...preview.excludedNonWorkingDays.map((date) => `${formatDay(date)} week-off`),
                  ].join(", ")}
                </p>
              ) : null}

              {isCompOffType ? (
                <div className="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-xs">
                  <span className="font-medium">Comp-off credit</span>
                  <span className="text-muted-foreground">
                    {totalCompOffAvailable > 0 ? `${totalCompOffAvailable} days available` : "No credit available"}
                  </span>
                </div>
              ) : null}
            </div>
          </section>
        )}

        {localError || createMutation.error ? (
          <div role="alert" className="border-destructive/20 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{localError || getApiErrorMessage(createMutation.error, "Request failed.")}</span>
          </div>
        ) : null}
      </form>
    </FormSheet>
  );
}
