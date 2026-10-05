import { PublicJobPage } from "@/features/recruitment/careers/components/public-job-page";

interface PublicJobRouteProps {
  params: Promise<{ companyCode: string; openingCode: string }>;
}

export default async function PublicJobRoute({ params }: PublicJobRouteProps) {
  const { companyCode, openingCode } = await params;

  return <PublicJobPage companyCode={companyCode} openingCode={openingCode} />;
}
