/**
 * E2E Test: Cash Shift Lifecycle
 * Tests opening, operating, and closing cash shifts
 */

describe('Cash Shift Lifecycle', () => {
  beforeEach(() => {
    // Login as admin/cashier
    cy.visit('/');
    cy.get('[data-testid="pin-input"]').type('999999');
    cy.get('[data-testid="btn-login"]').click();
  });

  it('completes full cash shift cycle', () => {
    // Step 1: Ensure clean state (close shift if open)
    cy.visit('/cash');
    
    // Check if close button exists in header or page
    cy.get('body').then($body => {
      if ($body.find('[data-testid="btn-close-shift"]').length > 0) {
        cy.log('Closing existing shift...');
        // Use force:true in case it's in a dropdown or weird state
        cy.get('[data-testid="btn-close-shift"]').click({force: true});
        cy.get('[data-testid="modal-close-shift"]').should('be.visible').within(() => {
          cy.get('input').type('0');
          cy.get('[data-testid="btn-confirm-close"]').click();
        });
        // Wait for close completion
        cy.contains('Caja Abierta').should('not.exist');
        cy.wait(1000);
      }
    });

    // Now open shift using button on CashPage (or modal if auto-opened)
    cy.get('body').then($body => {
        if ($body.find('[data-testid="modal-open-shift"]').length > 0) {
            cy.log('Modal already open');
        } else {
            cy.get('[data-testid="btn-open-shift"]').should('be.visible').click();
        }
    });
    
    // Enter opening amount
    cy.get('[data-testid="modal-open-shift"]').within(() => {
      cy.get('input[name="startAmount"]').type('5000');
      cy.get('[data-testid="btn-confirm-open"]').click();
    });
    
    // Verify header updates
    cy.get('[data-testid="shift-status"]').should('contain', 'Caja Abierta');
    cy.get('[data-testid="btn-close-shift"]').should('exist');
    cy.get('[data-testid="btn-open-shift"]').should('not.exist');
    
    // Step 2: Make sales
    cy.visit('/pos');
    
    // Create first sale - Cash payment
    cy.contains('Hamburguesa').click();
    cy.get('[data-testid="cart-total"]').should('contain', '$');
    cy.get('[data-testid="btn-checkout"]').click();
    
    cy.get('[data-testid="payment-method-cash"]').click();
    cy.get('input[name="receivedAmount"]').type('1500');
    cy.get('[data-testid="btn-confirm-payment"]').click();
    
    // Sale completed
    cy.contains('Venta completada').should('exist');
    
    // Create second sale - Card payment
    cy.contains('Pizza').click();
    cy.get('[data-testid="btn-checkout"]').click();
    
    cy.get('[data-testid="payment-method-card"]').click();
    cy.get('[data-testid="btn-confirm-payment"]').click();
    
    // Step 3: Close shift
    cy.get('[data-testid="btn-close-shift"]').click();
    
    // Enter counted amount
    cy.get('[data-testid="modal-close-shift"]').within(() => {
      cy.get('input[name="countedAmount"]').type('6200');
      
      // Should show expected amount calculation
      cy.get('[data-testid="expected-amount"]').should('exist');
      cy.get('[data-testid="cash-sales"]').should('exist');
      cy.get('[data-testid="card-sales"]').should('exist');
      
      // Should calculate difference
      cy.get('[data-testid="difference"]').should('exist');
      
      cy.get('[data-testid="btn-confirm-close"]').click();
    });
    
    // Verify shift closed
    cy.get('[data-testid="shift-status"]').should('not.exist');
    cy.get('[data-testid="btn-open-shift"]').should('exist');
    
    // Step 4: Verify shift record exists
    cy.visit('/admin/cash-shifts');
    
    cy.get('[data-testid="shift-record"]').first().within(() => {
      cy.contains('5000').should('exist'); // Start amount
      cy.contains('6200').should('exist'); // End amount
      cy.get('[data-testid="shift-difference"]').should('exist');
    });
  });

  it('prevents operations when shift is closed', () => {
    // Try to make a sale without open shift
    cy.visit('/pos');
    
    cy.contains('Hamburguesa').click();
    cy.get('[data-testid="btn-checkout"]').click();
    
    // Should warn about closed shift
    cy.contains('Debe abrir caja').should('exist');
    cy.get('[data-testid="btn-confirm-payment"]').should('be.disabled');
  });

  it('calculates shift totals correctly', () => {
    // Ensure shift is open for this test
    cy.visit('/cash');
    cy.get('body').then($body => {
    // Ensure shift is open for this test
    cy.visit('/cash');
    cy.get('body').then($body => {
      // If close button exists, we are already open. Good.
      if ($body.find('[data-testid="btn-close-shift"]').length > 0) {
          cy.log('Shift already open, proceeding');
      } else {
          // If modal open, use it. If not, click open.
          if ($body.find('[data-testid="modal-open-shift"]').length === 0) {
              cy.get('[data-testid="btn-open-shift"]').click();
          }
           cy.get('[data-testid="modal-open-shift"]').within(() => {
              cy.get('input[name="startAmount"]').type('10000');
              cy.get('[data-testid="btn-confirm-open"]').click();
           });
      }
    });
    });
    
    // Make known sales
    cy.visit('/pos');
    
    // Sale 1: $1500 cash
    cy.contains('Hamburguesa').click(); // Assume $1200
    cy.get('[data-testid="btn-checkout"]').click();
    cy.get('[data-testid="payment-method-cash"]').click();
    cy.get('input[name="receivedAmount"]').type('1500');
    cy.get('[data-testid="btn-confirm-payment"]').click();
    
    cy.wait(500);
    
    // Sale 2: $800 card
    cy.contains('Coca Cola').click(); // Assume $800
    cy.get('[data-testid="btn-checkout"]').click();
    cy.get('[data-testid="payment-method-card"]').click();
    cy.get('[data-testid="btn-confirm-payment"]').click();
    
    // Close shift
    cy.get('[data-testid="btn-close-shift"]').click();
    
    cy.get('[data-testid="modal-close-shift"]').within(() => {
      // Expected: 10000 (start) + 1200 (cash sale) = 11200
      // Card sales should not affect cash count
      cy.get('[data-testid="expected-cash"]').should('contain', '11200');
      cy.get('[data-testid="card-total"]').should('contain', '800');
    });
  });

  it('shows shift history with filters', () => {
    cy.visit('/admin/cash-shifts');
    
    // Should show list of shifts
    cy.get('[data-testid="shift-record"]').should('have.length.greaterThan', 0);
    
    // Filter by date
    cy.get('[data-testid="filter-date"]').type('2026-01-15');
    
    // Filter by user
    cy.get('[data-testid="filter-user"]').select('Admin');
    
    // Apply filters
    cy.get('[data-testid="btn-apply-filters"]').click();
    
    // Results should update
    cy.get('[data-testid="shift-record"]').each(($record) => {
      cy.wrap($record).should('contain', 'Admin');
    });
  });
});
