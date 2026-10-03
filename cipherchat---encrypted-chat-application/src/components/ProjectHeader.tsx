import React, { useState } from 'react';
import { Shield, Lock, Wifi, WifiOff, Users, SplitSquareVertical, BookOpen, LogOut, ChevronDown, Check, UserCheck } from 'lucide-react';
import { User } from '../types/chat';

interface ProjectHeaderProps {
  currentUser: User;
  onLogout: () => void;
  onSwitchUser: (username: string) => void;
  allUsers: User[];
  isConnected: boolean;
  onOpenCryptoGuide: () => void;
  isSplitView: boolean;
  onToggleSplitView: () => void;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  currentUser,
  onLogout,
  onSwitchUser,
  allUsers,
  isConnected,
  onOpenCryptoGuide,
  isSplitView,
  onToggleSplitView,
}) => {
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  return (
    <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-20 shrink-0">
      {/* Brand & Mini Project Title */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 text-white shadow-md shadow-cyan-900/40">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-100 tracking-tight flex items-center gap-1.5">
              CipherChat
            </h1>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
              AES-GCM + ECDH
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden md:block">
            College Cryptography Mini Project • Real-Time WebSocket Relay
          </p>
        </div>
      </div>

      {/* Action Controls & User Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Viva Guide Button */}
        <button
          onClick={onOpenCryptoGuide}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          title="Open Cryptography Architecture & Viva Guide"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Viva & Architecture</span>
        </button>

        {/* Dual Client Simulator Toggle */}
        <button
          onClick={onToggleSplitView}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
            isSplitView
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
              : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700'
          }`}
          title="Toggle Dual Client Simulator to test 2 users side-by-side in real-time"
        >
          <SplitSquareVertical className="w-3.5 h-3.5 text-purple-400" />
          <span className="hidden sm:inline">Dual Simulator</span>
        </button>

        {/* Connection Status Pill */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
            isConnected
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          {isConnected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="hidden md:inline">WS Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-rose-400" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* User Profile & Quick Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowSwitchMenu(!showSwitchMenu)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors"
          >
            <div
              className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${currentUser.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0`}
            >
              {currentUser.displayName.charAt(0)}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-semibold text-slate-200 leading-none truncate max-w-[120px]">
                {currentUser.displayName}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate max-w-[120px]">
                {currentUser.email}
              </div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* User Switch Dropdown */}
          {showSwitchMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs space-y-1">
              <div className="px-2.5 py-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-slate-800">
                Switch Identity (Mini Project Demo)
              </div>
              {allUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    onSwitchUser(u.username);
                    setShowSwitchMenu(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left ${
                    currentUser.username.toLowerCase() === u.username.toLowerCase()
                      ? 'bg-cyan-500/15 text-cyan-300 font-medium'
                      : 'hover:bg-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <div
                      className={`w-6 h-6 rounded-md bg-gradient-to-tr ${u.avatarColor} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}
                    >
                      {u.displayName.charAt(0)}
                    </div>
                    <div className="truncate">
                      <div className="truncate font-medium">{u.displayName}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{u.email}</div>
                    </div>
                  </div>
                  {currentUser.username.toLowerCase() === u.username.toLowerCase() && (
                    <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  )}
                </button>
              ))}

              <div className="border-t border-slate-800 pt-1 mt-1">
                <button
                  onClick={() => {
                    setShowSwitchMenu(false);
                    onLogout();
                  }}
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
