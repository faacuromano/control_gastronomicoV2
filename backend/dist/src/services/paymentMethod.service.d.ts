export interface PaymentMethodConfigInput {
    code: string;
    name: string;
    icon?: string;
    isActive?: boolean;
    sortOrder?: number;
}
export declare class PaymentMethodService {
    /**
     * Get all payment methods (for admin)
     */
    getAll(): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }[]>;
    /**
     * Get only active payment methods (for POS/checkout)
     */
    getActive(): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }[]>;
    /**
     * Get by ID
     */
    getById(id: number): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }>;
    /**
     * Create new payment method
     */
    create(data: PaymentMethodConfigInput): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }>;
    /**
     * Update payment method
     */
    update(id: number, data: Partial<PaymentMethodConfigInput>): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }>;
    /**
     * Toggle active status
     */
    toggleActive(id: number): Promise<{
        name: string;
        id: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        icon: string | null;
        sortOrder: number;
    }>;
    /**
     * Delete payment method
     */
    delete(id: number): Promise<void>;
    /**
     * Seed default payment methods
     */
    seedDefaults(): Promise<void>;
}
export declare const paymentMethodService: PaymentMethodService;
//# sourceMappingURL=paymentMethod.service.d.ts.map