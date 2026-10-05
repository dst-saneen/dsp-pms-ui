"use client";

import { toast } from "sonner";

import {
  SecureFileUploadField,
  type UploadSessionResponse,
} from "@/components/file-upload/secure-file-upload-field";
import {
  apiClient,
  getApiErrorMessage,
  unwrapApiData,
} from "@/services/api-client";

import { createOperationId } from "../lib/allowed-actions";
import { ProjectsApiService } from "../services/projects-api.service";

export function ProjectTaskEvidenceUpload({
  projectId,
  taskId,
  onChanged,
}: {
  projectId: string;
  taskId: string;
  onChanged: () => void;
}) {
  return (
    <SecureFileUploadField
      label="Attach evidence"
      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
      maxSizeMb={25}
      createSession={async (params) =>
        (await ProjectsApiService.createTaskUploadSession(
          projectId,
          taskId,
          params,
        )) as UploadSessionResponse
      }
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
        return unwrapApiData(response.data) as UploadSessionResponse;
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
        return unwrapApiData(response.data) as UploadSessionResponse;
      }}
      onSessionReady={async (uploadSessionId) => {
        try {
          await ProjectsApiService.linkTaskDocument(projectId, taskId, {
            uploadSessionId,
            operationId: createOperationId(),
          });
          toast.success("Task evidence linked.");
          onChanged();
        } catch (error) {
          toast.error(
            getApiErrorMessage(error, "Unable to link task evidence."),
          );
        }
      }}
      onError={(_code, message) => toast.error(message)}
    />
  );
}
