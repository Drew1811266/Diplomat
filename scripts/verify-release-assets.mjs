import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const expectedVersion = "0.3.0";

const requiredIcons = ["icons/icon.ico", "icons/icon.png"];
const requiredReleaseDocs = [
  "0.3-acceptance-script.md",
  "0.3-packaging-checklist.md",
  "0.3-privacy-review.md",
  "0.3-model-audit.md",
  "0.3-ffmpeg-audit.md"
];

const errors = [];

function rootPath(relativePath) {
  return resolve(root, relativePath);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(rootPath(relativePath), "utf8"));
}

function expect(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

const tauriConfig = readJson("apps/desktop/src-tauri/tauri.conf.json");
const bundle = tauriConfig.bundle ?? {};
const bundleTargets = Array.isArray(bundle.targets) ? bundle.targets : [bundle.targets];
const bundleIcons = Array.isArray(bundle.icon) ? bundle.icon : [];

expect(bundle.active === true, "Tauri bundle.active must be true for the 0.3 desktop release.");
expect(bundleTargets.includes("nsis"), "Tauri bundle.targets must include the Windows nsis target.");

for (const icon of requiredIcons) {
  expect(bundleIcons.includes(icon), `Tauri bundle.icon must include ${icon}.`);
  expect(
    existsSync(rootPath(`apps/desktop/src-tauri/${icon}`)),
    `Tauri icon file is missing: apps/desktop/src-tauri/${icon}.`
  );
}

for (const doc of requiredReleaseDocs) {
  const relativePath = `docs/release/${doc}`;
  const absolutePath = rootPath(relativePath);
  expect(existsSync(absolutePath), `Release document is missing: ${relativePath}.`);
  if (existsSync(absolutePath)) {
    const content = readFileSync(absolutePath, "utf8");
    expect(
      content.includes(`Diplomat ${expectedVersion}`),
      `Release document must mention Diplomat ${expectedVersion}: ${relativePath}.`
    );
  }
}

if (errors.length > 0) {
  console.error("Release asset verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Release assets verified for Diplomat ${expectedVersion}.`);
