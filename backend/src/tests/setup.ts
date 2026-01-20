/**
 * Vitest setup file
 * Runs before all tests
 */

import { vi } from 'vitest';

// Mock environment variables
process.env.TZ = 'America/Argentina/Buenos_Aires';
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(() => {
  // Setup code that runs once before all tests
});

afterAll(() => {
  // Cleanup code that runs once after all tests
});
