# Freeleo CLI Installation Script

Write-Host "Installing Freeleo CLI..." -ForegroundColor Cyan

# 1. Create workspace folders strictly under C:\FreeleoCLI
mkdir C:\FreeleoCLI -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\models -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\history -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\memory -ErrorAction SilentlyContinue
mkdir C:\FreeleoCLI\integrations -ErrorAction SilentlyContinue
cd C:\FreeleoCLI

# 2. Download project files from Statically CDN / GitHub
$baseUrl = "https://cdn.statically.io/gh/your-username/FreeleoCLI/main"

Invoke-WebRequest -Uri "$baseUrl/package.json" -OutFile "C:\FreeleoCLI\package.json"
Invoke-WebRequest -Uri "$baseUrl/f.js" -OutFile "C:\FreeleoCLI\f.js"
Invoke-WebRequest -Uri "$baseUrl/webSearch.js" -OutFile "C:\FreeleoCLI\integrations\webSearch.js"

# 3. Install NPM packages & link command globally
npm install
npm link

Write-Host "`nFreeleo CLI installed successfully! Try running 'f --connect' in PowerShell." -ForegroundColor Green
