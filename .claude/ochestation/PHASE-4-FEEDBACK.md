# PHASE 4 — FEEDBACK & EVOLUTION

> **Purpose:** Update system knowledge from sprint learnings. Evolve agents and architecture.  
> **Runs:** After every sprint (after Phase 3 verdict of PASS or CONTINUE).  
> **Input:** Review report + agent reports + current evolved skills  
> **Output:** Updated evolved skills + updated PROJECT_STATUS.md + possible ARCHITECTURE.md updates

---

## STEP 4.1 — GATHER SPRINT LEARNINGS

```
From the review report + agent shared reports, extract:
  - What patterns worked well → reinforce
  - What patterns caused issues → add to pitfalls
  - What conventions were discovered → add to conventions
  - What the review caught → prevention rules
  - What contracts were unclear or incorrect → flag for ARCHITECTURE.md update
```

---

## STEP 4.2 — UPDATE EVOLVED SKILLS

**CONFIDENCE FLAGS (mandatory):**
```
HIGH   — 3+ files or confirmed in 2+ sprints. Agents MUST follow.
MEDIUM — 2 files or 1 sprint confirmation. Agents SHOULD follow.
LOW    — 1 file or inferred. Suggestions only.

Promote: LOW → MEDIUM → HIGH as evidence accumulates.
Demote or remove when contradicted by later evidence.
```

### `project-conventions.md` (max 100 lines)
```
## Sprint [N] — [YYYY-MM-DD]
- [Convention]: [description] (confidence: [H/M/L], seen in [file refs])
- [Anti-pattern]: [what not to do] (confidence: [H/M/L], caused [problem])
```

### `known-pitfalls.md` (max 80 lines)
```
## Sprint [N] — [YYYY-MM-DD]
### [Pitfall name]
- What: [description] | Root cause: [why] | Prevention: [rule]
- Recurring? [YES sprint N / NO]
```

### `stack-patterns.md` (max 80 lines)
```
## Sprint [N] — [YYYY-MM-DD]
- [Pattern]: [description], reference: [file:line] (confidence: [H/M/L])
```

When any file exceeds its line limit: summarize, keep only HIGH confidence entries.

---

## STEP 4.3 — UPDATE ARCHITECTURE.md (if needed)

**This is how the architecture evolves with the project.**

```
Check: did this sprint reveal anything that should update ARCHITECTURE.md?

  □ New module discovered or module boundary changed?
  □ Data contract needs updating (types changed)?
  □ New design decision made during implementation?
  □ Code standard needs refinement?
  □ New design principle emerged?

If YES to any:
  → If minor (refining existing spec): update ARCHITECTURE.md directly.
  → If major (new module, changed boundary, new principle): 
    Add to ARCHITECTURE.md §Pending Decisions. 
    Will be presented to user at next checkpoint or Phase 0 re-run.
```

---

## STEP 4.4 — UPDATE PROJECT_STATUS.md

```
Update:
  - Module map completion percentages
  - Endpoint inventory (new/modified endpoints)
  - Security posture (resolved/new findings)
  - Technical debt (new items from review)
  - Requirements gap (closed items)
```

---

## SELF-CHECK

```
□ All skill entries have confidence flags?
□ No skill file exceeds its line limit?
□ ARCHITECTURE.md updated if contracts or modules changed?
□ PROJECT_STATUS.md reflects current state?
□ Recurring pitfalls promoted to conventions?
```

---

## ANTI-DRIFT ANCHOR

**Phase 4: Learn and evolve. No implementation.**  
**Evolved skills must have confidence flags. ARCHITECTURE.md is the source of truth.**  
**Major architectural changes are flagged for user consultation.**
