"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CheckCircle2, KeyRound, LoaderCircle } from "lucide-react";

import { AppBrand } from "@/components/layout/app-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiErrorMessage } from "@/services/api-client";
import { authService } from "@/services/auth.service";

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(
    token ? null : "This password reset link is incomplete."
  );
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      setComplete(true);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "The password could not be reset."));
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
            {complete ? <CheckCircle2 className="size-5" /> : <KeyRound className="size-5" />}
          </div>
          <CardTitle className="text-2xl">
            {complete ? "Password changed" : "Choose a new password"}
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {complete
              ? "All existing sessions were signed out for your protection."
              : "Use a unique password with at least 12 characters."}
          </p>
        </CardHeader>
        <CardContent>
          {complete ? (
            <Button asChild className="w-full">
              <Link href="/login">Continue to sign in</Link>
            </Button>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={!token}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-new-password">Confirm password</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  required
                  disabled={!token}
                />
              </div>
              {error ? (
                <p role="alert" className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {error}
                </p>
              ) : null}
              <Button className="w-full" type="submit" disabled={submitting || !token}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Reset password
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/login">Back to sign in</Link>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
