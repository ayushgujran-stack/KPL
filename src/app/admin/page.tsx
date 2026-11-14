'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Shield, Users, Trophy, FileText, Database, Key, ArrowRight, Activity, ShieldAlert } from 'lucide-react';

export default function AdminDashboardPage() {
  const { user, isLoading } = useAuth();
  const { state } = useAuction();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (user && ['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      fetch('/api/admin/audit-logs')
        .then((res) => res.json())
        .then((data) => setLogs(data.logs || []))
        .catch(() => {});
    }
  }, [user]);

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
        <p className="text-xs text-[#94A3B8] mt-2 max-w-md mx-auto">
          {user ? `Your signed-in account (${user.name} - ${user.role}) does not have administrative rights to this console.` : 'You must sign in with an authorized administrator account to view this module.'}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href={user ? (user.role === 'captain' ? '/captain' : '/auction/live') : '/login'}
            className="px-5 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition shadow-lg shadow-[#F5B942]/20"
          >
            {user ? 'Return to Permitted View' : 'Sign In Now'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-[#101827] min-h-[calc(100vh-4rem)]">
      {/* Top Banner */}
      <div className="mb-8">
        <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">Administration Console</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Super Admin Command Center</h1>
        <p className="text-xs text-[#94A3B8] mt-1 font-medium">Configure tournament parameters, manage rosters, review audit logs and execute data resets.</p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#94A3B8] uppercase">Franchises</div>
          <div className="text-2xl font-black text-white mt-1 font-mono">{state?.teams?.length ?? 4} Active</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#94A3B8] uppercase">Registered Players</div>
          <div className="text-2xl font-black text-white mt-1 font-mono">{state?.totalPlayers ?? 36} Cricketers</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#22c55e] uppercase">Sold Players</div>
          <div className="text-2xl font-black text-[#22c55e] mt-1 font-mono">{state?.soldCount ?? 0} Completed</div>
        </div>

        <div className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
          <div className="text-xs font-bold text-[#F5B942] uppercase">Retained Players</div>
          <div className="text-2xl font-black text-[#F5B942] mt-1 font-mono">{state?.retainedCount ?? 0} Retained</div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Link
          href="/admin/teams"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-[#3B82F6]/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#60a5fa] mb-4 group-hover:scale-110 transition">
              <Trophy className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#60a5fa]">Team Master</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Configure 4 cricket franchises, primary team colors, captain appointments, and purse balances.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-[#60a5fa] flex items-center gap-1 uppercase tracking-wider">
            Manage Franchises <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/players"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-[#a855f7]/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#a855f7]/15 border border-[#a855f7]/30 flex items-center justify-center text-[#a855f7] mb-4 group-hover:scale-110 transition">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#a855f7]">Player Master</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Register male & female cricketers, set categories and base prices, import bulk Excel datasets.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-[#a855f7] flex items-center gap-1 uppercase tracking-wider">
            Manage Cricketers <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/retention"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-[#F5B942]/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942] mb-4 group-hover:scale-110 transition">
              <Shield className="w-6 h-6 fill-current" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#F5B942]">Retention Management</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Retain up to 2 key players per franchise with automated budget deduction and draw exclusion.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-[#F5B942] flex items-center gap-1 uppercase tracking-wider">
            Manage Retentions <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/reports"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-[#22c55e]/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#16A34A]/15 border border-[#16A34A]/30 flex items-center justify-center text-[#22c55e] mb-4 group-hover:scale-110 transition">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#22c55e]">Auction Reports</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Download complete auction summaries, team roster statements, and full bidding audit logs in Excel format.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-[#22c55e] flex items-center gap-1 uppercase tracking-wider">
            View Reports <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/users"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-[#60a5fa]/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center text-[#60a5fa] mb-4 group-hover:scale-110 transition">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-[#60a5fa]">User & Role Management</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Provision accounts for Super Admin, Organiser 1, Organiser 2, and Team Captain credentials.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-[#60a5fa] flex items-center gap-1 uppercase tracking-wider">
            Manage Credentials <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/settings/data"
          className="p-6 rounded-3xl bg-[#202F45] border border-[#334155] hover:border-rose-400/60 transition group flex flex-col justify-between shadow-xl"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-rose-300">Data Management & Reset</h3>
            <p className="text-xs text-[#CBD5E1] mt-2 leading-relaxed">
              Nuclear operations: Clear Master Data, Clear Transaction Data (balance recalculation), and Complete Auction Reset.
            </p>
          </div>
          <div className="mt-5 text-xs font-black text-rose-400 flex items-center gap-1 uppercase tracking-wider">
            Access Data Reset <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Recent System Audit Logs Table */}
      <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-[#334155] pb-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#F5B942]" />
            System Audit Trail (Latest Actions)
          </h2>
          <span className="text-[10px] text-[#94A3B8] uppercase font-bold">Immutable Log</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-[#334155]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                <th className="py-3 px-3.5">Timestamp</th>
                <th className="py-3 px-3.5">User</th>
                <th className="py-3 px-3.5">Action</th>
                <th className="py-3 px-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60 font-mono text-[11px]">
              {logs.slice(0, 10).map((l) => (
                <tr key={l.id} className="hover:bg-[#182438]/50 transition">
                  <td className="py-3 px-3.5 text-[#94A3B8] whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3.5 font-bold text-white">{l.user_name} ({l.user_role})</td>
                  <td className="py-3 px-3.5 text-[#F5B942] font-black">{l.action}</td>
                  <td className="py-3 px-3.5 text-[#CBD5E1] font-sans">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
