'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Trophy, Tv, Radio, Shuffle, Users, Shield, LogOut, LogIn, FileText, Database, ShieldAlert } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { state } = useAuction();

  // Projector view has its own immersive fullscreen header
  if (pathname === '/projector') {
    return null;
  }

  const isOrganiserOrAdmin = user && ['super_admin', 'organiser_1', 'organiser_2'].includes(user.role);
  const isSuperAdmin = user?.role === 'super_admin';
  const isCaptain = user?.role === 'captain';

  const getStatusBadge = () => {
    const s = state?.event?.status ? state.event.status.toUpperCase() : 'NOT_STARTED';
    switch (s) {
      case 'BIDDING':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"><span className="w-2 h-2 rounded-full bg-emerald-400"></span>LIVE BIDDING</span>;
      case 'PLAYER_READY':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30"><span className="w-2 h-2 rounded-full bg-amber-400"></span>PLAYER READY</span>;
      case 'RANDOM_DRAW':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30"><span className="w-2 h-2 rounded-full bg-purple-400"></span>RANDOM DRAW</span>;
      case 'BIDDING_PAUSED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">BIDDING PAUSED</span>;
      case 'RESULT_COMPLETED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">ROUND COMPLETED</span>;
      case 'AUCTION_COMPLETED':
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">AUCTION COMPLETED</span>;
      default:
        return <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-700 text-slate-300">NOT STARTED</span>;
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#070b14]/90 backdrop-blur-md border-b border-amber-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition">
                <Trophy className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <span className="text-lg font-black tracking-wider text-white flex items-center gap-1">
                  KPL <span className="text-amber-400 font-extrabold text-sm uppercase px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">AUCTION</span>
                </span>
                <p className="text-[10px] text-slate-400 tracking-tight font-medium">Cricket Player Auction System</p>
              </div>
            </Link>
            <div className="hidden md:block ml-3">
              {getStatusBadge()}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link
              href="/auction/live"
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                pathname === '/auction/live'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Radio className="w-4 h-4 text-amber-400" />
              Live Auction
            </Link>

            <Link
              href="/projector"
              target="_blank"
              className="px-3 py-1.5 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 transition flex items-center gap-1.5"
            >
              <Tv className="w-4 h-4 text-emerald-400" />
              Projector Screen
            </Link>

            {isOrganiserOrAdmin && (
              <Link
                href="/auction/draw"
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                  pathname === '/auction/draw'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Shuffle className="w-4 h-4 text-purple-400" />
                Random Draw
              </Link>
            )}

            {isCaptain && (
              <Link
                href="/captain"
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 ${
                  pathname === '/captain'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Users className="w-4 h-4 text-blue-400" />
                Captain Dashboard
              </Link>
            )}

            {isSuperAdmin && (
              <div className="flex items-center gap-1 ml-2 pl-2 border-l border-slate-700/60">
                <Link
                  href="/admin"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    pathname === '/admin' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  Admin
                </Link>
                <Link
                  href="/admin/teams"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/teams') ? 'text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Teams
                </Link>
                <Link
                  href="/admin/players"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/players') ? 'text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Players
                </Link>
                <Link
                  href="/admin/retention"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/retention') ? 'text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Retention
                </Link>
                <Link
                  href="/admin/reports"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    pathname.startsWith('/admin/reports') ? 'text-amber-300 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Reports
                </Link>
                <Link
                  href="/admin/settings/data"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    pathname.startsWith('/admin/settings/data')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
                  }`}
                >
                  <Database className="w-3.5 h-3.5 text-rose-400" />
                  Data Reset
                </Link>
              </div>
            )}
          </nav>

          {/* User Account / Login */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-200">{user.name}</div>
                  <div className="text-[10px] text-amber-400 uppercase font-semibold">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  title="Logout"
                  className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-rose-400 transition border border-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-md shadow-amber-500/20 flex items-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
