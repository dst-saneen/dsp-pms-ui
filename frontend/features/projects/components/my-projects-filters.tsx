"use client";

import { useState } from "react";
import { ListFilter, Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

import { DEFAULT_MY_PROJECTS_FILTERS, type MyProjectsFilters as MyProjectsFiltersValue } from "../lib/my-projects-view-model";

interface MyProjectsFiltersProps {
  value: MyProjectsFiltersValue;
  projectOptions: Array<{ id: string; label: string }>;
  priorityOptions: string[];
  activeFilterCount: number;
  onChange: (next: MyProjectsFiltersValue) => void;
  onClear: () => void;
}

function filterLabel(value: string): string {
  return value.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" ");
}

function FilterControls({ value, projectOptions, priorityOptions, onChange }: Omit<MyProjectsFiltersProps, "activeFilterCount" | "onClear">) {
  const update = <Key extends keyof MyProjectsFiltersValue>(key: Key, nextValue: MyProjectsFiltersValue[Key]) => onChange({ ...value, [key]: nextValue });
  const inputClassName = "h-9 w-full rounded-lg border border-input bg-card px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 max-sm:h-11";
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">Project<select aria-label="Project" value={value.projectId} onChange={(event) => update("projectId", event.target.value)} className={inputClassName}><option value="ALL">All projects</option>{projectOptions.map((project) => <option key={project.id} value={project.id}>{project.label}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">Status<select aria-label="Status" value={value.status} onChange={(event) => update("status", event.target.value as MyProjectsFiltersValue["status"])} className={inputClassName}><option value="ALL">All statuses</option><option value="TO_DO">To do</option><option value="IN_PROGRESS">In progress</option><option value="WAITING_REVIEW">Awaiting review</option></select></label>
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">Priority<select aria-label="Priority" value={value.priority} onChange={(event) => update("priority", event.target.value)} className={inputClassName}><option value="ALL">All priorities</option>{priorityOptions.map((priority) => <option key={priority} value={priority}>{filterLabel(priority)}</option>)}</select></label>
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">Due date<select aria-label="Due date" value={value.due} onChange={(event) => update("due", event.target.value as MyProjectsFiltersValue["due"])} className={inputClassName}><option value="ALL">All due dates</option><option value="OVERDUE">Overdue</option><option value="TODAY">Today</option><option value="NEXT_7_DAYS">Next 7 days</option><option value="NO_DUE_DATE">No due date</option></select></label>
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">Sort<select aria-label="Sort" value={value.sort} onChange={(event) => update("sort", event.target.value as MyProjectsFiltersValue["sort"])} className={inputClassName}><option value="DUE_ASC">Due date</option><option value="DUE_DESC">Due date, latest</option><option value="PRIORITY_DESC">Priority, high to low</option><option value="PROJECT_ASC">Project, A to Z</option><option value="TASK_ASC">Task, A to Z</option></select></label>
  </div>;
}

export function MyProjectsFilters({ value, projectOptions, priorityOptions, activeFilterCount, onChange, onClear }: MyProjectsFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilters = [
    value.keyword.trim() && { label: `Search: ${value.keyword.trim()}`, clear: () => onChange({ ...value, keyword: "" }) },
    value.projectId !== "ALL" && { label: `Project: ${projectOptions.find((project) => project.id === value.projectId)?.label ?? value.projectId}`, clear: () => onChange({ ...value, projectId: "ALL" }) },
    value.status !== "ALL" && { label: `Status: ${filterLabel(value.status)}`, clear: () => onChange({ ...value, status: "ALL" }) },
    value.priority !== "ALL" && { label: `Priority: ${filterLabel(value.priority)}`, clear: () => onChange({ ...value, priority: "ALL" }) },
    value.due !== "ALL" && { label: `Due: ${filterLabel(value.due)}`, clear: () => onChange({ ...value, due: "ALL" }) },
    value.sort !== DEFAULT_MY_PROJECTS_FILTERS.sort && { label: `Sort: ${filterLabel(value.sort)}`, clear: () => onChange({ ...value, sort: DEFAULT_MY_PROJECTS_FILTERS.sort }) },
  ].filter(Boolean) as Array<{ label: string; clear: () => void }>;

  return <section aria-label="Task filters" className="rounded-xl border border-border bg-card p-3 sm:p-4">
    <div className="flex gap-2 md:hidden"><label className="sr-only" htmlFor="my-projects-search">Search tasks</label><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="my-projects-search" type="search" aria-label="Search tasks" placeholder="Search task, code, or project..." value={value.keyword} onChange={(event) => onChange({ ...value, keyword: event.target.value })} className="pl-9" /></div><Button type="button" variant="outline" onClick={() => setFiltersOpen(true)}><SlidersHorizontal aria-hidden="true" />Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}</Button></div>
    <div className="hidden items-end gap-3 md:flex"><div className="min-w-52 flex-1"><label className="grid gap-1 text-xs font-medium text-muted-foreground" htmlFor="my-projects-search-desktop">Search tasks<span className="relative"><Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><Input id="my-projects-search-desktop" type="search" aria-label="Search tasks" placeholder="Search task, code, or project..." value={value.keyword} onChange={(event) => onChange({ ...value, keyword: event.target.value })} className="pl-9" /></span></label></div><div className="min-w-0 flex-[2]"><FilterControls value={value} projectOptions={projectOptions} priorityOptions={priorityOptions} onChange={onChange} /></div><Button type="button" variant="outline" onClick={onClear}><X aria-hidden="true" />Clear filters</Button></div>
    {activeFilters.length > 0 ? <div className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">{activeFilters.map((filter) => <Button key={filter.label} type="button" size="xs" variant="secondary" onClick={filter.clear}>{filter.label}<X aria-hidden="true" /><span className="sr-only">Remove {filter.label}</span></Button>)}</div> : null}
    <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}><SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-full"><SheetHeader><SheetTitle>Filter tasks</SheetTitle><SheetDescription>Refine your assigned project tasks.</SheetDescription></SheetHeader><div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4"><FilterControls value={value} projectOptions={projectOptions} priorityOptions={priorityOptions} onChange={onChange} /><Button type="button" variant="outline" onClick={() => { onClear(); setFiltersOpen(false); }}><ListFilter aria-hidden="true" />Clear filters</Button></div></SheetContent></Sheet>
  </section>;
}

export { DEFAULT_MY_PROJECTS_FILTERS };
