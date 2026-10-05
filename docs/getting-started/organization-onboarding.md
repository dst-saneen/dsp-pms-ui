# SaaS Organization Onboarding

## Who uses each flow

- A new customer uses **Create an organization** on the login page.
- The verified customer becomes the **Organization Owner** of one Company
  Group.
- A Platform Super Administrator is not created by customer registration.
- The platform setup token is never shown in the application. The old public
  platform-owner page and APIs have been removed.

## Customer journey

1. Open `/register`.
2. Enter the real organization name, owner name, business email and password.
3. Enter the six-digit email verification code.
4. The backend creates the Company Group, first Company, Organization Owner
   role assignment and authenticated session in one transaction.
5. The browser opens `/onboarding`.
6. Complete the Company Group profile.
7. Confirm the first legal Company and optional registration/tax numbers.
8. Add the first Branch and its location.
9. Add at least one Department. A first Designation and Shift are optional.
10. Review the setup and select **Finish setup**.
11. The ERP dashboard opens.

An Organization Owner with incomplete setup is redirected back to
`/onboarding` after sign-in. Existing tenants are marked complete by the
migration and continue to their current dashboard.

## Data-entry rule

Users enter approved business values only. The backend generates and protects
internal codes for:

- Company Groups;
- Companies;
- Branches;
- Departments;
- Designations;
- Shifts;
- Employees;
- Asset Categories;
- Asset Types; and
- Assets.

Generated codes are displayed for reference but are not editable in create or
edit forms.

## Minimum setup

The owner cannot finish onboarding until the tenant has:

- one Company;
- one Branch; and
- one Department.

Designation and Shift are optional because some organizations need to confirm
their HR structure before adding employees.

## Platform administration

The first Platform Super Administrator remains a controlled deployment
operation because there is no trusted administrator available to approve the
first global account. It is not a public registration path.

After that account exists, future administrative accounts are created only
from authenticated **Administration & Security → Users** by a Platform Super
Administrator. Organization Owners cannot grant global access or assign the
Super Administrator role.

## Deployment order

1. Back up the target database.
2. Check that branch codes are unique within each Company and department codes
   are unique within each Branch.
3. Review
   `20260729150000_organization_onboarding_and_generated_codes/migration.sql`.
4. Apply the migration with `prisma migrate deploy`.
5. Deploy the backend.
6. Deploy the frontend.
7. Test login for an existing tenant.
8. Test one new registration in the approved environment.

Do not use `prisma migrate reset` or `prisma migrate dev` against AWS RDS.
