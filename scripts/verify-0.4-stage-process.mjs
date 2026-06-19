import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = fileURLToPath(new URL("..", import.meta.url));
const args = process.argv.slice(2);
const repoRoot = resolve(readArg("--repo-root") ?? defaultRoot);
const errors = [];
const statuses = [];

const acceptedStages = [
  {
    version: "0.36",
    name: "material workstation",
    developmentDoc: "docs/development/0-36-material-workstation.md",
    implementationPlan: "docs/superpowers/plans/2026-06-18-diplomat-0-36-material-workstation.md",
    stageGate: "docs/development/0-36-stage-gate-review.md",
    mergeSubject: "merge: complete 0.36 material workstation"
  },
  {
    version: "0.37",
    name: "model directory manifests",
    developmentDoc: "docs/development/0-37-model-directory-manifests.md",
    implementationPlan: "docs/superpowers/plans/2026-06-18-diplomat-0-37-model-directory-manifests.md",
    stageGate: "docs/development/0-37-stage-gate-review.md",
    mergeSubject: "merge: complete 0.37 model directory manifests"
  },
  {
    version: "0.38",
    name: "smart audio segmentation",
    developmentDoc: "docs/development/0-38-smart-audio-segmentation.md",
    implementationPlan: "docs/superpowers/plans/2026-06-18-diplomat-0-38-smart-audio-segmentation.md",
    stageGate: "docs/development/0-38-stage-gate-review.md",
    mergeSubject: "merge: complete 0.38 smart audio segmentation"
  },
  {
    version: "0.39",
    name: "runtime orchestration",
    developmentDoc: "docs/development/0-39-runtime-orchestration.md",
    implementationPlan: "docs/superpowers/plans/2026-06-18-diplomat-0-39-runtime-orchestration.md",
    stageGate: "docs/development/0-39-stage-gate-review.md",
    mergeSubject: "merge: complete 0.39 runtime orchestration"
  }
];

const finalStage = {
  version: "0.40",
  developmentDoc: "docs/development/0-40-three-hour-acceptance.md",
  releaseGateDoc: "docs/development/0-40-three-hour-release-gate.md",
  implementationPlan: "docs/superpowers/plans/2026-06-18-diplomat-0-40-three-hour-acceptance.md",
  finalStageGate: "docs/development/0-40-stage-gate-review.md",
  requiredScripts: [
    "scripts/acceptance/check-0-40-readiness.py",
    "scripts/acceptance/find-0-40-media-candidates.py",
    "scripts/acceptance/prepare-0-40-models.py",
    "scripts/acceptance/run-0-40-three-hour.py",
    "scripts/acceptance/verify-0-40-acceptance-summary.py",
    "scripts/verify-0.40-three-hour-workflow.ps1"
  ]
};

const metadataPaths = new Set([
  "README.md",
  "package.json",
  "apps/web/package.json",
  "packages/shared/package.json",
  "apps/desktop/package.json",
  "apps/desktop/src-tauri/Cargo.toml",
  "apps/desktop/src-tauri/Cargo.lock",
  "apps/desktop/src-tauri/tauri.conf.json",
  "worker/pyproject.toml",
  "worker/diplomat_worker/__init__.py",
  "scripts/verify-version.mjs"
]);

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) {
    return null;
  }
  return args[index + 1] ?? null;
}

function rootPath(relativePath) {
  return resolve(repoRoot, relativePath);
}

