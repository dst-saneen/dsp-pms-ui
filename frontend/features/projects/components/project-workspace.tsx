"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Search } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { StatusBadge } from "@/components/common/status-badge";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";
import { toast } from "sonner";

import { PROJECTS_PERMISSIONS, PROJECTS_ROUTES } from "../constants/permissions";
import { createOperationId } from "../lib/allowed-actions";
import { statusToneFor } from "../lib/status-tone";
import { projectsKeys } from "../hooks/query-keys";
import { useProjectsList } from "../hooks/use-projects";
import { useWorkspaceCapabilities } from "../hooks/use-workspace-capabilities";
import { officeFinanceKeys, useBusinessParties } from "@/features/office-finance/hooks";
import { OfficeFinanceService } from "@/features/office-finance/service";
import { ProjectsApiService } from "../services/projects-api.service";
import type { EligibilityCandidate } from "../types/project.types";
import { ProjectsPathBanner } from "./projects-path-banner";

const CREATE_CUSTOMER_RETURN_PATH = `${PROJECTS_ROUTES.list}?create=1&projectType=CLIENT`;

function customerCreateHref() {
  const returnTo = encodeURIComponent(CREATE_CUSTOMER_RETURN_PATH);
  return `/office-finance/setup?tab=parties&partyType=CUSTOMER&returnTo=${returnTo}`;
}

