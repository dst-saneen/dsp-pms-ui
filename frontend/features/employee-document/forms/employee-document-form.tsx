"use client";

import { useEffect } from "react";
import Link from "next/link";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Input } from "@/components/ui/input";
import {
  MasterFormLayout,
  LookupSelect,
  RequiredLabel,
} from "@/components/forms";
import { SecureFileUploadField } from "@/components/file-upload/secure-file-upload-field";
import type { UploadSessionResponse } from "@/components/file-upload/secure-file-upload-field";
import { apiClient, unwrapApiData } from "@/services/api-client";

import { useEmployees } from "@/features/employee/hooks/use-employees";
import { useEmployeeDocumentTypes } from "@/features/employee-document-type/hooks/use-employee-document-types";
import { employeeDocumentTypeCreateHref } from "@/features/employee-document-type/lib/employee-document-type-navigation";

import {
  employeeDocumentSchema,
  type EmployeeDocumentFormValues,
} from "../validation/employee-document-schema";

import type { EmployeeDocument } from "../types/employee-document";
import { EMPLOYEE_DOCUMENT_LIST } from "../lib/employee-document-navigation";

interface EmployeeDocumentFormProps {
  document?: EmployeeDocument | null;
  defaultEmployeeId?: string;
  onSubmit: (data: EmployeeDocumentFormValues) => void;
  isSaving?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onInvalid?: (messages: string[]) => void;
}

