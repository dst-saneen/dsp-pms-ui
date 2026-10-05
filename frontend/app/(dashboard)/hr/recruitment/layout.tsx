import { RecruitmentFeatureGate } from "@/features/recruitment/components/recruitment-feature-gate";

export default function RecruitmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RecruitmentFeatureGate>{children}</RecruitmentFeatureGate>;
}
