# Windows PowerShell 5.1: yayımlanan CMD'nin dosya hazırlamasını sentetik ortamda çalıştırır.
# Ağ, tarayıcı ve pano yan etkileri taklit edilir. Gerçek LOCALAPPDATA değiştirilmez.
$ErrorActionPreference = 'Stop'
$testLocalRoot = Join-Path ([IO.Path]::GetTempPath()) ('CALbupWinTest-' + [Guid]::NewGuid())
$testZip = (Resolve-Path 'dist/pos-yardimcisi.zip').Path
$testManifest = Get-Content 'dist/pos-yardimcisi/manifest.json' -Raw | ConvertFrom-Json
$script:browserOpened = $false
$script:clipboardPath = ''
function Read-Host { return '1' }
function Invoke-WebRequest {
    param($Uri, [switch]$UseBasicParsing, $MaximumRedirection, $TimeoutSec, $OutFile)
    if ($Uri -ne ('https://alibedirhan.github.io/CAL_bup/pos-yardimcisi.zip?v=' + $testManifest.version) -or $MaximumRedirection -ne 0 -or $TimeoutSec -ne 45) { throw 'İzin kapsamı değişmiş.' }
    Copy-Item -LiteralPath $testZip -Destination $OutFile
}
function Start-Process {
    param($FilePath, $ArgumentList)
    if ($FilePath -ne 'msedge.exe' -or $ArgumentList -ne 'edge://extensions') { throw 'Tarayıcı hedefi değişmiş.' }
    $script:browserOpened = $true
}
function Set-Clipboard { param($Value) $script:clipboardPath = $Value }
try {
    $cmd = Get-Content 'dist/POS-Yardimcisi-Windows-Kurulum.cmd' -Raw
    $match = [regex]::Match($cmd, 'powershell.exe -NoProfile -Command "([^"]+)"')
    if (-not $match.Success) { throw 'CMD komutu okunamadı.' }
    $code = $match.Groups[1].Value
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$errors) | Out-Null
    if ($errors.Count -gt 0) { throw 'Windows PowerShell sözdizimi hatası.' }
    # Testte yalnızca hedef kökü yalıt; üretim komutunun geri kalanını aynen çalıştır.
    $code = $code.Replace('$env:LOCALAPPDATA', '$testLocalRoot')
    & ([scriptblock]::Create($code))
    $destination = Join-Path $testLocalRoot 'CALbup\POSYardimcisi'
    $files = @(Get-ChildItem -LiteralPath $destination -File)
    if ($files.Count -ne 5 -or -not $script:browserOpened -or $script:clipboardPath -ne $destination) { throw 'Hazırlama sonucu eksik.' }
    foreach ($file in $files) {
        $original = Join-Path 'dist/pos-yardimcisi' $file.Name
        if ((Get-FileHash -LiteralPath $original).Hash -ne (Get-FileHash -LiteralPath $file.FullName).Hash) { throw 'Dosya değişmiş.' }
    }
    Write-Output 'Windows PowerShell dosya hazirlama testi basarili. Ag/tarayici/pano taklit; kart/POS/SMS yok.'
} finally {
    if (Test-Path -LiteralPath $testLocalRoot) { Remove-Item -LiteralPath $testLocalRoot -Recurse -Force }
}
