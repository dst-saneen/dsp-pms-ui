"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, LoaderCircle, Pencil, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  roleCreateHref,
  roleEditHref,
  SECURITY_LIST,
} from "../lib/security-navigation";
import { securityService } from "../security.service";
import type { SecurityRole } from "../types";

export function SecurityRolesWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission, user } = useAuth();
  const canManage =
    hasPermission("security.roles.manage") &&
    Boolean(user?.authorization.activeCompanyGroupId);

  const rolesQuery = useQuery({
    queryKey: ["security-roles"],
    queryFn: () => securityService.roles(true),
  });
  const permissionsQuery = useQuery({
    queryKey: ["security-permissions"],
    queryFn: securityService.permissions,
  });

  const cloneMutation = useMutation({
    mutationFn: (role: SecurityRole) => securityService.cloneRole(role.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-roles"] });
      toast.success("Role copied as a tenant custom role.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const statusMutation = useMutation({
    mutationFn: (role: SecurityRole) =>
      securityService.updateRoleStatus(role.id, !role.isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-roles"] });
      toast.success("Custom role status updated.");
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  if (rolesQuery.isLoading || permissionsQuery.isLoading) {
    return (
      <div className="text-muted-foreground flex min-h-64 items-center justify-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" />
        Loading security catalog…
      </div>
    );
  }

  const error = rolesQuery.error ?? permissionsQuery.error;
  if (error) {
    return (
      <div className="border-destructive/20 bg-destructive/5 text-destructive rounded-xl border p-5 text-sm">
        {getApiErrorMessage(error)}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Roles & Permissions"
        description="System roles are protected. Create tenant roles from approved permissions for the active Company Group."
        actions={
          canManage ? (
            <Button
              onClick={() =>
                router.push(roleCreateHref({ returnTo: SECURITY_LIST }))
              }
            >
              <Plus className="size-4" />
              Add custom role
            </Button>
          ) : null
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="text-primary size-4" />
              Available roles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(rolesQuery.data ?? []).map((role) => (
              <div key={role.id} className="border-border bg-card rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-foreground font-medium">{role.name}</p>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[11px] font-medium">
                        {role.isSystem ? "System" : "Custom"}
                      </span>
                      {!role.isSystem ? (
                        <StatusBadge
                          label={role.isActive ? "Active" : "Inactive"}
                          tone={role.isActive ? "success" : "neutral"}
                        />
                      ) : null}
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {role.description ?? role.code}
                    </p>
                    <p className="text-primary mt-2 text-xs font-medium">
                      {role.permissions?.length ?? 0} permissions
                      <span className="text-muted-foreground font-normal">
                        {" "}
                        · {role._count?.assignments ?? 0} active assignments
                      </span>
                    </p>
                  </div>
                  {canManage ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => cloneMutation.mutate(role)}
                        disabled={cloneMutation.isPending}
                        aria-label={`Copy ${role.name}`}
                      >
                        <Copy className="size-4" />
                      </Button>
                      {!role.isSystem ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => statusMutation.mutate(role)}
                            disabled={statusMutation.isPending}
                          >
                            {role.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(
                                roleEditHref(role.id, {
                                  returnTo: SECURITY_LIST,
                                }),
                              )
                            }
                            aria-label={`Edit ${role.name}`}
                          >
                            <Pencil className="size-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b px-4 py-4">
            <KeyRound className="text-primary size-4" />
            <h2 className="text-foreground font-semibold">Permission catalog</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Permission</TableHead>
                <TableHead>Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(permissionsQuery.data ?? []).map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="text-muted-foreground capitalize">
                    {permission.code.split(".")[0]}
                  </TableCell>
                  <TableCell className="font-medium">{permission.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {permission.code}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageContainer>
  );
}
