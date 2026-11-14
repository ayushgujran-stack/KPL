'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Shield, Users, Trophy, FileText, Database, Key, Radio, Shuffle, ArrowRight, Activity } from 'lucide-react';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { state } = useAuction();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/admin/audit-logs')
      .then((res) => res.json())
      .then((data) => setLogs(data.logs || []))
      .catch(() => {});
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner */}
      <div className="mb-8">
        <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider">Administration Console</div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Super Admin Command Center</h1>
        <p className="text-xs text-slate-400 mt-1">Configure tournament parameters, manage rosters, review audit logs and execute data resets.</p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
          <div className="text-xs font-bold text-slate-400 uppercase">Franchises</div>
          <div className="text-2xl font-black text-white mt-1">{state?.teams?.length ?? 4} Active</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur">
          <div className="text-xs font-bold text-slate-400 uppercase">Registered Players</div>
          <div className="text-2xl font-black text-white mt-1">{state?.totalPlayers ?? 36} Cricketers</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/20 backdrop-blur">
          <div className="text-xs font-bold text-emerald-400 uppercase">Sold Players</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{state?.soldCount ?? 0} Completed</div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 backdrop-blur">
          <div className="text-xs font-bold text-amber-400 uppercase">Retained Players</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{state?.retainedCount ?? 0} Retained</div>
        </div>
      </div>

      {/* Admin Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Link
          href="/admin/teams"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-blue-400/40 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 group-hover:scale-110 transition">
              <Trophy className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-blue-300">Team Master</h3>
            <p className="text-xs text-slate-400 mt-2">
              Configure 4 cricket franchises, primary team colors, captain appointments, and purse balances.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-blue-400 flex items-center gap-1">
            Manage Franchises <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/players"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-purple-400/40 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-110 transition">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-purple-300">Player Master</h3>
            <p className="text-xs text-slate-400 mt-2">
              Register male & female cricketers, set categories and base prices, import bulk Excel datasets.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-purple-400 flex items-center gap-1">
            Manage Cricketers <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/retention"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-amber-400/40 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 group-hover:scale-110 transition">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-amber-300">Retention Management</h3>
            <p className="text-xs text-slate-400 mt-2">
              Retain up to 2 key players per franchise with automated budget deduction and draw exclusion.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-amber-400 flex items-center gap-1">
            Manage Retentions <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/reports"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-emerald-400/40 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-emerald-300">Auction Reports</h3>
            <p className="text-xs text-slate-400 mt-2">
              Download complete auction summaries, team roster statements, and full bidding audit logs in Excel format.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-emerald-400 flex items-center gap-1">
            View Reports <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/users"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-indigo-400/40 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4 group-hover:scale-110 transition">
              <Key className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300">User & Role Management</h3>
            <p className="text-xs text-slate-400 mt-2">
              Provision accounts for Super Admin, Organiser 1, Organiser 2, and Team Captain credentials.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-indigo-400 flex items-center gap-1">
            Manage Credentials <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>

        <Link
          href="/admin/settings/data"
          className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-rose-400/50 transition group flex flex-col justify-between"
        >
          <div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 group-hover:scale-110 transition">
              <Database className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-rose-300">Data Management & Reset</h3>
            <p className="text-xs text-slate-400 mt-2">
              Nuclear operations: Clear Master Data, Clear Transaction Data (balance recalculation), and Complete Auction Reset.
            </p>
          </div>
          <div className="mt-4 text-xs font-bold text-rose-400 flex items-center gap-1">
            Access Data Reset <ArrowRight className="w-3.5 h-3.5" />
          </div>
        </Link>
      </div>

      {/* Recent System Audit Logs Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 backdrop-blur shadow-2xl">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            System Audit Trail (Latest Actions)
          </h2>
          <span className="text-[10px] text-slate-400 uppercase">Immutable Log</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase bg-slate-950/40">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">User</th>
                <th className="py-2.5 px-3">Action</th>
                <th className="py-2.5 px-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
              {logs.slice(0, 10).map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-200">{l.user_name} ({l.user_role})</td>
                  <td className="py-2.5 px-3 text-amber-400 font-bold">{l.action}</td>
                  <td className="py-2.5 px-3 text-slate-300 font-sans">{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
