# PHASE 3 — REVIEW

> **Purpose:** Verify code quality, security, and contract compliance.  
> **Runs:** After every sprint execution + after recode cycles.  
> **Input:** Code changes + shared reports + ARCHITECTURE.md  
> **Output:** Review report + VERDICT (PASS / CONTINUE / RECODE)  
> **BLOCKING. Sprint cannot close without verdict.**

---

## STEP 3.0 — PREPARATION + EXECUTION GATE

```
1. Read ALL agent reports from .agents/shared/sprint-NNN/
2. Read sprint definition from IMPLEMENTATION_PLAN.md (acceptance criteria)
3. Read ARCHITECTURE.md §Module Specifications (contracts to verify)
4. Read evolved skills (check if old pitfalls recurred)
5. List ALL files created/modified
```

**EXECUTION GATE (before any code review):**
```
1. Check agent reports: did every agent report tsc: PASS, tests: PASS?
   → If ANY FAIL → IMMEDIATE VERDICT: RECODE (code doesn't compile)

2. RUN independently (don't trust agent reports):
   → npx tsc --noEmit | head -50
   → npm test | tail -50
   → If results differ from reports: flag TRUST ISSUE → RECODE

3. Static analysis (if available):
   → eslint, npm audit --production, semgrep
```

---

## STEP 3.1 — CONTRACT VERIFICATION (new)

**Does the code match what ARCHITECTURE.md says the system IS?**

```
For each task in this sprint:
  □ Does the output match the type/interface defined in ARCHITECTURE.md §Contracts?
  □ Does the module respect its boundary (no imports from wrong layers)?
  □ Do new files follow the code standards from ARCHITECTURE.md §Code Standards?
  □ If new types were created, are they consistent with existing contracts?
  □ If a contract was changed: was it documented and was the user consulted?
```

**Contract violations are HIGH severity** — they affect every module that depends on this one.

---

## STEP 3.2 — SECURITY AUDIT

```
Agent: security-auditor.md
```

For every modified file, check OWASP Top 10 (2021) categories:
A01 (Access Control), A02 (Crypto), A03 (Injection), A04 (Insecure Design),
A05 (Misconfiguration), A06 (Vulnerable Components), A07 (Auth Failures),
A08 (Data Integrity), A09 (Logging), A10 (SSRF).

**Focus on what's RELEVANT to the sprint's changes.** Don't checkbox every
OWASP item if the sprint only touches frontend components. Prioritize:
- Any endpoint that handles user input → A03, A01
- Any auth-related code → A02, A07, A04
- Any file upload or URL handling → A10, A08
- Any new dependency → A06

---

## STEP 3.3 — CODE QUALITY + ARCHITECTURE

```
Agents: code-reviewer.md + architecture-reviewer.md
```

```
QUALITY:
  □ Naming consistent with ARCHITECTURE.md §Code Standards?
  □ Functions reasonable length (<40 lines)?
  □ TypeScript strict (zero any, zero ts-ignore without justification)?
  □ DRY (no copy-pasted code)?

ARCHITECTURE:
  □ Layer dependencies correct (per ARCHITECTURE.md §Module Map)?
  □ Modules loosely coupled?
  □ New code matches existing patterns in its module?
```

---

## STEP 3.4 — VERDICT

Write review report to `.agents/reports/sprint-NNN-review.md` AND `.agents/shared/sprint-NNN/`:

```markdown
# REVIEW — Sprint [N] | [YYYY-MM-DD]

### Contract Compliance
| Module | Contract | Matches ARCHITECTURE.md? | Notes |
|--------|----------|--------------------------|-------|

### Security Findings
| ID | OWASP | Severity | File:Line | Description | Action |
|----|-------|----------|-----------|-------------|--------|

### Quality/Architecture Findings
| ID | Category | Severity | File:Line | Description | Action |
|----|----------|----------|-----------|-------------|--------|

### Execution Validation
| Check | Agent Reported | Reviewer Verified | Match? |
|-------|---------------|-------------------|--------|

### Acceptance Criteria
| Criterion | Met? | Evidence |
|-----------|------|----------|

### VERDICT: [PASS / CONTINUE / RECODE]
```

**Decision tree:**
```
GATE 0: tsc/tests/build FAIL?           → RECODE
GATE 1: Agent reports ≠ reviewer results? → RECODE (trust issue)
GATE 2: CRITICAL findings?               → RECODE
GATE 3: HIGH security findings?           → RECODE
GATE 4: Contract violations?              → RECODE
GATE 5: Unmet criteria due to bugs?       → RECODE
GATE 6: Unmet criteria (future sprint)?   → CONTINUE
GATE 7: Only MEDIUM/LOW findings?         → PASS
```

**PASS** → Phase 4. **CONTINUE** → Phase 4 (carry over criteria). **RECODE** → Phase 2.3 (max 2 cycles).

---

## SELF-CHECK

```
□ Ran independent tsc + tests?
□ Verified contracts match ARCHITECTURE.md?
□ Checked security for relevant OWASP categories?
□ Verdict justified by findings?
□ Report written to reports/ and shared/?
```

---

## ANTI-DRIFT ANCHOR

**Phase 3: Review. Evaluate, don't implement.**  
**Contracts are as important as security. A broken contract affects all dependents.**  
**RECODE on: compilation failure, trust issues, critical/high findings, contract violations.**
