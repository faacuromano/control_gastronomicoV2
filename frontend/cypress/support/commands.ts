/// <reference types="cypress" />

Cypress.Commands.add('login', (email, password) => { 
    // Implementation placeholder
})

declare global {
  namespace Cypress {
    interface Chainable {
        login(email: string, password: string): Chainable<void>
    }
  }
}

export {};
