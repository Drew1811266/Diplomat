import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expectedVersion = "0.37.0";

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function matchVersion(relativePath, pattern) {
  return readText(relativePath).match(pattern)?.[1] ?? null;
}

function cargoLockPackageVersion(packageName) {
  const lock = readText("apps/desktop/src-tauri/Cargo.lock");
  const packageBlocks = lock.split(/\r?\n\[\[package\]\]\r?\n/g);
  for (const block of packageBlocks) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    if (name === packageName) {
      return block.match(/^version = "([^"]+)"/m)?.[1] ?? null;
    }
  }
  return null;
}

const checks = [
  ["package.json", readJson("package.json").version],
  ["apps/web/package.json", readJson("apps/web/package.json").version],
  ["apps/desktop/package.json", readJson("apps/desktop/package.json").version],
  ["packages/shared/package.json", readJson("packages/shared/package.json").version],
  ["apps/desktop/src-tauri/tauri.conf.json", readJson("apps/desktop/src-tauri/tauri.conf.json").version],
  [
    "apps/desktop/src-tauri/Cargo.toml",
    matchVersion("apps/desktop/src-tauri/Cargo.toml", /^version = "([^"]+)"/m)
  ],
  ["apps/desktop/src-tauri/Cargo.lock:diplomat", cargoLockPackageVersion("diplomat")],
  ["worker/pyproject.toml", matchVersion("worker/pyproject.toml", /^version = "([^"]+)"/m)],
  [
    "worker/diplomat_worker/__init__.py",
    matchVersion("worker/diplomat_worker/__init__.py", /__version__ = "([^"]+)"/)
  ]
];

const failures = checks.filter(([, actual]) => actual !== expectedVersion);
if (!readText("README.md").includes("Current project version: **0.37.0**")) {
  failures.push(["README.md", "missing 0.37.0 version line"]);
}

if (failures.length > 0) {
  console.error("Version verification failed:");
  for (const [file, actual] of failures) {
    console.error(`- ${file}: ${actual ?? "missing"} !== ${expectedVersion}`);
  }
  process.exit(1);
}

console.log(`All release version metadata matches ${expectedVersion}.`);
