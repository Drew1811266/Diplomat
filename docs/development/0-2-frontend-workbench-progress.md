# Diplomat 0.2 Frontend Workbench Progress

Checkpoint date: 2026-06-13

## Current Branch

- Worktree: `D:\Software Project\Diplomat\.worktrees\0.2-frontend-workbench`
- Branch: `codex/0.2-frontend-workbench`
- Latest implementation commit: `d952def feat(web): add subtitle grid and line inspector`

## Completed Gates

- Task 1 Dependency And Provider Foundation: implemented, reviewed, committed.
- Task 2 i18n Resources And Language Store: implemented, reviewed, committed.
- Task 3 Worker Query Hooks: implemented, reviewed, committed.
- Task 4 Project Center Shell: implemented, quality findings fixed, re-reviewed, committed.
- Task 5 Workbench Shell And Toolbar: implemented, quality findings fixed, re-reviewed, committed.
- Task 6 Subtitle Grid And Line Inspector: implementation committed; spec and quality reviews are still pending.

## Task 5 Verification

Task 5 passed both review gates after the responsive layout, internal scrolling, and i18n fixes.

Verified commands reported passing:

```powershell
corepack pnpm --dir apps/web exec vitest run src/pages/WorkbenchPage.test.tsx src/components/TopToolbar.test.tsx tests/App.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web test
corepack pnpm --dir apps/web typecheck
```

## Historical Pause Point

Task 6 Subtitle Grid And Line Inspector was paused mid-implementation, then resumed.

Status reported by the Task 6 implementer:

- Red tests were written and confirmed failing before implementation.
- `SubtitleGrid`, `LineInspector`, and Workbench wiring were implemented.
- Focused tests passed:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/SubtitleGrid.test.tsx src/components/inspectors/LineInspector.test.tsx src/pages/WorkbenchPage.test.tsx src/i18n/i18n.test.ts
```

At the pause point, these items were not yet done:

- `corepack pnpm --dir apps/web typecheck`
- `corepack pnpm --dir apps/web exec vitest run tests/App.test.tsx`
- Task 6 commit
- Task 6 spec review
- Task 6 code quality review

## Resume Update

After resuming, Task 6 implementation was verified and committed as:

```text
d952def feat(web): add subtitle grid and line inspector
```

Verified commands:

```powershell
corepack pnpm --dir apps/web exec vitest run src/components/SubtitleGrid.test.tsx src/components/inspectors/LineInspector.test.tsx src/pages/WorkbenchPage.test.tsx src/i18n/i18n.test.ts
corepack pnpm --dir apps/web exec vitest run tests/App.test.tsx
corepack pnpm --dir apps/web typecheck
corepack pnpm --dir apps/web test
git diff --check
```

Task 6 still requires:

- Spec compliance review.
- Code quality review.

## Task 6 Files

- `apps/web/src/components/SubtitleGrid.tsx`
- `apps/web/src/components/SubtitleGrid.test.tsx`
- `apps/web/src/components/inspectors/LineInspector.tsx`
- `apps/web/src/components/inspectors/LineInspector.test.tsx`
- `apps/web/src/pages/WorkbenchPage.tsx`
- `apps/web/src/pages/WorkbenchPage.test.tsx`
- `apps/web/src/i18n/en.ts`
- `apps/web/src/i18n/zh.ts`

## Resume Procedure

When continuing:

1. Run Task 6 spec review.
2. If approved, run Task 6 code quality review.
3. If either review requests changes, fix and re-run the relevant review.
4. Continue to Task 7 only after both Task 6 reviews approve.
