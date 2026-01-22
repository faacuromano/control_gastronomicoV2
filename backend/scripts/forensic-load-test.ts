
/**
 * @fileoverview Forensic Load Test for OrderNumberService
 * 
 * SIMULATES: Thundering Herd (Power recovery scenario)
 * TARGET: OrderNumberService.getNextOrderNumber (Critical Path)
 * 
 * USAGE: npx ts-node scripts/forensic-load-test.ts
 */

import { PrismaClient } from '@prisma/client';
import { orderNumberService } from '../src/services/orderNumber.service';
import { performance } from 'perf_hooks';

// CONFIGURATION
const CONCURRENCY = process.env.CONCURRENCY ? parseInt(process.env.CONCURRENCY) : 100;
const DATABASE_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: DATABASE_URL,
    },
  },
  // Increase connection pool to handle high concurrency simulation? 
  // actually, we want to see how it handles the constraint of the pool too, 
  // but let's give it enough connections to not maintain queue in node.
  log: ['error', 'warn'],
});

interface RequestResult {
  success: boolean;
  latency: number;
  error?: string;
  orderNumber?: number;
}

async function runLoadTest() {
  console.log(`\n🚦 STARTING FORENSIC LOAD TEST`);
  console.log(`=================================`);
  console.log(`Concurrency: ${CONCURRENCY} users`);
  console.log(`Target: OrderNumberService.getNextOrderNumber`);
  
  // Warmup
  console.log(`\nHeating up connection pool...`);
  try {
      await prisma.$connect();
      await prisma.orderSequence.findFirst(); 
  } catch (e) {
      console.error("Failed to connect/warmup:", e);
      process.exit(1);
  }

  const results: RequestResult[] = [];
  const startTotal = performance.now();

  // Create array of tasks
  const tasks = Array.from({ length: CONCURRENCY }).map(async (_, index) => {
    const start = performance.now();
    try {
      return await prisma.$transaction(async (tx) => {
        const result = await orderNumberService.getNextOrderNumber(tx);
        const latency = performance.now() - start;
        return {
          success: true,
          latency,
          orderNumber: result.orderNumber
        };
      }, {
        maxWait: 10000, // Wait max 10s for transaction
        timeout: 10000  // Transaction must complete in 10s
      });
    } catch (error: any) {
      const latency = performance.now() - start;
      return {
        success: false,
        latency,
        error: error.message || String(error)
      };
    }
  });

  console.log(`💥 Unleashing ${CONCURRENCY} concurrent requests...`);
  const promiseResults = await Promise.all(tasks);
  results.push(...promiseResults);

  const endTotal = performance.now();
  const totalDuration = endTotal - startTotal;

  await prisma.$disconnect();

  // ANALYSIS
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  const latencies = successful.map(r => r.latency).sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const min = latencies[0] || 0;
  const max = latencies[latencies.length - 1] || 0;

  console.log(`\n📊 RESULTS SUMMARY`);
  console.log(`=================================`);
  console.log(`Total Time:       ${totalDuration.toFixed(2)}ms`);
  console.log(`Successful:       ${successful.length} (${(successful.length/CONCURRENCY*100).toFixed(1)}%)`);
  console.log(`Failed:           ${failed.length} (${(failed.length/CONCURRENCY*100).toFixed(1)}%)`);
  console.log(`Throughput:       ${(successful.length / (totalDuration/1000)).toFixed(2)} req/sec`);
  
  console.log(`\n⏱️ LATENCY (Successful only)`);
  console.log(`---------------------------------`);
  console.log(`Min:              ${min.toFixed(2)}ms`);
  console.log(`P50 (Median):     ${p50.toFixed(2)}ms`);
  console.log(`P95:              ${p95.toFixed(2)}ms`);
  console.log(`P99:              ${p99.toFixed(2)}ms`);
  console.log(`Max:              ${max.toFixed(2)}ms`);

  if (failed.length > 0) {
    console.log(`\n❌ FAILURE ANALYSIS`);
    console.log(`---------------------------------`);
    const errorCounts: Record<string, number> = {};
    failed.forEach(f => {
      const msg = f.error || 'Unknown';
      const key = msg.includes('deadlock') ? 'DEADLOCK' : 
                  msg.includes('timeout') ? 'TIMEOUT' : 
                  msg.substring(0, 50);
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    console.table(errorCounts);
  }

  // VALIDATION
  const orderNumbers = successful.map(r => r.orderNumber).filter(n => n !== undefined) as number[];
  const uniqueNumbers = new Set(orderNumbers);
  const duplicates = orderNumbers.length - uniqueNumbers.size;

  console.log(`\n🛡️ INTEGRITY CHECK`);
  console.log(`---------------------------------`);
  console.log(`Generated IDs:    ${orderNumbers.length}`);
  console.log(`Unique IDs:       ${uniqueNumbers.size}`);
  console.log(`Duplicates:       ${duplicates} ${duplicates === 0 ? '✅' : '❌'}`);

  if (duplicates > 0) {
    console.error(`CRITICAL FAILURE: DUPLICATE ORDER NUMBERS DETECTED!`);
    process.exit(1);
  }
}

runLoadTest().catch(console.error);
