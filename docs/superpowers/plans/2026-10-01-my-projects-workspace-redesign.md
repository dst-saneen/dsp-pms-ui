# My Projects Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/my-workspace/projects` to match the approved responsive task workspace, detail drawer, and review-submit flow while preserving the existing project lifecycle and self-service contracts.

**Architecture:** Keep the route and capability gate, but move the interactive header and workspace into the existing client component so Refresh can own query state. Derive summaries, filters, sorting, overdue state, and pagination from the current employee task result through a pure view-model module; render one desktop table and one mobile-card view from that same result. Fetch task details lazily from the employee-scoped endpoint and use a single right Sheet with `details` and `submit-review` modes.

**Tech Stack:** Next.js 16.3.3, React 19.2.8, TypeScript 6, Tailwind CSS 4, shadcn/Radix UI, TanStack Query 5, Vitest/Testing Library, Playwright, NestJS 11, Jest.

**Spec:** `docs/superpowers/specs/2026-10-01-my-projects-workspace-redesign.md`

## Global Constraints

- Run with Node `>=24.20.0 <25` and pnpm `11.24.0`.
- Treat the three images under `docs/superpowers/specs/assets/my-projects/` as the approved visual source of truth; reuse coded application tokens and components instead of hard-coding sampled colors.
- Preserve `/my-workspace/projects`, the coded application header/sidebar, `projectsNav`, `PROJECTS_ROUTES`, public task lifecycle behavior, database schema, migrations, and project rules.
- Do not add dependencies, status tabs, the internal Projects path banner, bulk selection, raw IDs, invented manager/reviewer data, or unsupported overflow actions.
- Use only API-backed `ProjectTask`/`ProjectTaskDetail` fields. Combine project name/code from the selected list item with the employee-scoped detail response.
- Gate every task action with `allowedActions`; never infer authorization from status.
- Use the branch business date for due-state calculations when available and a safe local date fallback only if workspace data is unavailable.
- Keep summary totals based on the complete task response. Apply search/filter/sort before client-side pagination.
- Keep the current 25 MB evidence limit and `.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg` formats.
- Desktop uses a table and an approximately `34rem` right drawer. Mobile uses cards, a full-width filter Sheet, and a full-screen task Sheet with no horizontal page overflow.
- Preserve unrelated current branch work; do not rewrite shared sidebar/header or other Projects pages.

## Review Focus

- **Missing employee link or genuine empty list:** render a successful empty workspace and zero summaries; do not convert it into an error or link to manager-only pages. Covered in Task 3 component tests.
- **Null/malformed dates, hours, progress, project names, or codes:** render quiet fallbacks, clamp numeric progress, sort null dates last, and never display `Invalid Date`/`NaN`. Covered in Task 2 view-model tests.
- **Stale task version or action set while the drawer is open:** use the fresh detail version, prevent double submission, refetch list/detail on mutation failure, and remove actions no longer returned by the API. Covered in Task 6 drawer tests.
- **Upload scan/download failure:** retain the open drawer and existing evidence list, surface the API error, and do not create duplicate attachment rows. Covered in Task 5 evidence tests.
- **Keyboard and narrow-screen use:** restore focus after Sheets, label controls, keep mobile targets at least 44px, and prevent document/page horizontal overflow. Covered in Tasks 5 and 7.

---

### Task 1: Align employee detail and evidence-download contracts

**Files:**
- Modify: `frontend/features/projects/services/projects-api.service.ts`
- Create: `frontend/features/projects/services/projects-api.service.test.ts`
- Modify: `frontend/features/projects/hooks/query-keys.ts`
- Modify: `frontend/features/projects/hooks/use-projects.ts`
- Modify: `backend/src/modules/projects/project-nested-tasks.controller.ts`
- Create: `backend/test/foundation/project-lite-task-evidence-permissions.spec.ts`

**Interfaces:**
- Consumes: existing `GET /me/project-tasks/:taskId`, `ProjectTaskDetail`, `projectsKeys`, `RequireAnyPermissions`, and service-level `assertTaskEvidenceActor` authorization.
- Produces:

```ts
ProjectsApiService.getMyTask(taskId: string): Promise<ProjectTaskDetail>
projectsKeys.myTask(taskId: string): readonly unknown[]
useMyProjectTask(taskId: string | null, enabled?: boolean)
```

