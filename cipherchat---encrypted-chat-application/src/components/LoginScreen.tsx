import React, { useState } from 'react';
import { Shield, Lock, Key, ArrowRight, UserCheck, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { User } from '../types/chat';

interface LoginScreenProps {
  onLogin: (username: string, email?: string, displayName?: string) => void;
  availableUsers: User[];
  defaultUserEmail?: string;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  availableUsers,
  defaultUserEmail = 'supriyamreddy07@gmail.com',
}) => {
  const [usernameInput, setUsernameInput] = useState('');
  const [customEmail, setCustomEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = usernameInput.trim();
    if (!clean) {
      setError('Please enter a username or select a demo identity below');
      return;
    }
    if (clean.length < 2) {
      setError('Username must be at least 2 characters long');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
      setError('Username can only contain alphanumeric characters, underscores, and hyphens');
      return;
    }
    setError(null);
    onLogin(clean, customEmail || undefined, clean);
  };

  const handleQuickLogin = (user: User) => {
    onLogin(user.username, user.email, user.displayName);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient glow effects */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b08_1px,transparent_1px),linear-gradient(to_bottom,#1e293b08_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl z-10 space-y-6">
        {/* Project Branding Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-medium shadow-lg shadow-cyan-950/50">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>COLLEGE CRYPTOGRAPHY MINI PROJECT</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight flex items-center justify-center gap-3">
            <span>CipherChat</span>
            <span className="text-xs px-2.5 py-1 rounded-md bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/30 font-mono font-normal">
              v1.0 (Relay)
            </span>
          </h1>

          <p className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
            Encrypted Chat Application using{' '}
            <span className="text-slate-200 font-semibold">AES-GCM</span> and{' '}
            <span className="text-slate-200 font-semibold">ECDH Key Exchange</span> over WebSockets
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Prominent Quick Access for Original User Account */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 to-slate-900 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                Original Account (Project Lead)
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                1-Click Login
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-100 text-sm">Supriya Reddy</div>
                <div className="text-xs text-slate-400 font-mono">{defaultUserEmail}</div>
              </div>
              <button
                type="button"
                onClick={() => onLogin('supriya', defaultUserEmail, 'Supriya Reddy')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20 active:scale-95"
              >
                <span>Sign In as Supriya</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Custom Username Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Or Enter Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Key className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={usernameInput}
                  onChange={(e) => {
                    setUsernameInput(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. alice, bob, or your name"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                />
              </div>
              {error && (
                <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-sm border border-slate-700 transition-all active:scale-[0.99]"
            >
              <span>Connect to CipherChat Server</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Demo Users Section */}
          <div className="space-y-3 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400">
                Demo Cryptography Identities
              </span>
              <span className="text-[11px]">Click to simulate peer</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {availableUsers
                .filter((u) => u.username !== 'supriya')
                .map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => handleQuickLogin(user)}
                    className="p-2.5 rounded-xl bg-slate-950/70 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 transition-all text-left group flex items-center gap-2.5"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${user.avatarColor} flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm`}
                    >
                      {user.displayName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-200 group-hover:text-cyan-300 truncate">
                        {user.displayName.split(' ')[0]}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{user.email}</div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>

        {/* Security & Cryptography Mini Project Badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-cyan-400" />
            <span>AES-256-GCM Ready</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            <span>ECDH P-256 Key Exchange</span>
          </div>
          <span className="text-slate-700">•</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Zero-Knowledge Relay Server</span>
          </div>
        </div>
      </div>
    </div>
  );
};
