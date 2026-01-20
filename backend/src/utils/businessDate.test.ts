/**
 * @fileoverview Tests for business date utility functions
 * 
 * CRITICAL: These tests verify the 6 AM cutoff rule and hourly sharding logic
 */

import { describe, it, expect } from '@jest/globals';
import { getBusinessDate, getBusinessDateKey, getBusinessDateKeyHourly } from './businessDate';

describe('getBusinessDate', () => {
  it('should return same day if after 6 AM', () => {
    const testDate = new Date('2026-01-19T08:00:00');  // 8 AM
    const result = getBusinessDate(testDate);
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);  // January = 0
    expect(result.getDate()).toBe(19);
    expect(result.getHours()).toBe(0);  // Midnight
  });
  
  it('should return previous day if before 6 AM', () => {
    const testDate = new Date('2026-01-19T05:30:00');  // 5:30 AM
    const result = getBusinessDate(testDate);
    
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(18);  // Previous day
    expect(result.getHours()).toBe(0);  // Midnight
  });
  
  it('should handle exactly 6 AM as current day', () => {
    const testDate = new Date('2026-01-19T06:00:00');  // Exactly 6 AM
    const result = getBusinessDate(testDate);
    
    expect(result.getDate()).toBe(19);  // Same day
  });
});

describe('getBusinessDateKey', () => {
  it('should format date as YYYYMMDD', () => {
    const testDate = new Date('2026-01-19T14:30:00');  // Jan 19, 2PM
    const result = getBusinessDateKey(testDate);
    
    expect(result).toBe('20260119');
  });
  
  it('should pad single-digit month', () => {
    const testDate = new Date('2026-03-05T10:00:00');  // March 5
    const result = getBusinessDateKey(testDate);
    
    expect(result).toBe('20260305');
  });
  
  it('should apply 6 AM rule', () => {
    const testDate = new Date('2026-01-20T02:30:00');  // Jan 20, 2:30 AM
    const result = getBusinessDateKey(testDate);
    
    expect(result).toBe('20260119');  // Business date is Jan 19
  });
});

describe('getBusinessDateKeyHourly', () => {
  it('should format date as YYYYMMDDHH', () => {
    const testDate = new Date('2026-01-19T14:30:00');  // Jan 19, 2:30 PM
    const result = getBusinessDateKeyHourly(testDate);
    
    expect(result).toBe('2026011914');  // Hour = 14
  });
  
  it('should pad single-digit hour', () => {
    const testDate = new Date('2026-01-19T08:15:00');  // 8:15 AM
    const result = getBusinessDateKeyHourly(testDate);
    
    expect(result).toBe('2026011908');  // Hour = 08
  });
  
  it('should use ORIGINAL hour even with 6 AM rule', () => {
    // CRITICAL TEST: Verify hour is from original timestamp
    const testDate = new Date('2026-01-20T02:30:00');  // Jan 20, 2:30 AM
    const result = getBusinessDateKeyHourly(testDate);
    
    // Business date: Jan 19 (due to 6 AM rule)
    // Hour: 02 (from original timestamp, NOT midnight)
    expect(result).toBe('2026011902');
  });
  
  it('should handle midnight correctly', () => {
    const testDate = new Date('2026-01-19T00:30:00');  // 12:30 AM
    const result = getBusinessDateKeyHourly(testDate);
    
    // Before 6 AM, so business date is Jan 18
    // Hour is 00 from original timestamp
    expect(result).toBe('2026011800');
  });
  
  it('should handle late night hours (22-23)', () => {
    const testDate = new Date('2026-01-19T23:45:00');  // 11:45 PM
    const result = getBusinessDateKeyHourly(testDate);
    
    expect(result).toBe('2026011923');
  });
  
  it('should create 24 unique keys per day', () => {
    const keys = new Set<string>();
    
    // Generate keys for every hour of Jan 19
    for (let hour = 0; hour < 24; hour++) {
      const testDate = new Date(`2026-01-19T${String(hour).padStart(2, '0')}:30:00`);
      const key = getBusinessDateKeyHourly(testDate);
      keys.add(key);
    }
    
    // Should have 24 unique keys (one per hour)
    // Note: Hours 0-5 will map to previous day's business date
    expect(keys.size).toBe(24);
  });
  
  it('should maintain chronological ordering', () => {
    const date1 = new Date('2026-01-19T13:00:00');  // 1 PM
    const date2 = new Date('2026-01-19T14:00:00');  // 2 PM
    const date3 = new Date('2026-01-19T15:00:00');  // 3 PM
    
    const key1 = getBusinessDateKeyHourly(date1);  // "2026011913"
    const key2 = getBusinessDateKeyHourly(date2);  // "2026011914"
    const key3 = getBusinessDateKeyHourly(date3);  // "2026011915"
    
    // Keys should be in ascending order (string comparison works here)
    expect(key1 < key2).toBe(true);
    expect(key2 < key3).toBe(true);
  });
});

describe('Performance characteristics', () => {
  it('should reduce contention - different hours produce different keys', () => {
    const order1 = new Date('2026-01-19T13:00:00');  // 1 PM
    const order2 = new Date('2026-01-19T14:00:00');  // 2 PM
    
    const key1 = getBusinessDateKeyHourly(order1);
    const key2 = getBusinessDateKeyHourly(order2);
    
    // Different hours = different sequence rows = no lock contention
    expect(key1).not.toBe(key2);
    expect(key1).toBe('2026011913');
    expect(key2).toBe('2026011914');
  });
  
  it('should group orders within same hour - same key', () => {
    const order1 = new Date('2026-01-19T14:15:00');  // 2:15 PM
    const order2 = new Date('2026-01-19T14:45:00');  // 2:45 PM
    
    const key1 = getBusinessDateKeyHourly(order1);
    const key2 = getBusinessDateKeyHourly(order2);
    
    // Same hour = same key = will compete for same lock (expected)
    expect(key1).toBe(key2);
    expect(key1).toBe('2026011914');
  });
});
