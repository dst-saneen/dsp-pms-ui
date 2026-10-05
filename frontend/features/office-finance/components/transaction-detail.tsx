"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { EntityDetailLayout } from "@/components/common/entity-detail-layout";
import { ErrorState } from "@/components/common/error-state";
import { FormSheet } from "@/components/common/form-sheet";
import { InfoCard } from "@/components/common/info-card";
import { InfoRow } from "@/components/common/info-row";
import { StatusBadge } from "@/components/common/status-badge";
import {
  SecureFileUploadField,
  type UploadSessionResponse,
} from "@/components/file-upload/secure-file-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { LookupService } from "@/features/lookups/services/lookup-service";
import { useProjectsList } from "@/features/projects/hooks/use-projects";
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage } from "@/services/api-client";
import { useQuery } from "@tanstack/react-query";

import {
  useFinanceTransaction,
  useFinanceTransactionAttachments,
  useFinanceTransactionHistory,
  useLinkFinanceAttachment,
  useUpdateFinanceTransaction,
  useBusinessParties,
  useFinanceCategories,
  useFinancePaymentAccounts,
} from "../hooks";
import { OfficeFinanceService } from "../service";
import type { FinanceTransaction, FinanceTransactionAction } from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { TransactionActionDialog } from "./transaction-action-dialog";

type ActionMode = Extract<
  FinanceTransactionAction,
  "SUBMIT" | "APPROVE" | "RETURN" | "CANCEL" | "REVERSE"
>;

interface TransactionDetailProps {
  transactionId: string;
}

