/**
 * CipherChat Cryptographic Engine
 * Implementation: Web Crypto API (SubtleCrypto)
 * 
 * Standard Specifications:
 * - Asymmetric Key Agreement: Elliptic Curve Diffie-Hellman (ECDH) on NIST Curve P-256 (secp256r1)
 * - Key Derivation Function: HKDF (RFC 5869) with HMAC-SHA-256
 * - Symmetric Encryption: AES-256-GCM (NIST SP 800-38D) with 128-bit authentication tag
 * 
 * Security Principles:
 * - Private keys and derived AES keys are strictly kept in client memory and NEVER sent to the server.
 * - Only public keys (JWK format) and fingerprints are exchanged over WebSocket.
 */

import { ECDHKeyPairResult, DerivedKeyResult, CryptoEngineStatus } from './types';

// HKDF Context Parameters (RFC 5869)
const HKDF_SALT = new TextEncoder().encode('CipherChat-ECDH-HKDF-Salt-P256-v1');
const HKDF_INFO = new TextEncoder().encode('CipherChat-AES-256-GCM-Session-Key');

/**
 * Checks whether the browser runtime supports Web Crypto API (SubtleCrypto)
 */
export function isWebCryptoSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

/**
 * Converts an ArrayBuffer to a uppercase hexadecimal string
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

/**
 * Converts a hex string back to a Uint8Array
 */
export function hexToBuffer(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const arrayBuffer = new ArrayBuffer(cleanHex.length / 2);
  const bytes = new Uint8Array(arrayBuffer);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Computes a SHA-256 hash fingerprint of a string or buffer formatted as colon-separated hex bytes
 */
export async function computeSHA256Fingerprint(input: string | ArrayBuffer): Promise<string> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  const dataBuffer = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
  const hex = bufferToHex(hashBuffer);

  // Return colon-separated first 8 bytes (16 hex chars) e.g. "A4:F2:89:BE:9C:10:E7:32"
  const bytes = hex.substring(0, 16).match(/.{1,2}/g) || [];
  return bytes.join(':');
}

/**
 * Computes a standardized fingerprint for an ECDH P-256 Public Key (JWK)
 * Uses canonical EC x and y coordinates
 */
export async function computePublicKeyFingerprint(jwk: JsonWebKey): Promise<string> {
  if (!jwk.x || !jwk.y) {
    throw new Error('Invalid EC JWK: missing x or y coordinate');
  }
  const canonicalString = `ECDH-P256:${jwk.x}:${jwk.y}`;
  return computeSHA256Fingerprint(canonicalString);
}

/**
 * Generates an ECDH key pair on NIST Curve P-256 using window.crypto.subtle
 * Private key is non-extractable or restricted strictly to client memory.
 * Public key is exported in standard JSON Web Key (JWK) format for transmission.
 */
export async function generateECDHKeyPair(): Promise<ECDHKeyPairResult> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API (window.crypto.subtle) is not available.');
  }

  try {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-256', // NIST secp256r1
      },
      true, // extractable (needed to export public key)
      ['deriveKey', 'deriveBits']
    );

    // Export only the public key to JWK
    const publicJwk = await window.crypto.subtle.exportKey('jwk', keyPair.publicKey);

    // Compute public key fingerprint
    const fingerprint = await computePublicKeyFingerprint(publicJwk);

    return {
      publicKeyJwk: publicJwk,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      fingerprint,
    };
  } catch (err: any) {
    console.error('ECDH key generation failed:', err);
    throw new Error(`Failed to generate ECDH P-256 key pair: ${err?.message || err}`);
  }
}

/**
 * Imports a peer's public key from JWK format into a CryptoKey instance
 */
export async function importPeerPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not available.');
  }

  if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') {
    throw new Error(`Invalid peer public key curve: Expected EC P-256, received ${jwk.kty} / ${jwk.crv}`);
  }

  try {
    return await window.crypto.subtle.importKey(
      'jwk',
      {
        kty: 'EC',
        crv: 'P-256',
        x: jwk.x,
        y: jwk.y,
      },
      {
        name: 'ECDH',
        namedCurve: 'P-256',
      },
      true,
      []
    );
  } catch (err: any) {
    console.error('Peer public key import failed:', err);
    throw new Error(`Failed to import peer public key: ${err?.message || err}`);
  }
}

