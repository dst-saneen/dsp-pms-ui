import type { LucideIcon } from "lucide-react";
import { BarChart3, Settings, Shield, Users } from "lucide-react";

const FEATURES = [
  {
    title: "Collaborate",
    description: "Add your team and manage access easily.",
    icon: Users,
    iconClass: "bg-[#FDE8E4] text-[#F15A43]",
  },
  {
    title: "Customize",
    description: "Set up your workspace your way.",
    icon: Settings,
    iconClass: "bg-[#E8F0FE] text-[#4B8DFF]",
  },
  {
    title: "Grow",
    description: "Scale as your business evolves.",
    icon: BarChart3,
    iconClass: "bg-[#E7F8EF] text-[#22A06B]",
  },
  {
    title: "Stay secure",
    description: "Your data is always protected.",
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

function FeatureItem({
  title,
  description,
  icon: Icon,
  iconClass,
}: FeatureItemProps) {
  return (
    <div className="flex items-center gap-4">
      <span
        className={`flex size-11 shrink-0 items-center justify-center rounded-[12px] ${iconClass}`}
      >
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-[#101A33]">{title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-[#71829A]">
          {description}
        </p>
      </div>
    </div>
  );
}

export function FeatureList() {
  return (
    <div className="mt-5 flex flex-col gap-3.5 md:mt-6 md:max-lg:gap-3 lg:mt-[clamp(24px,2.2vw,40px)] lg:gap-5">
      {FEATURES.map((feature) => (
        <FeatureItem key={feature.title} {...feature} />
      ))}
    </div>
  );
}
