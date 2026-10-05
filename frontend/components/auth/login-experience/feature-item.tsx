import type { LucideIcon } from "lucide-react";
import { BarChart3, Settings, Shield, Users } from "lucide-react";

const FEATURES = [
  {
    title: "People",
    description: "Manage your workforce efficiently.",
    icon: Users,
    iconClass: "bg-[#FDE8E4] text-[#F15A43]",
  },
  {
    title: "Insights",
    description: "Real-time reports and analytics.",
    icon: BarChart3,
    iconClass: "bg-[#E8F0FE] text-[#4B8DFF]",
  },
  {
    title: "Operations",
    description: "Unified processes across departments.",
    icon: Settings,
    iconClass: "bg-[#E7F8EF] text-[#22A06B]",
  },
  {
    title: "Secure",
    description: "Your data, always protected.",
    icon: Shield,
    iconClass: "bg-[#EEE8FE] text-[#7C5CFC]",
  },
] as const;

interface FeatureItemProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}

export function FeatureItem({
  title,
  description,
  icon: Icon,
  iconClass,
}: FeatureItemProps) {
  return (
    <div className="flex items-start gap-[clamp(12px,1.08vw,18px)]">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-[15px] lg:size-[clamp(44px,3.23vw,54px)] ${iconClass}`}
      >
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[#101A33] lg:text-[clamp(15px,0.96vw,16px)]">
          {title}
        </p>
        <p className="mt-0.5 max-w-[180px] text-[13px] leading-snug text-[#7D8798] lg:text-[clamp(13px,0.84vw,14px)]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function FeatureGrid() {
  return (
    <div className="mt-6 grid max-w-[520px] grid-cols-1 gap-x-[clamp(32px,4.3vw,72px)] gap-y-5 md:mt-8 md:max-lg:grid-cols-1 lg:grid-cols-2 lg:gap-y-[clamp(20px,1.9vw,32px)]">
      {FEATURES.map((feature) => (
        <FeatureItem key={feature.title} {...feature} />
      ))}
    </div>
  );
}
