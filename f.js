#!/usr/bin/env node

import { getLlama, resolveModelFile, LlamaChatSession, defineChatSessionFunction } from "node-llama-cpp";
import readline from "readline";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import express from "express";
import localtunnel from "localtunnel";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, "models");
const HISTORY_DIR = path.join(__dirname, "history");
const MEMORY_DIR = path.join(__dirname, "memory");
const INTEGRATIONS_DIR = path.join(__dirname, "integrations");

const RULES_FILE = path.join(MEMORY_DIR, "system_rules.json");
const USER_MEMORY_FILE = path.join(MEMORY_DIR, "user_memory.json");
const CONFIG_FILE = path.join(MEMORY_DIR, "config.json");

const AVAILABLE_MODELS = [
  // --- Ultra Light Tier (4GB RAM) ---
  { id: "qwen-0.5b", name: "Qwen 2.5 0.5B", uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q4_k_m.gguf", reqRamGB: 4, size: "~390 MB", intelligence: 1 },
  { id: "smollm2-1.7b", name: "SmolLM2 1.7B", uri: "hf:HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/smollm2-1.7b-instruct-q4_k_m.gguf", reqRamGB: 4, size: "~1.1 GB", intelligence: 2 },
  { id: "qwen-coder-1.5b", name: "Qwen 2.5 Coder 1.5B", uri: "hf:Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF/qwen2.5-coder-1.5b-instruct-q4_k_m.gguf", reqRamGB: 4, size: "~1.1 GB", intelligence: 3 },

  // --- Lightweight Tier (8GB RAM) ---
  { id: "qwen-1.5b", name: "Qwen 2.5 1.5B", uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF/qwen2.5-1.5b-instruct-q4_k_m.gguf", reqRamGB: 8, size: "~1.1 GB", intelligence: 4 },
  { id: "deepseek-1.5b", name: "DeepSeek-R1-Distill-Qwen 1.5B", uri: "hf:unsloth/DeepSeek-R1-Distill-Qwen-1.5B-GGUF/DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf", reqRamGB: 8, size: "~1.2 GB", intelligence: 5 },
  { id: "phi-3.5-mini", name: "Microsoft Phi-3.5 Mini 3.8B", uri: "hf:bartowski/Phi-3.5-mini-instruct-GGUF/Phi-3.5-mini-instruct-Q4_K_M.gguf", reqRamGB: 8, size: "~2.4 GB", intelligence: 6 },
  { id: "minicpm-3b", name: "MiniCPM 3 4B", uri: "hf:openbmb/MiniCPM-3-4B-Instruct-GGUF/minicpm-3-4b-instruct-q4_k_m.gguf", reqRamGB: 8, size: "~2.6 GB", intelligence: 6 },
  { id: "qwen-coder-3b", name: "Qwen 2.5 Coder 3B", uri: "hf:Qwen/Qwen2.5-Coder-3B-Instruct-GGUF/qwen2.5-coder-3b-instruct-q4_k_m.gguf", reqRamGB: 8, size: "~2.0 GB", intelligence: 7 },

  // --- Balanced Tier (16GB RAM) ---
  { id: "qwen-3b", name: "Qwen 2.5 3B", uri: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF/qwen2.5-3b-instruct-q4_k_m.gguf", reqRamGB: 12, size: "~1.93 GB", intelligence: 8 },
  { id: "deepseek-7b", name: "DeepSeek-R1-Distill-Qwen 7B", uri: "hf:unsloth/DeepSeek-R1-Distill-Qwen-7B-GGUF/DeepSeek-R1-Distill-Qwen-7B-Q4_K_M.gguf", reqRamGB: 16, size: "~4.9 GB", intelligence: 9 },
  { id: "mistral-7b", name: "Mistral 7B Instruct v0.3", uri: "hf:unsloth/mistral-7b-instruct-v0.3-GGUF/mistral-7b-instruct-v0.3-Q4_K_M.gguf", reqRamGB: 16, size: "~4.4 GB", intelligence: 9 },
  { id: "qwen-coder-7b", name: "Qwen 2.5 Coder 7B", uri: "hf:Qwen/Qwen2.5-Coder-7B-Instruct-GGUF/qwen2.5-coder-7b-instruct-q4_k_m.gguf", reqRamGB: 16, size: "~4.7 GB", intelligence: 10 },

  // --- High Performance Tier (32GB RAM) ---
  { id: "qwen-7b", name: "Qwen 2.5 7B", uri: "hf:Qwen/Qwen2.5-7B-Instruct-GGUF/qwen2.5-7b-instruct-q4_k_m.gguf", reqRamGB: 24, size: "~4.5 GB", intelligence: 11 },
  { id: "deepseek-14b", name: "DeepSeek-R1-Distill-Qwen 14B", uri: "hf:unsloth/DeepSeek-R1-Distill-Qwen-14B-GGUF/DeepSeek-R1-Distill-Qwen-14B-Q4_K_M.gguf", reqRamGB: 32, size: "~9.0 GB", intelligence: 12 },
  { id: "qwen-14b", name: "Qwen 2.5 14B", uri: "hf:Qwen/Qwen2.5-14B-Instruct-GGUF/qwen2.5-14b-instruct-q4_k_m.gguf", reqRamGB: 32, size: "~9.0 GB", intelligence: 12 },
  { id: "command-r-35b", name: "Cohere Command R 35B", uri: "hf:bartowski/c4ai-command-r-v01-GGUF/c4ai-command-r-v01-Q4_K_M.gguf", reqRamGB: 32, size: "~20 GB", intelligence: 13 },

  // --- Enthusiast Tier (64GB+ RAM) ---
  { id: "deepseek-32b", name: "DeepSeek-R1-Distill-Qwen 32B", uri: "hf:unsloth/DeepSeek-R1-Distill-Qwen-32B-GGUF/DeepSeek-R1-Distill-Qwen-32B-Q4_K_M.gguf", reqRamGB: 48, size: "~20 GB", intelligence: 14 },
  { id: "qwen-32b", name: "Qwen 2.5 32B", uri: "hf:Qwen/Qwen2.5-32B-Instruct-GGUF/qwen2.5-32b-instruct-q4_k_m.gguf", reqRamGB: 48, size: "~20 GB", intelligence: 15 },
  { id: "qwen-72b", name: "Qwen 2.5 72B", uri: "hf:Qwen/Qwen2.5-72B-Instruct-GGUF/qwen2.5-72b-instruct-q4_k_m.gguf", reqRamGB: 64, size: "~47 GB", intelligence: 16 }
];

const args = process.argv.slice(2);

function loadJson(filePath, defaultValue = []) {
  if (fs.existsSync(filePath)) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function getSelectedModelUri() {
  const config = loadJson(CONFIG_FILE, { activeModelUri: AVAILABLE_MODELS[3].uri });
  return config.activeModelUri;
}

function getSystemRamGB() {
  return Math.round(os.totalmem() / (1024 * 1024 * 1024));
}

function sortModelsByHardware() {
  const ram = getSystemRamGB();
  const compatible = AVAILABLE_MODELS.filter(m => ram >= m.reqRamGB);

  if (compatible.length === 0) {
    compatible.push(AVAILABLE_MODELS[0]);
  }

  compatible.sort((a, b) => b.intelligence - a.intelligence);

  const recommendedCount = Math.min(2, compatible.length);
  const recommended = compatible.slice(0, recommendedCount);
  const others = compatible.slice(recommendedCount);

  return { recommended, others, ram };
}

async function selectModelInteractive() {
  const { recommended, others, ram } = sortModelsByHardware();
  const options = [...recommended, ...others];

  console.log(`\n\x1b[36mDetected System RAM: ${ram} GB\x1b[0m`);
  console.log("\x1b[90m(Hiding models exceeding your hardware limits for smooth performance)\x1b[0m\n");

  console.log("\x1b[32m=== Recommended Best Picks for Your Hardware ===\x1b[0m");
  recommended.forEach((m, idx) => {
    console.log(`  [${idx + 1}] ${m.name} (${m.size}) ⭐ Top Choice`);
  });

  if (others.length > 0) {
    console.log("\n\x1b[33m=== Other Compatible Models ===\x1b[0m");
    others.forEach((m, idx) => {
      console.log(`  [${recommended.length + idx + 1}] ${m.name} (${m.size})`);
    });
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question("\nSelect a model number: ", async (ans) => {
      rl.close();
      const choiceIdx = parseInt(ans.trim(), 10) - 1;
      if (isNaN(choiceIdx) || choiceIdx < 0 || choiceIdx >= options.length) {
        console.log("Invalid selection.");
        return resolve();
      }

      const selected = options[choiceIdx];
      saveJson(CONFIG_FILE, { activeModelUri: selected.uri });
      console.log(`\x1b[32m✔ Active model set to: ${selected.name}\x1b[0m`);
      resolve();
    });
  });
}

async function handleUpdateCommand() {
  console.log("\x1b[36mUpdating Freeleo CLI (preserving models, history, memory, and integrations)...\x1b[0m");
  const baseUrl = "https://raw.githubusercontent.com/CSD-coder/Freeleo/main";

  try {
    console.log("Downloading latest package.json...");
    const pkgRes = await fetch(`${baseUrl}/package.json`);
    if (!pkgRes.ok) throw new Error(`Failed to fetch package.json (${pkgRes.statusText})`);
    fs.writeFileSync(path.join(__dirname, "package.json"), await pkgRes.text(), "utf-8");

    console.log("Downloading latest f.js...");
    const fRes = await fetch(`${baseUrl}/f.js`);
    if (!fRes.ok) throw new Error(`Failed to fetch f.js (${fRes.statusText})`);
    fs.writeFileSync(path.join(__dirname, "f.js"), await fRes.text(), "utf-8");

    console.log("Updating npm dependencies...");
    execSync("npm install", { cwd: __dirname, stdio: "inherit" });

    console.log("\n\x1b[32m✔ Freeleo CLI updated successfully! All your data and models were preserved.\x1b[0m");
  } catch (err) {
    console.log(`\x1b[31mUpdate failed: ${err.message}\x1b[0m`);
  }
}

async function handleDeleteCommand(targetModelQuery) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  if (targetModelQuery) {
    const matchingModel = AVAILABLE_MODELS.find(m => 
      m.id.toLowerCase() === targetModelQuery.toLowerCase() || 
      m.name.toLowerCase().includes(targetModelQuery.toLowerCase())
    );

    const modelName = matchingModel ? matchingModel.name : targetModelQuery;

    rl.question(`Do you actually want to delete ${modelName}? (y/n): `, (ans) => {
      rl.close();
      if (ans.trim().toLowerCase() === 'y') {
        let deleted = false;
        if (fs.existsSync(MODELS_DIR)) {
          const files = fs.readdirSync(MODELS_DIR);
          files.forEach(file => {
            if (matchingModel && matchingModel.uri.toLowerCase().includes(file.toLowerCase())) {
              fs.unlinkSync(path.join(MODELS_DIR, file));
              deleted = true;
            } else if (file.toLowerCase().includes(targetModelQuery.toLowerCase())) {
              fs.unlinkSync(path.join(MODELS_DIR, file));
              deleted = true;
            }
          });
        }
        console.log(`\x1b[32m${modelName} deleted\x1b[0m`);
      } else {
        console.log("Deletion cancelled.");
      }
    });

  } else {
    rl.question("Do you actually want to delete Freeleo? (y/n): ", (ans) => {
      rl.close();
      if (ans.trim().toLowerCase() === 'y') {
        console.log("\n\x1b[31mBye, it was nice while it lasted, Freeleo out.\x1b[0m");
        try {
          fs.rmSync(__dirname, { recursive: true, force: true });
        } catch (err) {
          console.log(`\x1b[33mNote: Some active files could not be immediately unlinked: ${err.message}\x1b[0m`);
        }
      } else {
        console.log("Deletion cancelled.");
      }
    });
  }
}

async function loadIntegrations() {
  const functions = {};
  if (!fs.existsSync(INTEGRATIONS_DIR)) return functions;

  const files = fs.readdirSync(INTEGRATIONS_DIR).filter(f => f.endsWith(".js"));
  for (const file of files) {
    const fullPath = path.join(INTEGRATIONS_DIR, file);
    const module = await import(`file://${fullPath}`);
    for (const key in module) {
      const group = module[key];
      for (const fnName in group) {
        const tool = group[fnName];
        functions[fnName] = defineChatSessionFunction({
          description: tool.description,
          parameters: tool.parameters,
          handler: tool.handler
        });
      }
    }
  }
  return functions;
}

async function loadSession() {
  const modelUri = getSelectedModelUri();
  console.log(`\x1b[33mLoading model: ${modelUri}...\x1b[0m`);
  const llama = await getLlama({ gpu: "auto" });
  const modelPath = await resolveModelFile(modelUri, MODELS_DIR);
  const threads = Math.max(1, Math.floor(os.cpus().length / 2));

  const model = await llama.loadModel({
    modelPath: modelPath,
    gpuLayers: 99,
  });

  const context = await model.createContext({
    flashAttention: true,
    threads: threads,
  });

  const rules = loadJson(RULES_FILE, ["Be concise.", "Adapt to user preferences."]);
  const userMemory = loadJson(USER_MEMORY_FILE, []);

  const systemPrompt = "You are Freeleo CLI, a self-improving local AI assistant with long-term memory and tool connectivity.\n\n" +
    "--- STORED USER MEMORIES ---\n" +
    (userMemory.length > 0 ? userMemory.map((m) => `- ${m}`).join("\n") : "No facts recorded yet.") + "\n\n" +
    "--- SELF-IMPROVEMENT GUIDELINES ---\n" +
    (rules.length > 0 ? rules.map((r, i) => `${i + 1}. ${r}`).join("\n") : "Standard operation.");

  return new LlamaChatSession({ 
    contextSequence: context.getSequence(),
    systemPrompt: systemPrompt
  });
}

function saveHistory(chatId, history) {
  const filePath = path.join(HISTORY_DIR, `${chatId}.json`);
  saveJson(filePath, history);
}

function loadHistory(chatId) {
  const filePath = path.join(HISTORY_DIR, `${chatId}.json`);
  return loadJson(filePath, []);
}

async function processPostSession(session) {
  console.log("\n\x1b[33m[Freeleo Processing Memory & Self-Reflection...]\x1b[0m");

  try {
    const chatHistory = session.getChatHistory();
    const transcript = chatHistory.map(h => `${h.role}: ${h.content}`).join("\n");

    const sequence = session.sequence;
    const analysisSession = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt: "You are an objective AI memory analyzer. Extract facts or rules silently and precisely."
    });

    const memoryPrompt = `Analyze this conversation transcript:\n${transcript}\n\nDid the user share personal facts or preferences? Return ONLY a concise summary of the fact, or 'NONE'.`;
    let memoryResult = "";
    await analysisSession.prompt(memoryPrompt, { onTextChunk(chunk) { memoryResult += chunk; } });

    const cleanMemory = memoryResult.trim();
    if (cleanMemory && !cleanMemory.toUpperCase().includes("NONE")) {
      const currentMemory = loadJson(USER_MEMORY_FILE, []);
      currentMemory.push(cleanMemory);
      saveJson(USER_MEMORY_FILE, currentMemory);
      console.log(`\x1b[32m✔ New Fact Remembered: "${cleanMemory}"\x1b[0m`);
    }

    const reflectionPrompt = `Analyze this conversation transcript:\n${transcript}\n\nDid the AI make any mistakes or could it improve its responses? Return ONLY a concise new behavioral rule, or 'NO_CHANGE'.`;
    let reflectionResult = "";
    await analysisSession.prompt(reflectionPrompt, { onTextChunk(chunk) { reflectionResult += chunk; } });

    const cleanReflection = reflectionResult.trim();
    if (cleanReflection && !cleanReflection.toUpperCase().includes("NO_CHANGE")) {
      const currentRules = loadJson(RULES_FILE, []);
      currentRules.push(cleanReflection);
      saveJson(RULES_FILE, currentRules);
      console.log(`\x1b[32m✔ Self-Improvement Learned: "${cleanReflection}"\x1b[0m`);
    }
  } catch (err) {
    console.log(`\x1b[31mPost-session processing skipped: ${err.message}\x1b[0m`);
  }
}

