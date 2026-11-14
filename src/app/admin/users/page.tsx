'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { User, UserRole } from '@/types';
import { Plus, Trash2, X } from 'lucide-react';

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('captain');
  const [teamId, setTeamId] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      setUsers(data.users || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name, role, team_id: teamId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowModal(false);
      setUsername('');
      setPassword('');
      setName('');
      await fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to remove this user account?')) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-[#101827] min-h-[calc(100vh-4rem)]">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">Access Control</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">User & Role Management</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">Manage credentials for Super Admin, Organisers, and Team Captains.</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="px-5 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-[#F5B942]/20"
        >
          <Plus className="w-4 h-4" />
          Create User Account
        </button>
      </div>

      <div className="bg-[#202F45] border border-[#334155] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase tracking-wider bg-[#182438]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Username</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Associated Franchise</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#182438]/50 transition">
                  <td className="py-3.5 px-4 font-bold text-white flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#182438] border border-[#334155] flex items-center justify-center text-[#F5B942] font-black text-xs">
                      {u.name.charAt(0)}
                    </div>
                    {u.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[#CBD5E1]">{u.username}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        u.role === 'super_admin'
                          ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40'
                          : u.role.startsWith('organiser')
                          ? 'bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/40'
                          : 'bg-[#3B82F6]/15 text-[#60a5fa] border border-[#3B82F6]/40'
                      }`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#CBD5E1]">
                    {(u as any).team_name || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {u.id !== currentUser?.id ? (
                      <button
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-2 rounded-xl bg-[#182438] hover:bg-rose-950/50 text-[#94A3B8] hover:text-rose-400 transition border border-[#334155]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="text-[10px] text-[#F5B942] font-black uppercase tracking-wider bg-[#F5B942]/10 px-2 py-0.5 rounded border border-[#F5B942]/20">Current User</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-4">
              Add User Account
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Dravid"
                  className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. captain_rd"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Password</label>
                  <input
                    type="text"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="cap123"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-[#F5B942]"
                >
                  <option value="captain" className="bg-[#182438] text-white">Team Captain</option>
                  <option value="organiser_1" className="bg-[#182438] text-white">Auction Organiser 1 (Lead)</option>
                  <option value="organiser_2" className="bg-[#182438] text-white">Auction Organiser 2 (Assistant)</option>
                  <option value="super_admin" className="bg-[#182438] text-white">Super Admin</option>
                </select>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#334155] hover:bg-[#475569] text-white font-bold transition border border-[#475569]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black transition shadow-md shadow-[#F5B942]/20"
                >
                  Create Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
