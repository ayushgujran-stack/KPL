'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Player, Gender, PlayingRole } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { useAuction } from '@/context/AuctionContext';
import { Plus, Upload, Download, Search, Trash2, Edit2, X, Camera, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import * as XLSX from 'xlsx';
import { validateImageFile, compressPlayerPhoto, DEFAULT_PLAYER_AVATAR } from '@/lib/image-utils';

export default function AdminPlayersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refreshState } = useAuction();

  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [playerNumber, setPlayerNumber] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [gender, setGender] = useState<Gender>('Male');
  const [age, setAge] = useState('');
  const [role, setRole] = useState<PlayingRole>('All-rounder');
  const [category, setCategory] = useState('Category A');
  const [basePrice, setBasePrice] = useState('10');
  const [contact, setContact] = useState('');

  // Local Image Upload States
  const [photoPreview, setPhotoPreview] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPlayers = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (genderFilter) params.set('gender', genderFilter);
      if (roleFilter) params.set('role', roleFilter);
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/players?${params.toString()}`);
      const data = await res.json();
      setPlayers(data.players || []);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlayers();
  }, [search, genderFilter, roleFilter, statusFilter]);

  const handleOpenEdit = (p: Player) => {
    setEditingPlayer(p);
    setName(p.name);
    setPlayerNumber(p.player_number);
    setPhotoUrl(p.photo_url || DEFAULT_PLAYER_AVATAR);
    setPhotoPreview(p.photo_url || DEFAULT_PLAYER_AVATAR);
    setSelectedFile(null);
    setPhotoError(null);
    setGender(p.gender);
    setAge(p.age ? String(p.age) : '');
    setRole(p.role);
    setCategory(p.category);
    setBasePrice(String(p.base_price));
    setContact(p.contact || '');
    setShowAddModal(true);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setPhotoError(validation.error || 'Invalid image file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      setUploadingPhoto(true);
      const compressed = await compressPlayerPhoto(file, 800, 0.88);
      setSelectedFile(compressed.file);
      setPhotoPreview(compressed.dataUrl);
    } catch (err: any) {
      setPhotoError('Image processing error: ' + (err.message || 'Could not process photo'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(DEFAULT_PLAYER_AVATAR);
    setPhotoUrl(DEFAULT_PLAYER_AVATAR);
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSavePlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhotoError(null);

    try {
      let finalPhoto = photoUrl;

      // If user selected a local computer photo, upload it to backend storage first
      if (selectedFile) {
        setUploadingPhoto(true);
        const formData = new FormData();
        formData.append('file', selectedFile);

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error || 'Failed to upload photo to storage.');
        }

        finalPhoto = uploadData.url;
      }

      if (!finalPhoto || finalPhoto === '') {
        finalPhoto = DEFAULT_PLAYER_AVATAR;
      }

      const payload = {
        name,
        player_number: playerNumber,
        photo_url: finalPhoto,
        gender,
        age: age ? Number(age) : null,
        role,
        category,
        base_price: Number(basePrice) || 10,
        contact,
      };

      if (editingPlayer) {
        const res = await fetch(`/api/players/${editingPlayer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      } else {
        const res = await fetch(`/api/players`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
      }

      setEditingPlayer(null);
      setShowAddModal(false);
      setSelectedFile(null);
      setPhotoPreview('');
      await fetchPlayers();
      await refreshState();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to delete this player?')) return;
    try {
      const res = await fetch(`/api/players/${playerId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchPlayers();
      await refreshState();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleExportExcel = () => {
    const rows = players.map((p) => ({
      'Player ID': p.player_number,
      'Full Name': p.name,
      'Gender': p.gender,
      'Age': p.age || '',
      'Playing Role': p.role,
      'Category': p.category,
      'Base Price (Pts)': p.base_price,
      'Status': p.status.toUpperCase(),
      'Sold Price': p.sold_price || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Players');
    XLSX.writeFile(workbook, `KPL_2026_Players_Master.xlsx`);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        if (!data || data.length === 0) {
          alert('Excel sheet is empty');
          return;
        }

        const res = await fetch('/api/players', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bulk: data }),
        });
        const json = await res.json();
        if (!res.ok) {
          alert(`Import error: ${json.error}`);
        } else {
          alert(`Successfully imported ${json.importedCount || data.length} cricketers!`);
          await fetchPlayers();
          await refreshState();
        }
      };
      reader.readAsBinaryString(file);
    } catch (err: any) {
      alert(`Failed to parse Excel file: ${err.message}`);
    }
  };

  if (authLoading) {
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
          Player registration and registry management is restricted to Super Admins and Organisers.
        </p>
        <div className="mt-6">
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
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs uppercase font-black text-[#F5B942] tracking-wider">Master Registry</div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Player Master</h1>
          <p className="text-xs text-[#94A3B8] mt-1 font-medium">Manage player profiles, categories, base prices, and bulk Excel import.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Excel Import */}
          <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold border border-[#475569] transition flex items-center gap-1.5 shadow-sm">
            <Upload className="w-3.5 h-3.5 text-[#a855f7]" />
            Excel Import
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleExcelImport}
              className="hidden"
            />
          </label>

          {/* Excel Export */}
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 rounded-xl bg-[#334155] hover:bg-[#475569] text-white text-xs font-bold border border-[#475569] transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-[#22c55e]" />
            Export Excel
          </button>

          {/* Add Single Player */}
          <button
            onClick={() => {
              setEditingPlayer(null);
              setName('');
              setPlayerNumber(`PLY-${String(Date.now()).slice(-3)}`);
              setPhotoUrl(DEFAULT_PLAYER_AVATAR);
              setPhotoPreview('');
              setSelectedFile(null);
              setPhotoError(null);
              setGender('Male');
              setAge('25');
              setRole('All-rounder');
              setCategory('Category A');
              setBasePrice('10');
              setContact('');
              setShowAddModal(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-[#F5B942]/20"
          >
            <Plus className="w-4 h-4" />
            Add Player
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6 p-4 rounded-2xl bg-[#202F45] border border-[#334155] shadow-lg">
        <div className="relative">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or ID..."
            className="w-full bg-[#182438] border border-[#334155] rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
          />
        </div>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5B942]"
        >
          <option value="" className="bg-[#182438] text-white">All Genders</option>
          <option value="Male" className="bg-[#182438] text-white">Male</option>
          <option value="Female" className="bg-[#182438] text-white">Female</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5B942]"
        >
          <option value="" className="bg-[#182438] text-white">All Playing Roles</option>
          <option value="Batsman" className="bg-[#182438] text-white">Batsman</option>
          <option value="Bowler" className="bg-[#182438] text-white">Bowler</option>
          <option value="All-rounder" className="bg-[#182438] text-white">All-rounder</option>
          <option value="Wicketkeeper" className="bg-[#182438] text-white">Wicketkeeper</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#F5B942]"
        >
          <option value="" className="bg-[#182438] text-white">All Statuses</option>
          <option value="available" className="bg-[#182438] text-white">Available in Pool</option>
          <option value="retained" className="bg-[#182438] text-white">Retained</option>
          <option value="sold" className="bg-[#182438] text-white">Sold</option>
          <option value="unsold" className="bg-[#182438] text-white">Unsold</option>
        </select>
      </div>

      {/* Players Table */}
      <div className="bg-[#202F45] border border-[#334155] rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#334155] text-[11px] font-black text-[#94A3B8] uppercase tracking-wider bg-[#182438]">
                <th className="py-3 px-4">Player</th>
                <th className="py-3 px-4">Gender</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Base Price</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#334155]/60 text-xs">
              {players.length > 0 ? (
                players.map((p) => (
                  <tr key={p.id} className="hover:bg-[#182438]/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.photo_url || DEFAULT_PLAYER_AVATAR}
                          alt={p.name}
                          onError={(e) => { (e.target as HTMLImageElement).src = DEFAULT_PLAYER_AVATAR; }}
                          className="w-10 h-10 rounded-xl object-cover border border-[#334155] shrink-0 bg-[#182438]"
                        />
                        <div>
                          <div className="font-bold text-white text-sm">{p.name}</div>
                          <div className="text-[10px] text-[#94A3B8] font-mono">#{p.player_number}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#CBD5E1] font-semibold">{p.gender}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#3B82F6]/20 text-[#60a5fa] border border-[#3B82F6]/40 font-bold text-[11px]">
                        {p.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40 text-[11px] font-black">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center font-black font-mono text-[#22c55e] text-sm">
                      {p.base_price} pts
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          p.status === 'sold'
                            ? 'bg-[#16A34A]/15 text-[#22c55e] border border-[#16A34A]/40'
                            : p.status === 'retained'
                            ? 'bg-[#F5B942]/15 text-[#F5B942] border border-[#F5B942]/40'
                            : p.status === 'unsold'
                            ? 'bg-rose-500/15 text-[#ef4444] border border-rose-500/40'
                            : 'bg-[#3B82F6]/15 text-[#60a5fa] border border-[#3B82F6]/40'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(p)}
                          title="Edit Player"
                          className="p-2 rounded-xl bg-[#182438] hover:bg-[#263852] text-[#CBD5E1] hover:text-white transition border border-[#334155]"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeletePlayer(p.id)}
                          title="Delete Player"
                          className="p-2 rounded-xl bg-[#182438] hover:bg-rose-950/50 text-[#94A3B8] hover:text-rose-400 transition border border-[#334155]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#94A3B8] italic">
                    {loading ? 'Loading cricketers...' : 'No players found matching current filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Player Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-lg w-full bg-[#202F45] border border-[#334155] rounded-3xl p-6 sm:p-8 shadow-2xl relative my-8">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-5 right-5 text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-lg font-bold text-white uppercase tracking-wider mb-4">
              {editingPlayer ? 'Edit Cricketer' : 'Register New Cricketer'}
            </h2>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
                {error}
              </div>
            )}

            <form onSubmit={handleSavePlayer} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Player Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Virat Kohli"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Player ID / Number</label>
                  <input
                    type="text"
                    required
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
                    placeholder="PLY-099"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2.5 text-white font-mono placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
              </div>

              {/* Photo Upload Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[#CBD5E1] font-bold uppercase">
                    Player Photo
                  </label>
                  <span className="text-[10px] text-[#94A3B8]">
                    JPG, JPEG, PNG, WEBP (Max 5 MB)
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#182438] border border-[#334155] flex flex-col sm:flex-row items-center gap-4">
                  {/* Photo Preview Box */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-[#334155] bg-[#101827] shrink-0 shadow-inner">
                    <img
                      src={photoPreview || photoUrl || DEFAULT_PLAYER_AVATAR}
                      alt="Player Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = DEFAULT_PLAYER_AVATAR;
                      }}
                    />
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-[#101827]/85 flex flex-col items-center justify-center text-[10px] text-[#F5B942] font-bold">
                        <div className="w-5 h-5 border-2 border-[#F5B942] border-t-transparent rounded-full animate-spin mb-1" />
                        <span>Optimizing...</span>
                      </div>
                    )}
                  </div>

                  {/* Actions & File Picker */}
                  <div className="flex-1 space-y-2 text-center sm:text-left w-full">
                    {/* Hidden file input */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingPhoto}
                        className="px-3.5 py-2 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black text-xs uppercase tracking-wider transition flex items-center gap-1.5 shadow-md shadow-[#F5B942]/10 disabled:opacity-50"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        {photoPreview && photoPreview !== DEFAULT_PLAYER_AVATAR ? 'Change Photo' : 'Upload Player Photo'}
                      </button>

                      {((photoPreview && photoPreview !== DEFAULT_PLAYER_AVATAR) || (photoUrl && photoUrl !== DEFAULT_PLAYER_AVATAR)) && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          disabled={uploadingPhoto}
                          className="px-3 py-2 rounded-xl bg-[#334155] hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 text-[#CBD5E1] font-bold text-xs border border-[#475569] transition flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="text-[11px] text-[#94A3B8]">
                      {selectedFile ? (
                        <span className="text-[#22c55e] font-semibold flex items-center justify-center sm:justify-start gap-1">
                          ✓ Image compressed: {(selectedFile.size / 1024).toFixed(1)} KB ({selectedFile.name})
                        </span>
                      ) : (
                        <span>Select a photo from your computer. Faces are centered without distortion.</span>
                      )}
                    </div>

                    {photoError && (
                      <div className="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-semibold">
                        {photoError}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Gender</label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as Gender)}
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5B942]"
                  >
                    <option value="Male" className="bg-[#182438] text-white">Male</option>
                    <option value="Female" className="bg-[#182438] text-white">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Age</label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="26"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2 text-white placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Playing Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as PlayingRole)}
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5B942]"
                  >
                    <option value="Batsman" className="bg-[#182438] text-white">Batsman</option>
                    <option value="Bowler" className="bg-[#182438] text-white">Bowler</option>
                    <option value="All-rounder" className="bg-[#182438] text-white">All-rounder</option>
                    <option value="Wicketkeeper" className="bg-[#182438] text-white">Wicketkeeper</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#F5B942]"
                  >
                    <option value="Marquee" className="bg-[#182438] text-white">Marquee</option>
                    <option value="Category A" className="bg-[#182438] text-white">Category A</option>
                    <option value="Category B" className="bg-[#182438] text-white">Category B</option>
                    <option value="Emerging" className="bg-[#182438] text-white">Emerging</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#CBD5E1] font-bold uppercase mb-1">Base Price (Points)</label>
                  <input
                    type="number"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(e.target.value)}
                    placeholder="10"
                    className="w-full bg-[#182438] border border-[#334155] rounded-xl px-3.5 py-2 text-white font-mono placeholder-[#94A3B8] focus:outline-none focus:border-[#F5B942]"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-3 rounded-xl bg-[#334155] hover:bg-[#475569] text-white font-bold transition border border-[#475569]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingPhoto}
                  className="flex-1 py-3 rounded-xl bg-[#F5B942] hover:bg-[#FFD66B] text-[#101827] font-black transition shadow-md shadow-[#F5B942]/20 disabled:bg-[#475569] disabled:text-[#CBD5E1] disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploadingPhoto ? 'Saving & Uploading...' : editingPlayer ? 'Update Player' : 'Register Player'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
