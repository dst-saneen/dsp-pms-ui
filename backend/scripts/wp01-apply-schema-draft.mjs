/**
 * Applies WP-01 schema draft into prisma/schema.prisma (idempotent-ish).
 * Run from backend/: node scripts/wp01-apply-schema-draft.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaPath = resolve("prisma/schema.prisma");
const draftPath = resolve(
  "..",
  "docs",
  "development",
  "wp-01-prisma-schema-draft.txt",
);

let schema = readFileSync(schemaPath, "utf8").replace(/\r\n/g, "\n");
const draft = readFileSync(draftPath, "utf8").replace(/\r\n/g, "\n");

if (schema.includes("model ShiftRoster {")) {
  console.log("ShiftRoster already present — aborting to avoid double-apply");
  process.exit(0);
}

const enumsMatch = draft.match(
  /enum DayPortion \{[\s\S]*?enum OutboxEventStatus \{[\s\S]*?\n\}/,
);
const modelsMatch = draft.match(
  /model ShiftRoster \{[\s\S]*?@@map\("outbox_events"\)\n\}/,
);

if (!enumsMatch || !modelsMatch) {
  throw new Error("Could not extract enums/models from draft");
}

const enumsBlock = `\n//\n// ============================================\n// WORKFORCE TIME MANAGEMENT ENUMS (WP-01)\n// ============================================\n//\n\n${enumsMatch[0]}\n`;
const modelsBlock = `\n//\n// ============================================\n// WORKFORCE TIME MANAGEMENT MODELS (WP-01)\n// ============================================\n//\n\n${modelsMatch[0]}\n`;

// Insert enums before MODELS banner
const modelsBanner = "//\n// ============================================\n// MODELS\n// ============================================\n//";
if (!schema.includes(modelsBanner)) {
  throw new Error("MODELS banner not found");
}
schema = schema.replace(modelsBanner, `${enumsBlock}\n${modelsBanner}`);

function ensureOnce(haystack, needle, insertAfterNeedle, addition) {
  if (haystack.includes(addition.trim().split("\n")[0]) && addition.includes("dayPortion") === false) {
    // soft check — continue
  }
  if (!haystack.includes(needle)) {
    throw new Error(`Needle not found: ${needle}`);
  }
  if (haystack.includes(addition)) {
    return haystack;
  }
  return haystack.replace(needle, `${needle}${addition}`);
}

// BranchWorkingDay
schema = schema.replace(
  `model BranchWorkingDay {
  id String @id @default(uuid())

  branchId  String
  dayOfWeek Int
  isWorkingDay Boolean @default(true)
`,
  `model BranchWorkingDay {
  id String @id @default(uuid())

  branchId  String
  dayOfWeek Int
  isWorkingDay Boolean @default(true)
  dayPortion DayPortion @default(FULL_DAY)
`,
);

// Holiday
schema = schema.replace(
  `  holidayType String

  isActive Boolean @default(true)

  company Company @relation(fields: [companyId], references: [id])
  branch  Branch? @relation(fields: [branchId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, branchId, holidayDate, holidayName])
  @@index([companyId])
  @@index([branchId])
  @@index([holidayDate])
  @@map("holidays")
}`,
  `  holidayType String

  dayPortion DayPortion @default(FULL_DAY)

  isActive Boolean @default(true)

  company Company @relation(fields: [companyId], references: [id])
  branch  Branch? @relation(fields: [branchId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, branchId, holidayDate, holidayName])
  @@index([companyId])
  @@index([branchId])
  @@index([holidayDate])
  @@index([companyId, branchId, holidayDate, isActive])
  @@map("holidays")
}`,
);

// LeaveType
schema = schema.replace(
  `  isActive            Boolean @default(true)
  carryForwardAllowed Boolean @default(false)

  company          Company                @relation(fields: [companyId], references: [id])
  leavePolicies    LeavePolicy[]
  employeeBalances EmployeeLeaveBalance[]
  leaveRequests    LeaveRequest[]
`,
  `  isActive            Boolean @default(true)
  carryForwardAllowed Boolean @default(false)

  category LeaveTypeCategory @default(STANDARD)

  company          Company                @relation(fields: [companyId], references: [id])
  leavePolicies    LeavePolicy[]
  employeeBalances EmployeeLeaveBalance[]
  leaveRequests    LeaveRequest[]
  leaveBalanceTransactions LeaveBalanceTransaction[]
  compOffCredits           CompOffCredit[]
`,
);

// Attendance fields before employee relation
schema = schema.replace(
  `  isActive Boolean @default(true)

  employee Employee @relation(fields: [employeeId], references: [id])

  shift Shift? @relation(fields: [shiftId], references: [id])

  lastModifiedByUser User? @relation("AttendanceLastModifiedBy", fields: [lastModifiedByUserId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, attendanceDate])
`,
  `  isActive Boolean @default(true)

  shiftRosterEntryId    String?              @unique
  scheduledStartAt      DateTime?
  scheduledEndAt        DateTime?
  scheduledBreakMinutes Int?
  scheduledNetMinutes   Int?
  scheduleTimezone      String?
  scheduleDayType       ShiftRosterDayType?
  schedulePortion       DayPortion?
  classificationReason  String?
  finalizedAt           DateTime?

  employee Employee @relation(fields: [employeeId], references: [id])

  shift Shift? @relation(fields: [shiftId], references: [id])

  shiftRosterEntry ShiftRosterEntry? @relation(fields: [shiftRosterEntryId], references: [id], onDelete: Restrict)

  lastModifiedByUser User? @relation("AttendanceLastModifiedBy", fields: [lastModifiedByUserId], references: [id])

  attendanceExceptions      AttendanceException[]
  attendanceRegularizations AttendanceRegularization[]
  overtimeRequests          OvertimeRequest[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, attendanceDate])
`,
);

// Shift grace + inverse
schema = schema.replace(
  `  graceInMinutes Int @default(15)`,
  `  graceInMinutes Int @default(30)`,
);
schema = schema.replace(
  `  employeeShifts EmployeeShift[]

  attendances Attendance[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, shiftCode])
  @@unique([companyId, shiftName])
  @@index([companyId])
  @@map("shifts")
}`,
  `  employeeShifts EmployeeShift[]

  attendances Attendance[]
  shiftRosterEntries ShiftRosterEntry[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([companyId, shiftCode])
  @@unique([companyId, shiftName])
  @@index([companyId])
  @@map("shifts")
}`,
);

// ApprovalWorkflow
schema = schema.replace(
  `  workflowCode String @unique
  workflowName String

  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])

  isActive Boolean @default(true)

  steps ApprovalWorkflowStep[]

  createdAt                     DateTime                       @default(now())
  updatedAt                     DateTime                       @updatedAt
  approvalTransactions          ApprovalTransaction[]
  requestTypes                  HrRequestType[]
  onboardingTemplateTasks       OnboardingTemplateTask[]
  onboardingDepartmentTemplates OnboardingDepartmentTemplate[]
  executionRules                ExecutionRule[]

  @@map("approval_workflows")
}`,
  `  workflowCode String
  workflowName String
  scopeKey     String @unique

  companyId String?
  company   Company? @relation(fields: [companyId], references: [id])

  isActive Boolean @default(true)

  steps ApprovalWorkflowStep[]

  createdAt                     DateTime                       @default(now())
  updatedAt                     DateTime                       @updatedAt
  approvalTransactions          ApprovalTransaction[]
  requestTypes                  HrRequestType[]
  onboardingTemplateTasks       OnboardingTemplateTask[]
  onboardingDepartmentTemplates OnboardingDepartmentTemplate[]
  executionRules                ExecutionRule[]

  @@index([workflowCode])
  @@index([companyId, workflowCode, isActive])
  @@map("approval_workflows")
}`,
);

// ApprovalTransaction inverses
schema = schema.replace(
  `  approvalSteps  ApprovalTransactionStep[]
  workLogHeaders WorkLogHeader[]

  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  employeeOnboardingTasks EmployeeOnboardingTask[]

  @@index([entityType, entityId])
  @@index([status])
  @@map("approval_transactions")
}`,
  `  approvalSteps  ApprovalTransactionStep[]
  workLogHeaders WorkLogHeader[]

  createdAt               DateTime                 @default(now())
  updatedAt               DateTime                 @updatedAt
  employeeOnboardingTasks EmployeeOnboardingTask[]

  attendanceRegularization AttendanceRegularization?
  overtimeRequest          OvertimeRequest?

  @@index([entityType, entityId])
  @@index([status])
  @@map("approval_transactions")
}`,
);

// EmployeeLeaveBalance
schema = schema.replace(
  `  leaveType     LeaveType      @relation(fields: [leaveTypeId], references: [id])
  leaveRequests LeaveRequest[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, leaveTypeId, year])
`,
  `  leaveType     LeaveType      @relation(fields: [leaveTypeId], references: [id])
  leaveRequests LeaveRequest[]
  leaveBalanceTransactions LeaveBalanceTransaction[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([employeeId, leaveTypeId, year])
`,
);

// LeaveRequest — find a stable spot near end of relations
if (!schema.includes("compOffAllocations       CompOffAllocation[]")) {
  schema = schema.replace(
    `model LeaveRequest {
  id String @id @default(uuid())

  employeeId String

  leaveTypeId String

  leaveBalanceId String?
`,
    `model LeaveRequest {
  id String @id @default(uuid())

  employeeId String

  leaveTypeId String

  leaveBalanceId String?
`,
  );
  // Add near leaveType relation block - search for leave balance relation area
  const leaveReqMarker = `  leaveBalance EmployeeLeaveBalance? @relation(fields: [leaveBalanceId], references: [id])`;
  if (schema.includes(leaveReqMarker) && !schema.includes("leaveBalanceTransactions LeaveBalanceTransaction[]")) {
    schema = schema.replace(
      leaveReqMarker,
      `${leaveReqMarker}
  leaveBalanceTransactions LeaveBalanceTransaction[]
  compOffAllocations       CompOffAllocation[]`,
    );
  } else if (!schema.includes("leaveBalanceTransactions LeaveBalanceTransaction[]")) {
    // fallback: before @@map leave_requests
    schema = schema.replace(
      `  @@map("leave_requests")
}`,
      `  leaveBalanceTransactions LeaveBalanceTransaction[]
  compOffAllocations       CompOffAllocation[]

  @@map("leave_requests")
}`,
    );
  }
}

// Company inverses
schema = schema.replace(
  `  userRoleAssignments UserRoleAssignment[]
  defaultUsers        User[]               @relation("UserDefaultCompany")
  activeSessions      AuthSession[]        @relation("SessionActiveCompany")

  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt
  onboardingTemplateScopes OnboardingTemplateScope[]

  @@index([companyGroupId])
  @@index([parentCompanyId])
  @@map("companies")
}`,
  `  userRoleAssignments UserRoleAssignment[]
  defaultUsers        User[]               @relation("UserDefaultCompany")
  activeSessions      AuthSession[]        @relation("SessionActiveCompany")

  createdAt                DateTime                  @default(now())
  updatedAt                DateTime                  @updatedAt
  onboardingTemplateScopes OnboardingTemplateScope[]

  shiftRosters              ShiftRoster[]
  shiftRosterEntries        ShiftRosterEntry[]
  shiftRosterOverrides      ShiftRosterOverride[]
  attendancePolicies        AttendancePolicy[]
  attendanceExceptions      AttendanceException[]
  attendanceRegularizations AttendanceRegularization[]
  attendancePeriods         AttendancePeriod[]
  leaveBalanceTransactions  LeaveBalanceTransaction[]
  overtimePolicies          OvertimePolicy[]
  overtimeRequests          OvertimeRequest[]
  compOffCredits            CompOffCredit[]
  compOffAllocations        CompOffAllocation[]
  userNotifications         UserNotification[]
  outboxEvents              OutboxEvent[]

  @@index([companyGroupId])
  @@index([parentCompanyId])
  @@map("companies")
}`,
);

// Branch inverses
schema = schema.replace(
  `  workingCalendarReviewedAt DateTime?
  onboardingTemplateScopes OnboardingTemplateScope[]

  @@unique([companyId, branchCode])
  @@map("branches")
}`,
  `  workingCalendarReviewedAt DateTime?
  onboardingTemplateScopes OnboardingTemplateScope[]

  shiftRosters              ShiftRoster[]
  shiftRosterEntries        ShiftRosterEntry[]
  shiftRosterOverrides      ShiftRosterOverride[]
  attendancePolicies        AttendancePolicy[]
  attendanceExceptions      AttendanceException[]
  attendanceRegularizations AttendanceRegularization[]
  attendancePeriods         AttendancePeriod[]
  leaveBalanceTransactions  LeaveBalanceTransaction[]
  overtimePolicies          OvertimePolicy[]
  overtimeRequests          OvertimeRequest[]
  compOffCredits            CompOffCredit[]
  compOffAllocations        CompOffAllocation[]
  userNotifications         UserNotification[]
  outboxEvents              OutboxEvent[]

  @@unique([companyId, branchCode])
  @@map("branches")
}`,
);

// Employee inverses
schema = schema.replace(
  `  attendances             Attendance[]
  onboardingTemplateTasks OnboardingTemplateTask[]
  user                    User?

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([designationId])
  @@index([managerId])
  @@index([employmentStatus])
  @@map("employees")
}`,
  `  attendances             Attendance[]
  onboardingTemplateTasks OnboardingTemplateTask[]
  user                    User?

  shiftRosterEntries        ShiftRosterEntry[]
  shiftRosterOverrides      ShiftRosterOverride[]
  attendanceExceptions      AttendanceException[]
  attendanceRegularizations AttendanceRegularization[]
  leaveBalanceTransactions  LeaveBalanceTransaction[]
  overtimeRequests          OvertimeRequest[]
  compOffCredits            CompOffCredit[]
  compOffAllocations        CompOffAllocation[]

  @@index([companyId])
  @@index([branchId])
  @@index([departmentId])
  @@index([designationId])
  @@index([managerId])
  @@index([employmentStatus])
  @@map("employees")
}`,
);

// User inverses
schema = schema.replace(
  `  passwordChangedAt DateTime?
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([status])
  @@index([employeeId])
  @@index([defaultCompanyGroupId])
  @@index([defaultCompanyId])
  @@index([defaultBranchId])
  @@map("users")
}`,
  `  passwordChangedAt DateTime?
  lastLoginAt       DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  shiftRostersCreated                ShiftRoster[]               @relation("ShiftRosterCreatedBy")
  shiftRostersPublished              ShiftRoster[]               @relation("ShiftRosterPublishedBy")
  shiftRostersLocked                 ShiftRoster[]               @relation("ShiftRosterLockedBy")
  shiftRostersArchived               ShiftRoster[]               @relation("ShiftRosterArchivedBy")
  shiftRosterOverridesChanged        ShiftRosterOverride[]       @relation("ShiftRosterOverrideChangedBy")
  attendancePoliciesCreated          AttendancePolicy[]          @relation("AttendancePolicyCreatedBy")
  overtimePoliciesCreated            OvertimePolicy[]            @relation("OvertimePolicyCreatedBy")
  attendanceExceptionsResolved       AttendanceException[]       @relation("AttendanceExceptionResolvedBy")
  attendanceRegularizationsRequested AttendanceRegularization[]  @relation("AttendanceRegularizationRequestedBy")
  attendanceRegularizationsReviewed  AttendanceRegularization[]  @relation("AttendanceRegularizationReviewedBy")
  attendancePeriodsReviewed          AttendancePeriod[]          @relation("AttendancePeriodReviewedBy")
  attendancePeriodsLocked            AttendancePeriod[]          @relation("AttendancePeriodLockedBy")
  attendancePeriodsPayrollPending    AttendancePeriod[]          @relation("AttendancePeriodPayrollPendingBy")
  attendancePeriodsClosed            AttendancePeriod[]          @relation("AttendancePeriodClosedBy")
  attendancePeriodsReopened          AttendancePeriod[]          @relation("AttendancePeriodReopenedBy")
  leaveBalanceTransactionsCreated    LeaveBalanceTransaction[]   @relation("LeaveBalanceTransactionCreatedBy")
  overtimeRequestsApproved           OvertimeRequest[]           @relation("OvertimeRequestApprovedBy")
  overtimeRequestsRejected           OvertimeRequest[]           @relation("OvertimeRequestRejectedBy")
  overtimeRequestsCancelled          OvertimeRequest[]           @relation("OvertimeRequestCancelledBy")
  compOffCreditsRevoked              CompOffCredit[]             @relation("CompOffCreditRevokedBy")
  userNotifications                  UserNotification[]

  @@index([status])
  @@index([employeeId])
  @@index([defaultCompanyGroupId])
  @@index([defaultCompanyId])
  @@index([defaultBranchId])
  @@map("users")
}`,
);

// CompanyGroup inverses
schema = schema.replace(
  `  userInvitations     UserInvitation[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("company_groups")
}`,
  `  userInvitations     UserInvitation[]
  userNotifications   UserNotification[]
  outboxEvents        OutboxEvent[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("company_groups")
}`,
);

// Append new models
schema = `${schema.trimEnd()}\n${modelsBlock}\n`;

writeFileSync(schemaPath, schema);
console.log("Updated", schemaPath);
