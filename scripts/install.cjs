#!/usr/bin/env node
/**
 * Xinyang KB MCP Server - Cross-platform installer
 * Supports Linux and Windows, auto-detects Codex and/or OpenCode.
 *
 * Usage:
 *   node scripts/install.js
 *   node scripts/install.js --api-url http://new-ip:5010/search/dify
 *   node scripts/install.js --no-codex --no-opencode (dry-run env check)
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const os = require("os");

const args = process.argv.slice(2);
const API_URL =
  getArg("--api-url") || "http://10.24.116.22:5010/search/dify";
const API_BASE = getArg("--api-base") || API_URL.replace("/search/dify", "");
const NO_PROXY = "10.24.116.22,59.77.39.46,localhost,127.0.0.1,::1";

const PROJECT_DIR = path.resolve(__dirname, "..");
const SOURCE_FILE = path.join(PROJECT_DIR, "src", "index.ts");
const SKILL_SRC = path.join(
  PROJECT_DIR,
  "skills",
  "xinyang-assistant",
  "SKILL.md"
);
const IS_WIN = os.platform() === "win32";

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx !== -1 && idx < args.length - 1) return args[idx + 1];
  const eq = args.find((a) => a.startsWith(name + "="));
  if (eq) return eq.slice(name.length + 1);
  return null;
}

function hasFlag(name) {
  return args.includes(name);
}

const SKIP_CODEX = hasFlag("--no-codex");
const SKIP_OPENCODE = hasFlag("--no-opencode");

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function run(cmd, opts = {}) {
  console.log(`  $ ${cmd}`);
  try {
    return execSync(cmd, {
      stdio: "pipe",
      encoding: "utf-8",
      ...opts,
    }).trim();
  } catch (e) {
    if (opts.ignoreError) return "";
    throw e;
  }
}

function which(cmd) {
  if (IS_WIN) {
    try {
      return run(`where ${cmd}`, { ignoreError: true });
    } catch {
      return "";
    }
  }
  try {
    return run(`which ${cmd}`, { ignoreError: true });
  } catch {
    return "";
  }
}

function print(label, msg) {
  console.log(`  ${label} ${msg}`);
}

function quotePath(p) {
  return IS_WIN ? `"${p}"` : p;
}

// ---------------------------------------------------------------------------
// Step 1: Check npm dependencies
// ---------------------------------------------------------------------------

console.log("");
console.log("========================================");
console.log(" Xinyang KB MCP Server - Installer");
console.log("========================================");
console.log(`  Platform: ${os.platform()} ${os.release()}`);
console.log(`  Project:  ${PROJECT_DIR}`);
console.log("");

console.log("[1/4] Checking dependencies...");
if (!fs.existsSync(path.join(PROJECT_DIR, "node_modules"))) {
  console.log("  Installing npm packages...");
  run("npm install", { cwd: PROJECT_DIR });
  print("OK", "npm dependencies installed");
} else {
  print("OK", "npm dependencies already installed");
}

// ---------------------------------------------------------------------------
// Step 2: Install for Codex CLI
// ---------------------------------------------------------------------------

let hasCodex = false;
if (!SKIP_CODEX) {
  const codexBin = which("codex");
  hasCodex = !!codexBin;
  if (hasCodex) {
    console.log("");
    console.log("[2/4] Installing for Codex CLI...");

    // Remove existing config first
    run(`codex mcp remove xinyang-kb`, { ignoreError: true });

    const envFlags = [
      `SEARCH_API_URL=${API_URL}`,
      `API_SERVER_BASE_URL=${API_BASE}`,
      `no_proxy=${NO_PROXY}`,
    ]
      .map((e) => `--env "${e}"`)
      .join(" ");

    const cmd = `codex mcp add xinyang-kb ${envFlags} -- npx tsx ${quotePath(SOURCE_FILE)}`;
    run(cmd, { cwd: PROJECT_DIR });
    print("OK", "Codex MCP server registered");

    // Install skill
    const skillDir = path.join(os.homedir(), ".codex", "skills", "xinyang-assistant");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.copyFileSync(SKILL_SRC, path.join(skillDir, "SKILL.md"));
    print("OK", `Skill installed to ${skillDir}`);
  } else {
    print("SKIP", "Codex CLI not found");
  }
} else {
  console.log("");
  console.log("[2/4] Skipping Codex (--no-codex)");
}

// ---------------------------------------------------------------------------
// Step 3: Install for OpenCode
// ---------------------------------------------------------------------------

let hasOpenCode = false;
if (!SKIP_OPENCODE) {
  const opencodeBin = which("opencode");
  hasOpenCode = !!opencodeBin;
  if (hasOpenCode) {
    console.log("");
    console.log("[3/4] Installing for OpenCode...");

    // Determine config path
    let configDir;
    if (IS_WIN) {
      configDir = path.join(process.env.APPDATA || "", "opencode");
    } else {
      configDir = path.join(os.homedir(), ".config", "opencode");
    }
    const configFile = path.join(configDir, "opencode.json");

    // Read or create config
    let config = { $schema: "https://opencode.ai/config.json", mcp: {} };
    if (fs.existsSync(configFile)) {
      try {
        config = JSON.parse(fs.readFileSync(configFile, "utf-8"));
      } catch {
        console.warn("  Warning: existing config is invalid JSON, overwriting");
        config = { $schema: "https://opencode.ai/config.json", mcp: {} };
      }
    }
    if (!config.mcp) config.mcp = {};

    config.mcp["xinyang-kb"] = {
      type: "local",
      command: ["npx", "tsx", SOURCE_FILE],
      enabled: true,
      environment: {
        SEARCH_API_URL: API_URL,
        API_SERVER_BASE_URL: API_BASE,
        no_proxy: NO_PROXY,
      },
    };

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
    print("OK", `OpenCode config updated: ${configFile}`);

    // Install instructions
    const instructionDir = path.join(configDir, "skills");
    fs.mkdirSync(instructionDir, { recursive: true });
    fs.copyFileSync(
      SKILL_SRC,
      path.join(instructionDir, "xinyang-assistant.md")
    );
    print("OK", `Skill installed to ${instructionDir}/xinyang-assistant.md`);

    // Add instruction reference to config (if not already present)
    const instrPath = path.join("skills", "xinyang-assistant.md");
    if (!config.instructions) config.instructions = [];
    if (!config.instructions.includes(instrPath)) {
      config.instructions.push(instrPath);
      fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
      print("OK", `Instruction reference added to config`);
    }
  } else {
    print("SKIP", "OpenCode not found");
  }
} else {
  console.log("");
  console.log("[3/4] Skipping OpenCode (--no-opencode)");
}

// ---------------------------------------------------------------------------
// Step 4: Summary
// ---------------------------------------------------------------------------

console.log("");
console.log("[4/4] Summary");
console.log("");

if (!hasCodex && !hasOpenCode) {
  console.log("  Neither Codex nor OpenCode was detected.");
  console.log("  Install one of them first, then re-run this script.");
  console.log("");
  if (IS_WIN) {
    console.log("  Manual installation:");
    console.log("  Codex:  codex mcp add xinyang-kb ...");
    console.log("  OpenCode: Add mcp config to your opencode.json");
  }
  process.exit(1);
}

console.log("  Installation complete!");
console.log("");
console.log("  Restart your AI assistant to pick up the changes.");
console.log("");

if (hasCodex) {
  console.log("  Codex:  codex mcp list");
}
if (hasOpenCode) {
  console.log("  OpenCode: opencode mcp list");
}
console.log("");
