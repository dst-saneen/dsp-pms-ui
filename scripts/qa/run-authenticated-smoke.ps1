param(
  [ValidateRange(1024, 65535)][int]$BackendPort = 4500,
  [ValidateRange(1024, 65535)][int]$FrontendPort = 3200,
  [switch]$ReuseFrontend,
  [switch]$EnableFinanceTransactionMutation
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$backendDir = Join-Path $repoRoot 'backend'
$frontendDir = Join-Path $repoRoot 'frontend'
$windowsGitPath = 'C:\Program Files\Git\cmd\git.exe'
$gitPath = if (Test-Path -LiteralPath $windowsGitPath -PathType Leaf) {
  $windowsGitPath
}
else {
  (Get-Command git -ErrorAction Stop).Source
}
$pnpmCommandPath = (Get-Command pnpm.cmd -ErrorAction Stop).Source
$pnpmCliPath = Join-Path `
  (Split-Path -Parent $pnpmCommandPath) `
  'node_modules\corepack\dist\pnpm.js'
$nodePath = 'C:\Program Files\nodejs\node.exe'
$npmPath = 'C:\Program Files\nodejs\npm.cmd'
$minimumNodeVersion = [version]'24.20.0'
$maximumNodeVersion = [version]'25.0.0'
$minimumPowerShellVersion = [version]'5.1.0'
$expectedDatabaseName = 'dsp_erp_dev'
$expectedDatabaseUser = 'dscape'
$expectedDatabaseSchema = 'dsp_pms_stg'
$backendOrigin = "http://127.0.0.1:$BackendPort"
$frontendOrigin = if ($ReuseFrontend) {
  "http://localhost:$FrontendPort"
}
else {
  "http://127.0.0.1:$FrontendPort"
}
if ($BackendPort -eq $FrontendPort) {
  throw 'BackendPort and FrontendPort must be different.'
}
$runNonce = [guid]::NewGuid().ToString('N').Substring(0, 8)
$runStamp =
  (Get-Date).ToUniversalTime().ToString('yyyyMMddTHHmmssfffZ') + "-$runNonce"
$evidenceDir = Join-Path $backendDir '.qa-runs'
$qaWorktreeParentDir = Split-Path -Parent $repoRoot
$qaFrontendWorktreeDir = Join-Path `
  $qaWorktreeParentDir `
  ".dsp-erp-authenticated-smoke-$runStamp"
$qaFrontendDir = Join-Path $qaFrontendWorktreeDir 'frontend'
$backendOut = Join-Path $evidenceDir "authenticated-smoke-backend-$runStamp.out.log"
$backendErr = Join-Path $evidenceDir "authenticated-smoke-backend-$runStamp.err.log"
$frontendOut = Join-Path $evidenceDir "authenticated-smoke-frontend-$runStamp.out.log"
$frontendErr = Join-Path $evidenceDir "authenticated-smoke-frontend-$runStamp.err.log"
$playwrightLog = Join-Path $evidenceDir "authenticated-smoke-playwright-$runStamp.log"
$playwrightArtifacts =
  Join-Path $evidenceDir "authenticated-smoke-playwright-$runStamp-artifacts"
$playwrightConfigPath = $null
$environmentNames = @(
  'NODE_ENV',
  'HOST',
  'PORT',
  'REDIS_ENABLED',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_SCHEMA',
  'ALLOW_DESTRUCTIVE_DB_SCRIPTS',
  'QA_STAGING_SENTINEL_KEY',
  'QA_STAGING_CONFIRMATION_TOKEN',
  'QA_REFERENCE_PERSONA_PASSWORD',
  'E2E_MAKER_PASSWORD',
  'E2E_MAKER_EMAIL',
  'PLAYWRIGHT_BASE_URL',
  'PLAYWRIGHT_API_URL',
  'PLAYWRIGHT_LIVE_MUTATIONS',
  'PLAYWRIGHT_FINANCE_MUTATION_CONFIRMATION',
  'QA_RUN_MANIFEST_DIR',
  'PLAYWRIGHT_OUTPUT_DIR',
  'NEXT_PUBLIC_API_URL',
  'BACKEND_INTERNAL_URL'
)
$processEnvironment = [Environment]::GetEnvironmentVariables(
  [EnvironmentVariableTarget]::Process
)
$savedEnvironment = @{}
foreach ($name in $environmentNames) {
  $existingEnvironmentEntry =
    $processEnvironment.GetEnumerator() |
    Where-Object {
      [string]::Equals(
        [string]$_.Key,
        $name,
        [StringComparison]::OrdinalIgnoreCase
      )
    } |
    Select-Object -First 1
  $savedEnvironment[$name] = [pscustomobject]@{
    Exists = $null -ne $existingEnvironmentEntry
    Value = if ($null -ne $existingEnvironmentEntry) {
      $existingEnvironmentEntry.Value
    }
    else {
      $null
    }
  }
}
if (-not (Test-Path -LiteralPath $nodePath -PathType Leaf)) {
  throw "The required Node.js executable was not found at '$nodePath'."
}
if ($PSVersionTable.PSVersion -lt $minimumPowerShellVersion) {
  throw (
    "Authenticated smoke tests require PowerShell >= " +
    "$minimumPowerShellVersion for identity-safe process-tree cleanup."
  )
}
if (-not (Test-Path -LiteralPath $npmPath -PathType Leaf)) {
  throw "The required npm command was not found at '$npmPath'."
}
if (-not (Test-Path -LiteralPath $pnpmCliPath -PathType Leaf)) {
  throw "The required pnpm CLI was not found at '$pnpmCliPath'."
}

$nodeVersionOutput = & $nodePath --version
if ($LASTEXITCODE -ne 0) {
  throw "Unable to read the Node.js version from '$nodePath'."
}
$nodeVersionText = ([string]$nodeVersionOutput).Trim().TrimStart('v')
try {
  $nodeVersion = [version]$nodeVersionText
}
catch {
  throw "Node.js returned an invalid version '$nodeVersionText'."
}
if (
  $nodeVersion -lt $minimumNodeVersion -or
  $nodeVersion -ge $maximumNodeVersion
) {
  throw (
    "Authenticated smoke tests require Node.js >= $minimumNodeVersion " +
    "and < $maximumNodeVersion; '$nodePath' is $nodeVersion."
  )
}

$null = & $npmPath --version
if ($LASTEXITCODE -ne 0) {
  throw "The required npm command at '$npmPath' is not executable."
}

New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null

$personaPassword = $env:QA_REFERENCE_PERSONA_PASSWORD
if ([string]::IsNullOrWhiteSpace($personaPassword)) {
  $randomBytes = [byte[]]::new(48)
  $randomNumberGenerator =
    [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $randomNumberGenerator.GetBytes($randomBytes)
  }
  finally {
    $randomNumberGenerator.Dispose()
  }
  $personaPassword = 'Qa9!' + [Convert]::ToBase64String($randomBytes)
}

if ($personaPassword.Length -lt 12 -or $personaPassword.Length -gt 128) {
  throw 'QA_REFERENCE_PERSONA_PASSWORD must contain between 12 and 128 characters.'
}

$runMutex = $null
$runMutexAcquired = $false
$backendProcess = $null
$frontendProcess = $null
$runError = $null
$cleanupError = $null
$script:qaFrontendWorktreeCreated = $false
$script:testFrontendDir = $frontendDir

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)][string]$WorkingDirectory,
    [Parameter(Mandatory = $true)][string]$Script
  )

  Push-Location $WorkingDirectory
  try {
    & $npmPath run $Script
    if ($LASTEXITCODE -ne 0) {
      throw "npm script '$Script' failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }
}

function Assert-RunnerOwnedWorktreePath {
  $trimCharacters = [char[]]@(
    [System.IO.Path]::DirectorySeparatorChar,
    [System.IO.Path]::AltDirectorySeparatorChar
  )
  $expectedParent = (Resolve-Path -LiteralPath $qaWorktreeParentDir).Path.TrimEnd(
    $trimCharacters
  )
  $actualParent = [System.IO.Path]::GetFullPath(
    (Split-Path -Parent $qaFrontendWorktreeDir)
  ).TrimEnd(
    $trimCharacters
  )
  $leafName = Split-Path -Leaf $qaFrontendWorktreeDir

  if (
    -not [string]::Equals(
      $expectedParent,
      $actualParent,
      [System.StringComparison]::OrdinalIgnoreCase
    ) -or
    -not $leafName.StartsWith(
      '.dsp-erp-authenticated-smoke-',
      [System.StringComparison]::Ordinal
    )
  ) {
    throw 'Refusing to create or remove a frontend worktree outside the runner-owned path.'
  }
}

function New-IsolatedFrontendWorktree {
  if ($ReuseFrontend) {
    return
  }

  Assert-RunnerOwnedWorktreePath
  if (Test-Path -LiteralPath $qaFrontendWorktreeDir) {
    throw "The runner-owned frontend worktree path already exists: $qaFrontendWorktreeDir"
  }

  & $gitPath -C $repoRoot worktree add --detach $qaFrontendWorktreeDir HEAD
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to create the isolated frontend QA worktree.'
  }
  $script:qaFrontendWorktreeCreated = $true

  if (-not (Test-Path -LiteralPath $qaFrontendDir -PathType Container)) {
    throw "The isolated frontend directory was not created at '$qaFrontendDir'."
  }

  # Install from the immutable lockfile inside the worktree. Sharing the
  # developer node_modules tree is not safe: Turbopack rejects an external
  # junction, and a partial local installation must not affect QA evidence.
  Push-Location $qaFrontendDir
  try {
    & $nodePath $pnpmCliPath install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) {
      throw 'Unable to install frozen frontend dependencies in the isolated QA worktree.'
    }
  }
  finally {
    Pop-Location
  }
  $script:testFrontendDir = $qaFrontendDir
}