async function editJsonListInteractive(filePath, title) {
  let items = loadJson(filePath, []);
  console.log(`\n\x1b[36m=== ${title} ===\x1b[0m`);
  if (items.length === 0) {
    console.log("  (No entries stored)");
  } else {
    items.forEach((item, i) => console.log(`  [${i + 1}] ${item}`));
  }

  console.log("\nOptions: [a] Add  [e] Edit  [d] Delete  [c] Clear All  [x] Exit");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  rl.question("Choice: ", (ans) => {
    const opt = ans.trim().toLowerCase();
    if (opt === 'a') {
      rl.question("Enter new entry: ", (val) => {
        if (val.trim()) items.push(val.trim());
        saveJson(filePath, items);
        console.log("Saved.");
        rl.close();
      });
    } else if (opt === 'e') {
      rl.question("Index to edit: ", (idxStr) => {
        const idx = parseInt(idxStr, 10) - 1;
        if (items[idx]) {
          rl.question("Enter updated value: ", (val) => {
            if (val.trim()) items[idx] = val.trim();
            saveJson(filePath, items);
            console.log("Updated.");
            rl.close();
          });
        } else {
          console.log("Invalid index.");
          rl.close();
        }
      });
    } else if (opt === 'd') {
      rl.question("Index to delete: ", (idxStr) => {
        const idx = parseInt(idxStr, 10) - 1;
        if (items[idx]) {
          items.splice(idx, 1);
          saveJson(filePath, items);
          console.log("Deleted.");
        }
        rl.close();
      });
    } else if (opt === 'c') {
      saveJson(filePath, []);
      console.log("Cleared all.");
      rl.close();
    } else {
      rl.close();
    }
  });
}

