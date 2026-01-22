# 📉 PEAK HOUR STRESS TEST PLAN

## Goal

Simulate a "Very Good Sales Day" peak hour scenario to validate the `OrderNumberService` fix under sustained load.

## Parameters

- **Duration:** 5 Minutes
- **Virtual Users (VUs):** 60 (10 QA + 50 Production-ready)
- **Traffic Profile:**
  - High frequency (Fast food / Bar heavy usage)
  - Simulated Network Jitter (Latency 20ms - 500ms)
  - Mixed "Order Types" (Metadata simulation)

## Execution Strategy

1. **Script:** `scripts/stress-test-simulation.ts`
   - Use `Prisma` directly (Integration Test level).
   - "Virtual User" loop pattern:
     ```typescript
     while (Date.now() < END_TIME) {
       await thinkTime(); // Random 0.5s - 2s
       await simulateNetworkJitter();
       await orderNumberService.getNextOrderNumber(tx);
     }
     ```
2. **Metrics:**
   - Total Orders Placed
   - Orders/Minute (RPM)
   - Error Rate (Should be 0% for duplicates, <1% for timeouts)
   - Latencies (p50, p95, Max)
3. **Safety:**
   - Monitor for "Heap Out Of Memory" (Node.js)
   - Monitor DB Connection Pool exhaustion

## Deliverables

- `STRESS_TEST_REPORT.md`: Detailed analysis of the 5-minute run.
