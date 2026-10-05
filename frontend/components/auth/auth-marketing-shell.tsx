import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface AuthMarketingShellProps {
  /** Ambient background layer (blobs / gradients). */
  blobs?: ReactNode;
  /** Absolute decoration (dashboard illustration, etc.). Hidden below lg by callers as needed. */
  illustration?: ReactNode;
  /** Centered absolute overlay in the padded content area (e.g. login top nav). Shown from lg. */
  topCenter?: ReactNode;
  /** Optional bar above the two-column grid (e.g. register Sign-in link). */
  header?: ReactNode;
  /** Left marketing column (brand, hero, features). Hidden below md. */
  left: ReactNode;
  /** Right auth card (and optional in-column footer via fragment). */
  card: ReactNode;
}

/**
 * Shared two-column marketing frame for login / register / verify.
 *
 * Breakpoints:
 * - &lt; md: card-first, centered; left marketing hidden
 * - md–lg: two columns; card end-aligned in a fixed track
 * - lg+: 57/43 marketing layout + illustrations
 */
export function AuthMarketingShell({
  blobs,
  illustration,
  topCenter,
  header,
  left,
  card,
}: AuthMarketingShellProps) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#FBF8F5]">
      {blobs}
      {illustration}

      <div
        className={cn(
          "relative z-10 mx-auto flex min-h-full w-full min-w-0 flex-col",
          "px-4 pt-4 pb-12 sm:px-5 sm:pb-14",
          "md:px-8 md:pt-6 md:pb-16",
          "lg:px-[clamp(32px,5.2vw,92px)] lg:pr-[clamp(32px,8.8vw,155px)] lg:pt-[clamp(24px,2.85vw,50px)] lg:pb-[clamp(48px,6vh,96px)]",
        )}
      >
        {topCenter ? (
          <div className="absolute top-[clamp(28px,2.85vw,50px)] left-1/2 z-20 hidden -translate-x-1/2 lg:block">
            {topCenter}
          </div>
        ) : null}

        {header}

        <div className="grid w-full min-w-0 flex-1 grid-cols-1 gap-y-6 md:max-lg:grid-cols-[minmax(0,1fr)_minmax(320px,min(46vw,480px))] md:max-lg:items-start md:max-lg:gap-x-5 md:max-lg:gap-y-8 lg:min-h-full lg:grid-cols-[minmax(0,0.57fr)_minmax(0,0.43fr)] lg:items-stretch lg:gap-x-[clamp(16px,1.44vw,24px)] lg:gap-y-0">
          <section className="relative order-2 mt-2 hidden min-h-0 min-w-0 flex-col md:order-1 md:mt-0 md:flex md:max-lg:overflow-hidden">
            {left}
          </section>

          <section className="order-1 flex w-full min-w-0 flex-col items-center pt-1 pb-4 md:order-2 md:items-end md:pt-4 md:pb-6 lg:pt-[clamp(24px,2.4vw,40px)] lg:pb-[clamp(24px,3vh,48px)]">
            {card}
          </section>
        </div>
      </div>
    </div>
  );
}
