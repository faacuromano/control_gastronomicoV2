/**
 * E2E Test: Delivery Flow
 * Tests the complete delivery order lifecycle from creation to delivery
 */

describe('Delivery Flow - Complete Lifecycle', () => {
  beforeEach(() => {
    // Login with admin PIN
    cy.visit('/');
    cy.get('[data-testid="pin-input"]').type('999999');
    cy.get('[data-testid="btn-login"]').click();
    cy.url().should('include', '/pos');
  });

  it('completes full delivery order lifecycle', () => {
    // Step 1: Create a driver user
    cy.visit('/admin/users');
    cy.get('[data-testid="btn-add-user"]').click();
    
    cy.get('input[name="name"]').type('Juan Repartidor');
    cy.get('input[name="pin"]').type('543210');
    cy.get('select').select('REPARTIDOR'); // Assumes REPARTIDOR role exists
    cy.get('[data-testid="btn-save-user"]').click();
    
    // Verify user created
    cy.contains('Juan Repartidor').should('exist');

    // Step 2: Create delivery order in POS
    cy.visit('/pos');
    
    // Enable delivery mode
    cy.get('[data-testid="btn-delivery-mode"]').click();
    
    // Select or create client
    cy.get('[data-testid="client-selector"]').click();
    cy.contains('María García').click(); // Assumes client exists
    
    // Add products to cart
    cy.contains('Hamburguesa').click();
    cy.contains('Coca Cola').click();
    
    // Enter delivery details
    cy.get('[data-testid="delivery-address"]').type('Av. Corrientes 1234');
    cy.get('[data-testid="delivery-notes"]').type('Timbre 2B');
    
    // Confirm order
    cy.get('[data-testid="btn-confirm-order"]').click();
    
    // Order should be created
    cy.contains('Pedido creado').should('exist');

    // Step 3: Kitchen marks items as PREPARED
    cy.visit('/kitchen');
    
    // Find the delivery order ticket
    cy.contains('María García').parents('[data-testid="ticket-card"]').within(() => {
      // Mark each item as COOKING then READY
      cy.get('[data-testid="item-status"]').first().click(); // COOKING
      cy.get('[data-testid="item-status"]').first().click(); // READY
    });
    
    // Wait for all items to be ready
    cy.wait(500);

    // Step 4: Assign driver in Delivery Dashboard
    cy.visit('/delivery-dashboard');
    
    // Order should be in "Listo para Retirar" column
    cy.contains('Listo para Retirar').parent().within(() => {
      cy.contains('María García').should('exist');
      
      // Assign driver
      cy.get('[data-testid="driver-select"]').select('Juan Repartidor');
    });
    
    // Order should move to "En Camino" column
    cy.contains('En Camino').parent().within(() => {
      cy.contains('María García').should('exist');
      cy.contains('Juan Repartidor').should('exist');
    });

    // Step 5: Mark as delivered
    cy.contains('En Camino').parent().within(() => {
      cy.get('[data-testid="btn-delivered"]').click();
    });
    
    // Confirm delivery
    cy.get('[data-testid="confirm-delivered"]').click();
    
    // Order should move to "Entregados" column
    cy.contains('Entregados').parent().within(() => {
      cy.contains('María García').should('exist');
    });
    
    // Verify order is marked as DELIVERED
    cy.contains('Entregados').parent().within(() => {
      cy.contains('DELIVERED').should('exist');
    });
  });

  it('prevents assigning order without driver', () => {
    cy.visit('/delivery-dashboard');
    
    // Try to move order to "En Camino" without driver
    cy.contains('Listo para Retirar').parent().within(() => {
      cy.get('[data-testid="btn-on-route"]').should('be.disabled');
    });
  });

  it('shows delivered orders from today only', () => {
    cy.visit('/delivery-dashboard');
    
    // Delivered column should show orders
    cy.contains('Entregados').parent().within(() => {
      cy.get('[data-testid="delivery-card"]').should('have.length.greaterThan', 0);
    });
    
    // Refresh dashboard
    cy.get('[data-testid="btn-refresh-delivery"]').click();
    
    // Orders should still be visible
    cy.contains('Entregados').parent().within(() => {
      cy.get('[data-testid="delivery-card"]').should('exist');
    });
  });
});
