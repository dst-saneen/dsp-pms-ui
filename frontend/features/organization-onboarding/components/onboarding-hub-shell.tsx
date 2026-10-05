import type { ReactNode } from "react";

import { BrandLockup } from "@/components/auth/brand-logo";
import { cn } from "@/lib/utils";

interface OnboardingHubShellProps {
  marketing: ReactNode;
  main: ReactNode;
  summary: ReactNode;
  className?: string;
}

/** Three-column readiness hub frame for organization onboarding. */
export function OnboardingHubShell({
  marketing,
  main,
  summary,
  className,
}: OnboardingHubShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#F7F8FA]",
        className,
      )}
    >
      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[#E8ECF1] bg-white/80 px-2.5 py-2 backdrop-blur-sm sm:px-3 lg:px-4">
        <BrandLockup logoSize={36} />
        <p className="text-sm text-[#7D8798]">Organization setup</p>
      </header>

      <div className="relative z-10 grid w-full flex-1 grid-cols-1 gap-2.5 px-2.5 py-2.5 pb-4 sm:gap-3 sm:px-3 sm:py-3 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,2.3fr)_minmax(0,1fr)] lg:items-start lg:gap-3 lg:px-4 lg:py-3 lg:pb-4">
        <aside className="order-2 min-w-0 lg:order-1 lg:sticky lg:top-3">
          {marketing}
        </aside>

        <section className="order-1 min-w-0 lg:order-2">{main}</section>

        <aside className="order-3 min-w-0 lg:sticky lg:top-3">{summary}</aside>
      </div>
    </div>
  );
}