function runWalkthrough() {
  console.clear();
  console.log("\x1b[36m=== Welcome to Freeleo CLI Interactive Walkthrough ===\x1b[0m\n");
  console.log("1. \x1b[32mf --chat\x1b[0m    Starts a standard private local AI session.");
  console.log("2. \x1b[32mf --connect\x1b[0m Local AI chat enabled with custom modular tool integrations.");
  console.log("3. \x1b[32mf --model\x1b[0m   Switch, download, or clear hardware-compatible AI models.");
  console.log("4. \x1b[32mf --memory\x1b[0m  View and edit facts Freeleo remembers about you.");
  console.log("5. \x1b[32mf --rules\x1b[0m   View and edit self-improved behavioral guidelines.");
  console.log("6. \x1b[32mf --expose\x1b[0m  Run local HTTP REST server on localhost:5000.");
  console.log("7. \x1b[32mf --api\x1b[0m     Expose local server publicly using Localtunnel & API Key.");
  console.log("8. \x1b[32mf --update\x1b[0m  Update Freeleo to the latest version preserving your data.");
  console.log("9. \x1b[32mf --delete\x1b[0m  Delete entire platform or specific models.");
  console.log("\nSetup complete! Type 'f --chat' to get started immediately.\n");
}

async function startServer(port = 5000, apiKey = null) {
  const session = await loadSession();
  const app = express();
  app.use(express.json());

  app.post("/v1/chat/completions", async (req, res) => {
    if (apiKey) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
      }
    }

    const { messages } = req.body;
    const lastUserMessage = messages && messages.length > 0 ? messages[messages.length - 1].content : "";

    try {
      let replyText = "";
      await session.prompt(lastUserMessage, {
        onTextChunk(chunk) { replyText += chunk; }
      });

      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        choices: [{ message: { role: "assistant", content: replyText } }]
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(port, () => {
    console.log(`\x1b[32m✔ Freeleo API Server running at http://localhost:${port}\x1b[0m`);
    if (apiKey) {
      console.log(`\x1b[33m🔑 API Authorization Key: ${apiKey}\x1b[0m`);
    }
  });
}

async function exposePublicly() {
  const apiKey = crypto.randomBytes(16).toString("hex");
  await startServer(5000, apiKey);

  console.log("\x1b[33mCreating public Localtunnel endpoint...\x1b[0m");
  try {
    const tunnel = await localtunnel({ port: 5000 });
    console.log(`\x1b[32m🌐 Public Tunnel Endpoint: ${tunnel.url}\x1b[0m`);
    console.log(`\x1b[36m🔑 Remember your API Key: ${apiKey}\x1b[0m\n`);

    tunnel.on("close", () => {
      console.log("Localtunnel closed.");
    });
  } catch (err) {
    console.log(`Failed to start localtunnel: ${err.message}`);
  }
}

async function startChat(enableConnect = false, chatId = null) {
  const session = await loadSession();
  const functions = enableConnect ? await loadIntegrations() : {};
  const currentChatId = chatId || `chat_${Date.now()}`;
  let history = loadHistory(currentChatId);

  if (history.length > 0) {
    session.setChatHistory(history);
  }

  console.clear();
  console.log("\x1b[36m%s\x1b[0m", `=== Freeleo CLI Chat ${enableConnect ? '[Connected Mode]' : ''} [Session: ${currentChatId}] ===`);
  console.log("Type 'exit' or 'quit' to save & leave.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const promptUser = () => {
    rl.question("\x1b[32mYou > \x1b[0m", async (input) => {
      const trimmed = input.trim();
      if (["exit", "quit"].includes(trimmed.toLowerCase())) {
        saveHistory(currentChatId, session.getChatHistory());
        await processPostSession(session);
        console.log("Goodbye!");
        rl.close();
        process.exit(0);
        return;
      }

      if (trimmed) {
        process.stdout.write("\x1b[34mFreeleo > \x1b[0m");
        await session.prompt(trimmed, {
          functions: enableConnect ? functions : undefined,
          onTextChunk(chunk) {
            process.stdout.write(chunk);
          },
        });
        console.log("\n");
        saveHistory(currentChatId, session.getChatHistory());
      }
      promptUser();
    });
  };

  promptUser();
}

function listHistories() {
  if (!fs.existsSync(HISTORY_DIR)) return console.log("No saved sessions.");
  const files = fs.readdirSync(HISTORY_DIR).filter((f) => f.endsWith(".json"));
  console.log("\x1b[36mSaved Sessions:\x1b[0m");
  files.forEach((file, idx) => console.log(`  [${idx + 1}] ${file.replace(".json", "")}`));
}

function printHelp() {
  console.log("\x1b[36mFreeleo CLI Command Guide:\x1b[0m");
  console.log("  f --chat              Start interactive standard chat session");
  console.log("  f --connect           Start chat session connected to modular tools in /integrations");
  console.log("  f --model             Select, download, or switch AI models based on hardware");
  console.log("  f --memory            View and edit long-term stored user facts");
  console.log("  f --rules             View and edit self-improved behavioral rules");
  console.log("  f --new               Run interactive first-time walkthrough");
  console.log("  f --expose            Expose local OpenAI-compatible REST server at localhost:5000");
  console.log("  f --api               Expose server publicly via Localtunnel with generated API key");
  console.log("  f --update            Update Freeleo to the latest version preserving your data");
  console.log("  f --delete            Delete the entire Freeleo platform workspace");
  console.log("  f --delete <model>    Delete a specific downloaded model");
  console.log("  f --list              List saved conversation histories");
  console.log("  f --resume <id>       Resume past conversation session");
  console.log("  f --help              Display this command guide");
}

if (args.includes("--connect")) {
  startChat(true);
} else if (args.includes("--chat") || args.includes("-c")) {
  startChat(false);
} else if (args.includes("--model")) {
  selectModelInteractive();
} else if (args.includes("--new")) {
  runWalkthrough();
} else if (args.includes("--memory")) {
  editJsonListInteractive(USER_MEMORY_FILE, "Stored User Memories");
} else if (args.includes("--rules")) {
  editJsonListInteractive(RULES_FILE, "Self-Improved System Rules");
} else if (args.includes("--expose")) {
  startServer(5000, null);
} else if (args.includes("--api")) {
  exposePublicly();
} else if (args.includes("--update")) {
  handleUpdateCommand();
} else if (args.includes("--delete") || args.includes("-d")) {
  const deleteIdx = args.indexOf("--delete") !== -1 ? args.indexOf("--delete") : args.indexOf("-d");
  const target = args[deleteIdx + 1];
  handleDeleteCommand(target);
} else if (args.includes("--list") || args.includes("-l")) {
  listHistories();
} else if (args.includes("--resume") || args.includes("-r")) {
  const idx = args.indexOf("--resume") !== -1 ? args.indexOf("--resume") : args.indexOf("-r");
  startChat(false, args[idx + 1]);
} else if (args.includes("--help") || args.includes("-h")) {
  printHelp();
} else {
  printHelp();
}
