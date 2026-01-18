interface RegisterData {
    email: string;
    password: string;
    name: string;
    pinCode: string;
    roleId: number;
}
interface PasswordLoginData {
    email: string;
    password: string;
}
export declare const loginWithPin: (pin: string) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
export declare const register: (data: RegisterData) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
export declare const loginWithPassword: (data: PasswordLoginData) => Promise<{
    user: {
        id: number;
        name: string;
        role: string;
        permissions: import("@prisma/client/runtime/library").JsonValue;
    };
    token: string;
}>;
export {};
//# sourceMappingURL=auth.service.d.ts.map