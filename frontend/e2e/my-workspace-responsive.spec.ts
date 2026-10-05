import { expect, test, type Page } from "@playwright/test";

const authUser = {
  id: "user-1",
  username: "rohan.kumar",
  displayName: "Rohan Kumar",
  email: "rohan@example.test",
  employeeId: "employee-1",
  mustChangePassword: false,
  sessionId: "session-1",
  authorization: {
    roles: ["EMPLOYEE"],
    permissions: [
      "hr.self.read",
      "hr.self.manage",
      "hr.documents.read",
      "projects.tasks.work",
      "projects.timesheets.submit",
    ],
    scopeLevel: "BRANCH",
    isGlobal: false,
    activeCompanyGroupId: "group-1",
    activeCompanyId: "company-1",
    activeBranchId: "branch-1",
    availableScopes: [],
  },
};

const workspace = {
  identity: {
    userId: "user-1",
    employeeId: "employee-1",
    employeeCode: "EMP-1042",
    fullName: "Rohan Kumar",
    email: "rohan@example.test",
    employmentStatus: "ACTIVE",
    company: { id: "company-1", companyName: "Dscape Technologies" },
    branch: { id: "branch-1", branchName: "Main Office", timezone: "Asia/Kolkata" },
    department: { id: "department-1", departmentName: "Engineering" },
    designation: { id: "designation-1", designationName: "Team Lead" },
    timezone: "Asia/Kolkata",
  },
  businessDate: "2026-09-24",
  timezone: "Asia/Kolkata",
  todayAttendance: null,
  todayShift: {
    workDate: "2026-09-24",
    dayType: "WORKING",
    shiftName: "General Shift",
    scheduledStartAt: "2026-09-24T03:30:00.000Z",
    scheduledEndAt: "2026-09-24T12:30:00.000Z",
  },
  punchReadiness: {
    businessDate: "2026-09-24",
    canCheckIn: true,
    canCheckOut: false,
    checkInBlockedReason: null,
    checkOutBlockedReason: "Check in first",
    setupHref: null,
  },
  todayWorkPlan: {
    itemCount: 3,
    items: [
      {
        id: "work-1",
        title: "Daily engineering stand-up",
        status: "UPCOMING",
        plannedStartTime: "2026-09-24T03:30:00.000Z",
        plannedEndTime: "2026-09-24T04:30:00.000Z",
      },
      {
        id: "work-2",
        title: "Product review",
        status: "UPCOMING",
        plannedStartTime: "2026-09-24T05:00:00.000Z",
        plannedEndTime: "2026-09-24T06:00:00.000Z",
      },
      {
        id: "work-3",
        title: "Prepare onboarding documents",
        status: "DUE_TODAY",
        plannedStartTime: null,
        plannedEndTime: null,
      },
    ],
  },
  leave: {
    summary: { totalEntitlement: 20, totalUsed: 8, totalPending: 0, totalBalance: 12 },
    balances: [
      {
        leaveTypeId: "annual-leave",
        leaveCode: "AL",
        leaveName: "Annual Leave",
        entitlement: 20,
        used: 8,
        pending: 0,
        balance: 12,
      },
    ],
    upcoming: [],
  },
  onboarding: {
    status: "IN_PROGRESS",
    progressPercent: 50,
    tasks: [
      {
        id: "onboarding-1",
        taskName: "Upload identification",
        status: "NOT_STARTED",
        dueDate: "2026-09-25",
        completedAt: null,
      },
      {
        id: "onboarding-2",
        taskName: "Confirm profile",
        status: "IN_PROGRESS",
        dueDate: "2026-09-25",
        completedAt: null,
      },
    ],
  },
  documents: {
    summary: { total: 3, verified: 2, pending: 1, expired: 0 },
    expiringSoon: 0,
    expired: 0,
  },
};

