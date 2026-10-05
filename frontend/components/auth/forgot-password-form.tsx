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

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await authService.forgotPassword(email);
      setMessage(result.message);
      setDevelopmentUrl(result.developmentActionUrl ?? null);
    } catch (caught) {
      setError(getApiErrorMessage(caught, "The request could not be completed."));
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
            {message ? <CheckCircle2 className="size-5" /> : <KeyRound className="size-5" />}
          </div>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <p className="text-muted-foreground text-sm">
            Enter your account email and we will send a time-limited reset link.
          </p>
        </CardHeader>
        <CardContent>
          {message ? (
            <div className="space-y-4">
              <p role="status" className="border-success/20 bg-success/5 text-foreground rounded-lg border p-3 text-sm">
                {message}
              </p>
              {developmentUrl ? (
                <Button asChild className="w-full">
                  <Link href={developmentUrl}>
                    Open development reset link
                  </Link>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Return to sign in</Link>
              </Button>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={submit}>
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">Email</Label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  autoFocus
                />
              </div>
              {error ? (
                <p role="alert" className="border-destructive/20 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm">
                  {error}
                </p>
              ) : null}
              <Button className="w-full" type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
                Send reset link
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
