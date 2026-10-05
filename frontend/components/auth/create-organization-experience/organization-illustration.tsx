import Image from "next/image";

/**
 * Register-page illustration in the same bottom-left zone as login's dashboard.
 * Plant and right-rail assets are intentionally omitted.
 */
export function OrganizationIllustration() {
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
        src="/images/organization-dashboard.png"
        alt=""
        width={1152}
        height={864}
        priority
        unoptimized
        className="h-auto w-full select-none object-contain object-bottom drop-shadow-[0_10px_24px_rgba(16,26,51,0.07)]"
      />
      <Image
        src="/images/build-together.svg"
        alt=""
        width={260}
        height={130}
        unoptimized
        className="absolute -top-[10%] right-[4%] z-20 h-auto w-[min(11.25vw,188px)] select-none object-contain"
      />
    </div>
  );
}
