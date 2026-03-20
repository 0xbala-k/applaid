---
name: precommit
description: Run before completing any coding task, committing code, or when asked to review changes. Ensures code is safe, clean, and follows applaid standards.
---

# Pre-commit Check

Run this skill before finishing any coding task. Do not mark a task complete until all steps pass.

## Step 1 — Lint & Typecheck (shell)
```bash
npm run lint                          # ESLint on web/
cd worker && npx tsc --noEmit         # TypeScript check on worker
```
Fix all errors before continuing. Warnings are okay but note them.

## Step 2 — Run Tests
```bash
cd worker && npm test
```
All tests must pass. If a test breaks due to your change, fix it — do not skip or delete tests.

## Step 3 — Code Review with /review
Run `/review` on every file you created or modified. Fix any issues flagged:
- Missing TypeScript types or use of `any`
- Unhandled promise rejections
- Missing Zod validation on API inputs
- Raw `NextResponse.json()` calls (use `apiSuccess` / `apiError` / `zodError` instead)
- `new PrismaClient()` calls (use singleton from `web/lib/prisma.ts`)
- Missing `dedupeHash` check before inserting a `JobLead`
- `APPLY_SAFE_MODE` bypassed

## Step 4 — Simplify with /simplify
Run `/simplify` on any function longer than ~40 lines or with nested conditionals deeper than 3 levels.

## Step 5 — Final Checklist
Before marking done, confirm:
- [ ] No `console.log` left in production paths (structured JSON logs only)
- [ ] No hardcoded secrets or API keys
- [ ] No `prisma as any` or other type casts that bypass safety
- [ ] Deprecated route `/api/apply-tasks/retry` not used — use `/api/tasks/:id/retry`
- [ ] If schema changed: `npm run prisma:migrate` run and migration file committed
- [ ] If new env vars added: `.env.example` updated

## Only then: commit.
