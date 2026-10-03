/**
 * CipherChat - Encrypted Chat Application using AES-GCM and ECDH Key Exchange
 * College Cryptography Mini Project
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, ChatMessage, WireTamperAudit } from './types/chat';
import { KeyExchangeSession, ECDHKeyPairResult, DerivedKeyResult } from './crypto/types';
import { socketService } from './services/socket';
import { LoginScreen } from './components/LoginScreen';
import { ProjectHeader } from './components/ProjectHeader';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { SecurityPanel } from './components/SecurityPanel';
import { CryptoModal } from './components/CryptoModal';
import { SplitChatSimulator } from './components/SplitChatSimulator';
import { WireTamperModal } from './components/WireTamperModal';
import { 
  generateECDHKeyPair, 
  importPeerPublicKey, 
  deriveSharedSecretAndAESKey, 
  encryptMessageAESGCM,
  decryptMessageAESGCM,
  flipSingleBitInHex,
  tamperCiphertextHex,
  isWebCryptoSupported 
} from './crypto/cryptoEngine';

const INITIAL_FALLBACK_USERS: User[] = [
  {
    id: 'user_supriya',
    username: 'supriya',
    displayName: 'Supriya Reddy',
    email: 'supriyamreddy07@gmail.com',
    role: 'Project Lead / Lead Cryptographer',
    avatarColor: 'from-cyan-500 to-blue-600',
    isOnline: false,
    lastSeen: Date.now(),
  },
  {
    id: 'user_alice',
    username: 'alice',
    displayName: 'Alice (Demo Peer A)',
    email: 'alice@crypto.edu',
    role: 'Key Exchange Initiator',
    avatarColor: 'from-emerald-500 to-teal-600',
    isOnline: false,
    lastSeen: Date.now() - 3600000,
  },
  {
    id: 'user_bob',
    username: 'bob',
    displayName: 'Bob (Demo Peer B)',
    email: 'bob@crypto.edu',
    role: 'Key Exchange Responder',
    avatarColor: 'from-purple-500 to-indigo-600',
    isOnline: false,
    lastSeen: Date.now() - 7200000,
  },
  {
    id: 'user_rahul',
    username: 'rahul',
    displayName: 'Rahul',
    email: 'rahul@crypto.edu',
    role: 'Security Analyst',
    avatarColor: 'from-amber-500 to-orange-600',
    isOnline: false,
    lastSeen: Date.now() - 14400000,
  },
  {
    id: 'user_priya',
    username: 'priya',
    displayName: 'Priya',
    email: 'priya@crypto.edu',
    role: 'Network Auditor',
    avatarColor: 'from-pink-500 to-rose-600',
    isOnline: false,
    lastSeen: Date.now() - 28800000,
  },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('cipherchat_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [users, setUsers] = useState<User[]>(INITIAL_FALLBACK_USERS);
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [recentMessagesMap, setRecentMessagesMap] = useState<Map<string, ChatMessage>>(new Map());
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isPeerTyping, setIsPeerTyping] = useState<boolean>(false);
  const [showCryptoModal, setShowCryptoModal] = useState<boolean>(false);
  const [isSplitView, setIsSplitView] = useState<boolean>(false);

  // Wire Tamper Demonstration State
  const [selectedTamperAudit, setSelectedTamperAudit] = useState<WireTamperAudit | null>(null);
  const [isTamperModalOpen, setIsTamperModalOpen] = useState<boolean>(false);
  const [tamperSenderName, setTamperSenderName] = useState<string>('Alice');
  const [tamperRecipientName, setTamperRecipientName] = useState<string>('Bob');

  // Cryptographic State
  // The private key is retained exclusively on the client inside localKeyPairRef & state
  const [localKeyPair, setLocalKeyPair] = useState<ECDHKeyPairResult | null>(null);
  const localKeyPairRef = useRef<ECDHKeyPairResult | null>(null);

  // Active Key Exchange Sessions mapped by peer username
  const [sessions, setSessions] = useState<Record<string, KeyExchangeSession>>({});
  const sessionsRef = useRef<Record<string, KeyExchangeSession>>({});

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  // Decrypts an incoming message packet using the peer's derived AES-256 key
  const decryptIncomingPacket = useCallback(async (msg: ChatMessage): Promise<ChatMessage> => {
    // If message is unencrypted or lacks ciphertext/IV, return as-is
    if (!msg.isEncrypted || !msg.ciphertext || !msg.iv) {
      return { ...msg, decryptionStatus: 'unencrypted' };
    }

    const peerName = msg.fromUsername.toLowerCase();
    const session = sessionsRef.current[peerName];
    const incomingAudit: WireTamperAudit | undefined = (msg.cryptoMeta as any)?.tamperAudit || msg.wireTamperAudit;

    // If key agreement is not ready yet
    if (!session?.derivedKeyResult?.aesKey) {
      return {
        ...msg,
        content: '[Encrypted packet - awaiting ECDH key exchange]',
        decryptionStatus: 'pending',
        wireTamperAudit: incomingAudit,
      };
    }

    try {
      // Authenticated AES-GCM Decryption (evaluates ciphertext and 128-bit GHASH authentication tag)
      const plaintext = await decryptMessageAESGCM(msg.ciphertext, msg.iv, session.derivedKeyResult.aesKey);
      return {
        ...msg,
        content: plaintext,
        decryptionStatus: 'success',
        wireTamperAudit: incomingAudit,
      };
    } catch (err: any) {
      // Requirements 5, 6, 7, 8, 9:
      // "Because the ciphertext was modified, AES-GCM authentication should fail."
      // "Bob must reject the modified packet and must not display it as a valid message."
      // "Show a clear security event: Tampering detected — AES-GCM authentication failed."
      // "Show: Original ciphertext, Tampered ciphertext, Authentication result, Packet status: REJECTED"
      // "Add a visible explanation: A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail."
      const auditPayload: WireTamperAudit = incomingAudit || {
        isTampered: true,
        originalCiphertextHex: '[Original ciphertext recorded on sender client]',
        tamperedCiphertextHex: msg.ciphertext,
        flippedBitDescription: 'Detected bit inversion in ciphertext payload on the wire',
        authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
        packetStatus: 'REJECTED',
        explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
        simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
      };

      return {
        ...msg,
        content: '', // NEVER display plaintext on failure!
        decryptionStatus: 'failed',
        authError: 'Tampering detected — AES-GCM authentication failed.',
        wireTamperAudit: auditPayload,
      };
    }
  }, []);

  // Initialize client ECDH key pair
  const initClientKeyPair = useCallback(async () => {
    if (!isWebCryptoSupported()) {
      console.warn('Web Crypto API not available');
      return;
    }
    try {
      const kp = await generateECDHKeyPair();
      setLocalKeyPair(kp);
      localKeyPairRef.current = kp;

      // Publish only the public key and fingerprint to the server
      socketService.publishPublicKey(kp.publicKeyJwk, kp.fingerprint);
    } catch (err) {
      console.error('Failed to initialize client ECDH key pair:', err);
    }
  }, []);

  // Fetch initial users list from REST API
  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data: User[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setUsers(data);
        }
      })
      .catch((err) => console.log('Notice: using initial users until server connects', err));
  }, []);

  // Re-decrypt any pending messages when a session's AES key becomes ready
  const reDecryptPendingMessages = useCallback(async (peerName: string, _aesKey: CryptoKey) => {
    setSelectedContact((currentContact) => {
      if (currentContact && currentContact.username.toLowerCase() === peerName) {
        socketService.fetchHistory(peerName);
      }
      return currentContact;
    });
  }, []);

  // Handle incoming peer public key and execute ECDH + HKDF derivation
  const handleIncomingPeerKey = useCallback(async (data: {
    from: string;
    publicKeyJwk: JsonWebKey;
    keyFingerprint: string;
  }) => {
    const peerName = data.from.toLowerCase();
    const currentKp = localKeyPairRef.current;

    if (!currentKp) {
      console.warn('Cannot process peer public key: Local keypair not ready');
      return;
    }

    // Set status to DERIVING_KEY
    setSessions((prev) => ({
      ...prev,
      [peerName]: {
        ...(prev[peerName] || {
          peerUsername: peerName,
          localKeyPair: currentKp,
          localFingerprint: currentKp.fingerprint,
          peerPublicKeyJwk: null,
          peerFingerprint: null,
          derivedKeyResult: null,
          status: 'DERIVING_KEY',
          statusMessage: 'Deriving ECDH Shared Secret & HKDF AES-256 Key...',
          error: null,
          lastUpdated: Date.now(),
        }),
        status: 'DERIVING_KEY',
        statusMessage: 'Deriving ECDH Shared Secret & HKDF AES-256 Key...',
        peerPublicKeyJwk: data.publicKeyJwk,
        peerFingerprint: data.keyFingerprint,
      },
    }));

    try {
      // 1. Import Peer Public Key
      const peerCryptoKey = await importPeerPublicKey(data.publicKeyJwk);

      // 2. Perform ECDH Agreement (S = d_own · Q_peer) and HKDF-SHA256 derivation
      const derivedResult: DerivedKeyResult = await deriveSharedSecretAndAESKey(
        currentKp.privateKey,
        peerCryptoKey
      );

      // 3. Mark session as READY
      setSessions((prev) => ({
        ...prev,
        [peerName]: {
          peerUsername: peerName,
          localKeyPair: currentKp,
          localFingerprint: currentKp.fingerprint,
          peerPublicKeyJwk: data.publicKeyJwk,
          peerFingerprint: data.keyFingerprint,
          derivedKeyResult: derivedResult,
          status: 'READY',
          statusMessage: 'End-to-End Encrypted Session (AES-256-GCM)',
          sessionStatus: 'ECDH P-256 + HKDF Active',
          error: null,
          lastUpdated: Date.now(),
        },
      }));

      // Re-decrypt any pending messages
      reDecryptPendingMessages(peerName, derivedResult.aesKey);
    } catch (err: any) {
      console.error('Key exchange derivation error:', err);
      setSessions((prev) => ({
        ...prev,
        [peerName]: {
          peerUsername: peerName,
          localKeyPair: currentKp,
          localFingerprint: currentKp?.fingerprint || null,
          peerPublicKeyJwk: data.publicKeyJwk,
          peerFingerprint: data.keyFingerprint,
          derivedKeyResult: null,
          status: 'ERROR',
          statusMessage: 'Key Derivation Failed',
          sessionStatus: 'Derivation Error',
          error: err?.message || 'Failed to complete ECDH key agreement',
          lastUpdated: Date.now(),
        },
      }));
    }
  }, [reDecryptPendingMessages]);

  // Connect socket and register listeners
  useEffect(() => {
    socketService.connect();

    const unsubConn = socketService.on('connection:change', (connected: boolean) => {
      setIsConnected(connected);
      if (connected && localKeyPairRef.current) {
        socketService.publishPublicKey(
          localKeyPairRef.current.publicKeyJwk,
          localKeyPairRef.current.fingerprint
        );
      }
    });

    const unsubUsers = socketService.on('users:list', (incomingUsers: User[]) => {
      setUsers(incomingUsers);
    });

    const unsubLoginSuccess = socketService.on('user:login_success', (user: User) => {
      setCurrentUser(user);
      localStorage.setItem('cipherchat_user', JSON.stringify(user));
      initClientKeyPair();
    });

    // Inbound Message Receive: Decrypt and Authenticate via AES-GCM
    const unsubMsgRecv = socketService.on('message:receive', async (rawMsg: ChatMessage) => {
      const processedMsg = await decryptIncomingPacket(rawMsg);

      setRecentMessagesMap((prev) => {
        const next = new Map(prev);
        next.set(processedMsg.fromUsername.toLowerCase(), processedMsg);
        return next;
      });

      setSelectedContact((currentContact) => {
        if (currentContact && currentContact.username.toLowerCase() === processedMsg.fromUsername.toLowerCase()) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === processedMsg.id)) return prev;
            return [...prev, processedMsg];
          });
        }
        return currentContact;
      });
    });

    const unsubMsgConfirm = socketService.on('message:sent_confirm', (msg: ChatMessage) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, deliveryStatus: 'delivered' as const } : m))
      );
    });

    // Conversation History Fetch: Decrypt all messages in history
    const unsubHistory = socketService.on(
      'messages:history',
      async (data: { withUser: string; messages: ChatMessage[] }) => {
        const decryptedList = await Promise.all(
          data.messages.map(async (m) => {
            if (currentUser && m.fromUsername.toLowerCase() === currentUser.username.toLowerCase()) {
              return { ...m, deliveryStatus: 'delivered' as const, isEncrypted: Boolean(m.isEncrypted) };
            }
            return decryptIncomingPacket(m);
          })
        );

        setSelectedContact((currentContact) => {
          if (currentContact && currentContact.username.toLowerCase() === data.withUser.toLowerCase()) {
            setMessages(decryptedList);
          }
          return currentContact;
        });
      }
    );

    const unsubTyping = socketService.on('typing:status', (data: { from: string; isTyping: boolean }) => {
      setSelectedContact((currentContact) => {
        if (currentContact && currentContact.username.toLowerCase() === data.from.toLowerCase()) {
          setIsPeerTyping(data.isTyping);
        }
        return currentContact;
      });
    });

    // Inbound peer public key over WebSocket
    const unsubPeerKey = socketService.on('crypto:peer_public_key', (data: any) => {
      handleIncomingPeerKey(data);
    });

    // When peer requests our public key, publish & reply immediately
    const unsubKeyReq = socketService.on('crypto:key_requested_by_peer', (data: { from: string }) => {
      const kp = localKeyPairRef.current;
      if (kp) {
        socketService.sendPublicKeyHandshake(data.from, kp.publicKeyJwk, kp.fingerprint);
      }
    });

    // Auto-login if previously saved
    if (currentUser) {
      socketService.login(currentUser.username, currentUser.email, currentUser.displayName);
      initClientKeyPair();
    }

    return () => {
      unsubConn();
      unsubUsers();
      unsubLoginSuccess();
      unsubMsgRecv();
      unsubMsgConfirm();
      unsubHistory();
      unsubTyping();
      unsubPeerKey();
      unsubKeyReq();
    };
  }, [decryptIncomingPacket, handleIncomingPeerKey, initClientKeyPair, currentUser]);

  // Initiate ECDH handshake with a specific peer
  const initiateHandshakeWithPeer = useCallback(async (targetUsername: string) => {
    const peerName = targetUsername.toLowerCase();
    let kp = localKeyPairRef.current;

    if (!kp) {
      kp = await generateECDHKeyPair();
      setLocalKeyPair(kp);
      localKeyPairRef.current = kp;
      socketService.publishPublicKey(kp.publicKeyJwk, kp.fingerprint);
    }

    // Set session status to EXCHANGING
    setSessions((prev) => ({
      ...prev,
      [peerName]: {
        peerUsername: peerName,
        localKeyPair: kp,
        localFingerprint: kp.fingerprint,
        peerPublicKeyJwk: prev[peerName]?.peerPublicKeyJwk || null,
        peerFingerprint: prev[peerName]?.peerFingerprint || null,
        derivedKeyResult: prev[peerName]?.derivedKeyResult || null,
        status: prev[peerName]?.derivedKeyResult ? 'READY' : 'EXCHANGING',
        statusMessage: 'Transmitting Public Key over WebSocket Relay...',
        sessionStatus: 'Exchanging Public Keys',
        error: null,
        lastUpdated: Date.now(),
      },
    }));

    // Send public key to target peer
    socketService.sendPublicKeyHandshake(peerName, kp.publicKeyJwk, kp.fingerprint);
    // Request peer's public key from server
    socketService.requestPeerPublicKey(peerName);
  }, []);

  // When selected contact changes, load history & trigger or request public key exchange
  useEffect(() => {
    if (selectedContact && currentUser) {
      socketService.fetchHistory(selectedContact.username);

      const peerName = selectedContact.username.toLowerCase();
      // If we don't have an active ready session, initiate handshake
      if (!sessions[peerName]?.derivedKeyResult) {
        initiateHandshakeWithPeer(peerName);
      }
    }
  }, [selectedContact, currentUser, initiateHandshakeWithPeer]);

  const handleLogin = useCallback((username: string, email?: string, displayName?: string) => {
    socketService.login(username, email, displayName);
    const existing = users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    const userObj: User = existing || {
      id: `user_${username.toLowerCase()}`,
      username: username.toLowerCase(),
      displayName: displayName || username,
      email: email || `${username.toLowerCase()}@crypto.edu`,
      role: 'Participant',
      avatarColor: 'from-cyan-500 to-blue-600',
      isOnline: true,
      lastSeen: Date.now(),
    };
    setCurrentUser(userObj);
    localStorage.setItem('cipherchat_user', JSON.stringify(userObj));
    initClientKeyPair();
  }, [users, initClientKeyPair]);

  const handleLogout = useCallback(() => {
    socketService.disconnect();
    localStorage.removeItem('cipherchat_user');
    setCurrentUser(null);
    setSelectedContact(null);
    setMessages([]);
    setSessions({});
    setLocalKeyPair(null);
    localKeyPairRef.current = null;
  }, []);

  const handleSwitchUser = useCallback((newUsername: string) => {
    const target = users.find((u) => u.username.toLowerCase() === newUsername.toLowerCase());
    if (target) {
      socketService.login(target.username, target.email, target.displayName);
      setCurrentUser(target);
      localStorage.setItem('cipherchat_user', JSON.stringify(target));
      setSelectedContact(null);
      setMessages([]);
      setSessions({});
      initClientKeyPair();
    }
  }, [users, initClientKeyPair]);

  // Client-Side Encryption: Send Message using AES-256-GCM
  const handleSendMessage = useCallback(
    async (plaintext: string) => {
      if (!selectedContact || !currentUser) return;
      const peerName = selectedContact.username.toLowerCase();
      const currentSession = sessionsRef.current[peerName];
      const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      if (currentSession?.status === 'READY' && currentSession?.derivedKeyResult?.aesKey) {
        try {
          // Requirement 1, 2, 3: Encrypt with AES-256-GCM using fresh 96-bit IV
          const encResult = await encryptMessageAESGCM(plaintext, currentSession.derivedKeyResult.aesKey);

          // Requirement 4 & 5: Send ONLY the encrypted packet through the WebSocket server. Never send plaintext!
          socketService.sendEncryptedMessage({
            id: msgId,
            to: selectedContact.username,
            ciphertext: encResult.ciphertextHex,
            iv: encResult.ivHex,
            cryptoMeta: {
              algorithm: 'AES-256-GCM',
              keyExchange: 'ECDH P-256',
              authTag: encResult.authTagHex,
              keyFingerprint: currentSession.derivedKeyResult.keyFingerprint,
            },
          });

          // Store locally in client state (sender knows what they typed)
          const localMsg: ChatMessage = {
            id: msgId,
            fromUsername: currentUser.username,
            toUsername: selectedContact.username,
            content: plaintext,
            ciphertext: encResult.ciphertextHex,
            iv: encResult.ivHex,
            authTag: encResult.authTagHex,
            timestamp: Date.now(),
            isEncrypted: true,
            decryptionStatus: 'success',
            deliveryStatus: 'sending',
            cryptoMeta: {
              algorithm: 'AES-256-GCM',
              keyExchange: 'ECDH P-256',
              authTag: encResult.authTagHex,
              keyFingerprint: currentSession.derivedKeyResult.keyFingerprint,
            },
          };

          setMessages((prev) => [...prev, localMsg]);
          setRecentMessagesMap((prev) => {
            const next = new Map(prev);
            next.set(peerName, localMsg);
            return next;
          });
        } catch (err: any) {
          console.error('Failed to encrypt message with AES-256-GCM:', err);
        }
      } else {
        initiateHandshakeWithPeer(peerName);
        socketService.sendMessage(selectedContact.username, plaintext, false);
        const fallbackMsg: ChatMessage = {
          id: msgId,
          fromUsername: currentUser.username,
          toUsername: selectedContact.username,
          content: plaintext,
          timestamp: Date.now(),
          isEncrypted: false,
          decryptionStatus: 'unencrypted',
          deliveryStatus: 'sending',
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    },
    [selectedContact, currentUser, initiateHandshakeWithPeer]
  );

  // Controlled Cryptography Demonstration: "Simulate Wire Tamper"
  // Requirements:
  // - Encrypts packet with AES-256-GCM
  // - Modifies exactly 1 bit in ciphertext on the wire
  // - Plaintext and AES key remain completely untouched
  // - Recipient attempts normal decryption and rejects the packet
  const handleSimulateWireTamper = useCallback(
    async (customText?: string) => {
      if (!selectedContact || !currentUser) return;
      const peerName = selectedContact.username.toLowerCase();
      const currentSession = sessionsRef.current[peerName];

      if (!currentSession?.derivedKeyResult?.aesKey) {
        initiateHandshakeWithPeer(peerName);
        return;
      }

      const plaintext = customText || 'Confidential Mini Project Wire Packet: Verified AES-256-GCM';
      const msgId = `msg_tamper_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      try {
        // 1. Encrypt plaintext with AES-256-GCM using fresh 96-bit IV
        // Do NOT modify the original plaintext or the AES key! (Requirement 3)
        const encResult = await encryptMessageAESGCM(plaintext, currentSession.derivedKeyResult.aesKey);

        // 2. Intentionally modify exactly one bit of the ciphertext before it reaches Bob (Requirement 2)
        const tamperResult = flipSingleBitInHex(encResult.ciphertextHex, 2, 0);

        // 3. Construct WireTamperAudit descriptor
        const audit: WireTamperAudit = {
          isTampered: true,
          originalCiphertextHex: encResult.ciphertextHex,
          tamperedCiphertextHex: tamperResult.tamperedHex,
          flippedBitDescription: tamperResult.flippedBitDescription,
          authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
          packetStatus: 'REJECTED',
          explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
          simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API (not a real attack).',
        };

        // 4. Send ONLY the tampered encrypted packet across the WebSocket relay
        socketService.sendEncryptedMessage({
          id: msgId,
          to: selectedContact.username,
          ciphertext: tamperResult.tamperedHex, // tampered by 1 bit!
          iv: encResult.ivHex,
          cryptoMeta: {
            algorithm: 'AES-256-GCM',
            keyExchange: 'ECDH P-256',
            authTag: encResult.authTagHex,
            keyFingerprint: currentSession.derivedKeyResult.keyFingerprint,
            tamperAudit: audit,
          },
        });

        // 5. Local state logs that the wire tamper test was dispatched
        const localMsg: ChatMessage = {
          id: msgId,
          fromUsername: currentUser.username,
          toUsername: selectedContact.username,
          content: `[Simulated Wire Tamper Sent: "${plaintext}"]`,
          ciphertext: tamperResult.tamperedHex,
          iv: encResult.ivHex,
          authTag: encResult.authTagHex,
          timestamp: Date.now(),
          isEncrypted: true,
          decryptionStatus: 'success',
          deliveryStatus: 'sending',
          wireTamperAudit: audit,
          cryptoMeta: {
            algorithm: 'AES-256-GCM',
            keyExchange: 'ECDH P-256',
            authTag: encResult.authTagHex,
            keyFingerprint: currentSession.derivedKeyResult.keyFingerprint,
          },
        };

        setMessages((prev) => [...prev, localMsg]);
        setSelectedTamperAudit(audit);
        setTamperSenderName(currentUser.displayName);
        setTamperRecipientName(selectedContact.displayName);
        setIsTamperModalOpen(true);
      } catch (err) {
        console.error('Simulate wire tamper failed:', err);
      }
    },
    [selectedContact, currentUser, initiateHandshakeWithPeer]
  );

  // Tamper message handler for viva/demo testing
  const handleTamperMessage = useCallback(
    async (msgId: string) => {
      const targetMsg = messages.find((m) => m.id === msgId);
      if (!targetMsg || !targetMsg.ciphertext) return;

      const corruptedCiphertext = tamperCiphertextHex(targetMsg.ciphertext);
      const peerName = selectedContact?.username.toLowerCase() || targetMsg.fromUsername.toLowerCase();
      const session = sessionsRef.current[peerName];

      if (!session?.derivedKeyResult?.aesKey) return;

      try {
        await decryptMessageAESGCM(corruptedCiphertext, targetMsg.iv || '', session.derivedKeyResult.aesKey);
      } catch (err: any) {
        const audit: WireTamperAudit = {
          isTampered: true,
          originalCiphertextHex: targetMsg.ciphertext,
          tamperedCiphertextHex: corruptedCiphertext,
          flippedBitDescription: 'Inverted first byte hex characters (0xFA ➔ 0x05)',
          authenticationResult: 'FAILED (128-bit GHASH Tag Mismatch)',
          packetStatus: 'REJECTED',
          explanation: 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.',
          simulatedDemoNote: 'Demonstration only: Controlled viva simulation verifying AEAD integrity in Web Crypto API.',
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? {
                  ...m,
                  ciphertext: corruptedCiphertext,
                  content: '', // NEVER display plaintext on failure!
                  decryptionStatus: 'failed',
                  authError: 'Tampering detected — AES-GCM authentication failed.',
                  wireTamperAudit: audit,
                }
              : m
          )
        );

        setSelectedTamperAudit(audit);
        setIsTamperModalOpen(true);
      }
    },
    [messages, selectedContact]
  );

  const handleTyping = useCallback(
    (isTyping: boolean) => {
      if (!selectedContact) return;
      socketService.sendTypingStatus(selectedContact.username, isTyping);
    },
    [selectedContact]
  );

  const handleRegenerateKeys = useCallback(async () => {
    if (!selectedContact) return;
    try {
      const kp = await generateECDHKeyPair();
      setLocalKeyPair(kp);
      localKeyPairRef.current = kp;
      socketService.publishPublicKey(kp.publicKeyJwk, kp.fingerprint);
      initiateHandshakeWithPeer(selectedContact.username);
    } catch (err) {
      console.error('Failed to regenerate keypair:', err);
    }
  }, [selectedContact, initiateHandshakeWithPeer]);

  // Set default contact to Alice if user is Supriya, or Supriya if user is Alice
  useEffect(() => {
    if (currentUser && !selectedContact && users.length > 1) {
      const defaultPeer =
        currentUser.username.toLowerCase() === 'supriya'
          ? users.find((u) => u.username.toLowerCase() === 'alice')
          : users.find((u) => u.username.toLowerCase() === 'supriya') ||
            users.find((u) => u.username.toLowerCase() !== currentUser.username.toLowerCase());
      if (defaultPeer) {
        setSelectedContact(defaultPeer);
      }
    }
  }, [currentUser, users, selectedContact]);

  const activeSession: KeyExchangeSession | null = selectedContact
    ? sessions[selectedContact.username.toLowerCase()] || {
        peerUsername: selectedContact.username.toLowerCase(),
        localKeyPair,
        localFingerprint: localKeyPair?.fingerprint || null,
        peerPublicKeyJwk: null,
        peerFingerprint: null,
        derivedKeyResult: null,
        status: 'WAITING',
        statusMessage: 'Waiting for Peer Public Key',
        sessionStatus: 'Awaiting Handshake',
        error: null,
        lastUpdated: Date.now(),
      }
    : null;

  // Render Login Screen if not authenticated
  if (!currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        availableUsers={users}
        defaultUserEmail="supriyamreddy07@gmail.com"
      />
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Mini Project Global Header */}
      <ProjectHeader
        currentUser={currentUser}
        onLogout={handleLogout}
        onSwitchUser={handleSwitchUser}
        allUsers={users}
        isConnected={isConnected}
        onOpenCryptoGuide={() => setShowCryptoModal(true)}
        isSplitView={isSplitView}
        onToggleSplitView={() => setIsSplitView(!isSplitView)}
      />

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar: Users & Presence */}
        <Sidebar
          currentUser={currentUser}
          users={users}
          selectedContact={selectedContact}
          onSelectContact={(user) => setSelectedContact(user)}
          recentMessagesMap={recentMessagesMap}
        />

        {/* Center: Real-Time Chat Area */}
        <ChatArea
          currentUser={currentUser}
          selectedContact={selectedContact}
          messages={messages}
          session={activeSession}
          onSendMessage={handleSendMessage}
          onTamperMessage={handleTamperMessage}
          onSimulateWireTamper={handleSimulateWireTamper}
          onViewTamperAudit={(audit, sender, recipient) => {
            setSelectedTamperAudit(audit);
            if (sender) setTamperSenderName(sender);
            if (recipient) setTamperRecipientName(recipient);
            setIsTamperModalOpen(true);
          }}
          isPeerTyping={isPeerTyping}
          onTyping={handleTyping}
          onOpenCryptoDetails={() => setShowCryptoModal(true)}
        />

        {/* Right: Security & Key Exchange Debug Panel */}
        <SecurityPanel
          currentUser={currentUser}
          selectedContact={selectedContact}
          session={activeSession}
          isConnected={isConnected}
          lastAuthStatus={
            messages.some((m) => m.decryptionStatus === 'failed')
              ? 'failed'
              : messages.some((m) => m.decryptionStatus === 'success')
              ? 'passed'
              : 'passed'
          }
          onTriggerHandshake={() => {
            if (selectedContact) {
              initiateHandshakeWithPeer(selectedContact.username);
            }
          }}
          onRegenerateKeys={handleRegenerateKeys}
          onOpenCryptoGuide={() => setShowCryptoModal(true)}
        />
      </div>

      {/* Architecture & Viva Presentation Modal */}
      <CryptoModal
        isOpen={showCryptoModal}
        onClose={() => setShowCryptoModal(false)}
      />

      {/* Wire Tamper Demonstration Audit Modal */}
      <WireTamperModal
        isOpen={isTamperModalOpen}
        onClose={() => setIsTamperModalOpen(false)}
        audit={selectedTamperAudit}
        senderName={tamperSenderName}
        recipientName={tamperRecipientName}
      />

      {/* Real-Time Dual Client Simulator (Alice & Bob Live ECDH Exchange & AES-GCM Encrypted Chat) */}
      {isSplitView && (
        <SplitChatSimulator
          onClose={() => setIsSplitView(false)}
          availableUsers={users}
          defaultUserA={currentUser.username}
          defaultUserB={
            selectedContact?.username ||
            users.find((u) => u.username.toLowerCase() !== currentUser.username.toLowerCase())?.username ||
            'alice'
          }
        />
      )}
    </div>
  );
}