- The existing task-document download route remains unchanged, but its controller metadata accepts either `projects.projects.read` or `projects.tasks.work`. `ProjectDocumentService.downloadTaskGrant` remains the mandatory entity-level assignee/project-manager check.

- [ ] **Step 1: Write the failing frontend service test**

Create a Vitest test that mocks `apiClient.get`, calls `ProjectsApiService.getMyTask("task-1")`, and asserts the request is exactly `GET /me/project-tasks/task-1` and the unwrapped `ProjectTaskDetail` is returned.

- [ ] **Step 2: Write the failing backend authorization test**

Read controller method metadata with `Reflect.getMetadata`. Assert `ProjectNestedTasksController.prototype.downloadGrant` uses `REQUIRED_ANY_PERMISSIONS_KEY` with `[PROJECTS_PERMISSIONS.READ, PROJECTS_PERMISSIONS.TASKS_WORK]`, does not require both permissions, and leaves the route path unchanged.

- [ ] **Step 3: Run the focused tests and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/services/projects-api.service.test.ts
```

Expected: FAIL because `getMyTask` is missing.

Run from `backend`:

```powershell
pnpm exec jest --config ./test/jest-foundation.json --runInBand test/foundation/project-lite-task-evidence-permissions.spec.ts
```

Expected: FAIL because download currently requires only `projects.projects.read`.

- [ ] **Step 4: Implement the employee detail service, key, and hook**

Add `getMyTask` using `/me/project-tasks/${taskId}`. Add `projectsKeys.myTask(taskId)`. Add a lazy `useMyProjectTask(taskId, enabled = true)` query whose `enabled` value is `enabled && Boolean(taskId)`.

- [ ] **Step 5: Align download permission without broadening entity access**

Replace the download method's single `RequirePermissions(READ)` decorator with `RequireAnyPermissions(READ, TASKS_WORK)`. Do not change `ProjectDocumentService`, the route, response, or download-grant behavior.

- [ ] **Step 6: Run Task 1 tests and static checks**

Run the two focused tests again; expected: PASS. Then run:

```powershell
# frontend
pnpm run typecheck

# backend
pnpm run typecheck
pnpm run typecheck:test
```

- [ ] **Step 7: Commit Task 1**

```powershell
git add frontend/features/projects/services/projects-api.service.ts frontend/features/projects/services/projects-api.service.test.ts frontend/features/projects/hooks/query-keys.ts frontend/features/projects/hooks/use-projects.ts backend/src/modules/projects/project-nested-tasks.controller.ts backend/test/foundation/project-lite-task-evidence-permissions.spec.ts
git commit -m "fix: align employee task evidence access"
```

### Task 2: Build the pure My Projects view model

**Files:**
- Create: `frontend/features/projects/lib/my-projects-view-model.ts`
- Create: `frontend/features/projects/lib/my-projects-view-model.test.ts`

**Interfaces:**
- Consumes: `ProjectTask`.
- Produces:

```ts
export type MyProjectsStatusFilter =
  | "ALL"
  | "TO_DO"
  | "IN_PROGRESS"
  | "WAITING_REVIEW";

export type MyProjectsDueFilter =
  | "ALL"
  | "OVERDUE"
  | "TODAY"
  | "NEXT_7_DAYS"
  | "NO_DUE_DATE";

export type MyProjectsSort =
  | "DUE_ASC"
  | "DUE_DESC"
  | "PRIORITY_DESC"
  | "PROJECT_ASC"
  | "TASK_ASC";

export interface MyProjectsFilters {
  keyword: string;
  projectId: string | "ALL";
  status: MyProjectsStatusFilter;
  priority: string | "ALL";
  due: MyProjectsDueFilter;
  sort: MyProjectsSort;
}

export interface MyProjectsSummary {
  assigned: number;
  projectCount: number;
  inProgress: number;
  awaitingReview: number;
  overdue: number;
}

export function deriveMyProjectsView(
  tasks: readonly ProjectTask[],
  filters: MyProjectsFilters,
  businessDate: string,
): {
  summary: MyProjectsSummary;
  filteredTasks: ProjectTask[];
  projectOptions: Array<{ id: string; label: string }>;
  priorityOptions: string[];
};

export function paginateMyProjectTasks(
  tasks: readonly ProjectTask[],
  page: number,
  pageSize: number,
): { items: ProjectTask[]; page: number; pageCount: number };

