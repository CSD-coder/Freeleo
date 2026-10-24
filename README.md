# Freeleo CLI (`f`)

A lightweight, self-improving, privacy-first AI command-line interface running locally on Windows PowerShell.

## Features
- **Local AI Model:** Powered by Qwen 2.5 3B (~1.93 GB GGUF).
- **Strict Storage Bounds:** Contained completely in `C:\FreeleoCLI` (<2.6 GB footprint).
- **Long-Term Memory:** Learns user facts and preferences over time (`f --memory`).
- **Self-Improving:** Automatically reflects post-session to generate optimized response rules (`f --rules`).
- **Connected Mode:** Integrates web search via DuckDuckGo scraper (`f --connect`).

## Quick Installation

Run this single command in **Windows PowerShell**:

```powershell
irm [https://cdn.statically.io/gh/your-username/FreeleoCLI/main/install.ps1](https://cdn.statically.io/gh/your-username/FreeleoCLI/main/install.ps1) | iex
