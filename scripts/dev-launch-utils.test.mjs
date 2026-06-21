import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  buildWorkerLaunch,
  developmentProcessRoot,
  isDiplomatWorkerHealthPayload,
  isSafeDiplomatDevProcess,
  parseLauncherArgs,
  resolveNativeCommand,
  selectDevelopmentModelRoot,
  selectRustToolchain
} from "./dev-launch-utils.mjs";

function tempWorkspace() {
  return mkdtempSync(path.join(tmpdir(), "diplomat-launch-"));
}

test("selectDevelopmentModelRoot prefers the current checkout when it has model payloads", () => {
  const root = tempWorkspace();
  try {
    const modelDir = path.join(root, "models", "dev", "asr", "model");
    mkdirSync(modelDir, { recursive: true });
    writeFileSync(path.join(modelDir, "model.safetensors"), "payload");

    assert.equal(selectDevelopmentModelRoot(root), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("selectDevelopmentModelRoot falls back from a worktree to the parent workspace model store", () => {
  const root = tempWorkspace();
  try {
    const parentModelDir = path.join(root, "models", "dev", "translation", "model");
    const worktree = path.join(root, ".worktrees", "ui-v2-refactor");
    mkdirSync(parentModelDir, { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(path.join(parentModelDir, "model.bin"), "payload");

    assert.equal(selectDevelopmentModelRoot(worktree), root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("selectRustToolchain uses the pinned compatible toolchain when it is installed", () => {
  assert.equal(
    selectRustToolchain({
      requested: "",
      installedToolchains: ["stable-x86_64-pc-windows-msvc", "1.92.0-x86_64-pc-windows-msvc"]
    }),
    "1.92.0-x86_64-pc-windows-msvc"
  );
});

test("selectRustToolchain respects an explicit caller override", () => {
  assert.equal(
    selectRustToolchain({
      requested: "stable-x86_64-pc-windows-msvc",
      installedToolchains: ["1.92.0-x86_64-pc-windows-msvc"]
    }),
    "stable-x86_64-pc-windows-msvc"
  );
});

test("isSafeDiplomatDevProcess only matches known Diplomat development processes", () => {
  const repoRoot = path.resolve("D:/Software Project/Diplomat");
  assert.equal(
    isSafeDiplomatDevProcess(
      {
        processId: 1,
        name: "diplomat.exe",
        executablePath:
          "D:/Software Project/Diplomat/.worktrees/ui/apps/desktop/src-tauri/target/debug/diplomat.exe",
        commandLine: '"target\\debug\\diplomat.exe"'
      },
      repoRoot
    ),
    true
  );
  assert.equal(
    isSafeDiplomatDevProcess(
      {
        processId: 2,
        name: "node.exe",
        executablePath: "C:/Program Files/nodejs/node.exe",
        commandLine:
          'node "D:/Software Project/Diplomat/apps/web/node_modules/vite/bin/vite.js"'
      },
      repoRoot
    ),
    true
  );
  assert.equal(
    isSafeDiplomatDevProcess(
      {
        processId: 3,
        name: "python.exe",
        executablePath: "C:/Python/python.exe",
        commandLine:
          '"python" -m uvicorn diplomat_worker.api.app:app --app-dir worker --host 127.0.0.1 --port 8765'
      },
      repoRoot
    ),
    true
  );
  assert.equal(
    isSafeDiplomatDevProcess(
      {
        processId: 4,
        name: "node.exe",
        executablePath: "C:/Program Files/nodejs/node.exe",
        commandLine: 'node "D:/Other Project/app/node_modules/vite/bin/vite.js"'
      },
      repoRoot
    ),
    false
  );
});

test("buildWorkerLaunch points the worker at the selected project model directory", () => {
  const repoRoot = path.resolve("D:/Software Project/Diplomat");
  const modelRoot = path.resolve("D:/Software Project/Diplomat");
  const launch = buildWorkerLaunch({ repoRoot, modelRoot });

  assert.deepEqual(launch.args.slice(0, 4), [
    "-m",
    "uvicorn",
    "diplomat_worker.api.app:app",
    "--app-dir"
  ]);
  assert.equal(launch.cwd, repoRoot);
  assert.equal(launch.env.DIPLOMAT_DEVELOPMENT_MODEL_ROOT, modelRoot);
  assert.equal(launch.env.DIPLOMAT_MODELS_DIR, path.join(modelRoot, "models"));
});

test("isDiplomatWorkerHealthPayload recognizes the local runtime health payload", () => {
  assert.equal(
    isDiplomatWorkerHealthPayload('{"name":"diplomat-worker","status":"ok","version":"0.40.0"}'),
    true
  );
  assert.equal(isDiplomatWorkerHealthPayload('{"name":"other-service"}'), false);
});

test("parseLauncherArgs ignores package-manager separators and keeps launcher flags", () => {
  assert.deepEqual(parseLauncherArgs(["--", "--help"]), {
    clean: true,
    help: true,
    repo: null,
    timeoutMs: 90000
  });
  assert.deepEqual(parseLauncherArgs(["-NoClean", "--timeout-ms=120000", "--repo=D:/repo"]), {
    clean: false,
    help: false,
    repo: "D:/repo",
    timeoutMs: 120000
  });
  assert.deepEqual(parseLauncherArgs(["--repo", "D:/repo with spaces"]), {
    clean: true,
    help: false,
    repo: "D:/repo with spaces",
    timeoutMs: 90000
  });
});

test("resolveNativeCommand uses cmd shims for Windows package-manager executables", () => {
  assert.equal(resolveNativeCommand("corepack", "win32"), "corepack.cmd");
  assert.equal(resolveNativeCommand("python", "win32"), "python");
  assert.equal(resolveNativeCommand("corepack", "linux"), "corepack");
});

test("developmentProcessRoot expands a worktree target to the parent workspace", () => {
  assert.equal(
    developmentProcessRoot("D:/Software Project/Diplomat/.worktrees/ui-v2-refactor"),
    path.resolve("D:/Software Project/Diplomat")
  );
  assert.equal(
    developmentProcessRoot("D:/Software Project/Diplomat"),
    path.resolve("D:/Software Project/Diplomat")
  );
});

test("isSafeDiplomatDevProcess can clean main checkout processes for a worktree launch", () => {
  const processRoot = developmentProcessRoot(
    "D:/Software Project/Diplomat/.worktrees/ui-v2-refactor"
  );

  assert.equal(
    isSafeDiplomatDevProcess(
      {
        processId: 11,
        name: "diplomat.exe",
        executablePath:
          "D:/Software Project/Diplomat/.dev/cargo-target/1.92.0/debug/diplomat.exe",
        commandLine: '"diplomat.exe"'
      },
      processRoot
    ),
    true
  );
});
