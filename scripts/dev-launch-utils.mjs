import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const WORKER_PORT = 8765;
export const WEB_PORT = 1420;
export const WORKER_HEALTH_URL = `http://127.0.0.1:${WORKER_PORT}/health`;
export const WEB_DEV_URL = `http://localhost:${WEB_PORT}`;
export const COMPATIBLE_RUST_TOOLCHAIN = "1.92.0-x86_64-pc-windows-msvc";

export function parseLauncherArgs(argv) {
  const options = {
    clean: true,
    help: false,
    repo: null,
    timeoutMs: 90000
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "--no-clean" || arg === "-NoClean") {
      options.clean = false;
    } else if (arg.startsWith("--repo=")) {
      options.repo = arg.slice("--repo=".length);
    } else if (arg === "--repo") {
      index += 1;
      const repo = argv[index];
      if (!repo) {
        throw new Error("--repo requires a path.");
      }
      options.repo = repo;
    } else if (arg.startsWith("--timeout-ms=")) {
      options.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    } else if (arg === "--help" || arg === "-h" || arg === "/?") {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

export function resolveNativeCommand(command, platform = process.platform) {
  if (platform === "win32" && ["corepack", "pnpm", "npm", "npx"].includes(command)) {
    return `${command}.cmd`;
  }
  return command;
}

function normalizeForCompare(value) {
  return path.resolve(value).replaceAll("\\", "/").toLowerCase();
}

function isPathInside(candidate, parent) {
  const normalizedCandidate = normalizeForCompare(candidate);
  const normalizedParent = normalizeForCompare(parent);
  return (
    normalizedCandidate === normalizedParent ||
    normalizedCandidate.startsWith(`${normalizedParent}/`)
  );
}

function containsNonPlaceholderFile(directory, remainingDepth = 8) {
  if (!existsSync(directory) || remainingDepth < 0) {
    return false;
  }

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const childPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name !== ".gitkeep") {
      return true;
    }
    if (entry.isDirectory() && containsNonPlaceholderFile(childPath, remainingDepth - 1)) {
      return true;
    }
  }

  return false;
}

function parentWorkspaceForWorktree(repoRoot) {
  const worktreesDir = path.dirname(repoRoot);
  if (path.basename(worktreesDir) !== ".worktrees") {
    return null;
  }
  return path.dirname(worktreesDir);
}

export function developmentProcessRoot(repoRoot) {
  return path.resolve(parentWorkspaceForWorktree(path.resolve(repoRoot)) ?? repoRoot);
}

export function selectDevelopmentModelRoot(repoRoot) {
  const resolvedRoot = path.resolve(repoRoot);
  if (containsNonPlaceholderFile(path.join(resolvedRoot, "models", "dev"))) {
    return resolvedRoot;
  }

  const parentWorkspace = parentWorkspaceForWorktree(resolvedRoot);
  if (
    parentWorkspace &&
    containsNonPlaceholderFile(path.join(parentWorkspace, "models", "dev"))
  ) {
    return parentWorkspace;
  }

  return resolvedRoot;
}

export function selectRustToolchain({ requested, installedToolchains }) {
  const trimmedRequest = requested?.trim();
  if (trimmedRequest) {
    return trimmedRequest;
  }

  return installedToolchains.some((toolchain) => toolchain.trim() === COMPATIBLE_RUST_TOOLCHAIN)
    ? COMPATIBLE_RUST_TOOLCHAIN
    : null;
}

export function isDiplomatWorkerHealthPayload(payload) {
  return typeof payload === "string" && payload.includes('"diplomat-worker"');
}

export function isSafeDiplomatDevProcess(processInfo, repoRoot) {
  const name = processInfo.name?.toLowerCase() ?? "";
  const executablePath = processInfo.executablePath ?? "";
  const commandLine = processInfo.commandLine ?? "";
  const haystack = `${executablePath}\n${commandLine}`;
  const normalizedHaystack = haystack.replaceAll("\\", "/").toLowerCase();
  const normalizedRepoRoot = normalizeForCompare(repoRoot);

  if (name === "diplomat.exe" && executablePath && isPathInside(executablePath, repoRoot)) {
    return true;
  }

  if (
    name === "node.exe" &&
    commandLine.includes("vite") &&
    normalizedHaystack.includes(normalizedRepoRoot)
  ) {
    return true;
  }

  if (name === "python.exe" && commandLine.includes("diplomat_worker.api.app:app")) {
    return true;
  }

  return false;
}

export function buildWorkerLaunch({ repoRoot, modelRoot }) {
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedModelRoot = path.resolve(modelRoot);

  return {
    command: "python",
    args: [
      "-m",
      "uvicorn",
      "diplomat_worker.api.app:app",
      "--app-dir",
      "worker",
      "--host",
      "127.0.0.1",
      "--port",
      String(WORKER_PORT)
    ],
    cwd: resolvedRepoRoot,
    env: {
      DIPLOMAT_DEVELOPMENT_MODEL_ROOT: resolvedModelRoot,
      DIPLOMAT_MODELS_DIR: path.join(resolvedModelRoot, "models")
    }
  };
}

export function assertRepositoryRoot(repoRoot) {
  for (const relativePath of [
    "package.json",
    path.join("apps", "desktop", "package.json"),
    path.join("apps", "web", "package.json"),
    path.join("worker", "diplomat_worker")
  ]) {
    const candidate = path.join(repoRoot, relativePath);
    if (!existsSync(candidate)) {
      throw new Error(`Missing expected Diplomat path: ${candidate}`);
    }
  }
}

export function ensureDirectoryPayload(pathToCheck) {
  return existsSync(pathToCheck) && statSync(pathToCheck).isDirectory();
}
