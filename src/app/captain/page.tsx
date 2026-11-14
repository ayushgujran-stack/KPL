'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Trophy, Users, DollarSign, Shield, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function CaptainDashboardPage() {
  const { user } = useAuth();
  const { state, placeBid } = useAuction();

  const [teamSquad, setTeamSquad] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [myTeam?.id, state?.soldCount]);

  const maleCount = teamSquad.filter((p) => p.gender === 'Male').length;
  const femaleCount = teamSquad.filter((p) => p.gender === 'Female').length;

  const event = state?.event;
  const currentStatus = event?.status ? event.status.toUpperCase() : 'NOT_STARTED';
  const isBiddingActive = currentStatus === 'BIDDING';
  const isHighestBidder = event?.current_bid_team_id === myTeam?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner Card */}
      <div
        className="rounded-3xl p-6 sm:p-8 border backdrop-blur shadow-2xl relative overflow-hidden mb-8"
        style={{
          backgroundColor: '#0a0f1d',
          borderColor: myTeam ? `${myTeam.primary_color}60` : '#334155',
        }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: myTeam?.primary_color || '#3b82f6' }}
        />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl text-white shadow-xl"
              style={{ backgroundColor: myTeam?.primary_color || '#3b82f6' }}
            >
              {myTeam?.code}
            </div>
            <div>
              <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">
                Captain Headquarters
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white">{myTeam?.name}</h1>
              <p className="text-xs text-slate-400">
                Captain: <strong className="text-slate-200">{myTeam?.captain_name}</strong>
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs uppercase font-bold text-slate-400">Remaining Purse</div>
            <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
              {myTeam?.remaining_budget ?? 150} <span className="text-base font-sans font-bold">pts</span>
            </div>
          </div>
        </div>

        {/* Budget Progress Bar */}
        <div className="mt-6">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>Budget Utilized</span>
            <span>{150 - (myTeam?.remaining_budget ?? 150)} / 150 Pts</span>
          </div>
          <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
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
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
          <div className="text-xs font-bold text-slate-400 uppercase">Initial Purse</div>
          <div className="text-2xl font-black text-white font-mono mt-1">150.0 pts</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur">
          <div className="text-xs font-bold text-amber-400 uppercase">Retention Spent</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {myTeam?.retention_spent ?? 0} pts
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-blue-500/20 backdrop-blur">
          <div className="text-xs font-bold text-blue-400 uppercase">Auction Spent</div>
          <div className="text-2xl font-black text-blue-400 font-mono mt-1">
            {myTeam?.auction_spent ?? 0} pts
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/20 backdrop-blur">
          <div className="text-xs font-bold text-purple-400 uppercase">Squad Balance</div>
          <div className="text-sm font-extrabold text-white mt-1">
            Total: <span className="text-amber-400">{teamSquad.length}</span> (M: {maleCount}, F: {femaleCount})
          </div>
        </div>
      </div>

      {/* Quick Action to Enter Live Auction */}
      {isBiddingActive && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-slate-900 to-amber-500/20 border border-emerald-500/40 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Auction Active Now
            </div>
            <div className="text-lg font-black text-white">
              Currently Bidding: {state?.currentPlayer?.name || 'Player'}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Current Bid: <strong className="text-amber-400">{event?.current_bid} pts</strong>
              {isHighestBidder && <span className="ml-2 text-emerald-400 font-bold">★ Your Team is Highest Bidder!</span>}
            </div>
          </div>

          <Link
            href="/auction/live"
            className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            Go to Live Auction Bidding
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Squad Roster Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              Official Team Roster ({teamSquad.length} Players)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Retained and successfully purchased cricketers</p>
          </div>
        </div>

        {teamSquad.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Acquisition</th>
                  <th className="py-3 px-4 text-right">Points Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {teamSquad.map((player) => (
                  <tr key={player.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={player.photo_url}
                          alt={player.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-700 shrink-0"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{player.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">#{player.player_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-semibold">{player.gender}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[11px] font-bold">
                        {player.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          player.acquisition_type === 'retained'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {player.acquisition_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black font-mono text-amber-400 text-sm">
                      {player.acquisition_price} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-slate-400 italic">
            No players currently assigned to {myTeam?.name}. Players will appear here once retained or won in live bidding.
          </div>
        )}
      </div>
    </div>
  );
}
