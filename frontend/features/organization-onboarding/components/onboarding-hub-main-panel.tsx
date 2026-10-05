import type { ReactNode } from "react";
import { Check, Clock3, Star } from "lucide-react";

import type { OrganizationOnboardingStatus } from "../types";
import { getOnboardingHubProgress } from "../hub-progress";

import { AlreadySetupSection } from "./already-setup-section";
import { OptionalSetupSection } from "./optional-setup-section";
import { RequiredSetupSection } from "./required-setup-section";

interface OnboardingHubMainPanelProps {
  status: OrganizationOnboardingStatus;
}

/** Center hub panel — progress, completed cards, required actions. */
export function OnboardingHubMainPanel({ status }: OnboardingHubMainPanelProps) {
  const progress = getOnboardingHubProgress(status);

  return (
    <div className="rounded-[12px] border border-[rgba(20,30,50,0.06)] bg-white p-3 shadow-[0_8px_24px_rgba(16,26,51,0.04)] sm:p-4">
      <div className="space-y-2 border-b border-[#EEF1F5] pb-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[13px] font-medium text-[#7D8798]">Setup progress</p>
          <p className="text-[13px] font-semibold text-[#22A06B]">
            {progress.percent}% complete
          </p>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-[#EEF1F5]"
          role="progressbar"
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Organization setup progress"
        >
          <div
            className="h-full rounded-full bg-[#22A06B] transition-[width] duration-300"
            style={{ width: `${progress.percent}%` }}
          />
        </div>

        <div className="pt-1">
          <h2 className="text-[20px] font-bold tracking-[-0.02em] text-[#101A33] sm:text-[22px]">
            {progress.headline}
          </h2>
          <p className="mt-1 text-[13px] text-[#7D8798] sm:text-[14px]">{progress.subheadline}</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <StatusPill
            icon={<Check className="size-3.5" aria-hidden="true" />}
            label={`${progress.completedCore} of ${progress.totalCore} required`}
            className="border-[#D8F0E3] bg-[#F3FBF7] text-[#1F7A4D]"
          />
          <StatusPill
            icon={<Clock3 className="size-3.5" aria-hidden="true" />}
            label={progress.timeLabel}
            className="border-[#D7E4F5] bg-[#EEF4FD] text-[#3B6FB6]"
          />
          <StatusPill
            icon={<Star className="size-3.5" aria-hidden="true" />}
            label={
              progress.remainingCore === 0
                ? "All required items done"
                : `${progress.remainingCore} required left`
            }
            className="border-[#F8D9CE] bg-[#FFF7F4] text-[#C84E32]"
          />
        </div>

        <details className="rounded-[10px] border border-[#E8ECF1] bg-[#F8F9FB] px-3 py-2 text-[12px] text-[#5C6675]">
          <summary className="cursor-pointer font-semibold text-[#101A33]">
            What each level means
          </summary>
          <ul className="mt-2 space-y-2">
            {progress.levelGuide.map((item) => (
              <li key={item.title}>
                <span className="font-medium text-[#101A33]">{item.title}.</span>{" "}
                {item.body}
              </li>
            ))}
          </ul>
        </details>
      </div>

      <div className="space-y-3 pt-3">
        <AlreadySetupSection status={status} />
        <RequiredSetupSection status={status} />
        <OptionalSetupSection status={status} />
      </div>
    </div>
  );
}

function StatusPill({
  icon,
  label,
  className,
}: {
  icon: ReactNode;
  label: string;
  className: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium ${className}`}
    >
      {icon}
      {label}
    </span>
  );
}
