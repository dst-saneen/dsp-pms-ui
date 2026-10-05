import { AuthMarketingShell } from "@/components/auth/auth-marketing-shell";

import { BackgroundBlobs } from "@/components/auth/background-blobs";
import { BrandLockup } from "@/components/auth/brand-logo";
import { DashboardIllustration } from "./dashboard-illustration";
import { HeroSection, TrustFooter } from "./hero-section";
import { LoginCard } from "./login-card";
import { TopNavigation } from "./top-navigation";

export function LoginExperience() {
  return (
    <AuthMarketingShell
      blobs={<BackgroundBlobs />}
      illustration={<DashboardIllustration />}
      topCenter={<TopNavigation />}
      left={
        <>
          <BrandLockup logoSize={56} />
          <div className="pt-8 lg:pt-[clamp(36px,4.1vw,72px)]">
            <HeroSection />
          </div>
          <TrustFooter />
        </>
      }
      card={<LoginCard />}
    />
  );
}
