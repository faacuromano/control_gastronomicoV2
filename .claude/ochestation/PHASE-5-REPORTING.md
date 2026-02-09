# PHASE 5 — REPORTING

> **Purpose:** Document, commit, and decide next action.  
> **Runs:** After every Phase 4.  
> **Output:** Sprint report + git commit + iteration log + next action.

---

## STEP 5.1 — SPRINT REPORT

Write to `.agents/reports/sprint-NNN-report.md`:

```markdown
# Sprint [NNN] Report — [YYYY-MM-DD]

## Summary

[2-3 sentences: what was done, what modules were affected]

## Tasks

| Task | Module | Status | Contract Met? |
| ---- | ------ | ------ | ------------- |

## Agents Used

| Agent | Module | Tasks | Outcome |
| ----- | ------ | ----- | ------- |

## Metrics

| Metric                     | Value                     |
| -------------------------- | ------------------------- |
| Files changed              | [N] (+[added] -[removed]) |
| Tests added                | [N]                       |
| Execution: tsc/tests/build | [PASS/FAIL]               |
| Security findings          | [N found → N resolved]    |
| Contract violations        | [N]                       |
| Recode cycles              | [N]                       |

## Key Decisions

[Decisions made during this sprint — link to ARCHITECTURE.md if relevant]

## Carry-over

[What moves to next sprint]
```

---

## STEP 5.2 — SPRINT SUMMARY (for next sprint's agents)

Write to `.agents/shared/sprint-NNN/sprint-NNN-summary.md`:

```markdown
# Sprint [NNN] Summary — [YYYY-MM-DD]

**Verdict:** [PASS/CONTINUE] | **Modules:** [affected]

### What changed

- [Module X]: [what]
- [Module Y]: [what]

### What next sprint should know

- [Context, dependencies, patterns established, known issues]
```

---

## STEP 5.3 — GIT CHECKPOINT (mandatory)

```
1. git add -A
2. git commit -m "sprint-[NNN]: [1-line summary]

   Modules: [list]
   Verdict: [PASS/CONTINUE]
   Files: [N] changed | Tests: [N] added
   Security: [N] found, [N] resolved"
3. git tag sprint-[NNN]
```

Record commit hash in iteration log.

---

## STEP 5.4 — APPEND TO ITERATION LOG

Append to `.agents/orchestrator/ITERATION_LOG.md`:

```markdown
## Sprint [NNN] — [YYYY-MM-DD]

**Verdict:** [PASS/CONTINUE/RECODE(N)] | **Modules:** [list]
**Tasks:** [list] | **Files:** [N] (+/-) | **Tests:** [N]
**Execution:** tsc [P/F] | tests [P/F] | build [P/F/skip]
**Security:** [found] → [resolved] | **Git:** [hash]
**Carry-over:** [what's next]
```

---

## STEP 5.5 — DETERMINE NEXT ACTION

```
More sprints in plan?
  → YES → Plan needs adjustment? → Phase 1 (replan) / Phase 2 (next sprint)
  → NO  → All modules ≥90%? → 0 Critical/High vulns? → COMPLETE / Security sprint
          → Gaps remain? → Phase 1 (plan new sprints)
```

**Replan triggers:** every 3 sprints, major architectural issue, new requirements, systemic issues (same problem in 3+ files).

---

## STEP 5.6 — METADATA PRUNING (every 2 sprints)

```
1. ARCHIVE: merge shared/ reports older than 2 sprints into ARCHIVE.md
2. PRUNE: evolved skills over line limits → keep only HIGH confidence
3. COMPACT: iteration log entries older than 2 sprints → 3 lines each
4. CLEAN: delete dynamic agent files older than 2 sprints
```

---

## STEP 5.7 — HUMAN CHECKPOINT (every 2 sprints — MANDATORY)

Generate `.agents/reports/checkpoint-after-sprint-NNN.md`:

```markdown
# HUMAN CHECKPOINT — After Sprint [NNN]

## Sprints since last checkpoint: [N]

### Progress: [N]% complete | Sprints remaining: [N]

### Top 3 Risks

| Risk | Severity | Sprint | Description |
| ---- | -------- | ------ | ----------- |

### Riskiest Decisions

1. [Decision]: [why it could be wrong]
2. [Decision]: [why it could be wrong]

### Architecture Drift Check

- [Any pending decisions in ARCHITECTURE.md?]
- [Any contract that needs user review?]
- [Any evolved convention that seems wrong?]

### Build Status

- tsc: [P/F] | tests: [N pass/fail] | build: [P/F] | audit: [N crit/high]

### Recommended Actions

- [ ] Review [specific file/module]
- [ ] Verify [security concern]
- [ ] Decide on [pending architectural question]
```

**STOP. Present checkpoint. Wait for user response:**

- "continue" → next sprint
- "review sprint [N]" → show report
- "revert to sprint [N]" → `git checkout sprint-[N]`
- "adjust plan" → Phase 1 with user input
- "pause" → save state, stop

---

## SELF-CHECK

```
□ Sprint report written?
□ Sprint summary in shared/?
□ Git commit + tag?
□ Iteration log appended?
□ Next action determined?
□ 5-sprint checkpoint? → metadata pruned + human checkpoint + STOPPED?
```

---

## ANTI-DRIFT ANCHOR

**Phase 5: Report, commit, decide. Every 5 sprints: prune + human checkpoint.**  
**Git commit is your rollback net. Never skip it.**
