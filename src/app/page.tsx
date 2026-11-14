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
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden">
      {/* Stadium Glow Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,158,11,0.15),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-600/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10 w-full">
        {/* Tournament Hero */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-xs font-bold uppercase tracking-wider mb-4 shadow-sm">
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            Premier Cricket League 2026 Season
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight uppercase">
            Cricket Player <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-500 bg-clip-text text-transparent">Auction System</span>
          </h1>
          <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed">
            Professional real-time player auction platform with automated random draw, live atomic bidding, captain budget management, and instant multi-screen sync.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/auction/live"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg shadow-amber-500/25 flex items-center gap-2 transition transform hover:-translate-y-0.5"
            >
              <Radio className="w-4 h-4" />
              Enter Live Auction
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>

            <Link
              href="/projector"
              target="_blank"
              className="px-6 py-3.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white font-bold text-sm uppercase tracking-wider border border-slate-700 flex items-center gap-2 transition"
            >
              <Tv className="w-4 h-4 text-emerald-400" />
              Open Projector Display
            </Link>
          </div>
        </div>

        {/* Live Tournament Status & Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 backdrop-blur text-center">
            <div className="text-2xl sm:text-3xl font-black text-white">{state?.totalPlayers ?? 36}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Total Pool</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur text-center">
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">{state?.soldCount ?? 0}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Players Sold</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-rose-500/20 backdrop-blur text-center">
            <div className="text-2xl sm:text-3xl font-black text-rose-400">{state?.unsoldCount ?? 0}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Unsold</div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 backdrop-blur text-center">
            <div className="text-2xl sm:text-3xl font-black text-amber-400">{state?.retainedCount ?? 0}</div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Retained</div>
          </div>
        </div>

        {/* Four Cricket Teams Master Display */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Participating Teams & Live Points
            </h2>
            <span className="text-xs text-slate-400">Budget: 150 Pts Each</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {state?.teams?.map((team) => (
              <div
                key={team.id}
                className="relative rounded-2xl p-5 border bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur overflow-hidden transition hover:border-amber-400/40"
                style={{ borderColor: `${team.primary_color}40` }}
              >
                {/* Team Top Banner Bar */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: team.primary_color }}
                />

                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-md"
                    style={{ backgroundColor: team.primary_color }}
                  >
                    {team.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{team.name}</h3>
                    <p className="text-xs text-slate-400">Capt: <span className="text-slate-200 font-semibold">{team.captain_name}</span></p>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Remaining Budget</span>
                    <span className="font-extrabold text-amber-400 text-sm">{team.remaining_budget} pts</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Squad Size</span>
                    <span className="font-semibold text-slate-200">{team.players_count} players</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Retention Spent</span>
                    <span className="text-slate-300">{team.retention_spent} pts</span>
                  </div>
                </div>

                {/* Progress bar of budget */}
                <div className="mt-3 w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
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
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-blue-500/10 border border-slate-800 backdrop-blur mb-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Quick Role-Based Authentication
              </h3>
              <p className="text-xs text-slate-300">
                Click any role to log in immediately and test permissions, bidding, draw, reports, or admin reset.
              </p>
            </div>
            {user && (
              <div className="text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Signed in as: <strong className="text-white">{user.name}</strong> ({user.role})
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
            <button
              onClick={() => handleQuickLogin('admin', 'admin123')}
              className="p-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-amber-400">Admin</div>
              <div className="text-xs font-bold text-white group-hover:text-amber-300">Super Admin</div>
              <div className="text-[10px] text-slate-400">Full Access</div>
            </button>

            <button
              onClick={() => handleQuickLogin('organiser1', 'org123')}
              className="p-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-purple-400">Organiser 1</div>
              <div className="text-xs font-bold text-white group-hover:text-purple-300">Lead Host</div>
              <div className="text-[10px] text-slate-400">Draw & Sold</div>
            </button>

            <button
              onClick={() => handleQuickLogin('organiser2', 'org123')}
              className="p-2.5 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-purple-400">Organiser 2</div>
              <div className="text-xs font-bold text-white group-hover:text-purple-300">Assistant Host</div>
              <div className="text-[10px] text-slate-400">Monitor</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_mt', 'cap123')}
              className="p-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-blue-400">Mumbai</div>
              <div className="text-xs font-bold text-white group-hover:text-blue-300">Rohit Varma</div>
              <div className="text-[10px] text-slate-400">Captain MT</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_css', 'cap123')}
              className="p-2.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-yellow-400">Chennai</div>
              <div className="text-xs font-bold text-white group-hover:text-yellow-300">Dhoni Kumar</div>
              <div className="text-[10px] text-slate-400">Captain CSS</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_rc', 'cap123')}
              className="p-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-rose-400">Bangalore</div>
              <div className="text-xs font-bold text-white group-hover:text-rose-300">Virat Patel</div>
              <div className="text-[10px] text-slate-400">Captain RC</div>
            </button>

            <button
              onClick={() => handleQuickLogin('captain_kk', 'cap123')}
              className="p-2.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-500/40 text-left transition group"
            >
              <div className="text-[10px] uppercase font-bold text-violet-400">Kolkata</div>
              <div className="text-xs font-bold text-white group-hover:text-violet-300">Shreyas Iyer</div>
              <div className="text-[10px] text-slate-400">Captain KK</div>
            </button>
          </div>
        </div>

        {/* Feature Navigation Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Link
            href="/auction/live"
            className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-amber-400/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
                <Radio className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">Live Auction Arena</h3>
              <p className="text-xs text-slate-400 mt-2">
                IPL-styled dark navy auditorium with live bids, countdown timer, team cards, and organiser control buttons.
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-amber-400 flex items-center gap-1">
              Enter Arena <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/auction/draw"
            className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-purple-400/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
                <Shuffle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-purple-300 transition">Random Player Draw</h3>
              <p className="text-xs text-slate-400 mt-2">
                Automated slot-machine lottery with fair backend selection, category filtering, and dramatic animated reveal.
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-purple-400 flex items-center gap-1">
              Start Draw <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>

          <Link
            href="/admin/settings/data"
            className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-rose-400/50 transition group flex flex-col justify-between"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white group-hover:text-rose-300 transition">Data Management & Reset</h3>
              <p className="text-xs text-slate-400 mt-2">
                Clear Master Data, Clear Transaction Data with atomic balance recalculations, and Complete Auction Reset with security guards.
              </p>
            </div>
            <div className="mt-4 text-xs font-bold text-rose-400 flex items-center gap-1">
              Manage Data <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
