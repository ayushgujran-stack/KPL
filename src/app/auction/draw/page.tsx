'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuction } from '@/context/AuctionContext';
import { useAuth } from '@/context/AuthContext';
import { Shuffle, ArrowRight, CheckCircle2, AlertTriangle, Sparkles, Radio } from 'lucide-react';
import confetti from 'canvas-confetti';
import Link from 'next/link';

export default function RandomDrawPage() {
  const router = useRouter();
  const { state, startDraw, confirmDraw } = useAuction();
  const { user } = useAuth();

  const [category, setCategory] = useState<'all' | 'male' | 'female'>('all');
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawResult, setDrawResult] = useState<any | null>(null);
  const [animatingName, setAnimatingName] = useState<string>('???');
  const [animatingPhoto, setAnimatingPhoto] = useState<string>('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=400&h=400&fit=crop&q=80');
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const isOrganiser = user && ['super_admin', 'organiser_1', 'organiser_2'].includes(user.role);

  const currentStatus = state?.event?.status ? (state.event.status.toUpperCase() as string) : 'NOT_STARTED';
  const isAuctionLive = ['PLAYER_READY', 'BIDDING', 'BIDDING_PAUSED'].includes(currentStatus);

  // If a player is already drawn in the backend state, show them
  const activeDrawnPlayer = drawResult || (currentStatus === 'RANDOM_DRAW' ? state?.currentPlayer : null);

  const handleStartDraw = async () => {
    if (isAuctionLive) {
      setError(`Cannot start lottery draw while a player is active on the live auction podium (Status: ${currentStatus}). Please finish the current auction round first.`);
      return;
    }

    setError(null);
    setConfirmed(false);
    setIsDrawing(true);
    setDrawResult(null);

    try {
      const data = await startDraw(category);

      // Run dramatic slot-machine spinning animation
      const candidates = data.candidates || [data.selectedPlayer];
      let counter = 0;
      const totalSteps = 24; // 24 flickers
      const speed = 60; // ms

      const interval = setInterval(() => {
        const item = candidates[counter % candidates.length];
        setAnimatingName(item.name);
        if (item.photo_url) setAnimatingPhoto(item.photo_url);
        counter++;

        if (counter >= totalSteps) {
          clearInterval(interval);
          // Land on backend selection
          setAnimatingName(data.selectedPlayer.name);
          setAnimatingPhoto(data.selectedPlayer.photo_url);
          setDrawResult(data.selectedPlayer);
          setIsDrawing(false);

          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      }, speed);
    } catch (err: any) {
      setIsDrawing(false);
      setError(err.message || 'Draw failed');
    }
  };

  const handleConfirmAndProceed = async () => {
    if (!isOrganiser) return;
    setError(null);
    const res = await confirmDraw();
    if (res.success) {
      setConfirmed(true);
      router.push('/auction/live');
    } else {
      setError(res.error || 'Failed to move player to auction');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 relative">
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold uppercase tracking-wider mb-2">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          Automated Fair Random Selection
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tight">
          Random Player <span className="text-purple-400">Lottery Draw</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-xl mx-auto">
          Cryptographically random selection of eligible cricket players. Retained and sold players are strictly excluded.
        </p>
      </div>

      {/* Podium Active Warning Banner */}
      {isAuctionLive && (
        <div className="mb-6 p-5 rounded-2xl bg-amber-500/15 border border-amber-500/30 backdrop-blur">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                  Auction Currently Active on Podium ({currentStatus})
                </div>
                <div className="text-white font-bold text-sm mt-0.5">
                  Player #{state?.currentPlayer?.player_number} {state?.currentPlayer?.name} is on the live stage. Complete this round before drawing the next player.
                </div>
              </div>
            </div>
            <Link
              href="/auction/live"
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shrink-0 flex items-center gap-1.5 shadow-lg shadow-amber-500/20"
            >
              Go to Live Podium →
            </Link>
          </div>
        </div>
      )}

      {!isOrganiser && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
          <span>You are viewing in Read-Only mode. Sign in as Organiser or Admin to control the lottery.</span>
          <button
            onClick={() => router.push('/login')}
            className="px-3 py-1 bg-amber-400 text-slate-950 font-bold rounded-lg uppercase text-[10px]"
          >
            Login as Organiser
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Draw Screen Stage */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur shadow-2xl relative overflow-hidden">
        {/* Glow circles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Category Selector Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Draw Pool:</span>
          {(['all', 'male', 'female'] as const).map((cat) => (
            <button
              key={cat}
              disabled={isDrawing || !isOrganiser || isAuctionLive}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                category === cat
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-50'
              }`}
            >
              {cat === 'all' ? 'All Players' : cat === 'male' ? 'Male Only' : 'Female Only'}
            </button>
          ))}
        </div>

        {/* Center Animated Roulette Spotlight */}
        <div className="max-w-md mx-auto text-center">
          <div className="relative mx-auto w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-4 border-purple-500/30 shadow-2xl bg-slate-950 mb-6 group">
            {/* Spinning indicator ring */}
            {isDrawing && (
              <div className="absolute inset-0 border-4 border-amber-400 border-t-transparent rounded-3xl animate-spin z-20 pointer-events-none" />
            )}

            <img
              src={activeDrawnPlayer ? activeDrawnPlayer.photo_url : animatingPhoto}
              alt="Player Spotlight"
              className={`w-full h-full object-cover transition-all duration-300 ${
                isDrawing ? 'scale-110 blur-[1px]' : 'scale-100'
              }`}
            />

            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

            {/* Corner ID Badge */}
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700 text-[10px] font-mono font-bold text-amber-400">
              {activeDrawnPlayer ? `#${activeDrawnPlayer.player_number}` : 'POOL'}
            </div>
          </div>

          {/* Player Name / Reveal Banner */}
          <div className="min-h-16 flex flex-col items-center justify-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight">
              {activeDrawnPlayer ? activeDrawnPlayer.name : animatingName}
            </h2>
            {activeDrawnPlayer && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-semibold">
                  {activeDrawnPlayer.role}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold">
                  {activeDrawnPlayer.gender}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
                  {activeDrawnPlayer.category}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black">
                  Base: {activeDrawnPlayer.base_price} Pts
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!activeDrawnPlayer ? (
              <button
                onClick={handleStartDraw}
                disabled={isDrawing || !isOrganiser || isAuctionLive}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-sm uppercase tracking-wider shadow-xl shadow-purple-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                {isDrawing ? 'Selecting Player...' : isAuctionLive ? 'Auction Active on Podium' : 'Start Random Draw'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleStartDraw}
                  disabled={isDrawing || !isOrganiser || isAuctionLive}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs uppercase tracking-wider border border-slate-700 transition disabled:opacity-50"
                >
                  Draw Another
                </button>

                <button
                  onClick={handleConfirmAndProceed}
                  disabled={!isOrganiser || confirmed || isAuctionLive}
                  className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl shadow-emerald-500/25 flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Confirm & Move to Live Auction
                  <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