export function projectTaskStatusLabel(status: string): string;
export function normalizeTaskProgress(value: string | null | undefined): number;
export function isProjectTaskOverdue(task: ProjectTask, businessDate: string): boolean;
```

- [ ] **Step 1: Write failing summary/status tests**

Use a fixed business date `2026-09-24` and fixtures covering `ASSIGNED`, `IN_PROGRESS`, `WAITING_REVIEW`, multiple projects, and one past due date. Assert summary counts are independent of filters, `OPEN`/`ASSIGNED` label as `To do`, and no terminal status is invented.

- [ ] **Step 2: Write failing filter/sort/pagination tests**

Assert case-insensitive keyword matching across task/project names and codes; AND-combined project/status/priority/due filters; Today/Overdue/Next-7-days/No-date behavior; null due dates sort last in both due sorts; priority order is `URGENT`, `HIGH`, `MEDIUM`, `LOW`, then unknown values; page clamping; and page-size slicing.

- [ ] **Step 3: Write failing malformed-value tests**

Assert `normalizeTaskProgress` converts decimal strings, clamps below 0 and above 100, and returns 0 for null/non-numeric values. Assert missing names/codes and invalid date strings do not throw or match false date buckets.

- [ ] **Step 4: Run the view-model test and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/lib/my-projects-view-model.test.ts
```

Expected: FAIL because the module is missing.

- [ ] **Step 5: Implement the pure derivation functions**

Compare ISO date keys rather than parsing server timestamps into local-midnight dates. For Next 7 days, include the business date through business date + 7 calendar days. Build project and priority options from real task values; do not invent lookup data.

- [ ] **Step 6: Run Task 2 tests**

Run the focused test again; expected: PASS.

- [ ] **Step 7: Commit Task 2**

```powershell
git add frontend/features/projects/lib/my-projects-view-model.ts frontend/features/projects/lib/my-projects-view-model.test.ts
git commit -m "feat: derive employee project task views"
```

### Task 3: Implement the page header, connected summary, and filters

**Files:**
- Modify: `frontend/app/(dashboard)/my-workspace/projects/page.tsx`
- Modify: `frontend/features/projects/components/my-projects-workspace.tsx`
- Create: `frontend/features/projects/components/my-projects-summary.tsx`
- Create: `frontend/features/projects/components/my-projects-filters.tsx`
- Create: `frontend/features/projects/components/my-projects-workspace.test.tsx`

**Interfaces:**
- Consumes: Task 2 `deriveMyProjectsView`, existing `useMyProjectTasks`, `useMyWorkspace`, `PageHeader`, `WorkspaceShell`, `Sheet`, Select/Input/Button primitives, and `PROJECTS_ROUTES.myTimesheets`.
- Produces:

```ts
export function MyProjectsWorkspace(): React.JSX.Element;

export function MyProjectsSummary(props: {
  summary: MyProjectsSummary | null;
  loading: boolean;
}): React.JSX.Element;

export function MyProjectsFilters(props: {
  value: MyProjectsFilters;
  projectOptions: Array<{ id: string; label: string }>;
  priorityOptions: string[];
  activeFilterCount: number;
  onChange: (next: MyProjectsFilters) => void;
  onClear: () => void;
}): React.JSX.Element;
```

- [ ] **Step 1: Write the failing page-shell tests**

Render with a real `QueryClientProvider` and mocked hooks/services. Assert exact title/subtitle copy, `Refresh`, `My timesheets`, four summary labels, real counts, and absence of `ProjectsPathBanner` copy and status tabs.

- [ ] **Step 2: Write the failing filter interaction tests**

Assert search plus Project/Status/Priority/Due/Sort controls exist with accessible labels; changing controls produces removable chips; controls combine; removing a chip updates results; `Clear filters` is a button with reset/X icon and resets page/sort/filters; mobile Filters opens a Sheet rather than duplicating status tabs.

- [ ] **Step 3: Write the failing list-load state tests**

Assert initial skeletons use `role="status"`; list failure shows API copy and Retry without four false zero values; Retry calls `refetch`; a genuine empty response shows zero summaries and concise assigned-task empty copy.

