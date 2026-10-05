import type { LucideIcon } from "lucide-react";
import { Shield, Users, Zap } from "lucide-react";

const BENEFITS = [
  {
    title: "Fast Setup",
    description: "Get started in minutes",
    icon: Zap,
    iconClass: "bg-[#FDE8E4] text-[#F15A43]",
  },
  {
    title: "Secure Access",
    description: "Your data stays protected",
    icon: Shield,
    iconClass: "bg-[#E8F0FE] text-[#4B8DFF]",
  },
  {
    title: "Better Together",
    description: "Empower your team",
    icon: Users,
    iconClass: "bg-[#E7F8EF] text-[#22A06B]",
  },
] as const;

interface BenefitItemProps {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClass: string;
}

function BenefitItem({
  title,
  description,
  icon: Icon,
  iconClass,
}: BenefitItemProps) {
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

export function BenefitList() {
  return (
    <div className="mt-5 flex flex-col gap-3.5 md:mt-6 md:max-lg:gap-3 lg:mt-[clamp(24px,2.2vw,40px)] lg:gap-5">
      {BENEFITS.map((benefit) => (
        <BenefitItem key={benefit.title} {...benefit} />
      ))}
    </div>
  );
}
