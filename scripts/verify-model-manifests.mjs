import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestDir = rootPath("models/manifests");
const devRoot = rootPath("models/dev");
const errors = [];
const modelIds = new Set();

function rootPath(relativePath) {
  return resolve(root, relativePath);
}

function fail(message) {
  errors.push(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function assertString(value, message) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(message);
  }
}

function assertPathInsideRoot(relativePath, fieldName) {
  assertString(relativePath, `${fieldName} must be a non-empty relative path.`);
  const absolute = rootPath(relativePath);
  const relativeToRoot = relative(root, absolute);
  if (
    relativeToRoot === "" ||
    relativeToRoot.startsWith("..") ||
    relativeToRoot.split(sep).includes("..")
  ) {
    fail(`${fieldName} must stay inside the repository: ${relativePath}`);
  }
  return absolute;
}

function listFiles(path) {
  if (!existsSync(path)) {
    return [];
  }

  const files = [];
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const absolute = resolve(path, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolute));
    } else {
      files.push(absolute);
    }
  }
  return files;
}

function toRepoPath(path) {
  return relative(root, path).split(sep).join("/");
}

function gitStatus(args) {
  return spawnSync("git", ["-C", root, ...args], { stdio: "ignore" }).status;
}

function isGitIgnored(path) {
  return gitStatus(["check-ignore", "-q", "--", toRepoPath(path)]) === 0;
}

function isGitTracked(path) {
  return gitStatus(["ls-files", "--error-unmatch", "--", toRepoPath(path)]) === 0;
}

if (!existsSync(manifestDir)) {
  fail("models/manifests directory is missing.");
} else {
  const manifestFiles = readdirSync(manifestDir)
    .filter((name) => name.endsWith(".json"))
    .sort();

  if (manifestFiles.length === 0) {
    fail("models/manifests must contain at least one JSON manifest.");
  }

  for (const filename of manifestFiles) {
    const manifestPath = resolve(manifestDir, filename);
    const manifest = readJson(manifestPath);

    if (manifest.schemaVersion !== "diplomat.modelManifest.v1") {
      fail(`${filename}: schemaVersion must be diplomat.modelManifest.v1.`);
    }

    assertString(manifest.modelId, `${filename}: modelId is required.`);
    if (modelIds.has(manifest.modelId)) {
      fail(`${filename}: duplicate modelId ${manifest.modelId}.`);
    }
    modelIds.add(manifest.modelId);

    assertString(manifest.name, `${filename}: name is required.`);
    assertString(manifest.task, `${filename}: task is required.`);
    assertString(manifest.runtime, `${filename}: runtime is required.`);
    assertString(manifest.provider, `${filename}: provider is required.`);
    assertString(manifest.source?.repoId, `${filename}: source.repoId is required.`);
    assertString(manifest.source?.revision, `${filename}: source.revision is required.`);
    assertString(manifest.source?.url, `${filename}: source.url is required.`);
    assertString(manifest.license?.name, `${filename}: license.name is required.`);
    assertString(manifest.license?.url, `${filename}: license.url is required.`);

    const developmentPath = assertPathInsideRoot(
      manifest.developmentPath,
      `${filename}: developmentPath`
    );
    if (!existsSync(developmentPath)) {
      fail(`${filename}: developmentPath does not exist: ${manifest.developmentPath}`);
    }
    if (!existsSync(resolve(developmentPath, ".gitkeep"))) {
      fail(`${filename}: developmentPath must contain .gitkeep.`);
    }

    if (!Array.isArray(manifest.expectedFiles) || manifest.expectedFiles.length === 0) {
      fail(`${filename}: expectedFiles must be a non-empty array.`);
    } else {
      for (const expectedFile of manifest.expectedFiles) {
        assertString(expectedFile, `${filename}: every expectedFiles entry must be a string.`);
      }
    }

    if (manifest.license?.acceptanceRequired) {
      assertPathInsideRoot(
        manifest.license.acceptanceRecord,
        `${filename}: license.acceptanceRecord`
      );
    }

    if (manifest.weightsIgnoredByGit !== true) {
      fail(`${filename}: weightsIgnoredByGit must be true.`);
    }
  }
}

for (const file of listFiles(devRoot)) {
  if (file.endsWith(`${sep}.gitkeep`)) {
    continue;
  }
  if (statSync(file).isFile()) {
    const repoPath = toRepoPath(file);
    if (isGitTracked(file)) {
      fail(`models/dev file must not be tracked by Git: ${repoPath}`);
    }
    if (!isGitIgnored(file)) {
      fail(`models/dev file is not ignored by Git: ${repoPath}`);
    }
  }
}

if (errors.length > 0) {
  console.error("Model manifest verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Verified ${modelIds.size} model manifests.`);
