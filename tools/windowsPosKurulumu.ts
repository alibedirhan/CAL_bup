/** Yalnızca sabit kendi yayınından hash ile doğrulanmış ZIP. Politika/registry değişmez. */
export function windowsPosKurulumu(surum: string, zipHash: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(surum) || !/^[a-f0-9]{64}$/.test(zipHash))
    throw new Error('Kurulum sürümü/hash uygun değil.');
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$tempDir=Join-Path ([IO.Path]::GetTempPath()) ('CALbupPOS-'+[Guid]::NewGuid().ToString())",
    "$browserChoice=Read-Host 'Programi hangi tarayicida kullaniyorsunuz? 1=Edge, 2=Chrome'",
    "if ($browserChoice -notin @('1','2')) {Write-Host 'Tarayici secimi yapilmadi. Hicbir kurulum yapilmadi.'; exit 1}",
    'try {',
    '[IO.Directory]::CreateDirectory($tempDir) | Out-Null',
    "$archive=Join-Path $tempDir 'yardimci.zip'",
    '[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12',
    `Invoke-WebRequest -Uri 'https://alibedirhan.github.io/CAL_bup/pos-yardimcisi.zip?v=${surum}' -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 45 -OutFile $archive`,
    `if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne '${zipHash}') {throw 'Paket dogrulanamadi. Dosyalar yuklenmedi. Yeni kurulum dosyasini programdan indirin.'}`,
    "$unpacked=Join-Path $tempDir 'paket'",
    'Expand-Archive -LiteralPath $archive -DestinationPath $unpacked',
    '$files=@(Get-ChildItem -LiteralPath $unpacked -File -Recurse)',
    "$expected=@('manifest.json','arkaPlan.js','kopru.js','pos.js','KURULUM.txt')",
    "if ($files.Count -ne 5 -or @($files | Where-Object {$_.DirectoryName -ne $unpacked -or $_.Name -notin $expected}).Count -gt 0) {throw 'Paket dosyalari uygun degil.'}",
    "$manifest=Get-Content -LiteralPath (Join-Path $unpacked 'manifest.json') -Raw | ConvertFrom-Json",
    `if ($manifest.version -ne '${surum}') {throw 'Paket surumu uygun degil.'}`,
    "$destination=Join-Path $env:LOCALAPPDATA 'CALbup\\POSYardimcisi'",
    "$parent=Join-Path $env:LOCALAPPDATA 'CALbup'",
    "if ((Test-Path -LiteralPath $parent) -and ((Get-Item -LiteralPath $parent).Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Kurulum ust klasoru baglanti olamaz.'}",
    "if (Test-Path -LiteralPath $destination) {if ((Get-Item -LiteralPath $destination).Attributes -band [IO.FileAttributes]::ReparsePoint) {throw 'Kurulum klasoru baglanti olamaz.'}}",
    '[IO.Directory]::CreateDirectory($destination) | Out-Null',
    "foreach ($file in $files) { $target=Join-Path $destination $file.Name; if ((Test-Path -LiteralPath $target) -and ((Get-Item -LiteralPath $target).Attributes -band [IO.FileAttributes]::ReparsePoint)) {throw 'Kurulum dosyasi baglanti olamaz.'} }",
    'foreach ($file in $files) {Copy-Item -LiteralPath $file.FullName -Destination $destination -Force}',
    "Write-Host 'Dosyalar hazir. Tarayiciya ekleme adimini sizin tamamlamaniz gerekiyor.'",
    "Write-Host 'Gelistirici modunu acin, Paketlenmemis oge yukle deyin.'",
    "Write-Host ('Klasor: '+$destination)",
    "try {Set-Clipboard -Value $destination; Write-Host 'Klasor yolunu secim penceresinde Ctrl+V ile yapistirabilirsiniz.'} catch {Write-Host 'Klasor yolunu yukaridaki satirdan kopyalayin.'}",
    "if ($browserChoice -eq '1') {$program='msedge.exe';$extensions='edge://extensions'} else {$program='chrome.exe';$extensions='chrome://extensions'}",
    "try {Start-Process -FilePath $program -ArgumentList $extensions} catch {Write-Host ('Tarayicida bu adresi acin: '+$extensions)}",
    "Write-Host 'Onceden kurduysaniz Yeniden yukle deyin. Ayni tarayicidaki CAL bup sekmesini Ctrl+F5 ile yenileyin.'",
    "Write-Host 'Sonra Yardimci baglantisini kontrol et dugmesini kullanin. Bu kurulum odeme veya SMS gondermez.'",
    "} catch {Write-Host 'Kurulum tamamlanamadi. Interneti veya kurumun kurulum politikasini kontrol edin.'; Write-Host $_.Exception.Message; exit 1} finally {if(Test-Path -LiteralPath $tempDir){Remove-Item -LiteralPath $tempDir -Recurse -Force}}",
  ]
    .join('; ')
    .replace('{; ', '{ ')
    .replaceAll('} ;', '}');
  // CMD UTF-8, PowerShell kodu ASCII ve okunabilir; EncodedCommand/ExecutionPolicy yoktur.
  return [
    '@echo off',
    'setlocal',
    'chcp 65001 >nul',
    'title CAL bup POS yardimcisi kurulumu',
    'echo CAL bup POS yardimcisi - Windows kolay kurulum',
    'echo Yonetici izni istemez; kart bilgisi okumaz. Kurum kurulum politikasini degistirmez.',
    `powershell.exe -NoProfile -Command "${ps}"`,
    'if errorlevel 1 echo Yardimci kurulumu tamamlanmadi. Yukaridaki mesaji kontrol edin.',
    'pause',
    'endlocal',
    '',
  ].join('\r\n');
}
