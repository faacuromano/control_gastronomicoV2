
/**
 * @fileoverview PEAK HOUR STRESS TEST SIMULATION
 * 
 * SCENARIO: "Very Good Sales Day"
 * DURATION: 5 Minutes
 * USERS: 60 Concurrent (10 QA + 50 Production)
 * BEHAVIOR: Mixed Latency, High Frequency
 */

import { PrismaClient } from '@prisma/client';
import { orderNumberService } from '../src/services/orderNumber.service';
import { performance } from 'perf_hooks';

const DURATION_MS = 5 * 60 * 1000; // 5 Minutes
const CONCURRENCY = 60;
const DB_URL = process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: { db: { url: DB_URL } },
  log: ['error'], // Only log critical errors to keep throughput high
});

interface Metric {
  latency: number;
  timestamp: number;
  success: boolean;
  error?: string;
  type: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';
}

const metrics: Metric[] = [];
let isRunning = true;

// Utility for random delays (Network Jitter + Think Time)
const randomDelay = (min: number, max: number) => 
  new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));

// Virtual User Simulation
async function simulateUser(userId: number) {
  // Stagger start to avoid initial spike crashing Node immediately
  await randomDelay(0, 2000);

  while (isRunning) {
    const start = performance.now();
    // Simulate order type distribution
    const rand = Math.random();
    const type = rand < 0.6 ? 'DINE_IN' : (rand < 0.8 ? 'TAKEAWAY' : 'DELIVERY');

    try {
      // 1. Simulate Network Latency (Jitter)
      // "Conexiones desde lugares diferentes"
      await randomDelay(20, 300); 

      // 2. Execute Critical Path
      await prisma.$transaction(async (tx) => {
        await orderNumberService.getNextOrderNumber(tx);
      }, {
        maxWait: 5000, 
        timeout: 10000 
      });

      const latency = performance.now() - start;
      metrics.push({ latency, timestamp: Date.now(), success: true, type });

      // 3. User "Think Time" before next order (Fast paced environment)
      // Bartender hits buttons fast: 500ms - 1500ms
      await randomDelay(500, 1500);

    } catch (error: any) {
      const latency = performance.now() - start;
      metrics.push({ latency, timestamp: Date.now(), success: false, error: error.message, type });
      
      // On error, wait a bit longer (Backoff)
      await randomDelay(1000, 2000);
    }
  }
}

async function runStressTest() {
  console.log(`\n🚀 STARTING PEAK HOUR SIMULATION`);
  console.log(`================================`);
  console.log(`Duration:    ${DURATION_MS / 1000} seconds`);
  console.log(`Users:       ${CONCURRENCY} concurrent`);
  console.log(`Simulating:  Network Jitter, Mixed Latency, Burst Traffic`);
  
  const startTime = Date.now();
  const endTime = startTime + DURATION_MS;

  // Warmup
  try {
    await prisma.$connect();
    // Ensure DB is responsive
    await prisma.orderSequence.findFirst(); 
  } catch (e) {
    console.error("Fatal: DB Connection Failed", e);
    process.exit(1);
  }

  // Start Status Logger
  const statusInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const count = metrics.length;
    const errors = metrics.filter(m => !m.success).length;
    const rate = (count / elapsed).toFixed(1);
    
    process.stdout.write(`\r[${elapsed.toFixed(0)}s/${DURATION_MS/1000}s] Orders: ${count} | Errors: ${errors} | Speed: ${rate} req/s`);
  }, 2000);

  // Launch Virtual Users
  const userPromises = Array.from({ length: CONCURRENCY }).map((_, i) => simulateUser(i + 1));

  // Run for DURATION
  while (Date.now() < endTime) {
    await randomDelay(1000, 1000);
  }

  // Stop
  isRunning = false;
  clearInterval(statusInterval);
  await Promise.all(userPromises);
  
  await prisma.$disconnect();

  // REPORT GENERATION
  const durationSec = (Date.now() - startTime) / 1000;
  const successful = metrics.filter(m => m.success);
  const failed = metrics.filter(m => !m.success);
  const latencies = successful.map(m => m.latency).sort((a, b) => a - b);
  
  const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
  
  console.log(`\n\n📝 STRESS TEST REPORT`);
  console.log(`================================`);
  console.log(`Total Duration: ${durationSec.toFixed(2)}s`);
  console.log(`Total Orders:   ${metrics.length}`);
  console.log(`Successful:     ${successful.length}`);
  console.log(`Failed:         ${failed.length} (${(failed.length / metrics.length * 100).toFixed(2)}%)`);
  console.log(`Throughput:     ${(metrics.length / durationSec).toFixed(2)} req/sec`);
  console.log(`\n⏱️ LATENCY DISTRIBUTION`);
  console.log(`P50:            ${p50.toFixed(0)}ms`);
  console.log(`P95:            ${p95.toFixed(0)}ms`);
  console.log(`P99:            ${p99.toFixed(0)}ms`);
  console.log(`Max:            ${latencies[latencies.length-1]?.toFixed(0) || 0}ms`);
  
  if (failed.length > 0) {
      console.log(`\n❌ TOP ERRORS`);
      const errMap: Record<string, number> = {};
      failed.forEach(f => {
          const key = f.error?.substring(0, 50) || 'Unknown';
          errMap[key] = (errMap[key] || 0) + 1;
      });
      console.table(errMap);
  }
}

runStressTest().catch(console.error);
