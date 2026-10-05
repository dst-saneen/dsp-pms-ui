import { createHash } from 'node:crypto';

import {
  REFERENCE_LAYER_PLAN,
  REFERENCE_MASTER_DATA,
  validateReferenceMasterData,
} from './reference-master-data';

export type ReferenceCompany = {
  code: string;
  name: string;
  groupCode: string;
  legalCountryCode: string;
  currencyCode: string;
  timezone: string;
  reportingYearStartMonth: number;
  branches: ReadonlyArray<{
    code: string;
    name: string;
    city: string;
    countryCode: string;
    subdivisionCode: string;
    timezone: string;
    departments: ReadonlyArray<{ code: string; name: string }>;
  }>;
  designations: ReadonlyArray<{ code: string; name: string }>;
};

export type ReferencePersona = {
  key: string;
  email: string;
  companyCode: string | null;
  branchCode: string | null;
  designationCode: string | null;
  roles: ReadonlyArray<string>;
  employeeRecord: boolean;
  loginEnabled: boolean;
  notes: string;
};

export type ReferencePersonaRoleScope =
  'GLOBAL' | 'COMPANY_GROUP' | 'COMPANY' | 'BRANCH';

export type ReferencePersonaProvisioningProfile = {
  personaKey: string;
  username: string | null;
  employeeCode: string | null;
  departmentCode: string | null;
  managerPersonaKey: string | null;
  userRecord: boolean;
  roleAssignments: ReadonlyArray<{
    roleName: string;
    scope: ReferencePersonaRoleScope;
  }>;
};

const primaryDesignations = [
  { code: 'MANAGING_DIRECTOR', name: 'Managing Director' },
  { code: 'HR_MANAGER', name: 'HR Manager' },
  { code: 'RECRUITER', name: 'Recruiter' },
  { code: 'ENGINEERING_MANAGER', name: 'Engineering Manager' },
  { code: 'PROJECT_MANAGER', name: 'Project Manager' },
  { code: 'SOFTWARE_ENGINEER', name: 'Software Engineer' },
  { code: 'INTERVIEW_PANEL', name: 'Interview Panel Member' },
  { code: 'FINANCE_OFFICER', name: 'Finance Officer' },
  { code: 'PAYROLL_SPECIALIST', name: 'Payroll Specialist' },
  { code: 'IT_ASSET_OFFICER', name: 'IT and Asset Officer' },
  { code: 'ADMIN_EXECUTIVE', name: 'Administration Executive' },
] as const;

