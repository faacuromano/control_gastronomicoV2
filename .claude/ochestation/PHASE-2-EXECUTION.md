# PHASE 2 — EXECUTION

> **Purpose:** Module-owner agents implement their assigned tasks.  
> **Runs:** Once per sprint. Re-runs on RECODE verdict.  
> **Input:** Module agents + ARCHITECTURE.md + shared/ from previous sprints  
> **Output:** Code changes + reports in `.agents/shared/sprint-NNN/`

---

## STEP 2.0 — SPRINT INITIALIZATION

```
1. mkdir .agents/shared/sprint-NNN/
2. Read ARCHITECTURE.md (module contracts, standards, principles)
3. Read .agents/shared/sprint-[N-1]/ (previous sprint context, if exists)
4. Read .agents/skills/evolved/ (accumulated knowledge, if exists)
5. Read the module-agent file for the first task
```

---

## STEP 2.1 — AGENT EXECUTION PROTOCOL

For EACH task, execute A → B → C → D → E:

### A. PRE-READ

Read everything in the agent's "Files to read" list + ARCHITECTURE.md module spec.

State explicitly: "I read [files]. I will create/modify [files]. Expected result: [behavior]. Contract to satisfy: [input] → [output]."

### B. IMPLEMENT

Follow the code standards from **ARCHITECTURE.md §Code Standards** — not generic rules, but the actual patterns discovered in THIS project.

If you encounter a decision not covered by ARCHITECTURE.md:
- If minor (naming, local pattern): make the best choice, document in shared report.
- If major (affects module boundary, data flow, public interface): **STOP. Flag for user consultation.** Update STATE.md → status: WAITING_USER.

**Scope discipline:** Only modify files in your task scope. If you find code that needs improvement elsewhere, add it to PROJECT_STATUS.md tech debt. Do NOT fix it now.

### C. RUN CODE (Mandatory — cannot skip)

```
C.1 — npx tsc --noEmit 2>&1 | head -50
      → Fix until zero errors. Catches: wrong imports, type mismatches, hallucinated paths.

C.2 — npm test 2>&1 | tail -50
      → Fix new failures. Note pre-existing failures in report.

C.3 — npm run lint 2>&1 | head -30  (skip if no lint script)
      → Fix errors.

C.4 — npm run build 2>&1 | tail -30  (skip if no build script)
      → Fix if fails.

C.5 — npm audit --production (once per sprint)
      → Note critical/high for Phase 3.

If C.1-C.4 fail after 3 attempts: mark BLOCKED, document, move to next task.
```

### D. VERIFY (Chain-of-Verification)

After code compiles and tests pass, answer verification questions from the agent file by reading actual code:

```
For each question:
  1. Read the file
  2. Find specific line(s)
  3. "Q: [question] → A: [answer with file:line]"
  4. Fix if unsatisfactory

Universal checks:
  - "Do my output types match the contract in ARCHITECTURE.md?"
  - "Is there any path where user input reaches DB without validation?"
  - "Do error messages expose internals?"
```

### E. SHARED REPORT

Write to `.agents/shared/sprint-NNN/[date]_[agent]_[task].md`:

```markdown
# [Agent] — Sprint [N] Task [N.N]
## [YYYY-MM-DD HH:MM]

### Implemented: [description]
### Contract: [input type] → [output type] (matches ARCHITECTURE.md: ✅/❌)

### Files Changed
| File | Action | Lines +/- |
|------|--------|-----------|

### Execution
| tsc | tests | lint | build | audit |
|-----|-------|------|-------|-------|
| [P/F] | [P/F] | [P/F/skip] | [P/F/skip] | [N crit] |

### Decisions Made
| Decision | Chosen | Why |
|----------|--------|-----|

### For Reviewers: [specific concerns]
### For Next Agent: [context they need]
```

---

## STEP 2.2 — SEQUENTIAL EXECUTION

Tasks within a sprint execute sequentially. Later agents read earlier agents' shared reports.

---

## STEP 2.3 — RECODE

On RECODE verdict from Phase 3:
1. Read review report — only the flagged issues
2. Use tdd-refactor agent: write test exposing problem → fix → verify
3. Scope: ONLY flagged issues. Do NOT expand.
4. Max 2 recode cycles. After 2: log as debt, proceed to Phase 4.

---

## SELF-CHECK

```
□ Each agent read ARCHITECTURE.md module spec before implementing?
□ Each agent ran tsc + tests + build?
□ Output types match ARCHITECTURE.md contracts?
□ Each agent wrote shared report?
□ No files modified outside sprint scope?
```

---

## ANTI-DRIFT ANCHOR

**Phase 2: Execute. Agents implement contracts from ARCHITECTURE.md.**  
**Run code after every implementation. Verify contracts match.**  
**Stay in scope. If it's not in your task, add it to tech debt.**
