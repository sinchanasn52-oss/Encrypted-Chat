import { io, Socket } from 'socket.io-client';
import { ChatMessage, User } from '../types/chat';

class SocketService {
  private socket: Socket | null = null;
  private currentUsername: string | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  public isConnected: boolean = false;

  public connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (!this.socket) {
      // Connect to the current origin (Express serves both Vite and Socket.IO on port 3000)
      this.socket = io(typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.emitLocal('connection:change', true);
        if (this.currentUsername) {
          this.login(this.currentUsername);
        }
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emitLocal('connection:change', false);
      });

      this.socket.on('users:list', (users: User[]) => {
        this.emitLocal('users:list', users);
      });

      this.socket.on('user:login_success', (user: User) => {
        this.emitLocal('user:login_success', user);
      });

      this.socket.on('message:receive', (msg: ChatMessage) => {
        this.emitLocal('message:receive', msg);
      });

      this.socket.on('message:sent_confirm', (msg: ChatMessage) => {
        this.emitLocal('message:sent_confirm', msg);
      });

      this.socket.on('messages:history', (data: { withUser: string; messages: ChatMessage[] }) => {
        this.emitLocal('messages:history', data);
      });

      this.socket.on('typing:status', (data: { from: string; isTyping: boolean }) => {
        this.emitLocal('typing:status', data);
      });

      this.socket.on('crypto:peer_public_key', (data: any) => {
        this.emitLocal('crypto:peer_public_key', data);
      });

      this.socket.on('crypto:public_key_published', (data: any) => {
        this.emitLocal('crypto:public_key_published', data);
      });

      this.socket.on('crypto:key_requested_by_peer', (data: any) => {
        this.emitLocal('crypto:key_requested_by_peer', data);
      });
    }

    return this.socket;
  }

  public publishPublicKey(publicKeyJwk: any, keyFingerprint: string) {
    if (!this.socket) return;
    this.socket.emit('crypto:publish_public_key', {
      publicKeyJwk,
      keyFingerprint,
    });
  }

  public requestPeerPublicKey(peerUsername: string) {
    if (!this.socket) return;
    this.socket.emit('crypto:request_peer_public_key', { peerUsername });
  }

  public login(username: string, email?: string, displayName?: string) {
    this.currentUsername = username.toLowerCase();
    const s = this.connect();
    s.emit('user:login', { username, email, displayName });
  }

  public sendMessage(to: string, content: string, isEncrypted = false, cryptoMeta?: any) {
    if (!this.socket) return;
    this.socket.emit('message:send', {
      to,
      content,
      isEncrypted,
      cryptoMeta,
    });
  }

  public sendEncryptedMessage(packet: {
    id?: string;
    to: string;
    ciphertext: string;
    iv: string;
    cryptoMeta?: any;
  }) {
    if (!this.socket) return;
    this.socket.emit('message:send', {
      id: packet.id,
      to: packet.to,
      ciphertext: packet.ciphertext,
      iv: packet.iv,
      isEncrypted: true,
      cryptoMeta: packet.cryptoMeta,
    });
  }

  public fetchHistory(withUser: string) {
    if (!this.socket) return;
    this.socket.emit('messages:get_history', { withUser });
  }

  public sendTypingStatus(to: string, isTyping: boolean) {
    if (!this.socket) return;
    this.socket.emit('typing:status', { to, isTyping });
  }

  public sendPublicKeyHandshake(to: string, publicKeyJwk: any, keyFingerprint: string) {
    if (!this.socket) return;
    this.socket.emit('crypto:exchange_public_key', {
      to,
      publicKeyJwk,
      keyFingerprint,
    });
  }

  public on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emitLocal(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((fn) => fn(data));
    }
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentUsername = null;
    }
  }
}

export const socketService = new SocketService();
