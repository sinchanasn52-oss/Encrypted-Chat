import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = 3000;

app.use(express.json());

// Demo registered users for the College Cryptography Mini Project
interface RegisteredUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: string;
  avatarColor: string;
  isOnline: boolean;
  socketId: string | null;
  lastSeen: number;
  publicKeyJwk?: any;
  publicKeyFingerprint?: string;
}

const DEFAULT_USERS: RegisteredUser[] = [
  {
    id: 'user_supriya',
    username: 'supriya',
    displayName: 'Supriya Reddy',
    email: 'supriyamreddy07@gmail.com',
    role: 'Project Lead / Lead Cryptographer',
    avatarColor: 'from-cyan-500 to-blue-600',
    isOnline: false,
    socketId: null,
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
    socketId: null,
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
    socketId: null,
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
    socketId: null,
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
    socketId: null,
    lastSeen: Date.now() - 28800000,
  },
];

// In-memory store of users
const usersMap = new Map<string, RegisteredUser>();
DEFAULT_USERS.forEach((u) => usersMap.set(u.username.toLowerCase(), { ...u }));

// In-memory messages storage: conversationKey -> messages
// Message structure is deliberately prepared for client-side encrypted payloads (AES-GCM ciphertext, IV, authTag)
// CRITICAL: For encrypted messages, the server ONLY receives and stores { ciphertext, iv, authTag } - NEVER plaintext!
export interface RoutedMessage {
  id: string;
  fromUsername: string;
  toUsername: string;
  ciphertext?: string; // AES-GCM ciphertext in hex
  iv?: string; // 12-byte IV in hex
  content?: string; // Only present for unencrypted handshake/fallback messages; NEVER for encrypted messages!
  timestamp: number;
  isEncrypted: boolean;
  cryptoMeta?: {
    algorithm: string;
    iv?: string;
    authTag?: string;
    keyExchange: string;
    keyFingerprint?: string;
  };
}

const conversationsMap = new Map<string, RoutedMessage[]>();

function getConversationKey(u1: string, u2: string): string {
  return [u1.toLowerCase(), u2.toLowerCase()].sort().join(':');
}

// Pre-seed realistic initial conversation threads
const initialSeedMessages: RoutedMessage[] = [
  {
    id: 'msg_seed_1',
    fromUsername: 'alice',
    toUsername: 'supriya',
    content: 'Hi Supriya! The ECDH P-256 key pair generation test passed in Web Crypto.',
    timestamp: Date.now() - 3600000,
    isEncrypted: false,
    cryptoMeta: {
      algorithm: 'AES-256-GCM',
      keyExchange: 'ECDH P-256',
    },
  },
  {
    id: 'msg_seed_2',
    fromUsername: 'supriya',
    toUsername: 'alice',
    content: 'Excellent! The WebSocket server is set up to route encrypted messages without decrypting them.',
    timestamp: Date.now() - 3500000,
    isEncrypted: false,
    cryptoMeta: {
      algorithm: 'AES-256-GCM',
      keyExchange: 'ECDH P-256',
    },
  },
  {
    id: 'msg_seed_3',
    fromUsername: 'bob',
    toUsername: 'supriya',
    content: 'Ready to demonstrate the live chat and key exchange flow for the viva presentation.',
    timestamp: Date.now() - 1800000,
    isEncrypted: false,
    cryptoMeta: {
      algorithm: 'AES-256-GCM',
      keyExchange: 'ECDH P-256',
    },
  },
];

initialSeedMessages.forEach((msg) => {
  const key = getConversationKey(msg.fromUsername, msg.toUsername);
  const list = conversationsMap.get(key) || [];
  list.push(msg);
  conversationsMap.set(key, list);
});

// REST API Endpoints
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'CipherChat Real-time Cryptography Server',
    architecture: 'Client-Side AES-GCM + ECDH P-256 Relay',
    connectedClients: io.engine.clientsCount,
    timestamp: Date.now(),
  });
});

app.get('/api/users', (_req, res) => {
  const usersList = Array.from(usersMap.values()).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    avatarColor: u.avatarColor,
    isOnline: u.isOnline,
    lastSeen: u.lastSeen,
  }));
  res.json(usersList);
});

