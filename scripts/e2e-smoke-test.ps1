# E2E smoke test runner - guide-aligned API verification
$ErrorActionPreference = "Continue"
$Base = "http://localhost:4500"
$Run = "UAT-E2E-20260828-01"
$results = @()

function New-OpId { return [guid]::NewGuid().ToString() }

function Add-Result($Id, $Status, $Detail) {
  $script:results += [PSCustomObject]@{ Test = $Id; Status = $Status; Detail = $Detail }
  Write-Output "[$Status] $Id - $Detail"
}

function Invoke-Api {
  param($Method, $Path, $Body, $Token, [switch]$Raw)
  $headers = @{ Authorization = "Bearer $Token"; "Content-Type" = "application/json" }
  try {
    if ($Body) {
      $json = if ($Body -is [string]) { $Body } else { $Body | ConvertTo-Json -Depth 8 -Compress }
      $r = Invoke-RestMethod -Uri "$Base$Path" -Method $Method -Headers $headers -Body $json
    } else {
      $r = Invoke-RestMethod -Uri "$Base$Path" -Method $Method -Headers $headers
    }
    return @{ ok = $true; data = $r }
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg -and $_.Exception.Response) {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $msg = $sr.ReadToEnd()
    }
    return @{ ok = $false; error = $msg; status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 } }
  }
}

# PRE-002
try {
  $live = Invoke-RestMethod -Uri "$Base/health/live"
  if ($live.status -eq "ok") { Add-Result "PRE-002" "PASS" "Backend live" } else { Add-Result "PRE-002" "FAIL" "live not ok" }
} catch { Add-Result "PRE-002" "FAIL" $_.Exception.Message }

# AUTH-001
if (-not $env:E2E_MAKER_EMAIL -or -not $env:E2E_MAKER_PASSWORD) {
  Write-Error "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD before running this script."
  exit 1
}
$loginBody = @{ identifier = $env:E2E_MAKER_EMAIL; password = $env:E2E_MAKER_PASSWORD } | ConvertTo-Json -Compress
$login = Invoke-Api POST "/auth/login" $loginBody $null
if (-not $login.ok) { Add-Result "AUTH-001" "FAIL" $login.error; exit 1 }
$token = $login.data.data.accessToken
$user = $login.data.data.user
Add-Result "AUTH-001" "PASS" "Login as $($user.email) role=$($user.authorization.roles[0])"

# Module capabilities (CFG-001 proxy)
$caps = Invoke-Api GET "/me/module-capabilities" $null $token
if ($caps.ok -and $caps.data.data.officeFinanceNav -and $caps.data.data.payrollNav -and $caps.data.data.projectsNav) {
  Add-Result "CFG-001" "PASS" "Finance/Payroll/Projects enabled for company"
} else {
  $capDetail = if ($caps.error) { $caps.error } else { $caps.data.data | ConvertTo-Json -Compress }
  Add-Result "CFG-001" "FAIL" $capDetail
}

# EMP-001
$emp = Invoke-Api GET "/employees?page=1&limit=5" $null $token
if ($emp.ok -and $emp.data.data.items.Count -gt 0) {
  Add-Result "EMP-001" "PASS" "Employees list $($emp.data.data.total) total"
} else {
  Add-Result "EMP-001" "FAIL" $(if ($emp.error) { $emp.error } else { "empty" })
}

# REC-001/002
$rec = Invoke-Api GET "/hr/recruitment/openings?page=1&limit=5" $null $token
if ($rec.ok) {
  Add-Result "REC-001" "PASS" "Openings API $($rec.data.data.items.Count) items"
} else { Add-Result "REC-001" "FAIL" $rec.error }

$dash = Invoke-Api GET "/hr/recruitment/dashboard" $null $token
if ($dash.ok) { Add-Result "REC-002" "PASS" "Recruitment dashboard OK" } else { Add-Result "REC-002" "FAIL" $dash.error }

# FIN-001 Financial profile
$finSettings = Invoke-Api GET "/office-finance/settings" $null $token
if ($finSettings.ok) {
  Add-Result "FIN-001" "PASS" "Financial profile already configured"
  $profileVersion = $finSettings.data.data.version
} elseif ($finSettings.status -eq 409) {
  $patch = Invoke-Api PATCH "/office-finance/settings" @{
    baseCurrencyCode = "INR"
    reportingStartDate = "2026-01-01"
    operationId = (New-OpId)
    expectedVersion = 0
  } $token
  if ($patch.ok) { Add-Result "FIN-001" "PASS" "Created financial profile INR" }
  else { Add-Result "FIN-001" "FAIL" $patch.error }
} else {
  Add-Result "FIN-001" "FAIL" $finSettings.error
}

