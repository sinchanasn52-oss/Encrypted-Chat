export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  avatarColor: string;
  isOnline: boolean;
  lastSeen: number;
}

export interface CryptoMetadata {
  algorithm: 'AES-256-GCM' | string;
  keyExchange: 'ECDH P-256' | string;
  iv?: string; // 12-byte IV in hex representation
  authTag?: string; // 16-byte authentication tag in hex representation
  keyFingerprint?: string; // SHA-256 confirmation hash of derived AES key
}

export interface WireTamperAudit {
  isTampered: boolean;
  originalCiphertextHex: string;
  tamperedCiphertextHex: string;
  flippedBitDescription: string;
  authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)' | 'PASSED';
  packetStatus: 'REJECTED' | 'ACCEPTED';
  explanation: string;
  simulatedDemoNote: string;
}

export interface ChatMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  content: string; // Plaintext (available only after successful AES-GCM authentication)
  ciphertext?: string; // Hex representation of ciphertext
  iv?: string; // 12-byte IV in hex representation
  authTag?: string; // 16-byte GHASH authentication tag in hex
  timestamp: number;
  isEncrypted: boolean;
  decryptionStatus?: 'success' | 'failed' | 'pending' | 'unencrypted';
  authError?: string;
  cryptoMeta?: CryptoMetadata;
  deliveryStatus?: 'sending' | 'sent' | 'delivered';
  wireTamperAudit?: WireTamperAudit;
}

export interface EncryptedMessagePacket {
  id: string;
  fromUsername: string;
  toUsername: string;
  ciphertext: string;
  iv: string;
  timestamp: number;
  isEncrypted: true;
  cryptoMeta?: CryptoMetadata;
}

export interface SecurityStatusInfo {
  algorithm: string;
  keyExchange: string;
  curve: string;
  transport: string;
  sessionState: 'CONNECTED_HANDSHAKE_READY' | 'KEY_EXCHANGE_ACTIVE' | 'ENCRYPTED_SESSION';
  serverRole: 'Zero-Knowledge Message Relay';
  webCryptoStatus: 'Available (window.crypto.subtle)' | 'Unavailable';
}
