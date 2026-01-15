export declare const loginWithPin: (pin: string) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
export declare const register: (data: any) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
export declare const loginWithPassword: (data: any) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
//# sourceMappingURL=auth.service.d.ts.map