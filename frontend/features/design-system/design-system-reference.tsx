"use client";

import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ArrowRight,
  ArrowUpDown,
  Building2,
  Check,
  CircleCheck,
  Clock3,
  FileText,
  LoaderCircle,
  Mail,
  Plus,
  Search,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { EntityDetailLayout } from "@/components/common/entity-detail-layout";
import { EntityPreviewSheet } from "@/components/common/entity-preview-sheet";
import { ErrorState } from "@/components/common/error-state";
import { FormSheet } from "@/components/common/form-sheet";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge, type StatusTone } from "@/components/common/status-badge";
import { DataTable } from "@/components/tables/data-table";
import { AppBrand } from "@/components/layout/app-brand";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmployeeEmployment } from "@/features/employee/editor/employee-employment";
import { EmployeeOverview } from "@/features/employee/editor/employee-overview";
import { EmployeeProfileHeader } from "@/features/employee/editor/employee-profile-header";
import { EmployeeSummaryRail } from "@/features/employee/editor/employee-summary-rail";
import { EmployeeTabs, type EmployeeTabItem } from "@/features/employee/editor/employee-tabs";
import type { Employee } from "@/features/employee/types/employee";

type DemoEmployee = {
  code: string;
  name: string;
  team: string;
  status: string;
};

const demoColumns: ColumnDef<DemoEmployee>[] = [
  {
    accessorKey: "code",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Code
        <ArrowUpDown />
      </Button>
    ),
  },
  {
    accessorKey: "name",
    header: ({ column }) => (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Employee
        <ArrowUpDown />
      </Button>
    ),
  },
  { accessorKey: "team", header: "Team" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge label={row.original.status} tone="success" />,
  },
];

const demoEmployees: DemoEmployee[] = [
  { code: "EMP-0042", name: "Amina Rahman", team: "Design", status: "Active" },
  { code: "EMP-0017", name: "Daniel Joseph", team: "BIM", status: "Active" },
  { code: "EMP-0031", name: "Sara Ali", team: "Finance", status: "Active" },
];

const demoEmployee: Employee = {
  id: "00000000-0000-0000-0000-000000000042",
  employeeCode: "EMP-0042",
  firstName: "Amina",
  lastName: "Rahman",
  email: "amina.rahman@example.com",
  mobile: "+971 50 123 4567",
  companyId: "00000000-0000-0000-0000-000000000001",
  branchId: "00000000-0000-0000-0000-000000000002",
  departmentId: "00000000-0000-0000-0000-000000000003",
  designationId: "00000000-0000-0000-0000-000000000004",
  managerId: "00000000-0000-0000-0000-000000000005",
  joiningDate: "15 January 2024",
  employeeType: "Full time",
  employmentStatus: "active",
  isActive: true,
  company: {
    id: "00000000-0000-0000-0000-000000000001",
    companyCode: "DS-GROUP",
    companyName: "DataScape Group",
  },
  branch: {
    id: "00000000-0000-0000-0000-000000000002",
    branchCode: "DXB-HQ",
    branchName: "Dubai Headquarters",
  },
  department: {
    id: "00000000-0000-0000-0000-000000000003",
    departmentCode: "DES",
    departmentName: "Design",
  },
  designation: {
    id: "00000000-0000-0000-0000-000000000004",
    designationCode: "SR-DSN",
    designationName: "Senior Product Designer",
  },
  manager: {
    id: "00000000-0000-0000-0000-000000000005",
    employeeCode: "EMP-0012",
    firstName: "Daniel",
    lastName: "Joseph",
  },
};

const tones: StatusTone[] = [
  "neutral",
  "accent",
  "progress",
  "information",
  "success",
  "warning",
  "danger",
];

const colours = [
  { name: "Canvas", value: "#FFFFFF", className: "bg-background" },
  { name: "Surface", value: "#FFFFFF", className: "bg-card" },
  { name: "Border", value: "#EAECF0", className: "bg-border" },
  { name: "Graphite", value: "#111827", className: "bg-foreground" },
  { name: "Coral", value: "#E76F51", className: "bg-brand" },
  { name: "Action coral", value: "#C84E32", className: "bg-primary" },
  { name: "Deep teal", value: "#2A9D8F", className: "bg-brand-secondary" },
  { name: "Golden amber", value: "#E9C46A", className: "bg-golden-accent" },
  { name: "Sky blue", value: "#4A90E2", className: "bg-information" },
  { name: "Selected", value: "#FFF1EC", className: "bg-primary-soft" },
];

function ReferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const sectionId = `section-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;

  return (
    <section className="space-y-4" aria-labelledby={sectionId}>
      <div>
        <h2 id={sectionId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {children}
    </section>
  );
}

export function DesignSystemReference() {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [formSheetOpen, setFormSheetOpen] = useState(false);
  const demoEmployeeTabs: EmployeeTabItem[] = [
    {
      value: "overview",
      label: "Overview",
      content: <EmployeeOverview employee={demoEmployee} />,
    },
    {
      value: "employment",
      label: "Employment",
      content: <EmployeeEmployment employee={demoEmployee} />,
    },
    {
      value: "documents",
      label: "Documents",
      content: (
        <EmptyState
          compact
          icon={FileText}
          title="No documents in this specimen"
          description="Live employee documents remain connected to the existing API."
        />
      ),
    },
    {
      value: "onboarding",
      label: "Onboarding",
      content: (
        <EmptyState
          compact
          icon={CircleCheck}
          title="Onboarding specimen"
          description="The production tab continues to use the existing onboarding workflow."
        />
      ),
    },
    {
      value: "leave",
      label: "Leave",
      content: (
        <EmptyState
          compact
          icon={Clock3}
          title="Leave specimen"
          description="The production tab continues to use the existing leave workflow."
        />
      ),
    },
  ];

  return (
    <div className="bg-background min-h-dvh">
      <header className="border-border bg-card/95 sticky top-0 z-20 border-b px-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex h-[60px] max-w-7xl items-center justify-between gap-4">
          <AppBrand />
          <Badge variant="outline" className="rounded-md">
            Development only
          </Badge>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-10 px-4 py-8 sm:px-6 lg:py-10">
        <div>
          <p className="text-primary mb-2 text-sm font-medium">Warm Coral + Teal Enterprise</p>
          <PageHeader
            title="ERP design-system reference"
            description="Shared tokens, components and interaction states for every Group ERP domain."
            actions={<Button>Primary page action</Button>}
          />
        </div>

        <ReferenceSection
          title="Typography and colour"
          description="Figtree is used for interface content; Geist Mono is reserved for codes and technical values."
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
            <Card>
              <CardContent className="space-y-4">
                <p className="text-3xl font-semibold tracking-tight">Page heading</p>
                <p className="text-lg font-semibold">Section heading</p>
                <p className="text-sm">Operational body content at 14px.</p>
                <p className="text-muted-foreground font-mono text-sm">EMP-0042 · REQ-2026-018</p>
              </CardContent>
            </Card>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {colours.map((colour) => (
                <Card key={colour.name} size="sm">
                  <CardContent className="space-y-3">
                    <div className={`border-border h-12 rounded-lg border ${colour.className}`} />
                    <div>
                      <p className="text-sm font-medium">{colour.name}</p>
                      <p className="text-muted-foreground font-mono text-xs">{colour.value}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </ReferenceSection>

        <ReferenceSection
          title="Controls"
          description="Desktop controls are 36px with 8px radii; touch targets expand on mobile."
        >
          <Card>
            <CardContent className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <Button>Primary action</Button>
                <Button variant="outline">Secondary</Button>
                <Button variant="secondary">Tertiary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="destructive">Destructive</Button>
                <Button disabled>Disabled</Button>
                <Button disabled>
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" />
                  Loading
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="reference-name">Name</Label>
                  <Input id="reference-name" placeholder="Enter a name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-invalid">Validation error</Label>
                  <Input id="reference-invalid" defaultValue="Invalid value" aria-invalid="true" />
                  <p className="text-destructive text-xs">Enter a valid value.</p>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="architecture">Architecture</SelectItem>
                      <SelectItem value="bim">BIM</SelectItem>
                      <SelectItem value="finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </ReferenceSection>

        <ReferenceSection
          title="Semantic status"
          description="Colour supports the label; it never replaces it."
        >
          <Card>
            <CardContent className="flex flex-wrap gap-3">
              {tones.map((tone) => (
                <StatusBadge key={tone} label={tone[0].toUpperCase() + tone.slice(1)} tone={tone} />
              ))}
            </CardContent>
          </Card>
        </ReferenceSection>

        <ReferenceSection
          title="Cards and KPI"
          description="Cards use 20px padding, subtle borders and only real trend data."
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              title="Active employees"
              value={248}
              icon={CircleCheck}
              helperText="Across all branches"
              tone="success"
              density="compact"
            />
            <KpiCard
              title="Open positions"
              value="18"
              icon={Building2}
              trend={{ value: "+2", direction: "up", label: "this month" }}
              density="compact"
            />
            <KpiCard
              title="Pending reviews"
              value="7"
              icon={Clock3}
              helperText="Needs attention"
              tone="warning"
              density="compact"
            />
            <Card>
              <CardHeader>
                <CardTitle>Standard card</CardTitle>
                <CardDescription>Supporting description</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-6">
                  Use cards to group related operational information.
                </p>
              </CardContent>
            </Card>
          </div>
        </ReferenceSection>

        <ReferenceSection
          title="Tables"
          description="Sorting, keyboard row access and balanced 44px density are shared behavior."
        >
          <DataTable
            columns={demoColumns}
            data={demoEmployees}
            toolbar={
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden="true"
                  />
                  <Input
                    aria-label="Search reference employees"
                    placeholder="Search employees..."
                    className="pl-9"
                  />
                </div>
                <p className="text-muted-foreground text-xs">3 employees</p>
              </div>
            }
            ariaLabel="Reference employee table"
            enablePagination
            pageSize={2}
            pageSizeOptions={[2, 10, 20]}
            onRowClick={() => setPreviewOpen(true)}
            getRowLabel={(row) => `Preview ${row.name}`}
          />
          <DataTable
            columns={demoColumns}
            data={[]}
            emptyIcon={Users}
            emptyTitle="No employees yet"
            emptyDescription="Add the first employee when the organization is ready."
            emptyActionLabel="Add first employee"
            emptyActionIcon={Plus}
            onEmptyAction={() => undefined}
            ariaLabel="Reference empty employee table"
          />
        </ReferenceSection>

        <ReferenceSection
          title="Loading, empty and error"
          description="Every asynchronous surface provides a clear, contained state."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Loading</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
            <EmptyState
              compact
              icon={Mail}
              title="Nothing here yet"
              description="New items will appear here when available."
            />
            <ErrorState
              compact
              title="Could not load data"
              description="Check the connection and try again."
              onRetry={() => undefined}
            />
          </div>
        </ReferenceSection>

        <ReferenceSection
          title="Tabs and overlays"
          description="Radix primitives provide keyboard behavior, focus containment and restoration."
        >
          <Card>
            <CardContent className="space-y-6">
              <Tabs defaultValue="overview">
                <TabsList variant="line">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="employment">Employment</TabsTrigger>
                  <TabsTrigger value="documents">Documents</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="pt-4">
                  Overview content remains close to its navigation.
                </TabsContent>
                <TabsContent value="employment" className="pt-4">
                  Employment content.
                </TabsContent>
                <TabsContent value="documents" className="pt-4">
                  Documents content.
                </TabsContent>
              </Tabs>

              <div className="flex flex-wrap gap-3">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline">Open dialog</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Confirm change</DialogTitle>
                      <DialogDescription>
                        Review the information before continuing.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline">Cancel</Button>
                      <Button>
                        <Check />
                        Confirm
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" onClick={() => setPreviewOpen(true)}>
                  Open preview sheet
                  <ArrowRight />
                </Button>

                <Button variant="outline" onClick={() => setFormSheetOpen(true)}>
                  Open form drawer
                  <ArrowRight />
                </Button>
              </div>
            </CardContent>
          </Card>
        </ReferenceSection>

        <ReferenceSection
          title="Employee detail specimen"
          description="Development-only fixture content proves the real header, summary rail and tab workspace without writing business data."
        >
          <EntityDetailLayout
            header={
              <EmployeeProfileHeader
                employee={demoEmployee}
                onEdit={() => undefined}
                onDeactivate={() => undefined}
              />
            }
            summary={<EmployeeSummaryRail employee={demoEmployee} />}
          >
            <EmployeeTabs tabs={demoEmployeeTabs} />
          </EntityDetailLayout>
        </ReferenceSection>
      </main>

      <FormSheet
        open={formSheetOpen}
        onOpenChange={setFormSheetOpen}
        title="Create employee group"
        description="Form drawers retain the current page context while users create or edit records."
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormSheetOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setFormSheetOpen(false)}>Create group</Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="specimen-group-name">Group name</Label>
            <Input id="specimen-group-name" placeholder="Enter group name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="specimen-group-code">Group code</Label>
            <Input id="specimen-group-code" placeholder="Enter group code" />
          </div>
        </div>
      </FormSheet>

      <EntityPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Employee preview"
        description="Quick inspection without leaving the current context."
        footer={
          <Button className="w-full">
            View full details
            <ArrowRight />
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="border-border bg-muted/35 rounded-xl border p-4">
            <p className="font-semibold">Amina Rahman</p>
            <p className="text-muted-foreground mt-1 font-mono text-xs">EMP-0042</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Department</p>
              <p className="mt-1 font-medium">Design</p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <div className="mt-1">
                <StatusBadge label="Active" tone="success" />
              </div>
            </div>
          </div>
        </div>
      </EntityPreviewSheet>
    </div>
  );
}
