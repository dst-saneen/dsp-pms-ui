'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { SecureFileUploadField } from '@/components/file-upload/secure-file-upload-field';
import type { UploadSessionResponse } from '@/components/file-upload/secure-file-upload-field';
import { DocumentDownloadAction } from '@/components/file-upload/document-download-action';
import {
  MalwareScanStatus,
  isDownloadAuthorized,
} from '@/components/file-upload/malware-scan-status';
import { apiClient, getApiErrorMessage, unwrapApiData } from '@/services/api-client';
import { FileText, Shield, AlertTriangle } from 'lucide-react';

interface SecureEmployeeDocumentUploadProps {
  employeeId: string;
  documentTypeId: string;
  documentTypeName: string;
  companyId?: string;
  existingDocumentId?: string;
  existingFileStatus?: string;
  existingAllowedActions?: string[];
  selfService?: boolean;
}

export function SecureEmployeeDocumentUpload({
  employeeId,
  documentTypeId,
  documentTypeName,
  existingDocumentId,
  existingFileStatus,
  existingAllowedActions,
  selfService = false,
}: SecureEmployeeDocumentUploadProps) {
  const queryClient = useQueryClient();
  const [uploadedSessionId, setUploadedSessionId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentNumber, setDocumentNumber] = useState('');
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const canDownload = isDownloadAuthorized(
    existingFileStatus,
    existingAllowedActions,
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedSessionId) throw new Error('No file uploaded');
      if (existingDocumentId) {
        const res = await apiClient.patch(`/employee-documents/${existingDocumentId}`, {
          uploadSessionId: uploadedSessionId,
        });
        return unwrapApiData(res.data);
      }
      const res = await apiClient.post('/employee-documents', {
        employeeId,
        documentTypeId,
        title: documentTitle || documentTypeName,
        documentNumber: documentNumber || undefined,
        uploadSessionId: uploadedSessionId,
      });
      return unwrapApiData(res.data);
    },
    onSuccess: () => {
      toast.success('Document saved.');
      queryClient.invalidateQueries({ queryKey: ['employee-documents'] });
      queryClient.invalidateQueries({ queryKey: ['employee-documents', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['employee-document-summary'] });
      if (existingDocumentId) {
        queryClient.invalidateQueries({
          queryKey: ['employee-document', existingDocumentId],
        });
      }
      setUploadedSessionId(null);
      setDocumentTitle('');
      setDocumentNumber('');
      setBlockedMessage(null);
    },
    onError: (error) => {
      toast.error(
        getApiErrorMessage(error, 'Failed to save document. Please try again.'),
      );
    },
  });

  const createSession = async (params: {
    fileName: string;
    declaredMimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    operationId: string;
  }) => {
    const res = await apiClient.post('/employee-documents/upload-sessions', {
      domainRecordId: employeeId,
      purpose: 'EMPLOYEE_DOCUMENT',
      ...params,
    });
    return unwrapApiData(res.data) as UploadSessionResponse;
  };

  const finalizeSession = async (sessionId: string, sessionToken?: string) => {
    const res = await apiClient.post(
      `/file-upload-sessions/${sessionId}/finalize`,
      {},
      {
        headers: sessionToken
          ? { 'X-File-Session-Token': sessionToken }
          : undefined,
      },
    );
    return unwrapApiData(res.data) as UploadSessionResponse;
  };

  const pollSession = async (sessionId: string, sessionToken?: string) => {
    const res = await apiClient.get(`/file-upload-sessions/${sessionId}`, {
      headers: sessionToken
        ? { 'X-File-Session-Token': sessionToken }
        : undefined,
    });
    return unwrapApiData(res.data) as UploadSessionResponse;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4" />
          {documentTypeName}
          <span title="Secure file storage with malware scanning" className="ml-auto">
            <Shield className="h-3 w-3 text-blue-500" />
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {existingDocumentId && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Current file</span>
              {existingFileStatus ? (
                <MalwareScanStatus
                  status={existingFileStatus}
                  className="scale-90"
                />
              ) : null}
            </div>
            {canDownload && existingDocumentId ? (
              <DocumentDownloadAction
                documentId={existingDocumentId}
                documentType="employee"
                label="Download current document"
                onGrant={async (id) => {
                  const res = await apiClient.post(`/employee-documents/${id}/download-grant`);
                  return unwrapApiData(res.data) as {
                    url: string;
                    expiresAt: string;
                    fileName: string;
                  };
                }}
              />
            ) : (
              <div className="flex items-center gap-2 text-xs text-yellow-700">
                <AlertTriangle className="h-3 w-3" />
                Download available only when the server reports Clean.
              </div>
            )}
          </div>
        )}

        {!selfService && !existingDocumentId && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Document title</Label>
              <Input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder={documentTypeName}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Document number (optional)</Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder="e.g. PAN number, Aadhar number"
                className="text-sm"
              />
            </div>
          </>
        )}

        <SecureFileUploadField
          label={existingDocumentId ? 'Upload replacement' : 'Upload document'}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          maxSizeMb={25}
          onSessionReady={(sessionId) => {
            setBlockedMessage(null);
            setUploadedSessionId(sessionId);
          }}
          onBlocked={(_code, message) => {
            setUploadedSessionId(null);
            setBlockedMessage(message);
          }}
          createSession={createSession}
          finalizeSession={finalizeSession}
          pollSession={pollSession}
        />

        {blockedMessage ? (
          <p className="text-xs text-orange-700">{blockedMessage}</p>
        ) : null}

        {uploadedSessionId && (
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            size="sm"
          >
            {saveMutation.isPending
              ? 'Saving…'
              : existingDocumentId
                ? 'Replace file'
                : 'Save document'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
