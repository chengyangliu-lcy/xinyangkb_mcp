#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);
const PROJECT_DIR = path.resolve(__dirname, "..");
const PLUGIN_DIR = path.join(PROJECT_DIR, "plugins", "xinyang-kb");
const BUNDLE_FILE = path.join(PLUGIN_DIR, "dist", "index.js");
const SKILL_SRC = path.join(
  PLUGIN_DIR,
  "skills",
  "xinyang-assistant",
  "SKILL.md"
);
const IS_WIN = process.platform === "win32";

function getArg(name) {
  const index = args.indexOf(name);
  if (index !== -1 && index < args.length - 1) return args[index + 1];
  const equalsArg = args.find((arg) => arg.startsWith(`${name}=`));
  return equalsArg ? equalsArg.slice(name.length + 1) : null;
}

function hasFlag(name) {
  return args.includes(name);
}

function usage() {
  console.log(`
Usage:
  node scripts/install.cjs --api-url <URL> [options]

Options:
  --api-base <URL>            API base URL. Required unless --api-url ends in /search/dify.
  --no-proxy <hosts>          Optional no_proxy value.
  --codex-mode <mode>         direct, plugin, or both (default: direct).
  --no-codex                  Skip Codex installation.
  --no-opencode               Skip OpenCode installation.
  --help                      Show this help.
`);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function run(command, commandArgs, options = {}) {
  console.log(`  $ ${command} ${commandArgs.join(" ")}`);
  const resolved = resolveCommand(command);
  if (!resolved) {
    if (options.allowFailure) return "";
    fail(`command not found: ${command}`);
  }
  const result = spawnSync(resolved.command, [
    ...resolved.prefixArgs,
    ...commandArgs,
  ], {
    cwd: options.cwd ?? PROJECT_DIR,
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error && !options.allowFailure) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    fail(`${command} exited with status ${result.status}`);
  }
  return options.capture
    ? `${result.stdout ?? ""}${result.stderr ?? ""}`.trim()
    : "";
}

function resolveCommand(command) {
  const probe = spawnSync(IS_WIN ? "where.exe" : "which", [command], {
    encoding: "utf8",
  });
  if (probe.status !== 0) return null;
  const candidates = probe.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!IS_WIN) {
    return candidates[0]
      ? { command: candidates[0], prefixArgs: [] }
      : null;
  }

  const nativeExecutable = candidates.find((candidate) =>
    /\.(exe|com)$/i.test(candidate)
  );
  if (nativeExecutable) {
    return { command: nativeExecutable, prefixArgs: [] };
  }

  const cmdShim = candidates.find((candidate) => /\.cmd$/i.test(candidate));
  if (!cmdShim) return null;

  const shim = fs.readFileSync(cmdShim, "utf8");
  const targetMatches = [
    ...shim.matchAll(/"%dp0%\\([^"]+)"\s+(?:%|\s|$)/gi),
  ];
  const relativeTarget = targetMatches.at(-1)?.[1];
  if (!relativeTarget) return null;

  const target = path.resolve(path.dirname(cmdShim), relativeTarget);
  if (/\.js$/i.test(target)) {
    return { command: process.execPath, prefixArgs: [target] };
  }
  if (/\.exe$/i.test(target)) {
    return { command: target, prefixArgs: [] };
  }
  return null;
}

function commandExists(command) {
  return resolveCommand(command) !== null;
}