export function TransactionDetail({ transactionId }: TransactionDetailProps) {
  const query = useFinanceTransaction(transactionId);
  const history = useFinanceTransactionHistory(transactionId);
  const attachments = useFinanceTransactionAttachments(transactionId);
  const accounts = useFinancePaymentAccounts({ limit: 100 });
  const update = useUpdateFinanceTransaction();
  const [actionOpen, setActionOpen] = useState(false);
  const [actionMode, setActionMode] = useState<ActionMode>("SUBMIT");
  const [editOpen, setEditOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editTaxAmount, setEditTaxAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editSourceAccountId, setEditSourceAccountId] = useState("");
  const [editDestinationAccountId, setEditDestinationAccountId] = useState("");
  const [editBusinessPartyId, setEditBusinessPartyId] = useState("");
  const [editEmployeeId, setEditEmployeeId] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(null);

  if (query.isLoading) {
    return <div className="bg-muted/40 h-48 animate-pulse rounded-xl" />;
  }

  if (query.error || !query.data) {
    return (
      <ErrorState
        description={getApiErrorMessage(query.error, "Transaction not found.")}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const transaction = query.data;

  function accountLabel(accountId: string | null | undefined) {
    if (!accountId) return "—";
    const match = (accounts.data?.items ?? []).find((account) => account.id === accountId);
    return match?.accountName ?? "Account unavailable";
  }

  function openAction(mode: ActionMode) {
    setActionMode(mode);
    setActionOpen(true);
  }

  function openEdit() {
    setEditDate(transaction.transactionDate.slice(0, 10));
    setEditAmount(transaction.amount);
    setEditTaxAmount(transaction.taxAmount);
    setEditDescription(transaction.description);
    setEditCategoryId(transaction.categoryId ?? "");
    setEditSourceAccountId(transaction.movement.sourceAccountId ?? "");
    setEditDestinationAccountId(transaction.movement.destinationAccountId ?? "");
    setEditBusinessPartyId(transaction.businessPartyId ?? "");
    setEditEmployeeId(transaction.employeeId ?? "");
    setEditDepartmentId(transaction.departmentId ?? "");
    setEditProjectId(transaction.projectId ?? "");
    setEditError(null);
    setEditOpen(true);
  }

  async function submitEdit(event: React.FormEvent) {
    event.preventDefault();
    setEditError(null);
    try {
      await update.mutateAsync({
        id: transaction.id,
        data: {
          expectedVersion: transaction.version,
          operationId: createOperationId(),
          transactionDate: editDate,
          amount: editAmount,
          taxAmount: editTaxAmount,
          description: editDescription,
          ...(editCategoryId ? { categoryId: editCategoryId } : {}),
          ...(editSourceAccountId ? { sourceAccountId: editSourceAccountId } : {}),
          ...(editDestinationAccountId ? { destinationAccountId: editDestinationAccountId } : {}),
          businessPartyId: editBusinessPartyId || null,
          employeeId: editEmployeeId || null,
          departmentId: editDepartmentId || null,
          projectId: editProjectId || null,
        },
      });
      setEditOpen(false);
      void query.refetch();
      void history.refetch();
    } catch (cause) {
      setEditError(getApiErrorMessage(cause, "Unable to update transaction."));
    }
  }

  async function downloadAttachment(attachmentId: string) {
    setDownloadPendingId(attachmentId);
    try {
      const grant = await OfficeFinanceService.createAttachmentDownloadGrant(
        transactionId,
        attachmentId
      );
      const anchor = document.createElement("a");
      anchor.href = grant.url;
      anchor.download = grant.fileName;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (cause) {
      toast.error(getApiErrorMessage(cause, "Unable to download attachment."));
    } finally {
      setDownloadPendingId(null);
    }
  }

  const actionButtons: Array<{
    mode: ActionMode;
    label: string;
    variant?: "destructive" | "outline" | "default";
  }> = [
    { mode: "SUBMIT", label: "Submit" },
    { mode: "APPROVE", label: "Approve" },
    { mode: "RETURN", label: "Return", variant: "outline" },
    { mode: "CANCEL", label: "Cancel", variant: "destructive" },
    { mode: "REVERSE", label: "Reverse", variant: "destructive" },
  ];

  return (
    <>
      <EntityDetailLayout
        header={
          <div className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-sm">
                  <Link href="/office-finance/transactions" className="hover:underline">
                    Transactions
                  </Link>
                </p>
                <h1 className="text-2xl font-semibold">{transaction.transactionNumber}</h1>
                <p className="text-muted-foreground mt-1 text-sm">{transaction.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {transaction.allowedActions.includes("EDIT") ? (
                  <Button size="sm" variant="outline" onClick={openEdit}>
                    Edit
                  </Button>
                ) : null}
                {transaction.allowedActions.includes("ATTACH_DOCUMENT") ? (
                  <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
                    Attach document
                  </Button>
                ) : null}
                {actionButtons
                  .filter((button) => transaction.allowedActions.includes(button.mode))
                  .map((button) => (
                    <Button
                      key={button.mode}
                      size="sm"
                      variant={button.variant ?? "default"}
                      onClick={() => openAction(button.mode)}
                    >
                      {button.label}
                    </Button>
                  ))}
              </div>
            </div>
            {transaction.status === "SUBMITTED" &&
            !transaction.allowedActions.includes("APPROVE") ? (
              <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
                No Approve button here because the person who submitted cannot approve their own
                entry (maker/checker). Log out, sign in as a different user with finance approve
                access (for example Finance Manager), open this transaction, then click Approve.
              </p>
            ) : null}
          </div>
        }
        summary={
          <InfoCard title="Summary">
            <InfoRow
              label="Status"
              value={<StatusBadge label={transaction.status} tone="neutral" />}
            />
            <InfoRow label="Type" value={transaction.transactionType} />
            <InfoRow label="Date" value={formatDate(transaction.transactionDate)} />
            <InfoRow
              label="Amount"
              value={formatMoney(transaction.amount, transaction.currencyCode)}
            />
            <InfoRow
              label="Tax"
              value={formatMoney(transaction.taxAmount, transaction.currencyCode)}
            />
            <InfoRow label="Version" value={transaction.version} />
          </InfoCard>
        }
      >
        {transaction.warnings.length ? (
          <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
            <CardHeader>
              <CardTitle className="text-base">Warnings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {transaction.warnings.map((warning) => (
                <p key={warning.code} className="text-sm">
                  {warning.message}
                </p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cash movement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow
                label="Source account (money left from)"
                value={accountLabel(transaction.movement.sourceAccountId)}
              />
              <InfoRow
                label="Destination account (money arrived in)"
                value={accountLabel(transaction.movement.destinationAccountId)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Reversals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow
                label="Reversal of"
                value={
                  transaction.reversalOfTransactionId ? (
                    <Link
                      href={`/office-finance/transactions/${transaction.reversalOfTransactionId}`}
                      className="text-primary hover:underline"
                    >
                      {transaction.reversalOfTransactionId}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Reversed by"
                value={
                  transaction.reversedByTransactionId ? (
                    <Link
                      href={`/office-finance/transactions/${transaction.reversedByTransactionId}`}
                      className="text-primary hover:underline"
                    >
                      {transaction.reversedByTransactionId}
                    </Link>
                  ) : (
                    "—"
                  )
                }
              />
            </CardContent>
          </Card>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Attachments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attachments.isLoading ? (
              <div className="bg-muted/40 h-16 animate-pulse rounded-xl" />
            ) : (attachments.data ?? []).length ? (
              attachments.data?.map((attachment) => (
                <div
                  key={attachment.id}
                  className="border-border flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0"
                >
                  <div>
                    <p className="font-medium">{attachment.title || "Untitled attachment"}</p>
                    <p className="text-muted-foreground text-sm">
                      Linked {formatDate(attachment.linkedAt.slice(0, 10))}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={downloadPendingId === attachment.id}
                    onClick={() => void downloadAttachment(attachment.id)}
                  >
                    {downloadPendingId === attachment.id ? "Downloading…" : "Download"}
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No attachments linked yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Action history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(history.data ?? []).length ? (
              history.data?.map((entry) => (
                <div key={entry.id} className="border-border border-b pb-3 last:border-0">
                  <p className="font-medium">{entry.action}</p>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(entry.createdAt.slice(0, 10))}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No history recorded yet.</p>
            )}
          </CardContent>
        </Card>
      </EntityDetailLayout>

      <TransactionActionDialog
        open={actionOpen}
        onOpenChange={setActionOpen}
        transaction={transaction}
        mode={actionMode}
        onCompleted={() => {
          void query.refetch();
          void history.refetch();
        }}
      />

      <EditTransactionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={transaction}
        date={editDate}
        amount={editAmount}
        taxAmount={editTaxAmount}
        description={editDescription}
        categoryId={editCategoryId}
        sourceAccountId={editSourceAccountId}
        destinationAccountId={editDestinationAccountId}
        businessPartyId={editBusinessPartyId}
        employeeId={editEmployeeId}
        departmentId={editDepartmentId}
        projectId={editProjectId}
        error={editError}
        pending={update.isPending}
        onDateChange={setEditDate}
        onAmountChange={setEditAmount}
        onTaxAmountChange={setEditTaxAmount}
        onDescriptionChange={setEditDescription}
        onCategoryChange={setEditCategoryId}
        onSourceAccountChange={setEditSourceAccountId}
        onDestinationAccountChange={setEditDestinationAccountId}
        onBusinessPartyChange={setEditBusinessPartyId}
        onEmployeeChange={setEditEmployeeId}
        onDepartmentChange={setEditDepartmentId}
        onProjectChange={setEditProjectId}
        onSubmit={submitEdit}
      />

      <AttachDocumentDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        transactionId={transactionId}
        onCompleted={() => void attachments.refetch()}
      />
    </>
  );
}

function AttachDocumentDialog({
  open,
  onOpenChange,
  transactionId,
  onCompleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  onCompleted?: () => void;
}) {
  const link = useLinkFinanceAttachment();
  const [title, setTitle] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleLink() {
    if (!sessionId) {
      setError("Upload a clean file before linking.");
      return;
    }
    setError(null);
    try {
      await link.mutateAsync({
        transactionId,
        data: {
          uploadSessionId: sessionId,
          title: title.trim() || undefined,
          operationId: createOperationId(),
        },
      });
      setTitle("");
      setSessionId(null);
      onOpenChange(false);
      onCompleted?.();
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to link attachment."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Attach document"
      description="Upload a receipt or supporting file, then link it to this transaction."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={link.isPending || !sessionId}
            onClick={() => void handleLink()}
          >
            {link.isPending ? "Linking…" : "Link attachment"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="attachment-title">Title (optional)</Label>
          <Input
            id="attachment-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <SecureFileUploadField
          label="Receipt or document"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          maxSizeMb={10}
          onSessionReady={(readySessionId) => setSessionId(readySessionId)}
          onError={(_code, message) => setError(message)}
          createSession={async (params) =>
            (await OfficeFinanceService.createUploadSession(
              transactionId,
              params
            )) as UploadSessionResponse
          }
          finalizeSession={async (id, sessionToken) =>
            (await OfficeFinanceService.finalizeUploadSession(
              transactionId,
              id,
              sessionToken
            )) as UploadSessionResponse
          }
          pollSession={async (id, sessionToken) =>
            (await OfficeFinanceService.getUploadSession(
              transactionId,
              id,
              sessionToken
            )) as UploadSessionResponse
          }
        />
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </div>
    </FormSheet>
  );
}

function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  date,
  amount,
  taxAmount,
  description,
  categoryId,
  sourceAccountId,
  destinationAccountId,
  businessPartyId,
  employeeId,
  departmentId,
  projectId,
  error,
  pending,
  onDateChange,
  onAmountChange,
  onTaxAmountChange,
  onDescriptionChange,
  onCategoryChange,
  onSourceAccountChange,
  onDestinationAccountChange,
  onBusinessPartyChange,
  onEmployeeChange,
  onDepartmentChange,
  onProjectChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: FinanceTransaction;
  date: string;
  amount: string;
  taxAmount: string;
  description: string;
  categoryId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  businessPartyId: string;
  employeeId: string;
  departmentId: string;
  projectId: string;
  error: string | null;
  pending: boolean;
  onDateChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onTaxAmountChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSourceAccountChange: (value: string) => void;
  onDestinationAccountChange: (value: string) => void;
  onBusinessPartyChange: (value: string) => void;
  onEmployeeChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onProjectChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}) {
  const categories = useFinanceCategories();
  const accounts = useFinancePaymentAccounts();
  const parties = useBusinessParties();
  const employees = useQuery({
    queryKey: ["lookups", "managers", "finance-transaction-edit"],
    queryFn: () => LookupService.getManagers(),
    enabled: open,
  });
  const departments = useDepartments(undefined, { enabled: open });
  const projects = useProjectsList({ limit: 50, page: 1 });
  const matchingCategories = (categories.data?.items ?? []).filter(
    (category) =>
      transaction.transactionType !== "TRANSFER" &&
      category.categoryType === transaction.transactionType
  );
  const isTransfer = transaction.transactionType === "TRANSFER";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit transaction"
      description={transaction.transactionNumber}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="edit-finance-transaction" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <form id="edit-finance-transaction" onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="edit-date">Date</Label>
          <Input
            id="edit-date"
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-amount">Amount</Label>
            <Input
              id="edit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => onAmountChange(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-tax">Tax amount</Label>
            <Input
              id="edit-tax"
              inputMode="decimal"
              value={taxAmount}
              onChange={(event) => onTaxAmountChange(event.target.value)}
            />
          </div>
        </div>
        {!isTransfer ? (
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={onCategoryChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {matchingCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.categoryName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {transaction.transactionType === "EXPENSE" || isTransfer ? (
          <div className="space-y-2">
            <Label>Source account</Label>
            <Select value={sourceAccountId} onValueChange={onSourceAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data?.items ?? [])
                  .filter((account) => account.isActive)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        {transaction.transactionType === "INCOME" || isTransfer ? (
          <div className="space-y-2">
            <Label>Destination account</Label>
            <Select value={destinationAccountId} onValueChange={onDestinationAccountChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data?.items ?? [])
                  .filter((account) => account.isActive)
                  .map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {!isTransfer ? (
            <div className="space-y-2">
              <Label>Business party</Label>
              <Select
                value={businessPartyId || "none"}
                onValueChange={(value) => onBusinessPartyChange(value === "none" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select party" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {(parties.data?.items ?? [])
                    .filter((party) => party.isActive)
                    .map((party) => (
                      <SelectItem key={party.id} value={party.id}>
                        {party.displayName} ({party.partyType})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select
              value={employeeId || "none"}
              onValueChange={(value) => onEmployeeChange(value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(employees.data ?? []).map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={departmentId || "none"}
              onValueChange={(value) => onDepartmentChange(value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(departments.data ?? []).map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Project</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(value) => onProjectChange(value === "none" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(projects.data?.items ?? []).map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-description">Description</Label>
          <Textarea
            id="edit-description"
            rows={3}
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
          />
        </div>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