- [ ] **Step 4: Run the workspace test and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/components/my-projects-workspace.test.tsx
```

Expected: FAIL against the legacy banner/table page.

- [ ] **Step 5: Move the interactive header into `MyProjectsWorkspace`**

Keep `PageContainer` and `ModuleCapabilityGate capability="projectsNav"` in the route. Remove the route-level static header and render `PageHeader` inside the client workspace with the approved subtitle and actions. `Refresh` refetches tasks without resetting filters; show `aria-busy`/spinning feedback during background refresh.

- [ ] **Step 6: Implement the connected summary**

Use one bordered panel with four semantic sections and shared token classes. Render four desktop columns and a 2×2 mobile grid. Do not substitute four independent `KpiCard` cards because the approved treatment is connected.

- [ ] **Step 7: Implement desktop and mobile filters**

Use one controlled filter value. Desktop renders the compact toolbar; mobile renders search plus a 44px `Filters` trigger and full-width Sheet. Use the same controls and state in both representations. Reset pagination to page 1 after any filter/sort change.

- [ ] **Step 8: Run Task 3 tests and checks**

Run the focused workspace and view-model tests; expected: PASS. Then run targeted ESLint on the changed files.

- [ ] **Step 9: Commit Task 3**

```powershell
git add "frontend/app/(dashboard)/my-workspace/projects/page.tsx" frontend/features/projects/components/my-projects-workspace.tsx frontend/features/projects/components/my-projects-summary.tsx frontend/features/projects/components/my-projects-filters.tsx frontend/features/projects/components/my-projects-workspace.test.tsx
git commit -m "feat: add My Projects summary and filters"
```

### Task 4: Implement the desktop table, mobile cards, and pagination

**Files:**
- Create: `frontend/features/projects/components/my-projects-task-list.tsx`
- Create: `frontend/features/projects/components/my-projects-task-list.test.tsx`
- Modify: `frontend/features/projects/components/my-projects-workspace.tsx`

**Interfaces:**
- Consumes: Task 2 status/progress/overdue helpers, `ProjectTask`, `hasAllowedAction`, and `PROJECTS_ROUTES.myTimesheets`.
- Produces:

```ts
export type MyProjectTaskOpenMode = "details" | "submit-review";

export function MyProjectsTaskList(props: {
  tasks: readonly ProjectTask[];
  filteredTotal: number;
  page: number;
  pageCount: number;
  pageSize: number;
  businessDate: string;
  startingTaskId: string | null;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onOpenTask: (task: ProjectTask, mode: MyProjectTaskOpenMode) => void;
  onStartTask: (task: ProjectTask) => void;
}): React.JSX.Element;
```

- [ ] **Step 1: Write failing desktop table tests**

Assert columns Task, Project, Priority, Status, Progress, Due date, Actions; friendly status/priority labels; progress percentage; project/task codes; overdue rose copy/indicator; and quiet fallbacks for null values.

- [ ] **Step 2: Write failing action tests**

For fixtures with different `allowedActions`, assert Start, Submit for review, and Log time appear only when supplied. Assert Log time points to `/my-workspace/timesheets?taskId=...`; View and row selection call `onOpenTask(task, "details")`; Submit calls `onOpenTask(task, "submit-review")`; no unsupported three-dot or bulk controls render.

- [ ] **Step 3: Write failing mobile/pagination tests**

Assert mobile cards contain the same task facts and actions, desktop/mobile views are breakpoint-separated rather than horizontally scrolling, 10 rows are shown by default, range copy is correct, page buttons work, page sizes 10/25/50 work, and filter-driven page clamping is honored.

- [ ] **Step 4: Run the task-list test and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/components/my-projects-task-list.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 5: Implement both result presentations from one data array**

Use `hidden md:block` for the table and `md:hidden` for cards. Use semantic badges and shared theme tokens. Keep progress blue/cyan at every percentage. Wire pagination below both presentations and preserve selected/overdue emphasis without relying on color alone.

- [ ] **Step 6: Integrate task-list state into the workspace**

Apply Task 2 pagination after filtering/sorting. Track the selected task and requested drawer mode. Keep Start as a direct action and disable only the task being started.

- [ ] **Step 7: Run Task 4 tests**

Run task-list, workspace, and view-model tests; expected: PASS.

- [ ] **Step 8: Commit Task 4**

```powershell
git add frontend/features/projects/components/my-projects-task-list.tsx frontend/features/projects/components/my-projects-task-list.test.tsx frontend/features/projects/components/my-projects-workspace.tsx
git commit -m "feat: add responsive assigned task results"
```

### Task 5: Implement the employee task-details Sheet and evidence history

**Files:**
- Create: `frontend/features/projects/components/project-task-evidence-upload.tsx`
- Modify: `frontend/features/projects/components/project-task-detail-dialog.tsx`
- Create: `frontend/features/projects/components/my-project-task-sheet.tsx`
- Create: `frontend/features/projects/components/my-project-task-sheet.test.tsx`
- Modify: `frontend/features/projects/components/my-projects-workspace.tsx`

**Interfaces:**
- Consumes: Task 1 `useMyProjectTask`, selected list `ProjectTask`, existing upload/download services, `SecureFileUploadField`, `Sheet` primitives, and Task 4 `MyProjectTaskOpenMode`.
- Produces:

```ts
export function ProjectTaskEvidenceUpload(props: {
  projectId: string;
  taskId: string;
  onChanged: () => void;
}): React.JSX.Element;

