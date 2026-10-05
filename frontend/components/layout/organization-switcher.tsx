"use client";

import { useState } from "react";
import { Building2, Check, ChevronDown, Globe2, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/auth-provider";
import type { AvailableAuthorizationScope } from "@/types/auth";

function scopeLabel(scope: AvailableAuthorizationScope): string {
  if (scope.scope === "GLOBAL") return "All organizations";

  if (scope.scope === "BRANCH") {
    return `${scope.companyName ?? "Company"} / ${scope.branchName ?? "Branch"}`;
  }

  return scope.companyName ?? scope.companyGroupName ?? "Organization";
}

function scopeKey(scope: AvailableAuthorizationScope): string {
  return [
    scope.scope,
    scope.companyGroupId ?? "",
    scope.companyId ?? "",
    scope.branchId ?? "",
  ].join(":");
}

export function OrganizationSwitcher() {
  const { user, changeContext } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scopes = user?.authorization.availableScopes ?? [];

  if (!user || scopes.length <= 1) {
    return null;
  }

  const activeScope =
    scopes.find(
      (scope) =>
        scope.companyGroupId === user.authorization.activeCompanyGroupId &&
        scope.companyId === user.authorization.activeCompanyId &&
        (scope.scope !== "BRANCH" || scope.branchId === user.authorization.activeBranchId)
    ) ?? scopes[0];
  const activeLabel = user.authorization.isGlobal ? "All organizations" : scopeLabel(activeScope);

  async function selectScope(scope: AvailableAuthorizationScope) {
    const key = scopeKey(scope);
    setBusyKey(key);
    setErrorMessage(null);

    try {
      await changeContext(scope.companyId, scope.branchId, scope.companyGroupId);
    } catch {
      setErrorMessage("Company or Branch could not be changed. Try again.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex max-w-56 gap-2 px-2 sm:px-3"
          disabled={Boolean(busyKey)}
          aria-label={`Organization context: ${activeLabel}`}
        >
          {user.authorization.isGlobal ? (
            <Globe2 className="text-primary size-4" />
          ) : (
            <Building2 className="text-primary size-4" />
          )}
          <span className="hidden truncate sm:inline">{activeLabel}</span>
          <ChevronDown className="text-muted-foreground hidden size-3.5 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Organization context</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {errorMessage ? (
          <div className="text-destructive px-2 py-2 text-xs" role="alert">
            {errorMessage}
          </div>
        ) : null}
        {scopes.map((scope) => {
          const key = scopeKey(scope);
          const active =
            scope.scope === user.authorization.scopeLevel &&
            scope.companyGroupId === user.authorization.activeCompanyGroupId &&
            scope.companyId === user.authorization.activeCompanyId &&
            scope.branchId === user.authorization.activeBranchId;

          return (
            <DropdownMenuItem
              key={key}
              disabled={Boolean(busyKey)}
              onSelect={() => void selectScope(scope)}
              className="gap-2 px-2 py-2"
            >
              {busyKey === key ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : scope.scope === "GLOBAL" ? (
                <Globe2 className="text-muted-foreground size-4" />
              ) : (
                <Building2 className="text-muted-foreground size-4" />
              )}
              <span className="min-w-0 flex-1 truncate">{scopeLabel(scope)}</span>
              {active ? <Check className="text-primary size-4" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
