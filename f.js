#!/usr/bin/env node

import { getLlama, resolveModelFile, LlamaChatSession, defineChatSessionFunction } from "node-llama-cpp";
import readline from "readline";
import path from "path";
import fs from "fs";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODELS_DIR = path.join(__dirname, "models");
const HISTORY_DIR = path.join(__dirname, "history");
const MEMORY_DIR = path.join(__dirname, "memory");
const INTEGRATIONS_DIR = path.join(__dirname, "integrations");

const RULES_FILE = path.join(MEMORY_DIR, "system_rules.json");
const USER_MEMORY_FILE = path.join(MEMORY_DIR, "user_memory.json");

const MODEL_URI = "hf:Qwen/Qwen2.5-3B-Instruct-GGUF/qwen2.5-3b-instruct-q4_k_m.gguf";

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
  const llama = await getLlama({ gpu: "auto" });
  const modelPath = await resolveModelFile(MODEL_URI, MODELS_DIR);
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

  const systemPrompt = "You are Freeleo CLI, a self-improving local AI assistant with long-term memory and external tool connectivity.\n\n" +
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

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

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

if (args.includes("--connect")) {
  startChat(true);
} else if (args.includes("--chat") || args.includes("-c")) {
  startChat(false);
} else if (args.includes("--list") || args.includes("-l")) {
  listHistories();
} else if (args.includes("--resume") || args.includes("-r")) {
  const idx = args.indexOf("--resume") !== -1 ? args.indexOf("--resume") : args.indexOf("-r");
  startChat(false, args[idx + 1]);
} else if (args.includes("--memory")) {
  console.log(loadJson(USER_MEMORY_FILE, []));
} else if (args.includes("--rules")) {
  console.log(loadJson(RULES_FILE, []));
} else {
  console.log("Freeleo CLI Commands:");
  console.log("  f --chat              Start standard local AI chat session");
  console.log("  f --connect           Start chat connected to web search & system tools");
  console.log("  f --list              List all saved chat sessions");
  console.log("  f --resume <id>       Resume a past session");
  console.log("  f --memory            View stored facts about you");
  console.log("  f --rules             View self-improved AI rules");
}
