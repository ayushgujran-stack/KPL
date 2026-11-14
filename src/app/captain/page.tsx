'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CaptainDashboardPage() {
  const { user } = useAuth();
  const { state } = useAuction();

  const [teamSquad, setTeamSquad] = useState<any[]>([]);

  const teams = state?.teams || [];
  // Find captain's team
  const myTeam = teams.find((t) => t.id === user?.team_id) || teams[0];

  useEffect(() => {
    if (!myTeam) return;

    fetch(`/api/teams/${myTeam.id}`)
      .then((res) => res.json())
      .then((data) => {
        setTeamSquad(data.squad || []);
      })
      .catch(() => {});
  }, [myTeam?.id, state?.soldCount]);

  const maleCount = teamSquad.filter((p) => p.gender === 'Male').length;
  const femaleCount = teamSquad.filter((p) => p.gender === 'Female').length;

  const event = state?.event;
  const currentStatus = event?.status ? event.status.toUpperCase() : 'NOT_STARTED';
  const isBiddingActive = currentStatus === 'BIDDING';
  const isHighestBidder = event?.current_bid_team_id === myTeam?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-[#101827] min-h-[calc(100vh-4rem)]">
      {/* Top Banner Card */}
      <div
        className="rounded-3xl p-6 sm:p-8 border border-[#334155] bg-[#202F45] shadow-2xl relative overflow-hidden mb-8"
      >
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: myTeam?.primary_color || '#3b82f6' }}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl shrink-0"
              style={{ backgroundColor: myTeam?.primary_color || '#3b82f6' }}
            >
              {myTeam?.code}
            </div>
            <div>
              <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">
                Captain Headquarters
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{myTeam?.name}</h1>
              <p className="text-xs text-[#94A3B8]">
                Captain: <strong className="text-white font-bold">{myTeam?.captain_name}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase font-bold text-[#94A3B8]">Remaining Purse</div>
            <div className="text-3xl sm:text-4xl font-black text-[#F5B942] font-mono">
              {myTeam?.remaining_budget ?? 150} <span className="text-base font-sans font-bold text-[#FFD66B]">pts</span>
            </div>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-[#94A3B8] mb-1.5 font-medium">
            <span>Budget Utilized</span>
            <span>{150 - (myTeam?.remaining_budget ?? 150)} / 150 Pts</span>
          </div>
          <div className="w-full bg-[#182438] h-2.5 rounded-full overflow-hidden border border-[#334155]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, ((150 - (myTeam?.remaining_budget ?? 150)) / 150) * 100)}%`,
                backgroundColor: myTeam?.primary_color || '#3b82f6',
              }}
            />
          </div>
        </div>
      </div>

      {/* 4 Financial & Composition Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#94A3B8] uppercase">Initial Purse</div>
          <div className="text-2xl font-black text-white font-mono mt-1">150.0 pts</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#F5B942] uppercase">Retention Spent</div>
          <div className="text-2xl font-black text-[#F5B942] font-mono mt-1">
            {myTeam?.retention_spent ?? 0} pts
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#60a5fa] uppercase">Auction Spent</div>
          <div className="text-2xl font-black text-[#60a5fa] font-mono mt-1">
            {myTeam?.auction_spent ?? 0} pts
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#a855f7] uppercase">Squad Balance</div>
          <div className="text-sm font-black text-white mt-2">
            Total: <span className="text-[#F5B942]">{teamSquad.length}</span> (M: {maleCount}, F: {femaleCount})
          </div>
        </div>
      </div>

      {/* Quick Action to Enter Live Auction */}
      {isBiddingActive && (
        <div className="p-6 rounded-2xl bg-[#202F45] border-2 border-[#F5B942]/40 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div>
            <div className="text-xs font-black uppercase text-[#22c55e] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
              Live Auction Active Now
            </div>
            <div className="text-lg font-black text-white mt-1">
              Currently Bidding: {state?.currentPlayer?.name || 'Player'}
            </div>
            <div className="text-xs text-[#CBD5E1] mt-0.5">
              Current Bid: <strong className="text-[#F5B942] font-mono">{event?.current_bid} pts</strong>
              {isHighestBidder && <span className="ml-2 text-[#22c55e] font-black">★ Your Team is Highest Bidder!</span>}
            </div>
          </div>

          <Link
            href="/auction/live"
            className="px-6 py-3 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition shadow-lg shadow-[#F5B942]/20 flex items-center gap-2 shrink-0"
          >
            Go to Live Bidding Podium
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Squad Roster Table */}
      <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-[#F5B942]" />
              Official Team Roster ({teamSquad.length} Players)
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">Retained and successfully purchased cricketers</p>
          </div>
        </div>

        {teamSquad.length > 0 ? (
          <div className="overflow-x-auto rounded-2xl border border-[#334155]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#182438] text-[11px] font-black text-[#94A3B8] uppercase tracking-wider border-b border-[#334155]">
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Acquisition</th>
                  <th className="py-3 px-4 text-right">Points Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60 text-xs">
                {teamSquad.map((player) => (
                  <tr key={player.id} className="hover:bg-[#182438]/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          className="w-10 h-10 rounded-xl object-cover border border-[#334155] shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{player.name}</div>
                          <div className="text-[10px] text-[#94A3B8] font-mono">#{player.player_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#CBD5E1] font-semibold">{player.gender}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#3B82F6]/20 text-[#60a5fa] border border-[#3B82F6]/40 text-[11px] font-bold">
                        {player.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          player.acquisition_type === 'retained'
                            ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/30'
                            : 'bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/30'
                        }`}
                      >
                        {player.acquisition_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black font-mono text-[#F5B942] text-sm">
                      {player.acquisition_price} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-[#94A3B8] italic bg-[#182438] rounded-2xl border border-[#334155]">
            No players currently assigned to {myTeam?.name}. Players will appear here once retained or won in live bidding.
          </div>
        )}
      </div>
    </div>
  );
}
