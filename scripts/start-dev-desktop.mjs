#!/usr/bin/env node
import { spawn, execFileSync } from "node:child_process";
import { appendFileSync, createWriteStream, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  WEB_DEV_URL,
  WORKER_HEALTH_URL,
  assertRepositoryRoot,
  buildWorkerLaunch,
  developmentProcessRoot,
  isDiplomatWorkerHealthPayload,
  isSafeDiplomatDevProcess,
  parseLauncherArgs,
  resolveNativeCommand,
  selectDevelopmentModelRoot,
  selectDevelopmentMediaTools,
  selectRustToolchain
} from "./dev-launch-utils.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = parseLauncherArgs(process.argv.slice(2));
const repoRoot = path.resolve(args.repo ?? path.resolve(scriptDir, ".."));
const processRoot = developmentProcessRoot(repoRoot);
const logDir = path.join(repoRoot, ".dev", "runtime-logs");

function usage() {
  console.log(`Usage: node scripts/start-dev-desktop.mjs [--repo=<path>] [--no-clean] [--timeout-ms=90000]

Starts the current Diplomat development desktop app from this checkout.

Default behavior:
  - stops existing Diplomat development processes on ports 1420 and 8765
  - starts the local Worker on http://127.0.0.1:8765
  - starts Tauri dev, which starts the Web dev server on http://localhost:1420
  - waits until Worker and Web health checks succeed

Environment overrides:
  DIPLOMAT_RUST_TOOLCHAIN   Rust toolchain for Tauri dev
  RUSTUP_TOOLCHAIN          respected when DIPLOMAT_RUST_TOOLCHAIN is not set

Options:
  --repo=<path>              Start a specific checkout/worktree
`);
}

function log(message) {
  const timestamp = new Date().toISOString().slice(11, 19);
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(path.join(logDir, "launcher.log"), `${line}\n`);
  } catch {
    // Console output still carries the status if the log file cannot be written.
  }
}

function ensureLogDir() {
  mkdirSync(logDir, { recursive: true });
}

function getInstalledRustToolchains() {
  try {
    return execFileSync("rustup", ["toolchain", "list"], {
      cwd: repoRoot,
      encoding: "utf8"
    })
      .split(/\r?\n/)
      .map((line) => line.trim().split(/\s+/)[0])
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runPowerShellJson(command) {
  const output = execFileSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command],
    {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true
    }
  ).trim();

  if (!output) {
    return [];
  }

  const parsed = JSON.parse(output);
  return Array.isArray(parsed) ? parsed : [parsed];
}

function listCandidateProcesses() {
  const command = `
$ErrorActionPreference = "SilentlyContinue"
$portPids = @(Get-NetTCPConnection -State Listen -LocalPort 1420,8765 | Select-Object -ExpandProperty OwningProcess -Unique)
$desktopPids = @(Get-Process diplomat | Select-Object -ExpandProperty Id)
$candidatePids = @($portPids + $desktopPids) | Where-Object { $_ -and $_ -gt 0 } | Select-Object -Unique
$items = foreach ($candidatePid in $candidatePids) {
  Get-CimInstance Win32_Process -Filter "ProcessId=$candidatePid" |
    Select-Object @{Name="processId";Expression={[int]$_.ProcessId}}, @{Name="name";Expression={$_.Name}}, @{Name="executablePath";Expression={$_.ExecutablePath}}, @{Name="commandLine";Expression={$_.CommandLine}}
}
@($items) | ConvertTo-Json -Compress
`;
  return runPowerShellJson(command);
}

