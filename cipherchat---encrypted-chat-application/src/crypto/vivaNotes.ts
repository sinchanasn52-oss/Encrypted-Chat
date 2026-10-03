/**
 * College Cryptography Mini Project Documentation & Viva Notes
 * Project Title: "Encrypted Chat Application using AES-GCM and ECDH Key Exchange"
 */

export interface VivaTopic {
  id: string;
  title: string;
  category: 'Key Exchange' | 'Symmetric Encryption' | 'Security Architecture' | 'Web Crypto API';
  question: string;
  answer: string;
  technicalDetails: string[];
}

export const CRYPTO_VIVA_TOPICS: VivaTopic[] = [
  {
    id: 'ecdh_p256',
    title: 'Elliptic Curve Diffie-Hellman (ECDH P-256)',
    category: 'Key Exchange',
    question: 'Why did you select ECDH with curve P-256 over traditional RSA or classic DH?',
    answer:
      'ECDH provides equivalent or superior cryptographic strength with dramatically smaller key sizes (e.g., 256-bit ECC matches the security of 3072-bit RSA). This reduces bandwidth overhead across WebSockets, yields faster key generation on mobile/web clients, and enables Ephemeral Diffie-Hellman (ECDHE) for Perfect Forward Secrecy (PFS).',
    technicalDetails: [
      'NIST Curve P-256 (secp256r1) over prime field GF(p) where p = 2^256 - 2^224 + 2^192 + 2^96 - 1',
      'Equation: y^2 = x^3 - 3x + b (mod p)',
      'Shared Secret calculation: S = d_A * Q_B = d_B * Q_A, where d is private scalar and Q is public point',
      'The discrete logarithm problem on elliptic curves (ECDLP) prevents eavesdroppers from discovering d from Q',
    ],
  },
  {
    id: 'aes_gcm',
    title: 'AES-256 in Galois/Counter Mode (AES-GCM)',
    category: 'Symmetric Encryption',
    question: 'Why is AES-GCM preferred over AES-CBC or AES-ECB for messaging?',
    answer:
      'AES-GCM is an Authenticated Encryption with Associated Data (AEAD) mode. Unlike CBC, which requires separate HMAC (Encrypt-then-MAC) and is vulnerable to padding oracle attacks (e.g., POODLE, Lucky Thirteen), GCM natively produces a 128-bit GHASH authentication tag ensuring both confidentiality and message integrity/authenticity.',
    technicalDetails: [
      'Combines Counter (CTR) mode encryption with Galois field GHASH multiplication (GF(2^128))',
      'Requires a unique 96-bit (12-byte) Initialization Vector (IV/nonce) per message',
      'IV reuse with the same key is fatal in GCM (recovers authentication key)',
      'Parallelizable architecture allows high throughput in browser hardware acceleration',
    ],
  },
  {
    id: 'zero_knowledge_server',
    title: 'Zero-Knowledge Server Architecture',
    category: 'Security Architecture',
    question: 'What is the security role of the Node.js server in this architecture?',
    answer:
      'The server acts as a blind message and public key relay. The private keys never leave the client browser (SubtleCrypto non-extractable flags). The server has zero capability to decrypt chat messages, preventing server-side eavesdropping or data leakage in case of database compromise.',
    technicalDetails: [
      'Server maintains WebSocket connections and routes messages by username',
      'Clients perform ECDH key exchange directly over the secure relay channel',
      'Message payloads stored or routed on the server contain only ciphertext, IV, and tag',
      'Eavesdropping or server compromise cannot break past sessions due to ephemeral session keys',
    ],
  },
  {
    id: 'web_crypto_api',
    title: 'Browser Web Crypto API (SubtleCrypto)',
    category: 'Web Crypto API',
    question: 'Why use native Web Crypto API instead of third-party JavaScript crypto libraries?',
    answer:
      'Native Web Crypto API (window.crypto.subtle) is implemented directly in browser engine C++ with constant-time cryptographic primitives, protecting against JavaScript timing attacks, cache-timing side-channels, and memory inspection.',
    technicalDetails: [
      'W3C Recommendation implemented across modern browsers',
      'CryptoKey objects can be designated non-extractable (extractable: false)',
      'Hardware-accelerated AES-NI CPU instructions utilized directly',
      'Native CSPRNG via window.crypto.getRandomValues for cryptographic nonces and IVs',
    ],
  },
];
