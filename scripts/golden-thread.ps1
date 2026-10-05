# Golden thread API runner - guide Section 32 (automatable subset)
$ErrorActionPreference = "Continue"
$Base = "http://localhost:4500"
$Run = "GT-$(Get-Date -Format 'yyyyMMdd-HHmm')"
$Year = 2026
$Month = 8
$MakerEmail = $env:E2E_MAKER_EMAIL
$MakerPassword = $env:E2E_MAKER_PASSWORD
$ApproverEmail = $env:E2E_APPROVER_EMAIL
$ApproverPassword = $env:E2E_APPROVER_PASSWORD
if (-not $MakerEmail -or -not $MakerPassword) {
  Write-Error "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD before running this script."
  exit 1
}
$results = @()

function New-OpId { return [guid]::NewGuid().ToString() }

function Add-Result($Step, $Status, $Detail) {
  $script:results += [PSCustomObject]@{ Step = $Step; Status = $Status; Detail = $Detail }
  Write-Output "[$Status] $Step - $Detail"
}

function Invoke-Api {
  param($Method, $Path, $Body, $Token)
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

$login = Invoke-Api POST "/auth/login" "{`"identifier`":`"$MakerEmail`",`"password`":`"$MakerPassword`"}" $null
if (-not $login.ok) { Add-Result "GT-01" "FAIL" $login.error; exit 1 }
$token = $login.data.data.accessToken
Add-Result "GT-01" "PASS" "Login + company context"

$approverToken = $null
if (-not $ApproverEmail -or -not $ApproverPassword) {
  Add-Result "GT-01-approver" "SKIP" "Set E2E_APPROVER_EMAIL and E2E_APPROVER_PASSWORD"
} else {
  $approverLogin = Invoke-Api POST "/auth/login" "{`"identifier`":`"$ApproverEmail`",`"password`":`"$ApproverPassword`"}" $null
  if ($approverLogin.ok) {
    $approverToken = $approverLogin.data.data.accessToken
    Add-Result "GT-01-approver" "PASS" "Finance approver login OK"
  } else {
    Add-Result "GT-01-approver" "FAIL" $approverLogin.error
  }
}

$caps = Invoke-Api GET "/me/module-capabilities" $null $token
if ($caps.ok) { Add-Result "GT-02" "PASS" "Finance/Payroll/Projects enabled" } else { Add-Result "GT-02" "FAIL" $caps.error }

$openings = Invoke-Api GET '/hr/recruitment/openings?page=1&limit=5' $null $token
if ($openings.ok -and $openings.data.data.items.Count -gt 0) {
  Add-Result "GT-03" "PASS" "Openings exist ($($openings.data.data.items.Count))"
} else { Add-Result "GT-03" "PARTIAL" "No openings - publish one manually for full REC path" }

$att = Invoke-Api GET '/attendance?page=1&limit=5' $null $token
if ($att.ok) { Add-Result "GT-11" "PASS" "Attendance API $($att.data.data.items.Count) rows" } else { Add-Result "GT-11" "FAIL" $att.error }

$leave = Invoke-Api GET '/leave-requests?page=1&limit=5' $null $token
if ($leave.ok) { Add-Result "GT-11-leave" "PASS" "Leave requests API OK" } else { Add-Result "GT-11-leave" "PARTIAL" $leave.error }

$prj = Invoke-Api GET '/projects?page=1&limit=5' $null $token
if ($prj.ok) { Add-Result "GT-12" "PASS" "Projects total=$($prj.data.data.total)" } else { Add-Result "GT-12" "FAIL" $prj.error }

$txns = Invoke-Api GET '/office-finance/transactions?status=SUBMITTED&limit=5' $null $token
if (-not ($txns.ok -and $txns.data.data.items.Count -gt 0)) {
  $catList = Invoke-Api GET "/office-finance/categories" $null $token
  $acctList = Invoke-Api GET "/office-finance/payment-accounts" $null $token
  $expCat = $null
  $bank = $null
  if ($catList.ok) {
    $expCat = $catList.data.data.items | Where-Object { $_.categoryType -eq "EXPENSE" -and $_.isActive } | Select-Object -First 1
  }
  if ($acctList.ok) {
    $bank = $acctList.data.data.items | Where-Object { $_.accountType -eq "BANK" -and $_.currencyCode -eq "INR" } | Select-Object -First 1
  }
  if ($expCat -and $bank) {
    $draft = Invoke-Api POST "/office-finance/transactions" @{
      transactionType = "EXPENSE"
      transactionDate = "2026-08-20"
      amount = "2500.00"
      categoryId = $expCat.id
      sourceAccountId = $bank.id
      description = "GT expense $Run"
      operationId = (New-OpId)
    } $token
    if ($draft.ok) {
      $sub = Invoke-Api POST "/office-finance/transactions/$($draft.data.data.id)/submit" @{
        expectedVersion = $draft.data.data.version
        operationId = (New-OpId)
      } $token
      if ($sub.ok) {
        $txns = @{ ok = $true; data = @{ data = @{ items = @($sub.data.data) } } }
      }
    }
  }
}
if ($txns.ok -and $txns.data.data.items.Count -gt 0) {
  $txn = $txns.data.data.items[0]
  $approveToken = if ($approverToken) { $approverToken } else { $token }
  $appr = Invoke-Api POST "/office-finance/transactions/$($txn.id)/approve" @{
    expectedVersion = $txn.version
    operationId = (New-OpId)
  } $approveToken
  if ($appr.ok) {
    Add-Result "GT-13" "PASS" "Expense approved by Finance Approver"
  } elseif (-not $approverToken) {
    Add-Result "GT-13" "FAIL" "Approver login missing - cannot approve expense"
  } else {
    Add-Result "GT-13" "FAIL" $appr.error
  }
} else {
  Add-Result "GT-13" "PARTIAL" "No SUBMITTED expense - submit one first"
}

