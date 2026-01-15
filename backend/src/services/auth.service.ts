import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { sendError } from '../utils/response';
import { z } from 'zod';

// Validate JWT_SECRET at module load
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('CRITICAL: JWT_SECRET environment variable is not defined. Server cannot start.');
}


const LoginSchema = z.object({
    pin: z.string().length(6),
});

const RegisterSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(1),
    pinCode: z.string().length(6),
    roleId: z.number().int().positive()
});

const PasswordLoginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

export const loginWithPin = async (pin: string) => {
    // 1. Validate Input
    const validation = LoginSchema.safeParse({ pin });
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error };
    }

    // 2. Find User
    const user = await prisma.user.findUnique({
        where: { pinCode: pin },
        include: { role: true }
    });

    if (!user || !user.isActive) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive user' };
    }

    // 3. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '12h'
    });

    // 4. Return Session Data
    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};

export const register = async (data: any) => {
    // 1. Validate Input
    const validation = RegisterSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error.issues };
    }

    // 2. Check for existing user
    const existingUser = await prisma.user.findFirst({
        where: {
            OR: [
                { email: data.email },
                { pinCode: data.pinCode }
            ]
        }
    });

    if (existingUser) {
        throw { code: 'USER_EXISTS', message: 'User with this email or PIN already exists' };
    }

    // 3. Hash Password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 4. Create User
    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            pinCode: data.pinCode,
            roleId: data.roleId
        },
        include: { role: true }
    });

    // 5. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '24h'
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};

export const loginWithPassword = async (data: any) => {
    // 1. Validate Input
    const validation = PasswordLoginSchema.safeParse(data);
    if (!validation.success) {
        throw { code: 'VALIDATION_ERROR', message: 'Invalid format', details: validation.error.issues };
    }

    // 2. Find User
    const user = await prisma.user.findUnique({
        where: { email: data.email },
        include: { role: true }
    });

    if (!user || !user.isActive || !user.passwordHash) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials or inactive user' };
    }

    // 3. Verify Password
    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) {
        throw { code: 'AUTH_FAILED', message: 'Invalid credentials' };
    }

    // 4. Generate Token
    const payload = {
        id: user.id,
        role: user.role.name,
        name: user.name
    };

    const token = jwt.sign(payload, JWT_SECRET, {
        expiresIn: '12h'
    });

    return {
        user: {
            id: user.id,
            name: user.name,
            role: user.role.name,
            permissions: user.role.permissions
        },
        token
    };
};
