# Manual UAT checklist (remaining human steps)

Use after Technical GO. Do **not** seed shared AWS without explicit approval.

## Recommended smoke (existing `dsp_pms` data)

- [ ] Login / refresh / logout
- [ ] Organization / company / branch switch (if applicable)
- [ ] Dashboard loads live (not demo) for a manager-capable user
- [ ] Leave list / create / submit / approve / reject / cancel within tenant
- [ ] Attendance check-in / check-out / correct within tenant
- [ ] My Workspace (`/my-workspace`) for a user with `User.employeeId`
- [ ] Employee documents verify/reject (HR)
- [ ] Asset assign / return (Asset Manager)
- [ ] Cross-tenant denial (ID from another company → 404)
- [ ] Confirm tenant roles cannot receive `platform.admin`

## Responsive / a11y

- [ ] 1440 / 1024 / 768 / 390 — no body horizontal overflow
- [ ] Sidebar/content independent scroll; mobile drawer focus trap
- [ ] Escape closes sheets/dialogs; focus restored
- [ ] Labels + validation visible; status not colour-only

## After broad rollout

- [ ] Revoke sessions affected by permission expansion
- [ ] Record business sign-off on `CLOSURE.md`
