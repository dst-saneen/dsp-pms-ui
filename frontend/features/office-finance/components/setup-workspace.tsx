"use client";

import { Suspense, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { FormSheet } from "@/components/common/form-sheet";
import { PageToolbar } from "@/components/common/page-toolbar";
import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { DataTable } from "@/components/tables/data-table";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createOperationId } from "@/lib/operation-id";
import { useModuleCapabilities } from "@/hooks/use-module-capabilities";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import {
  useArchiveBusinessParty,
  useArchiveFinanceCategory,
  useBusinessParties,
  useCreateBusinessParty,
  useCreateFinanceCategory,
  useCreateFinancePaymentAccount,
  useCreateFinancePeriod,
  useFinanceCategories,
  useFinancePaymentAccounts,
  useFinancePeriods,
  useFinanceSettings,
  useLockFinancePeriod,
  useReactivateBusinessParty,
  useReactivateFinanceCategory,
  useReopenFinancePeriod,
  useUpdateFinancialProfile,
} from "../hooks";
import type {
  BusinessParty,
  FinanceCategory,
  FinancePaymentAccount,
  FinancePeriod,
} from "../types";
import { formatDate, formatMoney } from "../lib/format";
import { OfficeFinancePathBanner } from "./office-finance-path-banner";
import { SetupStepGuide } from "./setup-step-guide";

const SETUP_TABS = ["profile", "parties", "categories", "accounts", "periods"] as const;

type SetupTab = (typeof SETUP_TABS)[number];

function isSafeReturnPath(value: string | null): value is string {
  return Boolean(value && value.startsWith("/") && !value.startsWith("//"));
}

function SetupWorkspaceInner() {
  const searchParams = useSearchParams();
  const { hasPermission } = useAuth();
  const { data: capabilities } = useModuleCapabilities();
  const canManage =
    (capabilities?.financeActions?.includes("MANAGE_SETUP") ?? false) &&
    hasPermission("finance.settings.manage");
  const canCreateCustomerFromProjects =
    capabilities?.finance === true && hasPermission("projects.projects.manage");
  const canManageParties = canManage || canCreateCustomerFromProjects;
  const canCreatePeriod = capabilities?.financeActions?.includes("CREATE_PERIOD") ?? false;
  const canReadTransactions = hasPermission("finance.transactions.read");
  const canReadReports = hasPermission("finance.reports.read");

  const tabParam = searchParams.get("tab");
  const initialTab: SetupTab =
    tabParam && (SETUP_TABS as readonly string[]).includes(tabParam)
      ? (tabParam as SetupTab)
      : "profile";
  const returnTo = searchParams.get("returnTo");
  const partyTypeParam = searchParams.get("partyType");
  const initialPartyType: BusinessParty["partyType"] =
    partyTypeParam === "CUSTOMER" || partyTypeParam === "VENDOR" || partyTypeParam === "BOTH"
      ? partyTypeParam
      : "VENDOR";

  const safeReturnTo = isSafeReturnPath(returnTo) ? returnTo : null;

  return (
    <SetupWorkspaceTabs
      key={`${initialTab}:${initialPartyType}:${safeReturnTo ?? ""}:${canManage}:${canManageParties}`}
      autoOpenCreate={Boolean(safeReturnTo)}
      canCreatePeriod={canCreatePeriod}
      canManage={canManage}
      canManageParties={canManageParties}
      canReadReports={canReadReports}
      canReadTransactions={canReadTransactions}
      initialPartyType={initialPartyType}
      initialTab={initialTab}
      returnTo={safeReturnTo}
    />
  );
}

