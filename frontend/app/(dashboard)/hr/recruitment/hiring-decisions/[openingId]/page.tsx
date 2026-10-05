"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-provider";

import { RECRUITMENT_ROUTES } from "@/features/recruitment/constants/routes";
import { HiringComparisonPanel } from "@/features/recruitment/hiring-decisions";

export default function HiringDecisionOpeningPage() {
  const params = useParams();
  const openingId = params.openingId as string;
  const { user } = useAuth();
  const employeeId = user?.employeeId;

  return (
    <PageContainer>
      <PageHeader
        title="Candidate comparison"
        description="Review readiness, evaluation summaries, and headcount before selecting or rejecting."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={RECRUITMENT_ROUTES.hiringDecisions.list}>
              Back to queue
            </Link>
          </Button>
        }
      />

      {!employeeId ? (
        <p className="text-sm text-muted-foreground">
          Link your user account to an employee record to make hiring decisions.
        </p>
      ) : (
        <HiringComparisonPanel
          openingId={openingId}
          hiringManagerEmployeeId={employeeId}
        />
      )}
    </PageContainer>
  );
}
