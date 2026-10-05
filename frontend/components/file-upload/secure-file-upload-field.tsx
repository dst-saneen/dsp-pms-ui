'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RotateCcw,
  ShieldOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getApiErrorCode, getAuthAccessToken } from '@/services/api-client';
import {
  MalwareScanStatus,
  SCAN_LIFECYCLE_LABELS,
  normalizeScanStatus,
  type ScanLifecycleStatus,
} from '@/components/file-upload/malware-scan-status';

export type UploadClientState =
  | 'idle'
  | 'selecting'
  | 'uploading'
  | 'uploaded'
  | 'scanning'
  | 'clean'
  | 'infected'
  | 'failed'
  | 'scanner_unavailable'
  | 'expired'
  | 'error';

export interface UploadSessionResponse {
  id: string;
  version: number;
  status: string;
  upload: {
    method: 'PUT';
    url: string;
    headers: Record<string, string>;
    expiresAt: string;
  } | null;
  scan: {
    status: string;
    safeErrorCode: string | null;
    fileObjectStatus?: string | null;
  };
  fileObjectId: string | null;
  allowedActions: string[];
  sessionToken?: string;
}

export interface SecureFileUploadFieldProps {
  label: string;
  accept: string;
  maxSizeMb: number;
  onSessionReady: (sessionId: string, fileObjectId: string) => void;
  onError?: (code: string, message: string) => void;
  /** Fired for blocked/outage states so parents never toast success. */
  onBlocked?: (code: string, message: string) => void;
  onStateChange?: (state: UploadClientState) => void;
  allowRemove?: boolean;
  createSession: (params: {
    fileName: string;
    declaredMimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    operationId: string;
  }) => Promise<UploadSessionResponse>;
  finalizeSession: (
    sessionId: string,
    sessionToken?: string,
  ) => Promise<UploadSessionResponse>;
  pollSession: (
    sessionId: string,
    sessionToken?: string,
  ) => Promise<UploadSessionResponse>;
  disabled?: boolean;
  className?: string;
}

const SCAN_POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

function lifecycleToClientState(
  lifecycle: ScanLifecycleStatus,
): UploadClientState {
  switch (lifecycle) {
    case 'CLEAN':
      return 'clean';
    case 'SCANNING':
      return 'scanning';
    case 'INFECTED':
      return 'infected';
    case 'FAILED':
      return 'failed';
    case 'SCANNER_UNAVAILABLE':
      return 'scanner_unavailable';
    case 'PENDING_SCAN':
    default:
      return 'scanning';
  }
}

