describe('Critical Path Sanity Check', () => {
  beforeEach(() => {
    // Clear session
    cy.window().then((win) => {
        win.sessionStorage.clear()
        win.localStorage.clear()
    })
  })

  it('Should log in as ADMIN and access Cash Dashboard', () => {
    cy.visit('/login')
    
    // Login Flow
    cy.contains('PIN Login').click()
    cy.get('input[type="password"]').type('999999') // Correct PIN from Seed
    cy.get('button').contains('Sign In').click()

    // Dashboard Access
    cy.url().should('eq', 'http://localhost:5173/')
    cy.contains('PentiumPOS').should('be.visible')
    
    // Check Sidebar/Header for "Caja"
    cy.contains('Caja').should('be.visible').click()

    // Verify Cash Page
    cy.url().should('include', '/cash')
    cy.contains(/Turno/i).should('be.visible') // Matches "No hay turno abierto" OR "Caja - Turno Activo"
    
    // Check Permissions (Admin has access)
    // cy.get('button').contains('Cerrar Turno') // Dependent on state, skipping for sanity
  })

  it('Should protect routes from unauthenticated access', () => {
    cy.visit('/cash')
    cy.url().should('include', '/login')
  })
})
