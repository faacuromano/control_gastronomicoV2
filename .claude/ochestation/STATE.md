# STATE — Orchestrator State Machine

> **Update this file BEFORE starting any new phase or step.**  
> **Read this file FIRST after any context reset.**

## CURRENT POSITION

```
phase: 2
step: 2.0
sprint: 11
status: IN_PROGRESS
last_updated: 2026-02-07 00:50
```

## VALID STATES

```
phase: 0 → Discovery + Architecture
  step: 0.1 → Reading skills/docs | 0.2 → Scanning structure | 0.3 → Deep code scan
  step: 0.4 → Generating PROJECT_STATUS.md | 0.5 → Generating ARCHITECTURE.md
  step: 0.6 → User consultation on architecture | 0.7 → Self-check

phase: 1 → Planning + Agent Creation
  step: 1.1 → Reading state | 1.2 → Identifying tasks | 1.3 → Organizing sprints
  step: 1.4 → Creating module agents | 1.5 → Self-check

phase: 2 → Execution (sprint N)
  step: 2.0 → Sprint init | 2.1.[task] → Executing task
  step: 2.1.[task].pre → Pre-read | 2.1.[task].impl → Implementing
  step: 2.1.[task].run → Running code | 2.1.[task].verify → Verifying
  step: 2.3 → Re-execution (recode cycle [1|2])

phase: 3 → Review
  step: 3.0 → Prep + execution gate | 3.1 → Security | 3.2 → Quality
  step: 3.3 → Architecture | 3.4 → Verdict

phase: 4 → Feedback
  step: 4.1 → Gathering learnings | 4.2 → Updating skills | 4.3 → Updating status

phase: 5 → Reporting
  step: 5.1 → Sprint report | 5.2 → Git commit | 5.3 → Iteration log
  step: 5.4 → Next action | 5.5 → Metadata pruning (every 5) | 5.6 → Human checkpoint (every 5)

status: NOT_STARTED | IN_PROGRESS | COMPLETED | BLOCKED | WAITING_USER
```

## SPRINT TRACKER

| Sprint | Status | Verdict | Recode Cycles | Notes |
|--------|--------|---------|---------------|-------|
| 1 | COMPLETED | PASS | 0 | Input validation: category, product, printer, kdsStation |
| 2 | COMPLETED | PASS | 0 | Input validation: auth, table, order, qr |
| 3 | COMPLETED | PASS | 0 | Core service unit tests: order + auth (67 tests, 0 failures) |
| 4 | COMPLETED | PASS | 0 | Invoicing frontend: InvoicesPage + InvoiceDetail + route + nav |
| 5 | COMPLETED | PASS (PRE-EXISTING) | 0 | Analytics: all endpoints + dashboard already complete |
| 6 | COMPLETED | PASS | 0 | Audit log: backend endpoint + frontend page with filters/pagination |
| 7 | COMPLETED | PASS (PRE-EXISTING) | 0 | Delivery webhooks: Rappi + PedidosYa fully implemented |
| 8 | COMPLETED | PASS (PRE-EXISTING) | 0 | Sync/Offline: conflict resolution, retries, notifications |
| 9 | COMPLETED | PASS | 0 | Client/Loyalty: detail view + points/wallet columns + operations UI |
| 10 | COMPLETED | PASS | 0 | Discounts: admin page + service enhancement + route + nav |
| 11 | COMPLETED | PASS | 0 | Unit tests: cashShift (17) + table (25) + payment (22) = 65 new tests |
| 12 | COMPLETED | PASS | 0 | Unit tests: category (14) + product (19) + discount (19) = 56 new tests |

## LAST COMPLETED ACTION

```
action: Sprint 12 complete — Unit tests for Product/Category/Discount services
output: .agents/reports/sprint-012-review.md
next: Sprint 13 (Sync fix + final report) — then human checkpoint
```

## RECOVERY

1. Read `phase` and `step` above
2. Read ARCHITECTURE.md (what the system IS)
3. Read the corresponding PHASE-[N] file
4. Jump to the indicated step
5. Continue from `next`. Do NOT re-execute completed steps.
