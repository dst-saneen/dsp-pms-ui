"use client";

import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Info,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";

import {
  AuthCardError,
  AuthCardHeader,
  AuthMarketingCard,
  AuthPrimaryButton,
  authFieldClassName,
} from "@/components/auth/auth-marketing-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { OrganizationRegistration } from "@/components/auth/use-organization-registration";

interface OrganizationFormCardProps {
  registration: OrganizationRegistration;
}

export function OrganizationFormCard({
  registration,
}: OrganizationFormCardProps) {
  const {
    details,
    updateDetails,
    error,
    submitting,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleStart,
  } = registration;

  return (
    <AuthMarketingCard>
      <AuthCardHeader
        icon={Building2}
        title="Create your organization"
        description="Create your Company Group and owner account."
      />

      <form className="space-y-4" onSubmit={handleStart} noValidate>
        <div className="space-y-1.5">
          <Label
            htmlFor="organization-name"
            className="text-[13px] font-semibold text-[#101A33]"
          >
            Organization name
          </Label>
          <div className="relative">
            <Building2
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
              aria-hidden="true"
            />
            <Input
              id="organization-name"
              name="organization-name"
              autoComplete="organization"
              value={details.organizationName}
              onChange={(event) =>
                updateDetails("organizationName", event.target.value)
              }
              placeholder="Enter your organization name"
              required
              minLength={2}
              autoFocus
              className={cn(
                authFieldClassName,
                "border-[#F15A43] focus-visible:border-[#F15A43]",
              )}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="legal-country-code"
            className="text-[13px] font-semibold text-[#101A33]"
          >
            Legal country code
          </Label>
          <Input
            id="legal-country-code"
            name="legal-country-code"
            value={details.legalCountryCode}
            onChange={(event) =>
              updateDetails("legalCountryCode", event.target.value)
            }
            placeholder="IN"
            required
            minLength={2}
            maxLength={2}
            autoCapitalize="characters"
            className={authFieldClassName}
          />
          <p className="text-xs text-[#667085]">
            ISO two-letter code used for country-specific setup and validation.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="display-name"
            className="text-[13px] font-semibold text-[#101A33]"
          >
            Full name
          </Label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
              aria-hidden="true"
            />
            <Input
              id="display-name"
              name="display-name"
              autoComplete="name"
              value={details.displayName}
              onChange={(event) =>
                updateDetails("displayName", event.target.value)
              }
              placeholder="Enter your full name"
              required
              minLength={2}
              className={authFieldClassName}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor="registration-email"
            className="text-[13px] font-semibold text-[#101A33]"
          >
            Business email
          </Label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
              aria-hidden="true"
            />
            <Input
              id="registration-email"
              name="registration-email"
              type="email"
              autoComplete="email"
              value={details.email}
              onChange={(event) => updateDetails("email", event.target.value)}
              placeholder="name@yourcompany.com"
              required
              className={authFieldClassName}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 sm:gap-x-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="registration-password"
              className="text-[13px] font-semibold text-[#101A33]"
            >
              Password
            </Label>
            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
                aria-hidden="true"
              />
              <Input
                id="registration-password"
                name="registration-password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={details.password}
                onChange={(event) =>
                  updateDetails("password", event.target.value)
                }
                placeholder="Create a password"
                required
                minLength={12}
                maxLength={128}
                className={cn(authFieldClassName, "pr-10")}
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
          <div className="space-y-1.5">
            <Label
              htmlFor="confirm-password"
              className="text-[13px] font-semibold text-[#101A33]"
            >
              Confirm password
            </Label>
            <div className="relative">
              <LockKeyhole
                className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-[#9AA3B2]"
                aria-hidden="true"
              />
              <Input
                id="confirm-password"
                name="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                value={details.confirmPassword}
                onChange={(event) =>
                  updateDetails("confirmPassword", event.target.value)
                }
                placeholder="Confirm your password"
                required
                minLength={12}
                maxLength={128}
                className={cn(authFieldClassName, "pr-10")}
              />
              <button
                type="button"
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[#9AA3B2] hover:text-[#101A33]"
                onClick={() => setShowConfirmPassword((value) => !value)}
                aria-label={
                  showConfirmPassword
                    ? "Hide confirm password"
                    : "Show confirm password"
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2.5 rounded-[8px] bg-[#F3F6FA] px-3 py-2.5">
          <Info
            className="mt-0.5 size-4 shrink-0 text-[#8A94A6]"
            aria-hidden="true"
          />
          <p className="text-[12px] leading-[1.45] text-[#71829A]">
            Use at least 12 characters. Do not use your email as the password.
            Your password is never sent by email.
          </p>
        </div>

        {error ? <AuthCardError>{error}</AuthCardError> : null}

        <AuthPrimaryButton type="submit" disabled={submitting}>
          {submitting ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Send verification code
          {!submitting ? (
            <ArrowRight className="size-4" aria-hidden="true" />
          ) : null}
        </AuthPrimaryButton>
      </form>
    </AuthMarketingCard>
  );
}
