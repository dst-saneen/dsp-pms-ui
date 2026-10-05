"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { AuthzState } from "@/components/common/authz-state";
import { EntityFormPage } from "@/components/common/entity-form-page";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { EffectiveAccessSummary } from "./effective-access-summary";
import { PermissionPicker } from "./permission-picker";
import { SECURITY_LIST } from "../lib/security-navigation";
import { securityService } from "../security.service";
import type { SecurityRole } from "../types";

interface RoleEditorProps {
  mode: "create" | "edit";
  roleId?: string;
  returnTo: string;
  canManage: boolean;
}

export function RoleEditor({
  mode,
  roleId,
  returnTo,
  canManage,
}: RoleEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [baselinePermissionIds, setBaselinePermissionIds] = useState<string[]>(
    [],
  );
  const [isDirty, setIsDirty] = useState(false);
  const [role, setRole] = useState<SecurityRole | null>(null);
  const [loadError, setLoadError] = useState(false);

  const permissionsQuery = useQuery({
    queryKey: ["security-permissions"],
    queryFn: securityService.permissions,
  });

  const rolesQuery = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => securityService.roles(true),
    enabled: mode === "edit",
  });

  useEffect(() => {
    let cancelled = false;
    if (mode === "edit" && roleId && rolesQuery.data) {
      const match = rolesQuery.data.find((item) => item.id === roleId) ?? null;
      void Promise.resolve().then(() => {
        if (cancelled) return;
        if (!match) {
          setLoadError(true);
          setRole(null);
          return;
        }
        if (match.isSystem) {
          setRole(match);
          return;
        }
        const ids = (match.permissions ?? []).map((item) => item.permission.id);
        setRole(match);
        setName(match.name);
        setDescription(match.description ?? "");
        setPermissionIds(ids);
        setBaselinePermissionIds(ids);
        setLoadError(false);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [mode, roleId, rolesQuery.data]);

  const { confirmLeave } = useUnsavedChanges({ isDirty });

  useSetEntityBreadcrumbs([
    {
      label:
        mode === "create"
          ? "New Role"
          : role
            ? role.name
            : "Edit Role",
      href: null,
    },
  ]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (mode === "edit" && role) {
        await securityService.updateRole(role.id, {
          name,
          description,
        });
        return securityService.replaceRolePermissions(role.id, permissionIds);
      }
      return securityService.createRole({
        name,
        description: description || undefined,
        permissionIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-roles"] });
      toast.success(
        mode === "edit" ? "Custom role updated." : "Custom role created.",
      );
      router.push(returnTo);
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const goBack = useCallback(() => {
    if (!confirmLeave()) return;
    router.push(returnTo);
  }, [confirmLeave, returnTo, router]);

  function markDirty() {
    setIsDirty(true);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || role?.isSystem) return;
    if (name.trim().length < 2 || permissionIds.length === 0) {
      toast.error("Provide a role name and at least one permission.");
      return;
    }
    saveMutation.mutate();
  }

  if (mode === "edit" && rolesQuery.isLoading) {
    return (
      <EntityFormPage
        title="Edit role"
        description="Loading role…"
        formId="role-form"
        onSecondary={goBack}
        isSaving
      >
        <div className="bg-muted/40 h-48 animate-pulse rounded-xl" />
      </EntityFormPage>
    );
  }

  if (mode === "edit" && (loadError || !role)) {
    return (
      <AuthzState
        variant="not-found"
        title="Role not found"
        description="This role may have been deleted or is outside your Company Group."
        actionLabel="Back to roles"
        onAction={() => router.push(SECURITY_LIST)}
      />
    );
  }

  if (mode === "edit" && role?.isSystem) {
    return (
      <AuthzState
        variant="unauthorized"
        title="System roles are protected"
        description="Clone the role to create a tenant custom role you can edit."
        actionLabel="Back to roles"
        onAction={() => router.push(SECURITY_LIST)}
      />
    );
  }

  if (!canManage) {
    return (
      <AuthzState
        variant="unauthorized"
        title="Cannot manage roles"
        description="You need security.roles.manage and an active Company Group."
        actionLabel="Back to roles"
        onAction={() => router.push(SECURITY_LIST)}
      />
    );
  }

  return (
    <EntityFormPage
      title={mode === "create" ? "Create custom role" : `Edit ${role?.name}`}
      description="Choose only the permissions this role needs. Platform administration is never tenant assignable."
      formId="role-form"
      primaryLabel={mode === "edit" ? "Save changes" : "Create role"}
      onSecondary={goBack}
      isSaving={saveMutation.isPending}
    >
      <form id="role-form" className="space-y-6" onSubmit={submit}>
        <div className="space-y-1.5">
          <Label htmlFor="role-name">Role name</Label>
          <Input
            id="role-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              markDirty();
            }}
            required
            autoFocus
            minLength={2}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role-description">Description</Label>
          <Textarea
            id="role-description"
            value={description}
            onChange={(event) => {
              setDescription(event.target.value);
              markDirty();
            }}
            rows={3}
          />
        </div>

        <EffectiveAccessSummary
          mode="permissions"
          permissionIds={permissionIds}
          previousPermissionIds={
            mode === "edit" ? baselinePermissionIds : undefined
          }
          permissions={permissionsQuery.data ?? []}
        />

        <PermissionPicker
          permissions={permissionsQuery.data ?? []}
          selectedIds={permissionIds}
          onChange={(ids) => {
            setPermissionIds(ids);
            markDirty();
          }}
          disabled={permissionsQuery.isLoading}
        />
      </form>
    </EntityFormPage>
  );
}
