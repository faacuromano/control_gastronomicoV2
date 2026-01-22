/**
 * @fileoverview Unit Tests for Prisma Extensions
 * 
 * Tests the state machine validation and error types.
 * Integration tests for transaction helpers require database connection.
 * 
 * @module tests/prisma-extensions.test
 */

import {
  isValidStatusTransition,
  assertValidStatusTransition,
  InvalidStateTransitionError,
  LockTimeoutError,
} from '../src/lib/prisma-extensions';

describe('prisma-extensions', () => {
  
  // =========================================================================
  // STATE MACHINE TESTS
  // =========================================================================
  
  describe('isValidStatusTransition', () => {
    
    it('should allow PENDING → CONFIRMED', () => {
      expect(isValidStatusTransition('PENDING', 'CONFIRMED')).toBe(true);
    });

    it('should allow PENDING → CANCELLED', () => {
      expect(isValidStatusTransition('PENDING', 'CANCELLED')).toBe(true);
    });

    it('should allow CONFIRMED → PREPARING', () => {
      expect(isValidStatusTransition('CONFIRMED', 'PREPARING')).toBe(true);
    });

    it('should allow PREPARING → READY', () => {
      expect(isValidStatusTransition('PREPARING', 'READY')).toBe(true);
    });

    it('should allow READY → ON_ROUTE', () => {
      expect(isValidStatusTransition('READY', 'ON_ROUTE')).toBe(true);
    });

    it('should allow READY → DELIVERED (direct)', () => {
      expect(isValidStatusTransition('READY', 'DELIVERED')).toBe(true);
    });

    it('should allow ON_ROUTE → DELIVERED', () => {
      expect(isValidStatusTransition('ON_ROUTE', 'DELIVERED')).toBe(true);
    });

    // Critical P0-001 test: CANCELLED is terminal
    it('should NOT allow CANCELLED → any state (terminal)', () => {
      expect(isValidStatusTransition('CANCELLED', 'PENDING')).toBe(false);
      expect(isValidStatusTransition('CANCELLED', 'CONFIRMED')).toBe(false);
      expect(isValidStatusTransition('CANCELLED', 'PREPARING')).toBe(false);
      expect(isValidStatusTransition('CANCELLED', 'READY')).toBe(false);
      expect(isValidStatusTransition('CANCELLED', 'ON_ROUTE')).toBe(false);
      expect(isValidStatusTransition('CANCELLED', 'DELIVERED')).toBe(false);
    });

    // Critical P0-001 test: DELIVERED is terminal
    it('should NOT allow DELIVERED → any state (terminal)', () => {
      expect(isValidStatusTransition('DELIVERED', 'PENDING')).toBe(false);
      expect(isValidStatusTransition('DELIVERED', 'CANCELLED')).toBe(false);
    });

    it('should NOT allow backwards transitions', () => {
      expect(isValidStatusTransition('CONFIRMED', 'PENDING')).toBe(false);
      expect(isValidStatusTransition('READY', 'PREPARING')).toBe(false);
      expect(isValidStatusTransition('DELIVERED', 'ON_ROUTE')).toBe(false);
    });

    it('should NOT allow skipping states', () => {
      expect(isValidStatusTransition('PENDING', 'READY')).toBe(false);
      expect(isValidStatusTransition('CONFIRMED', 'DELIVERED')).toBe(false);
    });

    it('should return false for unknown states', () => {
      expect(isValidStatusTransition('UNKNOWN', 'CONFIRMED')).toBe(false);
    });
  });

  describe('assertValidStatusTransition', () => {
    
    it('should not throw for valid transitions', () => {
      expect(() => {
        assertValidStatusTransition('PENDING', 'CONFIRMED');
      }).not.toThrow();
    });

    it('should throw InvalidStateTransitionError for invalid transitions', () => {
      expect(() => {
        assertValidStatusTransition('CANCELLED', 'CONFIRMED');
      }).toThrow(InvalidStateTransitionError);
    });

    it('should include current and attempted state in error message', () => {
      try {
        assertValidStatusTransition('CANCELLED', 'ON_ROUTE');
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidStateTransitionError);
        expect((error as InvalidStateTransitionError).message).toContain('CANCELLED');
        expect((error as InvalidStateTransitionError).message).toContain('ON_ROUTE');
      }
    });
  });

  // =========================================================================
  // ERROR TYPE TESTS
  // =========================================================================

  describe('LockTimeoutError', () => {
    
    it('should have correct properties', () => {
      const error = new LockTimeoutError('Order:123', 5000);
      
      expect(error.code).toBe('LOCK_TIMEOUT');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('LockTimeoutError');
      expect(error.message).toContain('Order:123');
      expect(error.message).toContain('5000ms');
    });
  });

  describe('InvalidStateTransitionError', () => {
    
    it('should have correct properties', () => {
      const error = new InvalidStateTransitionError('CANCELLED', 'transition to CONFIRMED');
      
      expect(error.code).toBe('INVALID_STATE_TRANSITION');
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('InvalidStateTransitionError');
      expect(error.message).toContain('CANCELLED');
      expect(error.message).toContain('transition to CONFIRMED');
    });
  });
});
