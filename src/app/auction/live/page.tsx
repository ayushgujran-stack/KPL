'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuction } from '@/context/AuctionContext';
import { useAuth } from '@/context/AuthContext';
import {
  Trophy,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Shuffle,
  Shield,
  Clock,
  TrendingUp,
  AlertCircle,
  Plus,
  DollarSign,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';

export default function LiveAuctionPage() {
  const router = useRouter();
  const {
    state,
    placeBid,
    declareSold,
    declareUnsold,
    controlAuction,
    confirmDraw,
  } = useAuction();
  const { user } = useAuth();

  const [customBid, setCustomBid] = useState<string>('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'bids' | 'rules'>('bids');

  const event = state?.event;
  const player = state?.currentPlayer;
  const currentBidTeam = state?.currentBidTeam;
  const teams = state?.teams || [];

  const isOrganiser = user && ['super_admin', 'organiser_1', 'organiser_2'].includes(user.role);
  const isCaptain = user?.role === 'captain';
  const captainTeam = teams.find((t) => t.id === user?.team_id);

  // Local visual countdown timer
  const [secondsLeft, setSecondsLeft] = useState<number>(event?.bid_timer ?? 20);

  useEffect(() => {
    if (event?.bid_timer !== undefined) {
      setSecondsLeft(event.bid_timer);
    }
  }, [event?.bid_timer, event?.updated_at]);

  useEffect(() => {
    if (event?.status !== 'bidding') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [event?.status]);

  const handlePlaceBid = async (teamId: string, amount: number) => {
    setBidError(null);
    setIsSubmitting(true);
    const res = await placeBid(teamId, amount);
    setIsSubmitting(false);

    if (!res.success) {
      setBidError(res.error || 'Bid could not be placed');
    } else {
      setCustomBid('');
    }
  };

  const handleCustomBidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(customBid);
    if (!amount || isNaN(amount)) {
      setBidError('Please enter a valid numeric bid amount');
      return;
    }

    const teamToBid = isCaptain ? captainTeam?.id : teams[0]?.id;
    if (!teamToBid) {
      setBidError('No team selected to bid');
      return;
    }

    handlePlaceBid(teamToBid, amount);
  };

  const currentBidAmount = event?.current_bid || (player?.base_price ?? 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
      {/* Stadium Spotlight Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-amber-500/5 blur-3xl pointer-events-none" />

      {/* Top Bar: Tournament & Timer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-slate-900/80 border border-slate-800 rounded-2xl p-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">IPL Stadium Arena</div>
            <h1 className="text-lg font-black text-white">{event?.name || 'KPL Player Auction 2026'}</h1>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
            <Clock className={`w-4 h-4 ${secondsLeft <= 5 && event?.status === 'bidding' ? 'text-rose-400 animate-pulse' : 'text-amber-400'}`} />
            <span className="text-xs font-bold text-slate-400 uppercase">Timer:</span>
            <span
              className={`text-xl font-black font-mono ${
                secondsLeft <= 5 && event?.status === 'bidding' ? 'text-rose-400 animate-bounce' : 'text-white'
              }`}
            >
              {secondsLeft}s
            </span>
          </div>

          <div className="hidden sm:block">
            <Link
              href="/projector"
              target="_blank"
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 transition flex items-center gap-1.5"
            >
              Projector View ↗
            </Link>
          </div>
        </div>
      </div>

      {bidError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{bidError}</span>
          </div>
          <button onClick={() => setBidError(null)} className="text-xs font-bold underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Player Focus vs Bidding Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Player Spotlight Card (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-gradient-to-b from-slate-900/90 to-slate-950/90 border border-slate-800 rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl relative overflow-hidden">
          {player ? (
            <>
              {/* Corner Category Banner */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-extrabold uppercase tracking-wider">
                  {player.category}
                </span>
                <span className="font-mono text-xs text-slate-400 font-bold">
                  #{player.player_number}
                </span>
              </div>

              {/* Player Image & Key Stats Flex */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 my-2">
                <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-2 border-amber-400/30 shadow-xl relative shrink-0 bg-slate-950">
                  <img
                    src={player.photo_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-center">
                    <span className="text-[11px] font-bold text-white bg-slate-900/80 px-2.5 py-0.5 rounded-full border border-slate-700">
                      {player.gender}
                    </span>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
                    {player.name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-3 py-1 rounded-lg bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold">
                      {player.role}
                    </span>
                    {player.age && (
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs">
                        Age: {player.age}
                      </span>
                    )}
                  </div>

                  <div className="mt-6 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                    <div className="text-[11px] uppercase font-bold text-slate-400">Opening Base Price</div>
                    <div className="text-xl font-black text-emerald-400">{player.base_price} Points</div>
                  </div>
                </div>
              </div>

              {/* Current Bid Display Banner */}
              <div className="mt-6 p-5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-slate-900 to-amber-500/10 border border-amber-500/40 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                      Current Highest Bid
                    </div>
                    <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline gap-2">
                      {currentBidAmount} <span className="text-lg text-amber-400 font-sans font-bold">Points</span>
                    </div>
                  </div>

                  <div className="text-center sm:text-right">
                    <div className="text-xs uppercase font-bold text-slate-400">Highest Bidding Team</div>
                    {currentBidTeam ? (
                      <div className="inline-flex items-center gap-2 mt-1 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: currentBidTeam.primary_color }}
                        />
                        <span className="font-extrabold text-white text-base">{currentBidTeam.name}</span>
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-400 mt-1 italic">
                        Waiting for opening bid...
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Shuffle className="w-12 h-12 text-slate-600 mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-white">No Player In Auction</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Start a random lottery draw from the Draw screen to bring the next eligible cricketer to the auction podium.
              </p>
              {isOrganiser && (
                <Link
                  href="/auction/draw"
                  className="mt-6 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider transition"
                >
                  Go to Random Draw
                </Link>
              )}
            </div>
          )}

          {/* Organiser Action Buttons Section */}
          {isOrganiser && player && (
            <div className="mt-6 pt-6 border-t border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-bold text-slate-400 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  Organiser Podium Controls
                </span>
                <span className="text-[10px] text-slate-400 uppercase">
                  Status: <strong className="text-amber-400">{event?.status}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {event?.status === 'drawn' && (
                  <button
                    onClick={() => confirmDraw()}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Start Bidding
                  </button>
                )}

                {event?.status === 'bidding' && (
                  <>
                    <button
                      onClick={() => controlAuction('pause')}
                      className="px-4 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </button>

                    <button
                      onClick={() => controlAuction('reset_timer')}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Timer
                    </button>

                    <button
                      onClick={() => declareSold()}
                      disabled={!event.current_bid_team_id}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-blue-500/25 disabled:opacity-40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Declare SOLD
                    </button>

                    <button
                      onClick={() => declareUnsold()}
                      className="px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Declare UNSOLD
                    </button>
                  </>
                )}

                {event?.status === 'paused' && (
                  <button
                    onClick={() => controlAuction('resume')}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume Bidding
                  </button>
                )}

                {(event?.status === 'sold' || event?.status === 'unsold') && (
                  <Link
                    href="/auction/draw"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-purple-500/25"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Start Next Random Draw
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Captain Bidding & Activity (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Captain Bid Action Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                Live Bidding Controls
              </h3>
              {isCaptain && captainTeam && (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-lg border border-amber-400/20">
                  {captainTeam.name}
                </span>
              )}
            </div>

            {event?.status !== 'bidding' ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                Bidding is currently <strong className="text-white uppercase">{event?.status}</strong>. Bids can only be placed when bidding is active.
              </div>
            ) : !user ? (
              <div className="py-6 text-center text-xs text-slate-400 bg-slate-950/60 rounded-2xl border border-slate-800/80">
                You are viewing as a guest.
                <div className="mt-2">
                  <Link href="/login" className="text-amber-400 font-bold underline">
                    Sign in as Captain
                  </Link>{' '}
                  to bid live.
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Target Team Selector (For Super Admin testing proxy bids, or fixed for Captain) */}
                {user.role === 'super_admin' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
                      Admin Proxy Bid on behalf of:
                    </label>
                    <select
                      id="admin-bid-team-select"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Budget: {t.remaining_budget} pts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Instant Increment Buttons */}
                <div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Quick Increments:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[1, 2, 5].map((inc) => {
                      const nextBid = currentBidAmount + inc;
                      const targetTeamId = isCaptain
                        ? captainTeam?.id
                        : (typeof document !== 'undefined'
                            ? (document.getElementById('admin-bid-team-select') as HTMLSelectElement)?.value || teams[0]?.id
                            : teams[0]?.id);

                      const isCurrentHighest = currentBidTeam?.id === targetTeamId;
                      const hasBudget = (captainTeam?.remaining_budget ?? 150) >= nextBid;

                      return (
                        <button
                          key={inc}
                          disabled={isSubmitting || isCurrentHighest || !hasBudget}
                          onClick={() => {
                            const tid = isCaptain
                              ? captainTeam?.id
                              : (document.getElementById('admin-bid-team-select') as HTMLSelectElement)?.value || teams[0]?.id;
                            if (tid) handlePlaceBid(tid, nextBid);
                          }}
                          className="py-3 px-2 rounded-xl bg-gradient-to-b from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 border border-amber-500/30 text-amber-300 font-extrabold text-sm flex flex-col items-center justify-center transition disabled:opacity-40"
                        >
                          <span>+{inc} Pt</span>
                          <span className="text-[10px] text-slate-400 font-normal">Bid {nextBid}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Bid Input */}
                <form onSubmit={handleCustomBidSubmit} className="pt-2">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Custom Bid Amount:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="1"
                      min={currentBidAmount + 1}
                      value={customBid}
                      onChange={(e) => setCustomBid(e.target.value)}
                      placeholder={`> ${currentBidAmount}`}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !customBid}
                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition disabled:opacity-40"
                    >
                      Bid
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Live Recent Bids Feed */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Live Bidding Activity
              </h3>
              <span className="text-[10px] text-slate-400">Current Player</span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-56 space-y-2 pr-1">
              {state?.recentBids && state.recentBids.length > 0 ? (
                state.recentBids.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                      idx === 0
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: b.team_color }}
                      />
                      <span className="font-bold text-white">{b.team_name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-amber-400 text-sm">
                        {b.amount} pts
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  No bids placed for this cricketer yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Four Team Standings and Budgets */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            Four Cricket Teams & Remaining Purse
          </h2>
          <span className="text-xs text-slate-400">Total Budget: 150 Pts</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map((t) => {
            const isHighest = currentBidTeam?.id === t.id;
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl p-4 border backdrop-blur transition ${
                  isHighest
                    ? 'bg-slate-900 border-amber-400 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                {/* Team Top Strip */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5 rounded-t-2xl"
                  style={{ backgroundColor: t.primary_color }}
                />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow"
                      style={{ backgroundColor: t.primary_color }}
                    >
                      {t.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm leading-tight">{t.name}</h4>
                      <p className="text-[10px] text-slate-400">Capt: {t.captain_name}</p>
                    </div>
                  </div>
                  {isHighest && (
                    <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[9px] uppercase tracking-wide">
                      HIGH BID
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Remaining Budget</span>
                    <span className="font-black text-amber-400 font-mono text-sm">{t.remaining_budget} pts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Players Count</span>
                    <span className="font-semibold text-slate-200">{t.players_count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
