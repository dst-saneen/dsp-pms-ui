"use client";

import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { KpiCard } from "@/components/common/kpi-card";
import { KpiGrid } from "@/components/common/kpi-grid";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { RECRUITMENT_ROUTES } from "../constants/routes";
import { recruitmentKeys } from "../hooks/query-keys";
import { isRecruitmentMockEnabled } from "../constants/feature-flags";
import { RecruitmentDashboardService } from "./recruitment-dashboard-service";

const QUICK_LINKS = [
  {
    title: "Job Openings",
    description: "Create and publish hiring positions.",
    href: RECRUITMENT_ROUTES.openings.list,
    icon: Briefcase,
  },
  {
    title: "Candidates",
    description: "Review people in the hiring pipeline.",
    href: RECRUITMENT_ROUTES.candidates.list,
    icon: UserRoundSearch,
  },
  {
    title: "Applications",
    description: "Track screening, interviews, and decisions.",
    href: RECRUITMENT_ROUTES.applications.list,
    icon: ClipboardList,
  },
  {
    title: "Interviews",
    description: "Schedule rounds and panel evaluations.",
    href: RECRUITMENT_ROUTES.interviews.list,
    icon: CalendarDays,
  },
  {
    title: "Hiring decisions",
    description: "Compare candidates and select or reject.",
    href: RECRUITMENT_ROUTES.hiringDecisions.list,
    icon: Users,
  },
  {
    title: "Offers",
    description: "Prepare offers and ready-to-hire conversion.",
    href: RECRUITMENT_ROUTES.offers.list,
    icon: FileCheck2,
  },
] as const;

export function RecruitmentDashboard() {
  const dashboardQuery = useQuery({
    queryKey: recruitmentKeys.dashboard(),
    queryFn: () => RecruitmentDashboardService.getKpis(),
  });
  const kpis = dashboardQuery.data;
  const mockMode = isRecruitmentMockEnabled();
  const helper = mockMode
    ? "Development mock data — not the live API"
    : "Live recruitment counts";

  return (
    <WorkspaceShell>
      <KpiGrid columns={4}>
        <KpiCard
          title="Open Positions"
          value={kpis ? String(kpis.openOpenings) : "—"}
          icon={Briefcase}
          helperText={helper}
          density="compact"
        />
        <KpiCard
          title="New Candidates"
          value={kpis ? String(kpis.newApplications) : "—"}
          icon={Users}
          helperText={helper}
          density="compact"
        />
        <KpiCard
          title="Interviews Today"
          value={kpis ? String(kpis.interviewsToday) : "—"}
          icon={CalendarDays}
          helperText={helper}
          tone="progress"
          density="compact"
        />
        <KpiCard
          title="Ready to Hire"
          value={kpis ? String(kpis.readyToHire) : "—"}
          icon={FileCheck2}
          helperText={helper}
          tone="information"
          density="compact"
        />
      </KpiGrid>

      <Card>
        <CardHeader>
          <CardTitle>Recruitment workspaces</CardTitle>
          <CardDescription>
            End-to-end hiring from job opening through employee conversion.
            Dashboard counts load from the recruitment API when mock mode is off.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {QUICK_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start gap-3">
                  <link.icon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="font-medium">{link.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {link.description}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </WorkspaceShell>
  );
}
