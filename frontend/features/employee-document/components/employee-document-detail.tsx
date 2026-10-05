"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText } from "lucide-react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { PermissionGate } from "@/components/common/permission-gate";
import { DocumentDownloadAction } from "@/components/file-upload/document-download-action";
import {
  MalwareScanStatus,
  isDownloadAuthorized,
} from "@/components/file-upload/malware-scan-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiClient, getApiErrorMessage, unwrapApiData } from "@/services/api-client";
import { useSetEntityBreadcrumbs } from "@/providers/entity-breadcrumb-provider";

import { EmployeeDocumentRejectDialog } from "../dialogs/employee-document-reject-dialog";
import { SecureEmployeeDocumentUpload } from "./secure-employee-document-upload";
import { EmployeeDocumentVerificationBadge } from "./employee-document-verification-badge";
import {
  useEmployeeDocumentHistory,
  useRejectEmployeeDocument,
  useResetEmployeeDocument,
  useVerifyEmployeeDocument,
} from "../hooks";
import {
  employeeDocumentEditHref,
  EMPLOYEE_DOCUMENT_LIST,
} from "../lib/employee-document-navigation";
import type { EmployeeDocument } from "../types/employee-document";

interface EmployeeDocumentDetailProps {
  document: EmployeeDocument;
  returnTo: string;
  canManage: boolean;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function historyLabel(action: string) {
  switch (action) {
    case "CREATE":
      return "Created";
    case "UPDATE":
      return "Updated";
    case "VERIFY":
      return "Verified";
    case "REJECT":
      return "Rejected";
    case "RESET_VERIFICATION":
      return "Verification reset";
    case "DELETE":
      return "Deleted";
    default:
      return action;
  }
}

export function EmployeeDocumentDetail({
  document,
  returnTo,
  canManage,
}: EmployeeDocumentDetailProps) {
  const router = useRouter();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const verify = useVerifyEmployeeDocument();
  const reject = useRejectEmployeeDocument();
  const reset = useResetEmployeeDocument();
  const historyQuery = useEmployeeDocumentHistory(document.id);

  useSetEntityBreadcrumbs([
    { label: document.title, href: null },
  ]);

  const actions = new Set(document.allowedActions ?? []);
  const canDownload = isDownloadAuthorized(
    document.fileStatus,
    document.allowedActions,
  );
  const canVerify = canManage && actions.has("VERIFY");
  const canReject = canManage && actions.has("REJECT");
  const canReset = canManage && actions.has("RESET");

  const runVerify = () => {
    verify.mutate(
      { id: document.id },
      {
        onSuccess: () => {
          toast.success("Document verified.");
          setVerifyOpen(false);
          router.refresh();
        },
        onError: (error) => {
          toast.error(
            getApiErrorMessage(error, "Could not verify document."),
          );
        },
      },
    );
  };

  const runReject = (remarks: string) => {
    reject.mutate(
      { id: document.id, remarks },
      {
        onSuccess: () => {
          toast.success("Document rejected.");
          setRejectOpen(false);
          router.refresh();
        },
        onError: (error) => {
          toast.error(
            getApiErrorMessage(error, "Could not reject document."),
          );
        },
      },
    );
  };

  const runReset = () => {
    reset.mutate(document.id, {
      onSuccess: () => {
        toast.success("Verification reset.");
        setResetOpen(false);
        router.refresh();
      },
      onError: (error) => {
        toast.error(
          getApiErrorMessage(error, "Could not reset document."),
        );
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1"
            onClick={() => router.push(returnTo || EMPLOYEE_DOCUMENT_LIST)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {document.title}
            </h1>
            <EmployeeDocumentVerificationBadge
              status={document.verificationStatus}
            />
            {document.documentType?.documentName ? (
              <Badge variant="outline">
                {document.documentType.documentName}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {document.employee
              ? `${document.employee.employeeCode} — ${document.employee.firstName} ${document.employee.lastName ?? ""}`
              : "Employee document detail"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button variant="outline" asChild>
              <Link
                href={employeeDocumentEditHref(document.id, {
                  returnTo: returnTo || EMPLOYEE_DOCUMENT_LIST,
                })}
              >
                Edit metadata
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Document details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <DetailItem
                label="Document number"
                value={document.documentNumber ?? "—"}
              />
              <DetailItem
                label="Type"
                value={document.documentType?.documentName ?? "—"}
              />
              <DetailItem
                label="Category"
                value={
                  document.documentType?.category?.categoryName ?? "—"
                }
              />
              <DetailItem
                label="Expiry"
                value={
                  document.lifetimeDocument
                    ? "Lifetime"
                    : document.expiryDate
                      ? new Date(document.expiryDate).toLocaleDateString()
                      : "—"
                }
              />
              <DetailItem
                label="Issue date"
                value={
                  document.issueDate
                    ? new Date(document.issueDate).toLocaleDateString()
                    : "—"
                }
              />
              <DetailItem
                label="Original file"
                value={document.originalFileName ?? "—"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Scan status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {document.fileStatus ? (
                <MalwareScanStatus
                  status={document.fileStatus}
                  showDetail
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No file attached yet.
                </p>
              )}

              {canDownload ? (
                <DocumentDownloadAction
                  documentId={document.id}
                  documentType="employee"
                  label="Download document"
                  onGrant={async (id) => {
                    const res = await apiClient.post(
                      `/employee-documents/${id}/download-grant`,
                    );
                    return unwrapApiData(res.data) as {
                      url: string;
                      expiresAt: string;
                      fileName: string;
                    };
                  }}
                />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Download is available only after the server reports a clean
                  scan.
                </p>
              )}

              {canManage ? (
                <SecureEmployeeDocumentUpload
                  employeeId={document.employeeId}
                  documentTypeId={document.documentTypeId}
                  documentTypeName={
                    document.documentType?.documentName ?? document.title
                  }
                  existingDocumentId={document.id}
                  existingFileStatus={document.fileStatus ?? undefined}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Verification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailItem
                label="Status"
                value={
                  <EmployeeDocumentVerificationBadge
                    status={document.verificationStatus}
                  />
                }
              />
              <DetailItem
                label="Verifier"
                value={document.verifiedBy ?? "—"}
              />
              <DetailItem
                label="Verified / decided at"
                value={formatDate(document.verifiedDate)}
              />
              <DetailItem
                label="Remarks"
                value={document.remarks?.trim() || "—"}
              />

              <PermissionGate permission="hr.documents.manage">
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    type="button"
                    disabled={!canVerify || verify.isPending}
                    onClick={() => setVerifyOpen(true)}
                  >
                    Verify
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!canReject || reject.isPending}
                    onClick={() => setRejectOpen(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!canReset || reset.isPending}
                    onClick={() => setResetOpen(true)}
                  >
                    Reset
                  </Button>
                </div>
              </PermissionGate>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {historyQuery.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading history…</p>
              ) : (historyQuery.data?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No verification history yet.
                </p>
              ) : (
                historyQuery.data?.map((entry) => {
                  const newValue = entry.newValue as
                    | { remarks?: string; verificationStatus?: string }
                    | null
                    | undefined;
                  return (
                    <div
                      key={entry.id}
                      className="rounded-md border border-border px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {historyLabel(entry.action)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {entry.actorName ?? "System"}
                        {newValue?.verificationStatus
                          ? ` · ${newValue.verificationStatus}`
                          : ""}
                      </p>
                      {newValue?.remarks ? (
                        <p className="mt-1 text-sm">{newValue.remarks}</p>
                      ) : null}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmActionDialog
        open={verifyOpen}
        onOpenChange={setVerifyOpen}
        title="Verify document"
        message="Confirm this document has been reviewed and is acceptable."
        name={document.title}
        nameLabel="Document"
        confirmLabel="Verify"
        loading={verify.isPending}
        loadingLabel="Verifying…"
        onConfirm={runVerify}
      />

      <ConfirmActionDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset verification"
        message="Return this document to pending verification."
        name={document.title}
        nameLabel="Document"
        confirmLabel="Reset"
        loading={reset.isPending}
        loadingLabel="Resetting…"
        onConfirm={runReset}
      />

      <EmployeeDocumentRejectDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        documentTitle={document.title}
        loading={reject.isPending}
        onConfirm={runReject}
      />
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
