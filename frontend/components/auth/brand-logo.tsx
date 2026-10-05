import Image from "next/image";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  size?: number;
  className?: string;
}

export function BrandLogo({ size = 56, className }: BrandLogoProps) {
  return (
    <Image
      src="/images/erp-logo.svg"
      alt="Group ERP"
      width={size}
      height={size}
      className={cn(
        "shrink-0 rounded-[16px] shadow-[0_8px_18px_rgba(241,90,67,0.22)]",
        className,
      )}
      unoptimized
      priority
    />
  );
}

interface BrandLockupProps {
  className?: string;
  logoSize?: number;
  align?: "left" | "center";
}

export function BrandLockup({
  className,
  logoSize = 56,
  align = "left",
}: BrandLockupProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3",
        align === "center" && "flex-col gap-2 text-center",
        className,
      )}
    >
      <BrandLogo size={logoSize} />
      <div className={align === "center" ? "space-y-0.5" : undefined}>
        <p
          className={cn(
            "leading-tight font-bold tracking-[-0.02em] text-[#101A33]",
            align === "center" ? "text-[21px]" : "text-[22px]",
          )}
        >
          Group ERP
        </p>
        <p className="text-[14px] text-[#7D8798]">Enterprise Platform</p>
      </div>
    </div>
  );
}
