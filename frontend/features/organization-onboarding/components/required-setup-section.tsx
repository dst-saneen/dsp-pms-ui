"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  MapPin,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BranchService } from "@/features/branch/services/branch-service";
import { DepartmentService } from "@/features/department/services/department-service";
import { getApiErrorMessage } from "@/services/api-client";
import { cn } from "@/lib/utils";

import { getOnboardingHubProgress } from "../hub-progress";
import { organizationOnboardingService } from "../organization-onboarding-service";
import type { OrganizationOnboardingStatus } from "../types";

const DEPARTMENT_SUGGESTIONS = [
  "Operations",
  "Administration",
  "Sales",
  "General",
] as const;

interface RequiredSetupSectionProps {
  status: OrganizationOnboardingStatus;
}

type ActionTarget = "branch" | "department" | null;

export function RequiredSetupSection({ status }: RequiredSetupSectionProps) {
  const progress = getOnboardingHubProgress(status);
  const remaining =
    Number(!progress.branchDone) + Number(!progress.departmentDone);
  const [action, setAction] = useState<ActionTarget>(null);
  const [departmentPrefill, setDepartmentPrefill] = useState<string | null>(
    null,
  );
  const companyId = status.company?.id;

  const branchesQuery = useQuery({
    queryKey: ["onboarding-branches", companyId],
    queryFn: () => BranchService.getBranches(companyId),
    enabled: Boolean(companyId),
  });

  return (
    <section className="rounded-[10px] border border-[#F8D9CE] bg-[#FFF7F4] px-2.5 py-2.5 sm:px-3">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-full text-[11px] font-bold text-white",
              remaining === 0 ? "bg-[#22A06B]" : "bg-[#F15A43]",
            )}
          >
            {remaining === 0 ? (
              <Check className="size-3.5" aria-hidden="true" />
            ) : (
              remaining
            )}
          </span>
          <h3 className="text-[14px] font-semibold text-[#101A33]">
            Finish these items
          </h3>
        </div>
      </div>

      <div className="space-y-2">
        <RequiredActionCard
          icon={<MapPin className="size-4" aria-hidden="true" />}
          iconClass="bg-[#FDE8E4] text-[#F15A43]"
          title="Confirm your main branch"
          description={
            progress.branchDone
              ? `${status.counts.branches} branch${status.counts.branches === 1 ? "" : "es"} ready.`
              : "Add the primary operating location for this company."
          }
          badge={progress.branchDone ? "Completed" : "1 detail needed"}
          badgeTone={progress.branchDone ? "success" : "needed"}
          actionLabel={progress.branchDone ? undefined : "Confirm branch"}
          onAction={
            progress.branchDone || !companyId
              ? undefined
              : () => setAction("branch")
          }
          suggestion={
            progress.branchDone
              ? undefined
              : "Suggested: Main Branch · set subdivision & timezone"
          }
        />

        <RequiredActionCard
          icon={<Users className="size-4" aria-hidden="true" />}
          iconClass="bg-[#EEE8FE] text-[#7C5CFC]"
          title="Add your first department"
          description={
            progress.departmentDone
              ? `${status.counts.departments} department${status.counts.departments === 1 ? "" : "s"} ready.`
              : progress.branchDone
                ? "Create the starting department for your team."
                : "Confirm a branch first, then add a department."
          }
          badge={progress.departmentDone ? "Completed" : "Required"}
          badgeTone={progress.departmentDone ? "success" : "needed"}
          actionLabel={
            progress.departmentDone || !companyId || !progress.branchDone
              ? undefined
              : "Add department"
          }
          onAction={
            progress.departmentDone || !companyId || !progress.branchDone
              ? undefined
              : () => setAction("department")
          }
          chips={
            progress.departmentDone
              ? undefined
              : [...DEPARTMENT_SUGGESTIONS]
          }
          onChipSelect={
            progress.departmentDone || !progress.branchDone
              ? undefined
              : (chipName) => {
                  setDepartmentPrefill(chipName);
                  setAction("department");
                }
          }
        />
      </div>

      {companyId ? (
        <>
          <BranchCreateDialog
            open={action === "branch"}
            onOpenChange={(open) => !open && setAction(null)}
            companyId={companyId}
            companyName={status.company?.companyName}
            companyCountryCode={status.company?.legalCountryCode ?? ""}
          />
          <DepartmentCreateDialog
            open={action === "department"}
            onOpenChange={(open) => {
              if (!open) {
                setAction(null);
                setDepartmentPrefill(null);
              }
            }}
            companyId={companyId}
            branches={(branchesQuery.data ?? []).filter(
              (branch) => branch.isActive,
            )}
            branchesLoading={branchesQuery.isLoading}
            initialName={departmentPrefill ?? "Operations"}
          />
        </>
      ) : (
        <p className="mt-3 text-[13px] text-[#C84E32]">
          Add a company profile before confirming branch and department.
        </p>
      )}
    </section>
  );
}

