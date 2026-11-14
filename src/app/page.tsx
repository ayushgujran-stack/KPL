'use client';

import React from 'react';
import Link from 'next/link';
import { useAuction } from '@/context/AuctionContext';
import { useAuth } from '@/context/AuthContext';
import { Trophy, Radio, Tv, Shuffle, Users, Shield, FileText, Database, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function HomePage() {
  const { state } = useAuction();
  const { user, login } = useAuth();

  const handleQuickLogin = async (username: string, pass: string) => {
    await login(username, pass);
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] bg-[#101827] flex flex-col justify-between overflow-hidden">
      {/* Stadium Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,185,66,0.1),rgba(16,24,39,0))] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-[#182438]/50 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 w-full">
        {/* Tournament Hero */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F5B942]/15 border border-[#F5B942]/35 text-[#F5B942] text-xs font-black uppercase tracking-wider mb-4 shadow-sm">
            <Trophy className="w-3.5 h-3.5 fill-current" />
            Premier Cricket League 2026 Season
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase">
            Cricket Player <span className="bg-gradient-to-r from-[#F5B942] via-[#FFD66B] to-[#F5B942] bg-clip-text text-transparent">Auction System</span>
          </h1>
          <p className="mt-4 text-[#CBD5E1] text-base sm:text-lg leading-relaxed font-medium">
            Professional real-time player auction platform with automated random draw, live atomic bidding, captain budget management, and instant multi-screen sync.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/auction/live"
              className="px-7 py-3.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-sm uppercase tracking-wider shadow-lg shadow-[#F5B942]/20 flex items-center gap-2 transition transform hover:-translate-y-0.5"
            >
              <Radio className="w-4 h-4" />
              Enter Live Auction
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/projector"
              target="_blank"
              className="px-7 py-3.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white font-bold text-sm uppercase tracking-wider border border-[#475569] flex items-center gap-2 transition"
            >
              <Tv className="w-4 h-4 text-[#22c55e]" />
              Open Projector Display
            </Link>
          </div>
        </div>

        {/* Live Tournament Status & Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] text-center shadow-lg">
            <div className="text-3xl sm:text-4xl font-black text-white font-mono">{state?.totalPlayers ?? 36}</div>
            <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mt-1.5">Total Pool</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] text-center shadow-lg">
            <div className="text-3xl sm:text-4xl font-black text-[#22c55e] font-mono">{state?.soldCount ?? 0}</div>
            <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mt-1.5">Players Sold</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] text-center shadow-lg">
            <div className="text-3xl sm:text-4xl font-black text-[#ef4444] font-mono">{state?.unsoldCount ?? 0}</div>
            <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mt-1.5">Unsold</div>
          </div>
          <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] text-center shadow-lg">
            <div className="text-3xl sm:text-4xl font-black text-[#F5B942] font-mono">{state?.retainedCount ?? 0}</div>
            <div className="text-xs font-bold text-[#94A3B8] uppercase tracking-wider mt-1.5">Retained</div>
          </div>
        </div>

        {/* Four Cricket Teams Master Display */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F5B942]" />
              Participating Teams & Live Points
            </h2>
            <span className="text-xs text-[#94A3B8] font-bold">Purse: 150 Pts Each</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {state?.teams?.map((team) => (
              <div
                key={team.id}
                className="relative rounded-2xl p-5 border border-[#334155] bg-[#202F45] shadow-xl overflow-hidden transition hover:border-[#F5B942]/50"
              >
                {/* Team Top Banner Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.primary_color }}
                />

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md shrink-0"
                    style={{ backgroundColor: team.primary_color }}
                  >
                    {team.code}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-white text-base leading-tight">{team.name}</h3>
                    <p className="text-xs text-[#94A3B8]">Capt: <span className="text-[#CBD5E1] font-semibold">{team.captain_name}</span></p>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-[#334155]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#94A3B8]">Remaining Budget</span>
                    <span className="font-black text-[#F5B942] text-sm font-mono">{team.remaining_budget} pts</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#94A3B8]">Squad Size</span>
                    <span className="font-bold text-white">{team.players_count} players</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[#94A3B8]">Retention Spent</span>
                    <span className="font-bold text-[#CBD5E1]">{team.retention_spent} pts</span>
                  </div>
                </div>

                {/* Progress bar of budget */}
                <div className="mt-3 w-full bg-[#182438] h-2 rounded-full overflow-hidden border border-[#334155]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, ((150 - team.remaining_budget) / 150) * 100)}%`,
                      backgroundColor: team.primary_color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Demo Login Helper Box */}
        <div className="p-6 rounded-2xl bg-[#202F45] border border-[#334155] shadow-xl mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#F5B942]" />
                Quick Role-Based Authentication
              </h3>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                Click any role to log in immediately and test permissions, bidding, draw, reports, or data reset.
              </p>
            </div>
            {user && (
              <div className="text-xs text-[#22c55e] bg-[#16A34A]/15 px-3 py-1.5 rounded-xl border border-[#16A34A]/30 flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Signed in as: <strong className="text-white">{user.name}</strong> ({user.role})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            <button
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#F5B942]">Admin</div>
              <div className="text-xs font-bold text-white group-hover:text-[#F5B942]">Super Admin</div>
              <div className="text-[10px] text-[#94A3B8]">Full Access</div>
            </button>

            <button
              onClick={() => handleQuickLogin('organiser1', 'org123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#a855f7]">Organiser 1</div>
              <div className="text-xs font-bold text-white group-hover:text-[#a855f7]">Lead Host</div>
              <div className="text-[10px] text-[#94A3B8]">Draw & Podium</div>
            </button>

            <button
              onClick={() => handleQuickLogin('organiser2', 'org123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#a855f7]">Organiser 2</div>
              <div className="text-xs font-bold text-white group-hover:text-[#a855f7]">Assistant Host</div>
              <div className="text-[10px] text-[#94A3B8]">Monitor</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_mt', 'cap123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#3B82F6]">Mumbai</div>
              <div className="text-xs font-bold text-white group-hover:text-[#3B82F6]">Rohit Varma</div>
              <div className="text-[10px] text-[#94A3B8]">Captain MT</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_css', 'cap123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#F5B942]">Chennai</div>
              <div className="text-xs font-bold text-white group-hover:text-[#F5B942]">Dhoni Kumar</div>
              <div className="text-[10px] text-[#94A3B8]">Captain CSS</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_rc', 'cap123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#ef4444]">Bangalore</div>
              <div className="text-xs font-bold text-white group-hover:text-[#ef4444]">Virat Patel</div>
              <div className="text-[10px] text-[#94A3B8]">Captain RC</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_kk', 'cap123')}
              className="p-3 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#334155] text-left transition group"
            >
              <div className="text-[10px] uppercase font-black text-[#a855f7]">Kolkata</div>
              <div className="text-xs font-bold text-white group-hover:text-[#a855f7]">Shreyas Iyer</div>
              <div className="text-[10px] text-[#94A3B8]">Captain KK</div>
            </button>
          </div>
        </div>

        {/* Feature Navigation Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link
            href="/auction/live"
            className="p-6 rounded-2xl bg-[#202F45] border border-[#334155] hover:border-[#F5B942]/50 transition group flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942] mb-4 group-hover:scale-110 transition">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#F5B942] transition">Live Auction Arena</h3>
              <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
                Stadium broadcast auditorium with live bids, countdown timer, team cards, and organiser control buttons.
              </p>
            </div>
            <div className="mt-5 text-xs font-black text-[#F5B942] flex items-center gap-1.5 uppercase tracking-wider">
              Enter Arena <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/auction/draw"
            className="p-6 rounded-2xl bg-[#202F45] border border-[#334155] hover:border-[#3B82F6]/50 transition group flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#3B82F6] mb-4 group-hover:scale-110 transition">
                <Shuffle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-[#60a5fa] transition">Random Player Draw</h3>
              <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
                Automated slot-machine lottery with fair backend selection, category filtering, and dramatic animated reveal.
              </p>
            </div>
            <div className="mt-5 text-xs font-black text-[#60a5fa] flex items-center gap-1.5 uppercase tracking-wider">
              Start Draw <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/admin/settings/data"
            className="p-6 rounded-2xl bg-[#202F45] border border-[#334155] hover:border-rose-400/50 transition group flex flex-col justify-between shadow-xl"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition">Data Management & Reset</h3>
              <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
                Clear Master Data, Clear Transaction Data with atomic balance recalculations, and Complete Auction Reset.
              </p>
            </div>
            <div className="mt-5 text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-wider">
              Manage Data <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
