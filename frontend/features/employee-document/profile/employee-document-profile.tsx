"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import {
  InfoCard,
  InfoRow,
} from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { EmployeeDocumentDialog } from "../dialogs/employee-document-dialog";
import { EmployeeDocumentVerificationBadge } from "../components/employee-document-verification-badge";
import { SecureEmployeeDocumentUpload } from "../components/secure-employee-document-upload";
import { MalwareScanStatus } from "@/components/file-upload/malware-scan-status";
import { useEmployeeDocumentsByEmployee } from "../hooks";
import {
  employeeDocumentCreateHref,
  employeeDocumentDetailHref,
  EMPLOYEE_DOCUMENT_LIST,
} from "../lib/employee-document-navigation";

import type { EmployeeDocument } from "../types/employee-document";

interface EmployeeDocumentProfileProps {
  employeeId: string;
}

export function EmployeeDocumentProfile({
  employeeId,
}: EmployeeDocumentProfileProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] =
    useState<EmployeeDocument | undefined>(undefined);

  const {
    data: documents = [],
    isLoading,
  } = useEmployeeDocumentsByEmployee(
    employeeId,
  );

  if (isLoading) {
    return (
      <InfoCard title="Employee Documents">
        Loading documents...
      </InfoCard>
    );
  }

  const verified =
    documents.filter(
      (d) =>
        d.verificationStatus ===
        "VERIFIED",
    ).length;

  const pending =
    documents.length - verified;

  const profileReturn = `/hr/employees/${employeeId}?tab=documents`;

  return (
    <>
      <div className="space-y-6">
        <InfoCard title="Employee Documents">
          <InfoRow
            label="Total Documents"
            value={documents.length}
          />

          <InfoRow
            label="Verified"
            value={verified}
          />

          <InfoRow
            label="Pending Verification"
            value={pending}
          />

          <div className="flex gap-2 pt-4">
            <Button
              onClick={() =>
                router.push(
                  `${EMPLOYEE_DOCUMENT_LIST}?employeeId=${employeeId}`,
                )
              }
            >
              Open Documents
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                router.push(
                  employeeDocumentCreateHref({
                    returnTo: profileReturn,
                    employeeId,
                  }),
                );
              }}
            >
              Register Document
            </Button>
          </div>
        </InfoCard>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Documents</CardTitle>

            <Button
              size="sm"
              onClick={() => {
                setSelectedDocument(undefined);
                setCreateOpen(true);
              }}
            >
              Add Document
            </Button>
          </CardHeader>

          <CardContent className="space-y-4">
            {documents.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No documents registered"
                description="Register identity and compliance documents for this employee."
              />
            ) : (
              documents.map((document) => (
                <div
                  key={document.id}
                  className="rounded-lg border p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="font-medium underline-offset-4 hover:underline"
                          onClick={() =>
                            router.push(
                              employeeDocumentDetailHref(document.id, {
                                returnTo: profileReturn,
                              }),
                            )
                          }
                        >
                          {document.title}
                        </button>

                        <EmployeeDocumentVerificationBadge
                          status={
                            document.verificationStatus
                          }
                        />

                        {document.documentType
                          ?.documentName && (
                          <Badge variant="outline">
                            {
                              document.documentType
                                .documentName
                            }
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">
                        {document.documentNumber ??
                          "No document number"}
                      </p>

                      <div className="text-sm text-muted-foreground">
                        Expiry{" "}
                        {document.expiryDate
                          ? new Date(
                              document.expiryDate,
                            ).toLocaleDateString()
                          : document.lifetimeDocument
                            ? "Lifetime"
                            : "-"}
                      </div>

                      {document.fileStatus ? (
                        <MalwareScanStatus
                          status={document.fileStatus}
                          className="scale-90"
                        />
                      ) : null}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            employeeDocumentDetailHref(document.id, {
                              returnTo: profileReturn,
                            }),
                          )
                        }
                      >
                        Open / Verify
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(document);
                          setCreateOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <SecureEmployeeDocumentUpload
                      employeeId={employeeId}
                      documentTypeId={document.documentTypeId}
                      documentTypeName={
                        document.documentType?.documentName ?? document.title
                      }
                      existingDocumentId={document.id}
                      existingFileStatus={document.fileStatus ?? undefined}
                      existingAllowedActions={document.allowedActions}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <EmployeeDocumentDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) {
            setSelectedDocument(undefined);
          }
        }}
        document={selectedDocument}
        defaultEmployeeId={employeeId}
      />
    </>
  );
}
