import { CareersCompanyPage } from "@/features/recruitment/careers/components/careers-company-page";

interface CareersPageProps {
  params: Promise<{ companyCode: string }>;
}

export default async function CareersPage({ params }: CareersPageProps) {
  const { companyCode } = await params;

  return <CareersCompanyPage companyCode={companyCode} />;
}
