"use client";

import type { ReactNode } from "react";

import { useAuth } from "@/providers/auth-provider";
import { AuthzState } from "@/components/common/authz-state";

interface PermissionGateProps {
  /** All listed permissions required (AND). */
  permission?: string | string[];
  /** Any one permission sufficient (OR). Ignored if `permission` passes. */
  anyPermission?: string | string[];
  children: ReactNode;
  /** When denied: hide children (default) or show AuthzState. */
  fallback?: "hide" | "unauthorized";
  unauthorizedTitle?: string;
  unauthorizedDescription?: string;
}

function asList(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export function PermissionGate({
  permission,
  anyPermission,
  children,
  fallback = "hide",
  unauthorizedTitle,
  unauthorizedDescription,
}: PermissionGateProps) {
  const { hasPermission, status } = useAuth();

  if (status === "initializing") {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-5 py-10 text-center text-sm">
        Checking permissions…
      </div>
    );
  }

  const required = asList(permission);
  const anyRequired = asList(anyPermission);

  const allowed =
    (required.length === 0 || required.every((code) => hasPermission(code))) &&
    (anyRequired.length === 0 ||
      anyRequired.some((code) => hasPermission(code)));

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback === "unauthorized") {
    return (
      <AuthzState
        variant="unauthorized"
        title={unauthorizedTitle}
        description={unauthorizedDescription}
      />
    );
  }

  return null;
}
