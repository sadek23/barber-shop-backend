import bcrypt from 'bcryptjs';

/**
 * Password Hashing & Verification using Web Crypto API (PBKDF2) & bcryptjs fallback.
 * Optimized for Cloudflare Workers & sub-10ms response times.
 */

const PBKDF2_ITERATIONS = 15000;

function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined') return crypto;
  return require('node:crypto').webcrypto as Crypto;
}

export async function hashPassword(password: string): Promise<string> {
  const cryptoObj = getCrypto();
  const enc = new TextEncoder();
  const salt = cryptoObj.getRandomValues(new Uint8Array(16));
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  const key = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await cryptoObj.subtle.exportKey('raw', key) as ArrayBuffer;
  const hashHex = Array.from(new Uint8Array(exportedKey))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // Support legacy Laravel Bcrypt hashes ($2y$, $2b$, $2a$)
  if (storedHash.startsWith('$2y$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    const normalizedHash = storedHash.replace(/^\$2y\$/, '$2a$');
    return new Promise((resolve) => {
      bcrypt.compare(password, normalizedHash, (err, res) => {
        resolve(!!res);
      });
    });
  }

  // Handle PBKDF2 Web Crypto hashes
  const [saltHex, originalHashHex] = storedHash.split(':');
  if (!saltHex || !originalHashHex) return false;

  const salt = new Uint8Array(
    saltHex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
  );

  const cryptoObj = getCrypto();
  const enc = new TextEncoder();
  const keyMaterial = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const exportedKey = await cryptoObj.subtle.exportKey('raw', key) as ArrayBuffer;
  const hashHex = Array.from(new Uint8Array(exportedKey))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return hashHex === originalHashHex;
}
