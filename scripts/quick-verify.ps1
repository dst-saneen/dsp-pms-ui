$ErrorActionPreference = "Continue"
$Base = "http://localhost:4500"

function Test-Endpoint($Name, $ScriptBlock) {
  try {
    $result = & $ScriptBlock
    Write-Output "[$Name] PASS - $result"
  } catch {
    $msg = $_.ErrorDetails.Message
    if (-not $msg -and $_.Exception.Response) {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $msg = $sr.ReadToEnd()
    }
    Write-Output "[$Name] FAIL - $msg"
  }
}

if (-not $env:E2E_MAKER_EMAIL -or -not $env:E2E_MAKER_PASSWORD) {
  Write-Error "Set E2E_MAKER_EMAIL and E2E_MAKER_PASSWORD before running this script."
  exit 1
}
$loginBody = @{ identifier = $env:E2E_MAKER_EMAIL; password = $env:E2E_MAKER_PASSWORD } | ConvertTo-Json -Compress
$login = Invoke-RestMethod -Uri "$Base/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$token = $login.data.accessToken
$h = @{ Authorization = "Bearer $token" }

Test-Endpoint "PRE-002" { (Invoke-RestMethod -Uri "$Base/health/live").status }
Test-Endpoint "CFG-001" {
  $c = Invoke-RestMethod -Uri "$Base/me/module-capabilities" -Headers $h
  "finance=$($c.data.officeFinanceNav) payroll=$($c.data.payrollNav) projects=$($c.data.projectsNav)"
}
Test-Endpoint "FIN-001" {
  $f = Invoke-RestMethod -Uri "$Base/office-finance/settings" -Headers $h
  "currency=$($f.data.baseCurrencyCode) v=$($f.data.version)"
}
Test-Endpoint "PAY-004" {
  $p = Invoke-RestMethod -Uri "$Base/payroll/preflight?year=2026&month=8" -Headers $h
  "ready=$($p.data.isReady) blockers=$($p.data.blockers.Count)"
}
Test-Endpoint "WRK-001" {
  $w = Invoke-RestMethod -Uri "$Base/me/workspace" -Headers $h
  "employeeId=$($w.data.employeeId)"
}
Test-Endpoint "PRJ-002" {
  $p = Invoke-RestMethod -Uri "$Base/projects?page=1&limit=5" -Headers $h
  "total=$($p.data.total)"
}
Test-Endpoint "ATT-001" {
  $a = Invoke-RestMethod -Uri "$Base/attendance?page=1&limit=5" -Headers $h
  "items=$($a.data.items.Count)"
}