export function EmployeeDocumentForm({
  document,
  defaultEmployeeId,
  onSubmit,
  onDirtyChange,
  onInvalid,
}: EmployeeDocumentFormProps) {
  const form = useForm<EmployeeDocumentFormValues>({
    resolver: zodResolver(employeeDocumentSchema),
    defaultValues: {
      employeeId: defaultEmployeeId ?? "",
      documentTypeId: "",
      title: "",
      documentNumber: "",
      issueDate: "",
      expiryDate: "",
      lifetimeDocument: false,
      verificationStatus: "PENDING",
      verifiedBy: "",
      verifiedDate: "",
      originalFileName: "",
      uploadSessionId: "",
      mimeType: "",
      fileSize: undefined,
      remarks: "",
    },
  });

  const verificationStatus = useWatch({
    control: form.control,
    name: "verificationStatus",
  });

  const lifetimeDocument = useWatch({
    control: form.control,
    name: "lifetimeDocument",
  });

  const employeeId = useWatch({
    control: form.control,
    name: "employeeId",
  });

  const documentTypeId = useWatch({
    control: form.control,
    name: "documentTypeId",
  });

  const { data: employees = [], isLoading: employeesLoading } = useEmployees();
  const {
    data: documentTypes = [],
    isLoading: documentTypesLoading,
  } = useEmployeeDocumentTypes();

  const isEdit = !!document;
  const showEmptyTypes =
    !documentTypesLoading && documentTypes.length === 0;

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  useEffect(() => {
    if (!document) {
      form.reset({
        employeeId: defaultEmployeeId ?? "",
        documentTypeId: "",
        title: "",
        documentNumber: "",
        issueDate: "",
        expiryDate: "",
        lifetimeDocument: false,
        verificationStatus: "PENDING",
        verifiedBy: "",
        verifiedDate: "",
        originalFileName: "",
        uploadSessionId: "",
        mimeType: "",
        fileSize: undefined,
        remarks: "",
      });
      return;
    }

    form.reset({
      employeeId: document.employeeId,
      documentTypeId: document.documentTypeId,
      title: document.title,
      documentNumber: document.documentNumber ?? "",
      issueDate: document.issueDate?.slice(0, 10) ?? "",
      expiryDate: document.expiryDate?.slice(0, 10) ?? "",
      lifetimeDocument: document.lifetimeDocument,
      verificationStatus: document.verificationStatus,
      verifiedBy: document.verifiedBy ?? "",
      verifiedDate: document.verifiedDate?.slice(0, 10) ?? "",
      originalFileName: document.originalFileName ?? "",
      uploadSessionId: "",
      mimeType: document.mimeType ?? "",
      fileSize: document.fileSize,
      remarks: document.remarks ?? "",
    });
  }, [defaultEmployeeId, document, form]);

  return (
    <form
      id="employee-document-form"
      onSubmit={form.handleSubmit(onSubmit, (errors) => {
        const messages = Object.values(errors)
          .map((error) => error?.message)
          .filter((message): message is string => Boolean(message));
        onInvalid?.(messages);
      })}
      className="space-y-6"
    >
      <MasterFormLayout>
        <div className="space-y-2">
          <RequiredLabel required>Employee</RequiredLabel>
          <Controller
            control={form.control}
            name="employeeId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={employees.map((employee) => ({
                  id: employee.id,
                  code: employee.employeeCode,
                  name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
                }))}
                placeholder="Select Employee"
                loading={employeesLoading}
                disabled={
                  employeesLoading || (!!defaultEmployeeId && !isEdit)
                }
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Document Type</RequiredLabel>
          <Controller
            control={form.control}
            name="documentTypeId"
            render={({ field }) => (
              <LookupSelect
                value={field.value}
                onChange={field.onChange}
                items={documentTypes.map((type) => ({
                  id: type.id,
                  code: type.documentCode,
                  name: type.documentName,
                }))}
                placeholder="Select Document Type"
                loading={documentTypesLoading}
                disabled={showEmptyTypes}
              />
            )}
          />
          {showEmptyTypes ? (
            <p className="text-muted-foreground text-xs">
              No document types yet.{" "}
              <Link
                href={employeeDocumentTypeCreateHref({
                  returnTo: EMPLOYEE_DOCUMENT_LIST,
                })}
                className="text-primary font-medium underline-offset-2 hover:underline"
              >
                Create a document type
              </Link>{" "}
              first.
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <RequiredLabel required>Title</RequiredLabel>
          <Input {...form.register("title")} placeholder="Document Title" />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Document Number</RequiredLabel>
          <Input
            {...form.register("documentNumber")}
            placeholder="Document Number"
          />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Issue Date</RequiredLabel>
          <Input type="date" {...form.register("issueDate")} />
        </div>

        <div className="space-y-2">
          <RequiredLabel>Expiry Date</RequiredLabel>
          <Input
            type="date"
            disabled={lifetimeDocument}
            {...form.register("expiryDate")}
          />
        </div>
      </MasterFormLayout>

      <div className="flex items-center gap-2">
        <input type="checkbox" {...form.register("lifetimeDocument")} />
        <span>Lifetime Document</span>
      </div>

      <div className="space-y-2">
        <RequiredLabel>Verification Status</RequiredLabel>
        <Input {...form.register("verificationStatus")} />
      </div>

      {verificationStatus === "VERIFIED" ? (
        <MasterFormLayout>
          <div className="space-y-2">
            <RequiredLabel>Verified By</RequiredLabel>
            <Input {...form.register("verifiedBy")} />
          </div>

          <div className="space-y-2">
            <RequiredLabel>Verified Date</RequiredLabel>
            <Input type="date" {...form.register("verifiedDate")} />
          </div>
        </MasterFormLayout>
      ) : null}

      <div className="space-y-2">
        <RequiredLabel>Remarks</RequiredLabel>
        <Input {...form.register("remarks")} placeholder="Remarks" />
      </div>

      {employeeId && documentTypeId ? (
        <SecureFileUploadField
          label={document ? "Replace file" : "Upload file"}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          maxSizeMb={25}
          onSessionReady={(sessionId) => {
            form.setValue("uploadSessionId", sessionId, { shouldDirty: true });
          }}
          onBlocked={() => {
            form.setValue("uploadSessionId", "", { shouldDirty: true });
          }}
          createSession={async (params) => {
            const res = await apiClient.post(
              "/employee-documents/upload-sessions",
              {
                domainRecordId: employeeId,
                purpose: "EMPLOYEE_DOCUMENT",
                ...params,
              },
            );
            return unwrapApiData(res.data) as UploadSessionResponse;
          }}
          finalizeSession={async (sessionId, sessionToken) => {
            const res = await apiClient.post(
              `/file-upload-sessions/${sessionId}/finalize`,
              {},
              {
                headers: sessionToken
                  ? { "X-File-Session-Token": sessionToken }
                  : undefined,
              },
            );
            return unwrapApiData(res.data) as UploadSessionResponse;
          }}
          pollSession={async (sessionId, sessionToken) => {
            const res = await apiClient.get(
              `/file-upload-sessions/${sessionId}`,
              {
                headers: sessionToken
                  ? { "X-File-Session-Token": sessionToken }
                  : undefined,
              },
            );
            return unwrapApiData(res.data) as UploadSessionResponse;
          }}
        />
      ) : (
        <p className="text-muted-foreground text-xs">
          Select an employee and document type before uploading a file.
        </p>
      )}
    </form>
  );
}
