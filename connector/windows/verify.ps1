$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$installer = Join-Path $repoRoot 'connector/dist/EngramConnectorSetup.exe'
$smokeRoot = Join-Path $repoRoot ('.cache/connector-smoke-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $smokeRoot | Out-Null
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
# Inspect the actual EXE resource without running setup or changing Windows registration.
$assembly = [Reflection.Assembly]::LoadFile($installer)
$stream = $assembly.GetManifestResourceStream('payload.zip')
$zip = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Read)
try {
    $names = @($zip.Entries | ForEach-Object { $_.FullName })
    foreach ($required in @('node.exe', 'NODE-LICENSE.txt', 'EngramConnector.exe', 'src/index.js', 'node_modules/baileys/package.json')) {
        if ($names -notcontains $required) { throw "Missing package entry: $required" }
    }
    if (@($names | Where-Object { $_ -match '(^|/)(\.env[^/]*|\.engram-session|\.engram-outbox)(/|$)' }).Count -gt 0) {
        throw 'Private files must not be included.'
    }
    foreach ($entry in $zip.Entries) {
        $destination = [IO.Path]::GetFullPath((Join-Path $smokeRoot $entry.FullName))
        if (!$destination.StartsWith($smokeRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'Invalid package path.' }
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($destination)) | Out-Null
        [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $destination, $true)
    }
} finally { $zip.Dispose(); $stream.Dispose() }
$check = Join-Path $smokeRoot 'smoke.mjs'
Set-Content -Encoding UTF8 -LiteralPath $check -Value "import makeWASocket from 'baileys'; if (typeof makeWASocket !== 'function') throw new Error('Missing runtime dependency'); console.log('Bundled runtime imports Baileys successfully');"
& (Join-Path $smokeRoot 'node.exe') $check
if ($LASTEXITCODE -ne 0) { throw 'Packaged runtime smoke check failed.' }
Write-Output "Verified installer contents and bundled runtime. No installation or WhatsApp pairing performed. Scratch files: $smokeRoot"
