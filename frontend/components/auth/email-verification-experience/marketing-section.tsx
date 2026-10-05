import { ShieldCheck } from "lucide-react";

import { BenefitList } from "./benefit-list";

export function MarketingSection() {
  return (
    <div className="relative z-20 max-w-[560px]">
      <h1 className="text-[28px] leading-[1.05] font-bold tracking-[-0.04em] text-[#101A33] md:text-[32px] md:max-lg:text-[30px] lg:text-[clamp(42px,3.15vw,58px)] lg:leading-[1.02]">
        You&apos;re almost
        <br />
        <span className="text-[#F15A43]">there!</span>
      </h1>
      <p className="mt-4 max-w-[460px] text-[14px] leading-[1.45] text-[#7D8798] md:mt-5 md:text-[15px] lg:mt-[clamp(20px,1.9vw,32px)] lg:text-[clamp(15px,0.96vw,17px)]">
        Verify your email to activate your workspace and start building with
        Group ERP.
      </p>
      <BenefitList />
    </div>
  );
}

export function VerificationQuote() {
  return (
    <div className="relative z-20 mt-auto hidden max-w-[420px] pb-2 lg:block">
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 size-5 shrink-0 text-[#101A33]"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <div>
          <p className="text-[14px] font-medium text-[#101A33]">
            Your security is our priority
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#7D8798]">
            We never share your information.
          </p>
        </div>
      </div>
    </div>
  );
}
