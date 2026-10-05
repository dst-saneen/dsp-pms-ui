"use client";

import { usePathname } from "next/navigation";

import { ModuleCapabilityGate } from "@/components/common/module-capability-gate";

import { isRecruitmentMockEnabled } from "../constants/feature-flags";
import { RecruitmentMockBanner } from "./recruitment-mock-banner";

interface RecruitmentFeatureGateProps {
  children: React.ReactNode;
}

/**
 * Recruitment pages are entitled by the authenticated capability response.
 * Delivery is independently available to delivery-only users even though its
 * route lives under the recruitment URL hierarchy.
 */
export function RecruitmentFeatureGate({ children }: RecruitmentFeatureGateProps) {
  const pathname = usePathname();

  if (isRecruitmentMockEnabled()) {
    return (
      <>
        <RecruitmentMockBanner />
        {children}
      </>
    );
  }

  const capability = pathname.startsWith("/hr/recruitment/delivery")
    ? "deliveryOperationsNav"
    : "recruitmentNav";

  return (
    <ModuleCapabilityGate capability={capability}>
      <RecruitmentMockBanner />
      {children}
    </ModuleCapabilityGate>
  );
}