export function MyProjectTaskSheet(props: {
  task: ProjectTask | null;
  open: boolean;
  entryMode: MyProjectTaskOpenMode;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}): React.JSX.Element;
```

- [ ] **Step 1: Write failing lazy-load and authorization tests**

Assert no detail request occurs while closed; opening requests `/me/project-tasks/:taskId`; loading uses an accessible skeleton; error stays inside the Sheet with Retry; detail actions use the fresh detail `allowedActions`/`expectedVersion`, not stale list assumptions.

- [ ] **Step 2: Write failing content/history tests**

Assert the Sheet renders the selected list project's name/code plus API-backed task overview. Merge `detail.documents` and every submission's documents by document ID. Render submission versions, dates, status/decision/comments/notes; never render `reviewerId`, `submittedById`, assignment employee IDs, stage, manager, team, or budget.

- [ ] **Step 3: Write failing evidence tests**

Assert upload appears only with `ATTACH_DOCUMENT`; accepted extensions and 25 MB limit are exact; a successful link refetches detail/list once; download obtains the short-lived grant and opens with `noopener,noreferrer`; errors retain the Sheet and evidence list; document rows expose Download only and no overflow menu.

- [ ] **Step 4: Write failing responsive/focus tests**

Assert the Sheet uses `data-[side=right]:w-full data-[side=right]:sm:max-w-[34rem]`, has a sticky footer, closes with Escape/X, and restores focus to the invoking View/Submit control.

- [ ] **Step 5: Run the Sheet test and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/components/my-project-task-sheet.test.tsx
```

Expected: FAIL because the employee Sheet is missing.

- [ ] **Step 6: Extract the existing evidence uploader**

Move the private upload implementation from `project-task-detail-dialog.tsx` into `ProjectTaskEvidenceUpload`; keep the existing manager dialog behavior and copy unchanged. Reuse it from the employee Sheet rather than duplicating upload-session logic.

- [ ] **Step 7: Implement the approved details drawer**

Use one Radix Sheet with zero nested dialogs. Render the approved header, overview grid, optional description, unique evidence, history timeline, and allowed footer actions. Hide empty optional sections and use concise empty copy for evidence/history. Use actual dates and values with safe fallbacks.

- [ ] **Step 8: Integrate the Sheet with workspace selection**

Opening View starts in `details`; opening Submit starts in `submit-review` after detail loads. Close/reset selection without changing the route. Refresh an open Sheet when the page Refresh action runs.

- [ ] **Step 9: Run Task 5 tests**

Run Sheet, task-list, workspace, and existing `project-detail-workspace`/project component tests; expected: PASS.

- [ ] **Step 10: Commit Task 5**

```powershell
git add frontend/features/projects/components/project-task-evidence-upload.tsx frontend/features/projects/components/project-task-detail-dialog.tsx frontend/features/projects/components/my-project-task-sheet.tsx frontend/features/projects/components/my-project-task-sheet.test.tsx frontend/features/projects/components/my-projects-workspace.tsx
git commit -m "feat: add employee project task drawer"
```

### Task 6: Implement Start and in-drawer review submission

**Files:**
- Modify: `frontend/features/projects/components/my-projects-workspace.tsx`
- Modify: `frontend/features/projects/components/my-project-task-sheet.tsx`
- Modify: `frontend/features/projects/components/my-project-task-sheet.test.tsx`
- Modify: `frontend/features/projects/components/my-projects-workspace.test.tsx`

