Add-Type -AssemblyName System.Drawing
$fixtureDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.cache'))
New-Item -ItemType Directory -Force -Path $fixtureDirectory | Out-Null
foreach ($fixtureName in @('deadline', 'identity')) {
  $bitmap = New-Object System.Drawing.Bitmap 1200,400
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::White)
  $font = New-Object System.Drawing.Font 'Arial',28
  $text = if ($fixtureName -eq 'deadline') {
    "INTERNSHIP APPLICATION`nApply by 2026-11-01 at 17:00 IST`nSoftware Engineering - Example Company`nSynthetic test fixture"
  } else {
    "AADHAAR CARD - SYNTHETIC SAMPLE`nNOT A REAL IDENTITY DOCUMENT`nNo real personal information`nTest fixture for confidential classification"
  }
  $graphics.DrawString($text, $font, [System.Drawing.Brushes]::Black, 30, 35)
  $bitmap.Save((Join-Path $fixtureDirectory "$fixtureName-fixture.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $font.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
Write-Output 'Created synthetic deadline and identity PNG fixtures. No personal information is used.'
