"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { EntityFormPage } from "@/components/common/entity-form-page";
import { RoleAssignmentEditor } from "@/components/security/role-assignment-editor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LookupService } from "@/features/lookups/services/lookup-service";
import { useEmployee } from "@/features/employee/hooks/use-employee";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/providers/auth-provider";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { EffectiveAccessSummary } from "./effective-access-summary";
import { securityService } from "../security.service";
import type { SecurityUserAssignmentInput } from "../types";

export interface UserInvitePrefill {
  employeeId?: string;
  /** When true, linked employee cannot be cleared/changed. */
  lockEmployee?: boolean;
}

interface UserInviteEditorProps {
  returnTo: string;
  canManage: boolean;
  prefill?: UserInvitePrefill;
}

export function UserInviteEditor({
  returnTo,
  canManage,
  prefill,
}: UserInviteEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [employeeId, setEmployeeId] = useState(prefill?.employeeId ?? "");
  const [roleAssignments, setRoleAssignments] = useState<
    SecurityUserAssignmentInput[]
  >([]);
  const [isDirty, setIsDirty] = useState(Boolean(prefill?.employeeId));
  const lockEmployee = Boolean(prefill?.lockEmployee && prefill.employeeId);
  const linkedEmployeeQuery = useEmployee(prefill?.employeeId ?? "");
  const appliedEmployeeId = useRef<string | null>(null);

  useEffect(() => {
    const employee = linkedEmployeeQuery.data;
    if (!lockEmployee || !employee || appliedEmployeeId.current === employee.id) {
      return;
    }
    setDisplayName(`${employee.firstName} ${employee.lastName ?? ""}`.trim());
    setEmail(employee.email?.trim() ?? "");
    appliedEmployeeId.current = employee.id;
  }, [linkedEmployeeQuery.data, lockEmployee]);

  const rolesQuery = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => securityService.roles(),
  });
  const companiesQuery = useQuery({
    queryKey: ["security-company-options"],
    queryFn: LookupService.getCompanies,
  });
  const companyGroupsQuery = useQuery({
    queryKey: ["security-company-group-options"],
    queryFn: LookupService.getCompanyGroups,
  });
  const employeesQuery = useQuery({
    queryKey: ["security-employee-options"],
    queryFn: () => LookupService.getManagers(),
  });

  const employeeOptions = useMemo(() => {
    const items = [...(employeesQuery.data ?? [])];
    if (
      linkedEmployeeQuery.data &&
      !items.some((item) => item.id === prefill?.employeeId)
    ) {
      items.unshift({
        id: linkedEmployeeQuery.data.id,
        code: linkedEmployeeQuery.data.employeeCode,
        name: `${linkedEmployeeQuery.data.firstName} ${linkedEmployeeQuery.data.lastName ?? ""}`.trim(),
      });
    }
    return items;
  }, [employeesQuery.data, linkedEmployeeQuery.data, prefill?.employeeId]);

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([{ label: "Invite user", href: null }]);

  const createMutation = useMutation({
    mutationFn: securityService.createUser,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["security-users"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      toast.success(
        result.invitation.deliveryStatus === "BYPASSED"
          ? "User invited. Email delivery was bypassed in development."
          : "Invitation sent to the user.",
        result.invitation.developmentActionUrl
          ? {
              action: {
                label: "Open invitation",
                onClick: () =>
                  window.open(
                    result.invitation.developmentActionUrl ?? "/login",
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
            }
          : undefined,
      );
      router.push(returnTo);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage) return;
    const defaultAssignment = roleAssignments[0];
    if (!defaultAssignment || !displayName.trim() || !email.trim()) {
      toast.error("Name, email, and at least one role assignment are required.");
      return;
    }

    createMutation.mutate({
      displayName: displayName.trim(),
      email: email.trim(),
      employeeId: employeeId || undefined,
      defaultCompanyGroupId:
        defaultAssignment.scope === "COMPANY_GROUP"
          ? defaultAssignment.companyGroupId
          : undefined,
      defaultCompanyId:
        defaultAssignment.scope === "COMPANY" ||
        defaultAssignment.scope === "BRANCH"
          ? defaultAssignment.companyId
          : undefined,
      defaultBranchId:
        defaultAssignment.scope === "BRANCH"
          ? defaultAssignment.branchId
          : undefined,
      roleAssignments,
    });
  }

  return (
    <EntityFormPage
      title="Invite user"
      description={
        lockEmployee
          ? "The linked employee, name, and email are loaded from the employee record. Add roles and send the invitation."
          : "Send a secure, time-limited invitation. Review roles and organization scope before submit."
      }
      formId="invite-user-form"
      primaryLabel="Send invitation"
      onSecondary={goBack}
      isSaving={createMutation.isPending}
    >
      <form id="invite-user-form" className="space-y-6" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="displayName">Full name</Label>
            <Input
              id="displayName"
              autoComplete="name"
              value={displayName}
              disabled={lockEmployee}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setIsDirty(true);
              }}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              disabled={lockEmployee}
              onChange={(event) => {
                setEmail(event.target.value);
                setIsDirty(true);
              }}
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invite-linked-employee">
            Linked employee (optional)
          </Label>
          <Select
            value={employeeId || "__none__"}
            disabled={lockEmployee}
            onValueChange={(value) => {
              setEmployeeId(value === "__none__" ? "" : value);
              setIsDirty(true);
            }}
          >
            <SelectTrigger id="invite-linked-employee" className="w-full">
              <SelectValue placeholder="No linked employee" />
            </SelectTrigger>
            <SelectContent>
              {!lockEmployee ? (
                <SelectItem value="__none__">No linked employee</SelectItem>
              ) : null}
              {employeeOptions.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {lockEmployee ? (
            <p className="text-muted-foreground text-xs">
              {linkedEmployeeQuery.isLoading
                ? "Loading the employee record…"
                : linkedEmployeeQuery.isError
                  ? "The employee record could not be loaded. Return to Employees and try again."
                  : "Linked from the employee directory. Employee, name, and email are locked for this invite."}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Roles and access</Label>
          <RoleAssignmentEditor
            assignments={roleAssignments}
            onChange={(next) => {
              setRoleAssignments(next);
              setIsDirty(true);
            }}
            roles={rolesQuery.data ?? []}
            companyGroups={companyGroupsQuery.data ?? []}
            companies={companiesQuery.data ?? []}
            isGlobal={Boolean(user?.authorization.isGlobal)}
            actorScope={user?.authorization.scopeLevel}
            activeCompanyGroupId={user?.authorization.activeCompanyGroupId}
            activeCompanyId={user?.authorization.activeCompanyId}
          />
        </div>

        <EffectiveAccessSummary
          mode="assignments"
          assignments={roleAssignments}
          roles={rolesQuery.data ?? []}
          companyGroups={companyGroupsQuery.data ?? []}
          companies={companiesQuery.data ?? []}
        />
      </form>
    </EntityFormPage>
  );
}