app.get('/api/messages/:userA/:userB', (req, res) => {
  const { userA, userB } = req.params;
  const key = getConversationKey(userA, userB);
  const msgs = conversationsMap.get(key) || [];
  res.json(msgs);
});

// Endpoint to retrieve a peer's public key (never private key)
app.get('/api/users/:username/public-key', (req, res) => {
  const username = req.params.username.toLowerCase();
  const user = usersMap.get(username);
  if (!user || !user.publicKeyJwk) {
    res.status(404).json({ error: 'Public key not found for user ' + username });
    return;
  }
  res.json({
    username: user.username,
    publicKeyJwk: user.publicKeyJwk,
    publicKeyFingerprint: user.publicKeyFingerprint,
  });
});

// Socket.IO Real-Time Management
io.on('connection', (socket) => {
  let authenticatedUsername: string | null = null;

  // Broadcast current user list to the connecting socket
  const broadcastUserList = () => {
    const list = Array.from(usersMap.values()).map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      role: u.role,
      avatarColor: u.avatarColor,
      isOnline: u.isOnline,
      lastSeen: u.lastSeen,
    }));
    io.emit('users:list', list);
  };

  // User Authentication / Registration
  socket.on('user:login', (data: { username: string; email?: string; displayName?: string }) => {
    const cleanUsername = data.username.trim().toLowerCase();
    if (!cleanUsername) return;

    authenticatedUsername = cleanUsername;
    socket.join(`user:${cleanUsername}`);

    let user = usersMap.get(cleanUsername);
    if (!user) {
      // Create new dynamic user
      user = {
        id: `user_${cleanUsername}_${Date.now()}`,
        username: cleanUsername,
        displayName: data.displayName || cleanUsername,
        email: data.email || `${cleanUsername}@crypto.edu`,
        role: 'Chat Participant',
        avatarColor: 'from-violet-500 to-indigo-600',
        isOnline: true,
        socketId: socket.id,
        lastSeen: Date.now(),
      };
      usersMap.set(cleanUsername, user);
    } else {
      user.isOnline = true;
      user.socketId = socket.id;
      user.lastSeen = Date.now();
      if (data.email) user.email = data.email;
      if (data.displayName) user.displayName = data.displayName;
    }

    socket.emit('user:login_success', user);
    broadcastUserList();
  });

  // Fetch Message History
  socket.on('messages:get_history', (data: { withUser: string }) => {
    if (!authenticatedUsername || !data.withUser) return;
    const key = getConversationKey(authenticatedUsername, data.withUser);
    const msgs = conversationsMap.get(key) || [];
    socket.emit('messages:history', {
      withUser: data.withUser.toLowerCase(),
      messages: msgs,
    });
  });

  // Real-Time Message Routing
  // CRITICAL SECURITY PRINCIPLE: The server only routes messages.
  // In our cryptographic model, the server NEVER decrypts the chat content.
  socket.on(
    'message:send',
    (payload: {
      id?: string;
      to: string;
      ciphertext?: string;
      iv?: string;
      content?: string;
      isEncrypted?: boolean;
      cryptoMeta?: {
        algorithm: string;
        iv?: string;
        authTag?: string;
        keyExchange: string;
        keyFingerprint?: string;
      };
    }) => {
      if (!authenticatedUsername) {
        socket.emit('error', { message: 'Unauthorized. Please login first.' });
        return;
      }

      const toUsername = payload.to.trim().toLowerCase();
      // SECURITY VERIFICATION: If isEncrypted is true, content is undefined (never transmitted to or stored on server!)
      const newMsg: RoutedMessage = {
        id: payload.id || `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        fromUsername: authenticatedUsername,
        toUsername,
        ciphertext: payload.ciphertext,
        iv: payload.iv,
        content: payload.isEncrypted ? undefined : payload.content,
        timestamp: Date.now(),
        isEncrypted: Boolean(payload.isEncrypted),
        cryptoMeta: payload.cryptoMeta || {
          algorithm: 'AES-256-GCM',
          keyExchange: 'ECDH P-256',
        },
      };

      // Store in conversation thread
      const key = getConversationKey(authenticatedUsername, toUsername);
      const thread = conversationsMap.get(key) || [];
      thread.push(newMsg);
      conversationsMap.set(key, thread);

      // Route to recipient's room (Zero-Knowledge relay: Server does not decrypt)
      io.to(`user:${toUsername}`).emit('message:receive', newMsg);

      // Acknowledge back to sender
      socket.emit('message:sent_confirm', newMsg);
    }
  );

  // Real-time ECDH Public Key Handshake Exchange Relay
  // Security guarantee: Only public keys and fingerprints are ever relayed.
  // Private keys and derived AES keys are NEVER sent to or stored on this server.
  socket.on(
    'crypto:publish_public_key',
    (data: {
      publicKeyJwk: any;
      keyFingerprint: string;
    }) => {
      if (!authenticatedUsername) return;
      const user = usersMap.get(authenticatedUsername);
      if (user) {
        user.publicKeyJwk = data.publicKeyJwk;
        user.publicKeyFingerprint = data.keyFingerprint;
      }
      socket.emit('crypto:public_key_published', {
        username: authenticatedUsername,
        keyFingerprint: data.keyFingerprint,
      });
      // Broadcast updated user presence with public key readiness
      broadcastUserList();
    }
  );

  socket.on(
    'crypto:exchange_public_key',
    (data: {
      to: string;
      publicKeyJwk: any;
      keyFingerprint: string;
    }) => {
      if (!authenticatedUsername) return;
      const targetUser = data.to.trim().toLowerCase();

      // Store sender's public key in server cache
      const sender = usersMap.get(authenticatedUsername);
      if (sender) {
        sender.publicKeyJwk = data.publicKeyJwk;
        sender.publicKeyFingerprint = data.keyFingerprint;
      }

      // Relay the public key JWK directly to the target peer
      io.to(`user:${targetUser}`).emit('crypto:peer_public_key', {
        from: authenticatedUsername,
        publicKeyJwk: data.publicKeyJwk,
        keyFingerprint: data.keyFingerprint,
        timestamp: Date.now(),
      });

      // If server already has targetUser's public key, reply directly to sender as well
      const peer = usersMap.get(targetUser);
      if (peer && peer.publicKeyJwk) {
        socket.emit('crypto:peer_public_key', {
          from: targetUser,
          publicKeyJwk: peer.publicKeyJwk,
          keyFingerprint: peer.publicKeyFingerprint,
          timestamp: Date.now(),
        });
      }
    }
  );

  socket.on('crypto:request_peer_public_key', (data: { peerUsername: string }) => {
    if (!authenticatedUsername || !data.peerUsername) return;
    const targetUser = data.peerUsername.trim().toLowerCase();
    const peer = usersMap.get(targetUser);

    if (peer && peer.publicKeyJwk) {
      socket.emit('crypto:peer_public_key', {
        from: targetUser,
        publicKeyJwk: peer.publicKeyJwk,
        keyFingerprint: peer.publicKeyFingerprint,
        timestamp: Date.now(),
      });
    }

    // Notify the peer that someone is requesting their public key so they can publish or exchange
    io.to(`user:${targetUser}`).emit('crypto:key_requested_by_peer', {
      from: authenticatedUsername,
      timestamp: Date.now(),
    });
  });

  // Typing status indicator
  socket.on('typing:status', (data: { to: string; isTyping: boolean }) => {
    if (!authenticatedUsername) return;
    io.to(`user:${data.to.trim().toLowerCase()}`).emit('typing:status', {
      from: authenticatedUsername,
      isTyping: data.isTyping,
    });
  });

  // Client Disconnect Handling
  socket.on('disconnect', () => {
    if (authenticatedUsername) {
      const user = usersMap.get(authenticatedUsername);
      if (user && user.socketId === socket.id) {
        user.isOnline = false;
        user.socketId = null;
        user.lastSeen = Date.now();
        broadcastUserList();
      }
    }
  });
});

// Configure Vite middleware or serve static bundle
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`CipherChat Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
