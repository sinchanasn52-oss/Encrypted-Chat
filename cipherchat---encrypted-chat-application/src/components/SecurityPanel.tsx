import React, { useState } from 'react';
import { 
  Shield, 
  Key, 
  Wifi, 
  Lock, 
  Server, 
  Cpu, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Hash, 
  EyeOff, 
  Terminal, 
  Zap,
  CheckCheck,
  AlertCircle,
  ArrowDown,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Layers,
  Send,
  Radio
} from 'lucide-react';
import { User } from '../types/chat';
import { KeyExchangeSession } from '../crypto/types';
import { isWebCryptoSupported } from '../crypto/cryptoEngine';

interface SecurityPanelProps {
  currentUser: User | null;
  selectedContact: User | null;
  session: KeyExchangeSession | null;
  isConnected: boolean;
  lastAuthStatus?: 'passed' | 'failed' | 'none';
  onTriggerHandshake: () => void;
  onRegenerateKeys?: () => void;
  onOpenCryptoGuide?: () => void;
}

interface FlowStep {
  number: number;
  title: string;
  category: 'KEY_EXCHANGE' | 'KDF' | 'ENCRYPTION' | 'NETWORK' | 'DECRYPTION';
  explanation: string;
  badge: string;
}

const CRYPTO_FLOW_STEPS: FlowStep[] = [
  {
    number: 1,
    title: 'ECDH Public Key Exchange',
    category: 'KEY_EXCHANGE',
    explanation: 'Alice and Bob generate private/public key pairs on curve P-256 and swap public keys over WebSocket.',
    badge: 'NIST P-256',
  },
  {
    number: 2,
    title: 'Shared Secret',
    category: 'KEY_EXCHANGE',
    explanation: 'Each client multiplies their private key by the peer\'s public key (S = d · Q) to derive an identical 256-bit secret.',
    badge: '256 Bits',
  },
  {
    number: 3,
    title: 'HKDF-SHA-256',
    category: 'KDF',
    explanation: 'HMAC-based Key Derivation Function (RFC 5869) extracts and expands the raw shared secret with cryptographic salt.',
    badge: 'RFC 5869',
  },
  {
    number: 4,
    title: 'AES-256 Session Key',
    category: 'KDF',
    explanation: 'A symmetric 256-bit key is derived inside browser memory for encrypting and authenticating messages.',
    badge: 'AES-256 Key',
  },
  {
    number: 5,
    title: 'Plaintext Message',
    category: 'ENCRYPTION',
    explanation: 'The original chat message typed by the sender, retained strictly in local memory before encryption.',
    badge: 'Client Plaintext',
  },
  {
    number: 6,
    title: 'AES-256-GCM Encryption',
    category: 'ENCRYPTION',
    explanation: 'Galois/Counter Mode encrypts plaintext and calculates a 128-bit GHASH authentication tag for integrity.',
    badge: 'AEAD Cipher',
  },
  {
    number: 7,
    title: 'Ciphertext + IV + Authentication Tag',
    category: 'ENCRYPTION',
    explanation: 'The encrypted packet is packaged: ciphertext, a fresh 96-bit random IV, and the 128-bit auth tag.',
    badge: 'Encrypted Packet',
  },
  {
    number: 8,
    title: 'WebSocket Server',
    category: 'NETWORK',
    explanation: 'The Node.js server routes the encrypted packet as a zero-knowledge relay without decrypting or storing plaintext.',
    badge: 'Zero-Knowledge',
  },
  {
    number: 9,
    title: 'Receiver',
    category: 'NETWORK',
    explanation: 'The recipient\'s browser receives the encrypted packet over WebSocket.',
    badge: 'Peer Endpoint',
  },
  {
    number: 10,
    title: 'AES-GCM Authentication',
    category: 'DECRYPTION',
    explanation: 'The receiver\'s Web Crypto API verifies the 128-bit GHASH tag against the ciphertext using the derived key.',
    badge: 'Integrity Check',
  },
  {
    number: 11,
    title: 'Decryption',
    category: 'DECRYPTION',
    explanation: 'Only after the authentication tag is successfully verified, Counter Mode decrypts the ciphertext.',
    badge: 'CTR Decrypt',
  },
  {
    number: 12,
    title: 'Plaintext Message',
    category: 'DECRYPTION',
    explanation: 'The verified, authenticated message is safely displayed on the recipient\'s screen.',
    badge: 'Rendered Plaintext',
  },
];

