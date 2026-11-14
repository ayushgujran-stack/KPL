'use client';

import React, { useState, useEffect } from 'react';
import { useAuction } from '@/context/AuctionContext';
import { Trophy, Clock, ArrowUpRight } from 'lucide-react';

export default function ProjectorDisplayPage() {
  const { state } = useAuction();
  const event = state?.event;
  const player = state?.currentPlayer;
  const currentBidTeam = state?.currentBidTeam;
  const teams = state?.teams || [];

  const status = event?.status ? event.status.toUpperCase() : 'NOT_STARTED';

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

  const currentBidAmount = event?.current_bid || (player?.base_price ?? 0);

  return (
    <div className="min-h-screen bg-[#101827] text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden font-sans">
      {/* Top Header Bar */}
      <header className="flex items-center justify-between border-b border-[#334155] pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F5B942] to-[#D9981B] flex items-center justify-center text-[#101827] shadow-2xl shadow-[#F5B942]/25">
            <Trophy className="w-8 h-8 fill-current" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-wider text-white">
              Premier Cricket League 2026
            </h1>
            <p className="text-xs uppercase tracking-widest text-[#F5B942] font-black">
              Official Auction Stadium Broadcast
            </p>
          </div>
        </div>

        {/* Global Stats & Status */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs font-bold text-[#94A3B8] uppercase">Pool Status</div>
            <div className="text-sm font-extrabold text-[#CBD5E1]">
              Sold: <span className="text-[#22c55e]">{state?.soldCount ?? 0}</span> | Unsold: <span className="text-[#ef4444]">{state?.unsoldCount ?? 0}</span> | Left: <span className="text-[#F5B942]">{state?.remainingPoolCount ?? 0}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-[#182438] border border-[#334155] px-5 py-2.5 rounded-2xl shadow-inner">
            <Clock className={`w-6 h-6 ${secondsLeft <= 5 && status === 'BIDDING' ? 'text-[#ef4444] animate-pulse' : 'text-[#F5B942]'}`} />
            <span
              className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                secondsLeft <= 5 && status === 'BIDDING' ? 'text-[#ef4444]' : 'text-white'
              }`}
            >
              {status === 'BIDDING' ? `${secondsLeft}s` : status === 'BIDDING_PAUSED' ? 'PAUSED' : `${event?.timer_duration ?? 20}s`}
            </span>
          </div>
        </div>
      </header>

      {/* Main Center Stage */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Player Spotlight Display (8 cols) */}
        <div className="lg:col-span-8 bg-[#202F45] border border-[#334155] rounded-3xl p-8 shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[460px]">
          {player ? (
            <>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 rounded-full bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40 text-sm font-black uppercase tracking-wider">
                    {player.category}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-full bg-[#3B82F6]/20 text-[#60a5fa] border border-[#3B82F6]/40 text-sm font-bold">
                    {player.role}
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-[#182438] text-[#CBD5E1] border border-[#334155] text-sm font-bold">
                    {player.gender}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    status === 'PLAYER_READY' ? 'bg-[#FFD66B]/15 text-[#FFD66B] border border-[#FFD66B]/40' :
                    status === 'BIDDING' ? 'bg-[#F59E0B]/15 text-[#F5B942] border border-[#F5B942]/40 animate-pulse' :
                    status === 'BIDDING_PAUSED' ? 'bg-[#64748B]/20 text-[#CBD5E1] border border-[#64748B]/40' :
                    status === 'RESULT_COMPLETED' ? 'bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40' :
                    'bg-[#334155] text-white border border-[#475569]'
                  }`}>
                    {status === 'PLAYER_READY' ? 'PLAYER READY' :
                     status === 'BIDDING' ? 'LIVE BIDDING' :
                     status === 'BIDDING_PAUSED' ? 'PAUSED' :
                     status === 'RESULT_COMPLETED' ? 'ROUND COMPLETED' : status}
                  </span>
                  <div className="text-lg font-mono font-bold text-[#94A3B8]">
                    #{player.player_number}
                  </div>
                </div>
              </div>

              {/* Player Image and Identity */}
              <div className="flex flex-col sm:flex-row items-center gap-8 my-6">
                <div className="w-56 h-56 sm:w-64 sm:h-64 rounded-3xl overflow-hidden border-4 border-[#F5B942]/50 shadow-2xl bg-[#182438] shrink-0">
                  <img
                    src={player.photo_url}
                    alt={player.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h2 className="text-4xl sm:text-6xl font-black text-white uppercase tracking-tight leading-none">
                    {player.name}
                  </h2>
                  <div className="text-lg text-[#CBD5E1] mt-3 font-medium">
                    Base Price: <strong className="text-[#22c55e] text-2xl font-black font-mono">{player.base_price} Points</strong>
                  </div>
                </div>
              </div>

              {/* Big Broadcaster Bid Banner: Large Gold Typography */}
              <div className="p-6 rounded-2xl bg-[#182438] border-2 border-[#F5B942]/50 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
                <div>
                  <div className="text-xs uppercase font-black text-[#94A3B8] tracking-widest">
                    Current Highest Bid
                  </div>
                  <div className="text-5xl sm:text-7xl font-black text-[#F5B942] font-mono tracking-tight mt-1 flex items-baseline gap-3">
                    {currentBidAmount} <span className="text-2xl text-[#FFD66B] font-sans font-black">PTS</span>
                  </div>
                </div>

                <div className="text-center sm:text-right">
                  <div className="text-xs uppercase font-black text-[#94A3B8] tracking-widest">
                    Winning Bidder
                  </div>
                  {currentBidTeam ? (
                    <div className="inline-flex items-center gap-3 mt-1.5 px-5 py-2.5 rounded-xl bg-[#202F45] border border-[#334155] shadow-lg">
                      <span
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: currentBidTeam.primary_color }}
                      />
                      <span className="font-black text-2xl text-white">{currentBidTeam.name}</span>
                    </div>
                  ) : (
                    <div className="text-base font-semibold text-[#CBD5E1] italic mt-1">
                      Awaiting Opening Bid
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="py-24 text-center flex flex-col items-center justify-center">
              <Trophy className="w-16 h-16 text-[#94A3B8] mb-4 animate-pulse" />
              <h2 className="text-3xl font-black text-white">AUCTION IN PROGRESS</h2>
              <p className="text-[#CBD5E1] mt-2">Next cricketer will appear on this screen when selected.</p>
            </div>
          )}
        </div>

        {/* Right Column: Recent Sales Activity (4 cols) */}
        <div className="lg:col-span-4 bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl flex flex-col h-full justify-between">
          <div className="flex items-center justify-between mb-4 border-b border-[#334155] pb-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-white flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-[#22c55e]" />
              Recent Auction Results
            </h3>
            <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Live Log</span>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto max-h-96 pr-1">
            {state?.recentResults && state.recentResults.length > 0 ? (
              state.recentResults.map((res) => (
                <div
                  key={res.id}
                  className="p-3.5 rounded-xl bg-[#182438] border border-[#334155] flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white text-sm">{res.player_name}</div>
                    <div className="text-[10px] text-[#94A3B8]">{res.player_role}</div>
                  </div>

                  <div className="text-right">
                    {res.status === 'sold' ? (
                      <div>
                        <div className="font-mono font-black text-[#22c55e] text-base">
                          {res.final_price} pts
                        </div>
                        <div className="text-[10px] font-bold text-[#CBD5E1]">
                          {res.team_name}
                        </div>
                      </div>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-[#ef4444] font-black text-[10px] border border-rose-500/30">
                        UNSOLD
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8] italic">
                No players sold or unsold yet in this session.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer: Four Teams Standings Bar */}
      <footer className="mt-8 pt-6 border-t border-[#334155]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.map((t) => (
            <div
              key={t.id}
              className="p-4 rounded-2xl bg-[#202F45] border border-[#334155] relative overflow-hidden shadow-lg"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1.5"
                style={{ backgroundColor: t.primary_color }}
              />

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-white shadow shrink-0"
                    style={{ backgroundColor: t.primary_color }}
                  >
                    {t.code}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm leading-tight">{t.name}</div>
                    <div className="text-[10px] text-[#94A3B8]">Capt: {t.captain_name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-black text-[#F5B942] text-2xl">
                    {t.remaining_budget}
                  </div>
                  <div className="text-[9px] text-[#94A3B8] uppercase font-bold">Points Left</div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] pt-1.5 text-[#94A3B8] border-t border-[#334155]">
                <span>Squad Size: <strong className="text-white">{t.players_count}</strong></span>
                <span>Retention: <strong className="text-[#CBD5E1]">{t.retention_spent} pts</strong></span>
              </div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}