const projectTasks = {
  items: [
    {
      id: "task-1",
      version: 1,
      projectId: "project-1",
      stageId: "stage-1",
      projectName: "ERP v2.0",
      projectCode: "ERP",
      taskCode: "TSK-2026-001",
      taskName: "Daily engineering stand-up",
      description: "Complete payroll rule validation.",
      parentTaskId: null,
      priority: "HIGH",
      plannedHours: "16",
      completionPercentage: "65",
      status: "IN_PROGRESS",
      startDate: "2026-09-20",
      dueDate: "2026-09-25",
      activeParticipantEmployeeIds: ["employee-1"],
      allowedActions: ["LOG_TIME", "SUBMIT_REVIEW"],
      actionRequirements: { expectedVersion: 1 },
    },
    {
      id: "task-2",
      version: 1,
      projectId: "project-1",
      stageId: "stage-1",
      projectName: "ERP v2.0",
      projectCode: "ERP",
      taskCode: "TSK-2026-002",
      taskName: "Product review",
      description: null,
      parentTaskId: null,
      priority: "MEDIUM",
      plannedHours: "4",
      completionPercentage: "0",
      status: "ASSIGNED",
      startDate: null,
      dueDate: "2026-09-26",
      activeParticipantEmployeeIds: ["employee-1"],
      allowedActions: ["START"],
      actionRequirements: { expectedVersion: 1 },
    },
    {
      id: "task-3",
      version: 1,
      projectId: "project-2",
      stageId: "stage-2",
      projectName: "Platform Team",
      projectCode: "PLATFORM",
      taskCode: "TSK-2026-003",
      taskName: "Review pull requests",
      description: null,
      parentTaskId: null,
      priority: "LOW",
      plannedHours: "8",
      completionPercentage: "20",
      status: "IN_PROGRESS",
      startDate: "2026-09-22",
      dueDate: "2026-09-28",
      activeParticipantEmployeeIds: ["employee-1"],
      allowedActions: ["LOG_TIME"],
      actionRequirements: { expectedVersion: 1 },
    },
  ],
  total: 3,
  page: 1,
  limit: 100,
};

