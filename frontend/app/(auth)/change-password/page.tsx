"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LoaderCircle } from "lucide-react";

import { AuthCenteredShell } from "@/components/auth/auth-centered-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  appendNextQuery,
  consumePostAuthDestination,
  peekAuthNext,
  rememberAuthNext,
  resolveSafeNextPath,
} from "@/lib/auth-next-path";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

function ChangePasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, user, changePassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const urlNext = searchParams.get("next");
  const intendedNext = resolveSafeNextPath(urlNext ?? peekAuthNext());

  useEffect(() => {
    if (urlNext) {
      rememberAuthNext(urlNext);
    }
  }, [urlNext]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace(appendNextQuery("/login", intendedNext));
    } else if (status === "authenticated" && user && !user.mustChangePassword) {
      router.replace(consumePostAuthDestination(urlNext));
    }
  }, [intendedNext, router, status, urlNext, user]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("The new passwords do not match.");
      return;
    }

    const identity = (user?.email ?? user?.username ?? "").trim().toLowerCase();
    if (identity && newPassword.trim().toLowerCase() === identity) {
      setError("Password must not be the same as your email or username.");
      return;
    }

    setSubmitting(true);

    try {
      await changePassword(currentPassword, newPassword);
      // Keep next in storage for AuthenticatedApp → onboarding hop; do not consume yet.
      rememberAuthNext(intendedNext);
      router.replace(intendedNext);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "The password could not be changed."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCenteredShell>
      <Card className="border-border/90 bg-card shadow-[0_20px_60px_rgba(17,24,39,0.10)]">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Create your password</CardTitle>
          <p className="text-sm text-muted-foreground">
            Update your password before entering the ERP.
          </p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Temporary password</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                minLength={12}
                maxLength={128}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                Use 12–128 characters. A password manager is recommended.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}

            <Button className="w-full" type="submit" disabled={submitting}>
              {submitting ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : null}
              Save password
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="ghost"
              onClick={() => void logout()}
            >
              Sign out
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}

function ChangePasswordFallback() {
  return (
    <AuthCenteredShell>
      <Card className="border-border/90 bg-card shadow-[0_20px_60px_rgba(17,24,39,0.10)]">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <KeyRound className="size-5" aria-hidden="true" />
          </div>
          <CardTitle className="text-2xl">Create your password</CardTitle>
          <p className="text-sm text-muted-foreground">Loading…</p>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <LoaderCircle className="size-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    </AuthCenteredShell>
  );
}

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<ChangePasswordFallback />}>
      <ChangePasswordContent />
    </Suspense>
  );
}
