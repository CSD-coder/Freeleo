#!/usr/bin/env node

import { getLlama, resolveModelFile, LlamaChatSession, defineChatSessionFunction } from "node-llama-cpp";
import readline from "readline";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import express from "express";
import localtunnel from "localtunnel";
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
  { id: "0.5b", name: "Qwen 2.5 0.5B (Ultra Light)", uri: "hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q4_k_m.gguf", reqRamGB: 4, size: "~390 MB" },
  { id: "1.5b", name: "Qwen 2.5 1.5B (Balanced)", uri: "hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF/qwen2.5-1.5b-instruct-q4_k_m.gguf", reqRamGB: 8, size: "~1.1 GB" },
  { id: "3b", name: "Qwen 2.5 3B (Smarter / Recommended)", uri: "hf:Qwen/Qwen2.5-3B-Instruct-GGUF/qwen2.5-3b-instruct-q4_k_m.gguf", reqRamGB: 16, size: "~1.93 GB" },
  { id: "7b", name: "Qwen 2.5 7B (High Performance)", uri: "hf:Qwen/Qwen2.5-7B-Instruct-GGUF/qwen2.5-7b-instruct-q4_k_m.gguf", reqRamGB: 32, size: "~4.5 GB" }
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
  const config = loadJson(CONFIG_FILE, { activeModelUri: AVAILABLE_MODELS[2].uri });
  return config.activeModelUri;
}

function getSystemRamGB() {
  return Math.round(os.totalmem() / (1024 * 1024 * 1024));
}

function sortModelsByHardware() {
  const ram = getSystemRamGB();
  const recommended = [];
  const compatible = [];

  AVAILABLE_MODELS.forEach(m => {
    if (ram >= m.reqRamGB) {
      recommended.push(m);
    } else {
      compatible.push(m);
    }
  });

  return { recommended, compatible, ram };
}

async function selectModelInteractive() {
  const { recommended, compatible, ram } = sortModelsByHardware();
  const options = [...recommended, ...compatible];

  console.log(`\n\x1b[36mDetected System RAM: ${ram} GB\x1b[0m\n`);
  console.log("\x1b[32m=== Recommended for your hardware ===\x1b[0m");
  recommended.forEach((m, idx) => console.log(`  [${idx + 1}] ${m.name} (${m.size})`));

  if (compatible.length > 0) {
    console.log("\n\x1b[33m=== Other Available Models ===\x1b[0m");
    compatible.forEach((m, idx) => console.log(`  [${recommended.length + idx + 1}] ${m.name} (${m.size})`));
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
      const currentUri = getSelectedModelUri();

      if (currentUri && currentUri !== selected.uri) {
        const rl2 = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl2.question("Do you want to KEEP existing downloaded models? (y/n): ", (keepAns) => {
          rl2.close();
          if (keepAns.trim().toLowerCase() === 'n') {
            if (fs.existsSync(MODELS_DIR)) {
              fs.readdirSync(MODELS_DIR).forEach(f => fs.unlinkSync(path.join(MODELS_DIR, f)));
              console.log("\x1b[33mPrevious model files cleared.\x1b[0m");
            }
          }
          saveJson(CONFIG_FILE, { activeModelUri: selected.uri });
          console.log(`\x1b[32mActive model set to: ${selected.name}\x1b[0m`);
          resolve();
        });
      } else {
        saveJson(CONFIG_FILE, { activeModelUri: selected.uri });
        console.log(`\x1b[32mActive model set to: ${selected.name}\x1b[0m`);
        resolve();
      }
    });
  });
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
    const memoryPrompt = "Analyze our conversation. Did the user share personal facts or preferences? Return concise summary or 'NONE'.";
    let memoryResult = "";
    await session.prompt(memoryPrompt, { onTextChunk(chunk) { memoryResult += chunk; } });

    const cleanMemory = memoryResult.trim();
    if (cleanMemory && !cleanMemory.includes("NONE")) {
      const currentMemory = loadJson(USER_MEMORY_FILE, []);
      currentMemory.push(cleanMemory);
      saveJson(USER_MEMORY_FILE, currentMemory);
      console.log(`\x1b[32m✔ New Fact Remembered: "${cleanMemory}"\x1b[0m`);
    }

    const reflectionPrompt = "Did you make any mistakes in this chat session? Return a new rule or 'NO_CHANGE'.";
    let reflectionResult = "";
    await session.prompt(reflectionPrompt, { onTextChunk(chunk) { reflectionResult += chunk; } });

    const cleanReflection = reflectionResult.trim();
    if (cleanReflection && !cleanReflection.includes("NO_CHANGE")) {
      const currentRules = loadJson(RULES_FILE, []);
      currentRules.push(cleanReflection);
      saveJson(RULES_FILE, currentRules);
      console.log(`\x1b[32m✔ Self-Improvement Learned: "${cleanReflection}"\x1b[0m`);
    }
  } catch (err) {
    console.log("\x1b[31mPost-session processing skipped.\x1b[0m");
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
  console.log("3. \x1b[32mf --model\x1b[0m   Switch, download, or clear local GGUF models.");
  console.log("4. \x1b[32mf --memory\x1b[0m  View and edit facts Freeleo remembers about you.");
  console.log("5. \x1b[32mf --rules\x1b[0m   View and edit self-improved behavioral guidelines.");
  console.log("6. \x1b[32mf --expose\x1b[0m  Run local HTTP REST server on localhost:5000.");
  console.log("7. \x1b[32mf --api\x1b[0m     Expose local server publicly using Localtunnel & API Key.");
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
      }

      if (trimmed) {
        process.stdout.write("\x1b[34mAI > \x1b[0m");
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
