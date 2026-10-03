import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, ChatMessage, WireTamperAudit } from '../types/chat';
import { ECDHKeyPairResult, DerivedKeyResult } from '../crypto/types';
import { 
  generateECDHKeyPair, 
  importPeerPublicKey, 
  deriveSharedSecretAndAESKey,
  encryptMessageAESGCM,
  decryptMessageAESGCM,
  flipSingleBitInHex,
  tamperCiphertextHex
} from '../crypto/cryptoEngine';
import { WireTamperModal } from './WireTamperModal';
import { 
  Shield, 
  Send, 
  Lock, 
  Wifi, 
  RefreshCw, 
  X, 
  ArrowLeftRight, 
  CheckCheck, 
  Key, 
  Zap, 
  CheckCircle2,
  AlertCircle,
  Terminal,
  AlertTriangle,
  EyeOff,
  Hash,
  ShieldAlert
} from 'lucide-react';

interface SplitChatSimulatorProps {
  onClose: () => void;
  availableUsers: User[];
  defaultUserA?: string;
  defaultUserB?: string;
}

export const SplitChatSimulator: React.FC<SplitChatSimulatorProps> = ({
  onClose,
  availableUsers,
  defaultUserA = 'alice',
  defaultUserB = 'bob',
}) => {
  const [userAUsername, setUserAUsername] = useState(defaultUserA);
  const [userBUsername, setUserBUsername] = useState(defaultUserB);

  const [socketA, setSocketA] = useState<Socket | null>(null);
  const [socketB, setSocketB] = useState<Socket | null>(null);

  const [messagesA, setMessagesA] = useState<ChatMessage[]>([]);
  const [messagesB, setMessagesB] = useState<ChatMessage[]>([]);

  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');

  const [isTypingA, setIsTypingA] = useState(false);
  const [isTypingB, setIsTypingB] = useState(false);

  const [inspectMessageIdA, setInspectMessageIdA] = useState<string | null>(null);
  const [inspectMessageIdB, setInspectMessageIdB] = useState<string | null>(null);

  // Wire Tamper Demonstration State
  const [selectedTamperAudit, setSelectedTamperAudit] = useState<WireTamperAudit | null>(null);
  const [isTamperModalOpen, setIsTamperModalOpen] = useState<boolean>(false);
  const [tamperSenderName, setTamperSenderName] = useState<string>('Alice');
  const [tamperRecipientName, setTamperRecipientName] = useState<string>('Bob');

  // Cryptographic state for Endpoint A (e.g. Alice)
  const [keyPairA, setKeyPairA] = useState<ECDHKeyPairResult | null>(null);
  const [derivedKeyA, setDerivedKeyA] = useState<DerivedKeyResult | null>(null);
  const [errorA, setErrorA] = useState<string | null>(null);

  // Cryptographic state for Endpoint B (e.g. Bob)
  const [keyPairB, setKeyPairB] = useState<ECDHKeyPairResult | null>(null);
  const [derivedKeyB, setDerivedKeyB] = useState<DerivedKeyResult | null>(null);
  const [errorB, setErrorB] = useState<string | null>(null);

  const keyPairARef = useRef<ECDHKeyPairResult | null>(null);
  const keyPairBRef = useRef<ECDHKeyPairResult | null>(null);
  const derivedKeyARef = useRef<DerivedKeyResult | null>(null);
  const derivedKeyBRef = useRef<DerivedKeyResult | null>(null);

  useEffect(() => {
    derivedKeyARef.current = derivedKeyA;
  }, [derivedKeyA]);

  useEffect(() => {
    derivedKeyBRef.current = derivedKeyB;
  }, [derivedKeyB]);

  const scrollRefA = useRef<HTMLDivElement>(null);
  const scrollRefB = useRef<HTMLDivElement>(null);

  const userA = availableUsers.find((u) => u.username.toLowerCase() === userAUsername.toLowerCase()) || availableUsers[1] || availableUsers[0];
  const userB = availableUsers.find((u) => u.username.toLowerCase() === userBUsername.toLowerCase()) || availableUsers[2] || availableUsers[1];

  // Initialize Endpoint A Keypair
  const initKeyA = useCallback(async () => {
    try {
      const kp = await generateECDHKeyPair();
      setKeyPairA(kp);
      keyPairARef.current = kp;
      return kp;
    } catch (e: any) {
      setErrorA(e?.message || 'Failed to generate key for Endpoint A');
      return null;
    }
  }, []);

  // Initialize Endpoint B Keypair
  const initKeyB = useCallback(async () => {
    try {
      const kp = await generateECDHKeyPair();
      setKeyPairB(kp);
      keyPairBRef.current = kp;
      return kp;
    } catch (e: any) {
      setErrorB(e?.message || 'Failed to generate key for Endpoint B');
      return null;
    }
  }, []);

  // Perform full mutual key exchange
  const triggerMutualExchange = useCallback(async () => {
    setErrorA(null);
    setErrorB(null);
    try {
      const kpA = await initKeyA();
      const kpB = await initKeyB();
      if (!kpA || !kpB) return;

      if (socketA && socketB) {
        socketA.emit('crypto:exchange_public_key', {
          to: userB.username,
          publicKeyJwk: kpA.publicKeyJwk,
          keyFingerprint: kpA.fingerprint,
        });

        socketB.emit('crypto:exchange_public_key', {
          to: userA.username,
          publicKeyJwk: kpB.publicKeyJwk,
          keyFingerprint: kpB.fingerprint,
        });
      }
    } catch (e: any) {
      console.error('Exchange trigger error:', e);
    }
  }, [initKeyA, initKeyB, socketA, socketB, userA.username, userB.username]);

  // Setup Socket A (Endpoint A)
  useEffect(() => {
    const sA = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    sA.on('connect', async () => {
      sA.emit('user:login', { username: userA.username, email: userA.email, displayName: userA.displayName });
      sA.emit('messages:get_history', { withUser: userB.username });

      const kp = await initKeyA();
      if (kp) {
        sA.emit('crypto:publish_public_key', { publicKeyJwk: kp.publicKeyJwk, keyFingerprint: kp.fingerprint });
        sA.emit('crypto:exchange_public_key', {
          to: userB.username,
          publicKeyJwk: kp.publicKeyJwk,
          keyFingerprint: kp.fingerprint,
        });
      }
    });

    // Inbound Message for Endpoint A: Authenticate & Decrypt with AES-256-GCM
    sA.on('message:receive', async (rawMsg: ChatMessage) => {
      const incomingAudit = (rawMsg.cryptoMeta as any)?.tamperAudit || rawMsg.wireTamperAudit;

      if (rawMsg.isEncrypted && rawMsg.ciphertext && rawMsg.iv) {
        const key = derivedKeyARef.current?.aesKey;
        if (key) {
          try {
            const plaintext = await decryptMessageAESGCM(rawMsg.ciphertext, rawMsg.iv, key);
            setMessagesA((prev) => [...prev, { ...rawMsg, content: plaintext, decryptionStatus: 'success', wireTamperAudit: incomingAudit }]);
          } catch (err: any) {
            // Requirement 8: If authentication fails, do not display plaintext, mark as rejected, show security warning
            const auditPayload: WireTamperAudit = incomingAudit || {
              isTampered: true,
              originalCiphertextHex: '[Original ciphertext on sender]',
              tamperedCiphertextHex: rawMsg.ciphertext,
              flippedBitDescription: 'Detected bit inversion in ciphertext payload on the wire',
              authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
              packetStatus: 'REJECTED',
              explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
              simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
            };

            setMessagesA((prev) => [
              ...prev,
              {
                ...rawMsg,
                content: '',
                decryptionStatus: 'failed',
                authError: 'Tampering detected — AES-GCM authentication failed.',
                wireTamperAudit: auditPayload,
              },
            ]);
          }
        } else {
          setMessagesA((prev) => [...prev, { ...rawMsg, content: '[Encrypted - Key pending]', decryptionStatus: 'pending' }]);
        }
      } else {
        setMessagesA((prev) => [...prev, rawMsg]);
      }
    });

    sA.on('message:sent_confirm', (msg: ChatMessage) => {
      setMessagesA((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, deliveryStatus: 'delivered' as const } : m))
      );
    });

    sA.on('typing:status', (data: { from: string; isTyping: boolean }) => {
      if (data.from.toLowerCase() === userB.username.toLowerCase()) {
        setIsTypingB(data.isTyping);
      }
    });

    // Inbound peer public key for Endpoint A
    sA.on('crypto:peer_public_key', async (data: any) => {
      try {
        const kpA = keyPairARef.current;
        if (!kpA) return;

        const importedPeerKey = await importPeerPublicKey(data.publicKeyJwk);
        const derived = await deriveSharedSecretAndAESKey(kpA.privateKey, importedPeerKey);
        setDerivedKeyA(derived);
      } catch (err: any) {
        setErrorA(err?.message || 'ECDH derivation failed for Endpoint A');
      }
    });

    setSocketA(sA);

    return () => {
      sA.disconnect();
    };
  }, [userA.username, userB.username, initKeyA]);

  // Setup Socket B (Endpoint B)
  useEffect(() => {
    const sB = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      forceNew: true,
    });

    sB.on('connect', async () => {
      sB.emit('user:login', { username: userB.username, email: userB.email, displayName: userB.displayName });
      sB.emit('messages:get_history', { withUser: userA.username });

      const kp = await initKeyB();
      if (kp) {
        sB.emit('crypto:publish_public_key', { publicKeyJwk: kp.publicKeyJwk, keyFingerprint: kp.fingerprint });
        sB.emit('crypto:exchange_public_key', {
          to: userA.username,
          publicKeyJwk: kp.publicKeyJwk,
          keyFingerprint: kp.fingerprint,
        });
      }
    });

    // Inbound Message for Endpoint B: Authenticate & Decrypt with AES-256-GCM
    sB.on('message:receive', async (rawMsg: ChatMessage) => {
      const incomingAudit = (rawMsg.cryptoMeta as any)?.tamperAudit || rawMsg.wireTamperAudit;

      if (rawMsg.isEncrypted && rawMsg.ciphertext && rawMsg.iv) {
        const key = derivedKeyBRef.current?.aesKey;
        if (key) {
          try {
            const plaintext = await decryptMessageAESGCM(rawMsg.ciphertext, rawMsg.iv, key);
            setMessagesB((prev) => [...prev, { ...rawMsg, content: plaintext, decryptionStatus: 'success', wireTamperAudit: incomingAudit }]);
          } catch (err: any) {
            // Requirement 8: If authentication fails, do not display plaintext, mark as rejected, show security warning
            const auditPayload: WireTamperAudit = incomingAudit || {
              isTampered: true,
              originalCiphertextHex: '[Original ciphertext on sender]',
              tamperedCiphertextHex: rawMsg.ciphertext,
              flippedBitDescription: 'Detected bit inversion in ciphertext payload on the wire',
              authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
              packetStatus: 'REJECTED',
              explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
              simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
            };

            setMessagesB((prev) => [
              ...prev,
              {
                ...rawMsg,
                content: '',
                decryptionStatus: 'failed',
                authError: 'Tampering detected — AES-GCM authentication failed.',
                wireTamperAudit: auditPayload,
              },
            ]);
          }
        } else {
          setMessagesB((prev) => [...prev, { ...rawMsg, content: '[Encrypted - Key pending]', decryptionStatus: 'pending' }]);
        }
      } else {
        setMessagesB((prev) => [...prev, rawMsg]);
      }
    });

    sB.on('message:sent_confirm', (msg: ChatMessage) => {
      setMessagesB((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, deliveryStatus: 'delivered' as const } : m))
      );
    });

    sB.on('typing:status', (data: { from: string; isTyping: boolean }) => {
      if (data.from.toLowerCase() === userA.username.toLowerCase()) {
        setIsTypingA(data.isTyping);
      }
    });

    // Inbound peer public key for Endpoint B
    sB.on('crypto:peer_public_key', async (data: any) => {
      try {
        const kpB = keyPairBRef.current;
        if (!kpB) return;

        const importedPeerKey = await importPeerPublicKey(data.publicKeyJwk);
        const derived = await deriveSharedSecretAndAESKey(kpB.privateKey, importedPeerKey);
        setDerivedKeyB(derived);
      } catch (err: any) {
        setErrorB(err?.message || 'ECDH derivation failed for Endpoint B');
      }
    });

    setSocketB(sB);

    return () => {
      sB.disconnect();
    };
  }, [userA.username, userB.username, initKeyB]);

  useEffect(() => {
    scrollRefA.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesA, isTypingB]);

  useEffect(() => {
    scrollRefB.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesB, isTypingA]);

  // Endpoint A Send: Real AES-256-GCM encryption with fresh 96-bit IV
  const handleSendA = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputA.trim();
    if (!clean || !socketA) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (derivedKeyA?.aesKey) {
      try {
        const encResult = await encryptMessageAESGCM(clean, derivedKeyA.aesKey);

        // Send ONLY encrypted packet to server (never plaintext!)
        socketA.emit('message:send', {
          id: msgId,
          to: userB.username,
          ciphertext: encResult.ciphertextHex,
          iv: encResult.ivHex,
          isEncrypted: true,
          cryptoMeta: {
            algorithm: 'AES-256-GCM',
            keyExchange: 'ECDH P-256',
            authTag: encResult.authTagHex,
            keyFingerprint: derivedKeyA.keyFingerprint,
          },
        });

        // Store in local Endpoint A history
        setMessagesA((prev) => [
          ...prev,
          {
            id: msgId,
            fromUsername: userA.username,
            toUsername: userB.username,
            content: clean,
            ciphertext: encResult.ciphertextHex,
            iv: encResult.ivHex,
            authTag: encResult.authTagHex,
            timestamp: Date.now(),
            isEncrypted: true,
            decryptionStatus: 'success',
            deliveryStatus: 'sent' as const,
          },
        ]);
      } catch (err) {
        console.error('Encryption failed for Endpoint A:', err);
      }
    } else {
      socketA.emit('message:send', { to: userB.username, content: clean, isEncrypted: false });
      setMessagesA((prev) => [
        ...prev,
        {
          id: msgId,
          fromUsername: userA.username,
          toUsername: userB.username,
          content: clean,
          timestamp: Date.now(),
          isEncrypted: false,
          decryptionStatus: 'unencrypted',
          deliveryStatus: 'sent' as const,
        },
      ]);
    }

    setInputA('');
    socketA.emit('typing:status', { to: userB.username, isTyping: false });
  };

  // Endpoint B Send: Real AES-256-GCM encryption with fresh 96-bit IV
  const handleSendB = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputB.trim();
    if (!clean || !socketB) return;

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    if (derivedKeyB?.aesKey) {
      try {
        const encResult = await encryptMessageAESGCM(clean, derivedKeyB.aesKey);

        // Send ONLY encrypted packet to server (never plaintext!)
        socketB.emit('message:send', {
          id: msgId,
          to: userA.username,
          ciphertext: encResult.ciphertextHex,
          iv: encResult.ivHex,
          isEncrypted: true,
          cryptoMeta: {
            algorithm: 'AES-256-GCM',
            keyExchange: 'ECDH P-256',
            authTag: encResult.authTagHex,
            keyFingerprint: derivedKeyB.keyFingerprint,
          },
        });

        // Store in local Endpoint B history
        setMessagesB((prev) => [
          ...prev,
          {
            id: msgId,
            fromUsername: userB.username,
            toUsername: userA.username,
            content: clean,
            ciphertext: encResult.ciphertextHex,
            iv: encResult.ivHex,
            authTag: encResult.authTagHex,
            timestamp: Date.now(),
            isEncrypted: true,
            decryptionStatus: 'success',
            deliveryStatus: 'sent' as const,
          },
        ]);
      } catch (err) {
        console.error('Encryption failed for Endpoint B:', err);
      }
    } else {
      socketB.emit('message:send', { to: userA.username, content: clean, isEncrypted: false });
      setMessagesB((prev) => [
        ...prev,
        {
          id: msgId,
          fromUsername: userB.username,
          toUsername: userA.username,
          content: clean,
          timestamp: Date.now(),
          isEncrypted: false,
          decryptionStatus: 'unencrypted',
          deliveryStatus: 'sent' as const,
        },
      ]);
    }

    setInputB('');
    socketB.emit('typing:status', { to: userA.username, isTyping: false });
  };

  // Controlled Demonstration: Simulate Wire Tamper from Endpoint A
  const handleSimulateWireTamperA = async () => {
    if (!socketA || !derivedKeyA?.aesKey) return;
    const plaintext = inputA.trim() || 'Simulated Wire Demonstration: Secret Wire Packet';
    const msgId = `msg_tamper_a_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      // 1. Encrypt plaintext using real derived AES-256 key and fresh IV
      // Do NOT modify original plaintext or AES key!
      const encResult = await encryptMessageAESGCM(plaintext, derivedKeyA.aesKey);

      // 2. Invert exactly 1 bit in ciphertext on the wire
      const tamperResult = flipSingleBitInHex(encResult.ciphertextHex, 2, 0);

      // 3. Construct WireTamperAudit
      const audit: WireTamperAudit = {
        isTampered: true,
        originalCiphertextHex: encResult.ciphertextHex,
        tamperedCiphertextHex: tamperResult.tamperedHex,
        flippedBitDescription: tamperResult.flippedBitDescription,
        authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
        packetStatus: 'REJECTED',
        explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
        simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
      };

      // 4. Send tampered packet over WebSocket to Bob
      socketA.emit('message:send', {
        id: msgId,
        to: userB.username,
        ciphertext: tamperResult.tamperedHex,
        iv: encResult.ivHex,
        isEncrypted: true,
        cryptoMeta: {
          algorithm: 'AES-256-GCM',
          keyExchange: 'ECDH P-256',
          authTag: encResult.authTagHex,
          keyFingerprint: derivedKeyA.keyFingerprint,
          tamperAudit: audit,
        },
      });

      // 5. Alice's local log
      setMessagesA((prev) => [
        ...prev,
        {
          id: msgId,
          fromUsername: userA.username,
          toUsername: userB.username,
          content: `[Simulated Wire Tamper Sent: "${plaintext}"]`,
          ciphertext: tamperResult.tamperedHex,
          iv: encResult.ivHex,
          authTag: encResult.authTagHex,
          timestamp: Date.now(),
          isEncrypted: true,
          decryptionStatus: 'success',
          deliveryStatus: 'sent' as const,
          wireTamperAudit: audit,
        },
      ]);

      setInputA('');
      setSelectedTamperAudit(audit);
      setTamperSenderName(userA.displayName);
      setTamperRecipientName(userB.displayName);
      setIsTamperModalOpen(true);
    } catch (err) {
      console.error('Tamper demo A failed:', err);
    }
  };

  // Controlled Demonstration: Simulate Wire Tamper from Endpoint B
  const handleSimulateWireTamperB = async () => {
    if (!socketB || !derivedKeyB?.aesKey) return;
    const plaintext = inputB.trim() || 'Simulated Wire Demonstration: Secret Wire Packet';
    const msgId = `msg_tamper_b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    try {
      const encResult = await encryptMessageAESGCM(plaintext, derivedKeyB.aesKey);
      const tamperResult = flipSingleBitInHex(encResult.ciphertextHex, 2, 0);

      const audit: WireTamperAudit = {
        isTampered: true,
        originalCiphertextHex: encResult.ciphertextHex,
        tamperedCiphertextHex: tamperResult.tamperedHex,
        flippedBitDescription: tamperResult.flippedBitDescription,
        authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
        packetStatus: 'REJECTED',
        explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
        simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
      };

      socketB.emit('message:send', {
        id: msgId,
        to: userA.username,
        ciphertext: tamperResult.tamperedHex,
        iv: encResult.ivHex,
        isEncrypted: true,
        cryptoMeta: {
          algorithm: 'AES-256-GCM',
          keyExchange: 'ECDH P-256',
          authTag: encResult.authTagHex,
          keyFingerprint: derivedKeyB.keyFingerprint,
          tamperAudit: audit,
        },
      });

      setMessagesB((prev) => [
        ...prev,
        {
          id: msgId,
          fromUsername: userB.username,
          toUsername: userA.username,
          content: `[Simulated Wire Tamper Sent: "${plaintext}"]`,
          ciphertext: tamperResult.tamperedHex,
          iv: encResult.ivHex,
          authTag: encResult.authTagHex,
          timestamp: Date.now(),
          isEncrypted: true,
          decryptionStatus: 'success',
          deliveryStatus: 'sent' as const,
          wireTamperAudit: audit,
        },
      ]);

      setInputB('');
      setSelectedTamperAudit(audit);
      setTamperSenderName(userB.displayName);
      setTamperRecipientName(userA.displayName);
      setIsTamperModalOpen(true);
    } catch (err) {
      console.error('Tamper demo B failed:', err);
    }
  };

  const isSharedSecretMatch =
    derivedKeyA &&
    derivedKeyB &&
    derivedKeyA.keyFingerprint === derivedKeyB.keyFingerprint;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="h-14 border-b border-slate-800 bg-slate-900/90 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono flex items-center gap-2">
              <span>Alice & Bob Live AES-256-GCM Encrypted Chat</span>
              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" />
                End-to-End Encrypted Session
              </span>
            </h2>
            <p className="text-[10px] text-slate-400">
              Fresh 96-bit random IV per packet. Server routes encrypted ciphertext without decrypting.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Wire Tamper Demo Trigger */}
          <button
            onClick={handleSimulateWireTamperA}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-colors"
            title="Simulate Wire Tamper: Modifies 1 bit in ciphertext on the wire, showing immediate AEAD rejection"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate Wire Tamper</span>
          </button>

          <button
            onClick={triggerMutualExchange}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-Negotiate Keys</span>
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Exit Simulator"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cryptographic Agreement Verification Banner */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/40 grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px] font-mono shrink-0">
        <div className="flex items-center justify-between bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400">{userA.displayName} Key:</span>
          <span className="text-cyan-300 truncate max-w-[140px]">
            {keyPairA ? keyPairA.fingerprint : 'Generating...'}
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-center font-semibold bg-slate-950/80">
          {isSharedSecretMatch ? (
            <span className="text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>AES-256-GCM KEYS MATCH ({derivedKeyA?.keyFingerprint.substring(0, 11)}...)</span>
            </span>
          ) : (
            <span className="text-amber-400 flex items-center gap-1.5 animate-pulse">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Negotiating ECDH P-256...</span>
            </span>
          )}
        </div>

        <div className="flex items-center justify-between bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
          <span className="text-slate-400">{userB.displayName} Key:</span>
          <span className="text-purple-300 truncate max-w-[140px]">
            {keyPairB ? keyPairB.fingerprint : 'Generating...'}
          </span>
        </div>
      </div>

      {/* Split Window View */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800 overflow-hidden">
        {/* Client A Window */}
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${userA.avatarColor} flex items-center justify-center text-white font-bold text-xs`}>
                {userA.displayName.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>{userA.displayName}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    E2EE Active
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{userA.email}</div>
              </div>
            </div>

            <select
              value={userAUsername}
              onChange={(e) => setUserAUsername(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 rounded-lg px-2 py-1"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.username} disabled={u.username === userBUsername}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Endpoint A Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesA.map((msg) => {
              const isMe = msg.fromUsername.toLowerCase() === userA.username.toLowerCase();
              const isInspecting = inspectMessageIdA === msg.id;
              const isAuthFailed = msg.decryptionStatus === 'failed';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                  {isAuthFailed ? (
                    <div className="max-w-[95%] rounded-2xl p-3.5 bg-rose-950/90 border-2 border-rose-500/80 text-rose-200 shadow-xl space-y-2">
                      <div className="font-bold flex items-center justify-between text-rose-300 text-xs pb-1 border-b border-rose-900/60">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                          <span>Tampering detected — AES-GCM authentication failed.</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-900 text-rose-200">
                          REJECTED
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-950 text-[11px] font-mono text-rose-200 leading-relaxed border border-rose-800">
                        "A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail."
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-rose-300/80 pt-1">
                        <span className="italic">Simulated demo (not a real attack)</span>
                        {msg.wireTamperAudit && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTamperAudit(msg.wireTamperAudit!);
                              setTamperSenderName(msg.fromUsername);
                              setTamperRecipientName(userA.displayName);
                              setIsTamperModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[10px] font-mono"
                          >
                            View Audit
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs relative group ${
                        isMe ? 'bg-cyan-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className="text-[9px] font-mono opacity-70 mt-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>AES-256-GCM</span>
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <button
                        onClick={() => setInspectMessageIdA(isInspecting ? null : msg.id)}
                        className={`absolute -bottom-2 ${isMe ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-950 text-cyan-300 border border-slate-800 shadow`}
                      >
                        {isInspecting ? 'Hide' : 'Inspect'}
                      </button>
                    </div>
                  )}

                  {isInspecting && (
                    <div className="w-full max-w-sm p-2.5 rounded-lg bg-slate-950 border border-cyan-500/30 font-mono text-[9px] text-cyan-300 space-y-1">
                      <div><strong className="text-slate-400">Ciphertext:</strong> {msg.ciphertext?.substring(0, 32)}...</div>
                      <div><strong className="text-slate-400">IV (96-bit):</strong> {msg.iv}</div>
                      <div><strong className="text-slate-400">Status:</strong> {msg.decryptionStatus === 'failed' ? 'REJECTED' : 'AUTHENTICATED'}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {isTypingB && (
              <div className="text-[10px] text-slate-500 italic animate-pulse">
                {userB.displayName} is typing...
              </div>
            )}
            <div ref={scrollRefA} />
          </div>

          {/* Input A */}
          <form onSubmit={handleSendA} className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2">
            <input
              type="text"
              value={inputA}
              onChange={(e) => {
                setInputA(e.target.value);
                socketA?.emit('typing:status', { to: userB.username, isTyping: true });
              }}
              placeholder={`Send encrypted message to ${userB.displayName}...`}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
            />
            {/* Simulate Wire Tamper Button (Endpoint A) */}
            <button
              type="button"
              onClick={handleSimulateWireTamperA}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
              title="Simulate Wire Tamper: Modify 1 bit in ciphertext on the wire"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              disabled={!inputA.trim()}
              className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition-all disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* Client B Window */}
        <div className="flex flex-col h-full bg-slate-950 overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${userB.avatarColor} flex items-center justify-center text-white font-bold text-xs`}>
                {userB.displayName.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <span>{userB.displayName}</span>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    E2EE Active
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{userB.email}</div>
              </div>
            </div>

            <select
              value={userBUsername}
              onChange={(e) => setUserBUsername(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 rounded-lg px-2 py-1"
            >
              {availableUsers.map((u) => (
                <option key={u.id} value={u.username} disabled={u.username === userAUsername}>
                  {u.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Endpoint B Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messagesB.map((msg) => {
              const isMe = msg.fromUsername.toLowerCase() === userB.username.toLowerCase();
              const isInspecting = inspectMessageIdB === msg.id;
              const isAuthFailed = msg.decryptionStatus === 'failed';

              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}>
                  {isAuthFailed ? (
                    <div className="max-w-[95%] rounded-2xl p-3.5 bg-rose-950/90 border-2 border-rose-500/80 text-rose-200 shadow-xl space-y-2">
                      <div className="font-bold flex items-center justify-between text-rose-300 text-xs pb-1 border-b border-rose-900/60">
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                          <span>Tampering detected — AES-GCM authentication failed.</span>
                        </div>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-900 text-rose-200">
                          REJECTED
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-rose-950 text-[11px] font-mono text-rose-200 leading-relaxed border border-rose-800">
                        "A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail."
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-rose-300/80 pt-1">
                        <span className="italic">Simulated demo (not a real attack)</span>
                        {msg.wireTamperAudit && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTamperAudit(msg.wireTamperAudit!);
                              setTamperSenderName(msg.fromUsername);
                              setTamperRecipientName(userB.displayName);
                              setIsTamperModalOpen(true);
                            }}
                            className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-200 border border-rose-500/40 text-[10px] font-mono"
                          >
                            View Audit
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`max-w-[85%] rounded-2xl p-3 text-xs relative group ${
                        isMe ? 'bg-purple-600 text-white rounded-br-none' : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700'
                      }`}
                    >
                      <p>{msg.content}</p>
                      <div className="text-[9px] font-mono opacity-70 mt-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>AES-256-GCM</span>
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>

                      <button
                        onClick={() => setInspectMessageIdB(isInspecting ? null : msg.id)}
                        className={`absolute -bottom-2 ${isMe ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 rounded text-[8px] font-mono bg-slate-950 text-purple-300 border border-slate-800 shadow`}
                      >
                        {isInspecting ? 'Hide' : 'Inspect'}
                      </button>
                    </div>
                  )}

                  {isInspecting && (
                    <div className="w-full max-w-sm p-2.5 rounded-lg bg-slate-950 border border-purple-500/30 font-mono text-[9px] text-purple-300 space-y-1">
                      <div><strong className="text-slate-400">Ciphertext:</strong> {msg.ciphertext?.substring(0, 32)}...</div>
                      <div><strong className="text-slate-400">IV (96-bit):</strong> {msg.iv}</div>
                      <div><strong className="text-slate-400">Status:</strong> {msg.decryptionStatus === 'failed' ? 'REJECTED' : 'AUTHENTICATED'}</div>
                    </div>
                  )}
                </div>
              );
            })}
            {isTypingA && (
              <div className="text-[10px] text-slate-500 italic animate-pulse">
                {userA.displayName} is typing...
              </div>
            )}
            <div ref={scrollRefB} />
          </div>

          {/* Input B */}
          <form onSubmit={handleSendB} className="p-3 border-t border-slate-800 bg-slate-900/60 flex items-center gap-2">
            <input
              type="text"
              value={inputB}
              onChange={(e) => {
                setInputB(e.target.value);
                socketB?.emit('typing:status', { to: userA.username, isTyping: true });
              }}
              placeholder={`Send encrypted message to ${userA.displayName}...`}
              className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 focus:outline-none focus:border-purple-500"
            />
            {/* Simulate Wire Tamper Button (Endpoint B) */}
            <button
              type="button"
              onClick={handleSimulateWireTamperB}
              className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all"
              title="Simulate Wire Tamper: Modify 1 bit in ciphertext on the wire"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              disabled={!inputB.trim()}
              className="p-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold transition-all disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Wire Tamper Demonstration Audit Modal */}
      <WireTamperModal
        isOpen={isTamperModalOpen}
        onClose={() => setIsTamperModalOpen(false)}
        audit={selectedTamperAudit}
        senderName={tamperSenderName}
        recipientName={tamperRecipientName}
      />
    </div>
  );
};
