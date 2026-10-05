"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { EditorHeader } from "@/components/editor/editor-header";
import { EditorTabs } from "@/components/editor/editor-tabs";
import {
  ApplicationEvaluationsPanel,
  ApplicationInterviewsPanel,
} from "../../interviews/components/application-interviews-panel";
import { ApplicationOfferPanel } from "../../offers/components/application-offer-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/providers/auth-provider";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";

import { ApplicationStatusBadge } from "../../components/application-status-badge";
import { RECRUITMENT_PERMISSIONS } from "../../constants/permissions";
import { RECRUITMENT_ROUTES } from "../../constants/routes";
import { ApplicationReasonDialog } from "../dialogs/application-reason-dialog";
import {
  useAdvanceToInterview,
  useAdvanceToManagerReview,
  useJobApplication,
  useRejectApplication,
  useShortlistApplication,
  useStartScreening,
  useWithdrawApplication,
} from "../hooks/use-job-applications";
import {
  formatApplicationSource,
  resolveApplicationPrimaryAction,
} from "../utils/application-actions";
import { ApplicationLifecycleStepper } from "../components/application-lifecycle-stepper";
import { ApplicationTimeline } from "../components/application-timeline";
import { APPLICATION_LIST } from "../lib/application-navigation";

interface JobApplicationEditorProps {
  applicationId: string;
  defaultTab?: string;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

const TAB_VALUES = [
  "overview",
  "documents",
  "interviews",
  "evaluations",
  "offer",
  "timeline",
] as const;

export function JobApplicationEditor({
  applicationId,
  defaultTab,
}: JobApplicationEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const { data: capabilities } = useModuleCapabilities();
  const canManage = hasPermission(RECRUITMENT_PERMISSIONS.manage);
  const shortlistAvailable = capabilities?.recruitmentShortlist === true;

  const applicationQuery = useJobApplication(applicationId);
  const shortlistApplication = useShortlistApplication();
  const startScreening = useStartScreening();
  const advanceToInterview = useAdvanceToInterview();
  const advanceToManagerReview = useAdvanceToManagerReview();
  const rejectApplication = useRejectApplication();
  const withdrawApplication = useWithdrawApplication();

  const [reasonAction, setReasonAction] = useState<"reject" | "withdraw" | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState(
    defaultTab && TAB_VALUES.includes(defaultTab as (typeof TAB_VALUES)[number])
      ? defaultTab
      : "overview",
  );

  const application = applicationQuery.data;
  const isBusy =
    shortlistApplication.isPending ||
    startScreening.isPending ||
    advanceToInterview.isPending ||
    advanceToManagerReview.isPending ||
    rejectApplication.isPending ||
    withdrawApplication.isPending;

  if (applicationQuery.isLoading) {
    return <div className="p-6">Loading application…</div>;
  }

  if (!application) {
    return <div className="p-6">Application not found.</div>;
  }

  const primary = resolveApplicationPrimaryAction(application, {
    shortlistAvailable,
  });

  const returnTo = searchParams.get("return") ?? APPLICATION_LIST;

  const openTab = (tab: string) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams.toString());
    next.set("tab", tab);
    router.replace(
      `${RECRUITMENT_ROUTES.applications.detail(applicationId)}?${next.toString()}`,
    );
  };

  const handleTabChange = (tab: string) => {
    openTab(tab);
  };

  const handleReasonConfirm = async (values: {
    reasonCode?: string;
    comment: string;
  }) => {
    const payload = {
      expectedVersion: application.version,
      operationId: crypto.randomUUID(),
      reasonCode: values.reasonCode,
      comment: values.comment,
    };

    if (reasonAction === "reject") {
      await rejectApplication.mutateAsync({ id: application.id, data: payload });
    } else if (reasonAction === "withdraw") {
      await withdrawApplication.mutateAsync({
        id: application.id,
        data: payload,
      });
    }

    setReasonAction(null);
  };

  const runPrimaryMutation = () => {
    const data = {
      expectedVersion: application.version,
      operationId: crypto.randomUUID(),
    };

    switch (primary.kind) {
      case "shortlist":
        shortlistApplication.mutate({ id: application.id, data });
        return;
      case "start_screening":
        startScreening.mutate({ id: application.id, data });
        return;
      case "advance_interview":
        advanceToInterview.mutate({ id: application.id, data });
        return;
      case "advance_manager":
        advanceToManagerReview.mutate({ id: application.id, data });
        return;
      case "open_interviews":
      case "open_offer":
        if (primary.tab) openTab(primary.tab);
        return;
      case "open_hiring_decision":
        router.push(
          RECRUITMENT_ROUTES.hiringDecisions.opening(application.jobOpeningId),
        );
        return;
      default:
        return;
    }
  };

  const primaryIsMutation =
    primary.kind === "shortlist" ||
    primary.kind === "start_screening" ||
    primary.kind === "advance_interview" ||
    primary.kind === "advance_manager";

  const primaryIsNavigation =
    primary.kind === "open_interviews" ||
    primary.kind === "open_offer" ||
    primary.kind === "open_hiring_decision";

  const tabs = [
    {
      value: "overview",
      label: "Overview",
      content: (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationLifecycleStepper status={application.status} />
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Command center</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Current owner</span>
                  <span className="font-medium">
                    {application.currentOwner ?? "—"}
                  </span>
                  <span className="text-muted-foreground">Next action</span>
                  <span className="font-medium">{primary.label}</span>
                </div>

                <p className="text-muted-foreground">{primary.explanation}</p>

                <div className="flex flex-wrap gap-2">
                  {canManage && (primaryIsMutation || primaryIsNavigation) ? (
                    <Button
                      disabled={isBusy}
                      onClick={() => runPrimaryMutation()}
                    >
                      {primary.label}
                    </Button>
                  ) : null}

                  {canManage && application.allowedActions.canReject ? (
                    <Button
                      variant="destructive"
                      disabled={isBusy}
                      onClick={() => setReasonAction("reject")}
                    >
                      Reject
                    </Button>
                  ) : null}

                  {canManage && application.allowedActions.canWithdraw ? (
                    <Button
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => setReasonAction("withdraw")}
                    >
                      Record withdrawal
                    </Button>
                  ) : null}
                </div>

                {!canManage ? (
                  <p className="text-muted-foreground">
                    You can view this application, but recruitment manage
                    permission is required for transitions.
                  </p>
                ) : null}

                <div className="flex flex-wrap gap-3 pt-1">
                  <button
                    type="button"
                    className="text-primary text-sm font-medium hover:underline"
                    onClick={() => openTab("interviews")}
                  >
                    Interviews
                  </button>
                  <button
                    type="button"
                    className="text-primary text-sm font-medium hover:underline"
                    onClick={() => openTab("offer")}
                  >
                    Offer
                  </button>
                  <Link
                    href={RECRUITMENT_ROUTES.hiringDecisions.opening(
                      application.jobOpeningId,
                    )}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Hiring decision
                  </Link>
                  <Link
                    href={RECRUITMENT_ROUTES.candidates.detail(
                      application.candidateId,
                    )}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Candidate profile
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Application summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <span className="text-muted-foreground">Application #</span>
                  <span>{application.applicationNumber}</span>
                  <span className="text-muted-foreground">Candidate</span>
                  <span>
                    {application.candidateFirstName}{" "}
                    {application.candidateLastName}
                  </span>
                  <span className="text-muted-foreground">Email</span>
                  <span>{application.candidateEmail}</span>
                  <span className="text-muted-foreground">Opening</span>
                  <span>
                    {application.openingCode} · {application.openingTitle}
                  </span>
                  <span className="text-muted-foreground">Branch</span>
                  <span>{application.branchName ?? "—"}</span>
                  <span className="text-muted-foreground">Source</span>
                  <span>{formatApplicationSource(application.source)}</span>
                  <span className="text-muted-foreground">Submitted</span>
                  <span>{formatDate(application.submittedAt)}</span>
                </div>
                {application.coverNote ? (
                  <div>
                    <p className="text-muted-foreground mb-1">Cover note</p>
                    <p>{application.coverNote}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>
      ),
    },
    {
      value: "documents",
      label: "Documents",
      content: (
        <Card>
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {application.documents.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No documents uploaded.
              </p>
            ) : (
              <div className="space-y-2">
                {application.documents.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>{document.fileName}</span>
                    <span className="text-muted-foreground">
                      {document.kind}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ),
    },
    {
      value: "interviews",
      label: "Interviews",
      content: <ApplicationInterviewsPanel applicationId={applicationId} />,
    },
    {
      value: "evaluations",
      label: "Evaluations",
      content: <ApplicationEvaluationsPanel applicationId={applicationId} />,
    },
    {
      value: "offer",
      label: "Offer",
      content: (
        <ApplicationOfferPanel applicationId={applicationId} layout="embedded" />
      ),
    },
    {
      value: "timeline",
      label: "Timeline",
      content: <ApplicationTimeline entries={application.timeline} />,
    },
  ];

  return (
    <div className="space-y-6">
      <EditorHeader
        title={`${application.candidateFirstName} ${application.candidateLastName}`}
        subtitle={`${application.applicationNumber} · ${application.openingTitle}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ApplicationStatusBadge status={application.status} />
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(returnTo)}
            >
              Back to list
            </Button>
          </div>
        }
      />

      <EditorTabs
        value={activeTab}
        onValueChange={handleTabChange}
        tabs={tabs}
      />

      <ApplicationReasonDialog
        open={reasonAction !== null}
        onOpenChange={(open) => {
          if (!open) setReasonAction(null);
        }}
        title={
          reasonAction === "reject"
            ? "Reject application"
            : "Record withdrawal"
        }
        description={
          reasonAction === "reject"
            ? "Provide the rejection reason. This action is recorded in the immutable timeline."
            : "Provide the withdrawal reason. This action is recorded in the immutable timeline."
        }
        confirmLabel={
          reasonAction === "reject" ? "Reject application" : "Record withdrawal"
        }
        loading={isBusy}
        onConfirm={handleReasonConfirm}
      />
    </div>
  );
}
