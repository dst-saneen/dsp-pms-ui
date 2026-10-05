'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Loader2, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiErrorCode } from '@/services/api-client';

interface DocumentDownloadActionProps {
  documentId: string;
  documentType: 'recruitment' | 'employee';
  label?: string;
  disabled?: boolean;
  className?: string;
  onGrant: (documentId: string) => Promise<{ url: string; expiresAt: string; fileName: string }>;
}

export function DocumentDownloadAction({
  documentId,
  label = 'Download',
  disabled,
  className,
  onGrant,
}: DocumentDownloadActionProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setLoading(true);
    setError(null);
    try {
      const grant = await onGrant(documentId);
      const a = document.createElement('a');
      a.href = grant.url;
      a.download = grant.fileName;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      const code = getApiErrorCode(err) ?? (err instanceof Error ? err.message : undefined) ?? 'DOWNLOAD_FAILED';
      setError(getSafeDownloadError(code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={disabled || loading}
        type="button"
        className="flex items-center gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {loading ? 'Preparing…' : label}
      </Button>
      {error && (
        <Alert variant="destructive" className="py-2">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function getSafeDownloadError(code: string): string {
  const messages: Record<string, string> = {
    FILE_NOT_FOUND: 'Document not found.',
    FILE_NOT_CLEAN: 'This file is not available for download.',
    FILE_INFECTED: 'This file cannot be downloaded due to a security issue.',
    FILE_SCAN_PENDING: 'This file is still being scanned. Please try again shortly.',
    FILE_LEGAL_HOLD: 'This document is on legal hold and cannot be downloaded.',
  };
  return messages[code] ?? 'Download failed. Please try again.';
}

interface DocumentAccessDeniedStateProps {
  code?: string;
  className?: string;
}

export function DocumentAccessDeniedState({ code, className }: DocumentAccessDeniedStateProps) {
  return (
    <div className={cn('flex items-center gap-2 text-sm text-gray-500', className)}>
      <ShieldAlert className="h-4 w-4 text-red-400" />
      <span>{getSafeDownloadError(code ?? 'FILE_NOT_FOUND')}</span>
    </div>
  );
}

interface FileOperationFailurePanelProps {
  code: string;
  onRetry?: () => void;
  className?: string;
}

export function FileOperationFailurePanel({
  code,
  onRetry,
  className,
}: FileOperationFailurePanelProps) {
  return (
    <Alert variant="destructive" className={className}>
      <ShieldAlert className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>{getSafeDownloadError(code)}</span>
        {onRetry && (
          <Button variant="ghost" size="sm" onClick={onRetry} type="button">
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
