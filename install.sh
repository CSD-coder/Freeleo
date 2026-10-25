#!/bin/bash
echo "Installing Freeleo CLI..."

# 1. Create workspace folders strictly under ~/.freeleocli
mkdir -p ~/.freeleocli/models
mkdir -p ~/.freeleocli/history
mkdir -p ~/.freeleocli/memory
mkdir -p ~/.freeleocli/integrations
cd ~/.freeleocli

# 2. Download project files directly from GitHub Raw
BASE_URL="https://raw.githubusercontent.com/CSD-coder/Freeleo/main"

echo "Downloading package.json..."
curl -sL "$BASE_URL/package.json" -o ~/.freeleocli/package.json

echo "Downloading f.js..."
curl -sL "$BASE_URL/f.js" -o ~/.freeleocli/f.js

# 3. Install NPM packages & link command globally
echo "Installing dependencies..."
npm install
npm link

echo -e "\nFreeleo CLI installed successfully! Try running 'f --new' or 'f --help' in your terminal."
