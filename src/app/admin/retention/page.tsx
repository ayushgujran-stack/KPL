'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Player } from '@/types';
import { Lock, Unlock, Plus, Trash2, CheckCircle2, AlertCircle, ShieldAlert, Edit2, RotateCcw, X, Check } from 'lucide-react';

export default function AdminRetentionPage() {
  const { user, isLoading } = useAuth();
  const { state, refreshState } = useAuction();

  const [retentions, setRetentions] = useState<any[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [points, setPoints] = useState<string>('20');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPoints, setEditPoints] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const teams = state?.teams || [];
  const event = state?.event;
  const isAuctionStarted = event && event.status.toUpperCase() !== 'NOT_STARTED';

  const fetchRetentionsAndPlayers = async () => {
    setLoading(true);
    try {
      const [retRes, plyRes] = await Promise.all([
        fetch('/api/retention', { cache: 'no-store' }),
        fetch('/api/players?status=available', { cache: 'no-store' }),
      ]);

      const retData = await retRes.json();
      const plyData = await plyRes.json();

      setRetentions(retData.retentions || []);
      setAvailablePlayers(plyData.players || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (user && ['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      fetchRetentionsAndPlayers();
    }
  }, [state?.event?.status, user]);

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[#101827] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5B942] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto mb-4">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">Administrator Access Required</h1>
        <p className="text-xs text-[#94A3B8] mt-2">
          Player retention configuration and purse allocation are restricted to Super Admins and Organisers.
        </p>
        <div className="mt-6">
          <Link
            href="/admin"
            className="px-5 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition shadow-lg shadow-[#F5B942]/20"
          >
            Back to Admin Center
          </Link>
        </div>
      </div>
    );
  }

  // Count retentions per team
  const teamRetentionCounts = retentions.reduce((acc: Record<string, number>, r) => {
    acc[r.team_id] = (acc[r.team_id] || 0) + 1;
    return acc;
  }, {});

  const handlePlayerChange = (playerId: string) => {
    setSelectedPlayer(playerId);
    const chosen = availablePlayers.find((p) => p.id === playerId);
    if (chosen) {
      setPoints(String(chosen.base_price));
    }
  };

  const handleAddRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedTeam || !selectedPlayer || !points) {
      setError('Please select a franchise, player, and enter valid retention points.');
      return;
    }

    const currentCount = teamRetentionCounts[selectedTeam] || 0;
    if (currentCount >= 2) {
      setError('Selected franchise has already reached the maximum limit of 2 retained players.');
      return;
    }

    try {
      const res = await fetch('/api/retention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          team_id: selectedTeam,
          player_id: selectedPlayer,
          points: Number(points),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to retain player');

      setSuccessMsg('Player retained successfully! Points deducted from franchise purse.');
      setSelectedPlayer('');
      await fetchRetentionsAndPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateRetention = async (id: string) => {
    setError(null);
    setSuccessMsg(null);

    const numPoints = Number(editPoints);
    if (!numPoints || numPoints <= 0) {
      setError('Please enter a valid positive number of points.');
      return;
    }

    try {
      const res = await fetch('/api/retention', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, points: numPoints }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update retention points');

      setSuccessMsg('Retention points updated successfully!');
      setEditingId(null);
      await fetchRetentionsAndPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveRetention = async (id: string) => {
    if (!confirm('Remove this player retention? Points will be returned to team budget.')) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/retention?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove retention');

      setSuccessMsg('Retention removed and points refunded.');
      await fetchRetentionsAndPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlockRetentions = async () => {
    if (!confirm('Reset current auction stage to PRE-AUCTION (NOT_STARTED) to unlock player retention modifications?')) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unlock_retention' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlock retentions');

      setSuccessMsg('Pre-auction window unlocked! Retentions can now be edited.');
      await fetchRetentionsAndPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-[#101827] min-h-[calc(100vh-4rem)]">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">Squad Strategy</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Player Retention Management</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">
            Franchises can retain a maximum of 2 key cricketers prior to the live auction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAuctionStarted ? (
            <div className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                Retentions Locked ({event?.status})
              </span>
              <button
                onClick={handleUnlockRetentions}
                className="px-3.5 py-2 rounded-xl bg-[#182438] hover:bg-[#202F45] border border-[#F5B942]/50 text-[#F5B942] text-xs font-bold flex items-center gap-1.5 transition shadow"
                title="Reset status to NOT_STARTED to configure retentions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Unlock Window
              </button>
            </div>
          ) : (
            <span className="px-4 py-2 rounded-full bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40 text-xs font-bold flex items-center gap-1.5 shadow-sm">
              <Unlock className="w-3.5 h-3.5 text-[#22c55e]" />
              Pre-Auction Window Open
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 font-semibold">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-[#16A34A]/15 border border-[#16A34A]/30 text-[#22c55e] text-xs flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#22c55e]" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Form vs Roster Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        {/* Retention Assignment Form (5 cols) */}
        <div className="lg:col-span-5 bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl">
          <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#F5B942]" />
            Assign Player Retention
          </h2>

          <form onSubmit={handleAddRetention} className="space-y-4 text-xs">
            <div>
              <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Select Franchise</label>
              <select
                disabled={isAuctionStarted}
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white disabled:opacity-50 focus:outline-none focus:border-[#F5B942]"
              >
                <option value="" className="bg-[#182438] text-white">-- Choose Franchise --</option>
                {teams.map((t) => {
                  const count = teamRetentionCounts[t.id] || 0;
                  const isMax = count >= 2;
                  return (
                    <option key={t.id} value={t.id} disabled={isMax} className="bg-[#182438] text-white">
                      {t.name} ({count}/2 retained) — {t.remaining_budget} pts left {isMax ? ' [MAX]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Select Cricketer</label>
              <select
                disabled={isAuctionStarted}
                value={selectedPlayer}
                onChange={(e) => handlePlayerChange(e.target.value)}
                className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white disabled:opacity-50 focus:outline-none focus:border-[#F5B942]"
              >
                <option value="" className="bg-[#182438] text-white">-- Choose Eligible Cricketer --</option>
                {availablePlayers.map((p) => (
                  <option key={p.id} value={p.id} className="bg-[#182438] text-white">
                    {p.name} ({p.role}, {p.category} — Base {p.base_price} pts)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Retention Points</label>
              <input
                type="number"
                disabled={isAuctionStarted}
                required
                min="1"
                max="150"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="e.g. 20"
                className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-[#94A3B8] disabled:opacity-50 focus:outline-none focus:border-[#F5B942]"
              />
              <p className="text-[10px] text-[#94A3B8] mt-1 font-medium">
                Deducted immediately from 150 points purse. Example: 20 pts + 15 pts = 35 pts spent.
              </p>
            </div>

            <button
              type="submit"
              disabled={isAuctionStarted || !selectedTeam || !selectedPlayer || (teamRetentionCounts[selectedTeam] || 0) >= 2}
              className="w-full mt-2 py-3.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider shadow-lg shadow-[#F5B942]/20 transition disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              Confirm Retention
            </button>
          </form>
        </div>

        {/* Existing Retentions Table (7 cols) */}
        <div className="lg:col-span-7 bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-[#334155] pb-3">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Current Retained Cricketers ({retentions.length})
              </h2>
              <span className="text-[11px] text-[#F5B942] font-black uppercase">Max 2 Per Team</span>
            </div>

            {retentions.length > 0 ? (
              <div className="space-y-3">
                {retentions.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-[#182438] border border-[#334155] flex items-center justify-between text-xs transition hover:border-[#F5B942]/40"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={r.photo_url || '/default-player-avatar.svg'}
                        alt={r.player_name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/default-player-avatar.svg';
                        }}
                        className="w-12 h-12 rounded-xl object-cover border border-[#334155] shrink-0 bg-[#182438]"
                      />
                      <div>
                        <div className="font-bold text-white text-sm">{r.player_name}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                            style={{ backgroundColor: r.team_color }}
                          >
                            {r.team_name}
                          </span>
                          <span className="text-[#94A3B8] text-[10px]">{r.player_role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {editingId === r.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            max="150"
                            value={editPoints}
                            onChange={(e) => setEditPoints(e.target.value)}
                            className="w-16 px-2 py-1 bg-[#202F45] border border-[#F5B942] rounded-lg text-white font-mono text-xs focus:outline-none"
                          />
                          <button
                            onClick={() => handleUpdateRetention(r.id)}
                            className="p-1.5 rounded-lg bg-[#16A34A] text-white hover:bg-[#22c55e] transition"
                            title="Save Points"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1.5 rounded-lg bg-[#334155] text-[#CBD5E1] hover:text-white transition"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="text-right">
                          <div className="font-black font-mono text-[#F5B942] text-sm flex items-center justify-end gap-1.5">
                            {r.points} pts
                            {!isAuctionStarted && (
                              <button
                                onClick={() => {
                                  setEditingId(r.id);
                                  setEditPoints(String(r.points));
                                }}
                                title="Edit Points"
                                className="text-[#94A3B8] hover:text-[#F5B942] transition p-0.5"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <div className="text-[9px] text-[#94A3B8] uppercase font-bold">Retention Cost</div>
                        </div>
                      )}

                      {!isAuctionStarted && editingId !== r.id && (
                        <button
                          onClick={() => handleRemoveRetention(r.id)}
                          title="Release Retention"
                          className="p-2 rounded-xl bg-[#202F45] hover:bg-rose-950/50 text-[#94A3B8] hover:text-rose-400 transition border border-[#334155]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-[#94A3B8] italic bg-[#182438] rounded-2xl border border-[#334155]">
                No players retained yet. Assign retentions using the form.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