export function SecureFileUploadField({
  label,
  accept,
  maxSizeMb,
  onSessionReady,
  onError,
  onBlocked,
  onStateChange,
  allowRemove = false,
  createSession,
  finalizeSession,
  pollSession,
  disabled,
  className,
}: SecureFileUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionTokenRef = useRef<string | undefined>(undefined);
  const [state, setState] = useState<UploadClientState>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [scanLifecycle, setScanLifecycle] = useState<ScanLifecycleStatus | null>(
    null,
  );

  useEffect(() => {
    onStateChange?.(state);
  }, [onStateChange, state]);

  const reset = useCallback(() => {
    setState('idle');
    setUploadProgress(0);
    setSelectedFile(null);
    setErrorCode(null);
    setErrorDetail(null);
    setScanLifecycle(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    sessionTokenRef.current = undefined;
  }, []);

  const handleBlocked = useCallback(
    (code: string, message: string, nextState: UploadClientState) => {
      setState(nextState);
      setErrorCode(code);
      setErrorDetail(message);
      onBlocked?.(code, message);
      onError?.(code, message);
    },
    [onBlocked, onError],
  );

  const computeChecksumSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const applyTerminalScan = useCallback(
    (session: UploadSessionResponse) => {
      const lifecycle =
        normalizeScanStatus(
          session.scan.status || session.scan.fileObjectStatus || session.status,
          session.scan.safeErrorCode,
        ) ?? 'FAILED';

      setScanLifecycle(lifecycle);

      if (lifecycle === 'CLEAN' && session.fileObjectId) {
        setState('clean');
        onSessionReady(session.id, session.fileObjectId);
        return;
      }

      const code =
        session.scan.safeErrorCode ??
        (lifecycle === 'INFECTED'
          ? 'FILE_INFECTED'
          : lifecycle === 'SCANNER_UNAVAILABLE'
            ? 'CLAMAV_UNAVAILABLE'
            : 'FILE_SCAN_FAILED');

      handleBlocked(
        code,
        getSafeErrorMessage(code),
        lifecycleToClientState(lifecycle),
      );
    },
    [handleBlocked, onSessionReady],
  );

  const pollUntilClean = useCallback(
    async (id: string) => {
      setState('scanning');
      setScanLifecycle('SCANNING');
      let attempts = 0;

      const poll = async (): Promise<void> => {
        if (attempts++ >= MAX_POLL_ATTEMPTS) {
          handleBlocked(
            'FILE_SCAN_FAILED',
            getSafeErrorMessage('FILE_SCAN_FAILED'),
            'failed',
          );
          setScanLifecycle('FAILED');
          return;
        }

        const session = await pollSession(id, sessionTokenRef.current);

        if (session.status === 'CLEAN' && session.fileObjectId) {
          setScanLifecycle('CLEAN');
          setState('clean');
          onSessionReady(id, session.fileObjectId);
          return;
        }

        if (
          session.status === 'REJECTED' ||
          session.scan.status === 'INFECTED' ||
          session.scan.status === 'FAILED' ||
          session.scan.status === 'SCANNER_UNAVAILABLE'
        ) {
          applyTerminalScan(session);
          return;
        }

        if (session.status === 'EXPIRED') {
          handleBlocked(
            'UPLOAD_SESSION_EXPIRED',
            getSafeErrorMessage('UPLOAD_SESSION_EXPIRED'),
            'expired',
          );
          return;
        }

        await new Promise((r) => setTimeout(r, SCAN_POLL_INTERVAL_MS));
        return poll();
      };

      await poll();
    },
    [pollSession, onSessionReady, handleBlocked, applyTerminalScan],
  );

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (file.size > maxSizeMb * 1024 * 1024) {
        handleBlocked(
          'FILE_SIZE_MISMATCH',
          getSafeErrorMessage('FILE_SIZE_MISMATCH'),
          'error',
        );
        return;
      }

      setSelectedFile(file);
      setState('uploading');
      setUploadProgress(0);
      setErrorCode(null);
      setErrorDetail(null);
      setScanLifecycle(null);

      try {
        const checksumSha256 = await computeChecksumSha256(file);
        const operationId = crypto.randomUUID();

        const session = await createSession({
          fileName: file.name,
          declaredMimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          checksumSha256,
          operationId,
        });

        if (!session.upload) {
          handleBlocked(
            'FILE_NOT_FOUND',
            getSafeErrorMessage('FILE_NOT_FOUND'),
            'error',
          );
          return;
        }

        sessionTokenRef.current = session.sessionToken;

        const upload = { ...session.upload };
        const isPublicOfferProxy = upload.url.includes('/public/offers/');
        if (
          !upload.url.startsWith('/') &&
          !isPublicOfferProxy &&
          /^https?:\/\//i.test(upload.url)
        ) {
          upload.url = `/api/file-upload-sessions/${session.id}/content`;
          upload.headers = {
            'Content-Type':
              session.upload.headers['Content-Type'] ||
              file.type ||
              'application/pdf',
          };
        }

        const xhr = new XMLHttpRequest();
        xhr.open(upload.method || 'PUT', upload.url);

        const proxiedUpload =
          upload.url.startsWith('/') || isPublicOfferProxy;

        if (proxiedUpload) {
          xhr.withCredentials = true;
          xhr.setRequestHeader(
            'Content-Type',
            upload.headers['Content-Type'] ||
              file.type ||
              'application/pdf',
          );
          if (sessionTokenRef.current) {
            xhr.setRequestHeader(
              'X-File-Session-Token',
              sessionTokenRef.current,
            );
          }
          const accessToken = getAuthAccessToken();
          if (accessToken && !isPublicOfferProxy) {
            xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
          }
        } else {
          Object.entries(upload.headers).forEach(([k, v]) => {
            if (k.toLowerCase() === 'content-length') {
              return;
            }
            xhr.setRequestHeader(k, v);
          });
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        };

        await new Promise<void>((resolve, reject) => {
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else {
              const detail = (xhr.responseText || '').slice(0, 180);
              reject(
                new Error(
                  detail
                    ? `Upload failed: ${xhr.status} ${detail}`
                    : `Upload failed: ${xhr.status}`,
                ),
              );
            }
          };
          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(file);
        });

        setState('uploaded');
        setUploadProgress(100);
        setScanLifecycle('PENDING_SCAN');

        const finalized = await finalizeSession(
          session.id,
          sessionTokenRef.current,
        );
        if (finalized.status === 'CLEAN' && finalized.fileObjectId) {
          setScanLifecycle('CLEAN');
          setState('clean');
          onSessionReady(session.id, finalized.fileObjectId);
        } else if (
          finalized.status === 'REJECTED' ||
          finalized.scan.status === 'INFECTED' ||
          finalized.scan.status === 'FAILED' ||
          finalized.scan.status === 'SCANNER_UNAVAILABLE'
        ) {
          applyTerminalScan(finalized);
        } else {
          await pollUntilClean(session.id);
        }
      } catch (err) {
        const code =
          getApiErrorCode(err) ??
          (err instanceof Error && err.message.includes('Upload failed')
            ? 'FILE_NOT_FOUND'
            : 'FILE_NOT_FOUND');
        const unavailable =
          code === 'FILE_STORAGE_DISABLED' ||
          code === 'CLAMAV_UNAVAILABLE' ||
          code === 'STORAGE_UNAVAILABLE';
        const message =
          err instanceof Error && !unavailable
            ? err.message
            : getSafeErrorMessage(code);
        handleBlocked(
          code,
          message,
          unavailable ? 'scanner_unavailable' : 'error',
        );
        if (unavailable) {
          setScanLifecycle('SCANNER_UNAVAILABLE');
        }
      }
    },
    [
      createSession,
      finalizeSession,
      pollUntilClean,
      handleBlocked,
      maxSizeMb,
      onSessionReady,
      applyTerminalScan,
    ],
  );

  const stateIcon = {
    idle: <Upload className="h-4 w-4" />,
    selecting: <Upload className="h-4 w-4" />,
    uploading: <Upload className="h-4 w-4 animate-pulse" />,
    uploaded: <Clock className="h-4 w-4" />,
    scanning: <Clock className="h-4 w-4 animate-spin" />,
    clean: <CheckCircle2 className="h-4 w-4 text-green-600" />,
    infected: <XCircle className="h-4 w-4 text-red-500" />,
    failed: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
    scanner_unavailable: <ShieldOff className="h-4 w-4 text-orange-600" />,
    expired: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
  }[state];

  const showRetry =
    state === 'error' ||
    state === 'infected' ||
    state === 'failed' ||
    state === 'scanner_unavailable' ||
    state === 'expired';

  return (
    <div className={cn('space-y-3', className)}>
      <label className="block text-sm font-medium text-foreground">{label}</label>

      {state === 'idle' || state === 'selecting' ? (
        <div
          className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-8 text-center transition-colors hover:border-muted-foreground/40"
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Upload className="mb-2 mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Click to select file or drag and drop
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {accept.split(',').join(', ')} up to {maxSizeMb} MB
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            className="hidden"
            disabled={disabled}
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            {stateIcon}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {selectedFile?.name ?? 'File'}
              </p>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
            </div>
            {scanLifecycle ? (
              <MalwareScanStatus status={scanLifecycle} className="scale-90" />
            ) : state === 'uploading' ? (
              <span className="text-xs text-muted-foreground">Uploading…</span>
            ) : state === 'uploaded' ? (
              <MalwareScanStatus status="PENDING_SCAN" className="scale-90" />
            ) : null}
          </div>

          {state === 'uploading' && (
            <div className="space-y-1">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground">{uploadProgress}%</p>
            </div>
          )}

          {showRetry && (
            <Alert
              variant={
                state === 'infected' || state === 'error'
                  ? 'destructive'
                  : 'default'
              }
            >
              <AlertDescription className="text-sm">
                {errorDetail ??
                  (scanLifecycle
                    ? SCAN_LIFECYCLE_LABELS[scanLifecycle]
                    : getSafeErrorMessage(errorCode ?? 'FILE_NOT_FOUND'))}
              </AlertDescription>
            </Alert>
          )}

          {showRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              type="button"
              className="flex items-center gap-2"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          )}

          {state === 'clean' && allowRemove ? (
            <Button
              variant="outline"
              size="sm"
              onClick={reset}
              type="button"
            >
              Remove file
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function getSafeErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    FILE_SIZE_MISMATCH: 'File is too large. Please select a smaller file.',
    FILE_TYPE_MISMATCH:
      'File type is not allowed. Please select the correct type.',
    FILE_INFECTED:
      'This file was flagged by our security scanner. Please use a different file.',
    FILE_SCAN_FAILED:
      'Security scan could not complete. Please try again later.',
    UPLOAD_SESSION_EXPIRED:
      'Your upload session expired. Please select the file again.',
    FILE_NOT_FOUND: 'Upload failed. Please try again.',
    FILE_CHECKSUM_MISMATCH: 'File integrity check failed. Please try again.',
    FILE_STORAGE_DISABLED:
      'File storage is unavailable. Upload is blocked until the provider recovers.',
    CLAMAV_UNAVAILABLE:
      'Malware scanner is unavailable. Upload is blocked until the scanner recovers.',
    CLAMAV_TIMEOUT:
      'Malware scanner timed out. Upload is blocked until the scanner recovers.',
    STORAGE_UNAVAILABLE:
      'Storage provider is unavailable. Upload is blocked until the service recovers.',
  };
  return messages[code] ?? 'An error occurred. Please try again.';
}
