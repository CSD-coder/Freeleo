# Freeleo CLI 🚀

**Freeleo CLI** is a lightweight, self-improving, globally accessible Windows PowerShell AI assistant running locally inside `C:\FreeleoCLI`. Powered by open-source GGUF models via `node-llama-cpp`, Freeleo operates completely offline, maintains long-term user memory, auto-reflects to improve its behavior, and provides modular tool integrations and REST API endpoints.

---

## 🌟 Key Features

* **Hardware-Smart Model Selection:** Houses 20+ open-source models across leading architectures (Qwen, Llama, Gemma, Phi, Mistral, DeepSeek). Automatically hides models that exceed your system RAM and recommends at most 1–2 optimal picks.
* **Long-Term Memory (`f --memory`):** Automatically extracts and remembers user facts across sessions. Edit or clear stored memories anytime.
* **Self-Improving Rules (`f --rules`):** Learns from interaction mistakes and dynamically adjusts system prompt rules over time.
* **Modular Tool Integration (`f --connect`):** Connect local JavaScript plugins stored in `C:\FreeleoCLI\integrations` to empower Freeleo with external tools and capabilities.
* **OpenAI-Compatible REST API (`f --expose` & `f --api`):** Serve your local model as an HTTP server or expose it publicly via Localtunnel with auto-generated API key security.
* **Workspace Management (`f --delete`):** Built-in deletion handlers to safely unbind individual models or remove the entire Freeleo workspace.

---

## 💻 Hardware-Aware Model Catalog

Freeleo screens system RAM dynamically to ensure smooth performance without overloading low-spec devices:

| Tier | Minimum RAM | Included Model Options |
| :--- | :--- | :--- |
| **Ultra Light** | 4 GB | Qwen 2.5 0.5B, Llama 3.2 1B, Gemma 2 2B, SmolLM2 1.7B |
| **Lightweight** | 8 GB | Qwen 2.5 1.5B, Llama 3.2 3B, Phi-4 Mini 3.8B, DeepSeek-R1-Distill 1.5B, MiniCPM 3 4B |
| **Balanced** | 16 GB | Qwen 2.5 3B, Mistral 7B v0.3, Gemma 2 9B, DeepSeek-R1-Distill 7B, Llama 3.1 8B |
| **High Performance** | 32 GB | Qwen 2.5 7B, Cohere Command R 35B, Qwen 2.5 14B, DeepSeek-R1-Distill 14B |
| **Enthusiast** | 64 GB+ | Qwen 2.5 32B, Llama 3.1 70B |

---

## ⚡ Quick Installation

Run the following command in **Windows PowerShell** to install Freeleo CLI globally:

```powershell
irm https://raw.githubusercontent.com/CSD-coder/Freeleo/main/install.ps1 | iex
```

Run the following command in **Linux Terminal** to install Freeleo CLI globally:

```terminal
curl -sL https://raw.githubusercontent.com/CSD-coder/Freeleo/main/install.sh | bash
```
