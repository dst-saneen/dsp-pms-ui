"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { FormSheet } from "@/components/common/form-sheet";
import { Button } from "@/components/ui/button";
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
import { LookupService } from "@/features/lookups/services/lookup-service";
import { useDepartments } from "@/features/lookups/hooks/use-departments";
import { useProjectsList } from "@/features/projects/hooks/use-projects";
import { createOperationId } from "@/lib/operation-id";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useBusinessParties,
  useCreateFinanceTransaction,
  useFinanceCategories,
  useFinancePaymentAccounts,
} from "../hooks";

const schema = z.object({
  transactionType: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  taxAmount: z.string().optional(),
  categoryId: z.string().optional(),
  sourceAccountId: z.string().optional(),
  destinationAccountId: z.string().optional(),
  businessPartyId: z.string().optional(),
  employeeId: z.string().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  description: z.string().min(1).max(500),
});

type FormValues = z.infer<typeof schema>;

interface CreateTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function optionalUuid(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function CreateTransactionDialog({ open, onOpenChange }: CreateTransactionDialogProps) {
  const router = useRouter();
  const create = useCreateFinanceTransaction();
  const categories = useFinanceCategories();
  const accounts = useFinancePaymentAccounts();
  const parties = useBusinessParties();
  const employees = useQuery({
    queryKey: ["lookups", "managers", "finance-transaction"],
    queryFn: () => LookupService.getManagers(),
    enabled: open,
  });
  const departments = useDepartments(undefined, { enabled: open });
  const projects = useProjectsList({ limit: 50, page: 1 });
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      transactionType: "EXPENSE",
      transactionDate: new Date().toISOString().slice(0, 10),
      amount: "",
      taxAmount: "0.00",
      description: "",
      businessPartyId: "",
      employeeId: "",
      departmentId: "",
      projectId: "",
    },
  });

  const transactionType = useWatch({
    control: form.control,
    name: "transactionType",
  });
  const categoryId = useWatch({
    control: form.control,
    name: "categoryId",
  });
  const sourceAccountId = useWatch({
    control: form.control,
    name: "sourceAccountId",
  });
  const destinationAccountId = useWatch({
    control: form.control,
    name: "destinationAccountId",
  });
  const businessPartyId = useWatch({
    control: form.control,
    name: "businessPartyId",
  });
  const employeeId = useWatch({
    control: form.control,
    name: "employeeId",
  });
  const departmentId = useWatch({
    control: form.control,
    name: "departmentId",
  });
  const projectId = useWatch({
    control: form.control,
    name: "projectId",
  });
  const isTransfer = transactionType === "TRANSFER";

  const matchingCategories = useMemo(() => {
    const items = categories.data?.items ?? [];
    if (transactionType === "INCOME") {
      return items.filter((category) => category.categoryType === "INCOME");
    }
    if (transactionType === "EXPENSE") {
      return items.filter((category) => category.categoryType === "EXPENSE");
    }
    return [];
  }, [categories.data?.items, transactionType]);

  useEffect(() => {
    if (!categoryId) return;
    const stillValid = matchingCategories.some((category) => category.id === categoryId);
    if (!stillValid) {
      form.setValue("categoryId", undefined);
    }
  }, [categoryId, form, matchingCategories]);

  async function onSubmit(values: FormValues) {
    setError(null);
    try {
      const created = await create.mutateAsync({
        transactionType: values.transactionType,
        transactionDate: values.transactionDate,
        amount: values.amount,
        taxAmount: isTransfer ? "0.00" : values.taxAmount || "0.00",
        categoryId: isTransfer ? undefined : values.categoryId,
        sourceAccountId: values.sourceAccountId,
        destinationAccountId: values.destinationAccountId,
        businessPartyId: optionalUuid(values.businessPartyId),
        employeeId: optionalUuid(values.employeeId),
        departmentId: optionalUuid(values.departmentId),
        projectId: optionalUuid(values.projectId),
        description: values.description,
        operationId: createOperationId(),
      });
      onOpenChange(false);
      form.reset();
      router.push(`/office-finance/transactions/${created.id}`);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create transaction."));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="New transaction"
      description="Write one money entry. Fill required fields; leave optional ones as None."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="create-finance-transaction" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      }
    >
      <form
        id="create-finance-transaction"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        {(accounts.data?.items?.length ?? 0) === 0 ||
        (categories.data?.items?.length ?? 0) === 0 ? (
          <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
            Setup looks incomplete (missing categories and/or payment accounts). Open{" "}
            <button
              type="button"
              className="underline"
              onClick={() => {
                onOpenChange(false);
                router.push("/office-finance/setup");
              }}
            >
              Office Finance → Setup
            </button>{" "}
            first, or create will fail with an actionable API error.
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-type">Type (required)</Label>
            <Select
              value={transactionType}
              onValueChange={(value) =>
                form.setValue("transactionType", value as FormValues["transactionType"])
              }
            >
              <SelectTrigger id="finance-transaction-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Income — money in</SelectItem>
                <SelectItem value="EXPENSE">Expense — money out</SelectItem>
                <SelectItem value="TRANSFER">Transfer — move between your wallets</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="transactionDate">Date (required)</Label>
            <Input id="transactionDate" type="date" {...form.register("transactionDate")} />
            <p className="text-muted-foreground text-xs">
              Must fall inside an OPEN finance period.
            </p>
          </div>
        </div>

        <div className={`grid gap-4 ${isTransfer ? "" : "sm:grid-cols-2"}`}>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (required)</Label>
            <Input
              id="amount"
              inputMode="decimal"
              placeholder="0.00"
              {...form.register("amount")}
            />
          </div>
          {!isTransfer ? (
            <div className="space-y-2">
              <Label htmlFor="taxAmount">Tax amount (optional)</Label>
              <Input
                id="taxAmount"
                inputMode="decimal"
                placeholder="0.00"
                {...form.register("taxAmount")}
              />
              <p className="text-muted-foreground text-xs">Leave 0.00 if no tax.</p>
            </div>
          ) : null}
        </div>

        {!isTransfer ? (
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-category">Category (required)</Label>
            <Select
              value={categoryId ?? ""}
              onValueChange={(value) => form.setValue("categoryId", value || undefined)}
            >
              <SelectTrigger id="finance-transaction-category">
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
            <p className="text-muted-foreground text-xs">
              These names come from Setup → Categories. Expense shows only Expense labels; Income
              shows only Income labels.
            </p>
          </div>
        ) : null}

        {transactionType === "EXPENSE" || transactionType === "TRANSFER" ? (
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-source-account">Source account (required)</Label>
            <Select
              value={sourceAccountId ?? ""}
              onValueChange={(value) => form.setValue("sourceAccountId", value || undefined)}
            >
              <SelectTrigger id="finance-transaction-source-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data?.items ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Wallet money leaves from (example: Petty Cash).
            </p>
          </div>
        ) : null}

        {transactionType === "INCOME" || transactionType === "TRANSFER" ? (
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-destination-account">
              Destination account (required)
            </Label>
            <Select
              value={destinationAccountId ?? ""}
              onValueChange={(value) => form.setValue("destinationAccountId", value || undefined)}
            >
              <SelectTrigger id="finance-transaction-destination-account">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {(accounts.data?.items ?? []).map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Wallet money arrives into.</p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {transactionType !== "TRANSFER" ? (
            <div className="space-y-2">
              <Label htmlFor="finance-transaction-business-party">
                Customer / vendor (optional)
              </Label>
              <Select
                value={businessPartyId || "none"}
                onValueChange={(value) =>
                  form.setValue("businessPartyId", value === "none" ? undefined : value)
                }
              >
                <SelectTrigger id="finance-transaction-business-party">
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
              <p className="text-muted-foreground text-xs">
                Who paid you / who you paid. From Setup &gt; Parties.
              </p>
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-employee">Employee (optional)</Label>
            <Select
              value={employeeId || "none"}
              onValueChange={(value) =>
                form.setValue("employeeId", value === "none" ? undefined : value)
              }
            >
              <SelectTrigger id="finance-transaction-employee">
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
            <p className="text-muted-foreground text-xs">
              Only if this cost is for one person (reimbursement). Otherwise None.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-department">Department (optional)</Label>
            <Select
              value={departmentId || "none"}
              onValueChange={(value) =>
                form.setValue("departmentId", value === "none" ? undefined : value)
              }
            >
              <SelectTrigger id="finance-transaction-department">
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
            <p className="text-muted-foreground text-xs">
              Optional tag for reporting. Leave None if unsure.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="finance-transaction-project">Project (optional)</Label>
            <Select
              value={projectId || "none"}
              onValueChange={(value) =>
                form.setValue("projectId", value === "none" ? undefined : value)
              }
            >
              <SelectTrigger id="finance-transaction-project">
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
            <p className="text-muted-foreground text-xs">
              Link to a Client/Internal project only if this money belongs to that project.
              Otherwise None.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description (required)</Label>
          <Textarea id="description" rows={3} {...form.register("description")} />
          <p className="text-muted-foreground text-xs">
            Short note, example: “Office stationery — Sep”.
          </p>
        </div>

        {error ? <p className="text-destructive text-sm">{error}</p> : null}
      </form>
    </FormSheet>
  );
}
