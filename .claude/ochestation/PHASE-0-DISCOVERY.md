# PHASE 0 — DISCOVERY & ARCHITECTURE

> **Purpose:** Read ALL code. Map the project. Define the architecture.  
> **Runs:** ONCE (re-run only on major restructuring).  
> **Outputs:** `PROJECT_STATUS.md` (what exists) + `ARCHITECTURE.md` (what the system IS).  
> **Rule:** READ-ONLY. Zero code changes.

---

## STEP 0.1 — READ PROJECT DOCUMENTATION

Read all skill files and project docs. For each, extract domain knowledge:

```
1. project-overview     → vision, requirements, domain terminology, user roles
2. architecture-patterns → layer structure, dependency rules, required/forbidden patterns
3. recent-data          → recent changes, known bugs, current priorities
4. api-design-principles → API conventions, auth patterns, error format
5. react                → component conventions, state management, routing
6. vercel-react-best-practices → deployment constraints, build rules
7. projection-patterns  → data transformations, DTO conventions
```

Also read: README.md, CHANGELOG.md, TODO.md, any existing CLAUDE.md/.cursorrules.

---

## STEP 0.2 — SCAN PROJECT STRUCTURE

```
1. List full directory tree (2-3 levels)
2. Identify: monorepo? separate frontend/backend? single app?
3. Read config files: package.json, tsconfig, .env.example, prisma schema,
   framework config, eslint/prettier, docker-compose, CI/CD, vercel.json
```

---

## STEP 0.3 — DEEP CODE SCAN

Read ALL source files methodically:

**Backend:** entry point → routes (list every endpoint) → services/controllers → data layer (full schema) → middleware (auth flow, error handling) → utilities

**Frontend:** app structure (routing, layouts) → components (categorization, patterns) → state management → API integration → styles → auth flow

**Tests:** frameworks used, coverage estimate, E2E existence

---

## STEP 0.4 — GENERATE PROJECT_STATUS.md

Write to `.agents/orchestrator/PROJECT_STATUS.md`:

```markdown
# PROJECT STATUS
## Project: [Name] | Domain: [domain] | Stage: [stage]
## Last Updated: [YYYY-MM-DD]

### TECH STACK
| Layer | Technology | Version |
|-------|-----------|---------|

### MODULE MAP
| Module | Description | Backend | Frontend | Tests | Security | Debt |
|--------|-------------|---------|----------|-------|----------|------|

### ENDPOINT INVENTORY
| Method | Path | Auth | Validation | Error Handling | Tests | Status |
|--------|------|------|------------|----------------|-------|--------|

### FRONTEND ROUTES
| Route | Component | Auth Guard | States (L/E/S/Empty) | Status |
|-------|-----------|------------|----------------------|--------|

### DATABASE SCHEMA
[Entity-relationship summary]

### SECURITY POSTURE
| Area | State | Risk | Notes |
|------|-------|------|-------|

### REQUIREMENTS GAP
| Requirement | Implemented? | Missing |
|-------------|-------------|---------|

### TECHNICAL DEBT
| ID | Category | Description | Impact | Priority |
|----|----------|-------------|--------|----------|
```

---

## STEP 0.5 — GENERATE ARCHITECTURE.md

**This is the most important output of Phase 0.**

It defines WHAT the system IS — modules, boundaries, data contracts, and design
decisions. Every agent in every future sprint reads this document before touching
code. It serves the same role as a DESIGN_DOC: specification, not instructions.

Write to `.agents/orchestrator/ARCHITECTURE.md`:

