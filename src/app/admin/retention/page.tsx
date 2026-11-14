'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { TeamRetention, Team, Player } from '@/types';
import { Lock, Unlock, Plus, Trash2, ShieldAlert, CheckCircle2, UserCheck, AlertCircle } from 'lucide-react';

export default function AdminRetentionPage() {
  const { user } = useAuth();
  const { state, refreshState } = useAuction();

  const [retentions, setRetentions] = useState<any[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<string>('');
  const [selectedPlayer, setSelectedPlayer] = useState<string>('');
  const [points, setPoints] = useState<string>('20');
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
        fetch('/api/retention'),
        fetch('/api/players?status=available'),
      ]);

      const retData = await retRes.json();
      const plyData = await plyRes.json();

      setRetentions(retData.retentions || []);
      setAvailablePlayers(plyData.players || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchRetentionsAndPlayers();
  }, [state?.event?.status]);

  const handleAddRetention = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!selectedTeam || !selectedPlayer || !points) {
      setError('Please select a franchise, player, and enter valid retention points.');
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

  const handleRemoveRetention = async (id: string) => {
    if (!confirm('Remove this player retention? Points will be returned to team budget.')) return;
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/retention?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSuccessMsg('Retention removed and points refunded.');
      await fetchRetentionsAndPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">Squad Strategy</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Player Retention Management</h1>
          <p className="text-xs text-slate-400 mt-1">
            Franchises can retain a maximum of 2 key cricketers prior to the live auction.
          </p>
        </div>

        <div>
          {isAuctionStarted ? (
            <span className="px-3.5 py-1.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              Retentions Locked (Auction Started)
            </span>
          ) : (
            <span className="px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              Pre-Auction Window Open
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Grid: Form vs Roster Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8">
        {/* Retention Assignment Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl">
          <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-400" />
            Assign Player Retention
          </h2>

          <form onSubmit={handleAddRetention} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-bold uppercase mb-1">Select Franchise</label>
              <select
                disabled={isAuctionStarted}
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white disabled:opacity-50"
              >
                <option value="">-- Choose Franchise --</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (Retained: {t.retention_spent} pts, Left: {t.remaining_budget} pts)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold uppercase mb-1">Select Cricketer</label>
              <select
                disabled={isAuctionStarted}
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white disabled:opacity-50"
              >
                <option value="">-- Choose Eligible Cricketer --</option>
                {availablePlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.role}, {p.category} - Base {p.base_price} pts)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-bold uppercase mb-1">Retention Points</label>
              <input
                type="number"
                disabled={isAuctionStarted}
                required
                min="1"
                max="150"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="e.g. 20"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Deducted immediately from 150 points purse. Example: 20 pts + 15 pts = 35 pts spent.
              </p>
            </div>

            <button
              type="submit"
              disabled={isAuctionStarted || !selectedTeam || !selectedPlayer}
              className="w-full mt-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition disabled:opacity-40"
            >
              Confirm Retention
            </button>
          </form>
        </div>

        {/* Existing Retentions Table (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Current Retained Cricketers ({retentions.length})
              </h2>
              <span className="text-[11px] text-amber-400 font-bold">Max 2 Per Team</span>
            </div>

            {retentions.length > 0 ? (
              <div className="space-y-3">
                {retentions.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs transition hover:border-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={r.photo_url}
                        alt={r.player_name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-700 shrink-0"
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
                          <span className="text-slate-400 text-[10px]">{r.player_role}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="font-black font-mono text-amber-400 text-sm">{r.points} pts</div>
                        <div className="text-[9px] text-slate-400 uppercase">Retention Cost</div>
                      </div>

                      {!isAuctionStarted && (
                        <button
                          onClick={() => handleRemoveRetention(r.id)}
                          title="Release Retention"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                No players retained yet. Assign retentions using the form.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
