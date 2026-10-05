"use client";

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Mail,
  RefreshCw,
} from "lucide-react";

import {
  AUTH_ACCENT,
  AuthCardError,
  AuthCardHeader,
  AuthMarketingCard,
  AuthPrimaryButton,
} from "@/components/auth/auth-marketing-card";
import { Label } from "@/components/ui/label";
import {
  formatDuration,
  type OrganizationRegistration,
} from "@/components/auth/use-organization-registration";
import { cn } from "@/lib/utils";

interface VerificationCardProps {
  registration: OrganizationRegistration;
}

export function VerificationCard({ registration }: VerificationCardProps) {
  const {
    challenge,
    code,
    setCode,
    error,
    submitting,
    resending,
    expiresIn,
    resendIn,
    handleVerify,
    handleResend,
    restart,
  } = registration;

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  if (!challenge) return null;

  const digits = Array.from({ length: 6 }, (_, index) => code[index] ?? "");
  const invalid = Boolean(error);

  function focusIndex(index: number) {
    const next = Math.max(0, Math.min(5, index));
    inputsRef.current[next]?.focus();
    inputsRef.current[next]?.select();
  }

  function updateCode(nextDigits: string[]) {
    setCode(nextDigits.join("").replace(/\D/g, "").slice(0, 6));
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    updateCode(next);
    if (digit) focusIndex(index + 1);
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
        updateCode(next);
        return;
      }
      if (index > 0) {
        next[index - 1] = "";
        updateCode(next);
        focusIndex(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusIndex(index - 1);
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusIndex(index + 1);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    setCode(pasted);
    focusIndex(Math.min(pasted.length, 5));
  }

  return (
    <AuthMarketingCard>
      <AuthCardHeader
        icon={Mail}
        title="Verify your email"
        description={
          <>
            Enter the six-digit code sent to
            <br />
            {challenge.maskedEmail}.
          </>
        }
        descriptionClassName="mx-auto max-w-[360px]"
      />

      <form className="space-y-4" onSubmit={handleVerify} noValidate>
        <div className="space-y-3">
          <Label
            htmlFor="otp-0"
            className="text-[13px] font-semibold text-[#101A33]"
          >
            Verification code
          </Label>
          <div className="flex w-full min-w-0 justify-between gap-1.5 sm:gap-3">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputsRef.current[index] = node;
                }}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                maxLength={1}
                value={digit}
                onChange={(event) =>
                  handleDigitChange(index, event.target.value)
                }
                onKeyDown={(event) => handleKeyDown(index, event)}
                onPaste={handlePaste}
                onFocus={(event) => event.currentTarget.select()}
                aria-label={`Digit ${index + 1} of 6`}
                aria-invalid={invalid}
                className={cn(
                  "h-11 w-full max-w-[68px] min-w-0 flex-1 basis-0 rounded-[10px] border bg-white text-center text-[18px] font-semibold text-[#101A33] outline-none focus:z-10 sm:h-12 sm:text-[22px]",
                  invalid
                    ? "border-red-300 focus:border-red-400 focus:ring-3 focus:ring-red-200/50"
                    : "border-[#D9DEE7] focus:border-[#F15A43] focus:ring-3 focus:ring-[#F15A43]/20",
                )}
              />
            ))}
          </div>
        </div>

        <div
          id="verification-timing"
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-[13px] text-[#71829A] sm:text-[14px]"
        >
          <span>
            {expiresIn > 0
              ? `Code expires in ${formatDuration(expiresIn)}`
              : "Code expired"}
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 font-medium hover:underline disabled:opacity-50"
            style={{ color: AUTH_ACCENT }}
            disabled={resending || resendIn > 0}
            onClick={() => void handleResend()}
          >
            {resending ? (
              <LoaderCircle
                className="size-3.5 animate-spin"
                aria-hidden="true"
              />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden="true" />
            )}
            {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
          </button>
        </div>

        {challenge.deliveryStatus === "FAILED" ? (
          <p
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-[#101A33]"
          >
            Email delivery failed. Your registration is saved; use Resend when
            the countdown finishes.
          </p>
        ) : null}

        {challenge.developmentVerificationCode ? (
          <div className="rounded-xl border border-[#D7E4F5] bg-[#EEF4FD] px-3 py-2 text-sm">
            <p className="font-medium text-[#101A33]">
              Development verification code
            </p>
            <p className="mt-1 font-mono text-lg tracking-[0.2em] text-[#4B8DFF]">
              {challenge.developmentVerificationCode}
            </p>
          </div>
        ) : null}

        {error ? <AuthCardError>{error}</AuthCardError> : null}

        <AuthPrimaryButton
          type="submit"
          disabled={submitting || code.length !== 6 || expiresIn === 0}
        >
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Verify and continue
          {!submitting ? (
            <ArrowRight className="size-4" aria-hidden="true" />
          ) : null}
        </AuthPrimaryButton>

        <div className="pt-1">
          <span className="mb-4 block h-px w-full bg-[#E8ECF1]" />
          <button
            type="button"
            className="mx-auto flex items-center gap-2 text-[14px] font-medium text-[#101A33] hover:underline"
            onClick={restart}
            disabled={submitting}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Use different details
          </button>
        </div>
      </form>
    </AuthMarketingCard>
  );
}
