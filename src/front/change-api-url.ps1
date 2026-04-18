param (
    [Parameter(Mandatory=$true)]
    [int]$mode
)

# Services dizininin tam yolu
$servicesPath = Join-Path $PSScriptRoot "src\services"

# Mode'a göre değiştirilecek ve yeni değerleri belirle
$oldValue = if ($mode -eq 1) { "http://localhost:8000" } else { "https://api.habbojoh.com.tr" }
$newValue = if ($mode -eq 1) { "https://api.habbojoh.com.tr" } else { "http://localhost:8000" }

Write-Host "Mode: $mode"
Write-Host "Replacing $oldValue with $newValue"
Write-Host "Searching in: $servicesPath"

# Tüm .ts dosyalarını bul ve içeriğini değiştir
Get-ChildItem -Path $servicesPath -Filter "*.ts" -Recurse | ForEach-Object {
    Write-Host "Processing file: $($_.FullName)"
    
    # Dosya içeriğini oku
    $content = Get-Content $_.FullName -Raw
    
    # Değişiklik yapılacak mı kontrol et
    if ($content -match $oldValue) {
        Write-Host "Found matches in $($_.Name)"
        
        # Değişiklikleri yap
        $newContent = $content -replace $oldValue, $newValue
        
        # Yeni içeriği dosyaya yaz
        $newContent | Set-Content $_.FullName -NoNewline
        Write-Host "Updated $($_.Name)"
    }
}

Write-Host "Process completed!"