export const SecurityPanel: React.FC<SecurityPanelProps> = ({
  currentUser,
  selectedContact,
  session,
  isConnected,
  lastAuthStatus = 'passed',
  onTriggerHandshake,
  onRegenerateKeys,
  onOpenCryptoGuide,
}) => {
  const [activeTab, setActiveTab] = useState<'STATUS' | 'GUIDE_FLOW'>('STATUS');
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const webCryptoActive = isWebCryptoSupported();

  const isReady = session?.status === 'READY';
  const isWaiting = session?.status === 'WAITING' || !session;
  const isDeriving = session?.status === 'DERIVING_KEY' || session?.status === 'EXCHANGING';
  const isError = session?.status === 'ERROR';

  return (
    <aside className="w-80 border-l border-slate-800 bg-slate-900/95 backdrop-blur-md flex flex-col h-full shrink-0 overflow-y-auto">
      {/* Panel Top Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
              Live Security & Guide
            </h3>
            <p className="text-[10px] text-slate-400">Web Crypto API Inspection</p>
          </div>
        </div>

        {onOpenCryptoGuide && (
          <button
            onClick={onOpenCryptoGuide}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-mono border border-slate-700 transition-colors"
            title="Open Complete Crypto Architecture Guide"
          >
            <BookOpen className="w-3 h-3 text-cyan-400" />
            <span>Guide</span>
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="grid grid-cols-2 p-1.5 gap-1 bg-slate-950/60 border-b border-slate-800/80 text-xs font-mono shrink-0">
        <button
          onClick={() => setActiveTab('STATUS')}
          className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            activeTab === 'STATUS'
              ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Live Security
        </button>
        <button
          onClick={() => setActiveTab('GUIDE_FLOW')}
          className={`py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
            activeTab === 'GUIDE_FLOW'
              ? 'bg-slate-800 text-cyan-300 shadow-sm border border-slate-700'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Crypto Flow (12 Steps)
        </button>
      </div>

      <div className="p-4 space-y-4 text-xs flex-1">
        {/* Error Handling Alert Banner */}
        {isError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 space-y-2">
            <div className="flex items-start gap-2 font-semibold text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>Key Agreement / Derivation Alert</span>
            </div>
            <p className="text-[11px] leading-relaxed text-rose-300/90 font-mono">
              {session?.error || 'Failed to complete ECDH key agreement or HKDF derivation.'}
            </p>
            <button
              onClick={onTriggerHandshake}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 text-xs font-medium transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry ECDH Handshake</span>
            </button>
          </div>
        )}

        {/* TAB 1: LIVE SECURITY STATUS */}
        {activeTab === 'STATUS' && (
          <div className="space-y-4 animate-in fade-in duration-150">
            {/* Live Security Dashboard Box (Exact Requirements) */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5 shadow-lg">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center justify-between pb-1 border-b border-slate-800/80">
                <span className="flex items-center gap-1.5 font-bold">
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  Live Security Status
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>

              {/* 1. ECDH Status */}
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-purple-400" />
                  ECDH:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    isReady
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : isDeriving
                      ? 'bg-cyan-950 text-cyan-300 border-cyan-800 animate-pulse'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}
                >
                  {isReady ? 'Ready' : isDeriving ? 'Exchanging...' : 'Waiting'}
                </span>
              </div>

              {/* 2. AES-256-GCM Status */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  AES-256-GCM:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    isReady
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {isReady ? 'Active' : 'Pending Key'}
                </span>
              </div>

              {/* 3. Authentication Status */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Authentication:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    lastAuthStatus === 'failed'
                      ? 'bg-rose-950 text-rose-300 border-rose-800'
                      : isReady
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {lastAuthStatus === 'failed' ? 'Failed' : isReady ? 'Passed' : 'Pending'}
                </span>
              </div>

              {/* 4. Server Status */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-400" />
                  Server:
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                    isConnected
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950 text-rose-300 border-rose-800'
                  }`}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* 5. Private Key Security Guarantee */}
              <div className="flex items-center justify-between py-1 border-t border-slate-800/60">
                <span className="text-slate-400 text-xs flex items-center gap-1.5">
                  <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                  Private Key:
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-800">
                  Stored locally
                </span>
              </div>
            </div>

            {/* Public Key Fingerprints Box (Never exposes private keys) */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-3 shadow-lg">
              <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-400 flex items-center justify-between pb-1 border-b border-slate-800/80">
                <span>Public Fingerprints</span>
                <Hash className="w-3.5 h-3.5 text-cyan-400" />
              </div>

              {/* Local User Public Key Fingerprint */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Key className="w-3 h-3 text-cyan-400" />
                    Your Public Key (P-256):
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">@{currentUser?.username}</span>
                </div>
                <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-[11px] text-cyan-300 break-all select-all flex items-center justify-between">
                  <span>{session?.localFingerprint || 'Generating P-256 Keypair...'}</span>
                  <CheckCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0 ml-1 opacity-70" />
                </div>
              </div>

              {/* Peer Public Key Fingerprint */}
              {selectedContact && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1">
                      <Key className="w-3 h-3 text-purple-400" />
                      Peer Public Key (P-256):
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">@{selectedContact.username}</span>
                  </div>
                  <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 font-mono text-[11px] text-purple-300 break-all select-all flex items-center justify-between">
                    <span>{session?.peerFingerprint || 'Waiting for peer public key...'}</span>
                    {session?.peerFingerprint && (
                      <CheckCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 ml-1 opacity-70" />
                    )}
                  </div>
                </div>
              )}

              {/* Derived AES Key Confirmation */}
              {isReady && session?.derivedKeyResult && (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 space-y-1 mt-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400">
                    <span className="font-semibold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      Derived AES-256 Confirmation:
                    </span>
                    <span>MATCH VERIFIED</span>
                  </div>
                  <div className="font-mono text-[11px] text-emerald-300 break-all select-all">
                    {session.derivedKeyResult.keyFingerprint}
                  </div>
                  <p className="text-[10px] text-emerald-400/80 leading-tight">
                    Derived from ECDH shared secret via HKDF-SHA256. Both clients hold identical keys without sharing secrets.
                  </p>
                </div>
              )}

              {/* Handshake Trigger Action Button */}
              {selectedContact && (
                <div className="pt-2 space-y-2">
                  <button
                    onClick={onTriggerHandshake}
                    disabled={isDeriving}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold transition-all text-xs shadow-md shadow-cyan-950/40 active:scale-95"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isDeriving ? 'animate-spin' : ''}`} />
                    <span>{isReady ? 'Re-Exchange ECDH Keys' : 'Exchange Public Keys (ECDH)'}</span>
                  </button>

                  {onRegenerateKeys && (
                    <button
                      onClick={onRegenerateKeys}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors border border-slate-700"
                      title="Generate new ephemeral keypair for Forward Secrecy"
                    >
                      <Key className="w-3 h-3 text-purple-400" />
                      <span>Generate New Ephemeral Keypair (PFS)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Zero-Knowledge Privacy Guarantee */}
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-1.5 text-slate-200 font-semibold">
                <EyeOff className="w-3.5 h-3.5 text-cyan-400" />
                <span>Zero-Knowledge Principle</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Private keys and symmetric keys <strong className="text-slate-200">never leave the client browser</strong>.
                The server only acts as a message router and does not inspect content.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE CRYPTO FLOW (12 STEPS WITH SHORT BEGINNER-FRIENDLY EXPLANATIONS) */}
        {activeTab === 'GUIDE_FLOW' && (
          <div className="space-y-2.5 animate-in fade-in duration-150">
            <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
              <span className="font-mono text-cyan-400 font-bold">12-Step Cryptographic Flow</span>
              <span className="text-[10px] text-slate-500 font-mono">Live Pipeline</span>
            </div>

            <div className="space-y-2 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-slate-800">
              {CRYPTO_FLOW_STEPS.map((step, idx) => {
                const isLast = idx === CRYPTO_FLOW_STEPS.length - 1;
                const isKeyStep = step.category === 'KEY_EXCHANGE' || step.category === 'KDF';
                const isCipherStep = step.category === 'ENCRYPTION' || step.category === 'DECRYPTION';

                return (
                  <div key={step.number} className="relative pl-7 text-xs">
                    {/* Circle Node */}
                    <div
                      className={`absolute left-1.5 top-1 -translate-x-1/2 w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-mono font-bold ${
                        isKeyStep
                          ? 'border-purple-500 bg-purple-950 text-purple-300'
                          : isCipherStep
                          ? 'border-cyan-500 bg-cyan-950 text-cyan-300'
                          : 'border-emerald-500 bg-emerald-950 text-emerald-300'
                      }`}
                    >
                      {step.number}
                    </div>

                    {/* Step Card */}
                    <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 shadow-sm hover:border-slate-700 transition-colors">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="font-bold text-slate-200 text-[11px]">{step.title}</h4>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800">
                          {step.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug">
                        {step.explanation}
                      </p>
                    </div>

                    {!isLast && (
                      <div className="flex justify-center -my-1 text-slate-700">
                        <ArrowDown className="w-3 h-3 text-slate-700" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
