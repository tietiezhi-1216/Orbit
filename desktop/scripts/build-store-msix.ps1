param(
  [Parameter(Mandatory = $true)]
  [string]$IdentityName,

  [Parameter(Mandatory = $true)]
  [string]$Publisher,

  [Parameter(Mandatory = $true)]
  [string]$PublisherDisplayName,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+\.\d+$')]
  [string]$PackageVersion
)

$ErrorActionPreference = 'Stop'
$desktopDir = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$layoutDir = Join-Path $desktopDir 'store-layout'
$outputDir = Join-Path $desktopDir 'store-output'
$manifestTemplate = Join-Path $desktopDir 'store\AppxManifest.template.xml'
$manifestPath = Join-Path $layoutDir 'AppxManifest.xml'
$releaseExe = Join-Path $desktopDir 'src-tauri\target\release\tietiezhi-desktop.exe'

foreach ($generatedDir in @($layoutDir, $outputDir)) {
  if (Test-Path $generatedDir) {
    Remove-Item -Recurse -Force $generatedDir
  }
  New-Item -ItemType Directory -Path $generatedDir | Out-Null
}

Push-Location $desktopDir
try {
  pnpm tauri build --no-bundle --ci --config src-tauri/tauri.store.conf.json
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri Store 构建失败，退出码：$LASTEXITCODE"
  }

  if (-not (Test-Path $releaseExe)) {
    throw "未找到 Tauri Windows 发布程序：$releaseExe"
  }

  Copy-Item $releaseExe (Join-Path $layoutDir 'tietiezhi-desktop.exe')
  $assetsDir = New-Item -ItemType Directory -Path (Join-Path $layoutDir 'Assets')
  Copy-Item 'src-tauri\icons\StoreLogo.png' (Join-Path $assetsDir 'StoreLogo.png')
  Copy-Item 'src-tauri\icons\Square150x150Logo.png' (Join-Path $assetsDir 'Square150x150Logo.png')
  Copy-Item 'src-tauri\icons\Square44x44Logo.png' (Join-Path $assetsDir 'Square44x44Logo.png')
  Copy-Item $manifestTemplate $manifestPath

  [xml]$manifest = Get-Content -Raw $manifestPath
  $manifest.Package.Identity.Name = $IdentityName
  $manifest.Package.Identity.Publisher = $Publisher
  $manifest.Package.Identity.Version = $PackageVersion
  $manifest.Package.Properties.PublisherDisplayName = $PublisherDisplayName

  $writerSettings = [System.Xml.XmlWriterSettings]::new()
  $writerSettings.Encoding = [System.Text.UTF8Encoding]::new($false)
  $writerSettings.Indent = $true
  $writer = [System.Xml.XmlWriter]::Create($manifestPath, $writerSettings)
  try {
    $manifest.Save($writer)
  }
  finally {
    $writer.Dispose()
  }

  winapp pack $layoutDir --output $outputDir --manifest $manifestPath
  if ($LASTEXITCODE -ne 0) {
    throw "MSIX 打包失败，退出码：$LASTEXITCODE"
  }

  $packages = @(Get-ChildItem $outputDir -Filter '*.msix')
  if ($packages.Count -ne 1) {
    throw "预期生成 1 个 MSIX，实际生成 $($packages.Count) 个。"
  }
  Write-Host "Store MSIX 已生成：$($packages[0].FullName)"
}
finally {
  Pop-Location
}