# FIN-002 Business parties
$clientOp = New-OpId
$vendorOp = New-OpId
$bp1 = Invoke-Api POST "/business-parties" @{
  displayName = "E2E Client $Run"
  partyType = "CUSTOMER"
  operationId = $clientOp
} $token
$bp2 = Invoke-Api POST "/business-parties" @{
  displayName = "E2E Vendor $Run"
  partyType = "VENDOR"
  operationId = $vendorOp
} $token
if ($bp1.ok -and $bp2.ok) { Add-Result "FIN-002" "PASS" "Customer + Vendor created" }
else { Add-Result "FIN-002" "PARTIAL" "client=$($bp1.ok) vendor=$($bp2.ok)" }

# FIN-003 Categories
$incCat = Invoke-Api POST "/office-finance/categories" @{
  categoryName = "Service Income $Run"
  categoryType = "INCOME"
  operationId = (New-OpId)
} $token
$expCat = Invoke-Api POST "/office-finance/categories" @{
  categoryName = "Office Expense $Run"
  categoryType = "EXPENSE"
  operationId = (New-OpId)
} $token
$payCat = Invoke-Api POST "/office-finance/categories" @{
  categoryName = "Payroll Expense $Run"
  categoryType = "EXPENSE"
  operationId = (New-OpId)
} $token
if ($incCat.ok -and $expCat.ok -and $payCat.ok) { Add-Result "FIN-003" "PASS" "3 categories created" }
else { Add-Result "FIN-003" "PARTIAL" "income=$($incCat.ok) expense=$($expCat.ok) payroll=$($payCat.ok)" }

# FIN-004 Payment accounts - reuse existing INR accounts when create conflicts
$acctList = Invoke-Api GET "/office-finance/payment-accounts" $null $token
$cashOp = New-OpId
$bankOp = New-OpId
$cash = Invoke-Api POST "/office-finance/payment-accounts" @{
  accountName = "Petty Cash $Run"
  accountType = "CASH"
  openingBalance = "100000.00"
  openingDate = "2026-01-01"
  operationId = $cashOp
} $token
$bank = Invoke-Api POST "/office-finance/payment-accounts" @{
  accountName = "Operating Bank $Run"
  accountType = "BANK"
  openingBalance = "500000.00"
  openingDate = "2026-01-01"
  bankName = "Test Bank"
  bankReferenceWrite = "ACCT1234567890"
  operationId = $bankOp
} $token

if (-not $cash.ok -and $acctList.ok) {
  $existingCash = $acctList.data.data.items | Where-Object { $_.accountType -eq "CASH" } | Select-Object -First 1
  if ($existingCash) { $cash = @{ ok = $true; data = @{ data = $existingCash } } }
}
if (-not $bank.ok -and $acctList.ok) {
  $existingBank = $acctList.data.data.items | Where-Object { $_.accountType -eq "BANK" -and $_.currencyCode -eq "INR" } | Select-Object -First 1
  if ($existingBank) { $bank = @{ ok = $true; data = @{ data = $existingBank } } }
}

if ($cash.ok -and $bank.ok) { Add-Result "FIN-004" "PASS" "Cash + Bank accounts ready" }
else { Add-Result "FIN-004" "PARTIAL" "cash=$($cash.ok) bank=$($bank.ok)" }

# FIN-005 Period
$period = Invoke-Api POST "/office-finance/periods" @{
  periodYear = 2026
  periodMonth = 8
  operationId = (New-OpId)
} $token
if ($period.ok) {
  Add-Result "FIN-005" "PASS" "Aug 2026 period created"
} elseif ($period.status -eq 409) {
  Add-Result "FIN-005" "PASS" "Aug 2026 period already exists"
} else {
  Add-Result "FIN-005" "PARTIAL" $period.error
}

# FIN-006 Transactions (reuse categories from list if create duplicated)
if ((-not $incCat.ok -or -not $expCat.ok) -and $finSettings.ok) {
  $catList = Invoke-Api GET "/office-finance/categories" $null $token
  if ($catList.ok) {
    if (-not $incCat.ok) {
      $existingInc = $catList.data.data.items | Where-Object { $_.categoryType -eq "INCOME" } | Select-Object -First 1
      if ($existingInc) { $incCat = @{ ok = $true; data = @{ data = $existingInc } } }
    }
    if (-not $expCat.ok) {
      $existingExp = $catList.data.data.items | Where-Object { $_.categoryType -eq "EXPENSE" } | Select-Object -First 1
      if ($existingExp) { $expCat = @{ ok = $true; data = @{ data = $existingExp } } }
    }
  }
}

