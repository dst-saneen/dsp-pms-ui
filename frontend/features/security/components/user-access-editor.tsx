"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AuthzState } from "@/components/common/authz-state";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { RoleAssignmentEditor } from "@/components/security/role-assignment-editor";
import { LookupService } from "@/features/lookups/services/lookup-service";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useAuth } from "@/providers/auth-provider";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { EffectiveAccessSummary } from "./effective-access-summary";
import { toAssignmentInput } from "../lib/assignment-summary";
import { USERS_LIST } from "../lib/security-navigation";
import { securityService } from "../security.service";
import type { SecurityUser, SecurityUserAssignmentInput } from "../types";

interface UserAccessEditorProps {
  userId: string;
  returnTo: string;
  canManage: boolean;
}

export function UserAccessEditor({
  userId,
  returnTo,
  canManage,
}: UserAccessEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user: actor } = useAuth();
  const [target, setTarget] = useState<SecurityUser | null>(null);
  const [assignments, setAssignments] = useState<SecurityUserAssignmentInput[]>(
    [],
  );
  const [baseline, setBaseline] = useState<SecurityUserAssignmentInput[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const usersQuery = useQuery({
    queryKey: ["security-users"],
    queryFn: securityService.users,
  });
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

  useEffect(() => {
    let cancelled = false;
    if (usersQuery.data) {
      const match = usersQuery.data.find((item) => item.id === userId) ?? null;
      void Promise.resolve().then(() => {
        if (cancelled) return;
        if (!match) {
          setNotFound(true);
          setTarget(null);
          return;
        }
        const mapped = match.roleAssignments.map(toAssignmentInput);
        setTarget(match);
        setAssignments(mapped);
        setBaseline(mapped);
        setNotFound(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [userId, usersQuery.data]);

  const displayName = useMemo(
    () => target?.displayName ?? target?.username ?? "User",
    [target],
  );

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    { label: `Access · ${displayName}`, href: null },
  ]);

  const saveMutation = useMutation({
    mutationFn: (roleAssignments: SecurityUserAssignmentInput[]) =>
      securityService.replaceUserAssignments(userId, roleAssignments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-users"] });
      toast.success("Role assignments updated. Existing sessions were revoked.");
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
    if (!assignments.length) {
      toast.error("Keep at least one role assignment.");
      return;
    }
    saveMutation.mutate(assignments);
  }

  if (usersQuery.isLoading) {
    return (
      <EntityFormPage
        title="Manage access"
        description="Loading user…"
        formId="user-access-form"
        onSecondary={goBack}
        isSaving
      >
        <div className="bg-muted/40 h-48 animate-pulse rounded-xl" />
      </EntityFormPage>
    );
  }

  if (notFound || !target) {
    return (
      <AuthzState
        variant="not-found"
        title="User not found"
        description="This account may have been removed or is outside your organization scope."
        actionLabel="Back to users"
        onAction={() => router.push(USERS_LIST)}
      />
    );
  }

  if (!canManage) {
    return (
      <AuthzState
        variant="unauthorized"
        title="Cannot manage role assignments"
        description="You need security.roles.manage to change user access."
        actionLabel="Back to users"
        onAction={() => router.push(USERS_LIST)}
      />
    );
  }

  return (
    <EntityFormPage
      title={`Manage access · ${displayName}`}
      description="Update roles and organization scope. Saving signs out all current sessions for this user."
      formId="user-access-form"
      primaryLabel="Save access"
      onSecondary={goBack}
      isSaving={saveMutation.isPending}
    >
      <form id="user-access-form" className="space-y-6" onSubmit={submit}>
        <p className="text-muted-foreground text-sm">
          {target.email
            ? `${target.username} · ${target.email}`
            : target.username}
        </p>

        <RoleAssignmentEditor
          key={target.id}
          assignments={assignments}
          onChange={(next) => {
            setAssignments(next);
            setIsDirty(true);
          }}
          roles={rolesQuery.data ?? []}
          companyGroups={companyGroupsQuery.data ?? []}
          companies={companiesQuery.data ?? []}
          isGlobal={Boolean(actor?.authorization.isGlobal)}
          actorScope={actor?.authorization.scopeLevel}
          activeCompanyGroupId={actor?.authorization.activeCompanyGroupId}
          activeCompanyId={actor?.authorization.activeCompanyId}
        />

        <EffectiveAccessSummary
          mode="assignments"
          assignments={assignments}
          previousAssignments={baseline}
          roles={rolesQuery.data ?? []}
          companyGroups={companyGroupsQuery.data ?? []}
          companies={companiesQuery.data ?? []}
          warnSessionRevoke
        />
      </form>
    </EntityFormPage>
  );
}
