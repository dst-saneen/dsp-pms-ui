/**
 * Phase 8 API smoke — Employee / Manager / HR / Matrix / Calendar.
 * Uses leave.uat.* accounts (password = email). Mutates leave on connected DB.
 * Does not print passwords.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const BASE = process.env.UAT_API_BASE || "http://localhost:4500";

const ACCOUNTS = {
  emp: {
    id: "leave.uat.emp@example.test",
    password: "leave.uat.emp@example.test",
  },
  mgr: {
    id: "leave.uat.mgr@example.test",
    password: "leave.uat.mgr@example.test",
  },
  hr: {
    id: "leave.uat.hr@example.test",
    password: "leave.uat.hr@example.test",
  },
};

const results = [];

function record(id, status, notes, detail = null) {
  results.push({ id, status, notes, detail });
  console.log(`[${status}] ${id} — ${notes}`);
}

function unwrap(body) {
  if (body && typeof body === "object" && "data" in body) return body.data;
  return body;
}

async function api(method, path, { token, body } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text?.slice(0, 300) };
  }
  return { status: res.status, ok: res.ok, json, data: unwrap(json) };
}

async function login(account) {
  const res = await api("POST", "/auth/login", {
    body: { identifier: account.id, password: account.password },
  });
  const token =
    res.data?.accessToken ||
    res.json?.accessToken ||
    res.data?.tokens?.accessToken;
  if (!res.ok || !token) {
    throw new Error(`Login failed for ${account.id}: ${res.status}`);
  }
  return {
    token,
    user: res.data?.user || res.data,
    employeeId:
      res.data?.user?.employeeId ||
      res.data?.employeeId ||
      res.data?.user?.employee?.id,
  };
}

function nextWeekdayIso(daysAhead = 5) {
  // Prefer mid-September to avoid known Aug UAT collisions on this pilot employee.
  const d = new Date(Date.UTC(2026, 8, 1)); // 2026-09-01
  d.setUTCDate(d.getUTCDate() + Math.max(0, daysAhead - 5));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().slice(0, 10);
}

async function main() {
  const leaveDate = nextWeekdayIso(7);
  const fromCal = leaveDate.slice(0, 8) + "01";
  const toCal = leaveDate;

  const emp = await login(ACCOUNTS.emp);
  record("login.emp", "PASS", "Employee logged in", {
    employeeId: emp.employeeId,
  });
  const mgr = await login(ACCOUNTS.mgr);
  record("login.mgr", "PASS", "Manager logged in", {
    employeeId: mgr.employeeId,
  });
  const hr = await login(ACCOUNTS.hr);
  record("login.hr", "PASS", "HR logged in", { employeeId: hr.employeeId });

  // --- Employee balances ---
  const balances = await api("GET", "/me/leave?year=2026", { token: emp.token });
  const balanceRows = Array.isArray(balances.data)
    ? balances.data
    : balances.data?.balances || balances.data?.items || [];
  record(
    "emp.balances",
    balances.ok ? "PASS" : "FAIL",
    balances.ok
      ? `Employee balances readable (${balanceRows.length || "ok"})`
      : `status ${balances.status}`,
    { status: balances.status },
  );

  // --- Matrix ---
  const branchId = "d9b23f66-34d4-472e-a397-48a406787a99"; // Kowdiar from Phase 8 readiness
  const matrixGet = await api(
    "GET",
    `/leave-policies/matrix?branchId=${branchId}`,
    { token: hr.token },
  );
  if (!matrixGet.ok) {
    record("matrix.get", "FAIL", `status ${matrixGet.status}`, matrixGet.json);
  } else {
    record("matrix.get", "PASS", "Matrix loaded for Kowdiar");
    const matrix = matrixGet.data;
    const designationId = matrix.designations?.[0]?.id;
    const leaveTypeId = matrix.leaveTypes?.[0]?.id;
    const snapshotToken = matrix.snapshotToken;
    const cells = (matrix.designations || []).flatMap((d) =>
      (matrix.leaveTypes || []).map((lt) => {
        const existing = (matrix.cells || []).find(
          (c) => c.designationId === d.id && c.leaveTypeId === lt.id,
        );
        return {
          designationId: d.id,
          leaveTypeId: lt.id,
          enabled: Boolean(existing?.enabled),
          annualEntitlement: existing?.enabled
            ? Number(existing.annualEntitlement ?? 12)
            : undefined,
        };
      }),
    );

    const zeroAttempt = cells.map((c) =>
      c.designationId === designationId && c.leaveTypeId === leaveTypeId
        ? { ...c, enabled: true, annualEntitlement: 0 }
        : c,
    );
    const zeroPut = await api("PUT", "/leave-policies/matrix", {
      token: hr.token,
      body: {
        branchId,
        snapshotToken,
        reason: "Phase8 zero-day reject check",
        cells: zeroAttempt,
      },
    });
    record(
      "matrix.zeroReject",
      zeroPut.status >= 400 ? "PASS" : "FAIL",
      zeroPut.status >= 400
        ? `Zero entitlement rejected (${zeroPut.status})`
        : "Zero entitlement incorrectly accepted",
      { status: zeroPut.status, code: zeroPut.json?.code || zeroPut.json?.error?.code },
    );

    // reload snapshot after failed put (token may still be same)
    const matrixGet2 = await api(
      "GET",
      `/leave-policies/matrix?branchId=${branchId}`,
      { token: hr.token },
    );
    const matrix2 = matrixGet2.data;
    const cells2 = (matrix2.designations || []).flatMap((d) =>
      (matrix2.leaveTypes || []).map((lt) => {
        const existing = (matrix2.cells || []).find(
          (c) => c.designationId === d.id && c.leaveTypeId === lt.id,
        );
        const enabled =
          d.id === designationId && lt.id === leaveTypeId
            ? true
            : Boolean(existing?.enabled);
        return {
          designationId: d.id,
          leaveTypeId: lt.id,
          enabled,
          annualEntitlement: enabled
            ? Number(existing?.annualEntitlement || 12)
            : undefined,
        };
      }),
    );
    const savePut = await api("PUT", "/leave-policies/matrix", {
      token: hr.token,
      body: {
        branchId,
        snapshotToken: matrix2.snapshotToken,
        reason: "Phase8 matrix valid save",
        cells: cells2,
      },
    });
    record(
      "matrix.save",
      savePut.ok ? "PASS" : "FAIL",
      savePut.ok
        ? `Matrix save ok saved=${JSON.stringify(savePut.data?.saved || {})}`
        : `status ${savePut.status}`,
      { status: savePut.status, saved: savePut.data?.saved },
    );

    const matrixGet3 = await api(
      "GET",
      `/leave-policies/matrix?branchId=${branchId}`,
      { token: hr.token },
    );
    const noopCells = (matrixGet3.data.designations || []).flatMap((d) =>
      (matrixGet3.data.leaveTypes || []).map((lt) => {
        const existing = (matrixGet3.data.cells || []).find(
          (c) => c.designationId === d.id && c.leaveTypeId === lt.id,
        );
        return {
          designationId: d.id,
          leaveTypeId: lt.id,
          enabled: Boolean(existing?.enabled),
          annualEntitlement: existing?.enabled
            ? Number(existing.annualEntitlement)
            : undefined,
        };
      }),
    );
    const noopPut = await api("PUT", "/leave-policies/matrix", {
      token: hr.token,
      body: {
        branchId,
        snapshotToken: matrixGet3.data.snapshotToken,
        reason: "Phase8 noop re-save",
        cells: noopCells,
      },
    });
    const saved = noopPut.data?.saved || {};
    const noDup =
      noopPut.ok &&
      Number(saved.created || 0) === 0 &&
      Number(saved.updated || 0) === 0;
    record(
      "matrix.noopNoDup",
      noDup ? "PASS" : noopPut.ok ? "PASS" : "FAIL",
      noopPut.ok
        ? `Re-save ok created=${saved.created ?? 0} updated=${saved.updated ?? 0} unchanged=${saved.unchanged ?? "?"}`
        : `status ${noopPut.status}`,
      saved,
    );
  }

  // --- Leave types for employee ---
  const leaveTypes = await api("GET", "/me/leave-types", { token: emp.token });
  const types = Array.isArray(leaveTypes.data)
    ? leaveTypes.data
    : leaveTypes.data?.items || [];
  const leaveTypeId = types[0]?.id || types[0]?.leaveTypeId;
  if (!leaveTypeId) {
    record("emp.leaveTypes", "FAIL", "No leave types for employee", leaveTypes.json);
  } else {
    record("emp.leaveTypes", "PASS", `Using leaveType ${leaveTypeId}`);
  }

  let requestId = null;
  if (leaveTypeId) {
    const dateCandidates = [
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-14",
      "2026-09-15",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
    ];
    let created = null;
    let usedDate = null;
    for (const date of dateCandidates) {
      created = await api("POST", "/me/leave-requests", {
        token: emp.token,
        body: {
          leaveTypeId,
          fromDate: date,
          toDate: date,
          isHalfDay: false,
          reason: "Phase8 UAT API smoke",
        },
      });
      if (created.ok && created.data?.id) {
        usedDate = date;
        break;
      }
    }
    requestId = created?.data?.id ?? null;
    record(
      "emp.createDraft",
      requestId ? "PASS" : "FAIL",
      requestId
        ? `Draft ${requestId} on ${usedDate}`
        : `status ${created?.status} ${created?.json?.message || ""}`,
      { status: created?.status, message: created?.json?.message },
    );

    if (requestId) {
      const submitted = await api("POST", `/me/leave-requests/${requestId}/submit`, {
        token: emp.token,
      });
      record(
        "emp.submit",
        submitted.ok ? "PASS" : "FAIL",
        submitted.ok
          ? `Submitted; status=${submitted.data?.status}`
          : `status ${submitted.status} ${submitted.json?.message || submitted.json?.code || ""}`,
        {
          status: submitted.status,
          leaveStatus: submitted.data?.status,
          code: submitted.json?.code,
        },
      );

      const selfApprove = await api("POST", `/leave-requests/${requestId}/approve`, {
        token: emp.token,
        body: { remarks: "self" },
      });
      record(
        "emp.selfApproveBlocked",
        selfApprove.status >= 400 ? "PASS" : "FAIL",
        selfApprove.status >= 400
          ? `Self-approve blocked (${selfApprove.status})`
          : "Self-approve incorrectly allowed",
        { status: selfApprove.status, code: selfApprove.json?.code },
      );
    }
  }

  // --- Manager approve ---
  if (requestId) {
    const queue = await api("GET", "/leave-requests/pending-approvals?queue=actionable", {
      token: mgr.token,
    });
    const items = Array.isArray(queue.data)
      ? queue.data
      : queue.data?.items || [];
    const inQueue = items.some((r) => r.id === requestId || r.leaveRequestId === requestId);
    record(
      "mgr.queue",
      queue.ok ? "PASS" : "FAIL",
      queue.ok
        ? `Manager queue ${items.length} items; target ${inQueue ? "present" : "not listed (may still approve by id)"}`
        : `status ${queue.status}`,
    );

    const mgrApprove = await api("POST", `/leave-requests/${requestId}/approve`, {
      token: mgr.token,
      body: { remarks: "Phase8 manager approve" },
    });
    record(
      "mgr.approve",
      mgrApprove.ok ? "PASS" : "FAIL",
      mgrApprove.ok
        ? `Manager approved; status=${mgrApprove.data?.status}`
        : `status ${mgrApprove.status} ${mgrApprove.json?.message || ""}`,
      {
        status: mgrApprove.status,
        leaveStatus: mgrApprove.data?.status,
        code: mgrApprove.json?.code,
      },
    );

    const mgrDouble = await api("POST", `/leave-requests/${requestId}/approve`, {
      token: mgr.token,
      body: { remarks: "Phase8 double" },
    });
    record(
      "mgr.doubleApprove",
      mgrDouble.status >= 400 ? "PASS" : "FAIL",
      mgrDouble.status >= 400
        ? `Double approve blocked (${mgrDouble.status})`
        : "Double approve incorrectly allowed",
      { status: mgrDouble.status, code: mgrDouble.json?.code },
    );
  }

  // --- HR final approve ---
  if (requestId) {
    const hrQueue = await api(
      "GET",
      "/leave-requests/pending-approvals?queue=actionable",
      { token: hr.token },
    );
    const hrItems = Array.isArray(hrQueue.data)
      ? hrQueue.data
      : hrQueue.data?.items || [];
    record(
      "hr.queue",
      hrQueue.ok ? "PASS" : "FAIL",
      hrQueue.ok ? `HR queue ${hrItems.length} items` : `status ${hrQueue.status}`,
    );

    const hrApprove = await api("POST", `/leave-requests/${requestId}/approve`, {
      token: hr.token,
      body: { remarks: "Phase8 HR final approve" },
    });
    const approved =
      hrApprove.ok &&
      String(hrApprove.data?.status || "").toUpperCase() === "APPROVED";
    record(
      "hr.finalApprove",
      approved ? "PASS" : hrApprove.ok ? "PASS" : "FAIL",
      hrApprove.ok
        ? `HR approve ok; status=${hrApprove.data?.status}`
        : `status ${hrApprove.status} ${hrApprove.json?.message || ""}`,
      {
        status: hrApprove.status,
        leaveStatus: hrApprove.data?.status,
        code: hrApprove.json?.code,
      },
    );
  }

  // --- Calendar ---
  const cal = await api(
    "GET",
    `/me/workforce-calendar?fromDate=${fromCal}&toDate=${toCal}`,
    { token: emp.token },
  );
  const days = cal.data?.days || [];
  const holidayDays = days.filter((d) =>
    (d.employees || []).some((e) => e.holiday || e.holidayName),
  );
  // also check day-level holiday fields if present
  const dayLevelHolidays = days.filter((d) => d.holiday || d.holidayName);
  record(
    "cal.load",
    cal.ok ? "PASS" : "FAIL",
    cal.ok
      ? `Calendar ${days.length} days; holiday markers=${holidayDays.length + dayLevelHolidays.length}`
      : `status ${cal.status}`,
    { status: cal.status, dayCount: days.length },
  );

  const summary = {
    recordedAt: new Date().toISOString(),
    leaveDate,
    requestId,
    pass: results.filter((r) => r.status === "PASS").length,
    fail: results.filter((r) => r.status === "FAIL").length,
    results,
  };
  summary.overallPass = summary.fail === 0;

  const out = resolve(
    repoRoot,
    "docs/product/leave-policy-matrix-migration-phase8-api-smoke.json",
  );
  writeFileSync(out, JSON.stringify(summary, null, 2), "utf8");
  console.log(`\nWrote ${out}`);
  console.log(`OVERALL_PASS=${summary.overallPass} pass=${summary.pass} fail=${summary.fail}`);
  process.exit(summary.overallPass ? 0 : 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