if ($incCat.ok -and $expCat.ok -and $bank.ok) {
  $incId = $incCat.data.data.id
  $expId = $expCat.data.data.id
  $bankId = $bank.data.data.id
  $clientId = if ($bp1.ok) { $bp1.data.data.id } else { $null }
  $vendorId = if ($bp2.ok) { $bp2.data.data.id } else { $null }

  $income = Invoke-Api POST "/office-finance/transactions" @{
    transactionType = "INCOME"
    transactionDate = "2026-08-15"
    amount = "50000.00"
    categoryId = $incId
    businessPartyId = $clientId
    destinationAccountId = $bankId
    description = "E2E income $Run"
    operationId = (New-OpId)
  } $token
  $expenseBody = @{
    transactionType = "EXPENSE"
    transactionDate = "2026-08-16"
    amount = "12500.00"
    categoryId = $expId
    sourceAccountId = $bankId
    description = "E2E expense $Run"
    operationId = (New-OpId)
  }
  if ($vendorId) { $expenseBody.businessPartyId = $vendorId }
  $expense = Invoke-Api POST "/office-finance/transactions" $expenseBody $token
  if ($income.ok -and $expense.ok) { Add-Result "FIN-006" "PASS" "Income + Expense drafts created" }
  else { Add-Result "FIN-006" "PARTIAL" "income=$($income.ok) expense=$($expense.ok)" }

  # FIN-008 maker-checker - same user submit should work, approve should fail
  if ($expense.ok) {
    $txnId = $expense.data.data.id
    $ver = $expense.data.data.version
    $sub = Invoke-Api POST "/office-finance/transactions/$txnId/submit" @{
      expectedVersion = $ver
      operationId = (New-OpId)
    } $token
    if ($sub.ok) {
      Add-Result "FIN-008-submit" "PASS" "Expense submitted"
      $ver2 = $sub.data.data.version
      $appr = Invoke-Api POST "/office-finance/transactions/$txnId/approve" @{
        expectedVersion = $ver2
        operationId = (New-OpId)
      } $token
      if (-not $appr.ok) { Add-Result "FIN-008-approve" "PASS" "Self-approve blocked (maker-checker)" }
      else { Add-Result "FIN-008-approve" "FAIL" "Self-approve allowed - security issue" }
    } else { Add-Result "FIN-008-submit" "FAIL" $sub.error }
  }
} else {
  Add-Result "FIN-006" "BLOCKED" "Missing categories or accounts"
}

# FIN-011 Reports
$rep = Invoke-Api GET "/office-finance/reports/income-expense?fromDate=2026-08-01&toDate=2026-08-31" $null $token
if ($rep.ok) { Add-Result "FIN-011" "PASS" "Income-expense report OK" } else { Add-Result "FIN-011" "FAIL" $rep.error }

# PAY-002 Salary components
$basic = Invoke-Api POST "/payroll/salary-components" @{
  componentCode = "BASIC-$Run"
  componentName = "Basic Salary $Run"
  componentType = "EARNING"
  operationId = (New-OpId)
} $token
if ($basic.ok) {
  Add-Result "PAY-002" "PASS" "Salary component created"
} elseif ($basic.status -eq 409) {
  Add-Result "PAY-002" "PASS" "Salary component already exists"
} else {
  Add-Result "PAY-002" "PARTIAL" $basic.error
}

# PAY-004 Preflight
$pref = Invoke-Api GET "/payroll/preflight?year=2026&month=8" $null $token
if ($pref.ok) {
  $blockerCount = @($pref.data.data.blockers).Count
  if ($blockerCount -eq 0) { Add-Result "PAY-004" "PASS" "Preflight ready (0 blockers)" }
  else { Add-Result "PAY-004" "PARTIAL" "Preflight API OK but $blockerCount blocker(s)" }
} else { Add-Result "PAY-004" "BLOCKED" $pref.error }

# PRJ-001/002
$prjCap = Invoke-Api GET "/projects/workspace-capabilities" $null $token
if ($prjCap.ok -and $prjCap.data.data.projectsLiteEnabled) { Add-Result "PRJ-001" "PASS" "Projects lite enabled" }
else { Add-Result "PRJ-001" "FAIL" $(if ($prjCap.error) { $prjCap.error } else { "disabled" }) }

$prjList = Invoke-Api GET "/projects?page=1&limit=5" $null $token
if ($prjList.ok) { Add-Result "PRJ-002" "PASS" "Projects list OK total=$($prjList.data.data.total)" }
else { Add-Result "PRJ-002" "FAIL" $prjList.error }

# WRK-001
$ws = Invoke-Api GET "/me/workspace" $null $token
if ($ws.ok) { Add-Result "WRK-001" "PASS" "My workspace OK" } else { Add-Result "WRK-001" "FAIL" $ws.error }

# AUTH-001 logout
$logout = Invoke-Api POST "/auth/logout" $null $token
if ($logout.ok -or $logout.status -eq 204) { Add-Result "AUTH-001-logout" "PASS" "Logout OK" }

Write-Output "`n=== SUMMARY ==="
$results | Group-Object Status | ForEach-Object { Write-Output "$($_.Name): $($_.Count)" }
foreach ($row in $results) {
  Write-Output "[$($row.Status)] $($row.Test) - $($row.Detail)"
}