**Interfaces:**
- Consumes: existing `ProjectsApiService.taskCommand`, `createOperationId`, `projectsKeys.myTasks()`, Task 1 `projectsKeys.myTask(taskId)`, and detail `actionRequirements.expectedVersion`.
- Produces no new route or backend contract. Submit body remains `VersionedCommand` with optional `reason`.

- [ ] **Step 1: Write failing Start tests**

Assert Start is direct, posts action `start` with the row's current `expectedVersion` and a fresh UUID operation ID, disables only that task while pending, invalidates list/detail, shows `Task started.`, and refetches after an API conflict.

- [ ] **Step 2: Write failing review-state tests**

Assert clicking Submit replaces the Sheet body with `Review & submit`, shows a Back control, compact task/evidence summary, one optional reviewer-note textarea with `maxLength={2000}`, exact information copy, and one Sheet/dialog role total. Back restores details without losing the fetched task.

- [ ] **Step 3: Write failing submission tests**

Assert the submit command is `submit-review`, uses the fresh detail version, passes trimmed note as `reason` or `undefined` when blank, generates a fresh operation ID, disables duplicate clicks, and never presents Draft/submission-mode/reviewer selection/evidence-required UI.

- [ ] **Step 4: Write failing success/error/stale tests**

Assert success invalidates list and selected-detail keys, resets note/mode, closes the Sheet, and shows `Task submitted for review.` Assert failure retains the note and open context, displays the API error toast, refetches both queries, and returns to details if refreshed `allowedActions` no longer contains `SUBMIT_REVIEW`.

