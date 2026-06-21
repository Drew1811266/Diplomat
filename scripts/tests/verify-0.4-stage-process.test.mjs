import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const script = resolve(root, "scripts", "verify-0.4-stage-process.mjs");

function runVerifier(args = []) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function writeFixtureFile(rootPath, relativePath, content = "fixture") {
  const absolutePath = resolve(rootPath, relativePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function removeFixtureFile(rootPath, relativePath) {
  rmSync(resolve(rootPath, relativePath), { force: true });
}

function createMinimalFixture() {
  const fixture = mkdtempSync(resolve(tmpdir(), "diplomat-stage-process-"));
  writeFixtureFile(
    fixture,
    "docs/development/0-4-real-model-desktop-roadmap.md",
    "0.36\n0.37\n0.38\n0.39\n0.40\n"
  );

  for (const stage of ["0-36", "0-37", "0-38", "0-39"]) {
    writeFixtureFile(fixture, `docs/development/${stage}-stage-gate-review.md`, [
      "Decision: Accepted",
      "## Full Verification",
      "The stage is ready to merge into `main`."
    ].join("\n"));
  }

  for (const [stage, path] of [
    ["0.36", "docs/development/0-36-material-workstation.md"],
    ["0.37", "docs/development/0-37-model-directory-manifests.md"],
    ["0.38", "docs/development/0-38-smart-audio-segmentation.md"],
    ["0.39", "docs/development/0-39-runtime-orchestration.md"]
  ]) {
    writeFixtureFile(fixture, path, [
      `Stage: ${stage}`,
      "## Objective",
      "## Acceptance Criteria"
    ].join("\n"));
  }

  writeFixtureFile(
    fixture,
    "docs/development/0-40-three-hour-acceptance.md",
    [
      "Stage: 0.40",
      "## Objective",
      "## Acceptance Criteria",
      "Do not merge 0.40 before real two-to-three-hour acceptance evidence exists.",
      "Do not accept fake ASR or fake translation as 0.40 evidence."
    ].join("\n")
  );
  writeFixtureFile(
    fixture,
    "docs/development/0-40-three-hour-release-gate.md",
    "0.40 can merge and tag only when real two-to-three-hour evidence exists.\n"
  );

  for (const plan of [
    "2026-06-18-diplomat-0-36-material-workstation.md",
    "2026-06-18-diplomat-0-37-model-directory-manifests.md",
    "2026-06-18-diplomat-0-38-smart-audio-segmentation.md",
    "2026-06-18-diplomat-0-39-runtime-orchestration.md",
    "2026-06-18-diplomat-0-40-three-hour-acceptance.md"
  ]) {
    writeFixtureFile(fixture, `docs/superpowers/plans/${plan}`, "## Files\n- [ ] task\n");
  }

  for (const scriptPath of [
    "scripts/acceptance/check-0-40-readiness.py",
    "scripts/acceptance/find-0-40-media-candidates.py",
    "scripts/acceptance/prepare-0-40-models.py",
    "scripts/acceptance/run-0-40-three-hour.py",
    "scripts/acceptance/verify-0-40-acceptance-summary.py",
    "scripts/verify-0.40-three-hour-workflow.ps1"
  ]) {
    writeFixtureFile(fixture, scriptPath, "fixture\n");
  }

  writeFixtureFile(fixture, "package.json", JSON.stringify({ version: "0.39.0" }));
  writeFixtureFile(fixture, "README.md", "Current project version: **0.39.0**\n");
  return fixture;
}

test("audits the current repository 0.4 stage process", () => {
  assert.equal(existsSync(script), true);

  const result = runVerifier();

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /0\.36: accepted/);
  assert.match(result.stdout, /0\.37: accepted/);
  assert.match(result.stdout, /0\.38: accepted/);
  assert.match(result.stdout, /0\.39: accepted/);
  assert.match(result.stdout, /0\.40: accepted/);
});

test("accepts 0.40 in-progress gate blocked by missing two-to-three-hour evidence", () => {
  const fixture = createMinimalFixture();

  const result = runVerifier(["--repo-root", fixture]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /0\.40: in progress/);
});

test("accepts later release versions after the 0.40 final gate is accepted", () => {
  const fixture = createMinimalFixture();
  writeFixtureFile(
    fixture,
    "docs/development/0-40-stage-gate-review.md",
    [
      "Decision: Accepted",
      "## Full Verification",
      "The two-to-three-hour evidence is complete."
    ].join("\n")
  );
  writeFixtureFile(fixture, "package.json", JSON.stringify({ version: "0.42.0" }));

  const result = runVerifier(["--repo-root", fixture]);

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /0\.40: accepted/);
});

test("fails when a required stage implementation plan is missing", () => {
  const fixture = createMinimalFixture();
  removeFixtureFile(
    fixture,
    "docs/superpowers/plans/2026-06-18-diplomat-0-39-runtime-orchestration.md"
  );

  const result = runVerifier(["--repo-root", fixture]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Missing implementation plan for 0\.39/);
});

test("fails when the 0.40 media candidate scanner is missing", () => {
  const fixture = createMinimalFixture();
  removeFixtureFile(fixture, "scripts/acceptance/find-0-40-media-candidates.py");

  const result = runVerifier(["--repo-root", fixture]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /find-0-40-media-candidates\.py/);
});

test("fails when the 0.40 acceptance summary verifier is missing", () => {
  const fixture = createMinimalFixture();
  removeFixtureFile(fixture, "scripts/acceptance/verify-0-40-acceptance-summary.py");

  const result = runVerifier(["--repo-root", fixture]);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /verify-0-40-acceptance-summary\.py/);
});

test("release asset verification runs the 0.4 stage process audit", () => {
  const releaseVerifier = readFileSync(resolve(root, "scripts", "verify-release-assets.mjs"), "utf8");

  assert.match(releaseVerifier, /verify-0\.4-stage-process\.mjs/);
});
