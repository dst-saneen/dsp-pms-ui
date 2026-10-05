import type { ReactNode } from "react";

import { PublicCareersFeatureGate } from "@/features/recruitment/careers/components/public-careers-feature-gate";

export default function CareersLayout({ children }: { children: ReactNode }) {
  return <PublicCareersFeatureGate>{children}</PublicCareersFeatureGate>;
}
