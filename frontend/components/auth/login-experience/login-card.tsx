"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  AUTH_ACCENT,
  AuthCardError,
  AuthCardHeader,
  AuthMarketingCard,
  AuthPrimaryButton,
  authLoginFieldClassName,
} from "@/components/auth/auth-marketing-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  appendNextQuery,
  peekAuthNext,
  rememberAuthNext,
  resolveSafeNextPath,
} from "@/lib/auth-next-path";
import { getApiErrorMessage, getRequiredOrganizationScopes } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import { useAuth } from "@/providers/auth-provider";
import type {
  AuthCapabilities,
  AvailableAuthorizationScope,
  OrganizationScopeSelection,
} from "@/types/auth";
import { cn } from "@/lib/utils";

import { BrandLockup } from "@/components/auth/brand-logo";
import { LoginFooter } from "./login-footer";

const REMEMBER_KEY = "erp.login.rememberIdentifier";

export function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status, user } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requiredScopes, setRequiredScopes] = useState<AvailableAuthorizationScope[]>([]);
  const [selectedScopeKey, setSelectedScopeKey] = useState("");
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);

  const urlNext = searchParams.get("next");
  const intendedNext = resolveSafeNextPath(urlNext ?? peekAuthNext());

  useEffect(() => {
    if (urlNext) {
      rememberAuthNext(urlNext);
    }
  }, [urlNext]);

  useEffect(() => {
    if (status === "authenticated" && user) {
      router.replace(
        user.mustChangePassword ? appendNextQuery("/change-password", intendedNext) : intendedNext
      );
    }
  }, [intendedNext, router, status, user]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        // Browser storage is the external source synchronized by this effect.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIdentifier(saved);
        setRememberMe(true);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    authService
      .capabilities()
      .then((response) => {
        if (active) setCapabilities(response);
      })
      .catch(() => {
        if (active) setCapabilities(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError("Enter your username or email and password.");
      return;
    }

    setSubmitting(true);

    try {
      try {
        if (rememberMe) {
          window.localStorage.setItem(REMEMBER_KEY, identifier.trim());
        } else {
          window.localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        // ignore
      }

      const selectedScope = requiredScopes.find(
        (scope) => organizationScopeKey(scope) === selectedScopeKey
      );

      if (requiredScopes.length > 0 && !selectedScope) {
        setError("Choose the company or branch you want to open.");
        return;
      }

      const signedInUser = await login(
        identifier,
        password,
        selectedScope ? toOrganizationScopeSelection(selectedScope) : undefined
      );
      const next = resolveSafeNextPath(urlNext ?? peekAuthNext());
      rememberAuthNext(next);
      router.replace(
        signedInUser.mustChangePassword ? appendNextQuery("/change-password", next) : next
      );
    } catch (caught) {
      const scopes = getRequiredOrganizationScopes(caught);

      if (scopes) {
        setRequiredScopes(scopes);
        setSelectedScopeKey("");
        setError("Choose the company or branch you want to open.");
        return;
      }

      setError(getApiErrorMessage(caught, "Sign in failed. Check your details and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthMarketingCard>
      <AuthCardHeader
        leading={<BrandLockup align="center" logoSize={62} className="mb-6 lg:mb-8" />}
        title="Welcome back"
        description="Sign in to access your workspace"
        descriptionClassName="xl:text-[16px]"
      />

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="identifier" className="text-[13px] font-semibold text-[#101A33]">
            Username or email
          </Label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
              aria-hidden="true"
            />
            <Input
              id="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => {
                setIdentifier(event.target.value);
                setRequiredScopes([]);
                setSelectedScopeKey("");
              }}
              required
              autoFocus
              className={authLoginFieldClassName}
            />
          </div>
        </div>

        {requiredScopes.length > 0 ? (
          <div className="space-y-1.5">
            <Label
              htmlFor="organization-scope"
              className="text-[13px] font-semibold text-[#101A33]"
            >
              Workspace
            </Label>
            <select
              id="organization-scope"
              className={cn(authLoginFieldClassName, "w-full px-3.5")}
              value={selectedScopeKey}
              onChange={(event) => setSelectedScopeKey(event.target.value)}
              required
            >
              <option value="">Select a company or branch</option>
              {requiredScopes.map((scope) => (
                <option key={organizationScopeKey(scope)} value={organizationScopeKey(scope)}>
                  {organizationScopeLabel(scope)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="password" className="text-[13px] font-semibold text-[#101A33]">
              Password
            </Label>
            <Link
              className="text-[13px] font-medium hover:underline"
              style={{ color: AUTH_ACCENT }}
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
              aria-hidden="true"
            />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className={cn(authLoginFieldClassName, "pr-10")}
            />
            <button
              type="button"
              className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[#9AA3B2] hover:text-[#101A33]"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-[#101A33] xl:text-[14px]">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="size-4 rounded-[4px] border-slate-300"
              style={{ accentColor: AUTH_ACCENT }}
            />
            Remember me
          </label>
          <button
            type="button"
            className="text-[13px] font-medium hover:underline"
            style={{ color: AUTH_ACCENT }}
            onClick={() => toast.message("SSO is not enabled for this workspace.")}
          >
            Use Single Sign-On (SSO)
          </button>
        </div>

        {error ? <AuthCardError>{error}</AuthCardError> : null}

        <AuthPrimaryButton type="submit" disabled={submitting}>
          {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
          Sign in
          {!submitting ? <ArrowRight className="size-4" aria-hidden="true" /> : null}
        </AuthPrimaryButton>

        <div className="relative py-1 text-center text-[13px] text-[#9AA3B2]">
          <span className="relative z-10 bg-white px-5">or</span>
          <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#E6EAF0]" />
        </div>

        {capabilities?.selfRegistrationEnabled !== false ? (
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-[8px] border-[#E2E6EE] bg-white text-[14px] font-medium text-[#101A33] shadow-none hover:bg-[#F7F8FA]"
          >
            <Link href="/register">
              <Building2 className="size-4" aria-hidden="true" />
              Create an organization
            </Link>
          </Button>
        ) : null}
      </form>

      <LoginFooter />
    </AuthMarketingCard>
  );
}

function organizationScopeKey(scope: AvailableAuthorizationScope): string {
  return [
    scope.scope,
    scope.companyGroupId ?? "",
    scope.companyId ?? "",
    scope.branchId ?? "",
  ].join(":");
}

function organizationScopeLabel(scope: AvailableAuthorizationScope): string {
  const organization = scope.companyName ?? scope.companyGroupName ?? "Organization";
  return scope.branchName ? `${organization} — ${scope.branchName}` : organization;
}

function toOrganizationScopeSelection(
  scope: AvailableAuthorizationScope
): OrganizationScopeSelection {
  return {
    companyGroupId: scope.companyGroupId,
    companyId: scope.companyId,
    branchId: scope.branchId,
  };
}