```markdown
# ARCHITECTURE — [Project Name]

## System Overview
[2-3 sentences: what this system does, for whom, and why it matters]

---

## Module Map & Boundaries

[Visual representation of the system's modules and how data flows between them.
Adapt to the actual project. Example for a web app:]

    ┌─────────────────────────────────────────────────┐
    │                   CLIENT                        │
    │  Pages → Components → Hooks → API Client        │
    └──────────────────────┬──────────────────────────┘
                           │ HTTP (REST/GraphQL/tRPC)
    ┌──────────────────────▼──────────────────────────┐
    │                   SERVER                        │
    │  Routes → Middleware → Controllers → Services   │
    │                                    → Repository │
    └──────────────────────┬──────────────────────────┘
                           │ ORM/Query
    ┌──────────────────────▼──────────────────────────┐
    │                  DATABASE                       │
    └─────────────────────────────────────────────────┘

---

## Module Specifications

[For EACH module discovered in the project, write a specification.
This is what makes agents effective — deep, specific domain knowledge.]

### Module: [Name] (e.g., "Authentication")
- **Responsibility:** [Single sentence: what this module owns]
- **Location:** [directory path(s)]
- **Key files:** [the 3-5 most important files]
- **Input contract:** [What data/types this module receives and from whom]
- **Output contract:** [What data/types this module produces and for whom]
- **Internal patterns:**
  - [Pattern 1: e.g., "All routes use authMiddleware before controller"]
  - [Pattern 2: e.g., "Tokens are JWT with RS256, verified via jose library"]
- **Constraints:**
  - [Constraint: e.g., "Must support role-based access: admin, manager, staff"]
- **Current state:** [Complete / Partial — what's missing]

### Module: [Name] (e.g., "Menu Management")
- **Responsibility:** ...
- **Location:** ...
- **Input contract:** Receives [type] from [module]
- **Output contract:** Returns [type] to [module]
- ...

[Repeat for EVERY module. Be specific. Include types when they exist.]

---

## Data Contracts Between Modules

[Define the interfaces where modules connect. This is what lets agents
work independently — they know exactly what shape data crosses boundaries.]

| From → To | Interface | Data Shape | Protocol |
|-----------|-----------|------------|----------|
| Client → Server | REST API | DTOs defined in [path] | HTTP JSON |
| Routes → Controllers | Function call | Request + validated body | Direct |
| Controllers → Services | Function call | Domain types | Direct |
| Services → Repository | Function call | Entity types | Direct |
| Repository → DB | ORM | Prisma models | Prisma Client |

[If types/interfaces already exist in the codebase, reference them by path:
 "UserDTO: src/types/user.dto.ts"
 "CreateMenuInput: src/schemas/menu.schema.ts"]

[If types DON'T exist yet, propose them. Mark as (PROPOSED).]

---

## Design Decisions (decided)

[Document decisions that are ALREADY MADE in the existing codebase.
Agents must follow these. They are not negotiable.]

| # | Decision | Chosen | Rationale | Alternatives Rejected |
|---|----------|--------|-----------|----------------------|
| 1 | ORM | Prisma | Already in use, schema defined | TypeORM, Drizzle |
| 2 | Auth | JWT with [lib] | Implemented in auth module | Session-based |
| 3 | State mgmt | [Zustand/Context/etc] | Used across components | Redux, Jotai |
| ... | ... | ... | ... | ... |

---

## Design Decisions (pending — require user input)

[Decisions that Phase 0 cannot make alone. These BLOCK Phase 1.]

| # | Question | Options | Trade-offs | Recommendation |
|---|----------|---------|------------|----------------|
| P1 | [Question] | A: [option] / B: [option] | A: [pro/con] / B: [pro/con] | [recommendation] |

---

## Code Standards (discovered from this project)

[NOT generic "enterprise standards" — these are the ACTUAL patterns
found in THIS codebase. Agents must match these exactly.]

### Naming
- Files: [observed pattern, e.g., "kebab-case for files, PascalCase for components"]
- Functions: [observed pattern]
- Variables: [observed pattern]
- API routes: [observed pattern]

### Error Handling
- Backend: [how errors are handled in existing code, with file reference]
- Frontend: [how errors are handled, with file reference]

### Validation
- Backend: [library and pattern used, e.g., "Zod schemas in src/schemas/"]
- Frontend: [library and pattern used]

### API Response Shape
[The actual response format used in existing endpoints]
  Success: { ... }
  Error: { ... }

### Testing
- Framework: [what's used]
- Location: [where tests live]
- Pattern: [how tests are structured in existing code]

---

## Design Principles

[3-5 principles extracted from the codebase that resolve ambiguity.
These should be SHORT and guide any decision an agent faces.]

1. [Principle: e.g., "Separation of concerns: hooks own logic, components own UI"]
2. [Principle: e.g., "All data mutations go through services, never directly from routes"]
3. [Principle: e.g., "Every async UI operation shows loading, error, success, and empty states"]
```

---

## STEP 0.6 — USER CONSULTATION

**If ARCHITECTURE.md has any "pending" decisions, STOP and present them to the user.**

```
Present each pending decision as:

"I found [N] architectural decisions that need your input before I can plan:

1. [Question]
   Option A: [description] — [trade-off]
   Option B: [description] — [trade-off]
   My recommendation: [X] because [reason]

2. [Question]
   ...

Which options should I use?"

Wait for user response. Update ARCHITECTURE.md with the decisions.
Move pending decisions to the "decided" table.
```

If there are NO pending decisions (architecture is fully determined by existing code), proceed directly to Phase 1.

---

## STEP 0.7 — SELF-CHECK

```
□ Read ALL skill files and config files?
□ Scanned ALL backend routes and frontend pages?
□ PROJECT_STATUS.md written with complete module map and endpoint inventory?
□ ARCHITECTURE.md written with module specifications and data contracts?
□ All design decisions either decided or flagged for user consultation?
□ Code standards reflect ACTUAL project patterns (not generic rules)?
□ User consulted on pending decisions (if any)?
```

---

## ANTI-DRIFT ANCHOR

**You are in Phase 0. Read and document only. Zero code changes.**  
**Your outputs are PROJECT_STATUS.md and ARCHITECTURE.md.**  
**ARCHITECTURE.md is the most important document — it tells agents WHAT the system IS.**