/**
 * Derives the ECDH shared secret bits, then uses HKDF with SHA-256
 * to derive a symmetric AES-256-GCM key.
 * 
 * Mathematical Property:
 * Alice computes: S = d_A · Q_B
 * Bob computes:   S = d_B · Q_A
 * Since d_A · (d_B · G) = d_B · (d_A · G), both clients arrive at identical shared secrets.
 * HKDF-SHA256 extracts and expands S into a cryptographically strong 256-bit AES key.
 */
export async function deriveSharedSecretAndAESKey(
  ownPrivateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<DerivedKeyResult> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not available.');
  }

  let sharedSecretBits: ArrayBuffer;

  // Step 1: ECDH Key Agreement -> 256 bits shared secret
  try {
    sharedSecretBits = await window.crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: peerPublicKey,
      },
      ownPrivateKey,
      256 // 256 bits for P-256
    );
  } catch (err: any) {
    console.error('ECDH deriveBits failed:', err);
    throw new Error(`ECDH shared secret derivation failed: ${err?.message || err}`);
  }

  // Step 2: Import raw shared secret as HKDF master key
  let hkdfKey: CryptoKey;
  try {
    hkdfKey = await window.crypto.subtle.importKey(
      'raw',
      sharedSecretBits,
      'HKDF',
      false, // non-extractable HKDF master key
      ['deriveKey']
    );
  } catch (err: any) {
    console.error('HKDF importKey failed:', err);
    throw new Error(`Failed to import shared secret into HKDF: ${err?.message || err}`);
  }

  // Step 3: Derive AES-256-GCM symmetric key using HKDF-SHA256
  let aesKey: CryptoKey;
  let keyFingerprint: string;

  try {
    aesKey = await window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: HKDF_SALT,
        info: HKDF_INFO,
      },
      hkdfKey,
      {
        name: 'AES-GCM',
        length: 256, // 256-bit symmetric key
      },
      true, // extractable so we can compute a verification fingerprint for UI display
      ['encrypt', 'decrypt']
    );

    // Compute key confirmation fingerprint (SHA-256 of raw AES key)
    // This allows Alice and Bob to visually verify that their derived keys are identical
    // without ever revealing the key itself!
    const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);
    keyFingerprint = await computeSHA256Fingerprint(rawAesKey);
  } catch (err: any) {
    console.error('HKDF deriveKey failed:', err);
    throw new Error(`HKDF key derivation failed: ${err?.message || err}`);
  }

  return {
    aesKey,
    keyFingerprint,
    sharedSecretLengthBits: 256,
    derivedAt: Date.now(),
  };
}

export interface EncryptionResult {
  ciphertextHex: string;
  ivHex: string;
  authTagHex: string;
  plaintextLengthBytes: number;
}

/**
 * Encrypts a plaintext message using AES-256-GCM with a fresh random 96-bit IV
 * Strictly client-side operation using Web Crypto API.
 */
export async function encryptMessageAESGCM(
  plaintext: string,
  aesKey: CryptoKey
): Promise<EncryptionResult> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not available.');
  }

  // 1. Generate fresh random 96-bit (12-byte) IV using CSPRNG
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  // 2. Encrypt plaintext using AES-256-GCM with 128-bit authentication tag
  const encodedPlaintext = new TextEncoder().encode(plaintext);
  let encryptedBuffer: ArrayBuffer;
  try {
    encryptedBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv,
        tagLength: 128,
      },
      aesKey,
      encodedPlaintext
    );
  } catch (err: any) {
    throw new Error(`AES-GCM encryption failed: ${err?.message || err}`);
  }

  // Extract the 16-byte (128-bit) authentication tag from the end of the encrypted buffer
  const fullBytes = new Uint8Array(encryptedBuffer);
  const tagBytes = fullBytes.subarray(fullBytes.length - 16);

  return {
    ciphertextHex: bufferToHex(encryptedBuffer),
    ivHex: bufferToHex(iv.buffer),
    authTagHex: bufferToHex(tagBytes.buffer),
    plaintextLengthBytes: encodedPlaintext.length,
  };
}

