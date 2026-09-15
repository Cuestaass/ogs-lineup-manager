$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot = Split-Path -Parent $PSScriptRoot
$publicRoot = Join-Path $projectRoot 'public'
$archivePath = Join-Path $projectRoot 'ladderly-web.zip'
$files = @('index.html', 'app.js', 'styles.css', '_headers')
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $publicRoot $file) -PathType Leaf)) {
        throw "Falta el archivo público: $file"
    }
}
$stream = [System.IO.File]::Open($archivePath, [System.IO.FileMode]::Create)
try {
    $archive = [System.IO.Compression.ZipArchive]::new($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $publicRoot $file), $file) | Out-Null
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output "Paquete generado: $archivePath"
