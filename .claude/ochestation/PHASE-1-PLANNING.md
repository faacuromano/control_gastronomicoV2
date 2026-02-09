# PHASE 1 — PLANNING & AGENT CREATION

> **Purpose:** Divide work into sprints. Create module-owner agents with contracts.  
> **Runs:** Once initially, then on replan triggers.  
> **Input:** `PROJECT_STATUS.md` + `ARCHITECTURE.md`  
> **Output:** `IMPLEMENTATION_PLAN.md` + module-owner agents

---

## STEP 1.1 — READ CURRENT STATE

```
MANDATORY:
1. Read ARCHITECTURE.md (module map, contracts, decisions, standards)
2. Read PROJECT_STATUS.md (gaps, debt, security posture)
3. Read ITERATION_LOG.md (if exists — what was already done)
4. Read .agents/skills/evolved/ (if exists — accumulated knowledge)
```

---

## STEP 1.2 — IDENTIFY TASKS FROM ARCHITECTURE

Using ARCHITECTURE.md module specifications + PROJECT_STATUS.md gaps:

```
For EACH module in ARCHITECTURE.md:
  → What is its current state? (from PROJECT_STATUS.md module map)
  → What's missing vs its specification?
  → What security issues affect it?
  → What tech debt does it carry?

Produce a flat task list:
  Task: [description]
  Module: [which module from ARCHITECTURE.md]
  Type: Feature / Fix / Security / Debt / Test
  Priority: Critical / High / Medium / Low
  Size: Small (<50 lines) / Medium (50-150) / Large (150-300)
  Depends on: [other tasks]
  Input contract: [what data/types this task consumes, from ARCHITECTURE.md]
  Output contract: [what data/types this task produces, from ARCHITECTURE.md]
```

Priority order: Security Critical/High → Core dependencies → Incomplete modules → New features → Debt

---

## STEP 1.3 — ORGANIZE INTO SPRINTS

**Rules:** max 2-3 tasks per sprint, related tasks together (same module), dependencies respected.

### If the plan involves architectural decisions not in ARCHITECTURE.md: STOP.

```
Present to user:
"While planning, I identified [N] decisions not covered by the architecture:
1. [Decision needed] — affects [modules]
2. ...
Which approach should I take?"

Wait for response. Update ARCHITECTURE.md. Then continue planning.
```

Write to `.agents/orchestrator/IMPLEMENTATION_PLAN.md`:

```markdown
# IMPLEMENTATION PLAN
## Generated: [YYYY-MM-DD] | Based on: ARCHITECTURE.md + PROJECT_STATUS.md
## Total Sprints: [N]

## Sprint Dependency Graph
Sprint 1 → Sprint 2 → Sprint 3
                    ↘ Sprint 4 (independent)

---

### Sprint [N]: [Name]
**Module(s):** [from ARCHITECTURE.md]
**Focus:** [Backend / Frontend / Security / Both]

#### Task [N.1]: [Precise description]
- **Module:** [module name from ARCHITECTURE.md]
- **Type:** [Feature/Fix/Security/Debt]
- **Input contract:** [data/types consumed — reference ARCHITECTURE.md §Contracts]
- **Output contract:** [data/types produced — reference ARCHITECTURE.md §Contracts]
- **Files to create:** [list with proposed types/interfaces]
- **Files to modify:** [list]
- **Acceptance criteria:**
  - [ ] [Specific, testable — tied to the contract]
  - [ ] [Must match types defined in ARCHITECTURE.md]

#### Task [N.2]: ...

#### Sprint [N] Verification:
- [ ] All output contracts satisfied (types match ARCHITECTURE.md)
- [ ] Input contracts consumed correctly
- [ ] [Security-specific check for this sprint]
```

---

## STEP 1.4 — CREATE MODULE-OWNER AGENTS

**Key change from v3:** agents own MODULES, not just tasks. A module-owner agent
has deep context about one area of the system. If multiple tasks in a sprint
touch the same module, the SAME agent handles them all.

**Location:** `.agents/agents/dynamic/sprint-NNN/[module]-agent.md`

```markdown
# Module Agent: [Module Name]
## Sprint: [N] | Tasks: [N.1, N.2]
## Module: [name from ARCHITECTURE.md]

---

### MODULE CONTEXT (from ARCHITECTURE.md)
**Responsibility:** [copied from ARCHITECTURE.md module spec]
**Location:** [directory paths]
**Key files:** [the files that define this module]

**Input contract:**
  [Exact types/interfaces this module receives, from ARCHITECTURE.md]
  Referenced in: [file path where the type is defined]

**Output contract:**
  [Exact types/interfaces this module produces, from ARCHITECTURE.md]
  Referenced in: [file path where the type is defined]

**Internal patterns:**
  [Copied from ARCHITECTURE.md module spec — patterns to follow]

**Design principles that apply:**
  [Relevant principles from ARCHITECTURE.md §Design Principles]

---

### TASKS TO EXECUTE

**Task [N.1]: [description]**
Files to read: [list]
Files to create/modify: [list]
Contract to satisfy: [input] → [output] as defined above
Acceptance: [criteria]

**Task [N.2]: [description]**
...

---

### VERIFICATION (answer by reading actual code)
1. "Do my output types match the contract in ARCHITECTURE.md?"
2. "Does my code follow the module's internal patterns?"
3. [Task-specific question]
4. [Task-specific question]

### CODE STANDARDS TO MATCH (from ARCHITECTURE.md §Code Standards)
- Naming: [project-specific pattern]
- Error handling: [project-specific pattern]
- Validation: [project-specific pattern]
- API response: [project-specific shape]

### LEARNED CONTEXT (from evolved skills, if any)
[Relevant conventions and pitfalls from previous sprints]
```

**Why module-owners beat task-workers:**
A task-worker reads 8 process files + code. A module-owner reads ARCHITECTURE.md
(what the system IS) + its module's code. 90% of context is domain-relevant.

---

## STEP 1.5 — STATIC AGENT MAPPING

```
REVIEW:  security-auditor + code-reviewer + architecture-reviewer
RECODE:  tdd-refactor
BACKEND AGENTS inherit from: backend-architect + api-design-principles + architecture-patterns
FRONTEND AGENTS inherit from: expert-react-frontend-engineer + react + vercel-best-practices
```

---

## STEP 1.6 — SELF-CHECK

```
□ Read ARCHITECTURE.md before planning?
□ All tasks reference a module from ARCHITECTURE.md?
□ Each task has input/output contracts?
□ Sprints ≤ 3 tasks, security first?
□ Module-owner agents have deep context from ARCHITECTURE.md?
□ Any new architectural decisions flagged to user?
□ IMPLEMENTATION_PLAN.md written to disk?
```

---

## ANTI-DRIFT ANCHOR

**You are in Phase 1. Planning and agent creation. No implementation.**  
**Agents own modules, not tasks. Contracts define boundaries.**  
**If a decision isn't in ARCHITECTURE.md, ask the user.**
