"use client";

import { useState } from "react";
import { Plus, Route } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { PageToolbar } from "@/components/common/page-toolbar";
import { WorkspaceShell } from "@/components/common/workspace-shell";
import { useAuth } from "@/providers/auth-provider";
import { getApiErrorMessage } from "@/services/api-client";

import {
  useApprovalWorkflows,
  useCreateApprovalWorkflow,
  useCreateApprovalWorkflowStep,
} from "../hooks";
import type { ApprovalWorkflow } from "../types";

const APPROVER_TYPES = [
  "REPORTING_MANAGER",
  "HR",
  "ROLE",
] as const;

function nextStepNumber(workflow: ApprovalWorkflow | undefined) {
  return Math.max(0, ...((workflow?.steps ?? []).map((step) => step.stepNo))) + 1;
}

export function ApprovalWorkflowWorkspace() {
  const { user } = useAuth();
  const workflowsQuery = useApprovalWorkflows();
  const createWorkflow = useCreateApprovalWorkflow();
  const createStep = useCreateApprovalWorkflowStep();
  const [workflowCode, setWorkflowCode] = useState("HR_REQUEST");
  const [workflowName, setWorkflowName] = useState("");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
  const [approverType, setApproverType] = useState<(typeof APPROVER_TYPES)[number]>(
    "REPORTING_MANAGER",
  );
  const [approverRole, setApproverRole] = useState("");
  const activeCompanyId = user?.authorization.activeCompanyId ?? "";
  const workflows = workflowsQuery.data ?? [];
  const selectedWorkflow = workflows.find(
    (workflow) => workflow.id === selectedWorkflowId,
  );

  async function addWorkflow() {
    if (!activeCompanyId || !workflowCode.trim() || !workflowName.trim()) return;
    try {
      const workflow = await createWorkflow.mutateAsync({
        companyId: activeCompanyId,
        workflowCode: workflowCode.trim().toUpperCase(),
        workflowName: workflowName.trim(),
      });
      setSelectedWorkflowId(workflow.id);
      setWorkflowName("");
      toast.success("Approval workflow created. Add its approval steps next.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not create approval workflow."));
    }
  }

  async function addStep() {
    if (!selectedWorkflow) return;
    if (approverType === "ROLE" && !approverRole.trim()) {
      toast.error("Enter the role that can approve this step.");
      return;
    }
    try {
      await createStep.mutateAsync({
        workflowId: selectedWorkflow.id,
        stepNo: nextStepNumber(selectedWorkflow),
        approverType,
        approverRole: approverType === "ROLE" ? approverRole.trim() : undefined,
      });
      setApproverRole("");
      toast.success("Approval step added.");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Could not add approval step."));
    }
  }

  return (
    <WorkspaceShell>
      <Alert>
        <Route />
        <AlertTitle>Company approval routing</AlertTitle>
        <AlertDescription>
          Workflows belong only to the active Company. Create a path, add each
          approval step, then select it in HR request types. For employee
          separation, use the code <code>EMPLOYEE_SEPARATION</code>.
        </AlertDescription>
      </Alert>

      {!activeCompanyId ? (
        <Alert variant="destructive">
          <AlertTitle>Company context required</AlertTitle>
          <AlertDescription>
            Switch to a Company before configuring approval routing.
          </AlertDescription>
        </Alert>
      ) : (
        <>
          <PageToolbar>
            <div className="grid w-full gap-3 md:grid-cols-[minmax(10rem,0.6fr)_minmax(16rem,1fr)_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="approval-workflow-code">Workflow code</Label>
                <Input
                  id="approval-workflow-code"
                  value={workflowCode}
                  onChange={(event) => setWorkflowCode(event.target.value)}
                  placeholder="HR_REQUEST"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="approval-workflow-name">Workflow name</Label>
                <Input
                  id="approval-workflow-name"
                  value={workflowName}
                  onChange={(event) => setWorkflowName(event.target.value)}
                  placeholder="Manager then HR"
                />
              </div>
              <Button
                onClick={() => void addWorkflow()}
                disabled={
                  !workflowCode.trim() ||
                  !workflowName.trim() ||
                  createWorkflow.isPending
                }
              >
                <Plus />
                {createWorkflow.isPending ? "Creatingâ€¦" : "Create workflow"}
              </Button>
            </div>
          </PageToolbar>

          {workflowsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading workflowsâ€¦</p>
          ) : workflowsQuery.error ? (
            <Alert variant="destructive">
              <AlertTitle>Could not load workflows</AlertTitle>
              <AlertDescription>
                {getApiErrorMessage(workflowsQuery.error, "Try again after checking your Company scope.")}
              </AlertDescription>
            </Alert>
          ) : workflows.length === 0 ? (
            <Alert>
              <AlertTitle>No approval workflows yet</AlertTitle>
              <AlertDescription>
                Create a Company workflow, then add at least one approval step.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Workflow</th>
                    <th className="px-4 py-3 font-medium">Steps</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {workflows.map((workflow) => (
                    <tr key={workflow.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-medium">{workflow.workflowName}</p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {workflow.workflowCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {workflow.steps.length === 0
                          ? "No approval steps"
                          : workflow.steps
                              .slice()
                              .sort((a, b) => a.stepNo - b.stepNo)
                              .map((step) =>
                                step.approverRole
                                  ? `${step.stepNo}. ${step.approverType} (${step.approverRole})`
                                  : `${step.stepNo}. ${step.approverType}`,
                              )
                              .join(" â†’ ")}
                      </td>
                      <td className="px-4 py-3">
                        {workflow.isActive ? "Active" : "Inactive"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <section className="rounded-xl border p-4">
            <h2 className="font-medium">Add approval step</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Steps run in the order shown. A workflow is usable only after it has
              at least one step.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(12rem,0.7fr)_minmax(12rem,0.7fr)_auto] md:items-end">
              <div className="space-y-1">
                <Label htmlFor="approval-step-workflow">Workflow</Label>
                <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
                  <SelectTrigger id="approval-step-workflow">
                    <SelectValue placeholder="Select workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    {workflows.map((workflow) => (
                      <SelectItem key={workflow.id} value={workflow.id}>
                        {workflow.workflowName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="approval-step-type">Approver</Label>
                <Select
                  value={approverType}
                  onValueChange={(value) =>
                    setApproverType(value as (typeof APPROVER_TYPES)[number])
                  }
                >
                  <SelectTrigger id="approval-step-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPROVER_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.replaceAll("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="approval-step-role">
                  Role {approverType === "ROLE" ? "(required)" : "(not used)"}
                </Label>
                <Input
                  id="approval-step-role"
                  value={approverRole}
                  onChange={(event) => setApproverRole(event.target.value)}
                  placeholder="e.g. HR_MANAGER"
                  disabled={approverType !== "ROLE"}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => void addStep()}
                disabled={!selectedWorkflow || createStep.isPending}
              >
                <Plus />
                {createStep.isPending ? "Addingâ€¦" : "Add step"}
              </Button>
            </div>
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
