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
  DollarSign,
} from 'lucide-react';
import Link from 'next/link';

export default function LiveAuctionPage() {
  const router = useRouter();
  const {
    state,
    placeBid,
    startBidding,
    declareSold,
    declareUnsold,
    nextRandomDraw,
    controlAuction,
  } = useAuction();
  const { user } = useAuth();

  const [customBid, setCustomBid] = useState<string>('');
  const [bidError, setBidError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const event = state?.event;
  const player = state?.currentPlayer;
  const currentBidTeam = state?.currentBidTeam;
  const teams = state?.teams || [];

  const status = event?.status ? event.status.toUpperCase() : 'NOT_STARTED';

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
    if (status !== 'BIDDING') return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  const handleStartBidding = async () => {
    setBidError(null);
    setIsSubmitting(true);
    const res = await startBidding();
    setIsSubmitting(false);
    if (!res.success) {
      setBidError(res.error || 'Failed to start bidding');
    }
  };

  const handleDeclareSold = async () => {
    setBidError(null);
    setIsSubmitting(true);
    const res = await declareSold();
    setIsSubmitting(false);
    if (!res.success) {
      setBidError(res.error || 'Failed to declare sold');
    }
  };

  const handleDeclareUnsold = async () => {
    setBidError(null);
    setIsSubmitting(true);
    const res = await declareUnsold();
    setIsSubmitting(false);
    if (!res.success) {
      setBidError(res.error || 'Failed to declare unsold');
    }
  };

  const handleNextRandomDraw = async () => {
    setBidError(null);
    setIsSubmitting(true);
    const res = await nextRandomDraw();
    setIsSubmitting(false);
    if (res.success) {
      router.push('/auction/draw');
    } else {
      setBidError(res.error || 'Failed to transition to next random draw');
    }
  };

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 relative bg-[#101827] min-h-[calc(100vh-4rem)]">
      {/* Stadium Spotlight Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-64 bg-[#F5B942]/5 blur-3xl pointer-events-none" />

      {/* Top Bar: Tournament & Timer */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-[#202F45] border border-[#334155] rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#F5B942] to-[#D9981B] flex items-center justify-center text-[#101827] shadow-lg shadow-[#F5B942]/20">
            <Trophy className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">IPL Stadium Arena</div>
            <h1 className="text-lg font-black text-white">{event?.name || 'KPL Player Auction 2026'}</h1>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 bg-[#182438] px-4 py-2 rounded-xl border border-[#334155] shadow-inner">
            <Clock className={`w-4 h-4 ${secondsLeft <= 5 && status === 'BIDDING' ? 'text-[#ef4444] animate-pulse' : 'text-[#F5B942]'}`} />
            <span className="text-xs font-bold text-[#94A3B8] uppercase">Timer:</span>
            <span
              className={`text-xl font-black font-mono tracking-tight ${
                secondsLeft <= 5 && status === 'BIDDING' ? 'text-[#ef4444] animate-bounce' : 'text-white'
              }`}
            >
              {status === 'BIDDING' ? `${secondsLeft}s` : status === 'BIDDING_PAUSED' ? 'Paused' : `${event?.timer_duration ?? 20}s`}
            </span>
          </div>

          <div className="hidden sm:block">
            <Link
              href="/projector"
              target="_blank"
              className="px-4 py-2 rounded-xl bg-[#334155] hover:bg-[#475569] text-xs font-bold text-white border border-[#475569] transition flex items-center gap-1.5"
            >
              Projector Broadcast ↗
            </Link>
          </div>
        </div>
      </div>

      {bidError && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between font-semibold">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{bidError}</span>
          </div>
          <button onClick={() => setBidError(null)} className="text-xs font-bold underline hover:text-white">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Grid: Player Focus vs Bidding Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
        {/* Left Column: Player Spotlight Card (7 cols) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {player ? (
            <>
              {/* Corner Category Banner */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 rounded-full bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40 text-xs font-black uppercase tracking-wider">
                  {player.category}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    status === 'PLAYER_READY' ? 'bg-[#FFD66B]/15 text-[#FFD66B] border border-[#FFD66B]/40' :
                    status === 'BIDDING' ? 'bg-[#F59E0B]/15 text-[#F5B942] border border-[#F5B942]/40 animate-pulse' :
                    status === 'BIDDING_PAUSED' ? 'bg-[#64748B]/20 text-[#CBD5E1] border border-[#64748B]/40' :
                    status === 'RESULT_COMPLETED' ? 'bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40' :
                    'bg-[#334155] text-white border border-[#475569]'
                  }`}>
                    {status === 'PLAYER_READY' ? 'READY FOR AUCTION' :
                     status === 'BIDDING' ? 'LIVE BIDDING' :
                     status === 'BIDDING_PAUSED' ? 'BIDDING PAUSED' :
                     status === 'RESULT_COMPLETED' ? 'ROUND COMPLETED' : status}
                  </span>
                  <span className="font-mono text-xs text-[#94A3B8] font-bold">
                    #{player.player_number}
                  </span>
                </div>
              </div>

              {/* Player Image & Key Stats Flex */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 my-2">
                <div className="w-44 h-44 sm:w-52 sm:h-52 rounded-2xl overflow-hidden border-2 border-[#F5B942]/50 shadow-2xl relative shrink-0 bg-[#182438]">
                  <img
                    src={player.photo_url || '/default-player-avatar.svg'}
                    alt={player.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/default-player-avatar.svg';
                    }}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101827]/90 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2 text-center">
                    <span className="text-[11px] font-bold text-white bg-[#101827]/90 px-3 py-0.5 rounded-full border border-[#334155]">
                      {player.gender}
                    </span>
                  </div>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
                    {player.name}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="px-3 py-1 rounded-lg bg-[#3B82F6]/20 text-[#60a5fa] border border-[#3B82F6]/40 text-xs font-bold">
                      {player.role}
                    </span>
                    {player.age && (
                      <span className="px-3 py-1 rounded-lg bg-[#182438] text-[#CBD5E1] text-xs font-bold border border-[#334155]">
                        Age: {player.age}
                      </span>
                    )}
                  </div>

                  <div className="mt-5 p-3.5 rounded-xl bg-[#182438] border border-[#334155]">
                    <div className="text-[11px] uppercase font-bold text-[#94A3B8]">Opening Base Price</div>
                    <div className="text-xl font-black text-[#22c55e] font-mono">{player.base_price} Points</div>
                  </div>
                </div>
              </div>

              {/* Stage-dependent Status & Current Bid Banner */}
              {status === 'RESULT_COMPLETED' ? (
                <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-[#182438] via-[#202F45] to-[#182438] border-2 border-[#16A34A]/50 relative overflow-hidden shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-black text-[#94A3B8] tracking-wider">
                        Auction Result
                      </div>
                      <div className="text-3xl sm:text-4xl font-black text-white font-mono tracking-tight mt-1 flex items-baseline gap-2">
                        {currentBidTeam || state?.latestResult?.team_name ? (
                          <>
                            <span className="text-[#22c55e] font-black">SOLD</span>
                            <span className="text-xl text-white font-sans font-bold">
                              for <strong className="text-[#F5B942] font-mono">{currentBidAmount} Points</strong>
                            </span>
                          </>
                        ) : (
                          <span className="text-[#ef4444] font-black font-sans">UNSOLD</span>
                        )}
                      </div>
                    </div>

                    <div className="text-center sm:text-right">
                      {currentBidTeam || state?.latestResult?.team_name ? (
                        <>
                          <div className="text-xs uppercase font-bold text-[#94A3B8]">Acquired By</div>
                          <div className="inline-flex items-center gap-2 mt-1.5 px-4 py-2 rounded-xl bg-[#182438] border border-[#334155]">
                            <span
                              className="w-3.5 h-3.5 rounded-full"
                              style={{ backgroundColor: currentBidTeam?.primary_color || state?.latestResult?.team_color || '#3b82f6' }}
                            />
                            <span className="font-extrabold text-white text-base">
                              {currentBidTeam?.name || state?.latestResult?.team_name}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-rose-300 font-semibold italic bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                          Returned to unsold player pool
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : status === 'PLAYER_READY' ? (
                <div className="mt-6 p-6 rounded-2xl bg-gradient-to-r from-[#182438] via-[#202F45] to-[#182438] border-2 border-[#F5B942]/40 relative overflow-hidden shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">
                        Podium Status: Player Ready
                      </div>
                      <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                        Awaiting Organiser to Start Bidding
                      </div>
                      <p className="text-xs text-[#CBD5E1] mt-1 font-medium">
                        Captains are reviewing player profile. Opening base price: <strong className="text-[#22c55e] font-mono">{player.base_price} Points</strong>.
                      </p>
                    </div>

                    {isOrganiser && (
                      <button
                        onClick={handleStartBidding}
                        disabled={isSubmitting}
                        className="px-7 py-3 rounded-xl bg-[#16A34A] hover:bg-[#22c55e] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-emerald-600/30 shrink-0"
                      >
                        <Play className="w-4 h-4 fill-current" />
                        Start Bidding
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Active Bidding Display: Large Gold Typography */
                <div className="mt-6 p-6 rounded-2xl bg-[#182438] border-2 border-[#F5B942]/50 relative overflow-hidden shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase font-black text-[#94A3B8] tracking-wider">
                        Current Highest Bid
                      </div>
                      <div className="text-5xl sm:text-6xl font-black text-[#F5B942] font-mono tracking-tight mt-1 flex items-baseline gap-2">
                        {currentBidAmount} <span className="text-xl text-[#FFD66B] font-sans font-bold">Points</span>
                      </div>
                    </div>

                    <div className="text-center sm:text-right">
                      <div className="text-xs uppercase font-bold text-[#94A3B8]">Highest Bidding Team</div>
                      {currentBidTeam ? (
                        <div className="inline-flex items-center gap-2 mt-1.5 px-4 py-2 rounded-xl bg-[#202F45] border border-[#334155] shadow">
                          <span
                            className="w-3.5 h-3.5 rounded-full"
                            style={{ backgroundColor: currentBidTeam.primary_color }}
                          />
                          <span className="font-extrabold text-white text-base">{currentBidTeam.name}</span>
                        </div>
                      ) : (
                        <div className="text-sm font-semibold text-[#CBD5E1] mt-1 italic">
                          Waiting for opening bid...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center">
              <Shuffle className="w-12 h-12 text-[#94A3B8] mb-4 animate-pulse" />
              <h3 className="text-xl font-bold text-white">No Player Currently On Auction Podium</h3>
              <p className="text-xs text-[#CBD5E1] mt-1 max-w-sm">
                The auction stage is standing by. When Organiser runs a lottery draw and confirms a player, their profile will lock onto this podium.
              </p>
              {isOrganiser && (
                <Link
                  href="/auction/draw"
                  className="mt-6 px-6 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-lg shadow-[#F5B942]/20"
                >
                  <Shuffle className="w-4 h-4" />
                  Go to Random Draw Screen
                </Link>
              )}
            </div>
          )}

          {/* Organiser Action Buttons Section */}
          {isOrganiser && player && (
            <div className="mt-6 pt-6 border-t border-[#334155]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs uppercase font-extrabold text-[#94A3B8] flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-[#F5B942]" />
                  Organiser Podium Controls
                </span>
                <span className="text-[10px] text-[#94A3B8] uppercase">
                  Stage: <strong className="text-[#F5B942] font-black">{status}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-2.5">
                {status === 'PLAYER_READY' && (
                  <button
                    onClick={handleStartBidding}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#22c55e] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-2 shadow-md shadow-emerald-600/30"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Start Bidding
                  </button>
                )}

                {status === 'BIDDING' && (
                  <>
                    <button
                      onClick={() => controlAuction('pause')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 border border-[#475569]"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </button>

                    <button
                      onClick={() => controlAuction('reset_timer')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#182438] hover:bg-[#263852] text-[#CBD5E1] hover:text-white font-bold text-xs uppercase tracking-wider border border-[#334155] transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Timer
                    </button>

                    <button
                      onClick={handleDeclareSold}
                      disabled={!event?.current_bid_team_id || isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#22c55e] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Declare SOLD
                    </button>

                    <button
                      onClick={handleDeclareUnsold}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#ef4444] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Declare UNSOLD
                    </button>
                  </>
                )}

                {status === 'BIDDING_PAUSED' && (
                  <>
                    <button
                      onClick={() => controlAuction('resume')}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#22c55e] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Resume Bidding
                    </button>

                    <button
                      onClick={handleDeclareSold}
                      disabled={!event?.current_bid_team_id || isSubmitting}
                      className="px-5 py-2.5 rounded-xl bg-[#16A34A] hover:bg-[#22c55e] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-40"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      Declare SOLD
                    </button>

                    <button
                      onClick={handleDeclareUnsold}
                      disabled={isSubmitting}
                      className="px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#ef4444] text-white font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Declare UNSOLD
                    </button>
                  </>
                )}

                {status === 'RESULT_COMPLETED' && (
                  <button
                    onClick={handleNextRandomDraw}
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-[#F5B942]/20"
                  >
                    <Shuffle className="w-3.5 h-3.5" />
                    Next Random Draw
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Captain Bidding & Activity (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Captain Bid Action Card */}
          <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#F5B942]" />
                Live Bidding Controls
              </h3>
              {isCaptain && captainTeam && (
                <span className="text-[11px] font-black text-[#F5B942] bg-[#F5B942]/15 px-2.5 py-1 rounded-lg border border-[#F5B942]/30">
                  {captainTeam.name}
                </span>
              )}
            </div>

            {status !== 'BIDDING' ? (
              <div className="py-6 px-4 text-center text-xs text-[#CBD5E1] bg-[#182438] rounded-2xl border border-[#334155]">
                {status === 'PLAYER_READY' ? (
                  <>
                    <span className="block text-[#FFD66B] font-extrabold uppercase mb-1">Player Ready for Auction</span>
                    Waiting for Organiser to click &ldquo;Start Bidding&rdquo; to begin the countdown timer.
                  </>
                ) : status === 'BIDDING_PAUSED' ? (
                  <>
                    <span className="block text-[#F59E0B] font-extrabold uppercase mb-1">Bidding Paused</span>
                    The auction timer is temporarily paused. Please hold bids until Organiser resumes.
                  </>
                ) : status === 'RESULT_COMPLETED' ? (
                  <>
                    <span className="block text-[#60a5fa] font-extrabold uppercase mb-1">Round Completed</span>
                    Result has been recorded. Stand by for the next random player draw.
                  </>
                ) : (
                  <>
                    <span className="block text-white font-extrabold uppercase mb-1">No Active Bidding Round</span>
                    Bids can only be placed when an auction player is live on the podium.
                  </>
                )}
              </div>
            ) : !user ? (
              <div className="py-6 text-center text-xs text-[#CBD5E1] bg-[#182438] rounded-2xl border border-[#334155]">
                You are viewing as a guest.
                <div className="mt-2">
                  <Link href="/login" className="text-[#F5B942] font-black underline hover:text-[#FFD66B]">
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
                    <label className="block text-[11px] font-bold text-[#94A3B8] uppercase mb-1">
                      Admin Proxy Bid on behalf of:
                    </label>
                    <select
                      id="admin-bid-team-select"
                      className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5B942]"
                    >
                      {teams.map((t) => (
                        <option key={t.id} value={t.id} className="bg-[#182438] text-white">
                          {t.name} (Budget: {t.remaining_budget} pts)
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Instant Increment Buttons */}
                <div>
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-2">
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
                          className="py-3 px-2 rounded-xl bg-[#182438] hover:bg-[#263852] border border-[#F5B942]/40 text-[#F5B942] font-black text-sm flex flex-col items-center justify-center transition disabled:bg-[#182438]/50 disabled:border-[#334155] disabled:text-[#64748B] disabled:cursor-not-allowed"
                        >
                          <span>+{inc} Pt</span>
                          <span className="text-[10px] text-[#CBD5E1] font-semibold">Bid {nextBid}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Bid Input */}
                <form onSubmit={handleCustomBidSubmit} className="pt-2">
                  <div className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider mb-1.5">
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
                      className="flex-1 bg-[#182438] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942] font-mono"
                    />
                    <button
                      type="submit"
                      disabled={isSubmitting || !customBid}
                      className="px-6 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
                    >
                      Bid
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Live Recent Bids Feed */}
          <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                Live Bidding Activity
              </h3>
              <span className="text-[10px] text-[#94A3B8] font-bold">Current Player</span>
            </div>

            <div className="flex-1 overflow-y-auto max-h-56 space-y-2 pr-1">
              {state?.recentBids && state.recentBids.length > 0 ? (
                state.recentBids.map((b, idx) => (
                  <div
                    key={b.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                      idx === 0
                        ? 'bg-[#182438] border-[#F5B942]/50 shadow-sm'
                        : 'bg-[#182438]/60 border-[#334155] text-[#CBD5E1]'
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
                      <span className="font-mono font-black text-[#F5B942] text-sm">
                        {b.amount} pts
                      </span>
                      <span className="text-[10px] text-[#94A3B8]">
                        {new Date(b.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-[#94A3B8] italic">
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
          <h2 className="text-base font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#F5B942]" />
            Four Cricket Teams & Remaining Purse
          </h2>
          <span className="text-xs text-[#94A3B8] font-bold">Purse: 150 Pts Each</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map((t) => {
            const isHighest = currentBidTeam?.id === t.id;
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl p-4 border transition shadow-lg ${
                  isHighest
                    ? 'bg-[#202F45] border-2 border-[#F5B942] shadow-[#F5B942]/20'
                    : 'bg-[#202F45] border-[#334155]'
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
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow shrink-0"
                      style={{ backgroundColor: t.primary_color }}
                    >
                      {t.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm leading-tight">{t.name}</h4>
                      <p className="text-[10px] text-[#94A3B8]">Capt: {t.captain_name}</p>
                    </div>
                  </div>
                  {isHighest && (
                    <span className="px-2 py-0.5 rounded bg-[#F5B942] text-[#101827] font-black text-[9px] uppercase tracking-wide">
                      HIGH BID
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 text-xs pt-2 border-t border-[#334155]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Remaining Budget</span>
                    <span className="font-black text-[#F5B942] font-mono text-base">{t.remaining_budget} pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Squad Size</span>
                    <span className="font-bold text-white">{t.players_count}</span>
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
