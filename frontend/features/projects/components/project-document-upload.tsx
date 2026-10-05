"use client";

import { useState } from "react";
import { toast } from "sonner";

import { SecureFileUploadField } from "@/components/file-upload/secure-file-upload-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, getApiErrorMessage, unwrapApiData } from "@/services/api-client";

import { createOperationId } from "../lib/allowed-actions";

export function ProjectDocumentUpload({ projectId }: { projectId: string }) {
  const [linked, setLinked] = useState(0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Supporting documents</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Files upload to quarantine, wait for CLEAN, then link to the project.
        </p>
        <SecureFileUploadField
          label="Upload document"
          accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          maxSizeMb={25}
          createSession={async (params) => {
            const response = await apiClient.post(
              `/projects/${projectId}/upload-sessions`,
              params,
            );
            return unwrapApiData(response.data) as never;
          }}
          finalizeSession={async (sessionId, sessionToken) => {
            const response = await apiClient.post(
              `/file-upload-sessions/${sessionId}/finalize`,
              {},
              {
                headers: sessionToken
                  ? { "X-File-Session-Token": sessionToken }
                  : undefined,
              },
            );
            return unwrapApiData(response.data) as never;
          }}
          pollSession={async (sessionId, sessionToken) => {
            const response = await apiClient.get(
              `/file-upload-sessions/${sessionId}`,
              {
                headers: sessionToken
                  ? { "X-File-Session-Token": sessionToken }
                  : undefined,
              },
            );
            return unwrapApiData(response.data) as never;
          }}
          onSessionReady={async (sessionId) => {
            try {
              await apiClient.post(`/projects/${projectId}/attachments`, {
                uploadSessionId: sessionId,
                operationId: createOperationId(),
              });
              setLinked((count) => count + 1);
              toast.success("Document linked to project");
            } catch (error) {
              toast.error(getApiErrorMessage(error));
            }
          }}
          onError={(_code, message) => toast.error(message)}
        />
        {linked > 0 ? (
          <p className="text-xs text-muted-foreground">
            Linked {linked} document{linked === 1 ? "" : "s"} this session.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