function SetupWorkspaceTabs({
  autoOpenCreate,
  canCreatePeriod,
  canManage,
  canManageParties,
  canReadReports,
  canReadTransactions,
  initialPartyType,
  initialTab,
  returnTo,
}: {
  autoOpenCreate: boolean;
  canCreatePeriod: boolean;
  canManage: boolean;
  canManageParties: boolean;
  canReadReports: boolean;
  canReadTransactions: boolean;
  initialPartyType: BusinessParty["partyType"];
  initialTab: SetupTab;
  returnTo: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<SetupTab>(initialTab);

  function goToTab(next: string) {
    const nextTab = (SETUP_TABS as readonly string[]).includes(next)
      ? (next as SetupTab)
      : "profile";
    setTab(nextTab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    router.replace(`/office-finance/setup?${params.toString()}`);
  }

  return (
    <WorkspaceShell>
      <OfficeFinancePathBanner
        current="setup"
        note="Think of Setup as naming the pieces of a notebook. After that, Transactions is where you write real money entries."
      />
      {canManage ? (
        <p className="text-muted-foreground mb-3 text-sm">
          Finish the five tabs in order: currency, parties, categories, accounts, and an open
          period.
          {!canReadTransactions && !canReadReports
            ? " Transactions and Reports menus stay hidden until those finance read permissions are granted—that is normal for HR."
            : null}
        </p>
      ) : (
        <p className="text-muted-foreground mb-3 text-sm">
          You can open every Setup tab to understand the path. Create / Save buttons stay disabled
          until someone with finance settings access finishes Setup (or a project manager creates a
          Customer on Parties).
        </p>
      )}
      <Tabs value={tab} onValueChange={goToTab}>
        <TabsList>
          <TabsTrigger value="profile">1. Profile</TabsTrigger>
          <TabsTrigger value="parties">2. Parties</TabsTrigger>
          <TabsTrigger value="categories">3. Categories</TabsTrigger>
          <TabsTrigger value="accounts">4. Accounts</TabsTrigger>
          <TabsTrigger value="periods">5. Periods</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="mt-4">
          <SetupStepGuide current="profile" />
          <FinancialProfileTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="parties" className="mt-4">
          <SetupStepGuide current="parties" />
          <BusinessPartiesTab
            key={`${initialPartyType}:${returnTo ?? ""}:${autoOpenCreate}:${canManageParties}`}
            canManage={canManageParties}
            financeSettingsManage={canManage}
            initialPartyType={initialPartyType}
            returnTo={returnTo}
            autoOpenCreate={autoOpenCreate}
          />
        </TabsContent>
        <TabsContent value="categories" className="mt-4">
          <SetupStepGuide current="categories" />
          <CategoriesTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <SetupStepGuide current="accounts" />
          <PaymentAccountsTab canManage={canManage} />
        </TabsContent>
        <TabsContent value="periods" className="mt-4">
          <SetupStepGuide current="periods" />
          <PeriodsTab canManage={canCreatePeriod} />
        </TabsContent>
      </Tabs>
    </WorkspaceShell>
  );
}

export function SetupWorkspace() {
  return (
    <Suspense fallback={<div className="bg-muted/40 h-40 animate-pulse rounded-xl" />}>
      <SetupWorkspaceInner />
    </Suspense>
  );
}

function FinancialProfileTab({ canManage }: { canManage: boolean }) {
  const settings = useFinanceSettings();
  const categories = useFinanceCategories();
  const update = useUpdateFinancialProfile();
  const profile = settings.data?.profile ?? null;
  const [currency, setCurrency] = useState("");
  const [reportingStartDate, setReportingStartDate] = useState("");
  const [payrollExpenseCategoryId, setPayrollExpenseCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (settings.isLoading) return <div className="bg-muted/40 h-32 animate-pulse rounded-xl" />;

  const currentCurrency = currency || profile?.baseCurrencyCode || "";
  const currentDate = reportingStartDate || profile?.reportingStartDate || "";
  const currentPayrollCategoryId =
    payrollExpenseCategoryId || profile?.payrollExpenseCategoryId || "";
  const isCreate = !profile;
  const canSubmit = canManage && Boolean(currentCurrency.trim()) && Boolean(currentDate);
  let saveLabel = "Save profile";
  if (update.isPending) {
    saveLabel = "Saving…";
  } else if (isCreate) {
    saveLabel = "Create profile";
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    try {
      await update.mutateAsync({
        expectedVersion: profile?.version ?? 0,
        operationId: createOperationId(),
        baseCurrencyCode: currentCurrency.toUpperCase(),
        reportingStartDate: currentDate,
        payrollExpenseCategoryId: currentPayrollCategoryId || undefined,
      });
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to update profile."));
    }
  }

  const expenseCategories = (categories.data?.items ?? []).filter(
    (category) => category.categoryType === "EXPENSE" && category.isActive
  );

  return (
    <form onSubmit={save} className="max-w-xl space-y-4">
      {isCreate ? (
        <p className="text-muted-foreground text-sm">
          This Company has no financial profile yet. Set the base currency and reporting start date
          to create one.
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="currency">Base currency (required)</Label>
        <Input
          id="currency"
          maxLength={3}
          value={currentCurrency}
          disabled={!canManage}
          onChange={(event) => setCurrency(event.target.value.toUpperCase())}
        />
        <p className="text-muted-foreground text-xs">
          Three-letter money code configured for this Company.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="reportingStart">Reporting start date (required)</Label>
        <Input
          id="reportingStart"
          type="date"
          value={currentDate}
          disabled={!canManage}
          onChange={(event) => setReportingStartDate(event.target.value)}
        />
        <p className="text-muted-foreground text-xs">
          First day you want to track money from. It must be on or before the month you open in
          Periods.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="finance-payroll-expense-category">
          Payroll expense category (optional — leave None)
        </Label>
        <Select
          value={currentPayrollCategoryId || "none"}
          onValueChange={(value) => setPayrollExpenseCategoryId(value === "none" ? "" : value)}
          disabled={!canManage || expenseCategories.length === 0}
        >
          <SelectTrigger id="finance-payroll-expense-category">
            <SelectValue placeholder="Select expense category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {expenseCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.categoryName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs leading-relaxed">
          This is <strong>not</strong> for normal office bills. It only tells Payroll which Expense
          label to use later when salary cost is posted into Office Finance. The list shows Expense
          categories you created in step 3 — so if you only added “Office Expense”, that is all you
          see. For day one, keep <strong>None</strong>. If you want a clear payroll label later, add
          an Expense category named “Payroll Expense” in step 3, then pick it here.
        </p>
      </div>
      {canManage ? (
        <Button type="submit" disabled={update.isPending || !canSubmit}>
          {saveLabel}
        </Button>
      ) : (
        <Button type="button" disabled title="Needs finance setup permission">
          Save profile
        </Button>
      )}
      {!canManage ? (
        <p className="text-muted-foreground text-xs">
          Save is disabled because this login cannot manage finance setup. Use Owner / Finance (or
          HR if finance settings was granted), or continue reading the tabs to learn the path.
        </p>
      ) : !canSubmit ? (
        <p className="text-muted-foreground text-xs">
          Enter the Company&apos;s three-letter currency code and a reporting start date, then Save.
          After that, use <strong>Next: Business Parties</strong> above.
        </p>
      ) : (
        <p className="text-muted-foreground text-xs">
          After Save, open <strong>Next: Business Parties</strong> in the guide above.
        </p>
      )}
      {expenseCategories.length === 0 && canManage ? (
        <p className="text-muted-foreground text-xs">
          Payroll expense category is optional for now. Add an Expense category on step 3, then
          return here to link it.
        </p>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </form>
  );
}

function BusinessPartiesTab({
  canManage,
  financeSettingsManage = false,
  initialPartyType = "VENDOR",
  returnTo = null,
  autoOpenCreate = false,
}: {
  canManage: boolean;
  financeSettingsManage?: boolean;
  initialPartyType?: BusinessParty["partyType"];
  returnTo?: string | null;
  autoOpenCreate?: boolean;
}) {
  const router = useRouter();
  const query = useBusinessParties();
  const create = useCreateBusinessParty();
  const archive = useArchiveBusinessParty();
  const reactivate = useReactivateBusinessParty();
  const [open, setOpen] = useState(autoOpenCreate && canManage);
  const [displayName, setDisplayName] = useState("");
  const [partyType, setPartyType] = useState<BusinessParty["partyType"]>(initialPartyType);
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<BusinessParty>[] = [
    { accessorKey: "partyCode", header: "Code" },
    { accessorKey: "displayName", header: "Name" },
    { accessorKey: "partyType", header: "Type" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? "Active" : "Archived"}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const party = row.original;
        if (!canManage) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {party.allowedActions.includes("ARCHIVE") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={archive.isPending}
                onClick={() =>
                  void archive.mutateAsync({
                    id: party.id,
                    data: {
                      expectedVersion: party.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Archive
              </Button>
            ) : null}
            {party.allowedActions.includes("REACTIVATE") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={reactivate.isPending}
                onClick={() =>
                  void reactivate.mutateAsync({
                    id: party.id,
                    data: {
                      expectedVersion: party.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Reactivate
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) return setError("Name is required.");
    // Project-manage users may only create Customers (not vendors).
    if (!financeSettingsManage && partyType !== "CUSTOMER") {
      return setError(
        "With project access you can create Customers only. Vendors need finance settings permission."
      );
    }
    setError(null);
    try {
      await create.mutateAsync({
        displayName: displayName.trim(),
        partyType,
        operationId: createOperationId(),
      });
      setDisplayName("");
      setOpen(false);
      if (returnTo) {
        toast.success("Customer created. Returning to Projects…");
        router.push(returnTo);
      }
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create business party."));
    }
  }

  return (
    <>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">
          {returnTo
            ? "Create a customer, then you will return to finish the project."
            : "Customers and vendors."}
        </span>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" />
            {initialPartyType === "CUSTOMER" ? "Add customer" : "Add party"}
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            title="Needs finance.settings.manage to create customers/vendors."
          >
            <Plus className="mr-1 size-4" />
            {initialPartyType === "CUSTOMER" ? "Add customer" : "Add party"}
          </Button>
        )}
      </PageToolbar>
      {!canManage ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can view parties, but create is disabled without finance settings or project manage
          permission
          {returnTo ? ". Prefer Create customer on the New project dialog." : "."}
        </p>
      ) : !financeSettingsManage ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can create <strong>Customers</strong> for Client projects. Vendor create still needs
          finance settings permission.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        error={
          query.error ? getApiErrorMessage(query.error, "Could not load business parties.") : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No business parties"
        emptyDescription="Add customers and vendors used on transactions."
        enablePagination
        pageSize={10}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title={initialPartyType === "CUSTOMER" ? "New customer" : "New business party"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-party" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="create-party" onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="party-name">Display name</Label>
            <Input
              id="party-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={partyType}
              onValueChange={(value) => setPartyType(value as BusinessParty["partyType"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CUSTOMER">Customer</SelectItem>
                <SelectItem value="VENDOR">Vendor</SelectItem>
                <SelectItem value="BOTH">Both</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </>
  );
}

function CategoriesTab({ canManage }: { canManage: boolean }) {
  const query = useFinanceCategories();
  const create = useCreateFinanceCategory();
  const archive = useArchiveFinanceCategory();
  const reactivate = useReactivateFinanceCategory();
  const [open, setOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<FinanceCategory["categoryType"]>("EXPENSE");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<FinanceCategory>[] = [
    { accessorKey: "categoryCode", header: "Code" },
    { accessorKey: "categoryName", header: "Name" },
    { accessorKey: "categoryType", header: "Type" },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <StatusBadge
          label={row.original.isActive ? "Active" : "Archived"}
          tone={row.original.isActive ? "success" : "neutral"}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const category = row.original;
        if (!canManage) return null;
        return (
          <div className="flex flex-wrap gap-2">
            {category.allowedActions.includes("ARCHIVE") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={archive.isPending}
                onClick={() =>
                  void archive.mutateAsync({
                    id: category.id,
                    data: {
                      expectedVersion: category.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Archive
              </Button>
            ) : null}
            {category.allowedActions.includes("REACTIVATE") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={reactivate.isPending}
                onClick={() =>
                  void reactivate.mutateAsync({
                    id: category.id,
                    data: {
                      expectedVersion: category.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Reactivate
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!categoryName.trim()) return setError("Name is required.");
    setError(null);
    try {
      await create.mutateAsync({
        categoryName: categoryName.trim(),
        categoryType,
        description: description.trim() || undefined,
        operationId: createOperationId(),
      });
      setCategoryName("");
      setDescription("");
      setOpen(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create category."));
    }
  }

  return (
    <>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">Income and expense categories.</span>
        {canManage ? (
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" />
            Add category
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            title="Needs finance.settings.manage to create categories."
          >
            <Plus className="mr-1 size-4" />
            Add category
          </Button>
        )}
      </PageToolbar>
      {!canManage ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can view categories, but create is disabled without finance settings permission.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error, "Could not load categories.") : null}
        onRetry={() => void query.refetch()}
        emptyTitle="No categories"
        emptyDescription="Create Income and Expense categories before recording transactions."
        enablePagination
        pageSize={10}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="New category"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-category" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="create-category" onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={categoryType}
              onValueChange={(value) => setCategoryType(value as FinanceCategory["categoryType"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="INCOME">Income</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </>
  );
}

function PaymentAccountsTab({ canManage }: { canManage: boolean }) {
  const query = useFinancePaymentAccounts();
  const settings = useFinanceSettings();
  const create = useCreateFinancePaymentAccount();
  const [open, setOpen] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<FinancePaymentAccount["accountType"]>("BANK");
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [openingDate, setOpeningDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const profileCurrency = settings.data?.profile?.baseCurrencyCode ?? "";

  const columns: ColumnDef<FinancePaymentAccount>[] = [
    { accessorKey: "accountCode", header: "Code" },
    { accessorKey: "accountName", header: "Name" },
    { accessorKey: "accountType", header: "Type" },
    {
      accessorKey: "projectedBalance",
      header: "Balance",
      cell: ({ row }) =>
        formatMoney(
          row.original.projectedBalance ?? row.original.openingBalance,
          row.original.currencyCode
        ),
    },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accountName.trim()) return setError("Name is required.");
    setError(null);
    try {
      await create.mutateAsync({
        accountName: accountName.trim(),
        accountType,
        currencyCode: profileCurrency || undefined,
        openingBalance,
        openingDate,
        operationId: createOperationId(),
      });
      setAccountName("");
      setOpen(false);
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create payment account."));
    }
  }

  return (
    <>
      <PageToolbar>
        <span className="text-muted-foreground text-sm">Bank and cash accounts.</span>
        {canManage ? (
          <Button
            onClick={() => setOpen(true)}
            disabled={!profileCurrency}
            title={
              !profileCurrency
                ? "Save Financial Profile (base currency) before adding accounts."
                : undefined
            }
          >
            <Plus className="mr-1 size-4" />
            Add account
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            title="Needs finance.settings.manage to create payment accounts."
          >
            <Plus className="mr-1 size-4" />
            Add account
          </Button>
        )}
      </PageToolbar>
      {!canManage ? (
        <p className="text-muted-foreground mb-3 text-xs">
          You can view accounts, but create is disabled without finance settings permission.
        </p>
      ) : !profileCurrency ? (
        <p className="text-muted-foreground mb-3 text-xs">
          Add account is disabled until Financial Profile has a base currency. Open the Profile tab
          and save first.
        </p>
      ) : null}
      <DataTable
        columns={columns}
        data={query.data?.items ?? []}
        isLoading={query.isLoading}
        error={
          query.error ? getApiErrorMessage(query.error, "Could not load payment accounts.") : null
        }
        onRetry={() => void query.refetch()}
        emptyTitle="No payment accounts"
        emptyDescription="Add cash/bank accounts used for income, expense, and transfers."
        enablePagination
        pageSize={10}
      />
      <FormSheet
        open={open}
        onOpenChange={setOpen}
        title="New payment account"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-account" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        }
      >
        <form id="create-account" onSubmit={submit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="account-name">Account name</Label>
            <Input
              id="account-name"
              value={accountName}
              onChange={(event) => setAccountName(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={accountType}
                onValueChange={(value) =>
                  setAccountType(value as FinancePaymentAccount["accountType"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK">Bank</SelectItem>
                  <SelectItem value="CASH">Cash / Petty cash</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-currency">Currency</Label>
              <Input
                id="account-currency"
                maxLength={3}
                value={profileCurrency || "Set financial profile first"}
                disabled
                readOnly
              />
              <p className="text-muted-foreground text-xs">
                Payment accounts use the Company financial profile currency.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="opening-balance">Opening balance</Label>
              <Input
                id="opening-balance"
                inputMode="decimal"
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="opening-date">Opening date</Label>
              <Input
                id="opening-date"
                type="date"
                value={openingDate}
                onChange={(event) => setOpeningDate(event.target.value)}
              />
            </div>
          </div>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </form>
      </FormSheet>
    </>
  );
}

function PeriodsTab({ canManage }: { canManage: boolean }) {
  const query = useFinancePeriods();
  const create = useCreateFinancePeriod();
  const lock = useLockFinancePeriod();
  const reopen = useReopenFinancePeriod();
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<FinancePeriod>[] = [
    {
      id: "period",
      header: "Period",
      cell: ({ row }) =>
        `${row.original.periodYear}-${String(row.original.periodMonth).padStart(2, "0")}`,
    },
    {
      accessorKey: "periodStart",
      header: "Start",
      cell: ({ row }) => formatDate(row.original.periodStart),
    },
    {
      accessorKey: "periodEnd",
      header: "End",
      cell: ({ row }) => formatDate(row.original.periodEnd),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge label={row.original.status} tone="neutral" />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        if (!canManage) return null;
        const period = row.original;
        return (
          <div className="flex flex-wrap gap-2">
            {period.allowedActions.includes("LOCK") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={lock.isPending}
                onClick={() =>
                  void lock.mutateAsync({
                    id: period.id,
                    data: {
                      expectedVersion: period.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Lock
              </Button>
            ) : null}
            {period.allowedActions.includes("REOPEN") ? (
              <Button
                size="sm"
                variant="outline"
                disabled={reopen.isPending}
                onClick={() =>
                  void reopen.mutateAsync({
                    id: period.id,
                    data: {
                      expectedVersion: period.version,
                      operationId: createOperationId(),
                    },
                  })
                }
              >
                Reopen
              </Button>
            ) : null}
          </div>
        );
      },
    },
  ];

  async function createPeriod(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await create.mutateAsync({
        periodYear: year,
        periodMonth: month,
        operationId: createOperationId(),
      });
    } catch (cause) {
      setError(getApiErrorMessage(cause, "Unable to create period."));
    }
  }

  return (
    <>
      {canManage ? (
        <form onSubmit={createPeriod} className="mb-4 flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="period-year">Year</Label>
            <Input
              id="period-year"
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-month">Month</Label>
            <Input
              id="period-month"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
            />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create period"}
          </Button>
          {error ? <p className="text-destructive w-full text-sm">{error}</p> : null}
        </form>
      ) : (
        <p className="text-muted-foreground mb-3 text-xs">
          Create / lock / reopen period needs finance period create permission (usually finance
          settings). You can still view existing periods.
        </p>
      )}
      <DataTable
        columns={columns}
        data={query.data ?? []}
        isLoading={query.isLoading}
        error={query.error ? getApiErrorMessage(query.error, "Could not load periods.") : null}
        onRetry={() => void query.refetch()}
        emptyTitle="No finance periods"
        emptyDescription="Create an OPEN monthly period before posting transactions for that month."
        enablePagination
        pageSize={10}
      />
    </>
  );
}