function Remove-RunnerOwnedWorktreeDirectory {
  if (-not (Test-Path -LiteralPath $qaFrontendWorktreeDir -PathType Container)) {
    return
  }

  Assert-RunnerOwnedWorktreePath
  $worktreeRoot = (Resolve-Path -LiteralPath $qaFrontendWorktreeDir).Path.TrimEnd('\')
  $worktreePrefix = $worktreeRoot + '\'
  $reparsePoints = @(
    Get-ChildItem `
      -LiteralPath $qaFrontendWorktreeDir `
      -Force `
      -Recurse `
      -ErrorAction Stop |
      Where-Object {
        ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
      } |
      Sort-Object { $_.FullName.Length } -Descending
  )

  # pnpm represents package dependencies as junctions. Prove they all stay
  # inside this disposable worktree, then detach the links themselves before
  # recursively removing normal files. This avoids PowerShell following a
  # junction while cleaning an audit worktree on Windows.
  foreach ($reparsePoint in $reparsePoints) {
    foreach ($target in @($reparsePoint.Target)) {
      $targetText = [string]$target
      if ([string]::IsNullOrWhiteSpace($targetText)) {
        throw "Refusing to clean a worktree link without a target: $($reparsePoint.FullName)"
      }
      $normalizedTarget = [System.IO.Path]::GetFullPath($targetText).TrimEnd('\')
      if (-not $normalizedTarget.StartsWith(
        $worktreePrefix,
        [System.StringComparison]::OrdinalIgnoreCase
      )) {
        throw (
          'Refusing to clean a worktree dependency link outside the runner-owned path: ' +
          "$($reparsePoint.FullName) => $normalizedTarget"
        )
      }
    }
  }

  foreach ($reparsePoint in $reparsePoints) {
    if (-not (Test-Path -LiteralPath $reparsePoint.FullName)) {
      continue
    }
    if ($reparsePoint.PSIsContainer) {
      [System.IO.Directory]::Delete($reparsePoint.FullName)
    }
    else {
      [System.IO.File]::Delete($reparsePoint.FullName)
    }
  }

  $remainingReparsePoints = @(
    Get-ChildItem `
      -LiteralPath $qaFrontendWorktreeDir `
      -Force `
      -Recurse `
      -ErrorAction Stop |
      Where-Object {
        ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0
      }
  )
  if ($remainingReparsePoints.Count -gt 0) {
    throw (
      'Refusing to recursively remove the worktree while dependency links remain: ' +
      $remainingReparsePoints.Count
    )
  }

  [System.IO.Directory]::Delete($qaFrontendWorktreeDir, $true)
  if (Test-Path -LiteralPath $qaFrontendWorktreeDir) {
    throw "The isolated frontend QA worktree still exists: $qaFrontendWorktreeDir"
  }
}

function Remove-IsolatedFrontendWorktree {
  if (-not $script:qaFrontendWorktreeCreated) {
    return
  }

  Assert-RunnerOwnedWorktreePath
  # Git recursively removes a worktree before it deregisters its metadata.
  # That recursion cannot reliably remove pnpm's Windows junction layout and
  # can fail with "Directory not empty", leaving a registered worktree behind.
  # Detach only validated, runner-owned links first; Git accepts the now-missing
  # worktree path and removes just its matching administrative entry.
  if (Test-Path -LiteralPath $qaFrontendWorktreeDir) {
    Remove-RunnerOwnedWorktreeDirectory
  }

  & $gitPath -C $repoRoot worktree remove --force $qaFrontendWorktreeDir
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to deregister the isolated frontend QA worktree.'
  }

  $registeredWorktreeLines = @(
    & $gitPath -C $repoRoot worktree list --porcelain
  )
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to verify isolated frontend worktree deregistration.'
  }
  $normalizedWorktreePath = [System.IO.Path]::GetFullPath(
    $qaFrontendWorktreeDir
  ).TrimEnd('\')
  foreach ($line in $registeredWorktreeLines) {
    if (-not $line.StartsWith('worktree ', [System.StringComparison]::Ordinal)) {
      continue
    }
    $listedWorktreePath = [System.IO.Path]::GetFullPath(
      $line.Substring('worktree '.Length)
    ).TrimEnd('\')
    if ([string]::Equals(
      $listedWorktreePath,
      $normalizedWorktreePath,
      [System.StringComparison]::OrdinalIgnoreCase
    )) {
      throw 'The isolated frontend QA worktree remains registered after cleanup.'
    }
  }
  $script:qaFrontendWorktreeCreated = $false
}

function Get-ListeningPortOwners {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  return @(
    Get-NetTCPConnection -State Listen -ErrorAction Stop |
      Where-Object { [int]$_.LocalPort -eq $Port } |
      Select-Object -ExpandProperty OwningProcess -Unique
  )
}

function Assert-PortAvailable {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $owners = @(Get-ListeningPortOwners -Port $Port)
  if ($owners.Count -gt 0) {
    throw (
      "TCP port $Port is already listening (PID(s): " +
      "$($owners -join ', ')). Refusing to reuse an existing service."
    )
  }
}

function Assert-FrontendPortState {
  $owners = @(Get-ListeningPortOwners -Port $FrontendPort)
  if ($ReuseFrontend) {
    if ($owners.Count -eq 0) {
      throw "ReuseFrontend requires an existing listener on TCP port $FrontendPort."
    }
    return
  }

  Assert-PortAvailable -Port $FrontendPort
}

function Assert-LaunchedProcessOwnsPort {
  param(
    [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $Process.Refresh()
  if ($Process.HasExited) {
    throw "$Label exited before it could own TCP port $Port (exit code $($Process.ExitCode))."
  }

  $owners = @(Get-ListeningPortOwners -Port $Port)
  if ($owners.Count -eq 0) {
    throw "$Label is ready but TCP port $Port has no listening owner."
  }

  # The port was proved free immediately before launch and the expected HTTP
  # endpoint has responded while this exact Process handle is alive. Cleanup
  # terminates only this launched process tree.
}

function Stop-LaunchedProcessTree {
  param(
    [Parameter(Mandatory = $true)][System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)][int]$Port,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $Process.Refresh()
  if ($Process.HasExited) {
    $owners = @(Get-ListeningPortOwners -Port $Port)
    throw (
      "$Label exited before identity-safe cleanup; refusing PID-based " +
      "fallback. TCP port $Port owner(s): $($owners -join ', ')."
    )
  }

  if ($PSVersionTable.PSVersion.Major -ge 7) {
    try {
      $Process.Kill($true)
    }
    catch {
      throw "$Label process-tree termination failed: $($_.Exception.Message)"
    }
  }
  else {
    # Windows PowerShell 5.1 runs on .NET Framework and has no Kill(bool)
    # overload. taskkill /T receives only the still-live PID represented by
    # the Process handle above and terminates its descendants as one tree.
    & "$env:SystemRoot\System32\taskkill.exe" `
      /PID $Process.Id `
      /T `
      /F | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw "$Label process-tree termination failed with taskkill exit code $LASTEXITCODE."
    }
  }
  if (-not $Process.WaitForExit(10000)) {
    throw "$Label did not exit within 10 seconds after process-tree termination."
  }

  for ($attempt = 1; $attempt -le 50; $attempt += 1) {
    if (@(Get-ListeningPortOwners -Port $Port).Count -eq 0) {
      return
    }
    Start-Sleep -Milliseconds 200
  }

  $owners = @(Get-ListeningPortOwners -Port $Port)
  throw (
    "$Label process tree did not release TCP port $Port; remaining PID(s): " +
    "$($owners -join ', ')."
  )
}

function Wait-HttpEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Uri,
    [System.Diagnostics.Process]$Process,
    [Parameter(Mandatory = $true)][string]$Label,
    [int]$Attempts = 90
  )

  $lastFailure = $null
  for ($attempt = 1; $attempt -le $Attempts; $attempt += 1) {
    if ($null -ne $Process) {
      $Process.Refresh()
      if ($Process.HasExited) {
        throw (
          "$Label exited while waiting for $Uri " +
          "(exit code $($Process.ExitCode))."
        )
      }
    }

    try {
      $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 2
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        return $response
      }
      $lastFailure = "HTTP $($response.StatusCode)"
    }
    catch {
      $lastFailure = $_.Exception.Message
    }
    if ($attempt -eq $Attempts) {
      throw "Timed out waiting for $Uri. Last failure: $lastFailure"
    }
    Start-Sleep -Seconds 1
  }
}

$runMutex = [System.Threading.Mutex]::new(
  $false,
  'Global\DSP-ERP-Authenticated-Smoke'
)
try {
  $runMutexAcquired = $runMutex.WaitOne(0)
}
catch [System.Threading.AbandonedMutexException] {
  $runMutexAcquired = $true
}
catch {
  $runMutex.Dispose()
  $runMutex = $null
  throw
}
if (-not $runMutexAcquired) {
  $runMutex.Dispose()
  $runMutex = $null
  throw 'Another authenticated smoke run is already active on this host.'
}

try {
  Assert-PortAvailable -Port $BackendPort
  Assert-FrontendPortState

  Invoke-NpmScript -WorkingDirectory $backendDir -Script 'build'

  $env:NODE_ENV = 'development'
  $env:HOST = '127.0.0.1'
  $env:PORT = [string]$BackendPort
  $env:REDIS_ENABLED = 'false'
  $env:DATABASE_NAME = $expectedDatabaseName
  $env:DATABASE_USER = $expectedDatabaseUser
  $env:DATABASE_SCHEMA = $expectedDatabaseSchema
  $env:ALLOW_DESTRUCTIVE_DB_SCRIPTS = 'true'
  $env:QA_STAGING_SENTINEL_KEY = 'DSP-ERP-QA-STAGING'
  $env:QA_STAGING_CONFIRMATION_TOKEN =
    'CONFIRM-QA-WRITES:dsp_erp_dev:dsp_pms_stg'
  $env:QA_REFERENCE_PERSONA_PASSWORD = $personaPassword

  # This read-only audit proves the exact database/user/schema, sentinel and
  # migration lineage used by both the QA writers and the subsequently
  # launched backend process.
  Invoke-NpmScript -WorkingDirectory $backendDir -Script 'qa:staging:audit'
  Assert-PortAvailable -Port $BackendPort
  Assert-FrontendPortState
  Invoke-NpmScript -WorkingDirectory $backendDir -Script 'qa:reference:cleanup-sessions'
  Invoke-NpmScript -WorkingDirectory $backendDir -Script 'qa:reference:rotate'
  Invoke-NpmScript -WorkingDirectory $backendDir -Script 'qa:reference:apply'

  Remove-Item Env:ALLOW_DESTRUCTIVE_DB_SCRIPTS -ErrorAction SilentlyContinue
  Remove-Item Env:QA_STAGING_SENTINEL_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:QA_STAGING_CONFIRMATION_TOKEN -ErrorAction SilentlyContinue
  Remove-Item Env:QA_REFERENCE_PERSONA_PASSWORD -ErrorAction SilentlyContinue

  $env:REDIS_ENABLED = 'false'
  Assert-PortAvailable -Port $BackendPort
  $backendProcess = Start-Process `
    -FilePath $nodePath `
    -ArgumentList 'dist/src/main.js' `
    -WorkingDirectory $backendDir `
    -WindowStyle Hidden `
    -RedirectStandardOutput $backendOut `
    -RedirectStandardError $backendErr `
    -PassThru
  $backendHealthResponse = Wait-HttpEndpoint `
    -Uri "$backendOrigin/health/live" `
    -Process $backendProcess `
    -Label 'Staging backend'
  $backendHealth = $backendHealthResponse.Content | ConvertFrom-Json
  if ($backendHealth.status -ne 'ok') {
    throw "The launched staging backend returned an unexpected liveness identity."
  }
  Assert-LaunchedProcessOwnsPort `
    -Process $backendProcess `
    -Port $BackendPort `
    -Label 'Staging backend'

  $env:NEXT_PUBLIC_API_URL = $backendOrigin
  $env:BACKEND_INTERNAL_URL = $backendOrigin
  if ($ReuseFrontend) {
    Assert-FrontendPortState
    $null = Wait-HttpEndpoint `
      -Uri "$frontendOrigin/login" `
      -Label 'Existing smoke-test frontend'
  }
  else {
    Assert-PortAvailable -Port $FrontendPort
    # Next development servers lock their project's .next directory. The
    # detached worktree provides an independent lock, generated declarations,
    # and cache without touching a developer's existing frontend session.
    New-IsolatedFrontendWorktree
    $frontendProcess = Start-Process `
      -FilePath $nodePath `
      -ArgumentList @(
        'node_modules/next/dist/bin/next',
        'dev',
        '-H',
        '127.0.0.1',
        '-p',
        [string]$FrontendPort
      ) `
      -WorkingDirectory $script:testFrontendDir `
      -WindowStyle Hidden `
      -RedirectStandardOutput $frontendOut `
      -RedirectStandardError $frontendErr `
      -PassThru
    $null = Wait-HttpEndpoint `
      -Uri "$frontendOrigin/login" `
      -Process $frontendProcess `
      -Label 'Smoke-test frontend'
    Assert-LaunchedProcessOwnsPort `
      -Process $frontendProcess `
      -Port $FrontendPort `
      -Label 'Smoke-test frontend'
  }

  # Validate the exact frozen frontend source that the browser is about to
  # exercise. The dev server above generates Next's route declarations in the
  # isolated worktree, so this never reads a developer's partial local install
  # or leaves compiler artifacts in the working branch.
  Invoke-NpmScript -WorkingDirectory $script:testFrontendDir -Script 'typecheck'

  $env:E2E_MAKER_EMAIL = 'qa+india-owner@dsp-reference.invalid'
  $env:E2E_MAKER_PASSWORD = $personaPassword
  $env:PLAYWRIGHT_BASE_URL = $frontendOrigin
  $env:PLAYWRIGHT_API_URL = $backendOrigin
  if ($EnableFinanceTransactionMutation) {
    $env:PLAYWRIGHT_LIVE_MUTATIONS = 'true'
    $env:PLAYWRIGHT_FINANCE_MUTATION_CONFIRMATION =
      'RUN-FINANCE-TRANSACTION:dsp_erp_dev:dsp_pms_stg'
    $env:QA_RUN_MANIFEST_DIR = $evidenceDir
  }
  else {
    $env:PLAYWRIGHT_LIVE_MUTATIONS = 'false'
    Remove-Item `
      Env:PLAYWRIGHT_FINANCE_MUTATION_CONFIRMATION `
      -ErrorAction SilentlyContinue
    Remove-Item Env:QA_RUN_MANIFEST_DIR -ErrorAction SilentlyContinue
  }
  $env:PLAYWRIGHT_OUTPUT_DIR = $playwrightArtifacts

  # The normal Playwright config may reuse an existing development server.
  # The frontend endpoint was verified above. Remove webServer from an exact,
  # temporary config so Playwright never starts another server.
  $playwrightConfigPath = Join-Path `
    $script:testFrontendDir `
    ".authenticated-smoke-$runStamp.config.ts"
  $playwrightConfig = @'
import baseConfig from "./playwright.config";

const { webServer, ...runnerConfig } = baseConfig;
void webServer;

export default runnerConfig;
'@
  [System.IO.File]::WriteAllText(
    $playwrightConfigPath,
    $playwrightConfig,
    [System.Text.UTF8Encoding]::new($false)
  )

  Push-Location $script:testFrontendDir
  try {
    $playwrightArguments = @(
      'node_modules/@playwright/test/cli.js',
      'test',
      "--config=$playwrightConfigPath",
      '--workers=1',
      '--retries=0',
      '--trace=off'
    )
    if ($EnableFinanceTransactionMutation) {
      $playwrightArguments += @(
        'e2e/office-finance-payroll-personas.spec.ts',
        '--project=chromium',
        '--grep',
        'Finance maker and independent approver complete the UI lifecycle to reversal'
      )
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      & $nodePath @playwrightArguments 2>&1 |
        Tee-Object -FilePath $playwrightLog -ErrorAction Stop
      $playwrightExitCode = $LASTEXITCODE
    }
    finally {
      $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($playwrightExitCode -ne 0) {
      throw "Authenticated Playwright smoke tests failed with exit code $playwrightExitCode."
    }
    if (
      -not (Test-Path -LiteralPath $playwrightLog -PathType Leaf) -or
      (Get-Item -LiteralPath $playwrightLog).Length -eq 0
    ) {
      throw 'Authenticated Playwright smoke evidence was not written.'
    }
  }
  finally {
    Pop-Location
  }
}
catch {
  $runError = $_.Exception
}
finally {
  try {
    $cleanupFailures = [System.Collections.Generic.List[System.Exception]]::new()
    if ($null -ne $frontendProcess) {
      try {
        Stop-LaunchedProcessTree `
          -Process $frontendProcess `
          -Port $FrontendPort `
          -Label 'Smoke-test frontend'
      }
      catch {
        $cleanupFailures.Add($_.Exception)
      }
    }
    if ($null -ne $backendProcess) {
      try {
        Stop-LaunchedProcessTree `
          -Process $backendProcess `
          -Port $BackendPort `
          -Label 'Staging backend'
      }
      catch {
        $cleanupFailures.Add($_.Exception)
      }
    }

    if ($null -ne $backendProcess) {
      try {
        $env:NODE_ENV = 'development'
        $env:REDIS_ENABLED = 'false'
        $env:DATABASE_NAME = $expectedDatabaseName
        $env:DATABASE_USER = $expectedDatabaseUser
        $env:DATABASE_SCHEMA = $expectedDatabaseSchema
        $env:ALLOW_DESTRUCTIVE_DB_SCRIPTS = 'true'
        $env:QA_STAGING_SENTINEL_KEY = 'DSP-ERP-QA-STAGING'
        $env:QA_STAGING_CONFIRMATION_TOKEN =
          'CONFIRM-QA-WRITES:dsp_erp_dev:dsp_pms_stg'
        Invoke-NpmScript `
          -WorkingDirectory $backendDir `
          -Script 'qa:reference:cleanup-sessions'
      }
      catch {
        $cleanupFailures.Add($_.Exception)
      }
    }

    if ($script:qaFrontendWorktreeCreated) {
      try {
        Remove-IsolatedFrontendWorktree
      }
      catch {
        $cleanupFailures.Add($_.Exception)
      }
    }

    if ($cleanupFailures.Count -gt 0) {
      throw [System.AggregateException]::new(
        'One or more authenticated smoke cleanup steps failed.',
        [System.Exception[]]$cleanupFailures.ToArray()
      )
    }
  }
  catch {
    $cleanupError = $_.Exception
  }
  finally {
    $finalizationFailures =
      [System.Collections.Generic.List[System.Exception]]::new()
    if ($null -ne $playwrightConfigPath) {
      Remove-Item `
        -LiteralPath $playwrightConfigPath `
        -Force `
        -ErrorAction SilentlyContinue
    }

    foreach ($name in $environmentNames) {
      try {
        $savedValue = $savedEnvironment[$name]
        if ($savedValue.Exists) {
          [Environment]::SetEnvironmentVariable(
            $name,
            [string]$savedValue.Value,
            [EnvironmentVariableTarget]::Process
          )
        }
        else {
          [Environment]::SetEnvironmentVariable(
            $name,
            $null,
            [EnvironmentVariableTarget]::Process
          )
        }
      }
      catch {
        $finalizationFailures.Add($_.Exception)
      }
    }

    try {
      if ($runMutexAcquired) {
        $runMutex.ReleaseMutex()
        $runMutexAcquired = $false
      }
    }
    catch {
      $finalizationFailures.Add($_.Exception)
    }
    finally {
      $runMutex.Dispose()
    }

    if ($finalizationFailures.Count -gt 0) {
      $finalizationError = [System.AggregateException]::new(
        'Environment restoration or runner-lock cleanup failed.',
        [System.Exception[]]$finalizationFailures.ToArray()
      )
      if ($null -ne $cleanupError) {
        $cleanupError = [System.AggregateException]::new(
          'Authenticated smoke cleanup and finalization both failed.',
          [System.Exception[]]@($cleanupError, $finalizationError)
        )
      }
      else {
        $cleanupError = $finalizationError
      }
    }
  }
}

if ($null -ne $runError -and $null -ne $cleanupError) {
  throw [System.AggregateException]::new(
    'Authenticated smoke execution and session cleanup both failed.',
    [System.Exception[]]@($runError, $cleanupError)
  )
}
if ($null -ne $runError) {
  throw $runError
}
if ($null -ne $cleanupError) {
  throw $cleanupError
}

Write-Output "Authenticated smoke evidence: $playwrightLog"
