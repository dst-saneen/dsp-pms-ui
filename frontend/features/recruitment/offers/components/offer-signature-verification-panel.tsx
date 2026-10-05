'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, unwrapApiData, getApiErrorCode } from '@/services/api-client';
import axios from 'axios';
import { DocumentDownloadAction } from '@/components/file-upload/document-download-action';

interface SignatureSubmission {
  id: string;
  submissionNo: number;
  version: number;
  recruitmentDocumentId: string;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'REJECTED' | 'SUPERSEDED';
  candidateLegalName: string;
  submittedAt: string;
  verifiedAt: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  fileStatus: string | null;
  allowedActions: string[];
}

interface OfferSignatureVerificationPanelProps {
  jobOfferId: string;
  offerVersion: number;
  canVerify: boolean;
}

export function OfferSignatureVerificationPanel({
  jobOfferId,
  offerVersion,
  canVerify,
}: OfferSignatureVerificationPanelProps) {
  const queryClient = useQueryClient();
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [resubmitOpen, setResubmitOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<SignatureSubmission | null>(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['offer-signature-submissions', jobOfferId],
    queryFn: async () => {
      const res = await apiClient.get(`/job-offers/${jobOfferId}/signature-submissions`);
      return unwrapApiData(res.data) as SignatureSubmission[];
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({
      submissionId,
      decision,
      reason: r,
    }: {
      submissionId: string;
      decision: 'verify' | 'reject';
      reason: string;
    }) => {
      const endpoint = `/job-offers/${jobOfferId}/signature-submissions/${submissionId}/${decision}`;
      const res = await apiClient.post(endpoint, {
        expectedOfferVersion: offerVersion,
        expectedSubmissionVersion: selectedSubmission?.version ?? 0,
        operationId: crypto.randomUUID(),
        reason: r,
      });
      return unwrapApiData(res.data);
    },
    onSuccess: (_, { decision }) => {
      toast.success(decision === 'verify' ? 'Signed offer verified.' : 'Signed offer rejected.');
      queryClient.invalidateQueries({ queryKey: ['offer-signature-submissions', jobOfferId] });
      queryClient.invalidateQueries({ queryKey: ['job-offer', jobOfferId] });
      queryClient.invalidateQueries({ queryKey: ['job-application'] });
      queryClient.invalidateQueries({ queryKey: ['ready-to-hire'] });
      setVerifyOpen(false);
      setRejectOpen(false);
      setReason('');
      setSelectedSubmission(null);
    },
    onError: (err: unknown) => {
      const code = getApiErrorCode(err) ?? 'ERROR';
      toast.error(getDecisionErrorMessage(code));
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['offer-signature-submissions', jobOfferId] });
        queryClient.invalidateQueries({ queryKey: ['job-offer', jobOfferId] });
      }
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: async (reasonText: string) => {
      const res = await apiClient.post(
        `/job-offers/${jobOfferId}/request-signature-resubmission`,
        {
          expectedOfferVersion: offerVersion,
          operationId: crypto.randomUUID(),
          reason: reasonText,
        },
      );
      return unwrapApiData(res.data) as { message?: string };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? 'Candidate resubmission link will be delivered.');
      queryClient.invalidateQueries({ queryKey: ['offer-signature-submissions', jobOfferId] });
      queryClient.invalidateQueries({ queryKey: ['job-offer', jobOfferId] });
      queryClient.invalidateQueries({ queryKey: ['job-application'] });
      setResubmitOpen(false);
      setReason('');
    },
    onError: (err: unknown) => {
      const code = getApiErrorCode(err) ?? 'ERROR';
      toast.error(getDecisionErrorMessage(code));
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: ['offer-signature-submissions', jobOfferId] });
        queryClient.invalidateQueries({ queryKey: ['job-offer', jobOfferId] });
      }
    },
  });

  const handleVerify = (submission: SignatureSubmission) => {
    setSelectedSubmission(submission);
    setReason('');
    setReasonError('');
    setVerifyOpen(true);
  };

  const handleReject = (submission: SignatureSubmission) => {
    setSelectedSubmission(submission);
    setReason('');
    setReasonError('');
    setRejectOpen(true);
  };

  const confirmVerify = () => {
    if (!selectedSubmission) return;
    decideMutation.mutate({ submissionId: selectedSubmission.id, decision: 'verify', reason });
  };

  const confirmReject = () => {
    if (!reason.trim()) {
      setReasonError('A reason is required to reject the signed offer.');
      return;
    }
    if (!selectedSubmission) return;
    decideMutation.mutate({ submissionId: selectedSubmission.id, decision: 'reject', reason });
  };

  const pendingSubmission = submissions.find((s) => s.status === 'PENDING_VERIFICATION');
  const verifiedSubmission = submissions.find((s) => s.status === 'VERIFIED');
  const rejectedForResubmit = submissions.find(
    (s) => s.status === 'REJECTED' && s.allowedActions.includes('REQUEST_RESUBMISSION'),
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4 animate-spin" />
            Loading signature submissions…
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Signed Offer Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {submissions.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              No signed offer submitted by the candidate yet.
            </div>
          )}

          {verifiedSubmission && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Signed offer verified on{' '}
                {new Date(verifiedSubmission.verifiedAt!).toLocaleDateString()}.
              </AlertDescription>
            </Alert>
          )}

          {pendingSubmission && !verifiedSubmission && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-yellow-800">
                <Clock className="h-4 w-4" />
                Awaiting HR Verification — Submission #{pendingSubmission.submissionNo}
              </div>
              <div className="text-xs text-gray-600 space-y-1">
                <p>
                  <span className="font-medium">Candidate name:</span>{' '}
                  {pendingSubmission.candidateLegalName}
                </p>
                <p>
                  <span className="font-medium">Submitted:</span>{' '}
                  {new Date(pendingSubmission.submittedAt).toLocaleString()}
                </p>
              </div>

              <DocumentDownloadAction
                documentId={pendingSubmission.recruitmentDocumentId}
                documentType="recruitment"
                label="Download signed PDF"
                onGrant={async (id) => {
                  const res = await apiClient.post(`/recruitment-documents/${id}/download-grant`);
                  return unwrapApiData(res.data) as {
                    url: string;
                    expiresAt: string;
                    fileName: string;
                  };
                }}
              />

              {canVerify && pendingSubmission.allowedActions.includes('VERIFY') && pendingSubmission.fileStatus === 'CLEAN' && (
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={() => handleVerify(pendingSubmission)}
                    disabled={decideMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleReject(pendingSubmission)}
                    disabled={decideMutation.isPending}
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                </div>
              )}

              {!canVerify && (
                <p className="text-xs text-gray-400 italic">
                  You need the <code>recruitment.offer.verify</code> permission to verify or reject.
                </p>
              )}
            </div>
          )}

          {canVerify && rejectedForResubmit && !pendingSubmission && !verifiedSubmission && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 space-y-3">
              <p className="text-sm text-red-800">
                The latest signed offer was rejected. Request a new candidate resubmission when ready.
              </p>
              {rejectedForResubmit.rejectionReason ? (
                <p className="text-xs text-red-700">Reason: {rejectedForResubmit.rejectionReason}</p>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setReason(rejectedForResubmit.rejectionReason ?? '');
                  setReasonError('');
                  setResubmitOpen(true);
                }}
                disabled={resubmitMutation.isPending}
              >
                Request resubmission
              </Button>
            </div>
          )}

          {submissions.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Submission History
                </p>
                {submissions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {s.status === 'VERIFIED' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                      {s.status === 'REJECTED' && <XCircle className="h-4 w-4 text-red-500" />}
                      {s.status === 'PENDING_VERIFICATION' && <Clock className="h-4 w-4 text-yellow-500" />}
                      {s.status === 'SUPERSEDED' && <AlertTriangle className="h-4 w-4 text-gray-400" />}
                      <span className="text-gray-700">#{s.submissionNo}</span>
                    </div>
                    <SubmissionStatusBadge status={s.status} />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={verifyOpen} onOpenChange={setVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Signed Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              Confirm that you have reviewed the signed offer PDF and it is valid.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">Note (optional)</label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Add a verification note…"
                disabled={decideMutation.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyOpen(false)} disabled={decideMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={confirmVerify} disabled={decideMutation.isPending} className="bg-green-600 hover:bg-green-700">
              {decideMutation.isPending ? 'Verifying…' : 'Confirm Verify'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Signed Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600">
            <p>
              Provide a reason for rejection. The candidate will be notified and can resubmit.
            </p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Rejection reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError('');
                }}
                rows={3}
                placeholder="Describe why the signed offer is being rejected…"
                disabled={decideMutation.isPending}
              />
              {reasonError && (
                <p className="text-xs text-red-500 mt-1">{reasonError}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={decideMutation.isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject} disabled={decideMutation.isPending}>
              {decideMutation.isPending ? 'Rejecting…' : 'Confirm Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resubmitOpen} onOpenChange={setResubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request signature resubmission</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-gray-600">
            <p>A protected reason is required. The candidate receives a new action link.</p>
            <div>
              <label className="block text-sm font-medium mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <Textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setReasonError('');
                }}
                rows={3}
                placeholder="Describe why a new signed offer is required…"
                disabled={resubmitMutation.isPending}
              />
              {reasonError && <p className="text-xs text-red-500 mt-1">{reasonError}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResubmitOpen(false)}
              disabled={resubmitMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!reason.trim()) {
                  setReasonError('A reason is required to request resubmission.');
                  return;
                }
                resubmitMutation.mutate(reason);
              }}
              disabled={resubmitMutation.isPending}
            >
              {resubmitMutation.isPending ? 'Requesting…' : 'Send resubmission request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SubmissionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    PENDING_VERIFICATION: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
    VERIFIED: { label: 'Verified', className: 'bg-green-100 text-green-800' },
    REJECTED: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    SUPERSEDED: { label: 'Superseded', className: 'bg-gray-100 text-gray-500' },
  };
  const cfg = map[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
  return <Badge className={`text-xs ${cfg.className}`}>{cfg.label}</Badge>;
}

function getDecisionErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    SIGNED_OFFER_ALREADY_VERIFIED: 'This offer has already been verified.',
    SIGNED_OFFER_STATE_CHANGED: 'The submission state changed. Please refresh.',
    OFFER_VERIFICATION_PERMISSION_REQUIRED: 'You do not have permission to verify offers.',
    SIGNED_OFFER_SCAN_PENDING: 'The signed file is still being scanned.',
  };
  return messages[code] ?? 'Operation failed. Please try again.';
}
