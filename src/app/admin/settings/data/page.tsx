'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import {
  Database,
  Trash2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  FileCheck,
  Shield,
  Layers,
  Activity,
} from 'lucide-react';

export default function AdminDataManagementPage() {
  const { user } = useAuth();
  const { state, refreshState } = useAuction();

  const [activeTab, setActiveTab] = useState<'masters' | 'transactions' | 'complete' | 'backup' | 'audit'>('transactions');

  // Confirmation phrase inputs
  const [masterPhrase, setMasterPhrase] = useState('');
  const [transactionPhrase, setTransactionPhrase] = useState('');
  const [completePhrase, setCompletePhrase] = useState('');
  const [keepRetentionsOnComplete, setKeepRetentionsOnComplete] = useState(true);

  // Master checkboxes
  const [clearPlayers, setClearPlayers] = useState(false);
  const [clearTeams, setClearTeams] = useState(false);
  const [clearCategories, setClearCategories] = useState(false);

  // Status feedback
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch {}
  };

  const handleDownloadBackup = async () => {
    try {
      const res = await fetch('/api/admin/backup');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data.backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename || `kpl_backup_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ type: 'success', text: `Backup ${data.filename} downloaded successfully!` });
      await fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Backup creation failed: ' + err.message });
    }
  };

  const handleClearTransactions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (transactionPhrase !== 'CLEAR TRANSACTIONS') {
      setMessage({ type: 'error', text: 'You must type "CLEAR TRANSACTIONS" exactly to confirm.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/clear-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmationPhrase: transactionPhrase }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setTransactionPhrase('');
      await refreshState();
      await fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleClearMasters = async (e: React.FormEvent) => {
    e.preventDefault();
    if (masterPhrase !== 'CLEAR MASTERS') {
      setMessage({ type: 'error', text: 'You must type "CLEAR MASTERS" exactly to confirm.' });
      return;
    }

    if (!clearPlayers && !clearTeams) {
      setMessage({ type: 'error', text: 'Select at least one master record type to clear.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/clear-masters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationPhrase: masterPhrase,
          options: {
            players: clearPlayers,
            teams: clearTeams,
            categories: clearCategories,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setMasterPhrase('');
      setClearPlayers(false);
      setClearTeams(false);
      await refreshState();
      await fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleResetCompleteAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (completePhrase !== 'RESET AUCTION') {
      setMessage({ type: 'error', text: 'You must type "RESET AUCTION" exactly to confirm.' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/admin/reset-auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirmationPhrase: completePhrase,
          keepRetention: keepRetentionsOnComplete,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessage({ type: 'success', text: data.message });
      setCompletePhrase('');
      await refreshState();
      await fetchLogs();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  if (user?.role !== 'super_admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-[#DC2626] mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white">Super Admin Access Only</h1>
        <p className="text-xs text-[#94A3B8] mt-2">
          The Data Management and Reset module contains destructive operations restricted exclusively to the Super Admin.
        </p>
      </div>
    );
  }

  const isBiddingActive = state?.event?.status?.toUpperCase() === 'BIDDING';

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-extrabold text-rose-400 tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5" />
            Destructive Maintenance Module
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Data Management & Reset Safety</h1>
          <p className="text-xs text-[#94A3B8] mt-1">
            Carefully structured operations for preparing fresh tournaments, clearing auction activity, and creating data backups.
          </p>
        </div>

        <button
          onClick={handleDownloadBackup}
          className="px-4 py-2 rounded-xl bg-[#202F45] hover:bg-[#263852] text-xs font-bold text-white border border-[#334155] flex items-center gap-2 transition shadow-md"
        >
          <Download className="w-3.5 h-3.5 text-emerald-400" />
          Create Snapshot Backup
        </button>
      </div>

      {isBiddingActive && (
        <div className="mb-6 p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <div>
            <strong>AUCTION CURRENTLY IN PROGRESS!</strong>
            <p className="text-[11px] text-rose-300 mt-0.5">
              Reset operations are locked while live bidding is running. Pause or close bidding before initiating any data reset.
            </p>
          </div>
        </div>
      )}

      {message && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-xs flex items-center gap-2 ${
            message.type === 'success'
              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#334155] pb-4 mb-8">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'transactions'
              ? 'bg-[#F5B942] text-[#101827] font-black shadow-lg shadow-[#F5B942]/20'
              : 'bg-[#182438] text-[#CBD5E1] border border-[#334155] hover:text-white'
          }`}
        >
          B. Clear Transaction Data
        </button>

        <button
          onClick={() => setActiveTab('complete')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'complete'
              ? 'bg-[#DC2626] text-white font-black shadow-lg shadow-rose-600/30'
              : 'bg-[#182438] text-[#CBD5E1] border border-[#334155] hover:text-white'
          }`}
        >
          C. Reset Complete Auction
        </button>

        <button
          onClick={() => setActiveTab('masters')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'masters'
              ? 'bg-purple-600 text-white font-black shadow-lg shadow-purple-600/30'
              : 'bg-[#182438] text-[#CBD5E1] border border-[#334155] hover:text-white'
          }`}
        >
          A. Clear Master Data
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
            activeTab === 'audit'
              ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-600/30'
              : 'bg-[#182438] text-[#CBD5E1] border border-[#334155] hover:text-white'
          }`}
        >
          Audit History ({logs.length})
        </button>
      </div>

      {/* Operation B: CLEAR TRANSACTION DATA */}
      {activeTab === 'transactions' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#F5B942]/15 border border-[#F5B942]/30 flex items-center justify-center text-[#F5B942]">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                Clear Transaction Data (Keep Masters)
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Wipes all live auction activity and automatically recalculates team balances.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#182438] border border-[#334155] space-y-3 text-xs text-[#CBD5E1] mb-6">
            <div className="font-bold text-[#F5B942] uppercase text-[11px] tracking-wider">What This Operation Removes:</div>
            <ul className="list-disc list-inside space-y-1.5 text-[#94A3B8] pl-1">
              <li>All bids and chronological bid trails</li>
              <li>Random lottery draw records</li>
              <li>Sold and Unsold transaction results</li>
              <li>Auction player assignments to franchises</li>
            </ul>

            <div className="font-bold text-emerald-400 uppercase text-[11px] tracking-wider pt-2 border-t border-[#334155]/60">What This Preserves & Recalculates:</div>
            <ul className="list-disc list-inside space-y-1.5 text-[#94A3B8] pl-1">
              <li>Preserves all player profiles, photographs, and categories</li>
              <li>Preserves all franchise masters, captain credentials, and admin accounts</li>
              <li>Preserves configured player retentions</li>
              <li>
                <strong className="text-white">Automated Balance Recalculation:</strong> Each franchise budget is set back to 150 points minus retained player costs.
              </li>
              <li>Auction status returns to <strong className="text-[#F5B942]">NOT_STARTED</strong></li>
            </ul>
          </div>

          <form onSubmit={handleClearTransactions} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#CBD5E1] uppercase mb-1.5">
                Type <strong className="text-[#F5B942] font-mono">CLEAR TRANSACTIONS</strong> to confirm:
              </label>
              <input
                type="text"
                disabled={loading || isBiddingActive}
                value={transactionPhrase}
                onChange={(e) => setTransactionPhrase(e.target.value)}
                placeholder="CLEAR TRANSACTIONS"
                className="w-full sm:max-w-md bg-[#182438] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942] focus:ring-1 focus:ring-[#F5B942]"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isBiddingActive || transactionPhrase !== 'CLEAR TRANSACTIONS'}
              className="px-6 py-3.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition shadow-lg shadow-[#F5B942]/20 disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              {loading ? 'Clearing Transactions...' : 'Execute Clear All Transactions'}
            </button>
          </form>
        </div>
      )}

      {/* Operation C: RESET COMPLETE AUCTION */}
      {activeTab === 'complete' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                Reset Complete Auction
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Prepares a completely fresh tournament auction from scratch.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#182438] border border-[#334155] space-y-3 text-xs text-[#CBD5E1] mb-6">
            <div className="font-bold text-rose-400 uppercase text-[11px] tracking-wider">Comprehensive Reset Scope:</div>
            <ul className="list-disc list-inside space-y-1.5 text-[#94A3B8] pl-1">
              <li>Clears all bids, draws, and auction results</li>
              <li>Resets all player statuses to AVAILABLE in pool</li>
              <li>Resets all 4 team budgets back to full 150.0 points</li>
              <li>Resets countdown timer, bidding podium, and auction status to NOT STARTED</li>
              <li>Preserves all players, teams, user accounts, and logos</li>
            </ul>

            <div className="pt-2 border-t border-[#334155]/60">
              <label className="flex items-center gap-2 cursor-pointer text-[#CBD5E1] hover:text-white">
                <input
                  type="checkbox"
                  checked={keepRetentionsOnComplete}
                  onChange={(e) => setKeepRetentionsOnComplete(e.target.checked)}
                  className="w-4 h-4 rounded text-[#F5B942] focus:ring-0 bg-[#182438] border-[#334155]"
                />
                <span>Preserve pre-configured player retentions (uncheck to clear retentions as well)</span>
              </label>
            </div>
          </div>

          <form onSubmit={handleResetCompleteAuction} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#CBD5E1] uppercase mb-1.5">
                Type <strong className="text-rose-400 font-mono">RESET AUCTION</strong> to confirm:
              </label>
              <input
                type="text"
                disabled={loading || isBiddingActive}
                value={completePhrase}
                onChange={(e) => setCompletePhrase(e.target.value)}
                placeholder="RESET AUCTION"
                className="w-full sm:max-w-md bg-[#182438] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-[#94A3B8] focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isBiddingActive || completePhrase !== 'RESET AUCTION'}
              className="px-6 py-3.5 rounded-xl bg-[#DC2626] hover:bg-[#ef4444] text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-rose-600/30 disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              {loading ? 'Executing Reset...' : 'Execute Complete Auction Reset'}
            </button>
          </form>
        </div>
      )}

      {/* Operation A: CLEAR MASTER DATA */}
      {activeTab === 'masters' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 backdrop-blur shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                Clear Master Data (Selective)
              </h2>
              <p className="text-xs text-[#94A3B8]">
                Selectively purge master records when configuring brand-new tournament rosters.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-[#182438] border border-[#334155] space-y-3 text-xs text-[#CBD5E1] mb-6">
            <div className="font-bold text-purple-400 uppercase text-[11px] tracking-wider">Select Masters to Purge:</div>

            <label className="flex items-center gap-2.5 cursor-pointer text-[#CBD5E1] hover:text-white">
              <input
                type="checkbox"
                checked={clearPlayers}
                onChange={(e) => setClearPlayers(e.target.checked)}
                className="w-4 h-4 rounded text-purple-500 focus:ring-0 bg-[#182438] border-[#334155]"
              />
              <span>
                Clear all cricketers ({state?.totalPlayers ?? 0} player records)
              </span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-[#CBD5E1] hover:text-white">
              <input
                type="checkbox"
                checked={clearTeams}
                onChange={(e) => setClearTeams(e.target.checked)}
                className="w-4 h-4 rounded text-purple-500 focus:ring-0 bg-[#182438] border-[#334155]"
              />
              <span>
                Clear all franchise teams ({state?.teams?.length ?? 0} franchises) - unlinks captain credentials safely
              </span>
            </label>

            <div className="p-3.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-200 mt-2">
              <strong>Account Protection:</strong> The Super Admin account and captain login credentials are strictly preserved.
            </div>
          </div>

          <form onSubmit={handleClearMasters} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#CBD5E1] uppercase mb-1.5">
                Type <strong className="text-purple-400 font-mono">CLEAR MASTERS</strong> to confirm:
              </label>
              <input
                type="text"
                disabled={loading || isBiddingActive}
                value={masterPhrase}
                onChange={(e) => setMasterPhrase(e.target.value)}
                placeholder="CLEAR MASTERS"
                className="w-full sm:max-w-md bg-[#182438] border border-[#334155] rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder-[#94A3B8] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400"
              />
            </div>

            <button
              type="submit"
              disabled={loading || isBiddingActive || masterPhrase !== 'CLEAR MASTERS' || (!clearPlayers && !clearTeams)}
              className="px-6 py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider transition shadow-lg shadow-purple-600/30 disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed"
            >
              {loading ? 'Purging Masters...' : 'Purge Selected Master Data'}
            </button>
          </form>
        </div>
      )}

      {/* Audit Log Tab */}
      {activeTab === 'audit' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 backdrop-blur shadow-2xl">
          <div className="flex items-center justify-between mb-4 border-b border-[#334155] pb-3">
            <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Administrative Audit Logs
            </h2>
            <span className="text-[10px] text-[#94A3B8]">Total Entries: {logs.length}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-[11px] font-bold text-[#CBD5E1] uppercase bg-[#182438]">
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Admin</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Audit Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60 font-mono text-[11px]">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-2.5 px-3 text-[#94A3B8] whitespace-nowrap">
                      {new Date(l.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{l.user_name} ({l.user_role})</td>
                    <td className="py-2.5 px-3 text-[#F5B942] font-bold">{l.action}</td>
                    <td className="py-2.5 px-3 text-[#CBD5E1] font-sans">{l.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
