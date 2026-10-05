"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Check, LoaderCircle, Pencil, UserRound } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { CompanyGroupService } from "@/features/company-group/services/company-group-service";
import { CompanyService } from "@/features/company/services/company-service";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { cn } from "@/lib/utils";

import type { OrganizationOnboardingStatus } from "../types";

interface AlreadySetupSectionProps {
  status: OrganizationOnboardingStatus;
}

type EditTarget = "organization" | "company" | null;

export function AlreadySetupSection({ status }: AlreadySetupSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  const ownerName = formatOwnerName(status, user?.displayName);
  const ownerEmail = user?.email?.trim() || "";
  const companyName = status.company?.companyName?.trim() || "Not set";

  return (
    <section className="rounded-[10px] border border-[#D8F0E3] bg-[#F3FBF7] px-2.5 py-2.5 sm:px-3">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-full bg-[#22A06B] text-white">
          <Check className="size-3.5" aria-hidden="true" />
        </span>
        <h3 className="text-[14px] font-semibold text-[#101A33]">
          Already set up{" "}
          <span className="font-normal text-[#7D8798]">
            (from your registration)
          </span>
        </h3>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <SetupCard
          title="Organization"
          value={status.companyGroup.groupName}
          meta={status.companyGroup.groupCode}
          badge="Completed"
          onEdit={() => setEditTarget("organization")}
        />
        <SetupCard
          title="Owner account"
          value={ownerName}
          meta={maskEmail(ownerEmail) || "Verified owner"}
          badge="Email verified"
        />
        <SetupCard
          title="Company profile"
          value={companyName}
          meta={status.company?.companyCode}
          badge={status.company ? "Ready" : "Needed"}
          badgeTone={status.company ? "success" : "needed"}
          onEdit={status.company ? () => setEditTarget("company") : undefined}
        />
      </div>

      {editTarget === "organization" ? (
        <OrganizationEditDialog
          key={`${status.companyGroup.id}:${status.companyGroup.groupName}:${status.companyGroup.description ?? ""}`}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          status={status}
          onSaved={async () => {
            setEditTarget(null);
            await queryClient.invalidateQueries({
              queryKey: ["organization-onboarding"],
            });
          }}
        />
      ) : null}

      {editTarget === "company" && status.company ? (
        <CompanyEditDialog
          key={`${status.company.id}:${status.company.companyName}:${status.company.registrationNo ?? ""}:${status.company.taxNumber ?? ""}`}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
          status={status}
          onSaved={async () => {
            setEditTarget(null);
            await queryClient.invalidateQueries({
              queryKey: ["organization-onboarding"],
            });
          }}
        />
      ) : null}
    </section>
  );
}

function SetupCard({
  title,
  value,
  meta,
  badge,
  badgeTone = "success",
  onEdit,
}: {
  title: string;
  value: string;
  meta?: string;
  badge: string;
  badgeTone?: "success" | "needed";
  onEdit?: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-[10px] border border-[#E8ECF1] bg-white p-2.5 shadow-[0_4px_12px_rgba(16,26,51,0.03)] sm:p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#F3F6FA] text-[#71829A]">
            {title === "Owner account" ? (
              <UserRound className="size-4" aria-hidden="true" />
            ) : (
              <Building2 className="size-4" aria-hidden="true" />
            )}
          </span>
          <p className="truncate text-[12px] font-medium text-[#7D8798]">
            {title}
          </p>
        </div>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-[#4B8DFF] hover:underline"
          >
            <Pencil className="size-3" aria-hidden="true" />
            Edit
          </button>
        ) : null}
      </div>

      <p className="mt-2 truncate text-[14px] font-semibold text-[#101A33]">
        {value}
      </p>
      {meta ? (
        <p className="mt-0.5 truncate font-mono text-[11px] text-[#9AA3B2]">
          {meta}
        </p>
      ) : null}

      <span
        className={cn(
          "mt-2 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
          badgeTone === "success"
            ? "bg-[#E7F8EF] text-[#1F7A4D]"
            : "bg-[#FFF1EC] text-[#C84E32]",
        )}
      >
        {badgeTone === "success" ? (
          <Check className="size-3" aria-hidden="true" />
        ) : null}
        {badge}
      </span>
    </div>
  );
}

function OrganizationEditDialog({
  open,
  onOpenChange,
  status,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OrganizationOnboardingStatus;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(status.companyGroup.groupName);
  const [description, setDescription] = useState(
    status.companyGroup.description ?? "",
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Organization name must be at least 2 characters.");
      }
      await CompanyGroupService.update(status.companyGroup.id, {
        groupName: trimmed,
        description: description.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Organization updated.");
      await onSaved();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit organization</DialogTitle>
          <DialogDescription>
            Update the top-level company group for this workspace.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="hub-org-name">
              Organization name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-org-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hub-org-description">Short description</Label>
            <Textarea
              id="hub-org-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What does your organization do?"
              rows={3}
            />
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Internal code</span>
            <code className="mt-1 block font-mono font-medium">
              {status.companyGroup.groupCode}
            </code>
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompanyEditDialog({
  open,
  onOpenChange,
  status,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: OrganizationOnboardingStatus;
  onSaved: () => Promise<void>;
}) {
  const company = status.company!;
  const [name, setName] = useState(company.companyName);
  const [registrationNo, setRegistrationNo] = useState(
    company.registrationNo ?? "",
  );
  const [taxNumber, setTaxNumber] = useState(company.taxNumber ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        throw new Error("Company name must be at least 2 characters.");
      }
      await CompanyService.update(company.id, {
        companyName: trimmed,
        registrationNo: registrationNo.trim() || undefined,
        taxNumber: taxNumber.trim() || undefined,
      });
    },
    onSuccess: async () => {
      toast.success("Company profile updated.");
      await onSaved();
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit company profile</DialogTitle>
          <DialogDescription>
            Confirm the first legal company for this organization.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="hub-company-name">
              Legal company name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hub-company-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              minLength={2}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hub-registration-no">Registration number</Label>
              <Input
                id="hub-registration-no"
                value={registrationNo}
                onChange={(event) => setRegistrationNo(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hub-tax-number">Tax number</Label>
              <Input
                id="hub-tax-number"
                value={taxNumber}
                onChange={(event) => setTaxNumber(event.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">Internal code</span>
            <code className="mt-1 block font-mono font-medium">
              {company.companyCode}
            </code>
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function formatOwnerName(
  status: OrganizationOnboardingStatus,
  fallbackDisplayName?: string,
) {
  const employee = status.ownerEmployee;
  if (employee) {
    return [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  }
  return fallbackDisplayName?.trim() || "Organization owner";
}

function maskEmail(email: string) {
  const at = email.indexOf("@");
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at);
  if (local.length <= 2) return `${local[0] ?? ""}***${domain}`;
  return `${local.slice(0, 2)}${"*".repeat(Math.min(local.length - 2, 8))}${domain}`;
}