/**
 * Decrypts an AES-256-GCM ciphertext and authenticates the 128-bit GHASH tag.
 * If authentication fails or the ciphertext was tampered with, Web Crypto throws an error.
 */
export async function decryptMessageAESGCM(
  ciphertextHex: string,
  ivHex: string,
  aesKey: CryptoKey
): Promise<string> {
  if (!isWebCryptoSupported()) {
    throw new Error('Web Crypto API is not available.');
  }

  const ivBytes = hexToBuffer(ivHex);
  const ciphertextBytes = hexToBuffer(ciphertextHex);

  if (ivBytes.length !== 12) {
    throw new Error(`Invalid IV length: Expected 12 bytes (96 bits), received ${ivBytes.length} bytes.`);
  }

  try {
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes as BufferSource,
        tagLength: 128,
      },
      aesKey,
      ciphertextBytes as BufferSource
    );
    return new TextDecoder().decode(decryptedBuffer);
  } catch (err: any) {
    console.warn('AES-GCM Authentication Failed:', err);
    throw new Error(
      'AES-GCM Authentication Failed: Message authentication tag mismatch or corrupted ciphertext. The message has been rejected.'
    );
  }
}

/**
 * Controlled Cryptography Demonstration: Intentionally flip exactly one bit in ciphertext
 * Requirement:
 * - Do not modify original plaintext
 * - Do not modify the AES key
 * - Modifies exactly 1 bit in ciphertext on the wire
 */
export interface WireTamperResult {
  originalHex: string;
  tamperedHex: string;
  byteIndex: number;
  bitPosition: number;
  flippedBitDescription: string;
}

export function flipSingleBitInHex(
  hex: string,
  byteIndex = 2,
  bitPosition = 0
): WireTamperResult {
  const bytes = hexToBuffer(hex);
  if (bytes.length === 0) {
    return {
      originalHex: hex,
      tamperedHex: hex,
      byteIndex: 0,
      bitPosition: 0,
      flippedBitDescription: 'No bytes available',
    };
  }

  const targetByte = Math.min(byteIndex, bytes.length - 1);
  const targetBit = Math.min(Math.max(bitPosition, 0), 7);
  const originalByteVal = bytes[targetByte];

  // Invert exactly one single bit (XOR with mask 1 << targetBit)
  bytes[targetByte] ^= (1 << targetBit);
  const tamperedByteVal = bytes[targetByte];

  return {
    originalHex: hex,
    tamperedHex: bufferToHex(bytes.buffer as ArrayBuffer),
    byteIndex: targetByte,
    bitPosition: targetBit,
    flippedBitDescription: `Inverted bit ${targetBit} of byte ${targetByte} (0x${originalByteVal.toString(16).padStart(2, '0').toUpperCase()} ➔ 0x${tamperedByteVal.toString(16).padStart(2, '0').toUpperCase()})`,
  };
}

/**
 * Utility to simulate tampering with ciphertext to demonstrate AES-GCM AEAD authentication rejection
 */
export function tamperCiphertextHex(ciphertextHex: string): string {
  if (!ciphertextHex || ciphertextHex.length < 4) return ciphertextHex;
  const chars = ciphertextHex.split('');
  chars[0] = chars[0] === 'F' ? '0' : 'F';
  chars[1] = chars[1] === 'A' ? '5' : 'A';
  return chars.join('');
}

/**
 * Returns current status of the Cryptography Engine
 */
export function getCryptoEngineStatus(): CryptoEngineStatus {
  return {
    webCryptoAvailable: isWebCryptoSupported(),
    algorithm: 'AES-256-GCM',
    keyExchangeCurve: 'P-256',
    kdf: 'HKDF-SHA256',
    tagLengthBits: 128,
    ivLengthBits: 96,
  };
}