function RequiredActionCard({
  icon,
  iconClass,
  title,
  description,
  badge,
  badgeTone,
  actionLabel,
  onAction,
  suggestion,
  chips,
  onChipSelect,
}: {
  icon: ReactNode;
  iconClass: string;
  title: string;
  description: string;
  badge: string;
  badgeTone: "success" | "needed";
  actionLabel?: string;
  onAction?: () => void;
  suggestion?: string;
  chips?: string[];
  onChipSelect?: (name: string) => void;
}) {
  return (
    <div className="rounded-[10px] border border-[#E8ECF1] bg-white p-3 shadow-[0_4px_12px_rgba(16,26,51,0.03)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-[12px]",
                iconClass,
              )}
            >
              {icon}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-semibold text-[#101A33]">
                  {title}
                </p>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    badgeTone === "success"
                      ? "bg-[#E7F8EF] text-[#1F7A4D]"
                      : "bg-[#FFF1EC] text-[#C84E32]",
                  )}
                >
                  {badge}
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[#7D8798]">{description}</p>
              {suggestion ? (
                <p className="mt-2 text-[12px] font-medium text-[#9AA3B2]">
                  {suggestion}
                </p>
              ) : null}
              {chips?.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {chips.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => onChipSelect?.(chip)}
                      className="rounded-full border border-[#E2E6EE] bg-[#F8F9FB] px-2.5 py-1 text-[12px] font-medium text-[#5C6675] hover:border-[#F15A43]/40 hover:text-[#C84E32]"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {actionLabel && onAction ? (
          <Button
            type="button"
            onClick={onAction}
            className="h-10 shrink-0 rounded-[10px] bg-[#F15A43] px-4 text-[13px] font-semibold text-white hover:bg-[#E04E39]"
          >
            {actionLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BranchCreateDialog({
  open,
  onOpenChange,
  companyId,
  companyName,
  companyCountryCode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName?: string;
  companyCountryCode: string;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("Main Branch");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [countrySubdivisionCode, setCountrySubdivisionCode] = useState("");
  const [timezone, setTimezone] = useState("");

  function resetForm() {
    setName("Main Branch");
    setAddressLine1("");
    setCity("");
    setCountrySubdivisionCode("");
    setTimezone("");
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const latest = await organizationOnboardingService.status();
      if (latest.requirements.branch) {
        return { alreadyDone: true as const };
      }
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Branch name must be at least 2 characters.");
      }
      if (!companyCountryCode.trim()) {
        throw new Error("Configure the Company legal country before adding a branch.");
      }
      if (!countrySubdivisionCode.trim() || !timezone.trim()) {
        throw new Error("Country subdivision and timezone are required.");
      }
      await BranchService.create({
        companyId,
        branchName: trimmed,
        addressLine1: addressLine1.trim() || undefined,
        city: city.trim() || undefined,
        countryCode: companyCountryCode.trim().toUpperCase(),
        countrySubdivisionCode: countrySubdivisionCode.trim().toUpperCase(),
        timezone: timezone.trim(),
      });
      await organizationOnboardingService.updateStep("STRUCTURE");
      return { alreadyDone: false as const };
    },
    onSuccess: async (result) => {
      toast.success(
        result.alreadyDone
          ? "Branch was already confirmed. Continuing."
          : "Branch confirmed.",
      );
      handleOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organization-onboarding"] }),
        queryClient.invalidateQueries({ queryKey: ["onboarding-branches"] }),
      ]);
    },
    onError: (error) =>
      toast.error(
        getApiErrorMessage(
          error,
          "Could not save this branch. Fix the details below and retry.",
        ),
      ),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm main branch</DialogTitle>
          <DialogDescription>
            Add the primary physical or operating location
            {companyName ? ` for ${companyName}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="hub-branch-name">
              Branch name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-branch-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hub-branch-address">Address line 1</Label>
            <Input
              id="hub-branch-address"
              value={addressLine1}
              onChange={(event) => setAddressLine1(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hub-branch-city">City</Label>
              <Input
                id="hub-branch-city"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-branch-country">
                Company legal country
              </Label>
              <Input
                id="hub-branch-country"
                value={companyCountryCode}
                readOnly
                aria-readonly="true"
                maxLength={2}
                placeholder="Not configured"
                className="bg-muted"
                required
              />
              <p className="text-xs text-muted-foreground">
                Inherited from the Company profile.
              </p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hub-branch-subdivision">
                Subdivision code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hub-branch-subdivision"
                value={countrySubdivisionCode}
                onChange={(event) =>
                  setCountrySubdivisionCode(event.target.value.toUpperCase())
                }
                maxLength={6}
                placeholder={
                  companyCountryCode
                    ? `${companyCountryCode.toUpperCase()}-…`
                    : "ISO 3166-2 code"
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-branch-timezone">
                Timezone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hub-branch-timezone"
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                placeholder="Area/City"
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            The branch code is generated automatically when you continue.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                mutation.isPending ||
                !companyCountryCode.trim() ||
                !countrySubdivisionCode.trim() ||
                !timezone.trim()
              }
            >
              {mutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save branch
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DepartmentCreateDialog({
  open,
  onOpenChange,
  companyId,
  branches,
  branchesLoading,
  initialName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  branches: Array<{ id: string; branchName: string }>;
  branchesLoading: boolean;
  initialName: string;
}) {
  const queryClient = useQueryClient();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [branchId, setBranchId] = useState("");
  const name = nameOverride ?? (initialName.trim() || "Operations");

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setBranchId("");
      setNameOverride(null);
    }
    onOpenChange(nextOpen);
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const latest = await organizationOnboardingService.status();
      if (latest.requirements.department) {
        return { alreadyDone: true as const };
      }
      if (!branchId) {
        throw new Error("Confirm a branch before adding a department.");
      }
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Department name must be at least 2 characters.");
      }
      await DepartmentService.create({
        companyId,
        branchId,
        departmentName: trimmed,
      });
      await organizationOnboardingService.updateStep("REVIEW");
      return { alreadyDone: false as const };
    },
    onSuccess: async (result) => {
      toast.success(
        result.alreadyDone
          ? "Department was already added. Continuing."
          : "Department added.",
      );
      handleOpenChange(false);
      await queryClient.invalidateQueries({
        queryKey: ["organization-onboarding"],
      });
    },
    onError: (error) =>
      toast.error(
        getApiErrorMessage(
          error,
          "Could not save this department. Check the name and retry.",
        ),
      ),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add first department</DialogTitle>
          <DialogDescription>
            Select the branch that owns this department. The system will not
            choose a branch for you.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="hub-department-branch">
              Branch <span className="text-destructive">*</span>
            </Label>
            <Select value={branchId || undefined} onValueChange={setBranchId}>
              <SelectTrigger
                id="hub-department-branch"
                className="w-full"
                disabled={branchesLoading || branches.length === 0}
              >
                <SelectValue
                  placeholder={
                    branchesLoading ? "Loading branches…" : "Select branch"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.branchName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hub-department-name">
              Department name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-department-name"
              value={name}
              onChange={(event) => setNameOverride(event.target.value)}
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENT_SUGGESTIONS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setNameOverride(chip)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[12px] font-medium",
                  name === chip
                    ? "border-[#F15A43] bg-[#FFF1EC] text-[#C84E32]"
                    : "border-[#E2E6EE] bg-[#F8F9FB] text-[#5C6675]",
                )}
              >
                {chip}
              </button>
            ))}
          </div>
          {branches.length === 0 && !branchesLoading ? (
            <p className="text-sm text-destructive">
              No branch found. Confirm a branch first.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !branchId || branchesLoading}
            >
              {mutation.isPending ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save department
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
