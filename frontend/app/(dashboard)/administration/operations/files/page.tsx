'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Shield,
  AlertTriangle,
  FileX,
  Clock,
  HardDrive,
  Cpu,
  RefreshCcw,
} from 'lucide-react';
import { apiClient, unwrapApiData, getApiErrorMessage } from '@/services/api-client';
import { Skeleton } from '@/components/ui/skeleton';
import { ModuleCapabilityGate } from '@/components/common/module-capability-gate';
import { OpsPathBanner } from '@/features/delivery/components/ops-path-banner';
import { useAuth } from '@/providers/auth-provider';
import { createOperationId } from '@/lib/operation-id';
import { toast } from 'sonner';

interface FileOperationsStats {
  scanFailures: number;
  infectedCount: number;
  expiredSessions: number;
  unreferencedObjects: number;
  missingObjects: number;
  deletionDeadLetters: number;
  retryableAttempts: number;
  storageHealthy: boolean;
  storageEncryptionEnabled: boolean;
  clamAvHealthy: boolean;
  clamAvVersion?: string;
  clamAvMode?: 'clamav' | 'dev-fallback' | 'unavailable';
}

interface ReconciliationReport {
  operationId: string;
  checkedObjects: number;
  missingInStorage: number;
  corruptedChecksums: number;
  markedMissing: string[];
}

export default function FileOperationsDashboardPage() {
  return (
    <ModuleCapabilityGate capability="fileOperationsNav">
      <FileOperationsDashboardContent />
    </ModuleCapabilityGate>
  );
}