async function mockMyWorkspaceApis(page: Page) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    let data: unknown;

    switch (path) {
      case "/api/me/project-tasks/task-1":
        data = {
          ...projectTasks.items[0],
          documents: [
            {
              id: "task-document-1",
              taskSubmissionId: null,
              documentPurpose: "SUPPORTING_EVIDENCE",
              title: "Payroll validation evidence",
              uploadedAt: "2026-09-24T08:00:00.000Z",
            },
          ],
          assignmentHistory: [],
          submissions: [],
        };
        break;
      case "/api/auth/refresh":
        data = { accessToken: "responsive-qa-token", expiresIn: 3600, user: authUser };
        break;
      case "/api/me/module-capabilities":
        data = {
          projects: true,
          finance: false,
          payroll: true,
          projectsNav: true,
          onboardingNav: true,
          assetSelfNav: true,
          assetsNav: true,
          payrollNav: true,
        };
        break;
      case "/api/me/workspace":
        data = workspace;
        break;
      case "/api/me/workforce-calendar":
        data = {
          fromDate: "2026-09-01",
          toDate: "2026-09-30",
          accessMode: "SELF",
          days: [
            {
              date: "2026-09-09",
              employees: [
                {
                  employeeId: "employee-1",
                  state: "ON_LEAVE",
                  dayType: "WORKING",
                  portion: "FULL_DAY",
                  leaveStatus: "APPROVED",
                  leaveTypeName: "Annual Leave",
                  leaveTypeId: "annual-leave",
                  approvalStage: "APPROVED",
                },
              ],
            },
            {
              date: "2026-09-19",
              employees: [
                {
                  employeeId: "employee-1",
                  state: "HOLIDAY",
                  dayType: "HOLIDAY",
                  holidayName: "Founders Day",
                },
              ],
            },
            {
              date: "2026-09-23",
              employees: [
                {
                  employeeId: "employee-1",
                  state: "PENDING_LEAVE",
                  dayType: "WORKING",
                  leaveStatus: "SUBMITTED",
                  leaveTypeName: "Sick Leave",
                  leaveTypeId: "sick-leave",
                  approvalStage: "MANAGER_REVIEW",
                },
              ],
            },
            {
              date: "2026-09-24",
              employees: [
                {
                  employeeId: "employee-1",
                  state: "SCHEDULED",
                  dayType: "WORKING",
                  shiftName: "General Shift",
                },
              ],
            },
          ].filter((day) => {
            const fromDate = url.searchParams.get("fromDate");
            const toDate = url.searchParams.get("toDate");
            return (!fromDate || day.date >= fromDate) && (!toDate || day.date <= toDate);
          }),
        };
        break;
      case "/api/me/leave":
        data = {
          summary: { totalEntitlement: 20, totalUsed: 8, totalPending: 1, totalBalance: 12 },
          balances: workspace.leave.balances,
          history: [
            {
              id: "leave-1",
              leaveType: "Annual Leave",
              fromDate: "2026-10-01",
              toDate: "2026-10-02",
              requestedDays: 2,
              status: "SUBMITTED",
              createdAt: "2026-09-01T00:00:00.000Z",
            },
          ],
          upcoming: [
            {
              id: "leave-1",
              leaveType: "Annual Leave",
              fromDate: "2026-10-01",
              toDate: "2026-10-02",
              approvedDays: 2,
              status: "APPROVED",
            },
          ],
        };
        break;
      case "/api/me/leave-types":
        data = [
          {
            id: "annual-leave",
            leaveCode: "ANL",
            leaveName: "Annual Leave",
            category: "STANDARD",
            allowHalfDay: true,
            isActive: true,
          },
        ];
        break;
      case "/api/me/leave-previews":
        data = {
          requestedWorkingDays: 1,
          fromCalendarDate: "2026-09-25",
          toCalendarDate: "2026-09-25",
          timezone: "Asia/Kolkata",
          excludedHolidays: [],
          excludedNonWorkingDays: [],
          isHalfDay: false,
          balance: {
            year: 2026,
            leaveTypeId: "annual-leave",
            leaveName: "Annual Leave",
            entitlement: 20,
            used: 8,
            pending: 1,
            available: 12,
            afterSubmit: { available: 11, pending: 2, used: 8 },
          },
          canSubmit: true,
          blockReason: null,
          setupLinks: {
            myCalendar: "/my-workspace/calendar",
            leaveBalancesTab: "/my-workspace/leave",
          },
        };
        break;
      case "/api/me/attendance/exceptions":
        data = [
          {
            id: "exception-1",
            type: "MISSING_CHECK_OUT",
            status: "OPEN",
            businessDate: "2026-09-23",
            attendanceId: "attendance-1",
          },
        ];
        break;
      case "/api/me/overtime":
        data = [
          {
            id: "overtime-1",
            businessDate: "2026-09-23",
            eligibleMinutes: 90,
            status: "CALCULATED",
          },
        ];
        break;
      case "/api/me/assets":
        data = {
          summary: {
            physicalAssigned: 1,
            activeLicenses: 1,
            acknowledgementPending: 1,
            openRequests: 0,
          },
          physicalAssignments: [],
          licenseAllocations: [],
        };
        break;
      case "/api/me/project-tasks":
        data = projectTasks;
        break;
      case "/api/me/timesheets":
        data = {
          items: [
            {
              id: "timesheet-1",
              status: "DRAFT",
              periodStart: "2026-09-21",
              periodEnd: "2026-09-27",
              lines: [],
            },
          ],
          total: 1,
          page: 1,
          limit: 100,
        };
        break;
      case "/api/me/payslips":
        data = [
          {
            id: "payslip-1",
            payrollYear: 2026,
            payrollMonth: 8,
            status: "AVAILABLE",
          },
        ];
        break;
      case "/api/me/optional-holidays":
        data = {
          year: 2026,
          timezone: "Asia/Kolkata",
          maximumHolidayDays: 3,
          mandatoryWorkingDayCount: 1,
          optionalAllowance: 2,
          selectedCount: 1,
          remainingCount: 1,
          holidays: [
            {
              eventId: "holiday-1",
              date: "2026-10-02",
              name: "Optional observance",
              calendarScope: "BRANCH",
              selected: false,
              selectionStatus: "NONE",
              locked: false,
              editableUntil: "2026-09-30T18:29:59.999Z",
            },
          ],
        };
        break;
      case "/api/me/onboarding/workspace-capabilities":
        data = { sections: ["MY_TASKS", "DEPARTMENT_QUEUE"] };
        break;
      case "/api/me/onboarding":
        data = {
          ownOnboarding: {
            id: "employee-onboarding-1",
            contractVersion: "V2",
            version: 3,
            status: "IN_PROGRESS",
            employee: {
              id: "employee-1",
              employeeCode: "EMP-1042",
              displayName: "Rohan Kumar",
            },
            organizationSnapshot: {
              company: { id: "company-1", code: "GROUP", name: "Group ERP" },
              branch: {
                id: "branch-1",
                code: "HQ",
                name: "Main Office",
                timeZone: "Asia/Kolkata",
              },
              department: { id: "department-1", code: "ENG", name: "Engineering" },
              designation: { id: "designation-1", code: "TL", name: "Team Lead" },
            },
            templateSnapshot: {
              templateId: "template-1",
              templateCode: "EMP-ONBOARDING",
              templateName: "Employee onboarding program",
              templateVersionId: "template-version-1",
              versionNo: 1,
              resolutionSource: "DESIGNATION_DEFAULT",
            },
            startDate: "2026-09-12",
            startedBy: { userId: "hr-user", displayName: "HR Admin" },
            completedAt: null,
            cancelledAt: null,
            progress: {
              total: 12,
              completed: 8,
              skipped: 0,
              waived: 0,
              terminal: 8,
              mandatoryRemaining: 3,
              unfinishedOptional: 1,
              unassignedMandatory: 0,
              overdue: 1,
              canComplete: false,
              percent: 68,
            },
            departmentProgress: [
              {
                workstreamDepartment: { id: "hr", name: "HR" },
                total: 4,
                terminal: 3,
                mandatoryRemaining: 1,
                unassigned: 0,
                dueSoon: 0,
                overdue: 0,
                percent: 75,
              },
              {
                workstreamDepartment: { id: "it", name: "IT" },
                total: 2,
                terminal: 1,
                mandatoryRemaining: 1,
                unassigned: 0,
                dueSoon: 1,
                overdue: 0,
                percent: 50,
              },
              {
                workstreamDepartment: { id: "manager", name: "Manager" },
                total: 3,
                terminal: 3,
                mandatoryRemaining: 0,
                unassigned: 0,
                dueSoon: 0,
                overdue: 0,
                percent: 100,
              },
            ],
            blockedReasons: [],
            allowedActions: [],
            actionCapabilities: [],
          },
        };
        break;
      case "/api/me/onboarding-tasks":
        data = {
          items: [
            {
              id: "employee-task-1",
              onboardingId: "employee-onboarding-1",
              contractVersion: "V2",
              version: 1,
              attemptNo: 1,
              status: "PENDING",
              ownerType: "EMPLOYEE",
              taskName: "Submit identity documents",
              description: "Upload the required identity documents.",
              sequenceNo: 1,
              priority: 1,
              isMandatory: true,
              allowSkip: false,
              allowReopen: false,
              employee: {
                id: "employee-1",
                employeeCode: "EMP-1042",
                displayName: "Rohan Kumar",
              },
              organization: {
                company: { id: "company-1", code: "GROUP", name: "Group ERP" },
                branch: {
                  id: "branch-1",
                  code: "HQ",
                  name: "Main Office",
                  timeZone: "Asia/Kolkata",
                },
              },
              workstreamDepartment: { id: "hr", name: "HR" },
              executorDepartment: { id: "hr", name: "HR" },
              assignee: {
                userId: "user-1",
                employeeId: "employee-1",
                displayName: "Rohan Kumar",
              },
              assignment: null,
              dependency: null,
              dueDate: "2026-09-26",
              dueState: "DUE_SOON",
              startedAt: null,
              resolvedAt: null,
              requirement: {
                workType: "CHECKLIST",
                referenceType: null,
                referenceId: null,
                referenceCode: null,
                referenceName: null,
                assetKind: null,
                assetTrackingMode: null,
                assetEligibilityScope: null,
              },
              result: null,
              blockedReasons: [],
              allowedActions: ["START"],
              actionCapabilities: [
                {
                  action: "START",
                  authorityMode: "NORMAL",
                  reasonRequired: false,
                  reasonField: null,
                  remarksRequired: false,
                  confirmationTone: "NORMAL",
                },
              ],
            },
          ],
          total: 1,
          page: 1,
          limit: 10,
        };
        break;
      case "/api/hr-request-types":
        data = {
          items: [
            {
              id: "employment-certificate",
              requestCode: "HR-EMP-CERT",
              requestName: "Employment certificate",
              requiresApproval: false,
              isActive: true,
              allowedActions: [],
            },
            {
              id: "salary-certificate",
              requestCode: "HR-SAL-CERT",
              requestName: "Salary certificate",
              requiresApproval: true,
              isActive: true,
              allowedActions: [],
            },
            {
              id: "address-proof",
              requestCode: "HR-ADDR-PROOF",
              requestName: "Address proof letter",
              requiresApproval: false,
              isActive: true,
              allowedActions: [],
            },
          ],
          total: 3,
          page: 1,
          limit: 50,
          allowedActions: [],
        };
        break;
      case "/api/hr-requests":
        data = {
          items: [
            {
              id: "hr-request-active",
              companyId: "company-1",
              branchId: "branch-1",
              employeeId: "employee-1",
              requestTypeId: "salary-certificate",
              requestNo: "HR-2026-0018",
              requestDate: "2026-09-24",
              status: "PENDING_APPROVAL",
              version: 1,
              createdAt: "2026-09-24T09:00:00.000Z",
              requestType: {
                id: "salary-certificate",
                requestCode: "HR-SAL-CERT",
                requestName: "Salary certificate",
                requiresApproval: true,
                isActive: true,
              },
              approvalTransaction: {
                currentStep: 1,
                status: "PENDING",
                pendingApprover: { id: "manager-1", displayName: "Meera Shah" },
              },
              attachment: { present: true, fileName: "supporting-document.pdf" },
              allowedActions: ["CANCEL"],
            },
            {
              id: "hr-request-approved",
              companyId: "company-1",
              branchId: "branch-1",
              employeeId: "employee-1",
              requestTypeId: "employment-certificate",
              requestNo: "HR-2026-0015",
              requestDate: "2026-09-20",
              status: "APPROVED",
              version: 2,
              createdAt: "2026-09-20T09:00:00.000Z",
              requestType: {
                id: "employment-certificate",
                requestCode: "HR-EMP-CERT",
                requestName: "Employment certificate",
                requiresApproval: false,
                isActive: true,
              },
              allowedActions: [],
            },
            {
              id: "hr-request-completed",
              companyId: "company-1",
              branchId: "branch-1",
              employeeId: "employee-1",
              requestTypeId: "address-proof",
              requestNo: "HR-2026-0014",
              requestDate: "2026-09-12",
              status: "COMPLETED",
              version: 2,
              createdAt: "2026-09-12T09:00:00.000Z",
              completedAt: "2026-09-16T09:00:00.000Z",
              requestType: {
                id: "address-proof",
                requestCode: "HR-ADDR-PROOF",
                requestName: "Address proof letter",
                requiresApproval: false,
                isActive: true,
              },
              allowedActions: [],
            },
          ],
          total: 3,
          page: 1,
          limit: 50,
          allowedActions: ["CREATE"],
        };
        break;
      default:
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: `Unmocked responsive QA endpoint: ${path}` }),
        });
        return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true, data }),
    });
  });
}

