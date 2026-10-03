import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Lock, 
  Shield, 
  Check, 
  CheckCheck, 
  Clock, 
  Key, 
  Info, 
  Terminal, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Hash, 
  Radio
} from 'lucide-react';
import { User, ChatMessage, WireTamperAudit } from '../types/chat';
import { KeyExchangeSession } from '../crypto/types';

interface ChatAreaProps {
  currentUser: User;
  selectedContact: User | null;
  messages: ChatMessage[];
  session?: KeyExchangeSession | null;
  onSendMessage: (content: string) => void;
  onTamperMessage?: (msgId: string) => void;
  onSimulateWireTamper?: (customText?: string) => void;
  onViewTamperAudit?: (audit: WireTamperAudit, senderName?: string, recipientName?: string) => void;
  isPeerTyping: boolean;
  onTyping: (isTyping: boolean) => void;
  onOpenCryptoDetails?: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  currentUser,
  selectedContact,
  messages,
  session,
  onSendMessage,
  onTamperMessage,
  onSimulateWireTamper,
  onViewTamperAudit,
  isPeerTyping,
  onTyping,
  onOpenCryptoDetails,
}) => {
  const [inputText, setInputText] = useState('');
  const [inspectMessageId, setInspectMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPeerTyping]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean || !selectedContact) return;

    onSendMessage(clean);
    setInputText('');
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isKeyReady = session?.status === 'READY';

  const quickPrompts = [
    'Testing AES-256-GCM authenticated message encryption.',
    'Verifying 96-bit random IV generation per packet.',
    'Confirming server cannot decrypt payload (zero-knowledge).',
  ];

  if (!selectedContact) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 text-center">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-cyan-400 mb-4 shadow-xl">
          <Shield className="w-12 h-12 stroke-[1.5]" />
        </div>
        <h2 className="text-xl font-bold text-slate-200">Welcome to CipherChat</h2>
        <p className="text-xs text-slate-400 max-w-sm mt-1 mb-6">
          Encrypted Chat Application using AES-GCM and ECDH Key Exchange.
          Select a peer from the sidebar to establish an authenticated session.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300">
          <Lock className="w-3.5 h-3.5" />
          <span>Real-time WebSocket Relay Ready</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative">
      {/* Contact Header */}
      <div className="h-16 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${selectedContact.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md`}
            >
              {selectedContact.displayName.charAt(0)}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 ${
                selectedContact.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">{selectedContact.displayName}</h2>
              <span className="text-[10px] font-mono text-slate-400">@{selectedContact.username}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`inline-flex items-center gap-1 ${selectedContact.isOnline ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${selectedContact.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                {selectedContact.isOnline ? 'Online' : 'Offline'}
              </span>
              <span>•</span>
              <span className={`text-[11px] font-mono flex items-center gap-1 ${
                isKeyReady ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                <Key className="w-3 h-3" />
                {isKeyReady ? 'ECDH Key Ready (AES-256)' : 'ECDH: Waiting for Peer'}
              </span>
            </div>
          </div>
        </div>

        {/* Security Quick Badge & End-to-End Encrypted Session Indicator */}
        <div className="flex items-center gap-2">
          {/* UI Indicator: End-to-End Encrypted Session (Requirement 9) */}
          {isKeyReady ? (
            <div className="px-3 py-1.5 rounded-xl text-xs font-mono font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 flex items-center gap-2 shadow-sm shadow-emerald-950/50">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">End-to-End Encrypted Session</span>
              <span className="sm:hidden">E2EE Active</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-xl text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-500/30 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="hidden sm:inline">Negotiating Keys (ECDH)</span>
            </div>
          )}

          <button
            onClick={onOpenCryptoDetails}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
            title="Inspect Cryptography Specs"
          >
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline">AES-256-GCM</span>
          </button>
        </div>
      </div>

      {/* Security Status Banner */}
      <div className="px-4 py-2 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-purple-950/40 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <Shield className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span className="truncate">
            {isKeyReady ? (
              <span>
                <strong className="text-emerald-400">End-to-End Encrypted Session:</strong> Messages encrypted locally using AES-256-GCM with fresh 96-bit IVs. Only encrypted packets are routed by the server.
              </span>
            ) : (
              <span>
                <strong className="text-cyan-300">College Mini Project:</strong> Performing ECDH P-256 public key agreement over WebSocket. Awaiting peer key to derive AES-256 key.
              </span>
            )}
          </span>
        </div>
        <span className="hidden md:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-cyan-300 border border-slate-800 shrink-0">
          Zero-Knowledge Relay
        </span>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 space-y-2">
            <Lock className="w-8 h-8 text-slate-700" />
            <p className="text-xs">No previous messages with {selectedContact.displayName}.</p>
            <p className="text-[11px] text-slate-600 max-w-xs">
              Say hello or test client-side AES-256-GCM encryption using the input below.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.fromUsername.toLowerCase() === currentUser.username.toLowerCase();
            const isInspecting = inspectMessageId === msg.id;
            const isAuthFailed = msg.decryptionStatus === 'failed';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} space-y-1`}
              >
                {/* Sender tag for incoming */}
                {!isMe && (
                  <span className="text-[10px] font-semibold text-slate-400 px-1">
                    {selectedContact.displayName}
                  </span>
                )}

                {/* Message Bubble or Security Warning on Authentication Failure (Requirement 6, 7, 8, 9, 10) */}
                {isAuthFailed ? (
                  <div className="max-w-[95%] sm:max-w-md rounded-2xl p-4 bg-rose-950/90 border-2 border-rose-500/80 text-rose-200 shadow-2xl shadow-rose-950/60 space-y-3 animate-in fade-in duration-200">
                    {/* Header: Requirement 7 */}
                    <div className="flex items-center justify-between text-rose-300 font-bold text-xs pb-2 border-b border-rose-900/60">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 animate-pulse" />
                        <span>Tampering detected — AES-GCM authentication failed.</span>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-900 text-rose-200 border border-rose-700">
                        REJECTED
                      </span>
                    </div>

                    {/* Visible Explanation: Requirement 9 */}
                    <div className="p-3 rounded-xl bg-rose-950 border border-rose-800 text-[11px] font-mono leading-relaxed space-y-1">
                      <p className="font-semibold text-rose-100">
                        "A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail."
                      </p>
                      <p className="text-[10px] text-rose-300/80">
                        Authentication Result: <strong>FAILED (128-bit GHASH Tag Mismatch)</strong>. Plaintext rejected and discarded.
                      </p>
                    </div>

                    {/* Demonstration Disclaimer & Audit Button: Requirement 10 */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[10px] text-rose-300/80 pt-1 border-t border-rose-900/40">
                      <span className="italic">Simulated demonstration (not a real attack)</span>
                      {msg.wireTamperAudit && onViewTamperAudit && (
                        <button
                          type="button"
                          onClick={() => onViewTamperAudit(msg.wireTamperAudit!, msg.fromUsername, msg.toUsername)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-500/50 font-mono text-[10px] font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Terminal className="w-3 h-3 text-rose-300" />
                          <span>View Tampering Audit & Bit Difference</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] sm:max-w-md rounded-2xl p-3.5 text-xs sm:text-sm relative group shadow-lg ${
                      isMe
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none shadow-cyan-950/40'
                        : 'bg-slate-800/90 text-slate-100 rounded-bl-none border border-slate-700/60 shadow-slate-950/50'
                    }`}
                  >
                    <p className="leading-relaxed break-words whitespace-pre-wrap">{msg.content}</p>

                    {/* Metadata Bar */}
                    <div
                      className={`flex items-center justify-between gap-3 text-[10px] font-mono mt-2 pt-1 border-t ${
                        isMe ? 'border-cyan-400/30 text-cyan-100' : 'border-slate-700 text-slate-400'
                      }`}
                    >
                      <span className="flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        <span>{msg.isEncrypted ? 'AES-256-GCM (Authenticated)' : 'Unencrypted'}</span>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {isMe && (
                          <span title="Delivered via WebSocket">
                            <CheckCheck className="w-3 h-3 text-cyan-200" />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Requirement 10: Inspect Option */}
                    <button
                      onClick={() => setInspectMessageId(isInspecting ? null : msg.id)}
                      className={`absolute -bottom-2 ${isMe ? 'left-2' : 'right-2'} opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded text-[9px] font-mono bg-slate-950 text-cyan-300 border border-slate-800 shadow flex items-center gap-1`}
                      title="Inspect encrypted ciphertext and IV"
                    >
                      <Terminal className="w-2.5 h-2.5" />
                      <span>{isInspecting ? 'Hide Packet' : 'Inspect Ciphertext & IV'}</span>
                    </button>
                  </div>
                )}

                {/* Expandable Packet Inspector Drawer (Requirement 10) */}
                {isInspecting && (
                  <div className="w-full max-w-lg p-3.5 rounded-xl bg-slate-950 border border-cyan-500/40 font-mono text-[10px] text-cyan-300 space-y-2 animate-in fade-in duration-150 shadow-2xl">
                    <div className="flex items-center justify-between text-slate-400 pb-1.5 border-b border-slate-800">
                      <span className="flex items-center gap-1.5 text-cyan-400 font-bold">
                        <Terminal className="w-3.5 h-3.5" />
                        Encrypted Packet Inspector (AES-256-GCM)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[9px]">
                        ZERO-KNOWLEDGE
                      </span>
                    </div>

                    <div>
                      <strong className="text-slate-400">Packet ID:</strong> {msg.id}
                    </div>
                    <div>
                      <strong className="text-slate-400">Routing Path:</strong> {msg.fromUsername} ➔ {msg.toUsername} (WebSocket Relay)
                    </div>

                    {/* Ciphertext Hex */}
                    <div className="space-y-0.5">
                      <strong className="text-slate-400 flex items-center gap-1">
                        <Hash className="w-3 h-3 text-cyan-400" />
                        Ciphertext Payload (Hex):
                      </strong>
                      <div className="bg-slate-900 p-2 rounded border border-slate-800 text-slate-300 break-all select-all max-h-20 overflow-y-auto">
                        {msg.ciphertext || 'N/A (Historical/Unencrypted)'}
                      </div>
                    </div>

                    {/* Fresh 96-bit IV */}
                    <div className="space-y-0.5">
                      <strong className="text-slate-400 flex items-center gap-1">
                        <Key className="w-3 h-3 text-purple-400" />
                        Fresh 96-bit IV / Nonce (Hex):
                      </strong>
                      <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-purple-300 break-all select-all">
                        {msg.iv || msg.cryptoMeta?.iv || 'N/A'}
                      </div>
                    </div>

                    {/* 128-bit Authentication Tag */}
                    <div className="space-y-0.5">
                      <strong className="text-slate-400 flex items-center gap-1">
                        <Shield className="w-3 h-3 text-emerald-400" />
                        128-bit GHASH Authentication Tag (Hex):
                      </strong>
                      <div className="bg-slate-900 p-1.5 rounded border border-slate-800 text-emerald-300 break-all select-all">
                        {msg.authTag || msg.cryptoMeta?.authTag || (msg.ciphertext ? msg.ciphertext.slice(-32) : 'N/A')}
                      </div>
                    </div>

                    {/* Privacy Guarantee Note */}
                    <div className="p-2 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400 flex items-start gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>
                        <strong className="text-slate-200">Security Guarantee:</strong> Private keys and derived AES keys are never exported or displayed. The server routed only the raw ciphertext and IV above.
                      </span>
                    </div>

                    {/* Demonstration Button: Tamper Ciphertext to test Requirement 8 */}
                    {onTamperMessage && msg.ciphertext && !isAuthFailed && (
                      <div className="pt-1 border-t border-slate-800/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Mini Project Viva Test:</span>
                        <button
                          type="button"
                          onClick={() => onTamperMessage(msg.id)}
                          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-semibold transition-colors flex items-center gap-1"
                          title="Simulate ciphertext corruption to test AES-GCM AEAD authentication rejection"
                        >
                          <AlertTriangle className="w-3 h-3 text-rose-400" />
                          <span>Simulate Tamper (Test Tag Rejection)</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {isPeerTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 italic py-1 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>{selectedContact.displayName} is typing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Demonstration Prompts & Tamper Simulator Trigger */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-900/40 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-cyan-400" /> Demo Prompts:
          </span>
          {quickPrompts.map((prompt, i) => (
            <button
              key={i}
              onClick={() => setInputText(prompt)}
              className="px-2.5 py-1 rounded-lg bg-slate-800/70 hover:bg-slate-700/70 text-slate-300 text-[11px] border border-slate-700 whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Feature: "Simulate Wire Tamper" Quick Button */}
        {onSimulateWireTamper && isKeyReady && (
          <button
            type="button"
            onClick={() => onSimulateWireTamper(inputText || 'College Cryptography Project Test: Confidential Wire Packet')}
            className="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-[11px] font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            title="Simulate Wire Tamper: Modifies 1 bit in ciphertext on the wire, showing immediate AEAD rejection"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>Simulate Wire Tamper</span>
          </button>
        )}
      </div>

      {/* Message Input Box */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-900/80 backdrop-blur-md shrink-0">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isKeyReady
                  ? `Send AES-256-GCM encrypted message to ${selectedContact.displayName}...`
                  : `Waiting for ECDH key agreement with ${selectedContact.displayName}...`
              }
              className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors shadow-inner"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
              <Lock className={`w-4 h-4 ${isKeyReady ? 'text-emerald-400' : 'text-amber-500/70'}`} />
            </div>
          </div>

          {/* Action 1: Simulate Wire Tamper Button (Requirement 1) */}
          {onSimulateWireTamper && isKeyReady && (
            <button
              type="button"
              onClick={() => onSimulateWireTamper(inputText || 'College Cryptography Mini Project: Confidential Wire Packet')}
              className="px-3.5 py-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 active:scale-95 shadow-lg shadow-rose-950/40"
              title="Simulate Wire Tamper: Intentionally inverts 1 bit of ciphertext before transmission to verify AES-GCM rejection"
            >
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="hidden md:inline">Simulate Wire Tamper</span>
            </button>
          )}

          {/* Action 2: Send Message Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className={`p-3 rounded-xl font-bold transition-all shadow-lg flex items-center justify-center shrink-0 active:scale-95 ${
              isKeyReady
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-950/50'
                : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-950/50'
            } disabled:opacity-40`}
            title="Send Message (Enter)"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
