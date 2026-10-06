$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
if (Get-Command node -ErrorAction SilentlyContinue) {
    node (Join-Path $PSScriptRoot 'build-static.mjs')
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar app.bundle.js' }
} elseif (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'public/app.bundle.js'))) {
    throw 'Falta app.bundle.js. Instala Node para generarlo.'
} else {
    Write-Warning 'Node no está disponible; se incluirá el app.bundle.js existente.'
}
$publicRoot = Join-Path $projectRoot 'public'
$archivePath = Join-Path $projectRoot 'ladderly-web.zip'
$files = Get-ChildItem -LiteralPath $publicRoot -File -Recurse
if (-not $files) { throw 'La carpeta public está vacía.' }
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $entryName = $file.FullName.Substring($publicRoot.Length + 1).Replace('\', '/')
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $entryName) | Out-Null
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output "Paquete generado: $archivePath"
