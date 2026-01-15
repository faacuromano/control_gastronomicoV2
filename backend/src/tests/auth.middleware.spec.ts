
import { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../middleware/auth';
import { sendError } from '../utils/response';

// Mock response utility
jest.mock('../utils/response', () => ({
    sendError: jest.fn(),
}));

describe('Auth Middleware - RBAC Integrity', () => {
    let mockRequest: Partial<Request>;
    let mockResponse: Partial<Response>;
    let nextFunction: NextFunction = jest.fn();

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
            } as any
        };
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    test('Should ALLOW access if user has exact permission', () => {
        const middleware = requirePermission('orders', 'create');
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
        expect(sendError).not.toHaveBeenCalled();
    });

    test('Should DENY access if user does NOT have permission for action', () => {
        const middleware = requirePermission('orders', 'delete');
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(sendError).toHaveBeenCalledWith(
            expect.anything(), 
            'AUTH_FORBIDDEN', 
            "Action 'delete' on 'orders' denied", 
            null, 
            403
        );
    });

    test('Should DENY access if user does NOT have permission for resource', () => {
        const middleware = requirePermission('users', 'create');
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).not.toHaveBeenCalled();
        expect(sendError).toHaveBeenCalledWith(
            expect.anything(), 
            'AUTH_FORBIDDEN', 
            "Access to resource 'users' denied", 
            null, 
            403
        );
    });

    test('Should ALLOW access if user has WILDCARD permission', () => {
        // Setup user with wildcard
        mockRequest.user!.permissions = {
            'orders': ['*']
        };

        const middleware = requirePermission('orders', 'delete');
        middleware(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalled();
    });
});
