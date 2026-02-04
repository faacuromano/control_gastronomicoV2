/**
 * @fileoverview Cifrado a nivel de campo para secretos almacenados en base de datos (SEC-009)
 *
 * Implementa AES-256-GCM para cifrar campos sensibles (API keys, webhook secrets)
 * antes de almacenarlos en la DB. Cada valor cifrado incluye un IV y auth tag únicos.
 *
 * Formato almacenado: "enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * Los valores que no empiezan con "enc:v1:" se consideran plaintext legacy
 * y se devuelven tal cual (compatibilidad retroactiva durante migración).
 *
 * @module lib/fieldEncryption
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const PREFIX = 'enc:v1:';

/**
 * Deriva la clave de cifrado de 256 bits a partir del secreto configurado.
 * Usa SHA-256 para normalizar cualquier longitud de secreto a 32 bytes exactos.
 */
function getKey(): Buffer {
    const secret = process.env.FIELD_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('FIELD_ENCRYPTION_KEY o JWT_SECRET requerido para cifrado de campos');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Cifra un valor string con AES-256-GCM.
 * Retorna null si el valor de entrada es null/undefined/vacío.
 */
export function encryptField(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;

    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra un valor previamente cifrado con encryptField.
 * Si el valor no tiene el prefijo de cifrado, se devuelve tal cual
 * (compatibilidad con valores legacy en plaintext).
 */
export function decryptField(ciphertext: string | null | undefined): string | null {
    if (!ciphertext) return null;

    // Valores legacy sin cifrar — devolver tal cual
    if (!ciphertext.startsWith(PREFIX)) return ciphertext;

    const parts = ciphertext.slice(PREFIX.length).split(':');
    if (parts.length !== 3) return null;

    const ivHex = parts[0]!;
    const authTagHex = parts[1]!;
    const encrypted = parts[2]!;
    const key = getKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');

    return decrypted;
}
