import { BarChart3, Bolt, Users } from "lucide-react";

const BENEFITS = [
  {
    title: "Save time",
    description: "Most details are pre-filled from registration.",
    icon: Bolt,
    iconClass: "bg-[#FDE8E4] text-[#F15A43]",
  },
  {
    title: "Get your team working",
    description: "Add users and manage access when you are ready.",
    icon: Users,
    iconClass: "bg-[#E8F0FE] text-[#4B8DFF]",
  },
  {
    title: "Grow together",
    description: "You can complete optional items later.",
    icon: BarChart3,
    iconClass: "bg-[#E7F8EF] text-[#22A06B]",
  },
] as const;

/** Left marketing column for the onboarding hub. */
export function OnboardingHubMarketing() {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[10px] font-semibold tracking-[0.12em] text-[#9AA3B2] uppercase">
        Let&apos;s get you started
      </p>
      <h1 className="mt-2 text-[22px] leading-[1.15] font-bold tracking-[-0.03em] text-[#101A33] lg:text-[24px]">
        Your workspace is almost ready!
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-[#7D8798]">
        We&apos;ve already set up the basics from your registration. Finish a
        few required details, then open your workspace.
      </p>

      <ul className="mt-5 space-y-3">
        {BENEFITS.map((benefit) => {
          const Icon = benefit.icon;
          return (
            <li key={benefit.title} className="flex items-start gap-2.5">
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] ${benefit.iconClass}`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[13px] font-semibold text-[#101A33]">
                  {benefit.title}
                </p>
                <p className="mt-0.5 text-[12px] leading-snug text-[#7D8798]">
                  {benefit.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
