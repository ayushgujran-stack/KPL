'use client';

import React, { useState, useEffect } from 'react';
import { Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function AdminReportsPage() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'squads' | 'sold' | 'unsold' | 'bids' | 'draws' | 'analytics'>('squads');

  useEffect(() => {
    fetch('/api/reports')
      .then((res) => res.json())
      .then((data) => setReportData(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleExportExcel = () => {
    if (!reportData) return;

    const wb = XLSX.utils.book_new();

    // 1. Teams Summary
    const teamsSummary = reportData.teams.map((t: any) => ({
      Franchise: t.name,
      Code: t.code,
      Captain: t.captain_name,
      'Initial Purse': t.initial_budget,
      'Retention Spent': t.retention_spent,
      'Auction Spent': t.auction_spent,
      'Remaining Purse': t.remaining_budget,
      'Total Players': t.players_count,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(teamsSummary), 'Teams Summary');

    // 2. Sold Players
    const soldList = reportData.soldPlayers.map((p: any) => ({
      'Player ID': p.player_number,
      Name: p.name,
      Gender: p.gender,
      Role: p.role,
      Category: p.category,
      'Base Price': p.base_price,
      'Winning Bid (Pts)': p.final_price,
      'Sold Franchise': p.team_name,
      'Confirmed By': p.confirmed_by,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(soldList), 'Sold Players');

    // 3. Retained Players
    const retList = reportData.retainedPlayers.map((p: any) => ({
      'Player ID': p.player_number,
      Name: p.name,
      Gender: p.gender,
      Role: p.role,
      'Retention Points': p.retention_points,
      Franchise: p.team_name,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(retList), 'Retained Players');

    // 4. Unsold Players
    const unsoldList = reportData.unsoldPlayers.map((p: any) => ({
      'Player ID': p.player_number,
      Name: p.name,
      Gender: p.gender,
      Role: p.role,
      Category: p.category,
      'Base Price': p.base_price,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(unsoldList), 'Unsold Players');

    // 5. Bids History
    const bidsList = reportData.bidsHistory.map((b: any) => ({
      'Player': b.player_name,
      'Franchise': b.team_name,
      'Amount (Pts)': b.amount,
      'Bidder': b.bidder_name,
      'Timestamp': b.timestamp,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bidsList), 'Bids Log');

    XLSX.writeFile(wb, `KPL_Auction_Complete_Report_${Date.now()}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-[#94A3B8] bg-[#101827] min-h-[calc(100vh-4rem)]">Loading auction analytical reports...</div>
    );
  }

  const { teams = [], soldPlayers = [], retainedPlayers = [], unsoldPlayers = [], bidsHistory = [], drawHistory = [], genderStats = [], roleStats = [] } = reportData || {};

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-[#101827] min-h-[calc(100vh-4rem)] print:p-0 print:bg-white print:text-black">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 print:hidden">
        <div>
          <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">Tournament Analytics</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Auction Reports & Audits</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">Export comprehensive auction results, roster statements, and bidding trails.</p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold border border-[#475569] transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#22c55e]" />
            Export Full Excel
          </button>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold border border-[#475569] transition flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-[#60a5fa]" />
            Print Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#334155] pb-4 mb-6 print:hidden">
        {[
          { id: 'squads', label: 'Team Squads & Purse' },
          { id: 'sold', label: `Sold Players (${soldPlayers.length})` },
          { id: 'unsold', label: `Unsold Players (${unsoldPlayers.length})` },
          { id: 'bids', label: `Bidding Trail (${bidsHistory.length})` },
          { id: 'draws', label: `Lottery Draws (${drawHistory.length})` },
          { id: 'analytics', label: 'Demographics & Roles' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition uppercase tracking-wider ${
              activeTab === tab.id
                ? 'bg-[#F5B942] text-[#101827] shadow-md shadow-[#F5B942]/20'
                : 'bg-[#182438] text-[#CBD5E1] hover:text-white hover:bg-[#263852] border border-[#334155]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Squads & Budget */}
      {activeTab === 'squads' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.map((t: any) => (
              <div key={t.id} className="p-5 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shrink-0"
                    style={{ backgroundColor: t.primary_color }}
                  >
                    {t.code}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{t.name}</h3>
                    <p className="text-[10px] text-[#94A3B8]">Capt: {t.captain_name}</p>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs pt-2.5 border-t border-[#334155]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Initial Purse:</span>
                    <span className="font-bold text-white font-mono">{t.initial_budget} pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Retention Spent:</span>
                    <span className="text-[#F5B942] font-bold font-mono">{t.retention_spent} pts</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8]">Auction Spent:</span>
                    <span className="text-[#60a5fa] font-bold font-mono">{t.auction_spent} pts</span>
                  </div>
                  <div className="flex justify-between items-center font-bold border-t border-[#334155] pt-1.5">
                    <span className="text-[#CBD5E1]">Remaining Purse:</span>
                    <span className="text-[#22c55e] font-mono text-sm font-black">{t.remaining_budget} pts</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
            <h2 className="text-base font-bold text-white uppercase tracking-wider mb-4">
              Retained Cricketers Overview
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#334155]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                    <th className="py-3 px-3.5">Player</th>
                    <th className="py-3 px-3.5">Gender</th>
                    <th className="py-3 px-3.5">Role</th>
                    <th className="py-3 px-3.5">Franchise</th>
                    <th className="py-3 px-3.5 text-right">Points Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334155]/60">
                  {retainedPlayers.map((p: any) => (
                    <tr key={p.id} className="hover:bg-[#182438]/50 transition">
                      <td className="py-3 px-3.5 font-bold text-white">{p.name}</td>
                      <td className="py-3 px-3.5 text-[#CBD5E1]">{p.gender}</td>
                      <td className="py-3 px-3.5 text-[#60a5fa] font-semibold">{p.role}</td>
                      <td className="py-3 px-3.5">
                        <span
                          className="px-2.5 py-0.5 rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: p.team_color }}
                        >
                          {p.team_name}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-black text-[#F5B942]">
                        {p.retention_points} pts
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Sold Players */}
      {activeTab === 'sold' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
          <div className="overflow-x-auto rounded-xl border border-[#334155]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Base Price</th>
                  <th className="py-3 px-4">Winning Franchise</th>
                  <th className="py-3 px-4 text-right">Sold Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {soldPlayers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                    <td className="py-3 px-4 text-[#60a5fa] font-semibold">{p.role}</td>
                    <td className="py-3 px-4 text-[#F5B942] font-black">{p.category}</td>
                    <td className="py-3 px-4 font-mono font-bold text-[#CBD5E1]">{p.base_price} pts</td>
                    <td className="py-3 px-4">
                      <span
                        className="px-2.5 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: p.team_color }}
                      >
                        {p.team_name}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-[#22c55e] text-sm">
                      {p.final_price} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Unsold Players */}
      {activeTab === 'unsold' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
          <div className="overflow-x-auto rounded-xl border border-[#334155]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                  <th className="py-3 px-4">Player ID</th>
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Gender</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Base Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {unsoldPlayers.map((p: any) => (
                  <tr key={p.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-3 px-4 font-mono text-[#94A3B8]">#{p.player_number}</td>
                    <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                    <td className="py-3 px-4 text-[#CBD5E1]">{p.gender}</td>
                    <td className="py-3 px-4 text-[#60a5fa] font-semibold">{p.role}</td>
                    <td className="py-3 px-4 text-[#F5B942] font-black">{p.category}</td>
                    <td className="py-3 px-4 text-right font-mono text-[#ef4444] font-black">{p.base_price} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Bids Log */}
      {activeTab === 'bids' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
          <div className="overflow-x-auto rounded-xl border border-[#334155]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Franchise</th>
                  <th className="py-3 px-4">Bidder</th>
                  <th className="py-3 px-4 text-right">Bid Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {bidsHistory.map((b: any) => (
                  <tr key={b.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-2.5 px-4 text-[#94A3B8] font-mono text-[11px]">
                      {new Date(b.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{b.player_name}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className="px-2.5 py-0.5 rounded text-[10px] font-bold text-white"
                        style={{ backgroundColor: b.team_color }}
                      >
                        {b.team_name}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-[#CBD5E1]">{b.bidder_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-[#F5B942]">
                      {b.amount} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Random Draws */}
      {activeTab === 'draws' && (
        <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
          <div className="overflow-x-auto rounded-xl border border-[#334155]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase bg-[#182438]">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Player Drawn</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Pool Filter</th>
                  <th className="py-3 px-4">Drawn By</th>
                  <th className="py-3 px-4 text-right">Base Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {drawHistory.map((d: any) => (
                  <tr key={d.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-2.5 px-4 text-[#94A3B8] font-mono text-[11px]">
                      {new Date(d.created_at).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-white">{d.player_name}</td>
                    <td className="py-2.5 px-4 text-[#60a5fa] font-semibold">{d.player_role}</td>
                    <td className="py-2.5 px-4 uppercase text-[10px] font-black text-[#a855f7]">{d.draw_category}</td>
                    <td className="py-2.5 px-4 text-[#CBD5E1]">{d.drawn_by_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[#22c55e] font-black">{d.base_price} pts</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Analytics */}
      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4">
              Gender Distribution
            </h3>
            <div className="space-y-3">
              {genderStats.map((g: any) => (
                <div key={g.gender} className="p-4 rounded-2xl bg-[#182438] border border-[#334155]">
                  <div className="flex justify-between items-center mb-1 text-sm font-bold text-white">
                    <span>{g.gender} Players</span>
                    <span className="text-[#F5B942] font-black font-mono">{g.count} Total</span>
                  </div>
                  <div className="text-xs text-[#94A3B8] flex gap-4 mt-2">
                    <span>Sold: <strong className="text-[#22c55e]">{g.sold_count}</strong></span>
                    <span>Retained: <strong className="text-[#F5B942]">{g.retained_count}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#202F45] border border-[#334155] rounded-3xl p-6 shadow-xl">
            <h3 className="text-base font-bold text-white uppercase tracking-wider mb-4">
              Playing Role Breakdown
            </h3>
            <div className="space-y-3">
              {roleStats.map((r: any) => (
                <div key={r.role} className="p-4 rounded-2xl bg-[#182438] border border-[#334155]">
                  <div className="flex justify-between items-center mb-1 text-sm font-bold text-white">
                    <span>{r.role}</span>
                    <span className="text-[#60a5fa] font-black font-mono">{r.count} Total</span>
                  </div>
                  <div className="text-xs text-[#94A3B8] flex gap-4 mt-2">
                    <span>Sold: <strong className="text-[#22c55e]">{r.sold_count}</strong></span>
                    <span>Retained: <strong className="text-[#F5B942]">{r.retained_count}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
