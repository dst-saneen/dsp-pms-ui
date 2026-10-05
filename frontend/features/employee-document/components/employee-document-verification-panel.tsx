"use client";

import Link from "next/link";

import { PermissionGate } from "@/components/common/permission-gate";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DocumentDownloadAction } from "@/components/file-upload/document-download-action";
import {
  MalwareScanStatus,
  isDownloadAuthorized,
} from "@/components/file-upload/malware-scan-status";
import { apiClient, unwrapApiData } from "@/services/api-client";

import { EmployeeDocumentVerificationBadge } from "./employee-document-verification-badge";
import { employeeDocumentDetailHref } from "../lib/employee-document-navigation";

import type { EmployeeDocument } from "../types/employee-document";

interface Props {
  document: EmployeeDocument;
  /** When true, show a link to the dedicated detail page instead of inline mutations. */
  linkToDetail?: boolean;
  returnTo?: string;
  onDocumentChange?: (document: EmployeeDocument) => void;
}

/**
 * Compact verification summary used on edit surfaces.
 * Mutations live on the dedicated detail page (DOC-003).
 */
export function EmployeeDocumentVerificationPanel({
  document,
  linkToDetail = true,
  returnTo,
}: Props) {
  const canDownload = isDownloadAuthorized(
    document.fileStatus,
    document.allowedActions,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Verification</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Status</span>
          <EmployeeDocumentVerificationBadge
            status={document.verificationStatus}
          />
        </div>

        {document.fileStatus ? (
          <div className="flex items-center justify-between gap-2">
            <span>Scan</span>
            <MalwareScanStatus status={document.fileStatus} className="scale-90" />
          </div>
        ) : null}

        <div>
          <strong>Verified Date</strong>
          <div>
            {document.verifiedDate
              ? new Date(document.verifiedDate).toLocaleDateString()
              : "-"}
          </div>
        </div>

        <div>
          <strong>Verified By</strong>
          <div>{document.verifiedBy ?? "-"}</div>
        </div>

        <div>
          <strong>Remarks</strong>
          <div>{document.remarks ?? "-"}</div>
        </div>

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
            Download available after the file scan is clean.
          </p>
        )}

        {linkToDetail ? (
          <PermissionGate
            anyPermission={["hr.documents.manage", "hr.documents.read"]}
          >
            <Button asChild>
              <Link
                href={employeeDocumentDetailHref(document.id, {
                  returnTo,
                })}
              >
                Open verification detail
              </Link>
            </Button>
          </PermissionGate>
        ) : null}
      </CardContent>
    </Card>
  );
}
