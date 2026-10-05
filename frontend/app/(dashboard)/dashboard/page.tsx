"use client";

import { useQuery } from "@tanstack/react-query";

import { PageContainer } from "@/components/common/page-container";
import { getManagerDashboardData } from "@/features/manager-dashboard/data-provider";
import { ManagerDashboard } from "@/features/manager-dashboard/manager-dashboard";

function DashboardSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 animate-pulse">
      <div className="bg-muted h-10 w-80 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-muted h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="bg-muted h-72 rounded-xl" />
        <div className="bg-muted h-72 rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const query = useQuery({
    queryKey: ["manager-dashboard"],
    queryFn: getManagerDashboardData,
  });

  return (
    <PageContainer className="gap-4">
      {query.isLoading || !query.data ? (
        <DashboardSkeleton />
      ) : (
        <ManagerDashboard
          payload={query.data}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
    </PageContainer>
  );
}