test("My Work overview remains usable without horizontal overflow", async ({ page }, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace");

  await expect(page.getByRole("heading", { name: /Good .*Rohan Kumar/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Check in" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Today's work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Needs your attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal records" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  if (dimensions.viewportWidth < 1024) {
    await expect(page.getByRole("button", { name: "Open main navigation" })).toBeVisible();
  } else {
    await expect(
      page
        .getByRole("navigation", { name: "Main navigation" })
        .getByRole("link", { name: "Overview" })
    ).toBeVisible();
  }

  await page.screenshot({
    path: testInfo.outputPath(`my-work-overview-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("My Calendar preserves workflow detail without horizontal overflow", async ({
  page,
}, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace/calendar");

  await expect(page.getByRole("heading", { name: "My calendar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh calendar" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply leave", exact: true })).toHaveCount(0);

  const today = page.getByRole("gridcell", {
    name: /24 today general shift/i,
  });
  await expect(today).toHaveAttribute("aria-current", "date");
  await expect(today).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("complementary", { name: "Day details" })).toContainText(
    "General Shift"
  );

  await page.getByRole("gridcell", { name: /9 annual leave.*approved.*full day/i }).click();
  await expect(page.getByRole("complementary", { name: "Day details" })).toContainText(
    "12 days available"
  );

  await expect(page.getByRole("tab")).toHaveCount(4);
  await expect(page.getByRole("tab", { name: "List", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Balances", exact: true })).toHaveCount(0);
  const goToDate = page.getByLabel("Go to date");
  await expect(goToDate).toBeVisible();
  await expect(goToDate).toHaveAttribute("type", "date");
  await goToDate.fill("2026-09-23");
  await expect(page.getByRole("complementary", { name: "Day details" })).toContainText(
    "Sick Leave"
  );

  await page.getByRole("tab", { name: "Week" }).click();
  await expect(page.getByRole("grid", { name: /Week of Sun, (?:Sep|Sept) 20, 2026/ })).toBeVisible();

  await page.getByRole("tab", { name: "Holiday List" }).click();
  await expect(page.getByRole("table", { name: "Published holidays for 2026" })).toBeVisible();
  await expect(page.getByText("Founders Day")).toBeVisible();

  await page.getByRole("tab", { name: "Leave" }).click();
  await expect(page.getByRole("heading", { name: "Upcoming leave" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Upcoming leave requests" })).toContainText(
    "Annual Leave"
  );
  await expect(page.getByRole("button", { name: "Open My leave" })).toBeVisible();
  await page.getByRole("tab", { name: "Month" }).click();
  await expect(page.getByRole("grid", { name: "Calendar September 2026" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath(`my-calendar-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("My Projects keeps the approved task workflow responsive", async ({
  page,
}, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace/projects");

  await expect(page.getByRole("heading", { name: "My projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My work summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My assigned tasks" })).toBeVisible();

  const isMobile = (page.viewportSize()?.width ?? 1280) < 768;
  await expect(
    page.getByTestId(
      isMobile ? "my-projects-mobile-results" : "my-projects-desktop-results",
    ),
  ).toBeVisible();
  await page
    .locator("button:visible", { hasText: "Daily engineering stand-up" })
    .click();

  const taskSheet = page.getByRole("dialog", { name: "Task details" });
  await expect(taskSheet).toBeVisible();
  await expect(taskSheet.getByText("Payroll validation evidence")).toBeVisible();
  await taskSheet.getByRole("button", { name: "Submit for review" }).click();
  const reviewSheet = page.getByRole("dialog", { name: "Review & submit" });
  await expect(reviewSheet.getByRole("heading", { name: "Review & submit" })).toBeVisible();
  await reviewSheet
    .getByRole("textbox", { name: /Note for reviewer/ })
    .fill("Completed the payroll validation checks.");
  await expect(reviewSheet).toContainText(
    "Submitting will change this task to Awaiting review and notify the project reviewer.",
  );

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath(`my-projects-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("My Leave keeps annual records usable without horizontal overflow", async ({
  page,
}, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace/leave?year=2026");

  await expect(page.getByRole("heading", { name: "My leave", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh My leave" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply leave", exact: true })).toBeVisible();
  await expect(page.getByLabel("Leave year")).toHaveValue("2026");
  await expect(page.getByText("Available leave")).toBeVisible();
  const isNarrow = (page.viewportSize()?.width ?? 1280) < 768;
  if (isNarrow) {
    await expect(page.getByRole("list", { name: "Leave balances mobile" })).toContainText(
      "Annual Leave"
    );
    await expect(page.getByRole("list", { name: "Leave requests mobile" })).toContainText(
      "Pending approval"
    );
  } else {
    await expect(
      page.getByRole("table", { name: "Leave balances by type" }).getByRole("rowheader", {
        name: "Annual Leave",
      })
    ).toBeVisible();
    await expect(page.getByRole("table", { name: "Leave requests" })).toContainText(
      "Pending approval"
    );
  }

  await page.getByRole("button", { name: "Apply leave", exact: true }).click();
  await expect(page).toHaveURL(/action=apply/);
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: "Apply leave" })).toBeVisible();
  await expect(drawer.getByRole("list", { name: "Leave application progress" })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Leave details" })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Request note (optional)" })).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Submission mode" })).toHaveCount(0);
  await expect(drawer.getByRole("radio", { name: "Save as draft" })).toHaveCount(0);

  await drawer.getByLabel("Leave type", { exact: true }).selectOption("annual-leave");
  await drawer.getByLabel("From").fill("2026-09-25");
  await drawer.getByLabel("To").fill("2026-09-25");
  await expect(drawer.getByRole("button", { name: "Review request" })).toBeEnabled();
  await drawer.getByRole("button", { name: "Review request" }).click();

  await expect(drawer.getByRole("heading", { name: "Preview & submit" })).toBeVisible();
  await expect(drawer.getByText("Ready to submit")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Back" })).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Submit request" })).toBeVisible();
  await expect(drawer.getByRole("alert")).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath(`my-leave-${testInfo.project.name}.png`),
    fullPage: true,
    animations: "disabled",
  });
});

test("Onboarding follows the progress, tasks, and journey layout without overflow", async ({
  page,
}, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace/onboarding");

  await expect(page.getByRole("heading", { name: "Onboarding", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "My onboarding" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Department queue" })).toBeVisible();
  await expect(page.getByText("Employee onboarding program")).toBeVisible();
  await expect(page.getByText("68%")).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue next task" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My onboarding tasks" })).toBeVisible();
  await expect(
    page.locator("button:visible", { hasText: "Submit identity documents" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Journey progress" })).toBeVisible();

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath(`my-onboarding-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

test("My HR requests keeps the service catalogue and request tracking responsive", async ({
  page,
}, testInfo) => {
  await mockMyWorkspaceApis(page);
  await page.goto("/my-workspace/hr-requests");

  await expect(page.getByRole("heading", { name: "My HR requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What do you need?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "My active requests" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Request history" })).toBeVisible();
  await expect(page.getByText("Waiting on Meera Shah")).toBeVisible();
  await expect(page.getByLabel("Progress for HR-2026-0015")).toContainText(
    "Waiting on HR completion",
  );
  await expect(
    page.getByLabel("Progress for HR-2026-0015").getByText("Approval", { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("In progress", { exact: true })).toHaveCount(0);
  await expect(page.getByText("HR operations path")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Request Employment certificate" })
    .click();
  const requestSheet = page.getByRole("dialog");
  await expect(requestSheet.getByRole("heading", { name: "Request details" })).toBeVisible();
  await expect(requestSheet.getByLabel("HR request progress")).toHaveCount(0);
  await requestSheet.getByLabel("Remarks").fill("Please provide this for my bank.");
  await requestSheet.getByRole("button", { name: "Review request" }).click();
  await expect(requestSheet.getByRole("heading", { name: "Review & submit" })).toBeVisible();
  await expect(
    requestSheet
      .getByRole("definition")
      .filter({ hasText: "Please provide this for my bank." }),
  ).toBeVisible();
  const dialogBox = await requestSheet.boundingBox();
  const viewport = page.viewportSize();
  expect(dialogBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(dialogBox!.height).toBeLessThan(viewport!.height * 0.9);
  await page.screenshot({
    path: testInfo.outputPath(`my-hr-request-dialog-${testInfo.project.name}.png`),
  });
  await page.keyboard.press("Escape");

  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    mainWidth: document.querySelector("main")?.scrollWidth ?? 0,
    mainClientWidth: document.querySelector("main")?.clientWidth ?? 0,
  }));
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
  expect(dimensions.mainWidth).toBeLessThanOrEqual(dimensions.mainClientWidth + 1);

  await page.screenshot({
    path: testInfo.outputPath(`my-hr-requests-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
