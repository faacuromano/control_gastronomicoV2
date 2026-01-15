/**
 * E2E Test: Kitchen Display System (KDS)
 * Tests order reception and item status updates in kitchen
 */

describe('Kitchen Display System (KDS)', () => {
  beforeEach(() => {
    // Login as kitchen staff
    cy.visit('/');
    cy.get('[data-testid="pin-input"]').type('888888'); // Kitchen staff PIN
    cy.get('[data-testid="btn-login"]').click();
    cy.url().should('include', '/kitchen');
  });

  it('receives table order and updates item status', () => {
    // Create order in another session (simulate waiter)
    cy.request({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        'Authorization': `Bearer ${window.localStorage.getItem('token')}`
      },
      body: {
        tableId: 1,
        items: [
          { productId: 1, quantity: 2, notes: 'Sin cebolla' },
          { productId: 5, quantity: 1 }
        ]
      }
    }).then((response) => {
      expect(response.status).to.eq(201);
      const orderId = response.body.data.id;
      
      // Reload to get new order
      cy.reload();
      
      // Verify order appears in KDS
      cy.get('[data-testid="ticket-card"]').should('contain', 'Mesa 1');
      
      // Find the order and mark first item as COOKING
      cy.contains('Mesa 1').parents('[data-testid="ticket-card"]').within(() => {
        cy.get('[data-testid="item-status"]').first().click();
        cy.contains('COOKING').should('exist');
      });
      
      // Mark as READY
      cy.contains('Mesa 1').parents('[data-testid="ticket-card"]').within(() => {
        cy.get('[data-testid="item-status"]').first().click();
        cy.contains('READY').should('exist');
      });
    });
  });

  it('filters orders by status', () => {
    // Should show pending and cooking orders by default
    cy.get('[data-testid="ticket-card"]').should('have.length.greaterThan', 0);
    
    // Filter by COOKING only
    cy.get('[data-testid="filter-status"]').select('COOKING');
    
    cy.get('[data-testid="ticket-card"]').each(($card) => {
      cy.wrap($card).should('contain', 'COOKING');
    });
  });

  it('displays order details correctly', () => {
    // Verify ticket card shows all required info
    cy.get('[data-testid="ticket-card"]').first().within(() => {
      // Should show table number
      cy.get('[data-testid="ticket-table"]').should('exist');
      
      // Should show order time
      cy.get('[data-testid="ticket-time"]').should('exist');
      
      // Should show items
      cy.get('[data-testid="ticket-item"]').should('have.length.greaterThan', 0);
      
      // Each item should have status indicator
      cy.get('[data-testid="item-status"]').should('exist');
    });
  });

  it('handles real-time order updates via WebSocket', () => {
    const initialCount = cy.get('[data-testid="ticket-card"]').its('length');
    
    // Create new order via API (simulates real-time)
    cy.request({
      method: 'POST',
      url: '/api/v1/orders',
      headers: {
        'Authorization': `Bearer ${window.localStorage.getItem('token')}`
      },
      body: {
        tableId: 5,
        items: [{ productId: 3, quantity: 1 }]
      }
    });
    
    // Wait for WebSocket update
    cy.wait(1000);
    
    // New ticket should appear
    cy.get('[data-testid="ticket-card"]').should(($cards) => {
      expect($cards.length).to.be.greaterThan(initialCount);
    });
    
    cy.contains('Mesa 5').should('exist');
  });
});
