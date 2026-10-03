import React, { useState } from 'react';
import { 
  X, 
  Shield, 
  Key, 
  Lock, 
  Server, 
  Cpu, 
  CheckCircle2, 
  ChevronRight, 
  FileText, 
  ArrowRight, 
  Zap, 
  Info,
  ArrowDown,
  Layers,
  BookOpen,
  CheckCheck,
  Send,
  EyeOff
} from 'lucide-react';
import { CRYPTO_VIVA_TOPICS } from '../crypto/vivaNotes';

interface CryptoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FlowStepInfo {
  number: number;
  title: string;
  category: string;
  badge: string;
  explanation: string;
  technicalDetails: string;
}

const FLOW_STEPS_GUIDE: FlowStepInfo[] = [
  {
    number: 1,
    title: 'ECDH Public Key Exchange',
    category: 'Key Agreement',
    badge: 'NIST P-256',
    explanation: 'Alice and Bob each generate a private and public key pair on the NIST P-256 elliptic curve using the browser Web Crypto API. Only the public keys are exchanged over the network.',
    technicalDetails: 'window.crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }). Private key never leaves the client.',
  },
  {
    number: 2,
    title: 'Shared Secret',
    category: 'Key Agreement',
    badge: '256 Bits',
    explanation: 'Alice multiplies her private key by Bob\'s public key, and Bob multiplies his private key by Alice\'s public key. Both arrive at the exact same 256-bit shared secret point.',
    technicalDetails: 'Mathematical guarantee: S = d_A · Q_B = d_A · (d_B · G) = d_B · (d_A · G) = d_B · Q_A.',
  },
  {
    number: 3,
    title: 'HKDF-SHA-256',
    category: 'Key Derivation',
    badge: 'RFC 5869',
    explanation: 'The raw shared secret is processed through HKDF (HMAC-based Key Derivation Function) with SHA-256 to extract high entropy and securely expand it.',
    technicalDetails: 'HKDF-Extract and HKDF-Expand with salt "CipherChat-ECDH-HKDF-Salt-P256-v1" and context info.',
  },
  {
    number: 4,
    title: 'AES-256 Session Key',
    category: 'Key Derivation',
    badge: '256-bit Symmetric Key',
    explanation: 'A symmetric 256-bit AES key is derived in browser memory. This key is identical on both devices, but was never sent across the internet!',
    technicalDetails: 'Imported as CryptoKey { name: "AES-GCM", length: 256 }. Non-extractable in production.',
  },
  {
    number: 5,
    title: 'Plaintext Message',
    category: 'Encryption',
    badge: 'Sender Memory',
    explanation: 'The original chat message typed by the sender, retained strictly in local client RAM before encryption.',
    technicalDetails: 'UTF-8 string encoded into Uint8Array buffer with TextEncoder.',
  },
  {
    number: 6,
    title: 'AES-256-GCM Encryption',
    category: 'Encryption',
    badge: 'AEAD Cipher',
    explanation: 'Galois/Counter Mode encrypts the plaintext and computes a 128-bit GHASH authentication tag in a single pass to provide confidentiality and integrity.',
    technicalDetails: 'window.crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 128 }, aesKey, plaintextBuffer).',
  },
  {
    number: 7,
    title: 'Ciphertext + IV + Authentication Tag',
    category: 'Encryption',
    badge: 'Encrypted Packet',
    explanation: 'The encrypted packet is packaged with scrambled ciphertext, a unique 96-bit random IV, and the 128-bit authentication tag.',
    technicalDetails: 'Fresh 12-byte CSPRNG IV generated per packet via crypto.getRandomValues().',
  },
  {
    number: 8,
    title: 'WebSocket Server',
    category: 'Network Relay',
    badge: 'Zero-Knowledge',
    explanation: 'The Node.js server routes the encrypted packet directly to the recipient. The server has no keys and cannot decrypt or read the message.',
    technicalDetails: 'Blind socket.io message routing. No decryption or key access exists server-side.',
  },
  {
    number: 9,
    title: 'Receiver',
    category: 'Reception',
    badge: 'Peer Browser',
    explanation: 'The recipient\'s browser receives the raw encrypted packet over WebSocket.',
    technicalDetails: 'Recipient verifies packet format and prepares locally derived AES session key.',
  },
  {
    number: 10,
    title: 'AES-GCM Authentication',
    category: 'Integrity Check',
    badge: '128-bit GHASH',
    explanation: 'Before decrypting, the recipient\'s Web Crypto API verifies the 128-bit authentication tag against the ciphertext using the derived key. If even 1 bit was altered, verification fails immediately.',
    technicalDetails: 'Galois field polynomial evaluation over GF(2^128). Throws OperationError on mismatch.',
  },
  {
    number: 11,
    title: 'Decryption',
    category: 'Decryption',
    badge: 'CTR Decrypt',
    explanation: 'Only after the authentication tag is verified, Counter Mode decrypts the ciphertext into original bytes.',
    technicalDetails: 'Plaintext is only released if authentication passes. Otherwise, packet is discarded.',
  },
  {
    number: 12,
    title: 'Plaintext Message',
    category: 'Output',
    badge: 'Rendered Message',
    explanation: 'The authenticated, authentic message is safely rendered on the recipient\'s screen.',
    technicalDetails: 'TextDecoder converts UTF-8 bytes back into readable message UI.',
  },
];

