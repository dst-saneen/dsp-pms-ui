import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const AUTH_ACCENT = "#F15A43";

/** Outer white card frame shared by login / register / verify. */
export const authMarketingCardClassName =
  "w-full max-w-[560px] rounded-[18px] border border-[rgba(20,30,50,0.06)] bg-white px-4 pt-5 pb-5 shadow-[0_16px_48px_rgba(16,26,51,0.07)] sm:px-5 sm:pt-6 md:px-8 lg:px-10 lg:pt-[30px] lg:pb-6";

export const authCardTitleClassName =
  "text-[26px] font-bold tracking-[-0.03em] text-[#101A33] md:text-[28px] lg:text-[clamp(28px,1.8vw,32px)]";

export const authCardSubtitleClassName =
  "mt-1.5 text-[15px] leading-[1.45] text-[#7D8798]";

export const authPrimaryButtonClassName = cn(
  "h-12 w-full rounded-[8px] text-[15px] font-semibold text-white",
  "shadow-[0_12px_28px_rgba(241,90,67,0.28)] hover:brightness-[0.96]",
  "disabled:opacity-55",
);

/** Register / verify input chrome (white fields). */
export const authFieldClassName =
  "h-12 rounded-[8px] border-[#D9DEE7] bg-white pl-10 text-[14px] text-[#101A33] shadow-none placeholder:text-[#A8B0BD] focus-visible:border-[#F15A43] focus-visible:ring-[#F15A43]/20";

/** Login input chrome (soft blue fields). */
export const authLoginFieldClassName =
  "h-12 rounded-[8px] border-[#D7E4F5] bg-[#EEF4FD] pl-10 text-[14px] text-[#101A33] shadow-none focus-visible:border-[#C5D7F0] focus-visible:ring-[#C5D7F0]/50";

interface AuthMarketingCardProps {
  children: ReactNode;
  className?: string;
}

export function AuthMarketingCard({
  children,
  className,
}: AuthMarketingCardProps) {
  return (
    <div className={cn(authMarketingCardClassName, className)}>{children}</div>
  );
}

interface AuthCardHeaderProps {
  title: string;
  description: ReactNode;
  /** Optional icon badge above the title (register / verify). */
  icon?: LucideIcon;
  /** Optional leading content above the title (e.g. login BrandLockup). */
  leading?: ReactNode;
  descriptionClassName?: string;
}

export function AuthCardHeader({
  title,
  description,
  icon: Icon,
  leading,
  descriptionClassName,
}: AuthCardHeaderProps) {
  return (
    <>
      {leading}
      <div className="mb-7 text-center">
        {Icon ? (
          <div className="mx-auto mb-4 flex size-[52px] items-center justify-center rounded-[15px] bg-[#FDE8E4] text-[#F15A43]">
            <Icon className="size-6" aria-hidden="true" />
          </div>
        ) : null}
        <h2 className={authCardTitleClassName}>{title}</h2>
        <p className={cn(authCardSubtitleClassName, descriptionClassName)}>
          {description}
        </p>
      </div>
    </>
  );
}

interface AuthCardErrorProps {
  children: ReactNode;
  className?: string;
}

export function AuthCardError({ children, className }: AuthCardErrorProps) {
  return (
    <p
      role="alert"
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700",
        className,
      )}
    >
      {children}
    </p>
  );
}

type AuthPrimaryButtonProps = ComponentProps<typeof Button>;

export function AuthPrimaryButton({
  className,
  style,
  ...props
}: AuthPrimaryButtonProps) {
  return (
    <Button
      className={cn(authPrimaryButtonClassName, className)}
      style={{ backgroundColor: AUTH_ACCENT, ...style }}
      {...props}
    />
  );
}
