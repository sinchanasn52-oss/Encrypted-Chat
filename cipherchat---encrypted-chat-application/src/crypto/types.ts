/**
 * Cryptography Engine Types for CipherChat
 * Mini Project: "Encrypted Chat Application using AES-GCM and ECDH Key Exchange"
 */

export interface ECDHKeyPairResult {
  publicKeyJwk: JsonWebKey;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  fingerprint: string;
}

export interface DerivedKeyResult {
  aesKey: CryptoKey;
  keyFingerprint: string; // SHA-256 confirmation hash of the derived symmetric key
  sharedSecretLengthBits: number;
  derivedAt: number;
}

export type KeyExchangeStatus = 
  | 'WAITING' 
  | 'GENERATING_KEYS' 
  | 'EXCHANGING' 
  | 'DERIVING_KEY' 
  | 'READY' 
  | 'ERROR';

export interface KeyExchangeSession {
  peerUsername: string;
  localKeyPair: ECDHKeyPairResult | null;
  localFingerprint: string | null;
  peerPublicKeyJwk: JsonWebKey | null;
  peerFingerprint: string | null;
  derivedKeyResult: DerivedKeyResult | null;
  status: KeyExchangeStatus;
  statusMessage: string;
  sessionStatus?: string;
  error: string | null;
  lastUpdated: number;
}

export interface EncryptedPayload {
  ciphertextHex: string;
  ivHex: string;
  authTagHex?: string;
  keyFingerprint: string;
}

export interface HandshakeSignal {
  from: string;
  to: string;
  publicKeyJwk: JsonWebKey;
  keyFingerprint: string;
  timestamp: number;
}

export interface CryptoEngineStatus {
  webCryptoAvailable: boolean;
  algorithm: 'AES-256-GCM';
  keyExchangeCurve: 'P-256';
  kdf: 'HKDF-SHA256';
  tagLengthBits: 128;
  ivLengthBits: 96;
}
