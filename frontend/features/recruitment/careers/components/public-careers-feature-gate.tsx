"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Briefcase } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { authService } from "@/services/auth.service";
import type { AuthCapabilities } from "@/types/auth";
import { isRecruitmentMockEnabled } from "../../constants/feature-flags";

function PublicCareersUnavailable() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <EmptyState
        icon={Briefcase}
        title="Careers page not found"
        description="Public careers are not available for this company right now."
      />
    </div>
  );
}

export function PublicCareersFeatureGate({ children }: { children: ReactNode }) {
  const mockMode = isRecruitmentMockEnabled();
  const [capabilities, setCapabilities] = useState<AuthCapabilities | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (mockMode) {
      return;
    }

    let active = true;

    authService
      .capabilities()
      .then((response) => {
        if (active) setCapabilities(response);
      })
      .catch(() => {
        if (active) setCapabilities(null);
      })
      .finally(() => {
        if (active) setChecked(true);
      });

    return () => {
      active = false;
    };
  }, [mockMode]);

  if (mockMode) {
    return <>{children}</>;
  }

  if (!checked) {
    return (
      <div
        className="flex min-h-dvh items-center justify-center p-6 text-sm text-muted-foreground"
        role="status"
      >
        Checking careers availability…
      </div>
    );
  }

  if (!capabilities?.publicCareersEnabled) {
    return <PublicCareersUnavailable />;
  }

  return <>{children}</>;
}
