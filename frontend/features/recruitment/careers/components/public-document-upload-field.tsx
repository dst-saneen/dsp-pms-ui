"use client";

import { useId, useRef } from "react";
import { FileText, RotateCcw, Trash2 } from "lucide-react";

import {
  MalwareScanStatus,
  type ScanLifecycleStatus,
} from "@/components/file-upload/malware-scan-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { PUBLIC_CV_ACCEPT } from "../constants/public-careers-content";

interface PublicDocumentUploadFieldProps {
  label: string;
  required?: boolean;
  hint: string;
  file: File | null;
  multiple?: boolean;
  files?: File[];
  error?: string | null;
  scanStatus?: ScanLifecycleStatus | null;
  safeErrorCode?: string | null;
  disabled?: boolean;
  onFileChange: (file: File | null) => void;
  onFilesChange?: (files: File[]) => void;
  onClearRecovery?: () => void;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PublicDocumentUploadField({
  label,
  required = false,
  hint,
  file,
  multiple = false,
  files = [],
  error,
  scanStatus = null,
  safeErrorCode = null,
  disabled = false,
  onFileChange,
  onFilesChange,
  onClearRecovery,
}: PublicDocumentUploadFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const describedBy = `${inputId}-hint${error ? ` ${inputId}-error` : ""}`;

  const selected = multiple ? files : file ? [file] : [];

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="space-y-1">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {required ? (
            <span className="text-destructive ml-1" aria-hidden="true">
              *
            </span>
          ) : null}
        </label>
        <p id={`${inputId}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      </div>

      <Input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={PUBLIC_CV_ACCEPT}
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={cn(error && "border-destructive")}
        onChange={(event) => {
          if (multiple) {
            onFilesChange?.(Array.from(event.target.files ?? []));
            return;
          }
          onFileChange(event.target.files?.[0] ?? null);
        }}
      />

      {selected.length > 0 ? (
        <ul className="space-y-2" aria-label={`Selected ${label}`}>
          {selected.map((item) => (
            <li
              key={`${item.name}-${item.size}-${item.lastModified}`}
              className="bg-muted/30 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
            >
              <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">
                {item.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {formatFileSize(item.size)}
                </span>
              </span>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => {
                    if (multiple) {
                      onFilesChange?.(
                        files.filter(
                          (candidate) =>
                            !(
                              candidate.name === item.name &&
                              candidate.size === item.size &&
                              candidate.lastModified === item.lastModified
                            ),
                        ),
                      );
                    } else {
                      onFileChange(null);
                    }
                    if (inputRef.current) inputRef.current.value = "";
                    onClearRecovery?.();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="sr-only">Remove {item.name}</span>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">
          {required
            ? "Required before you can continue."
            : "Optional — skip if you have nothing extra to attach."}
        </p>
      )}

      {scanStatus ? (
        <MalwareScanStatus
          status={scanStatus}
          safeErrorCode={safeErrorCode}
          showDetail
          onRetry={
            onClearRecovery
              ? () => {
                  onFileChange(null);
                  if (inputRef.current) inputRef.current.value = "";
                  onClearRecovery();
                  inputRef.current?.click();
                }
              : undefined
          }
          retryLabel="Choose another file"
        />
      ) : null}

      {error ? (
        <p id={`${inputId}-error`} className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      {scanStatus && onClearRecovery ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={() => {
            onFileChange(null);
            if (inputRef.current) inputRef.current.value = "";
            onClearRecovery();
            inputRef.current?.click();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Replace file and retry
        </Button>
      ) : null}
    </div>
  );
}