function FileOperationsDashboardContent() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const canManage = hasPermission('files.operations.manage');
  const [lastOperationId, setLastOperationId] = useState<string | null>(null);

  const { data: stats, isLoading, error, refetch } = useQuery<FileOperationsStats>({
    queryKey: ['file-operations-stats'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/operations/files/stats');
      return unwrapApiData(res.data) as FileOperationsStats;
    },
    refetchInterval: 30000,
    retry: false,
  });

  const reconcile = useMutation({
    mutationFn: async () => {
      const operationId = createOperationId();
      setLastOperationId(operationId);
      const res = await apiClient.post('/admin/operations/files/reconcile', {
        operationId,
      });
      return unwrapApiData(res.data) as ReconciliationReport;
    },
    onSuccess: (report) => {
      toast.success(
        `Reconcile finished (op ${report.operationId.slice(0, 8)}…): checked ${report.checkedObjects}, missing ${report.missingInStorage}, checksum issues ${report.corruptedChecksums}.`,
      );
      queryClient.invalidateQueries({ queryKey: ['file-operations-stats'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not run file reconciliation.'));
    },
  });

  const clearFailures = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(
        '/admin/operations/files/clear-scan-failures',
      );
      return unwrapApiData(res.data) as {
        clearedObjects: number;
        clearedAttempts: number;
      };
    },
    onSuccess: (report) => {
      toast.success(
        `Cleared ${report.clearedObjects} false scan failure(s). New uploads should scan clean.`,
      );
      queryClient.invalidateQueries({ queryKey: ['file-operations-stats'] });
    },
    onError: (err) => {
      toast.error(getApiErrorMessage(err, 'Could not clear scan failures.'));
    },
  });

  const denied =
    (error as { response?: { status?: number } } | null)?.response?.status === 403;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">File Operations Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-xl font-semibold">File Operations Dashboard</h1>
        <OpsPathBanner
          current="files"
          note="Requires File Operations access (files.operations.read). Reconcile requires files.operations.manage."
        />
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {denied
              ? 'You do not have permission to view file operations (files.operations.read).'
              : 'Failed to load file operations data. Retry without exposing storage internals.'}
          </AlertDescription>
        </Alert>
        {!denied && (
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  const metrics = [
    {
      label: 'Scan Failures',
      value: stats?.scanFailures ?? 0,
      icon: <Cpu className="h-5 w-5" />,
      critical: (stats?.scanFailures ?? 0) > 0,
      description: 'Files that could not be scanned',
    },
    {
      label: 'Infected Files',
      value: stats?.infectedCount ?? 0,
      icon: <FileX className="h-5 w-5" />,
      critical: (stats?.infectedCount ?? 0) > 0,
      description: 'Files with detected threats (inaccessible)',
    },
    {
      label: 'Expired Sessions',
      value: stats?.expiredSessions ?? 0,
      icon: <Clock className="h-5 w-5" />,
      critical: false,
      description: 'Upload sessions that expired before completion',
    },
    {
      label: 'Unreferenced Objects',
      value: stats?.unreferencedObjects ?? 0,
      icon: <HardDrive className="h-5 w-5" />,
      critical: (stats?.unreferencedObjects ?? 0) > 10,
      description: 'Storage objects not linked to any document',
    },
    {
      label: 'Missing Objects',
      value: stats?.missingObjects ?? 0,
      icon: <AlertTriangle className="h-5 w-5" />,
      critical: (stats?.missingObjects ?? 0) > 0,
      description: 'DB records where storage object is absent',
    },
    {
      label: 'Retry Queue',
      value: stats?.retryableAttempts ?? 0,
      icon: <RefreshCcw className="h-5 w-5" />,
      critical: (stats?.retryableAttempts ?? 0) > 20,
      description: 'Scan or deletion attempts waiting to retry',
    },
    {
      label: 'Deletion Dead Letters',
      value: stats?.deletionDeadLetters ?? 0,
      icon: <RefreshCcw className="h-5 w-5" />,
      critical: (stats?.deletionDeadLetters ?? 0) > 0,
      description: 'Deletion operations that exhausted all retries',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">File Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Monitor secure file storage health, scan results and anomalies. Object
            keys and provider payloads stay hidden.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={
              !canManage ||
              clearFailures.isPending ||
              (stats?.scanFailures ?? 0) === 0
            }
            title={
              canManage
                ? 'Remove SCAN_FAILED records from the fixed MIME allowlist bug (does not delete CLEAN files).'
                : 'Requires files.operations.manage.'
            }
            onClick={() => {
              if (canManage) clearFailures.mutate();
            }}
          >
            {clearFailures.isPending ? 'Clearing…' : 'Clear false scan failures'}
          </Button>
          <Button
            size="sm"
            disabled={!canManage || reconcile.isPending}
            title={
              canManage
                ? 'Compare DB CLEAN objects to storage and mark missing ones.'
                : 'Requires files.operations.manage. You can still view stats with files.operations.read.'
            }
            onClick={() => {
              if (canManage) reconcile.mutate();
            }}
          >
            {reconcile.isPending ? 'Reconciling…' : 'Run reconcile'}
          </Button>
        </div>
      </div>

      <OpsPathBanner
        current="files"
        note="Reconcile checks CLEAN objects against storage. It does not purge linked documents. Retention policies are step 6."
      />

      {lastOperationId ? (
        <p className="text-muted-foreground text-xs font-mono">
          Last reconcile operationId: {lastOperationId}
        </p>
      ) : null}

      {!canManage ? (
        <Alert>
          <AlertDescription>
            You can view file operations. Run reconcile stays disabled until you
            have <span className="font-mono text-xs">files.operations.manage</span>.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Provider
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${stats?.storageHealthy ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm">{stats?.storageHealthy ? 'Healthy' : 'Unreachable'}</span>
              {stats?.storageEncryptionEnabled ? (
                <Badge className="bg-green-100 text-green-800 text-xs ml-2">
                  <Shield className="h-3 w-3 mr-1" />
                  Encrypted
                </Badge>
              ) : (
                <Badge variant="destructive" className="text-xs ml-2">
                  No Encryption
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" />
              ClamAV Scanner
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${stats?.clamAvHealthy ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="text-sm">
                {stats?.clamAvMode === 'dev-fallback'
                  ? 'Dev fallback (ClamAV not configured)'
                  : stats?.clamAvHealthy
                    ? 'Online'
                    : 'Offline'}
              </span>
              {stats?.clamAvVersion && (
                <span className="text-xs text-gray-400 ml-2">{stats.clamAvVersion}</span>
              )}
            </div>
            {stats?.clamAvMode === 'dev-fallback' ? (
              <p className="text-xs text-muted-foreground mt-1">
                Local/non-prod uploads use the development clean fallback. Production
                still requires a live ClamAV host.
              </p>
            ) : !stats?.clamAvHealthy ? (
              <p className="text-xs text-red-600 mt-1">
                Scanner is offline. New uploads will fail closed — no files will be marked clean.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className={m.critical && m.value > 0 ? 'border-red-200' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p
                    className={`text-3xl font-bold ${m.critical && m.value > 0 ? 'text-red-600' : 'text-gray-800'}`}
                  >
                    {m.value}
                  </p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{m.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                </div>
                <div
                  className={`p-2 rounded-lg ${m.critical && m.value > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}
                >
                  {m.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(stats?.scanFailures ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats!.scanFailures} file(s) failed security scanning. These files are inaccessible
            until manually reviewed and reclassified by an administrator.
          </AlertDescription>
        </Alert>
      )}

      {(stats?.missingObjects ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats!.missingObjects} document(s) reference storage objects that no longer exist.
            These documents are inaccessible. Use <strong>Run reconcile</strong> (manage
            permission) or contact support.
          </AlertDescription>
        </Alert>
      )}

      {(stats?.deletionDeadLetters ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {stats!.deletionDeadLetters} deletion attempt(s) are in dead letter. Review operations
            without opening object keys or provider error payloads.
          </AlertDescription>
        </Alert>
      )}

      {(stats?.scanFailures ?? 0) === 0 &&
        (stats?.infectedCount ?? 0) === 0 &&
        (stats?.missingObjects ?? 0) === 0 &&
        (stats?.deletionDeadLetters ?? 0) === 0 && (
          <Alert>
            <AlertDescription>
              No file-operation exceptions in the current company scope.
            </AlertDescription>
          </Alert>
        )}
    </div>
  );
}