const referencePersonaProvisioning = Object.freeze({
  credentialEnvironmentVariable: 'QA_REFERENCE_PERSONA_PASSWORD',
  systemRoleCodes: [
    { name: 'Super Administrator', code: 'SUPER_ADMINISTRATOR' },
    { name: 'Organization Owner', code: 'ORGANIZATION_OWNER' },
    { name: 'Company Administrator', code: 'COMPANY_ADMINISTRATOR' },
    { name: 'HR Manager', code: 'HR_MANAGER' },
    { name: 'Project Manager', code: 'PROJECT_MANAGER' },
    { name: 'Asset Manager', code: 'ASSET_MANAGER' },
    {
      name: 'Asset Department Custodian',
      code: 'ASSET_DEPARTMENT_CUSTODIAN',
    },
    { name: 'Employee', code: 'EMPLOYEE' },
    { name: 'Finance Manager', code: 'FINANCE_MANAGER' },
  ],
  customRoles: [
    {
      code: 'QA_DSP_REF_FINANCE_MAKER',
      name: 'Finance Maker',
      companyGroupCode: 'DSP-REF-QA',
      description:
        'QA least-privilege Finance transaction maker without approval or reversal access.',
      permissionCodes: [
        'dashboard.read',
        'organization.companies.read',
        'organization.branches.read',
        'organization.structure.read',
        'finance.transactions.read',
        'finance.transactions.manage',
        'finance.reports.read',
      ],
    },
    {
      code: 'QA_DSP_REF_PAYROLL_MAKER',
      name: 'Payroll Maker',
      companyGroupCode: 'DSP-REF-QA',
      description:
        'QA least-privilege Payroll maker without payroll approval access.',
      permissionCodes: [
        'dashboard.read',
        'organization.companies.read',
        'organization.branches.read',
        'organization.structure.read',
        'payroll.payroll.read',
        'payroll.payroll.manage',
      ],
    },
    {
      code: 'QA_DSP_REF_READ_ONLY_AUDITOR',
      name: 'Read-only Auditor',
      companyGroupCode: 'DSP-REF-QA',
      description:
        'QA read-only operational auditor with no manage, approve, publish, or reverse permission.',
      permissionCodes: [
        'dashboard.read',
        'security.users.read',
        'security.roles.read',
        'organization.company-groups.read',
        'organization.companies.read',
        'organization.branches.read',
        'organization.structure.read',
        'hr.employees.read',
        'hr.schedule.read',
        'hr.attendance.read',
        'hr.overtime.read',
        'hr.comp-off.read',
        'hr.calendar.read',
        'hr.holidays.read',
        'hr.leave.read',
        'calendar.business.read',
        'projects.projects.read',
        'finance.transactions.read',
        'finance.reports.read',
        'assets.assets.read',
        'assets.assignments.read',
        'payroll.payroll.read',
      ],
    },
  ],
  profiles: [
    {
      personaKey: 'platform-super-admin',
      username: 'qa.platform-super-admin',
      employeeCode: null,
      departmentCode: null,
      managerPersonaKey: null,
      userRecord: true,
      roleAssignments: [{ roleName: 'Super Administrator', scope: 'GLOBAL' }],
    },
    {
      personaKey: 'india-owner',
      username: 'qa.india-owner',
      employeeCode: 'QA-INDIA-OWNER',
      departmentCode: 'ADMIN-QA',
      managerPersonaKey: null,
      userRecord: true,
      roleAssignments: [
        { roleName: 'Organization Owner', scope: 'COMPANY_GROUP' },
      ],
    },
    {
      personaKey: 'india-company-admin',
      username: 'qa.india-company-admin',
      employeeCode: 'QA-INDIA-COMPANY-ADMIN',
      departmentCode: 'ADMIN-QA',
      managerPersonaKey: 'india-owner',
      userRecord: true,
      roleAssignments: [
        { roleName: 'Company Administrator', scope: 'COMPANY' },
      ],
    },
    {
      personaKey: 'india-hr-manager',
      username: 'qa.india-hr-manager',
      employeeCode: 'QA-INDIA-HR-MANAGER',
      departmentCode: 'HR-QA',
      managerPersonaKey: 'india-owner',
      userRecord: true,
      roleAssignments: [{ roleName: 'HR Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-recruiter',
      username: 'qa.india-recruiter',
      employeeCode: 'QA-INDIA-RECRUITER',
      departmentCode: 'HR-QA',
      managerPersonaKey: 'india-hr-manager',
      userRecord: true,
      roleAssignments: [{ roleName: 'HR Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-payroll-maker',
      username: 'qa.india-payroll-maker',
      employeeCode: 'QA-INDIA-PAYROLL-MAKER',
      departmentCode: 'FIN-QA',
      managerPersonaKey: 'india-finance-payroll-approver',
      userRecord: true,
      roleAssignments: [{ roleName: 'Payroll Maker', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-engineering-manager',
      username: 'qa.india-engineering-manager',
      employeeCode: 'QA-INDIA-ENGINEERING-MANAGER',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-owner',
      userRecord: true,
      roleAssignments: [{ roleName: 'Employee', scope: 'BRANCH' }],
    },
    {
      personaKey: 'india-project-manager',
      username: 'qa.india-project-manager',
      employeeCode: 'QA-INDIA-PROJECT-MANAGER',
      departmentCode: 'PROJECTS-QA',
      managerPersonaKey: 'india-engineering-manager',
      userRecord: true,
      roleAssignments: [{ roleName: 'Project Manager', scope: 'BRANCH' }],
    },
    {
      personaKey: 'india-asset-manager',
      username: 'qa.india-asset-manager',
      employeeCode: 'QA-INDIA-ASSET-MANAGER',
      departmentCode: 'IT-ASSET-QA',
      managerPersonaKey: 'india-company-admin',
      userRecord: true,
      roleAssignments: [{ roleName: 'Asset Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-asset-custodian',
      username: 'qa.india-asset-custodian',
      employeeCode: 'QA-INDIA-ASSET-CUSTODIAN',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-engineering-manager',
      userRecord: true,
      roleAssignments: [
        { roleName: 'Asset Department Custodian', scope: 'BRANCH' },
      ],
    },
    {
      personaKey: 'india-finance-maker',
      username: 'qa.india-finance-maker',
      employeeCode: 'QA-INDIA-FINANCE-MAKER',
      departmentCode: 'FIN-QA',
      managerPersonaKey: 'india-finance-payroll-approver',
      userRecord: true,
      roleAssignments: [{ roleName: 'Finance Maker', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-finance-payroll-approver',
      username: 'qa.india-finance-payroll-approver',
      employeeCode: 'QA-INDIA-FINANCE-APPROVER',
      departmentCode: 'FIN-QA',
      managerPersonaKey: 'india-owner',
      userRecord: true,
      roleAssignments: [{ roleName: 'Finance Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-employee',
      username: 'qa.india-employee',
      employeeCode: 'QA-INDIA-EMPLOYEE',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-engineering-manager',
      userRecord: true,
      roleAssignments: [{ roleName: 'Employee', scope: 'BRANCH' }],
    },
    {
      personaKey: 'india-read-only',
      username: 'qa.india-read-only',
      employeeCode: 'QA-INDIA-READ-ONLY',
      departmentCode: 'ADMIN-QA',
      managerPersonaKey: 'india-company-admin',
      userRecord: true,
      roleAssignments: [{ roleName: 'Read-only Auditor', scope: 'COMPANY' }],
    },
    {
      personaKey: 'india-disabled',
      username: 'qa.india-disabled',
      employeeCode: 'QA-INDIA-DISABLED',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-engineering-manager',
      userRecord: true,
      roleAssignments: [{ roleName: 'Employee', scope: 'BRANCH' }],
    },
    {
      personaKey: 'india-employee-no-login',
      username: null,
      employeeCode: 'QA-INDIA-NO-LOGIN',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'india-engineering-manager',
      userRecord: false,
      roleAssignments: [],
    },
    {
      personaKey: 'uae-admin-hr',
      username: 'qa.uae-admin-hr',
      employeeCode: 'QA-UAE-ADMIN-HR',
      departmentCode: 'HR-QA',
      managerPersonaKey: null,
      userRecord: true,
      roleAssignments: [
        { roleName: 'Company Administrator', scope: 'COMPANY' },
        { roleName: 'HR Manager', scope: 'COMPANY' },
      ],
    },
    {
      personaKey: 'uae-reporting-project-manager',
      username: 'qa.uae-reporting-project-manager',
      employeeCode: 'QA-UAE-REPORTING-MANAGER',
      departmentCode: 'PROJECTS-QA',
      managerPersonaKey: 'uae-admin-hr',
      userRecord: true,
      roleAssignments: [{ roleName: 'Project Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'uae-finance-maker',
      username: 'qa.uae-finance-maker',
      employeeCode: 'QA-UAE-FINANCE-MAKER',
      departmentCode: 'FIN-QA',
      managerPersonaKey: 'uae-admin-hr',
      userRecord: true,
      roleAssignments: [{ roleName: 'Finance Maker', scope: 'COMPANY' }],
    },
    {
      personaKey: 'uae-finance-payroll-approver',
      username: 'qa.uae-finance-payroll-approver',
      employeeCode: 'QA-UAE-FINANCE-APPROVER',
      departmentCode: 'FIN-QA',
      managerPersonaKey: 'uae-admin-hr',
      userRecord: true,
      roleAssignments: [{ roleName: 'Finance Manager', scope: 'COMPANY' }],
    },
    {
      personaKey: 'uae-employee',
      username: 'qa.uae-employee',
      employeeCode: 'QA-UAE-EMPLOYEE',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'uae-reporting-project-manager',
      userRecord: true,
      roleAssignments: [{ roleName: 'Employee', scope: 'BRANCH' }],
    },
    {
      personaKey: 'isolation-owner-hr',
      username: 'qa.isolation-owner-hr',
      employeeCode: 'QA-ISOLATION-OWNER-HR',
      departmentCode: 'HR-QA',
      managerPersonaKey: null,
      userRecord: true,
      roleAssignments: [
        { roleName: 'Organization Owner', scope: 'COMPANY_GROUP' },
        { roleName: 'HR Manager', scope: 'COMPANY' },
      ],
    },
    {
      personaKey: 'isolation-employee',
      username: 'qa.isolation-employee',
      employeeCode: 'QA-ISOLATION-EMPLOYEE',
      departmentCode: 'ENG-QA',
      managerPersonaKey: 'isolation-owner-hr',
      userRecord: true,
      roleAssignments: [{ roleName: 'Employee', scope: 'BRANCH' }],
    },
  ] satisfies ReadonlyArray<ReferencePersonaProvisioningProfile>,
  departmentGrants: [
    {
      personaKey: 'india-asset-custodian',
      departmentCode: 'ENG-QA',
    },
  ],
});

export const REFERENCE_DATA_CONTRACT = Object.freeze({
  version: 3,
  qaMarker: 'QA',
  groups: [
    { code: 'DSP-REF-QA', name: 'DSP Reference Group QA' },
    { code: 'DSP-ISO-QA', name: 'DSP Isolation Group QA' },
  ],
  companies: [
    {
      code: 'DSP-IN-QA',
      name: 'DSP India Services Pvt Ltd QA',
      groupCode: 'DSP-REF-QA',
      legalCountryCode: 'IN',
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      reportingYearStartMonth: 4,
      branches: [
        {
          code: 'IN-KOCHI-HQ-QA',
          name: 'Kochi Headquarters QA',
          city: 'Kochi',
          countryCode: 'IN',
          subdivisionCode: 'IN-KL',
          timezone: 'Asia/Kolkata',
          departments: [
            { code: 'ADMIN-QA', name: 'Administration QA' },
            { code: 'HR-QA', name: 'Human Resources QA' },
            { code: 'FIN-QA', name: 'Finance QA' },
            { code: 'IT-ASSET-QA', name: 'IT & Assets QA' },
            { code: 'PROJECTS-QA', name: 'Projects QA' },
            { code: 'ENG-QA', name: 'Engineering QA' },
          ],
        },
        {
          code: 'IN-BLR-DC-QA',
          name: 'Bengaluru Delivery Centre QA',
          city: 'Bengaluru',
          countryCode: 'IN',
          subdivisionCode: 'IN-KA',
          timezone: 'Asia/Kolkata',
          departments: [
            { code: 'ADMIN-QA', name: 'Administration QA' },
            { code: 'PROJECTS-QA', name: 'Projects QA' },
            { code: 'ENG-QA', name: 'Engineering QA' },
          ],
        },
        {
          code: 'IN-MUM-CS-QA',
          name: 'Mumbai Client Services QA',
          city: 'Mumbai',
          countryCode: 'IN',
          subdivisionCode: 'IN-MH',
          timezone: 'Asia/Kolkata',
          departments: [
            { code: 'ADMIN-QA', name: 'Administration QA' },
            { code: 'CLIENT-SVC-QA', name: 'Client Services QA' },
            { code: 'FIN-QA', name: 'Finance QA' },
          ],
        },
      ],
      designations: primaryDesignations,
    },
    {
      code: 'DSP-AE-QA',
      name: 'DSP UAE Services LLC QA',
      groupCode: 'DSP-REF-QA',
      legalCountryCode: 'AE',
      currencyCode: 'AED',
      timezone: 'Asia/Dubai',
      reportingYearStartMonth: 1,
      branches: [
        {
          code: 'AE-DXB-HQ-QA',
          name: 'Dubai Headquarters QA',
          city: 'Dubai',
          countryCode: 'AE',
          subdivisionCode: 'AE-DU',
          timezone: 'Asia/Dubai',
          departments: [
            { code: 'ADMIN-QA', name: 'Administration QA' },
            { code: 'HR-QA', name: 'Human Resources QA' },
            { code: 'FIN-QA', name: 'Finance QA' },
            { code: 'IT-ASSET-QA', name: 'IT & Assets QA' },
            { code: 'PROJECTS-QA', name: 'Projects QA' },
          ],
        },
        {
          code: 'AE-AUH-OPS-QA',
          name: 'Abu Dhabi Operations QA',
          city: 'Abu Dhabi',
          countryCode: 'AE',
          subdivisionCode: 'AE-AZ',
          timezone: 'Asia/Dubai',
          departments: [
            { code: 'ADMIN-QA', name: 'Administration QA' },
            { code: 'PROJECTS-QA', name: 'Projects QA' },
            { code: 'ENG-QA', name: 'Engineering QA' },
          ],
        },
      ],
      designations: primaryDesignations,
    },
    {
      code: 'DSP-ISO-CO-QA',
      name: 'DSP Isolation Company QA',
      groupCode: 'DSP-ISO-QA',
      legalCountryCode: 'IN',
      currencyCode: 'INR',
      timezone: 'Asia/Kolkata',
      reportingYearStartMonth: 4,
      branches: [
        {
          code: 'ISO-BRANCH-QA',
          name: 'Isolation Branch QA',
          city: 'Kochi',
          countryCode: 'IN',
          subdivisionCode: 'IN-KL',
          timezone: 'Asia/Kolkata',
          departments: [
            { code: 'HR-QA', name: 'Human Resources QA' },
            { code: 'ENG-QA', name: 'Engineering QA' },
          ],
        },
      ],
      designations: [
        { code: 'HR_MANAGER', name: 'HR Manager' },
        { code: 'ENGINEERING_MANAGER', name: 'Engineering Manager' },
        { code: 'EMPLOYEE', name: 'Employee' },
      ],
    },
  ] satisfies ReadonlyArray<ReferenceCompany>,
  personas: [
    {
      key: 'platform-super-admin',
      email: 'qa+platform-admin@dsp-reference.invalid',
      companyCode: null,
      branchCode: null,
      designationCode: null,
      roles: ['Super Administrator'],
      employeeRecord: false,
      loginEnabled: true,
      notes: 'Global platform identity; intentionally has no Employee record.',
    },
    {
      key: 'india-owner',
      email: 'qa+india-owner@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'MANAGING_DIRECTOR',
      roles: ['Organization Owner'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Group-level owner who can switch between India and UAE.',
    },
    {
      key: 'india-company-admin',
      email: 'qa+india-admin@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'ADMIN_EXECUTIVE',
      roles: ['Company Administrator'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'India Company administration persona.',
    },
    {
      key: 'india-hr-manager',
      email: 'qa+india-hr@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'HR_MANAGER',
      roles: ['HR Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Second-step leave and overtime approver.',
    },
    {
      key: 'india-recruiter',
      email: 'qa+india-recruiter@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'RECRUITER',
      roles: ['HR Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Recruitment operator.',
    },
    {
      key: 'india-payroll-maker',
      email: 'qa+india-payroll-maker@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'PAYROLL_SPECIALIST',
      roles: ['Payroll Maker'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Cannot approve own payroll run.',
    },
    {
      key: 'india-engineering-manager',
      email: 'qa+india-eng-manager@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'ENGINEERING_MANAGER',
      roles: ['Employee'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Hiring/reporting manager for Bengaluru employee.',
    },
    {
      key: 'india-project-manager',
      email: 'qa+india-project-manager@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-BLR-DC-QA',
      designationCode: 'PROJECT_MANAGER',
      roles: ['Project Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Project manager and interview panel persona.',
    },
    {
      key: 'india-asset-manager',
      email: 'qa+india-asset-manager@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'IT_ASSET_OFFICER',
      roles: ['Asset Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'IT and asset manager.',
    },
    {
      key: 'india-asset-custodian',
      email: 'qa+india-asset-custodian@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-BLR-DC-QA',
      designationCode: 'SOFTWARE_ENGINEER',
      roles: ['Asset Department Custodian'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Requires an explicit Engineering Department grant.',
    },
    {
      key: 'india-finance-maker',
      email: 'qa+india-finance-maker@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-MUM-CS-QA',
      designationCode: 'FINANCE_OFFICER',
      roles: ['Finance Maker'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Cannot approve own Finance transaction.',
    },
    {
      key: 'india-finance-payroll-approver',
      email: 'qa+india-approver@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'FINANCE_OFFICER',
      roles: ['Finance Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Independent Finance and Payroll approver.',
    },
    {
      key: 'india-employee',
      email: 'qa+india-employee@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-BLR-DC-QA',
      designationCode: 'SOFTWARE_ENGINEER',
      roles: ['Employee'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Reports cross-branch to the Kochi Engineering Manager.',
    },
    {
      key: 'india-read-only',
      email: 'qa+india-auditor@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-MUM-CS-QA',
      designationCode: 'ADMIN_EXECUTIVE',
      roles: ['Read-only Auditor'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Read-only negative-write persona.',
    },
    {
      key: 'india-disabled',
      email: 'qa+india-disabled@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-KOCHI-HQ-QA',
      designationCode: 'SOFTWARE_ENGINEER',
      roles: ['Employee'],
      employeeRecord: true,
      loginEnabled: false,
      notes: 'Disabled User and Employee session-denial persona.',
    },
    {
      key: 'india-employee-no-login',
      email: 'qa+india-no-login@dsp-reference.invalid',
      companyCode: 'DSP-IN-QA',
      branchCode: 'IN-BLR-DC-QA',
      designationCode: 'SOFTWARE_ENGINEER',
      roles: [],
      employeeRecord: true,
      loginEnabled: false,
      notes: 'Employee exists without a User identity.',
    },
    {
      key: 'uae-admin-hr',
      email: 'qa+uae-admin-hr@dsp-reference.invalid',
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-DXB-HQ-QA',
      designationCode: 'HR_MANAGER',
      roles: ['Company Administrator', 'HR Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'UAE Company administrator and HR persona.',
    },
    {
      key: 'uae-reporting-project-manager',
      email: 'qa+uae-manager@dsp-reference.invalid',
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-DXB-HQ-QA',
      designationCode: 'PROJECT_MANAGER',
      roles: ['Project Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Dubai manager for Abu Dhabi employee.',
    },
    {
      key: 'uae-finance-maker',
      email: 'qa+uae-finance-maker@dsp-reference.invalid',
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-DXB-HQ-QA',
      designationCode: 'FINANCE_OFFICER',
      roles: ['Finance Maker'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'UAE Finance maker.',
    },
    {
      key: 'uae-finance-payroll-approver',
      email: 'qa+uae-approver@dsp-reference.invalid',
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-DXB-HQ-QA',
      designationCode: 'FINANCE_OFFICER',
      roles: ['Finance Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Independent UAE Finance and Payroll approver.',
    },
    {
      key: 'uae-employee',
      email: 'qa+uae-employee@dsp-reference.invalid',
      companyCode: 'DSP-AE-QA',
      branchCode: 'AE-AUH-OPS-QA',
      designationCode: 'SOFTWARE_ENGINEER',
      roles: ['Employee'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Reports cross-branch to the Dubai manager.',
    },
    {
      key: 'isolation-owner-hr',
      email: 'qa+isolation-owner@dsp-reference.invalid',
      companyCode: 'DSP-ISO-CO-QA',
      branchCode: 'ISO-BRANCH-QA',
      designationCode: 'HR_MANAGER',
      roles: ['Organization Owner', 'HR Manager'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Isolation tenant owner and HR persona.',
    },
    {
      key: 'isolation-employee',
      email: 'qa+isolation-employee@dsp-reference.invalid',
      companyCode: 'DSP-ISO-CO-QA',
      branchCode: 'ISO-BRANCH-QA',
      designationCode: 'EMPLOYEE',
      roles: ['Employee'],
      employeeRecord: true,
      loginEnabled: true,
      notes: 'Cross-tenant direct-ID denial persona.',
    },
  ] satisfies ReadonlyArray<ReferencePersona>,
  customRoles: ['Finance Maker', 'Payroll Maker', 'Read-only Auditor'],
  systemRoles: [
    'Super Administrator',
    'Organization Owner',
    'Company Administrator',
    'HR Manager',
    'Project Manager',
    'Asset Manager',
    'Asset Department Custodian',
    'Employee',
    'Finance Manager',
  ],
  personaProvisioning: referencePersonaProvisioning,
  referenceLayerPlan: REFERENCE_LAYER_PLAN,
  masterData: REFERENCE_MASTER_DATA,
  stableMasterData: REFERENCE_LAYER_PLAN.map((layer) => layer.key),
  runOwnedEntities: [
    'invitations-and-password-resets',
    'recruitment-and-new-joiner-records',
    'onboarding-instances-and-tasks',
    'attendance-leave-overtime-and-comp-off-transactions',
    'asset-custody-and-licence-transactions',
    'projects-tasks-worklogs-and-timesheets',
    'finance-and-payroll-transactions',
    'file-and-delivery-operations',
    'idempotency-stale-version-and-concurrency-cases',
  ],
});

function assertUnique(values: ReadonlyArray<string>, label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`${label} contains duplicate values.`);
  }
}

export function validateReferenceDataContract(): void {
  assertUnique(
    REFERENCE_DATA_CONTRACT.groups.map((group) => group.code),
    'Group codes',
  );
  assertUnique(
    REFERENCE_DATA_CONTRACT.companies.map((company) => company.code),
    'Company codes',
  );
  assertUnique(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => persona.key),
    'Persona keys',
  );
  assertUnique(
    REFERENCE_DATA_CONTRACT.personas.map((persona) => persona.email),
    'Persona emails',
  );

  const groupCodes = new Set(
    REFERENCE_DATA_CONTRACT.groups.map((group) => group.code),
  );
  const referenceCompanies: ReadonlyArray<ReferenceCompany> =
    REFERENCE_DATA_CONTRACT.companies;
  for (const company of referenceCompanies) {
    if (!groupCodes.has(company.groupCode)) {
      throw new Error(`${company.code} references an unknown Company Group.`);
    }
    if (!company.name.endsWith('QA') || !company.code.endsWith('QA')) {
      throw new Error(`${company.code} is not visibly marked as QA data.`);
    }
    assertUnique(
      company.branches.map((branch) => branch.code),
      `${company.code} Branch codes`,
    );
    assertUnique(
      company.designations.map((designation) => designation.code),
      `${company.code} Designation codes`,
    );
    for (const branch of company.branches) {
      assertUnique(
        branch.departments.map((department) => department.code),
        `${branch.code} Department codes`,
      );
    }
  }

  const companies = new Map(
    referenceCompanies.map((company) => [company.code, company]),
  );
  validateReferenceMasterData(
    new Set(referenceCompanies.map((company) => company.code)),
    new Map(
      referenceCompanies.map((company) => [
        company.code,
        new Set(company.branches.map((branch) => branch.code)),
      ]),
    ),
    new Map(
      referenceCompanies.flatMap((company) =>
        company.branches.map(
          (branch) =>
            [
              `${company.code}:${branch.code}`,
              new Set(branch.departments.map((department) => department.code)),
            ] as const,
        ),
      ),
    ),
  );
  const personas: ReadonlyArray<ReferencePersona> =
    REFERENCE_DATA_CONTRACT.personas;
  const profiles: ReadonlyArray<ReferencePersonaProvisioningProfile> =
    REFERENCE_DATA_CONTRACT.personaProvisioning.profiles;
  assertUnique(
    profiles.map((profile) => profile.personaKey),
    'Persona provisioning keys',
  );
  assertUnique(
    profiles
      .map((profile) => profile.username)
      .filter((username): username is string => username !== null),
    'Persona usernames',
  );
  assertUnique(
    profiles
      .map((profile) => profile.employeeCode)
      .filter((employeeCode): employeeCode is string => employeeCode !== null),
    'Persona Employee codes',
  );
  const personaByKey = new Map(
    personas.map((persona) => [persona.key, persona]),
  );
  const profileByKey = new Map(
    profiles.map((profile) => [profile.personaKey, profile]),
  );
  if (profileByKey.size !== personaByKey.size) {
    throw new Error(
      'Every reference persona must have exactly one provisioning profile.',
    );
  }
  for (const persona of personas) {
    const profile = profileByKey.get(persona.key);
    if (!profile) {
      throw new Error(`${persona.key} is missing its provisioning profile.`);
    }
    if (!persona.email.endsWith('@dsp-reference.invalid')) {
      throw new Error(`${persona.key} must use the synthetic .invalid domain.`);
    }
    if (persona.loginEnabled && !profile.userRecord) {
      throw new Error(`${persona.key} enables login without a User record.`);
    }
    if (!profile.userRecord && profile.roleAssignments.length > 0) {
      throw new Error(`${persona.key} assigns roles without a User record.`);
    }
    const contractedRoles = [...persona.roles].sort();
    const provisionedRoles = profile.roleAssignments
      .map((assignment) => assignment.roleName)
      .sort();
    if (JSON.stringify(contractedRoles) !== JSON.stringify(provisionedRoles)) {
      throw new Error(
        `${persona.key} role assignments do not match its contracted roles.`,
      );
    }
    if (persona.companyCode === null) {
      if (
        persona.employeeRecord ||
        persona.branchCode !== null ||
        profile.employeeCode !== null ||
        profile.departmentCode !== null ||
        profile.managerPersonaKey !== null
      ) {
        throw new Error(`${persona.key} has an invalid global identity shape.`);
      }
      if (
        profile.roleAssignments.some(
          (assignment) => assignment.scope !== 'GLOBAL',
        )
      ) {
        throw new Error(`${persona.key} must use only global role scope.`);
      }
      continue;
    }
    const company = companies.get(persona.companyCode);
    if (!company) {
      throw new Error(`${persona.key} references an unknown Company.`);
    }
    if (
      !company.branches.some((branch) => branch.code === persona.branchCode)
    ) {
      throw new Error(`${persona.key} references an unknown Branch.`);
    }
    if (
      persona.designationCode !== null &&
      !company.designations.some(
        (designation) => designation.code === persona.designationCode,
      )
    ) {
      throw new Error(`${persona.key} references an unknown Designation.`);
    }
    const branch = company.branches.find(
      (candidate) => candidate.code === persona.branchCode,
    );
    if (
      !profile.departmentCode ||
      !branch?.departments.some(
        (department) => department.code === profile.departmentCode,
      )
    ) {
      throw new Error(`${persona.key} references an unknown Department.`);
    }
    if (persona.employeeRecord !== (profile.employeeCode !== null)) {
      throw new Error(
        `${persona.key} Employee provisioning does not match the persona contract.`,
      );
    }
    for (const assignment of profile.roleAssignments) {
      if (assignment.scope === 'GLOBAL') {
        throw new Error(`${persona.key} cannot receive global tenant access.`);
      }
    }
    if (profile.managerPersonaKey) {
      const manager = personaByKey.get(profile.managerPersonaKey);
      if (!manager || !manager.employeeRecord) {
        throw new Error(
          `${persona.key} references an invalid reporting manager.`,
        );
      }
      if (manager.companyCode !== persona.companyCode) {
        throw new Error(
          `${persona.key} has a cross-company reporting manager.`,
        );
      }
      if (manager.key === persona.key) {
        throw new Error(`${persona.key} cannot report to itself.`);
      }
    }
  }

  for (const profile of profiles) {
    const visited = new Set<string>();
    let current: ReferencePersonaProvisioningProfile | undefined = profile;
    while (current?.managerPersonaKey) {
      if (visited.has(current.personaKey)) {
        throw new Error(`${profile.personaKey} has a reporting-line cycle.`);
      }
      visited.add(current.personaKey);
      current = profileByKey.get(current.managerPersonaKey);
    }
  }

  const customRoles = REFERENCE_DATA_CONTRACT.personaProvisioning.customRoles;
  assertUnique(
    customRoles.map((role) => role.code),
    'Custom Role codes',
  );
  assertUnique(
    customRoles.map(
      (role) => `${role.companyGroupCode}:${role.name.toLowerCase()}`,
    ),
    'Custom Role names',
  );
  const customRoleNames = new Set(customRoles.map((role) => role.name));
  if (
    JSON.stringify([...customRoleNames].sort()) !==
    JSON.stringify([...REFERENCE_DATA_CONTRACT.customRoles].sort())
  ) {
    throw new Error(
      'Custom Role provisioning does not match the Role contract.',
    );
  }
  for (const role of customRoles) {
    if (!groupCodes.has(role.companyGroupCode)) {
      throw new Error(`${role.code} references an unknown Company Group.`);
    }
    assertUnique(role.permissionCodes, `${role.code} permission codes`);
    if (role.name === 'Finance Maker') {
      if (
        role.permissionCodes.some(
          (code) => code.endsWith('.approve') || code.endsWith('.reverse'),
        )
      ) {
        throw new Error(
          'Finance Maker cannot approve or reverse transactions.',
        );
      }
    }
    if (role.name === 'Payroll Maker') {
      if (role.permissionCodes.includes('payroll.payroll.approve')) {
        throw new Error('Payroll Maker cannot approve payroll.');
      }
    }
    if (
      role.name === 'Read-only Auditor' &&
      role.permissionCodes.some((code) => !code.endsWith('.read'))
    ) {
      throw new Error('Read-only Auditor may receive only read permissions.');
    }
  }

  const systemRoleNames = new Set(
    REFERENCE_DATA_CONTRACT.personaProvisioning.systemRoleCodes.map(
      (role) => role.name,
    ),
  );
  if (
    JSON.stringify([...systemRoleNames].sort()) !==
    JSON.stringify([...REFERENCE_DATA_CONTRACT.systemRoles].sort())
  ) {
    throw new Error(
      'System Role code mapping does not match the Role contract.',
    );
  }

  for (const grant of REFERENCE_DATA_CONTRACT.personaProvisioning
    .departmentGrants) {
    const persona = personaByKey.get(grant.personaKey);
    const profile = profileByKey.get(grant.personaKey);
    if (
      !persona ||
      !profile?.userRecord ||
      profile.departmentCode !== grant.departmentCode
    ) {
      throw new Error(`${grant.personaKey} has an invalid Department grant.`);
    }
  }

  const exercisedRoles = new Set(
    REFERENCE_DATA_CONTRACT.personas.flatMap((persona) => persona.roles),
  );
  for (const role of [
    ...REFERENCE_DATA_CONTRACT.systemRoles,
    ...REFERENCE_DATA_CONTRACT.customRoles,
  ]) {
    if (!exercisedRoles.has(role)) {
      throw new Error(`No reference persona exercises role "${role}".`);
    }
  }
}

export function referenceDataContractFingerprint(): string {
  validateReferenceDataContract();
  return createHash('sha256')
    .update(JSON.stringify(REFERENCE_DATA_CONTRACT))
    .digest('hex');
}
