"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  MailCheck,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  UserRoundCheck,
  UserRoundX,
} from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import { UserSessionsSheet } from "./user-sessions-sheet";
import {
  userAccessHref,
  userInviteHref,
  USERS_LIST,
} from "../lib/security-navigation";
import { securityService } from "../security.service";
import type { SecurityUser, UserStatus } from "../types";

export function UsersWorkspace() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const [sessionUser, setSessionUser] = useState<SecurityUser | null>(null);

  const usersQuery = useQuery({
    queryKey: ["security-users"],
    queryFn: securityService.users,
  });

  const canManageUsers = hasPermission("security.users.manage");
  const canManageRoles = hasPermission("security.roles.manage");

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: UserStatus }) =>
      securityService.updateStatus(userId, status),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["security-users"] }),
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const resetMutation = useMutation({
    mutationFn: securityService.resetPassword,
    onSuccess: (result) =>
      toast.success(
        result.developmentActionUrl
          ? "Password reset ready (dev). Open the link to set a new password."
          : "Password reset instructions were requested.",
        result.developmentActionUrl
          ? {
              action: {
                label: "Open reset link",
                onClick: () =>
                  window.open(
                    result.developmentActionUrl ?? "/login",
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
            }
          : undefined,
      ),
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const resendMutation = useMutation({
    mutationFn: securityService.resendInvitation,
    onSuccess: (result) =>
      toast.success(
        result.deliveryStatus === "BYPASSED"
          ? "Invitation renewed. Email delivery was bypassed in development."
          : "Invitation sent again.",
        result.developmentActionUrl
          ? {
              action: {
                label: "Open invitation",
                onClick: () =>
                  window.open(
                    result.developmentActionUrl ?? "/login",
                    "_blank",
                    "noopener,noreferrer",
                  ),
              },
            }
          : undefined,
      ),
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  return (
    <PageContainer>
      <PageHeader
        title="Users"
        description="Create sign-in accounts and assign Company Group, company or branch access."
        actions={
          canManageUsers ? (
            <Button
              onClick={() =>
                router.push(userInviteHref({ returnTo: USERS_LIST }))
              }
            >
              <Plus className="size-4" />
              Add user
            </Button>
          ) : null
        }
      />

      <Card className="overflow-hidden p-0">
        {usersQuery.isLoading ? (
          <div className="text-muted-foreground flex min-h-48 items-center justify-center gap-2 text-sm">
            <LoaderCircle className="size-4 animate-spin" />
            Loading users…
          </div>
        ) : usersQuery.isError ? (
          <div className="text-destructive min-h-48 p-6 text-sm">
            {getApiErrorMessage(usersQuery.error)}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role and scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last sign in</TableHead>
                {canManageUsers || canManageRoles ? (
                  <TableHead className="text-right">Actions</TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(usersQuery.data ?? []).map((account) => (
                <UserRow
                  key={account.id}
                  account={account}
                  canManageUsers={canManageUsers}
                  canManageRoles={canManageRoles}
                  busy={
                    statusMutation.isPending ||
                    resetMutation.isPending ||
                    resendMutation.isPending
                  }
                  onToggle={() =>
                    statusMutation.mutate({
                      userId: account.id,
                      status:
                        account.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
                    })
                  }
                  onReset={() => resetMutation.mutate(account.id)}
                  onResend={() => resendMutation.mutate(account.id)}
                  onSessions={() => setSessionUser(account)}
                  onAssignments={() =>
                    router.push(
                      userAccessHref(account.id, { returnTo: USERS_LIST }),
                    )
                  }
                  onLock={() =>
                    statusMutation.mutate({
                      userId: account.id,
                      status: "LOCKED",
                    })
                  }
                />
              ))}
              {!usersQuery.data?.length ? (
                <TableRow>
                  <TableCell
                    colSpan={canManageUsers || canManageRoles ? 5 : 4}
                    className="text-muted-foreground h-44 text-center"
                  >
                    No user accounts have been created.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        )}
      </Card>

      <UserSessionsSheet
        user={sessionUser}
        canManage={canManageUsers}
        onClose={() => setSessionUser(null)}
      />
    </PageContainer>
  );
}

function UserRow({
  account,
  canManageUsers,
  canManageRoles,
  busy,
  onToggle,
  onReset,
  onResend,
  onSessions,
  onAssignments,
  onLock,
}: {
  account: SecurityUser;
  canManageUsers: boolean;
  canManageRoles: boolean;
  busy: boolean;
  onToggle: () => void;
  onReset: () => void;
  onResend: () => void;
  onSessions: () => void;
  onAssignments: () => void;
  onLock: () => void;
}) {
  const assignment = account.roleAssignments[0];
  const tone =
    account.status === "ACTIVE"
      ? "success"
      : account.status === "LOCKED"
        ? "warning"
        : account.status === "INVITED"
          ? "information"
          : "neutral";
  const showActions = canManageUsers || canManageRoles;

  return (
    <TableRow>
      <TableCell>
        <div>
          <p className="text-foreground font-medium">
            {account.displayName ?? account.username}
          </p>
          <p className="text-muted-foreground text-xs">
            {account.email
              ? `${account.username} / ${account.email}`
              : account.username}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-muted-foreground size-4" />
          <span>{assignment?.role.name ?? "No active role"}</span>
          {assignment ? (
            <span className="text-muted-foreground text-xs">
              / {assignment.scope.replace("_", " ")}
            </span>
          ) : null}
          {account.roleAssignments.length > 1 ? (
            <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
              +{account.roleAssignments.length - 1}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge label={account.status} tone={tone} />
      </TableCell>
      <TableCell className="text-muted-foreground">
        {account.lastLoginAt
          ? new Intl.DateTimeFormat("en", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(account.lastLoginAt))
          : "Never"}
      </TableCell>
      {showActions ? (
        <TableCell>
          <div className="flex justify-end gap-1">
            {canManageRoles ? (
              <ActionIconButton
                label="Manage roles and access"
                disabled={busy}
                onClick={onAssignments}
              >
                <ShieldCheck className="size-4" />
              </ActionIconButton>
            ) : null}
            {canManageUsers ? (
              <>
                <ActionIconButton
                  label="View active sessions"
                  disabled={busy}
                  onClick={onSessions}
                >
                  <MonitorSmartphone className="size-4" />
                </ActionIconButton>
                {account.status === "INVITED" ? (
                  <ActionIconButton
                    label="Resend invitation email"
                    disabled={busy}
                    onClick={onResend}
                  >
                    <MailCheck className="size-4" />
                  </ActionIconButton>
                ) : (
                  <>
                    {account.status !== "DISABLED" ? (
                      <ActionIconButton
                        label="Send password reset"
                        disabled={busy}
                        onClick={onReset}
                      >
                        <KeyRound className="size-4" />
                      </ActionIconButton>
                    ) : null}
                    {account.status === "ACTIVE" ? (
                      <ActionIconButton
                        label="Lock account"
                        disabled={busy}
                        onClick={onLock}
                      >
                        <LockKeyhole className="text-warning size-4" />
                      </ActionIconButton>
                    ) : null}
                    <ActionIconButton
                      label={
                        account.status === "ACTIVE"
                          ? "Disable account"
                          : "Enable account"
                      }
                      disabled={busy}
                      onClick={onToggle}
                    >
                      {account.status === "ACTIVE" ? (
                        <UserRoundX className="text-destructive size-4" />
                      ) : (
                        <UserRoundCheck className="text-success size-4" />
                      )}
                    </ActionIconButton>
                  </>
                )}
              </>
            ) : null}
          </div>
        </TableCell>
      ) : null}
    </TableRow>
  );
}

function ActionIconButton({
  label,
  disabled,
  onClick,
  children,
  variant = "ghost",
  size = "icon",
  className,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: "ghost" | "outline";
  size?: "icon" | "sm";
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={onClick}
          aria-label={label}
          className={className}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
