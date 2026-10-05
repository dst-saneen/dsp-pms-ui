"use client";

import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";
import { EmailVerificationExperience } from "@/components/auth/email-verification-experience";
import { BackgroundBlobs } from "@/components/auth/background-blobs";
import { BrandLockup } from "@/components/auth/brand-logo";
import { SignInLink } from "@/components/auth/sign-in-link";
import { useOrganizationRegistration } from "@/components/auth/use-organization-registration";

import {
  MarketingSection,
  OrganizationQuote,
} from "./marketing-section";
import { OrganizationFormCard } from "./organization-form-card";
import { OrganizationIllustration } from "./organization-illustration";
export function CreateOrganizationExperience() {
  const registration = useOrganizationRegistration();

  if (registration.challenge) {
    return <EmailVerificationExperience registration={registration} />;
  }

  return (
    <AuthMarketingShell
      blobs={<BackgroundBlobs />}
      illustration={<OrganizationIllustration />}
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
          <OrganizationQuote />
        </>
      }
      card={<OrganizationFormCard registration={registration} />}
    />
  );
}
