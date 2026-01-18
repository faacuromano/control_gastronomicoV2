"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const auth_1 = require("../middleware/auth");
const response_1 = require("../utils/response");
// Mock response utility
jest.mock('../utils/response', () => ({
    sendError: jest.fn(),
}));
describe('Auth Middleware - RBAC Integrity', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction = jest.fn();
    beforeEach(() => {
        mockRequest = {
            user: {
                id: 1,
                role: 'TEST_ROLE',
                name: 'Test User',
                permissions: {
                    'orders': ['create', 'read'],
                    'products': ['read']
                }
            }
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });
    test('Should ALLOW access if user has exact permission', () => {
        const middleware = (0, auth_1.requirePermission)('orders', 'create');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
        expect(response_1.sendError).not.toHaveBeenCalled();
    });
    test('Should DENY access if user does NOT have permission for action', () => {
        const middleware = (0, auth_1.requirePermission)('orders', 'delete');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).not.toHaveBeenCalled();
        expect(response_1.sendError).toHaveBeenCalledWith(expect.anything(), 'AUTH_FORBIDDEN', "Action 'delete' on 'orders' denied", null, 403);
    });
    test('Should DENY access if user does NOT have permission for resource', () => {
        const middleware = (0, auth_1.requirePermission)('users', 'create');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).not.toHaveBeenCalled();
        expect(response_1.sendError).toHaveBeenCalledWith(expect.anything(), 'AUTH_FORBIDDEN', "Access to resource 'users' denied", null, 403);
    });
    test('Should ALLOW access if user has WILDCARD permission', () => {
        // Setup user with wildcard
        mockRequest.user.permissions = {
            'orders': ['*']
        };
        const middleware = (0, auth_1.requirePermission)('orders', 'delete');
        middleware(mockRequest, mockResponse, nextFunction);
        expect(nextFunction).toHaveBeenCalled();
    });
});
//# sourceMappingURL=auth.middleware.spec.js.map