function backupFile(file) {
  if (!fs.existsSync(file)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${file}.backup-${stamp}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function writeJsonWithBackup(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const backup = backupFile(file);
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  if (backup) console.log(`  Backup: ${backup}`);
}

function deriveApiBase(apiUrl) {
  const parsed = new URL(apiUrl);
  const suffix = "/search/dify";
  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  if (!parsed.pathname.endsWith(suffix)) return null;
  parsed.pathname = parsed.pathname.slice(0, -suffix.length) || "/";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

if (hasFlag("--help")) {
  usage();
  process.exit(0);
}

const API_URL = getArg("--api-url");
if (!API_URL) {
  usage();
  fail("--api-url is required");
}

try {
  const parsed = new URL(API_URL);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("unsupported protocol");
  }
} catch {
  fail("--api-url must be an absolute HTTP(S) URL");
}

const API_BASE = getArg("--api-base") || deriveApiBase(API_URL);
if (!API_BASE) {
  fail("--api-base is required when --api-url does not end in /search/dify");
}

try {
  const parsed = new URL(API_BASE);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("unsupported protocol");
  }
} catch {
  fail("--api-base must be an absolute HTTP(S) URL");
}

const NO_PROXY = getArg("--no-proxy");
const CODEX_MODE = getArg("--codex-mode") || "direct";
if (!["direct", "plugin", "both"].includes(CODEX_MODE)) {
  fail("--codex-mode must be direct, plugin, or both");
}

if (!fs.existsSync(BUNDLE_FILE)) {
  fail(`runtime bundle is missing: ${BUNDLE_FILE}. Run npm run build first`);
}

const HAS_CODEX = !hasFlag("--no-codex") && commandExists("codex");
const HAS_OPENCODE =
  !hasFlag("--no-opencode") && commandExists("opencode");
if (!HAS_CODEX && !HAS_OPENCODE) {
  fail("neither Codex nor OpenCode was detected or both were skipped");
}

const runtimeConfigFile = path.join(
  os.homedir(),
  ".config",
  "xinyang-kb",
  "config.json"
);
writeJsonWithBackup(runtimeConfigFile, {
  searchApiUrl: API_URL,
  apiServerBaseUrl: API_BASE,
});
console.log(`  Runtime config: ${runtimeConfigFile}`);

if (HAS_CODEX) {
  if (CODEX_MODE === "direct" || CODEX_MODE === "both") {
    console.log("\nInstalling Codex MCP directly...");
    run("codex", ["mcp", "remove", "xinyang-kb"], { allowFailure: true });
    const envArgs = [
      "--env",
      `SEARCH_API_URL=${API_URL}`,
      "--env",
      `API_SERVER_BASE_URL=${API_BASE}`,
    ];
    if (NO_PROXY) envArgs.push("--env", `no_proxy=${NO_PROXY}`);
    run("codex", [
      "mcp",
      "add",
      "xinyang-kb",
      ...envArgs,
      "--",
      "node",
      BUNDLE_FILE,
    ]);

    const skillDir = path.join(
      os.homedir(),
      ".codex",
      "skills",
      "xinyang-assistant"
    );
    fs.mkdirSync(skillDir, { recursive: true });
    fs.copyFileSync(SKILL_SRC, path.join(skillDir, "SKILL.md"));
    console.log(`  Skill installed: ${skillDir}`);
  }

  if (CODEX_MODE === "plugin" || CODEX_MODE === "both") {
    console.log("\nInstalling Codex plugin...");
    const marketplaces = run(
      "codex",
      ["plugin", "marketplace", "list"],
      { capture: true, allowFailure: true }
    );
    if (!marketplaces.includes(PROJECT_DIR)) {
      run("codex", ["plugin", "marketplace", "add", PROJECT_DIR]);
    }
    run(
      "codex",
      ["plugin", "remove", "xinyang-kb@xinyang-internal"],
      { allowFailure: true }
    );
    run("codex", ["plugin", "add", "xinyang-kb@xinyang-internal"]);
  }
} else if (!hasFlag("--no-codex")) {
  console.log("\nSKIP: Codex CLI not found");
}

if (HAS_OPENCODE) {
  console.log("\nInstalling OpenCode...");
  const configDir = path.join(os.homedir(), ".config", "opencode");
  const configFile = path.join(configDir, "opencode.json");
  let config = { $schema: "https://opencode.ai/config.json", mcp: {} };

  if (fs.existsSync(configFile)) {
    try {
      const rawConfig = fs
        .readFileSync(configFile, "utf8")
        .replace(/^\uFEFF/, "");
      config = JSON.parse(rawConfig);
    } catch (error) {
      fail(
        `existing OpenCode config is invalid; it was not modified: ${configFile} (${error.message})`
      );
    }
  }

  if (!config.mcp || typeof config.mcp !== "object") config.mcp = {};
  const environment = {
    SEARCH_API_URL: API_URL,
    API_SERVER_BASE_URL: API_BASE,
  };
  if (NO_PROXY) environment.no_proxy = NO_PROXY;

  config.mcp["xinyang-kb"] = {
    type: "local",
    command: ["node", BUNDLE_FILE],
    enabled: true,
    environment,
  };

  const instructionDir = path.join(configDir, "skills");
  const instructionFile = path.join(
    instructionDir,
    "xinyang-assistant.md"
  );
  fs.mkdirSync(instructionDir, { recursive: true });
  fs.copyFileSync(SKILL_SRC, instructionFile);

  const instructionRef = path.join("skills", "xinyang-assistant.md");
  if (!Array.isArray(config.instructions)) config.instructions = [];
  if (!config.instructions.includes(instructionRef)) {
    config.instructions.push(instructionRef);
  }

  writeJsonWithBackup(configFile, config);
  console.log(`  OpenCode config updated: ${configFile}`);
  console.log(`  OpenCode skill installed: ${instructionFile}`);
} else if (!hasFlag("--no-opencode")) {
  console.log("\nSKIP: OpenCode not found");
}

console.log("\nInstallation complete. Restart Codex/OpenCode and start a new session.");
