$ErrorActionPreference = 'Stop'
$connectorRoot = Split-Path $PSScriptRoot -Parent
$repoRoot = Split-Path $connectorRoot -Parent
$buildRoot = Join-Path $repoRoot '.cache/connector-build'
$downloadRoot = Join-Path $repoRoot 'connector/dist'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
$nodePath = (Get-Command node.exe).Source
if (!(Test-Path $compiler)) { throw 'The Windows .NET Framework C# compiler is required.' }
if (!(Test-Path (Join-Path $connectorRoot 'node_modules/baileys'))) { throw 'Install connector dependencies before packaging.' }
if ([int]((& $nodePath --version).TrimStart('v').Split('.')[0]) -lt 24) { throw 'Node 24 or newer is required.' }
if ((& $nodePath -p process.arch) -ne 'x64') { throw 'Use the Windows x64 Node runtime for this installer.' }
New-Item -ItemType Directory -Force -Path $buildRoot, $downloadRoot | Out-Null
$launcher = Join-Path $buildRoot 'EngramConnector.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll "/out:$launcher" (Join-Path $PSScriptRoot 'Launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Launcher compilation failed.' }
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$payload = Join-Path $buildRoot 'payload.zip'
$fileStream = [IO.File]::Open($payload, [IO.FileMode]::Create)
$zip = New-Object IO.Compression.ZipArchive($fileStream, [IO.Compression.ZipArchiveMode]::Create)
try {
    # Explicit allowlist: never package local sessions, captured messages, or environment files.
    $files = @(Get-ChildItem -LiteralPath (Join-Path $connectorRoot 'src') -Recurse -File)
    $files += @(Get-ChildItem -LiteralPath (Join-Path $connectorRoot 'node_modules') -Recurse -File)
    $files += Get-Item (Join-Path $connectorRoot 'package.json')
    foreach ($file in $files) {
        $relative = $file.FullName.Substring($connectorRoot.Length + 1).Replace('\', '/')
        if ($file.Name -like '.env*') { continue }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $file.FullName, $relative) | Out-Null
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $nodePath, 'node.exe') | Out-Null
    $nodeLicense = Join-Path $buildRoot 'NODE-LICENSE.txt'
    $nodeVersion = (& $nodePath --version).Trim()
    Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/nodejs/node/$nodeVersion/LICENSE" -OutFile $nodeLicense
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $nodeLicense, 'NODE-LICENSE.txt') | Out-Null
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $launcher, 'EngramConnector.exe') | Out-Null
} finally { $zip.Dispose(); $fileStream.Dispose() }
$installer = Join-Path $downloadRoot 'EngramConnectorSetup.exe'
& $compiler /nologo /target:winexe /reference:System.Windows.Forms.dll /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll "/resource:$payload,payload.zip" "/out:$installer" (Join-Path $PSScriptRoot 'Setup.cs')
if ($LASTEXITCODE -ne 0) { throw 'Installer compilation failed.' }
Get-FileHash -Algorithm SHA256 -LiteralPath $installer
Write-Output "Built $installer"