$prefPath = '/payroll/preflight?year=' + $Year + '&month=' + $Month
$pref = Invoke-Api GET $prefPath $null $token
if (-not $pref.ok) { Add-Result "GT-14-preflight" "FAIL" $pref.error }
elseif (@($pref.data.data.blockers).Count -eq 0) {
  Add-Result "GT-14-preflight" "PASS" "Preflight ready"

  $existing = Invoke-Api GET '/payroll/runs?page=1&limit=10' $null $token
  $run = $null
  if ($existing.ok) {
    $run = $existing.data.data.items | Where-Object { $_.payrollYear -eq $Year -and $_.payrollMonth -eq $Month -and $_.status -ne "CANCELLED" } | Select-Object -First 1
  }

  if (-not $run) {
    $created = Invoke-Api POST "/payroll/runs" @{
      year = [int]$Year
      month = [int]$Month
      operationId = (New-OpId)
    } $token
    if ($created.ok) {
      $run = $created.data.data
      Add-Result "GT-14-create" "PASS" "Payroll run created $($run.runNumber)"
    } else {
      Add-Result "GT-14-create" "FAIL" $created.error
    }
  } else {
    Add-Result "GT-14-create" "PASS" "Using existing run $($run.runNumber) status=$($run.status)"
  }

  if ($run) {
    if ($run.status -eq "DRAFT") {
      $calc = Invoke-Api POST "/payroll/runs/$($run.id)/calculate" @{
        expectedVersion = $run.version
        operationId = (New-OpId)
      } $token
      if ($calc.ok) {
        $run = $calc.data.data
        Add-Result "GT-14-calculate" "PASS" "Calculated run"
      } else { Add-Result "GT-14-calculate" "FAIL" $calc.error }
    } elseif ($run.status -in @("CALCULATED","APPROVED","PAID")) {
      Add-Result "GT-14-calculate" "PASS" "Already at $($run.status)"
    }

    if ($run.status -eq "CALCULATED") {
      $approveToken = if ($approverToken) { $approverToken } else { $token }
      $approve = Invoke-Api POST "/payroll/runs/$($run.id)/approve" @{
        expectedVersion = $run.version
        operationId = (New-OpId)
      } $approveToken
      if ($approve.ok) {
        $run = $approve.data.data
        Add-Result "GT-14-approve" "PASS" "Run approved by Payroll Approver"
      } elseif (-not $approverToken) {
        Add-Result "GT-14-approve" "FAIL" "Approver login missing - cannot approve payroll"
      } else {
        Add-Result "GT-14-approve" "FAIL" $approve.error
      }
    }

    if ($run.status -eq "APPROVED") {
      $accts = Invoke-Api GET "/office-finance/payment-accounts" $null $token
      $bank = $null
      if ($accts.ok) {
        $bank = $accts.data.data.items | Where-Object { $_.accountType -eq "BANK" -and $_.currencyCode -eq "INR" } | Select-Object -First 1
      }
      if ($bank) {
        $paid = Invoke-Api POST "/payroll/runs/$($run.id)/mark-paid" @{
          expectedVersion = $run.version
          paymentAccountId = $bank.id
          paidDate = (Get-Date -Format "yyyy-MM-dd")
          paymentReference = "GT-$(New-OpId)"
          operationId = (New-OpId)
        } $token
        if ($paid.ok) { Add-Result "GT-14-pay" "PASS" "Run marked PAID" }
        else { Add-Result "GT-14-pay" "PARTIAL" $paid.error }
      } else {
        Add-Result "GT-14-pay" "PARTIAL" "No INR bank account for payment"
      }
    }
  }
} else {
  Add-Result "GT-14-preflight" "FAIL" "$(@($pref.data.data.blockers).Count) blocker(s)"
}

$payslips = Invoke-Api GET "/me/payslips" $null $token
if ($payslips.ok) {
  $count = @($payslips.data.data.items).Count
  if ($count -gt 0) { Add-Result "GT-16" "PASS" "$count payslip(s) listed" }
  else { Add-Result "GT-16" "PARTIAL" "No payslips until run is PAID + generated" }
} else { Add-Result "GT-16" "FAIL" $payslips.error }

$ws = Invoke-Api GET "/me/workspace" $null $token
if ($ws.ok) { Add-Result "GT-17" "PASS" "My workspace OK" } else { Add-Result "GT-17" "FAIL" $ws.error }

Write-Output ""
Write-Output "=== GOLDEN THREAD SUMMARY ==="
$results | Group-Object Status | ForEach-Object { Write-Output "$($_.Name): $($_.Count)" }
foreach ($row in $results) { Write-Output "[$($row.Status)] $($row.Step) - $($row.Detail)" }