- [ ] **Step 5: Run focused tests and confirm RED**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/components/my-project-task-sheet.test.tsx features/projects/components/my-projects-workspace.test.tsx
```

Expected: FAIL because the new action behavior is incomplete.

- [ ] **Step 6: Implement mutation state and confirmation mode**

Keep Start orchestration in the workspace. Keep submit-review state/mutation inside the task Sheet so note, Back, and fresh detail version share one boundary. Invalidate/refetch only project task keys; do not clear filters or navigate.

- [ ] **Step 7: Run Task 6 tests**

Run the focused component tests; expected: PASS.

- [ ] **Step 8: Commit Task 6**

```powershell
git add frontend/features/projects/components/my-projects-workspace.tsx frontend/features/projects/components/my-project-task-sheet.tsx frontend/features/projects/components/my-project-task-sheet.test.tsx frontend/features/projects/components/my-projects-workspace.test.tsx
git commit -m "feat: complete employee project task actions"
```

### Task 7: Add responsive end-to-end coverage and run release gates

**Files:**
- Create: `frontend/e2e/my-projects-responsive.spec.ts`
- Modify if fixture sharing is necessary: `frontend/e2e/my-workspace-responsive.spec.ts`
- Modify only for discovered defects: files from Tasks 1–6

**Interfaces:**
- Consumes: final `/my-workspace/projects` UI and mocked auth, capability, workspace, task-list, task-detail, command, upload, and download endpoints.
- Produces a route-specific Playwright contract for Chromium desktop, 1024×768 tablet, and Pixel 7 mobile projects.

- [ ] **Step 1: Write the failing responsive Playwright scenarios**

Use complete `ProjectTask`/`ProjectTaskDetail` fixtures. Assert:

- exact header actions and connected summary;
- no Projects path banner and no status tabs;
- desktop table versus mobile cards;
- mobile summary is 2×2;
- search/filter chips/Clear filters and no-results recovery;
- 10-row pagination;
- View opens a 34rem desktop/full-screen mobile Sheet;
- task detail, evidence, and history contain only supported fields;
- Submit switches the same Sheet to review mode and Back returns;
- Log time has the selected `taskId`;
- no body/document horizontal overflow at every configured viewport.

- [ ] **Step 2: Run Playwright and confirm RED before final fixes**

Run from `frontend`:

```powershell
pnpm exec playwright test e2e/my-projects-responsive.spec.ts
```

Expected: any remaining responsive/accessibility mismatch fails with a targeted assertion.

- [ ] **Step 3: Fix only defects demonstrated by the tests**

Keep fixes within the approved design. Do not change unrelated shared shell/navigation behavior.

- [ ] **Step 4: Run focused frontend verification**

Run from `frontend`:

```powershell
pnpm exec vitest run features/projects/lib/my-projects-view-model.test.ts features/projects/services/projects-api.service.test.ts features/projects/components/my-projects-workspace.test.tsx features/projects/components/my-projects-task-list.test.tsx features/projects/components/my-project-task-sheet.test.tsx
pnpm exec vitest run features/projects
pnpm run typecheck
pnpm exec eslint "app/(dashboard)/my-workspace/projects/page.tsx" features/projects/components/my-projects-workspace.tsx features/projects/components/my-projects-summary.tsx features/projects/components/my-projects-filters.tsx features/projects/components/my-projects-task-list.tsx features/projects/components/my-project-task-sheet.tsx features/projects/components/project-task-evidence-upload.tsx features/projects/lib/my-projects-view-model.ts features/projects/services/projects-api.service.ts features/projects/hooks/use-projects.ts features/projects/hooks/query-keys.ts e2e/my-projects-responsive.spec.ts
pnpm run build
pnpm exec playwright test e2e/my-projects-responsive.spec.ts
```

Expected: all commands PASS.

- [ ] **Step 5: Run focused backend verification**

Run from `backend`:

```powershell
pnpm exec jest --config ./test/jest-foundation.json --runInBand test/foundation/project-lite-task-evidence-permissions.spec.ts test/foundation/project-lite-phase4-api.spec.ts test/foundation/project-lite-phase6-files-summaries.spec.ts
pnpm run typecheck
pnpm run typecheck:test
pnpm run lint:check
pnpm run build
```

Expected: all commands PASS.

- [ ] **Step 6: Run repository hygiene checks**

Run from the repository root:

```powershell
git diff --check
rg -n "Projects path|status tab|reviewerId|submittedById" frontend/features/projects/components/my-projects-*.tsx
git status --short
```

Expected: no conflict markers/trailing whitespace; no prohibited user-facing copy/raw IDs; status contains only the intended implementation, plan, spec, and approved visual assets.

- [ ] **Step 7: Update Graphify only if the graph exists at execution time**

```powershell
if (Test-Path graphify-out/graph.json) { graphify update . }
```

- [ ] **Step 8: Commit the completed redesign**

```powershell
git add backend/src/modules/projects/project-nested-tasks.controller.ts backend/test/foundation/project-lite-task-evidence-permissions.spec.ts "frontend/app/(dashboard)/my-workspace/projects/page.tsx" frontend/features/projects/services/projects-api.service.ts frontend/features/projects/services/projects-api.service.test.ts frontend/features/projects/hooks/query-keys.ts frontend/features/projects/hooks/use-projects.ts frontend/features/projects/lib/my-projects-view-model.ts frontend/features/projects/lib/my-projects-view-model.test.ts frontend/features/projects/components/my-projects-workspace.tsx frontend/features/projects/components/my-projects-workspace.test.tsx frontend/features/projects/components/my-projects-summary.tsx frontend/features/projects/components/my-projects-filters.tsx frontend/features/projects/components/my-projects-task-list.tsx frontend/features/projects/components/my-projects-task-list.test.tsx frontend/features/projects/components/project-task-evidence-upload.tsx frontend/features/projects/components/project-task-detail-dialog.tsx frontend/features/projects/components/my-project-task-sheet.tsx frontend/features/projects/components/my-project-task-sheet.test.tsx frontend/e2e/my-projects-responsive.spec.ts docs/superpowers/specs/2026-10-01-my-projects-workspace-redesign.md docs/superpowers/specs/assets/my-projects/01-workspace-desktop-mobile.png docs/superpowers/specs/assets/my-projects/02-task-details-drawer.png docs/superpowers/specs/assets/my-projects/03-review-submit-drawer.png docs/superpowers/plans/2026-10-01-my-projects-workspace-redesign.md
git commit -m "feat: redesign My Projects workspace"
```

## Final manual review

- Compare desktop and mobile output side-by-side with all three approved images.
- Confirm shared typography, button variants, borders, radii, semantic badges, spacing, and empty/error patterns match the current My Leave and Approvals workspaces.
- Confirm the coded sidebar and application header did not change.
- Confirm every displayed value is available from `ProjectTask`, `ProjectTaskDetail`, or the branch workspace response.
- Confirm standard employees can view only their assignments, attach permitted evidence, download only task evidence they are authorized to access, and submit only when `SUBMIT_REVIEW` is returned.
