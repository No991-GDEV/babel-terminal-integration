param([switch]$PrepareOnly, [switch]$Publish, [string]$GitHubCli = 'gh')
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Set-Location -LiteralPath $projectRoot
if ($PrepareOnly -eq $Publish) { throw 'Escolha -PrepareOnly ou -Publish.' }
function Run-Native([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Comando falhou: $Program (código $LASTEXITCODE)." }
}
$manifest = Get-Content -LiteralPath 'module.json' -Raw | ConvertFrom-Json
$package = Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json
$repository = 'No991-GDEV/babel-terminal-integration'
$tag = 'v' + $manifest.version
if ($manifest.id -ne 'babel-terminal-integration' -or $manifest.version -notmatch '^\d+\.\d+\.\d+$' -or $manifest.version -ne $package.version) { throw 'Identidade/versão divergentes.' }
if ($manifest.manifest -ne "https://github.com/$repository/releases/latest/download/module.json" -or $manifest.download -ne "https://github.com/$repository/releases/download/$tag/babel-terminal-integration.zip") { throw 'URLs de publicação inesperadas.' }
Run-Native 'node' @('--test','tests/*.test.mjs')
Run-Native 'node' @('tools/release-files.mjs','--stage')
$stage = Get-Content -LiteralPath 'local-reports/release-stage.json' -Raw | ConvertFrom-Json
$releaseRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot ('dist/public-' + $manifest.version + '-' + (Get-Date -Format 'yyyyMMddHHmmssfff'))))
if (-not $releaseRoot.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Destino fora do projeto.' }
New-Item -ItemType Directory -Path $releaseRoot | Out-Null
$zipPath = Join-Path $releaseRoot 'babel-terminal-integration.zip'
Compress-Archive -LiteralPath $stage.stage -DestinationPath $zipPath -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $stage.stage 'module.json') -Destination (Join-Path $releaseRoot 'module.json')
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($archive.Entries | Where-Object { $_.Name })
    $names = @($entries | ForEach-Object { $_.FullName.Replace('\','/') -replace '^babel-terminal-integration/','' })
    if (@(Compare-Object ($stage.files | Sort-Object) ($names | Sort-Object)).Count) { throw 'ZIP diverge da lista de distribuição.' }
    foreach ($entry in $entries) {
        $relative = $entry.FullName.Replace('\','/') -replace '^babel-terminal-integration/',''
        $stream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $entryHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','') } finally { $stream.Dispose(); $sha.Dispose() }
        if ($entryHash -ne (Get-FileHash -LiteralPath (Join-Path $stage.stage $relative)).Hash) { throw "Conteúdo divergente no ZIP: $relative" }
    }
} finally { $archive.Dispose() }
$checksums = @('module.json','babel-terminal-integration.zip') | ForEach-Object { (Get-FileHash -LiteralPath (Join-Path $releaseRoot $_)).Hash.ToLowerInvariant() + '  ' + $_ }
[IO.File]::WriteAllText((Join-Path $releaseRoot 'SHA256SUMS.txt'), ($checksums -join "`n") + "`n", [Text.UTF8Encoding]::new($false))
$result = [ordered]@{version=$manifest.version;tag=$tag;directory=$releaseRoot;files=$stage.files.Count;manifest=$manifest.manifest;download=$manifest.download}
if ($Publish) {
    $origin = (& git remote get-url origin | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $origin -notin @("https://github.com/$repository.git","https://github.com/$repository","git@github.com:$repository.git")) { throw 'Origin não corresponde ao repositório autorizado.' }
    $dirty = (& git status --porcelain | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Faça commit de todas as alterações aprovadas antes de publicar.' }
    $head = (& git rev-parse HEAD | Out-String).Trim()
    $releaseJson = (& $GitHubCli api "repos/$repository/releases?per_page=100" | Out-String)
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conferir as releases existentes.' }
    $existing = @($releaseJson | ConvertFrom-Json | Where-Object { $_.tag_name -eq $tag })
    if ($existing.Count -gt 0 -and -not $existing[0].draft) { throw 'Esta versão já está publicada e não será alterada. Escolha outra versão.' }
    $existingTagName = (& git tag --list $tag | Out-String).Trim()
    if ($existingTagName) { $existingTag = (& git rev-parse "refs/tags/$tag" | Out-String).Trim(); if ($existingTag -ne $head) { throw 'Tag local aponta para outro commit.' } }
    else { Run-Native 'git' @('tag',$tag) }
    Run-Native 'git' @('push','origin','HEAD:main')
    Run-Native 'git' @('push','origin',"refs/tags/$tag")
    if ($existing.Count -eq 0) { Run-Native $GitHubCli @('release','create',$tag,'--repo',$repository,'--verify-tag','--draft','--title',('Babel Terminal Integration '+$manifest.version),'--notes-file','CHANGELOG.md') }
    Run-Native $GitHubCli @('release','upload',$tag,(Join-Path $releaseRoot 'module.json'),$zipPath,(Join-Path $releaseRoot 'SHA256SUMS.txt'),'--repo',$repository,'--clobber')
    # The by-tag REST endpoint returns published releases only. Resolve draft IDs from the authenticated list.
    $drafts = (& $GitHubCli api "repos/$repository/releases?per_page=100" | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível conferir o rascunho enviado.' }
    $draftMatch = @($drafts | Where-Object { $_.tag_name -eq $tag })
    if ($draftMatch.Count -ne 1 -or -not $draftMatch[0].draft) { throw 'Rascunho ausente ou já publicado; nenhum asset será alterado.' }
    $draftReleaseId = $draftMatch[0].id
    $remoteRelease = (& $GitHubCli api "repos/$repository/releases/$draftReleaseId" | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or -not $remoteRelease.draft) { throw 'A release não está em rascunho; pare antes de alterar assets.' }
    foreach ($name in @('module.json','babel-terminal-integration.zip','SHA256SUMS.txt')) {
        $localPath = Join-Path $releaseRoot $name
        $asset = @($remoteRelease.assets | Where-Object { $_.name -eq $name })
        if ($asset.Count -ne 1 -or $asset[0].size -ne (Get-Item -LiteralPath $localPath).Length -or $asset[0].digest -ne ('sha256:' + (Get-FileHash -LiteralPath $localPath).Hash.ToLowerInvariant())) { throw "Asset remoto não conferido: $name. A release continua em rascunho." }
    }
    Run-Native $GitHubCli @('release','edit',$tag,'--repo',$repository,'--draft=false','--latest')
    $result.published = $true
}
$result | ConvertTo-Json | Write-Output
