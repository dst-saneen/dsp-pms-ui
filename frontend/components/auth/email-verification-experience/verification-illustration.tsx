import Image from "next/image";

/**
 * Verify-step illustration in the same bottom-left zone as login/register.
 * Right-rail plane/envelope layout is intentionally omitted.
 */
export function VerificationIllustration() {
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
        src="/images/email-verification.png"
        alt=""
        width={992}
        height={864}
        priority
        unoptimized
        className="h-auto w-full select-none object-contain object-bottom drop-shadow-[0_10px_24px_rgba(16,26,51,0.07)]"
      />
      <Image
        src="/images/paper-plane.svg"
        alt=""
        width={80}
        height={80}
        unoptimized
        className="absolute -top-[8%] right-[8%] z-20 h-auto w-[min(5.5vw,80px)] select-none object-contain"
      />
    </div>
  );
}
