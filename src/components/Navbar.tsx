'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Trophy, Tv, Radio, Shuffle, Users, Shield, LogOut, LogIn, FileText, Database } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { state } = useAuction();

  // Projector view has its own immersive fullscreen broadcast layout
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
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40 shadow-sm animate-pulse">
            <span className="w-2 h-2 rounded-full bg-[#F5B942]" />
            LIVE BIDDING
          </span>
        );
      case 'PLAYER_READY':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#FFD66B]/15 text-[#FFD66B] border border-[#FFD66B]/40">
            <span className="w-2 h-2 rounded-full bg-[#FFD66B]" />
            PLAYER READY
          </span>
        );
      case 'RANDOM_DRAW':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#3B82F6]/15 text-[#3B82F6] border border-[#3B82F6]/40">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
            RANDOM DRAW
          </span>
        );
      case 'BIDDING_PAUSED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#64748B]/20 text-[#CBD5E1] border border-[#64748B]/40">
            PAUSED
          </span>
        );
      case 'RESULT_COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40">
            ROUND COMPLETED
          </span>
        );
      case 'AUCTION_COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40">
            AUCTION COMPLETED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#334155] text-[#CBD5E1] border border-[#475569]">
            NOT STARTED
          </span>
        );
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#101827]/95 backdrop-blur-md border-b border-[#334155] shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F5B942] to-[#D9981B] flex items-center justify-center text-[#101827] shadow-lg shadow-[#F5B942]/20 group-hover:scale-105 transition">
                <Trophy className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-lg font-black tracking-wider text-white flex items-center gap-1.5">
                  KPL <span className="text-[#101827] bg-[#F5B942] font-black text-xs uppercase px-1.5 py-0.5 rounded shadow-sm">AUCTION</span>
                </span>
                <p className="text-[10px] text-[#94A3B8] tracking-tight font-medium">Cricket Player Auction System</p>
              </div>
            </Link>
            <div className="hidden md:block ml-4">
              {getStatusBadge()}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5">
            <Link
              href="/auction/live"
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                pathname === '/auction/live'
                  ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/35 shadow-sm'
                  : 'text-[#CBD5E1] hover:text-white hover:bg-[#182438]'
              }`}
            >
              <Radio className="w-4 h-4 text-[#F5B942]" />
              Live Auction
            </Link>

            <Link
              href="/projector"
              target="_blank"
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-[#CBD5E1] hover:text-white hover:bg-[#182438] transition flex items-center gap-1.5"
            >
              <Tv className="w-4 h-4 text-[#22c55e]" />
              Projector Screen
            </Link>

            {isOrganiserOrAdmin && (
              <Link
                href="/auction/draw"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  pathname === '/auction/draw'
                    ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/35 shadow-sm'
                    : 'text-[#CBD5E1] hover:text-white hover:bg-[#182438]'
                }`}
              >
                <Shuffle className="w-4 h-4 text-[#3B82F6]" />
                Random Draw
              </Link>
            )}

            {isCaptain && (
              <Link
                href="/captain"
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  pathname === '/captain'
                    ? 'bg-[#3B82F6]/20 text-[#60a5fa] border border-[#3B82F6]/40 shadow-sm'
                    : 'text-[#CBD5E1] hover:text-white hover:bg-[#182438]'
                }`}
              >
                <Users className="w-4 h-4 text-[#60a5fa]" />
                Captain Dashboard
              </Link>
            )}

            {isSuperAdmin && (
              <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#334155]">
                <Link
                  href="/admin"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    pathname === '/admin' ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30' : 'text-[#CBD5E1] hover:text-white hover:bg-[#182438]'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-[#F5B942]" />
                  Admin
                </Link>
                <Link
                  href="/admin/teams"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/teams') ? 'text-[#F5B942] font-bold bg-[#182438]' : 'text-[#94A3B8] hover:text-white hover:bg-[#182438]'
                  }`}
                >
                  Teams
                </Link>
                <Link
                  href="/admin/players"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/players') ? 'text-[#F5B942] font-bold bg-[#182438]' : 'text-[#94A3B8] hover:text-white hover:bg-[#182438]'
                  }`}
                >
                  Players
                </Link>
                <Link
                  href="/admin/retention"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    pathname.startsWith('/admin/retention') ? 'text-[#F5B942] font-bold bg-[#182438]' : 'text-[#94A3B8] hover:text-white hover:bg-[#182438]'
                  }`}
                >
                  Retention
                </Link>
                <Link
                  href="/admin/reports"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1 ${
                    pathname.startsWith('/admin/reports') ? 'text-[#F5B942] font-bold bg-[#182438]' : 'text-[#94A3B8] hover:text-white hover:bg-[#182438]'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Reports
                </Link>
                <Link
                  href="/admin/settings/data"
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    pathname.startsWith('/admin/settings/data')
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
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
              <div className="flex items-center gap-2.5">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-extrabold text-white">{user.name}</div>
                  <div className="text-[10px] text-[#F5B942] uppercase font-bold tracking-wider">
                    {user.role.replace('_', ' ')}
                  </div>
                </div>
                <button
                  onClick={() => logout()}
                  title="Logout"
                  className="p-2 rounded-xl bg-[#182438] hover:bg-[#334155] text-[#CBD5E1] hover:text-rose-400 transition border border-[#334155]"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition shadow-md shadow-[#F5B942]/20 flex items-center gap-1.5"
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
