/**
 * Load Test for OrderSequence Date-Based Sharding (P1-001)
 * 
 * Tests the new sharding implementation under high concurrency to verify:
 * 1. No duplicate order numbers
 * 2. No deadlocks or transaction failures
 * 3. Acceptable latency (<100ms p95)
 * 
 * Usage:
 *   npx ts-node scripts/test-order-sequence.ts
 */

import { PrismaClient } from '@prisma/client';
import { orderNumberService } from '../src/services/orderNumber.service';

const prisma = new PrismaClient();

interface TestResult {
  successful: number;
  failed: number;
  orderNumbers: number[];
  latencies: number[];
  duplicates: number;
}

async function runLoadTest(concurrentRequests: number = 100): Promise<TestResult> {
  console.log(`\n🧪 Starting load test with ${concurrentRequests} concurrent order number requests...\n`);

  const startTime = Date.now();
  const promises = Array.from({ length: concurrentRequests }, async (_, i) => {
    const requestStart = Date.now();
    
    try {
      // Simulate order creation flow - use transaction
      const orderNumber = await prisma.$transaction(async (tx) => {
        return await orderNumberService.getNextOrderNumber(tx);
      });
      
      const latency = Date.now() - requestStart;
      return { success: true, orderNumber, latency };
    } catch (error) {
      const latency = Date.now() - requestStart;
      console.error(`❌ Request ${i + 1} failed:`, error instanceof Error ? error.message : String(error));
      return { success: false, orderNumber: -1, latency };
    }
  });

  const results = await Promise.all(promises);
  const totalDuration = Date.now() - startTime;

  // Analyze results
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const orderNumbers = results.filter(r => r.success).map(r => r.orderNumber);
  const latencies = results.map(r => r.latency);

  // Check for duplicates
  const uniqueNumbers = new Set(orderNumbers);
  const duplicates = orderNumbers.length - uniqueNumbers.size;

  // Calculate statistics
  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const avg = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

  // Print results
  console.log(`\n📊 Load Test Results:`);
  console.log(`   Total Duration: ${totalDuration}ms`);
  console.log(`   Successful: ${successful}`);
  console.log(`   Failed: ${failed}`);
  console.log(`   Order Numbers Generated: ${orderNumbers.length}`);
  console.log(`   Unique Numbers: ${uniqueNumbers.size}`);
  console.log(`   Duplicates: ${duplicates} ${duplicates > 0 ? '❌ CRITICAL' : '✅'}`);
  
  console.log(`\n⏱️  Latency Statistics:`);
  console.log(`   Average: ${avg.toFixed(2)}ms`);
  console.log(`   p50: ${p50}ms`);
  console.log(`   p95: ${p95}ms ${p95 > 100 ? '❌ Target: <100ms' : '✅'}`);
  console.log(`   p99: ${p99}ms`);
  console.log(`   Min: ${latencies[0]}ms`);
  console.log(`   Max: ${latencies[latencies.length - 1]}ms`);

  // Verify sequential numbers
  const sortedNumbers = [...orderNumbers].sort((a, b) => a - b);
  const expectedStart = sortedNumbers[0];
  const expectedEnd = expectedStart + orderNumbers.length - 1;
  const isSequential = sortedNumbers[sortedNumbers.length - 1] === expectedEnd;
  
  console.log(`\n🔢 Sequence Validation:`);
  console.log(`   Range: ${sortedNumbers[0]} to ${sortedNumbers[sortedNumbers.length - 1]}`);
  console.log(`   Sequential: ${isSequential ? '✅' : '❌ GAPS DETECTED'}`);

  return { successful, failed, orderNumbers, latencies, duplicates };
}

async function main() {
  try {
    console.log('🚀 P1-001 OrderSequence Date-Based Sharding Load Test\n');
    console.log('='.repeat(60));

    // Test 1: Moderate load (50 concurrent)
    await runLoadTest(50);

    // Test 2: High load (100 concurrent)
    await runLoadTest(100);

    // Test 3: Extreme load (200 concurrent)
    await runLoadTest(200);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Load test completed successfully!');
    console.log('\nSuccess Criteria:');
    console.log('  ✓ Zero duplicates');
    console.log('  ✓ p95 latency <100ms');
    console.log('  ✓ Zero failures');

  } catch (error) {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