export function ProjectWorkspace() {
  const { hasPermission } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const capabilitiesQuery = useWorkspaceCapabilities();
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [createOpen, setCreateOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");
  const [managers, setManagers] = useState<EligibilityCandidate[]>([]);
  const [projectType, setProjectType] = useState<"INTERNAL" | "CLIENT">("INTERNAL");
  const [businessPartyId, setBusinessPartyId] = useState("");
  const [expectedIncome, setExpectedIncome] = useState("");
  const [expenseBudget, setExpenseBudget] = useState("");
  const autoCreateKeyRef = useRef<string | null>(null);
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  const listQuery = useProjectsList({
    keyword: keyword.trim() || undefined,
    status: status === "ALL" ? undefined : status,
    page: 1,
    limit: 50,
  });

  const clientProjectsEnabled = capabilitiesQuery.data?.clientProjectsEnabled === true;
  const partiesQuery = useBusinessParties(undefined, clientProjectsEnabled);

  const customerParties = useMemo(
    () =>
      (partiesQuery.data?.items ?? []).filter(
        (party) => party.isActive && (party.partyType === "CUSTOMER" || party.partyType === "BOTH")
      ),
    [partiesQuery.data?.items]
  );

  const createMutation = useMutation({
    mutationFn: () =>
      ProjectsApiService.create({
        projectName: projectName.trim(),
        projectType: clientProjectsEnabled ? projectType : "INTERNAL",
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        projectManagerId: projectManagerId || undefined,
        businessPartyId:
          clientProjectsEnabled && projectType === "CLIENT"
            ? businessPartyId || undefined
            : undefined,
        expectedIncome: expectedIncome.trim() || undefined,
        expenseBudget: expenseBudget.trim() || undefined,
        operationId: createOperationId(),
      }),
    onSuccess: (project) => {
      toast.success("Project created");
      setCreateOpen(false);
      resetCreateForm();
      void queryClient.invalidateQueries({ queryKey: projectsKeys.all });
      router.push(PROJECTS_ROUTES.detail(project.id));
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const canCreateProject =
    capabilitiesQuery.data?.canCreateProject ?? hasPermission(PROJECTS_PERMISSIONS.MANAGE);

  const items = listQuery.data?.items ?? [];

  const emptyMessage = useMemo(() => {
    if (listQuery.isLoading) return "Loading projects…";
    if (listQuery.error) return getApiErrorMessage(listQuery.error);
    return "No projects found.";
  }, [listQuery.error, listQuery.isLoading]);

  function resetCreateForm() {
    setProjectName("");
    setDescription("");
    setStartDate("");
    setEndDate("");
    setProjectManagerId("");
    setProjectType("INTERNAL");
    setBusinessPartyId("");
    setExpectedIncome("");
    setExpenseBudget("");
  }

  async function openCreateDialog(options?: { preferClient?: boolean; fromReturn?: boolean }) {
    if (options?.preferClient) {
      setProjectType("CLIENT");
    }
    setCreateOpen(true);
    try {
      const rows = await ProjectsApiService.getManagerCandidates();
      setManagers(rows);
    } catch (error) {
      toast.error(getApiErrorMessage(error));
    }
    if (options?.fromReturn) {
      toast.message("Select the customer you just created, then create the project.");
    }
  }

  useEffect(() => {
    if (!canCreateProject || searchParams.get("create") !== "1") {
      autoCreateKeyRef.current = null;
      return;
    }

    const preferClient = searchParams.get("projectType") === "CLIENT";
    const key = `${searchParams.toString()}:${canCreateProject}`;
    if (autoCreateKeyRef.current === key) return;
    autoCreateKeyRef.current = key;

    void ProjectsApiService.getManagerCandidates()
      .then((rows) => {
        if (autoCreateKeyRef.current === key) {
          setManagers(rows);
        }
      })
      .catch((error) => {
        if (autoCreateKeyRef.current === key) {
          toast.error(getApiErrorMessage(error));
        }
      })
      .finally(() => {
        if (autoCreateKeyRef.current !== key) return;
        if (preferClient) {
          setProjectType("CLIENT");
        }
        setCreateOpen(true);
        toast.message("Select the customer you just created, then create the project.");
        router.replace(PROJECTS_ROUTES.list);
      });
  }, [canCreateProject, router, searchParams]);

  return (
    <WorkspaceShell>
      <ProjectsPathBanner
        current="list"
        note="Create a Draft project, open it, then add Stages → Team → Tasks before Activate. Assignees work from My Workspace → Projects."
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
          <Input
            aria-label="Search projects"
            className="pl-8"
            placeholder="Search by code or name"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filter projects by status" className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="ON_HOLD">On hold</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh projects"
          onClick={() => void listQuery.refetch()}
          disabled={listQuery.isFetching}
        >
          <RefreshCw className="size-4" />
        </Button>
        {canCreateProject ? (
          <Button onClick={() => void openCreateDialog()}>
            <Plus className="size-4" />
            New project
          </Button>
        ) : (
          <Button
            type="button"
            disabled
            title="Needs projects.projects.manage (and Projects enabled for this company)."
          >
            <Plus className="size-4" />
            New project
          </Button>
        )}
      </div>
      {!canCreateProject ? (
        <p className="text-muted-foreground text-xs">
          New project is disabled: you need{" "}
          <span className="font-medium">projects.projects.manage</span> and Projects enabled
          for this company.
        </p>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              items.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <Link
                      href={PROJECTS_ROUTES.detail(project.id)}
                      className="text-primary font-medium hover:underline"
                    >
                      {project.projectCode}
                    </Link>
                  </TableCell>
                  <TableCell>{project.projectName}</TableCell>
                  <TableCell>{project.projectType}</TableCell>
                  <TableCell>
                    <StatusBadge label={project.status} tone={statusToneFor(project.status)} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetCreateForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="projectName">Name</Label>
              <Input
                id="projectName"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-manager">Project manager</Label>
              <select
                id="project-manager"
                className="flex h-9 w-full rounded-md border bg-transparent px-3 text-sm"
                value={projectManagerId}
                onChange={(event) => setProjectManagerId(event.target.value)}
              >
                <option value="">Select…</option>
                {managers.map((candidate) => (
                  <option key={candidate.employeeId} value={candidate.employeeId}>
                    {candidate.displayName}
                    {candidate.employeeCode ? ` (${candidate.employeeCode})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {clientProjectsEnabled ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="project-type">Type</Label>
                  <Select
                    value={projectType}
                    onValueChange={(value) => setProjectType(value as "INTERNAL" | "CLIENT")}
                  >
                    <SelectTrigger id="project-type" aria-label="Project type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTERNAL">Internal (company work)</SelectItem>
                      <SelectItem value="CLIENT">Client (linked customer)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    <strong>Internal</strong> = in-house work. <strong>Client</strong> = work for a
                    customer (pick/create customer here; money stays in Office Finance).
                  </p>
                </div>
                {projectType === "CLIENT" ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Label htmlFor="project-customer">Customer</Label>
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            className="text-primary text-xs font-medium hover:underline"
                            onClick={() => {
                              setNewCustomerName("");
                              setCustomerDialogOpen(true);
                            }}
                          >
                            Create customer here
                          </button>
                          <Link
                            href={customerCreateHref()}
                            className="text-muted-foreground text-xs hover:underline"
                          >
                            Or open Office Finance
                          </Link>
                        </div>
                      </div>
                      <Select value={businessPartyId} onValueChange={setBusinessPartyId}>
                        <SelectTrigger id="project-customer" aria-label="Project customer">
                          <SelectValue
                            placeholder={
                              customerParties.length === 0
                                ? "No customers yet — create one"
                                : "Select customer"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {customerParties.map((party) => (
                            <SelectItem key={party.id} value={party.id}>
                              {party.displayName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {customerParties.length === 0 ? (
                        <p className="text-muted-foreground text-xs">
                          No customers yet. Use <strong>Create customer here</strong> (stays on this
                          dialog) or Office Finance setup.
                        </p>
                      ) : null}
                    </div>
                    <p className="text-muted-foreground text-xs">
                      Set planning estimates here; record actual income and expenses in{" "}
                      <Link href="/office-finance" className="text-primary font-medium underline">
                        Finance
                      </Link>
                      .
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="expected-income">Expected income</Label>
                        <Input
                          id="expected-income"
                          inputMode="decimal"
                          value={expectedIncome}
                          onChange={(event) => setExpectedIncome(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="expense-budget">Expense budget</Label>
                        <Input
                          id="expense-budget"
                          inputMode="decimal"
                          value={expenseBudget}
                          onChange={(event) => setExpenseBudget(event.target.value)}
                        />
                      </div>
                    </div>
                  </>
                ) : null}
              </>
            ) : (
              <div className="text-muted-foreground space-y-1 rounded-md border border-dashed p-3 text-xs">
                <p>
                  <strong>Type:</strong> Internal only right now.
                </p>
                <p>
                  <strong>Client</strong> needs Finance enabled for this company (customers +
                  budgeting). Ask Platform Admin if you need Client projects.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                !projectName.trim() ||
                createMutation.isPending ||
                (clientProjectsEnabled && projectType === "CLIENT" && !businessPartyId)
              }
              onClick={() => createMutation.mutate()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-muted-foreground text-xs">
              Creates a Customer in Office Finance without leaving this form. You can also manage
              parties later under Office Finance → Setup.
            </p>
            <div className="space-y-2">
              <Label htmlFor="inline-customer-name">Customer name</Label>
              <Input
                id="inline-customer-name"
                value={newCustomerName}
                onChange={(event) => setNewCustomerName(event.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomerDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newCustomerName.trim() || creatingCustomer}
              onClick={() => {
                void (async () => {
                  setCreatingCustomer(true);
                  try {
                    const party = await OfficeFinanceService.createBusinessParty({
                      displayName: newCustomerName.trim(),
                      partyType: "CUSTOMER",
                      operationId: createOperationId(),
                    });
                    setBusinessPartyId(party.id);
                    setCustomerDialogOpen(false);
                    setNewCustomerName("");
                    void queryClient.invalidateQueries({
                      queryKey: officeFinanceKeys.businessParties,
                    });
                    toast.success("Customer created and selected.");
                  } catch (error) {
                    toast.error(
                      getApiErrorMessage(
                        error,
                        "Could not create customer. If you just got access, log out and log in once, then try again."
                      )
                    );
                  } finally {
                    setCreatingCustomer(false);
                  }
                })();
              }}
            >
              {creatingCustomer ? "Creating…" : "Create & select"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WorkspaceShell>
  );
}
