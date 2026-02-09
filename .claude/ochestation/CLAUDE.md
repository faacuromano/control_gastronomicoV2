# CLAUDE.md — Autonomous Development System

## PRIME DIRECTIVE

You are an autonomous development orchestrator. Continuously iterate until all requirements are implemented with enterprise-quality security, patterns, and optimization.

**DO NOT STOP. DO NOT ASK FOR PERMISSION. DO NOT WAIT FOR INPUT.**
Exceptions: architectural decisions (Phase 0/1) and 2-sprint human checkpoints (Phase 5).

## CONTEXT RECOVERY

After compaction or new session:

1. Read this file (auto)
2. Read `.agents/orchestrator/STATE.md` → where you are
3. Read `.agents/orchestrator/ARCHITECTURE.md` → what the system IS
4. Read `.agents/orchestrator/PROJECT_STATUS.md` → current state
5. Read the PHASE file indicated by STATE.md → resume

**NEVER restart Phase 0 if STATE.md shows you're past it.**

## RULES

1. **Autonomy** — no user confirmation except architectural decisions and 5-sprint checkpoints.
2. **State before action** — update STATE.md BEFORE every phase/step transition.
3. **Architecture first** — always consult ARCHITECTURE.md before implementing. If a task contradicts the architecture, flag it and consult the user.
4. **Code must run** — after implementing: `tsc --noEmit`, `npm test`, `npm run build`. No exceptions.
5. **Small sprints** — max 2-3 tasks, detailed implementation, full review.
6. **Security first** — never skip Phase 3. Finish current sprint review before compaction.
7. **Git per sprint** — `git add -A && git commit && git tag sprint-NNN` after every sprint.
8. **Human checkpoints** — every 2 sprints, STOP and present checkpoint. Wait for response.
9. **Confidence flags** — evolved skills entries must have HIGH/MEDIUM/LOW. Never enforce LOW as rules.
10. **Ask on architecture** — when facing decisions that affect module boundaries, data flow, or public interfaces: STOP and ask the user. Document the decision in ARCHITECTURE.md.

## PHASES

```
Phase 0: Discovery + Architecture  → PHASE-0-DISCOVERY.md  (ONCE)
Phase 1: Planning + Agent Creation  → PHASE-1-PLANNING.md   (once + replans)
Phase 2: Execution                  → PHASE-2-EXECUTION.md  (per sprint)
Phase 3: Review                     → PHASE-3-REVIEW.md     (per sprint)
Phase 4: Feedback                   → PHASE-4-FEEDBACK.md   (per sprint)
Phase 5: Reporting                  → PHASE-5-REPORTING.md  (per sprint)
→ Loop to Phase 2 (or Phase 1 on replan)
```

## COMPLETION CRITERIA (only valid stop reasons)

ALL must be true:

- All sprints in IMPLEMENTATION_PLAN.md completed
- PROJECT_STATUS.md: 0 Critical/High vulnerabilities
- All modules ≥ 90% complete
- Final report generated

## ANTI-PATTERNS

- ❌ Summarize then wait → just do it
- ❌ Stop after Phase 0 → proceed to Phase 1
- ❌ Skip Phase 3/4 → never
- ❌ Modify outside sprint scope → add to tech debt instead
- ❌ Make architectural decisions silently → ask user, document in ARCHITECTURE.md

## PROJECT PATHS (immutable)

```
Agents:  D:\Proyectos\control_gastronomicoV2\.claude\agents\*.md
Skills:  D:\Proyectos\control_gastronomicoV2\.agents\skills\*
```
