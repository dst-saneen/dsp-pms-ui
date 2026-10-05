"use client";

import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { BackgroundBlobs } from "@/components/auth/background-blobs";
import { BrandLockup } from "@/components/auth/brand-logo";
import { SignInLink } from "@/components/auth/sign-in-link";
import type { OrganizationRegistration } from "@/components/auth/use-organization-registration";

import {
  MarketingSection,
  VerificationQuote,
} from "./marketing-section";
import { VerificationCard } from "./verification-card";
import { VerificationIllustration } from "./verification-illustration";

interface EmailVerificationExperienceProps {
  registration: OrganizationRegistration;
}

export function EmailVerificationExperience({
  registration,
}: EmailVerificationExperienceProps) {
  return (
    <AuthMarketingShell
      blobs={<BackgroundBlobs />}
      illustration={<VerificationIllustration />}
      header={
        <div className="relative z-20 mb-3 flex w-full shrink-0 justify-end sm:mb-4 lg:mb-2">
          <SignInLink className="text-right text-[13px] leading-snug sm:text-[14px] sm:leading-none" />
        </div>
      }
      left={
        <>
          <BrandLockup logoSize={56} />
          <div className="pt-6 md:pt-8 lg:pt-[clamp(36px,4.1vw,72px)]">
            <MarketingSection />
          </div>
          <VerificationQuote />
        </>
      }
      card={<VerificationCard registration={registration} />}
    />
  );
}