function stopProcessTree(processId) {
  try {
    execFileSync("taskkill", ["/PID", String(processId), "/T", "/F"], {
      cwd: repoRoot,
      stdio: "ignore",
      windowsHide: true
    });
  } catch {
    log(`Process ${processId} was already stopped before cleanup reached it.`);
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function stopKnownDevelopmentProcesses() {
  const candidates = listCandidateProcesses();
  const safeProcesses = candidates.filter((processInfo) =>
    isSafeDiplomatDevProcess(processInfo, processRoot)
  );

  if (safeProcesses.length === 0) {
    log("No stale Diplomat development processes found.");
    return;
  }

  for (const processInfo of safeProcesses) {
    log(`Stopping stale ${processInfo.name} process ${processInfo.processId}.`);
    stopProcessTree(processInfo.processId);
  }

  await sleep(1200);
}

function tailFile(filePath, maxChars = 4000) {
  if (!existsSync(filePath)) {
    return "";
  }
  const content = readFileSync(filePath, "utf8");
  return content.slice(Math.max(0, content.length - maxChars));
}

async function fetchText(url) {
  const response = await fetch(url, { cache: "no-store" });
  return {
    ok: response.ok,
    status: response.status,
    text: await response.text()
  };
}

async function waitForHttp({ url, label, timeoutMs, accept }) {
  const startedAt = Date.now();
  let lastError = "";

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await fetchText(url);
      if (result.ok && accept(result.text)) {
        return result.text;
      }
      lastError = `${label} returned HTTP ${result.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(750);
  }

  throw new Error(`${label} did not become ready at ${url}. Last error: ${lastError}`);
}

function spawnLoggedProcess({ command, args: commandArgs, cwd, env, logName }) {
  const resolvedCommand = resolveNativeCommand(command);
  const stdoutPath = path.join(logDir, `${logName}.stdout.log`);
  const stderrPath = path.join(logDir, `${logName}.stderr.log`);
  const stdout = createWriteStream(stdoutPath, { flags: "a" });
  const stderr = createWriteStream(stderrPath, { flags: "a" });

  stdout.write(
    `\n\n--- ${new Date().toISOString()} ${resolvedCommand} ${commandArgs.join(" ")} ---\n`
  );
  stderr.write(
    `\n\n--- ${new Date().toISOString()} ${resolvedCommand} ${commandArgs.join(" ")} ---\n`
  );

  const child = spawn(resolvedCommand, commandArgs, {
    cwd,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32" && resolvedCommand.endsWith(".cmd"),
    windowsHide: false
  });

  child.stdout.pipe(stdout);
  child.stderr.pipe(stderr);

  child.on("exit", (code, signal) => {
    log(`${logName} exited with code ${code ?? "null"} signal ${signal ?? "null"}.`);
  });
  child.on("error", (error) => {
    log(`${logName} failed to start: ${error.message}`);
  });

  return { child, stdoutPath, stderrPath };
}

async function main() {
  if (args.help) {
    usage();
    return;
  }

  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 5000) {
    throw new Error("--timeout-ms must be at least 5000.");
  }

  assertRepositoryRoot(repoRoot);
  ensureLogDir();

  const modelRoot = selectDevelopmentModelRoot(repoRoot);
  const mediaTools = selectDevelopmentMediaTools(repoRoot);
  const rustToolchain = selectRustToolchain({
    requested: process.env.DIPLOMAT_RUST_TOOLCHAIN ?? process.env.RUSTUP_TOOLCHAIN ?? "",
    installedToolchains: getInstalledRustToolchains()
  });
  const cargoTargetDir = path.join(
    repoRoot,
    ".dev",
    "cargo-target",
    rustToolchain ?? "default"
  );

  log(`Repository: ${repoRoot}`);
  log(`Process cleanup root: ${processRoot}`);
  log(`Model root: ${modelRoot}`);
  log(`Models dir: ${path.join(modelRoot, "models")}`);
  log(`FFmpeg: ${mediaTools.ffmpegPath}`);
  log(`FFprobe: ${mediaTools.ffprobePath}`);
  log(`Logs: ${logDir}`);
  if (rustToolchain) {
    log(`Rust toolchain: ${rustToolchain}`);
  }

  if (args.clean) {
    await stopKnownDevelopmentProcesses();
  } else {
    log("Skipping stale process cleanup because --no-clean was supplied.");
  }

  const baseEnv = {
    ...process.env,
    DIPLOMAT_DEVELOPMENT_MODEL_ROOT: modelRoot,
    DIPLOMAT_MODELS_DIR: path.join(modelRoot, "models"),
    DIPLOMAT_FFMPEG_PATH: mediaTools.ffmpegPath,
    DIPLOMAT_FFPROBE_PATH: mediaTools.ffprobePath,
    CARGO_TARGET_DIR: cargoTargetDir
  };
  if (rustToolchain) {
    baseEnv.RUSTUP_TOOLCHAIN = rustToolchain;
  }

  const workerLaunch = buildWorkerLaunch({ repoRoot, modelRoot, mediaTools });
  const worker = spawnLoggedProcess({
    command: workerLaunch.command,
    args: workerLaunch.args,
    cwd: workerLaunch.cwd,
    env: { ...baseEnv, ...workerLaunch.env },
    logName: "worker"
  });
  log(`Starting Worker. stdout: ${worker.stdoutPath}`);

  try {
    await waitForHttp({
      url: WORKER_HEALTH_URL,
      label: "Worker health",
      timeoutMs: args.timeoutMs,
      accept: isDiplomatWorkerHealthPayload
    });
  } catch (error) {
    console.error(tailFile(worker.stderrPath));
    throw error;
  }
  log(`Worker ready: ${WORKER_HEALTH_URL}`);

  const desktop = spawnLoggedProcess({
    command: "corepack",
    args: ["pnpm", "--dir", "apps/desktop", "dev"],
    cwd: repoRoot,
    env: baseEnv,
    logName: "desktop"
  });
  log(`Starting desktop dev shell. stdout: ${desktop.stdoutPath}`);

  try {
    await waitForHttp({
      url: WEB_DEV_URL,
      label: "Web dev server",
      timeoutMs: args.timeoutMs,
      accept: (payload) => payload.includes("<!doctype html") || payload.includes("<div id=\"root\"")
    });
  } catch (error) {
    console.error(tailFile(desktop.stderrPath));
    throw error;
  }
  log(`Web dev server ready: ${WEB_DEV_URL}`);
  log("Diplomat desktop development app is starting from the current checkout.");
  log("Keep this process open while using the app. Press Ctrl+C to stop the launcher.");

  await new Promise((resolve, reject) => {
    desktop.child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve();
      } else {
        reject(new Error(`Desktop dev process exited with code ${code}.`));
      }
    });
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  try {
    mkdirSync(logDir, { recursive: true });
    appendFileSync(path.join(logDir, "launcher.log"), `[error] ${message}\n`);
  } catch {
    // Keep the original error visible on stderr if log writing fails.
  }
  console.error(message);
  process.exit(1);
});
