import Image from "next/image";

export function DashboardIllustration() {
  return (
    <div
      className="pointer-events-none absolute z-[5] hidden lg:block"
      style={{
        bottom: 0,
        left: "min(30.5vw, 540px)",
        width: "min(30vw, 530px)",
      }}
      aria-hidden="true"
    >
      <Image
        src="/images/erp-dashboard.png"
        alt=""
        width={922}
        height={751}
        priority
        unoptimized
        className="h-auto w-full select-none object-contain object-bottom"
      />
      <Image
        src="/images/work-smarter.png"
        alt=""
        width={581}
        height={296}
        unoptimized
        className="absolute -top-[12%] right-[6%] z-20 h-auto w-[min(11.25vw,188px)] select-none object-contain"
      />
    </div>
  );
}
