"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";
import { getApiErrorMessage } from "@/services/api-client";
import type { RegistrationStartResponse } from "@/types/auth";

export interface DetailsState {
  organizationName: string;
  legalCountryCode: string;
  displayName: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY_DETAILS: DetailsState = {
  organizationName: "",
  legalCountryCode: "",
  displayName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

function secondsUntil(value: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(value).getTime() - now) / 1_000));
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateDetails(details: DetailsState): string | null {
  if (!details.organizationName.trim()) {
    return "Enter your organization name.";
  }
  if (!/^[A-Za-z]{2}$/.test(details.legalCountryCode.trim())) {
    return "Enter a two-letter legal country code.";
  }
  if (!details.displayName.trim()) {
    return "Enter your full name.";
  }
  const email = details.email.trim();
  if (!email) {
    return "Enter your business email.";
  }
  if (!isValidEmail(email)) {
    return "Enter a valid business email address.";
  }
  if (!details.password) {
    return "Create a password.";
  }
  if (details.password.length < 12) {
    return "Use at least 12 characters for your password.";
  }
  if (details.password.trim().toLowerCase() === email.toLowerCase()) {
    return "Password must not be the same as your email.";
  }
  if (details.password !== details.confirmPassword) {
    return "Passwords do not match.";
  }
  return null;
}

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function useOrganizationRegistration() {
  const router = useRouter();
  const { completeAuthentication, status } = useAuth();
  const [details, setDetails] = useState<DetailsState>(EMPTY_DETAILS);
  const [challenge, setChallenge] = useState<RegistrationStartResponse | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  useEffect(() => {
    if (!challenge) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const expiresIn = useMemo(
    () => (challenge ? secondsUntil(challenge.expiresAt, now) : 0),
    [challenge, now],
  );
  const resendIn = useMemo(
    () => (challenge ? secondsUntil(challenge.resendAvailableAt, now) : 0),
    [challenge, now],
  );

  function updateDetails(field: keyof DetailsState, value: string) {
    setDetails((current) => ({ ...current, [field]: value }));
  }

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validateDetails(details);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const response = await authService.registerOrganization({
        organizationName: details.organizationName,
        legalCountryCode: details.legalCountryCode.trim().toUpperCase(),
        displayName: details.displayName,
        email: details.email,
        password: details.password,
      });

      setChallenge(response);
      setCode(response.developmentVerificationCode ?? "");
      setNow(Date.now());
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "Registration could not be started. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!challenge) return;
    if (code.length !== 6) {
      setError("Enter the six-digit verification code.");
      return;
    }
    if (expiresIn === 0) {
      setError("This code has expired. Resend a new one.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await authService.verifyOrganization(
        challenge.registrationId,
        code,
      );

      completeAuthentication(response);
      router.replace("/onboarding");
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "That code doesn't look right. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (!challenge || resendIn > 0) return;

    setError(null);
    setResending(true);

    try {
      const response = await authService.resendRegistration(
        challenge.registrationId,
      );
      setChallenge(response);
      setCode(response.developmentVerificationCode ?? "");
      setNow(Date.now());
    } catch (caught) {
      setError(
        getApiErrorMessage(
          caught,
          "A new verification code could not be sent.",
        ),
      );
    } finally {
      setResending(false);
    }
  }

  function restart() {
    setChallenge(null);
    setCode("");
    setError(null);
  }

  return {
    details,
    updateDetails,
    challenge,
    code,
    setCode,
    error,
    submitting,
    resending,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    expiresIn,
    resendIn,
    handleStart,
    handleVerify,
    handleResend,
    restart,
  };
}

export type OrganizationRegistration = ReturnType<
  typeof useOrganizationRegistration
>;
