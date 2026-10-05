"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Briefcase,
  Clock3,
  LoaderCircle,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyService } from "@/features/company/services/company-service";
import { DesignationService } from "@/features/designation/services/designation-service";
import { ShiftService } from "@/features/shift/services/shift-service";
import { getApiErrorMessage } from "@/services/api-client";
import { cn } from "@/lib/utils";

import { getOnboardingHubProgress } from "../hub-progress";
import type { OrganizationOnboardingStatus } from "../types";

type OptionalAction = "designation" | "shift" | "tax" | null;

interface OptionalSetupSectionProps {
  status: OrganizationOnboardingStatus;
}

export function OptionalSetupSection({ status }: OptionalSetupSectionProps) {
  const progress = getOnboardingHubProgress(status);
  const [action, setAction] = useState<OptionalAction>(null);
  const companyId = status.company?.id;

  return (
    <section className="rounded-[10px] border border-[#E8ECF1] bg-[#F8F9FB] px-2.5 py-2.5 sm:px-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#D5DAE2] text-[#5C6675]">
          <span className="text-[10px] font-bold">···</span>
        </span>
        <h3 className="text-[14px] font-semibold text-[#101A33]">
          Additional setup
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <OptionalCard
          icon={<Users className="size-4" aria-hidden="true" />}
          title="Invite your team later"
          description="Not part of this setup. After you open the workspace, invite people from Administration → Users."
          statusLabel="Next steps"
          done={false}
        />
        <OptionalCard
          icon={<Briefcase className="size-4" aria-hidden="true" />}
          title="Designations"
          description="Job titles for your organization structure. One is required for the founding owner."
          statusLabel={
            progress.hasDesignations ? "Added" : "Required for owner"
          }
          done={progress.hasDesignations}
          actionLabel={
            companyId && !progress.hasDesignations ? "Add now" : undefined
          }
          onAction={
            companyId && !progress.hasDesignations
              ? () => setAction("designation")
              : undefined
          }
        />
        <OptionalCard
          icon={<Clock3 className="size-4" aria-hidden="true" />}
          title="Shifts"
          description="Default working hours for attendance."
          statusLabel={progress.hasShifts ? "Added" : "Add later"}
          done={progress.hasShifts}
          actionLabel={companyId && !progress.hasShifts ? "Add now" : undefined}
          onAction={
            companyId && !progress.hasShifts
              ? () => setAction("shift")
              : undefined
          }
        />
        <OptionalCard
          icon={<BadgeDollarSign className="size-4" aria-hidden="true" />}
          title="Tax information"
          description="Company tax number for compliance records."
          statusLabel={progress.hasTax ? "Added" : "Add later"}
          done={progress.hasTax}
          actionLabel={companyId ? (progress.hasTax ? "Edit" : "Add now") : undefined}
          onAction={companyId ? () => setAction("tax") : undefined}
        />
      </div>

      {companyId ? (
        <>
          {action === "designation" ? (
            <DesignationDialog
              open
              onOpenChange={(open) => !open && setAction(null)}
              companyId={companyId}
            />
          ) : null}
          {action === "shift" ? (
            <ShiftDialog
              open
              onOpenChange={(open) => !open && setAction(null)}
              companyId={companyId}
            />
          ) : null}
          {action === "tax" ? (
            <TaxDialog
              key={`${status.company?.id ?? ""}:${status.company?.taxNumber ?? ""}`}
              open
              onOpenChange={(open) => !open && setAction(null)}
              status={status}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function OptionalCard({
  icon,
  title,
  description,
  statusLabel,
  done,
  actionLabel,
  onAction,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  done: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[10px] border border-[#E8ECF1] bg-white p-3 shadow-[0_4px_12px_rgba(16,26,51,0.03)]">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F3F6FA] text-[#71829A]">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[#101A33]">{title}</p>
          <p className="mt-1 text-[12px] leading-snug text-[#7D8798]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span
          className={cn(
            "text-[12px] font-medium",
            done ? "text-[#22A06B]" : "text-[#9AA3B2]",
          )}
        >
          {statusLabel}
        </span>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="text-[12px] font-semibold text-[#4B8DFF] hover:underline"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DesignationDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Designation name must be at least 2 characters.");
      }
      await DesignationService.create({
        companyId,
        designationName: trimmed,
      });
    },
    onSuccess: async () => {
      toast.success("Designation added.");
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["organization-onboarding"],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add designation</DialogTitle>
          <DialogDescription>
            Add the job title you will select for the founding owner. You can
            add more designations later from the workspace.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="hub-designation-name">
              Designation name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-designation-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="For example, Manager"
              minLength={2}
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ShiftDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("General");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 1) {
        throw new Error("Shift name is required.");
      }
      await ShiftService.create({
        companyId,
        shiftName: trimmed,
        startTime,
        endTime,
        breakMinutes: 60,
        graceInMinutes: 15,
        graceOutMinutes: 15,
        isNightShift: false,
        isDefault: true,
        isActive: true,
        remarks: "",
      });
    },
    onSuccess: async () => {
      toast.success("Shift added.");
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["organization-onboarding"],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add default shift</DialogTitle>
          <DialogDescription>
            Optional. You can refine shifts later in workforce settings.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="hub-shift-name">
              Shift name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-shift-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hub-shift-start">Start</Label>
              <Input
                id="hub-shift-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-shift-end">End</Label>
              <Input
                id="hub-shift-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaxDialog({
  open,
  onOpenChange,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OrganizationOnboardingStatus;
}) {
  const queryClient = useQueryClient();
  const company = status.company!;
  const [taxNumber, setTaxNumber] = useState(company.taxNumber ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      await CompanyService.update(company.id, {
        companyName: company.companyName,
        registrationNo: company.registrationNo,
        taxNumber: taxNumber.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Tax information saved.");
      onOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["organization-onboarding"],
      });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tax information</DialogTitle>
          <DialogDescription>
            Optional. You can update tax details anytime from company settings.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="hub-tax-number">Tax number</Label>
            <Input
              id="hub-tax-number"
              value={taxNumber}
              onChange={(event) => setTaxNumber(event.target.value)}
              placeholder="Enter tax / VAT number"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
