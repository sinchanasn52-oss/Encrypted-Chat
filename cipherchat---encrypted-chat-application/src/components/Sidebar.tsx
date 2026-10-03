import React, { useState } from 'react';
import { Search, User as UserIcon, Shield, Radio, CheckCheck, Clock } from 'lucide-react';
import { User, ChatMessage } from '../types/chat';

interface SidebarProps {
  currentUser: User;
  users: User[];
  selectedContact: User | null;
  onSelectContact: (user: User) => void;
  recentMessagesMap: Map<string, ChatMessage>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  users,
  selectedContact,
  onSelectContact,
  recentMessagesMap,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'online'>('all');

  const filteredUsers = users
    .filter((u) => u.username.toLowerCase() !== currentUser.username.toLowerCase())
    .filter((u) => {
      const matchSearch =
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      if (filterMode === 'online') {
        return matchSearch && u.isOnline;
      }
      return matchSearch;
    });

  const formatTimestamp = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-72 sm:w-80 border-r border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-col h-full shrink-0">
      {/* Search & Filter Header */}
      <div className="p-3.5 border-b border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-slate-300">
              Peers & Contacts
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-cyan-400">
              {filteredUsers.length}
            </span>
          </div>

          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2 py-0.5 rounded-md transition-colors ${
                filterMode === 'all' ? 'bg-slate-800 text-slate-200 font-medium' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterMode('online')}
              className={`px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 ${
                filterMode === 'online' ? 'bg-emerald-950/80 text-emerald-400 font-medium' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Online
            </button>
          </div>
        </div>

        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
            <Search className="w-3.5 h-3.5" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search cryptography peers..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
          />
        </div>
      </div>

      {/* Contact List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            No contacts found matching filter.
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedContact?.username.toLowerCase() === user.username.toLowerCase();
            const recentMsg = recentMessagesMap.get(user.username.toLowerCase());

            return (
              <button
                key={user.id}
                onClick={() => onSelectContact(user)}
                className={`w-full p-2.5 rounded-xl transition-all flex items-start gap-3 text-left relative group ${
                  isSelected
                    ? 'bg-cyan-500/10 border border-cyan-500/30 shadow-sm'
                    : 'hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                {/* Avatar with live status pulse indicator */}
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${user.avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md shadow-slate-950/50`}
                  >
                    {user.displayName.charAt(0)}
                  </div>
                  {/* Status Indicator */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-slate-900 flex items-center justify-center ${
                      user.isOnline ? 'bg-emerald-500' : 'bg-slate-600'
                    }`}
                    title={user.isOnline ? 'Online' : 'Offline'}
                  >
                    {user.isOnline && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-200 animate-ping opacity-75" />
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300">
                      {user.displayName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-1">
                      {recentMsg ? formatTimestamp(recentMsg.timestamp) : ''}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 truncate mt-0.5">
                    {recentMsg ? (
                      <span className="text-slate-300">
                        {recentMsg.fromUsername.toLowerCase() === currentUser.username.toLowerCase() ? 'You: ' : ''}
                        {recentMsg.content}
                      </span>
                    ) : (
                      <span className="italic text-slate-500">{user.role}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {user.isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                    <span className="text-[9px] font-mono text-cyan-400/80">
                      ECDH P-256
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400 flex items-center justify-between font-mono">
        <span className="flex items-center gap-1 text-cyan-400">
          <Shield className="w-3 h-3" />
          AES-256-GCM
        </span>
        <span className="text-slate-500">Zero-Relay</span>
      </div>
    </aside>
  );
};