function readText(relativePath) {
  return readFileSync(rootPath(relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function expect(condition, message) {
  if (!condition) {
    errors.push(message);
  }
}

function requireFile(relativePath, message) {
  const exists = existsSync(rootPath(relativePath));
  expect(exists, message ?? `Missing required file: ${relativePath}`);
  return exists;
}

function runGit(gitArgs) {
  const result = spawnSync("git", gitArgs, {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout : null;
}

function hasGitRepository() {
  return existsSync(rootPath(".git")) && runGit(["rev-parse", "--is-inside-work-tree"])?.trim() === "true";
}

function nonDocumentationPath(path) {
  return !path.startsWith("docs/") && !metadataPaths.has(path);
}

const roadmapPath = "docs/development/0-4-real-model-desktop-roadmap.md";
if (requireFile(roadmapPath, "Missing 0.4 roadmap: docs/development/0-4-real-model-desktop-roadmap.md")) {
  const roadmap = readText(roadmapPath);
  for (const stage of [...acceptedStages, finalStage]) {
    expect(roadmap.includes(stage.version), `0.4 roadmap does not mention ${stage.version}.`);
  }
}

const gitAvailable = hasGitRepository();
const mergeBySubject = gitAvailable ? loadMainFirstParentMerges() : new Map();

for (const stage of acceptedStages) {
  validateDevelopmentDoc(stage);
  validateImplementationPlan(stage);
  validateAcceptedStageGate(stage);

  if (gitAvailable) {
    validateAcceptedStageMerge(stage);
  }

  statuses.push(`${stage.version}: accepted (${stage.name})`);
}

validateFinalStage();

if (errors.length > 0) {
  console.error("Diplomat 0.4 stage process verification failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Diplomat 0.4 stage process verified.");
for (const status of statuses) {
  console.log(`- ${status}`);
}

function loadMainFirstParentMerges() {
  const log = runGit(["log", "--format=%H%x00%s", "main", "--first-parent"]) ?? "";
  const merges = new Map();
  for (const line of log.split(/\r?\n/)) {
    const [hash, subject] = line.split("\0");
    if (hash && subject) {
      merges.set(subject, hash);
    }
  }
  return merges;
}

function validateDevelopmentDoc(stage) {
  if (!requireFile(stage.developmentDoc, `Missing development document for ${stage.version}.`)) {
    return;
  }

  const content = readText(stage.developmentDoc);
  expect(content.includes(`Stage: ${stage.version}`), `Development document for ${stage.version} must declare the stage.`);
  expect(content.includes("## Objective"), `Development document for ${stage.version} must include an Objective section.`);
  expect(
    content.includes("## Acceptance Criteria") || content.includes("## Stage Gate"),
    `Development document for ${stage.version} must include acceptance or stage gate criteria.`
  );
}

function validateImplementationPlan(stage) {
  if (!requireFile(stage.implementationPlan, `Missing implementation plan for ${stage.version}.`)) {
    return;
  }

  const content = readText(stage.implementationPlan);
  expect(content.includes("## Files"), `Implementation plan for ${stage.version} must include a Files section.`);
  expect(content.includes("- [ ]"), `Implementation plan for ${stage.version} has no checklist tasks.`);
}

function validateAcceptedStageGate(stage) {
  if (!requireFile(stage.stageGate, `Missing stage gate review for ${stage.version}.`)) {
    return;
  }

  const content = readText(stage.stageGate);
  expect(content.includes("Decision: Accepted"), `Stage gate review for ${stage.version} must be accepted.`);
  expect(/## Full.*Verification/.test(content), `Stage gate review for ${stage.version} must record full verification.`);
  expect(content.includes("ready to merge"), `Stage gate review for ${stage.version} must record merge readiness.`);
}

function validateAcceptedStageMerge(stage) {
  const mergeHash = mergeBySubject.get(stage.mergeSubject);
  if (!mergeHash) {
    errors.push(`main is missing merge commit for ${stage.version}: ${stage.mergeSubject}`);
    return;
  }

  const parents = (runGit(["show", "-s", "--pretty=%P", mergeHash]) ?? "").trim().split(/\s+/).filter(Boolean);
  if (parents.length < 2) {
    errors.push(`Merge commit for ${stage.version} does not have two parents: ${mergeHash}`);
    return;
  }

  const changedPaths = (runGit(["diff", "--name-only", parents[0], mergeHash]) ?? "")
    .split(/\r?\n/)
    .filter(Boolean);
  const implementationPaths = changedPaths.filter(nonDocumentationPath);
  expect(
    implementationPaths.length > 0,
    `Stage ${stage.version} merge contains no non-documentation implementation or test paths.`
  );
}

function validateFinalStage() {
  validateDevelopmentDoc({
    version: finalStage.version,
    developmentDoc: finalStage.developmentDoc
  });
  validateImplementationPlan({
    version: finalStage.version,
    implementationPlan: finalStage.implementationPlan
  });

  if (requireFile(finalStage.releaseGateDoc, "Missing 0.40 release gate document.")) {
    const releaseGate = readText(finalStage.releaseGateDoc);
    expect(
      releaseGate.includes("0.40 can merge and tag only when real three-hour evidence exists"),
      "0.40 release gate must explicitly block merge/tag before real three-hour evidence exists."
    );
  }

  for (const scriptPath of finalStage.requiredScripts) {
    requireFile(scriptPath, `Missing 0.40 acceptance script: ${scriptPath}`);
  }

  if (existsSync(rootPath(finalStage.finalStageGate))) {
    validateAcceptedFinalGate();
    statuses.push("0.40: accepted");
  } else {
    validateInProgressFinalGate();
    statuses.push("0.40: in progress");
  }
}

function validateAcceptedFinalGate() {
  const content = readText(finalStage.finalStageGate);
  expect(content.includes("Decision: Accepted"), "0.40 stage gate exists but is not accepted.");
  expect(content.includes("three-hour"), "0.40 accepted stage gate must mention three-hour evidence.");

  if (existsSync(rootPath("package.json"))) {
    const packageVersion = readJson("package.json").version;
    expect(packageVersion === "0.40.0", "0.40 accepted gate requires package.json version 0.40.0.");
  }
}

function validateInProgressFinalGate() {
  const acceptanceDoc = readText(finalStage.developmentDoc);
  expect(
    acceptanceDoc.includes("Do not merge 0.40 before real three-hour acceptance evidence exists."),
    "0.40 in-progress document must explicitly block merge before real three-hour acceptance evidence exists."
  );
  expect(
    acceptanceDoc.includes("Do not accept fake ASR or fake translation as 0.40 evidence."),
    "0.40 in-progress document must explicitly reject fake model evidence."
  );

  if (existsSync(rootPath("package.json"))) {
    const packageVersion = readJson("package.json").version;
    expect(packageVersion !== "0.40.0", "package.json must not be 0.40.0 before the 0.40 stage gate is accepted.");
  }
}
