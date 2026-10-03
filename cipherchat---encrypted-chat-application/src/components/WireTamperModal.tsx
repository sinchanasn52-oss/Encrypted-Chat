import React from 'react';
import { ShieldAlert, X, AlertTriangle, CheckCircle2, ArrowRight, Lock, Key, Hash, Info, FileText } from 'lucide-react';
import { WireTamperAudit } from '../types/chat';

interface WireTamperModalProps {
  isOpen: boolean;
  onClose: () => void;
  audit: WireTamperAudit | null;
  senderName?: string;
  recipientName?: string;
}

export const WireTamperModal: React.FC<WireTamperModalProps> = ({
  isOpen,
  onClose,
  audit,
  senderName = 'Alice',
  recipientName = 'Bob',
}) => {
  if (!isOpen || !audit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border-2 border-rose-500/50 rounded-2xl w-full max-w-3xl shadow-2xl shadow-rose-950/60 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-rose-500/30 bg-gradient-to-r from-rose-950/60 via-slate-900 to-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-slate-100">
                  Tampering detected — AES-GCM authentication failed.
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                  STATUS: REJECTED
                </span>
              </div>
              <p className="text-xs text-rose-300/80 font-mono mt-0.5">
                Controlled Cryptography Mini Project Simulation
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

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {/* Simulation Disclaimer Notice */}
          <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <strong className="text-amber-300 font-semibold block">Demonstration Notice:</strong>
              {audit.simulatedDemoNote ||
                'This is a controlled college cryptography demonstration and NOT a real network attack. It verifies how browser Web Crypto API rejects tampered packets.'}
            </div>
          </div>

          {/* Mathematical & Cryptographic Explanation */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-400 font-mono uppercase tracking-wider">
              <Lock className="w-3.5 h-3.5" />
              <span>Cryptographic Integrity Principle</span>
            </div>
            <p className="text-sm font-semibold text-slate-100 leading-snug">
              "{audit.explanation || 'A single-bit modification of authenticated ciphertext causes AES-GCM verification to fail.'}"
            </p>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              AES-GCM combines Counter Mode encryption with a Galois Field multiplier (GHASH) over GF(2<sup>128</sup>).
              Unlike legacy CBC mode, every single bit of ciphertext is bound to the 128-bit authentication tag.
              Modifying even 1 bit causes the tag calculation to diverge completely, causing Web Crypto API to reject the packet before any plaintext is released.
            </p>
          </div>

          {/* Ciphertext Comparison (Original vs Tampered) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono">
            {/* Original Ciphertext */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 text-[11px]">
                <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Original Ciphertext (Alice)
                </span>
                <span className="text-[10px] text-slate-500">Untampered</span>
              </div>
              <div className="text-[11px] text-slate-300 break-all select-all bg-slate-900/80 p-2.5 rounded border border-slate-800/80 max-h-24 overflow-y-auto leading-relaxed">
                {audit.originalCiphertextHex}
              </div>
              <div className="text-[10px] text-slate-500">
                Encrypted with AES-256-GCM using derived session key.
              </div>
            </div>

            {/* Tampered Ciphertext */}
            <div className="bg-rose-950/20 p-3.5 rounded-xl border border-rose-500/30 space-y-2">
              <div className="flex items-center justify-between text-rose-300 pb-1 border-b border-rose-900/60 text-[11px]">
                <span className="flex items-center gap-1 text-rose-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Tampered Ciphertext (On the Wire)
                </span>
                <span className="text-[10px] text-rose-400 font-bold">1 Bit Flipped</span>
              </div>
              <div className="text-[11px] text-rose-200 break-all select-all bg-rose-950/60 p-2.5 rounded border border-rose-900/80 max-h-24 overflow-y-auto leading-relaxed">
                {audit.tamperedCiphertextHex}
              </div>
              <div className="text-[10px] text-rose-300 font-semibold">
                {audit.flippedBitDescription}
              </div>
            </div>
          </div>

          {/* Audit Verification Table */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 divide-y divide-slate-800 text-xs font-mono">
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400">Target Peer (Recipient):</span>
              <span className="text-slate-200 font-semibold">@{recipientName}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400">Plaintext Modification:</span>
              <span className="text-emerald-400">None (Plaintext was untouched)</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400">AES-256 Key Modification:</span>
              <span className="text-emerald-400">None (AES key was untouched)</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400">Authentication Result:</span>
              <span className="text-rose-400 font-bold">{audit.authenticationResult}</span>
            </div>
            <div className="p-3 flex items-center justify-between">
              <span className="text-slate-400">Packet Status:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                {audit.packetStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            Verified by native Web Crypto API (<code className="text-cyan-400">crypto.subtle.decrypt</code>)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs transition-colors"
          >
            Close Audit
          </button>
        </div>
      </div>
    </div>
  );
};
