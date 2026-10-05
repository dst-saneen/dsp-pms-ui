import { FeatureList } from "./feature-list";

export function MarketingSection() {
  return (
    <div className="relative z-20 max-w-[560px]">
      <h1 className="text-[28px] leading-[1.05] font-bold tracking-[-0.04em] text-[#101A33] md:text-[32px] md:max-lg:text-[30px] lg:text-[clamp(42px,3.15vw,58px)] lg:leading-[1.02]">
        Create your
        <br />
        <span className="text-[#F15A43]">organization</span>
      </h1>
      <p className="mt-4 max-w-[460px] text-[14px] leading-[1.45] text-[#7D8798] md:mt-5 md:text-[15px] lg:mt-[clamp(20px,1.9vw,32px)] lg:text-[clamp(15px,0.96vw,17px)]">
        Get started with Group ERP and bring your team, data and processes
        together in one secure workspace.
      </p>
      <FeatureList />
    </div>
  );
}

export function OrganizationQuote() {
  return (
    <div className="relative z-20 mt-auto hidden max-w-[420px] pb-2 lg:block">
      <span className="mb-3 block h-[2px] w-12 bg-[#F15A43]" />
      <p className="text-[14px] leading-relaxed text-[#7D8798] italic">
        &ldquo;Simpler systems. Stronger teams. Brighter possibilities.&rdquo;
      </p>
    </div>
  );
}
