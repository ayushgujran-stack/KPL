'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Lock, User, ArrowRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(username, password);
    setLoading(false);

    if (res.success) {
      if (res.user?.role === 'captain') {
        router.push('/captain');
      } else if (res.user?.role === 'super_admin') {
        router.push('/admin');
      } else {
        router.push('/auction/live');
      }
    } else {
      setError(res.error || 'Invalid credentials');
    }
  };

  const setCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#101827] flex items-center justify-center p-4 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(245,185,66,0.08),transparent_50%)] pointer-events-none" />

      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5B942] to-[#D9981B] text-[#101827] shadow-xl shadow-[#F5B942]/20 mb-3">
            <Trophy className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase tracking-wider">KPL Auction Access</h1>
          <p className="text-xs text-[#94A3B8] mt-1">Sign in with your role-based credentials</p>
        </div>

        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
          {error && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-rose-300 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin, captain_mt"
                  className="w-full bg-[#182438] border border-[#334155] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942] focus:ring-1 focus:ring-[#F5B942] transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#CBD5E1] uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#182438] border border-[#334155] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942] focus:ring-1 focus:ring-[#F5B942] transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-sm uppercase tracking-wider shadow-lg shadow-[#F5B942]/20 transition flex items-center justify-center gap-2 disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Credential Helpers */}
          <div className="mt-8 pt-6 border-t border-[#334155]">
            <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-3 text-center">
              Quick Fill Role Credentials
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <button
                type="button"
                onClick={() => setCredentials('admin', 'admin123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#F5B942]">Super Admin</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">admin / admin123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('organiser1', 'org123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#a855f7]">Organiser 1</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">organiser1 / org123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('organiser2', 'org123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#c084fc]">Organiser 2</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">organiser2 / org123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('captain_mt', 'cap123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#60a5fa]">Captain Mumbai</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">captain_mt / cap123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('captain_css', 'cap123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#FFD66B]">Captain Chennai</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">captain_css / cap123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('captain_rc', 'cap123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition"
              >
                <div className="font-extrabold text-[#ef4444]">Captain Bangalore</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">captain_rc / cap123</div>
              </button>

              <button
                type="button"
                onClick={() => setCredentials('captain_kk', 'cap123')}
                className="p-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition col-span-2 sm:col-span-1"
              >
                <div className="font-extrabold text-[#a855f7]">Captain Kolkata</div>
                <div className="text-[10px] text-[#94A3B8] font-mono mt-0.5">captain_kk / cap123</div>
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/auction/live"
              className="text-xs text-[#94A3B8] hover:text-[#FFD66B] transition font-medium"
            >
              Continue as <strong className="text-white font-bold">Public Viewer</strong> without login →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
