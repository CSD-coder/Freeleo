Write-Host "Installing Freeleo CLI..." -ForegroundColor Cyan

# 1. Create workspace folders strictly under C:\FreeleoCLI
mkdir C:\FreeleoCLI -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\models -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\history -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\memory -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\integrations -ErrorAction SilentlyContinue
cd C:\FreeleoCLI

# 2. Download project files directly from GitHub Raw
$baseUrl = "https://raw.githubusercontent.com/CSD-coder/Freeleo/main"

Write-Host "Downloading package.json..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/package.json" -OutFile "C:\FreeleoCLI\package.json" -UseBasicParsing

Write-Host "Downloading f.js..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "$baseUrl/f.js" -OutFile "C:\FreeleoCLI\f.js" -UseBasicParsing

# 3. Install NPM packages & link command globally
Write-Host "Installing dependencies..." -ForegroundColor Yellow
npm install
npm link

Write-Host "`nFreeleo CLI installed successfully! Try running 'f --new' or 'f --help' in PowerShell." -ForegroundColor Green
