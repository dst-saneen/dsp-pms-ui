"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, UserRoundCheck } from "lucide-react";

import { AppBrand } from "@/components/layout/app-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";
import { authService } from "@/services/auth.service";
import type {
  AvailableAuthorizationScope,
  InvitationInspection,
  OrganizationScopeSelection,
} from "@/types/auth";

export function AcceptInvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [invitation, setInvitation] = useState<InvitationInspection | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "This invitation link is incomplete."
  );
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [selectedScopeKey, setSelectedScopeKey] = useState("");

  useEffect(() => {
    let active = true;

    if (!token) {
      return;
    }

    authService
      .inspectInvitation(token)
      .then((result) => {
        if (active) setInvitation(result);
      })
      .catch((caught) => {
        if (active) setError(getApiErrorMessage(caught, "This invitation is invalid or expired."));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    const selectedScope = invitation?.availableScopes?.find(
      (scope) => organizationScopeKey(scope) === selectedScopeKey
    );

    if (invitation?.scopeSelectionRequired && !selectedScope) {
      setError("Choose the company or branch you want to open.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.acceptInvitation(
        token,
        password,
        selectedScope ? toOrganizationScopeSelection(selectedScope) : undefined
      );
      setAccepted(true);
      router.replace("/dashboard");
    } catch (caught) {
      setError(getApiErrorMessage(caught, "The invitation could not be accepted."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <AppBrand />
      </div>
      <Card className="border-border/90 bg-card shadow-[0_20px_60px_rgba(17,24,39,0.10)]">
        <CardHeader className="space-y-2 pb-4 text-center">
          <div className="bg-primary-soft text-primary mx-auto flex size-11 items-center justify-center rounded-xl">
            {accepted ? <CheckCircle2 className="size-5" /> : <UserRoundCheck className="size-5" />}
          </div>
          <CardTitle className="text-2xl">
            {accepted ? "Account activated" : "Accept your invitation"}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {accepted
              ? "Your password is set and your Group ERP account is ready."
              : invitation
                ? `Welcome ${invitation.displayName}. This invitation was sent to ${invitation.maskedEmail}.`
                : "Confirm the invitation and choose a secure password."}
          </p>
        </CardHeader>
        <CardContent>
          {accepted ? (
            <Button asChild className="w-full">
              <Link href="/dashboard">Continue to dashboard</Link>
            </Button>
          ) : loading ? (
            <div className="text-muted-foreground flex min-h-32 items-center justify-center gap-2 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Checking invitation…
            </div>
          ) : invitation ? (
            <form className="space-y-4" onSubmit={submit}>
              {invitation.scopeSelectionRequired && invitation.availableScopes ? (
                <div className="space-y-1.5">
                  <Label htmlFor="invitation-organization-scope">Workspace</Label>
                  <select
                    id="invitation-organization-scope"
                    className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                    value={selectedScopeKey}
                    onChange={(event) => setSelectedScopeKey(event.target.value)}
                    required
                  >
                    <option value="">Select a company or branch</option>
                    {invitation.availableScopes.map((scope) => (
                      <option key={organizationScopeKey(scope)} value={organizationScopeKey(scope)}>
                        {organizationScopeLabel(scope)}
                      </option>
                    ))}
                  </select>
                  <p className="text-muted-foreground text-xs">
                    Your invitation grants more than one workspace. Choose where to start.
                  </p>
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="invitation-password">Password</Label>
                <Input
                  id="invitation-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={invitation.passwordPolicy.minimumLength}
                  maxLength={invitation.passwordPolicy.maximumLength}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoFocus
                />
                <p className="text-muted-foreground text-xs">
                  Use at least {invitation.passwordPolicy.minimumLength} characters. Do not use your
                  email as the password.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invitation-confirmation">Confirm password</Label>
                <Input
                  id="invitation-confirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={invitation.passwordPolicy.minimumLength}
                  maxLength={invitation.passwordPolicy.maximumLength}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                />
              </div>
              {error ? <ErrorMessage message={error} /> : null}
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Activate account
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {error ? <ErrorMessage message={error} /> : null}
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Return to sign in</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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

function ErrorMessage({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
    >
      {message}
    </p>
  );
}
