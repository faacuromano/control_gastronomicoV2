# External Code Audit — Production API

## Context

You are an **external senior consultant** hired to audit a production Node.js API. The development team is junior-level — they built this project ~1 year ago and haven't maintained it since. Your recommendations must:

- Be **understandable by junior developers** — no over-engineering, no abstractions they can't follow
- Preserve the existing code style and patterns they already know
- Include brief explanations of _why_ each fix matters (educational value)
- Be implementable **without breaking the live API** (zero-downtime, backward-compatible, incremental)

```
STATUS: Production (live)  |  STACK: Node.js, Express.js, Prisma, AWS S3
```

## Deliverables

1. `code-audit-report.docx` — Professional report (structure below)
2. **Quality Score:** 1–100 (honest, not generous)
3. **Readiness Percentage:** How production-ready vs modern standards

## Skills (read ALL before starting)

1. `.claude/skills/code-reviewer` → Issue detection & classification
2. `.claude/skills/senior-backend` → Solution design & production-safe fixes
3. `.claude/skills/docx` → Document formatting

## Agent

`.claude/agents/code-reviewer.md`

---

## Execution — 3 Sequential Phases

### Phase 1: Discovery (Code Reviewer)

Read **every file**. Catalog issues using:

| Severity    | Meaning                       |
| ----------- | ----------------------------- |
| 🔴 Critical | Security risk / data loss     |
| 🟠 High     | Bugs / reliability failures   |
| 🟡 Medium   | Maintainability / performance |
| 🔵 Low      | Style / conventions           |
| ⚪ Info     | Suggestions / observations    |

For each: **what** → **where** (file + line) → **why it matters** → **severity**

Group by category: Security, Error Handling, API Design, Database, S3, Performance, Dependencies, Config, Testing, Docs.

**Output:** `audit-phase1-discovery.md` → forward to Phase 2.

### Phase 2: Solutions (Senior Backend Dev)

Review Phase 1 findings. For each confirmed issue propose:

- **Fix:** Concrete solution with code examples. Written so a junior dev can understand and implement it without guessing. Avoid suggesting patterns or tools the team doesn't already use unless strictly necessary (and if so, explain why).
- **Effort:** Low / Medium / High
- **Priority:** Immediate / Short-term / Medium-term / Backlog
- **Risk:** What could break if done wrong

Group into a roadmap:

- **Tier 1 — Now:** Critical security & reliability
- **Tier 2 — Next sprint:** High-impact improvements
- **Tier 3 — Next quarter:** Hardening & quality-of-life

Flag **quick wins** (low effort, high value, ship today).

**Output:** `audit-phase2-recommendations.md` → forward to Phase 3.

### Phase 3: Report (DOCX)

Generate `code-audit-report.docx` with:

1. **Cover Page** — Project, date, stack, auditor
2. **Executive Summary** — Assessment, Quality Score, Readiness %, top 3 critical findings, top 3 quick wins
3. **Scoring Breakdown:**

| Category       | Weight |
| -------------- | ------ |
| Security       | 20%    |
| Error Handling | 15%    |
| API Design     | 15%    |
| Database       | 12%    |
| Code Quality   | 10%    |
| Performance    | 8%     |
| Dependencies   | 7%     |
| Config         | 5%     |
| Testing        | 5%     |
| Documentation  | 3%     |

4. **Detailed Findings** — By category, each with description, location, severity, impact, fix (with code)
5. **Implementation Roadmap** — Tier 1/2/3, effort estimates, dependency order
6. **Appendix** — Full issue table, dependency audit, files reviewed

**Tone of the report:** Professional but accessible. Written _for_ the junior team — explain the "why" behind each recommendation. This is a consulting deliverable, not an internal code review. The team should finish reading it feeling guided, not overwhelmed.

## Rules

- Read skills before starting. Each phase completes before the next.
- Every finding must reference **actual files and lines** — nothing generic.
- Score honestly. If the code is in bad shape, say so clearly.
- Respect that this is a live API serving real users.
- Keep solutions within the team's current skill level. Complexity is not improvement.