export const CryptoModal: React.FC<CryptoModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'FLOW_GUIDE' | 'VIVA_QA'>('FLOW_GUIDE');
  const [selectedTopicId, setSelectedTopicId] = useState<string>(CRYPTO_VIVA_TOPICS[0].id);

  if (!isOpen) return null;

  const currentTopic = CRYPTO_VIVA_TOPICS.find((t) => t.id === selectedTopicId) || CRYPTO_VIVA_TOPICS[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl shadow-cyan-950/50 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-100">
                  CipherChat Cryptographic Guide & Viva Notes
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                  College Mini Project
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Encrypted Chat Application using AES-GCM and ECDH Key Exchange
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Tab Bar */}
        <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-950 border-b border-slate-800 text-xs font-mono shrink-0">
          <button
            onClick={() => setActiveTab('FLOW_GUIDE')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'FLOW_GUIDE'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
            <span>Live Crypto Flow (12 Steps)</span>
          </button>

          <button
            onClick={() => setActiveTab('VIVA_QA')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'VIVA_QA'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            <span>Viva Questions & Q&A Defense</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: 12-STEP CRYPTO FLOW */}
          {activeTab === 'FLOW_GUIDE' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Summary Banner */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <div className="flex items-center justify-between text-cyan-400 font-mono font-bold text-xs uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4" />
                    Complete Cryptographic Pipeline (Sender to Receiver)
                  </span>
                  <span>AES-256-GCM + ECDH</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Follow each step below to understand how CipherChat achieves end-to-end confidentiality and message integrity using standard browser Web Crypto primitives without trusting the server.
                </p>
              </div>

              {/* Step-by-Step Flow List */}
              <div className="space-y-3 relative before:absolute before:inset-0 before:left-5 before:w-0.5 before:bg-slate-800">
                {FLOW_STEPS_GUIDE.map((step, idx) => {
                  const isLast = idx === FLOW_STEPS_GUIDE.length - 1;
                  return (
                    <div key={step.number} className="relative pl-11 text-xs">
                      {/* Step Circle Marker */}
                      <div className="absolute left-2.5 top-2.5 -translate-x-1/2 w-6 h-6 rounded-full bg-slate-900 border-2 border-cyan-500 flex items-center justify-center font-mono font-bold text-cyan-300 text-[10px] shadow-md shadow-cyan-950">
                        {step.number}
                      </div>

                      {/* Step Content Box */}
                      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 shadow-sm hover:border-slate-700 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-100 text-xs sm:text-sm flex items-center gap-2">
                            <span>{step.title}</span>
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              {step.category}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                              {step.badge}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-300 leading-relaxed">
                          {step.explanation}
                        </p>

                        <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800/80 font-mono text-[10px] text-cyan-400/90 break-words">
                          <strong className="text-slate-400">Technical Implementation:</strong> {step.technicalDetails}
                        </div>
                      </div>

                      {!isLast && (
                        <div className="flex justify-center -my-1 text-slate-700">
                          <ArrowDown className="w-3.5 h-3.5 text-slate-700" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: VIVA QUESTIONS & DEFENSE */}
          {activeTab === 'VIVA_QA' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Topic Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {CRYPTO_VIVA_TOPICS.map((topic) => {
                  const isSelected = topic.id === selectedTopicId;
                  return (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopicId(topic.id)}
                      className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-cyan-500/15 border-cyan-500/50 text-slate-100 shadow-md shadow-cyan-950/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400 font-bold">
                          {topic.category}
                        </span>
                        <ChevronRight className={`w-3.5 h-3.5 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
                      </div>
                      <div className="text-xs font-semibold leading-snug">{topic.title}</div>
                    </button>
                  );
                })}
              </div>

              {/* Active Topic Q&A Box */}
              <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="p-1 rounded-md bg-cyan-500/20 text-cyan-300">
                      <FileText className="w-4 h-4" />
                    </span>
                    <h4 className="text-sm font-bold text-slate-100">{currentTopic.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    Viva Question #{currentTopic.id}
                  </span>
                </div>

                <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-xs font-medium text-cyan-200 leading-relaxed">
                  <strong>Examiner Question:</strong> "{currentTopic.question}"
                </div>

                <div className="space-y-2 text-xs text-slate-300 leading-relaxed">
                  <div className="font-semibold text-slate-200 font-mono text-[11px] uppercase tracking-wider text-purple-400">
                    Detailed Cryptographic Defense:
                  </div>
                  <p className="whitespace-pre-line text-slate-300/90 leading-relaxed text-[11px] font-sans">
                    {currentTopic.answer}
                  </p>
                </div>

                {currentTopic.technicalDetails && currentTopic.technicalDetails.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold">
                      Key Technical Details to Mention:
                    </span>
                    <ul className="space-y-1 text-[11px] text-slate-300">
                      {currentTopic.technicalDetails.map((pt: string, i: number) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            College Mini Project: Cryptography & Network Security
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
