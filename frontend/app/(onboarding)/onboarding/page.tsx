"use client";

import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationOnboardingExperience } from "@/features/organization-onboarding/components/organization-onboarding-experience";
import { organizationOnboardingService } from "@/features/organization-onboarding/organization-onboarding-service";
import { getApiErrorMessage } from "@/services/api-client";

export default function OrganizationOnboardingPage() {
  const statusQuery = useQuery({
    queryKey: ["organization-onboarding"],
    queryFn: organizationOnboardingService.status,
  });

  if (statusQuery.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F7F8FA]">
        <div className="flex items-center gap-2 text-sm text-[#7D8798]">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Preparing your organization…
        </div>
      </main>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#F7F8FA] p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>We could not load organization setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {getApiErrorMessage(statusQuery.error)}
            </p>
            <Button onClick={() => void statusQuery.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return <OrganizationOnboardingExperience status={statusQuery.data} />;
}
