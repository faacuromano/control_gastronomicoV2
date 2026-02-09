# ORCHESTRATOR — Autonomous Iterative Development System v4

> **Model:** Claude Opus 4.6 (Claude Code)  
> **Priority:** Security → Best Practices → Optimization  
> **Iteration size:** 2-3 atomic tasks. Detailed. Full review.  
> **Mode:** Autonomous with architectural consultation and 5-sprint checkpoints.

---

## SYSTEM FILES

| File | Purpose | When to Read |
|------|---------|-------------|
| `CLAUDE.md` | Prime directive, rules | Auto at session start |
| `STATE.md` | Current phase/step/sprint | First after any reset |
| `ARCHITECTURE.md` | **What the system IS**: modules, contracts, decisions | Before every sprint |
| `PROJECT_STATUS.md` | Current completion state | Before every sprint |
| `IMPLEMENTATION_PLAN.md` | Ordered task list with contracts | Before every sprint |
| `ITERATION_LOG.md` | Append-only sprint history | On recovery |

---

## EXECUTION LOOP

```
    CLAUDE.md + STATE.md (auto)
              │
    Phase 0: Discovery + Architecture  (once)
    ├── OUTPUT: PROJECT_STATUS.md (what exists)
    ├── OUTPUT: ARCHITECTURE.md (what the system IS — modules, contracts, decisions)
    └── USER CONSULTATION: architectural decisions
              │
    Phase 1: Planning + Module Agents  (once + replans)
    └── OUTPUT: IMPLEMENTATION_PLAN.md + module-owner agents
              │
    ╔═══ SPRINT LOOP ════════════════════════════╗
    ║ Phase 2: Execute  → code + shared/ reports ║
    ║     ↓                                      ║
    ║ Phase 3: Review   → verdict                ║
    ║     ├── RECODE → Phase 2 (max 2x)         ║
    ║     └── PASS/CONTINUE ↓                    ║
    ║ Phase 4: Feedback → evolved skills         ║
    ║     ↓                                      ║
    ║ Phase 5: Report   → git commit + log       ║
    ║     ├── Every 5 sprints: HUMAN CHECKPOINT  ║
    ║     └── Next sprint or replan              ║
    ╚════════════════════════════════════════════╝
```

---

## DIRECTORY STRUCTURE

```
<PROJECT_ROOT>/
├── CLAUDE.md
├── .agents/
│   ├── orchestrator/          ← System files + generated docs
│   │   ├── ORCHESTRATOR.md, STATE.md, PHASE-*.md
│   │   ├── ARCHITECTURE.md        [Generated — THE key document]
│   │   ├── PROJECT_STATUS.md      [Generated]
│   │   ├── IMPLEMENTATION_PLAN.md [Generated]
│   │   └── ITERATION_LOG.md       [Generated]
│   ├── agents/
│   │   ├── static/            ← Refs to immutable agents
│   │   ├── dynamic/sprint-NNN/← Module-owner agents per sprint
│   │   └── overlays/          ← Evolved supplements
│   ├── skills/
│   │   ├── static/            ← Refs to immutable skills
│   │   └── evolved/           ← project-conventions, known-pitfalls, stack-patterns
│   ├── shared/sprint-NNN/     ← Inter-agent reports
│   └── reports/               ← Sprint reports + checkpoints
```

---

## CRITICAL RULES

1. Update STATE.md before every phase/step transition.
2. ARCHITECTURE.md is the source of truth for what the system IS.
3. Agents implement the architecture — they don't redesign it.
4. Architectural changes require user consultation.
5. Code must compile and tests must pass before verification.
6. Security review is blocking. Never skip.
7. Git commit after every sprint. Tag for rollback.
