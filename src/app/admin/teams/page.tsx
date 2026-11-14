'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Team } from '@/types';
import { Users, Plus, Edit2, Trash2, Trophy, Check, X, ShieldAlert } from 'lucide-react';

export default function AdminTeamsPage() {
  const { user } = useAuth();
  const { state, refreshState } = useAuction();

  const [teams, setTeams] = useState<Team[]>([]);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#2563eb');
  const [captainName, setCaptainName] = useState('');
  const [initialBudget, setInitialBudget] = useState('150');

  useEffect(() => {
    fetchTeams();
  }, [state?.teams]);

  const fetchTeams = async () => {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      setTeams(data.teams || []);
    } catch {}
  };

  const handleOpenEdit = (team: Team) => {
    setEditingTeam(team);
    setName(team.name);
    setCode(team.code);
    setLogoUrl(team.logo_url);
    setPrimaryColor(team.primary_color);
    setCaptainName(team.captain_name);
    setInitialBudget(String(team.initial_budget));
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const payload = {
      name,
      code,
      logo_url: logoUrl,
      primary_color: primaryColor,
      captain_name: captainName,
      initial_budget: Number(initialBudget) || 150,
    };

    try {
      if (editingTeam) {
        // PUT
        const res = await fetch(`/api/teams/${editingTeam.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update team');
      } else {
        // POST
        const res = await fetch('/api/teams', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add team');
      }

      setEditingTeam(null);
      setShowAddModal(false);
      await fetchTeams();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Are you sure you want to delete this team? Any associated bids and retentions will be removed.')) return;

    try {
      const res = await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchTeams();
      await refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">Master Configuration</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Team Master</h1>
          <p className="text-xs text-slate-400 mt-1">Configure cricket franchises, team colors, captains, and starting budgets.</p>
        </div>

        <button
          onClick={() => {
            setEditingTeam(null);
            setName('');
            setCode('');
            setLogoUrl('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&h=200&fit=crop&q=80');
            setPrimaryColor('#3b82f6');
            setCaptainName('');
            setInitialBudget('150');
            setShowAddModal(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          Add Franchise
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Team Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {teams.map((t) => (
          <div
            key={t.id}
            className="rounded-3xl p-6 bg-slate-900/80 border border-slate-800 backdrop-blur shadow-xl relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Team Color Header */}
            <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: t.primary_color }} />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg text-white shadow-lg"
                  style={{ backgroundColor: t.primary_color }}
                >
                  {t.code}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(t)}
                    title="Edit Franchise"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteTeam(t.id)}
                    title="Delete Franchise"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="text-xl font-bold text-white leading-tight">{t.name}</h3>
              <p className="text-xs text-slate-400 mt-1">
                Captain: <strong className="text-slate-200">{t.captain_name}</strong>
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Initial Purse:</span>
                <span className="font-bold text-white">{t.initial_budget} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Remaining:</span>
                <span className="font-extrabold text-amber-400">{t.remaining_budget} pts</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Roster Count:</span>
                <span className="font-semibold text-slate-200">{t.players_count} players</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Add Modal */}
      {(showAddModal || editingTeam) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowAddModal(false);
                setEditingTeam(null);
              }}
              className="absolute top-5 right-5 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-4">
              {editingTeam ? 'Edit Franchise' : 'Create New Franchise'}
            </h2>

            <form onSubmit={handleSaveTeam} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-bold uppercase mb-1">Franchise Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Gujarat Titans"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-bold uppercase mb-1">Short Code</label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. GT"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-bold uppercase mb-1">Theme Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-8 rounded bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-2 py-1.5 text-white font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase mb-1">Captain Name</label>
                <input
                  type="text"
                  required
                  value={captainName}
                  onChange={(e) => setCaptainName(e.target.value)}
                  placeholder="e.g. Hardik Pandya"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold uppercase mb-1">Initial Budget (Pts)</label>
                <input
                  type="number"
                  required
                  value={initialBudget}
                  onChange={(e) => setInitialBudget(e.target.value)}
                  placeholder="150"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingTeam(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black"
                >
                  Save Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
