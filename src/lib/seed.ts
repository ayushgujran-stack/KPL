import { db } from './db';
import crypto from 'crypto';

export function seedDatabase() {
  const userCount = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as { cnt: number };
  if (userCount.cnt > 0) {
    // Already seeded
    return;
  }

  console.log('--- Priming Initial KPL Auction Database ---');

  const adminPass = process.env.ADMIN_DEFAULT_PASSWORD || 'admin123';
  const orgPass = process.env.ORGANISER_DEFAULT_PASSWORD || 'org123';
  const capPass = process.env.CAPTAIN_DEFAULT_PASSWORD || 'cap123';

  // 1. Users & Accounts
  const users = [
    { id: 'usr-admin', username: 'admin', password: adminPass, name: 'Vikram Malhotra (Super Admin)', role: 'super_admin' },
    { id: 'usr-org1', username: 'organiser1', password: orgPass, name: 'Arun Sharma (Lead Organiser)', role: 'organiser_1' },
    { id: 'usr-org2', username: 'organiser2', password: orgPass, name: 'Priya Nambiar (Organiser 2)', role: 'organiser_2' },
    { id: 'usr-cap-mt', username: 'captain_mt', password: capPass, name: 'Rohit Varma', role: 'captain', team_id: 'team-mt' },
    { id: 'usr-cap-css', username: 'captain_css', password: capPass, name: 'Dhoni Kumar', role: 'captain', team_id: 'team-css' },
    { id: 'usr-cap-rc', username: 'captain_rc', password: capPass, name: 'Virat Patel', role: 'captain', team_id: 'team-rc' },
    { id: 'usr-cap-kk', username: 'captain_kk', password: capPass, name: 'Shreyas Iyer', role: 'captain', team_id: 'team-kk' },
  ];

  for (const u of users) {
    db.prepare(`
      INSERT INTO users (id, username, password, name, role, team_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(u.id, u.username, u.password, u.name, u.role, u.team_id || null);
  }

  // 2. Teams
  const teams = [
    {
      id: 'team-mt',
      name: 'Mumbai Titans',
      code: 'MT',
      logo_url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&h=200&fit=crop&q=80',
      primary_color: '#2563eb', // Blue
      secondary_color: '#60a5fa',
      captain_id: 'usr-cap-mt',
      captain_name: 'Rohit Varma',
      initial_budget: 150.0,
    },
    {
      id: 'team-css',
      name: 'Chennai Super Stars',
      code: 'CSS',
      logo_url: 'https://images.unsplash.com/photo-1531415074868-036b107e775a?w=200&h=200&fit=crop&q=80',
      primary_color: '#eab308', // Gold / Yellow
      secondary_color: '#facc15',
      captain_id: 'usr-cap-css',
      captain_name: 'Dhoni Kumar',
      initial_budget: 150.0,
    },
    {
      id: 'team-rc',
      name: 'Royal Challengers',
      code: 'RC',
      logo_url: 'https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=200&h=200&fit=crop&q=80',
      primary_color: '#dc2626', // Crimson Red
      secondary_color: '#ef4444',
      captain_id: 'usr-cap-rc',
      captain_name: 'Virat Patel',
      initial_budget: 150.0,
    },
    {
      id: 'team-kk',
      name: 'Kolkata Knights',
      code: 'KK',
      logo_url: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&h=200&fit=crop&q=80',
      primary_color: '#7c3aed', // Purple
      secondary_color: '#a855f7',
      captain_id: 'usr-cap-kk',
      captain_name: 'Shreyas Iyer',
      initial_budget: 150.0,
    },
  ];

  for (const t of teams) {
    db.prepare(`
      INSERT INTO teams (id, name, code, logo_url, primary_color, secondary_color, captain_id, captain_name, initial_budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(t.id, t.name, t.code, t.logo_url, t.primary_color, t.secondary_color, t.captain_id, t.captain_name, t.initial_budget);
  }

  // 3. Players (Male & Female, Diverse Roles, Realistic Categories & Base Prices)
  const players = [
    // Marquee Players (Base: 20)
    {
      player_number: 'PLY-001',
      name: 'Jasprit Bumrah',
      photo_url: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 30,
      role: 'Bowler',
      category: 'Marquee',
      base_price: 20,
    },
    {
      player_number: 'PLY-002',
      name: 'Smriti Mandhana',
      photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 28,
      role: 'Batsman',
      category: 'Marquee',
      base_price: 20,
    },
    {
      player_number: 'PLY-003',
      name: 'Hardik Pandya',
      photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 31,
      role: 'All-rounder',
      category: 'Marquee',
      base_price: 20,
    },
    {
      player_number: 'PLY-004',
      name: 'Harmanpreet Kaur',
      photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 35,
      role: 'All-rounder',
      category: 'Marquee',
      base_price: 20,
    },
    {
      player_number: 'PLY-005',
      name: 'Rishabh Pant',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 27,
      role: 'Wicketkeeper',
      category: 'Marquee',
      base_price: 20,
    },
    {
      player_number: 'PLY-006',
      name: 'Shubman Gill',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 25,
      role: 'Batsman',
      category: 'Marquee',
      base_price: 20,
    },

    // Category A Players (Base: 15)
    {
      player_number: 'PLY-007',
      name: 'Jemimah Rodrigues',
      photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 24,
      role: 'Batsman',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-008',
      name: 'Mohammed Siraj',
      photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 30,
      role: 'Bowler',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-009',
      name: 'Deepti Sharma',
      photo_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 27,
      role: 'All-rounder',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-010',
      name: 'Suryakumar Yadav',
      photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 34,
      role: 'Batsman',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-011',
      name: 'Kuldeep Yadav',
      photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 29,
      role: 'Bowler',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-012',
      name: 'Richa Ghosh',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 21,
      role: 'Wicketkeeper',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-013',
      name: 'Ravindra Jadeja',
      photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 35,
      role: 'All-rounder',
      category: 'Category A',
      base_price: 15,
    },
    {
      player_number: 'PLY-014',
      name: 'Renuka Singh Thakur',
      photo_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 28,
      role: 'Bowler',
      category: 'Category A',
      base_price: 15,
    },

    // Category B Players (Base: 10)
    {
      player_number: 'PLY-015',
      name: 'Sanju Samson',
      photo_url: 'https://images.unsplash.com/photo-1513956589380-bad6acb9b9d4?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 29,
      role: 'Wicketkeeper',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-016',
      name: 'Shafali Verma',
      photo_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 20,
      role: 'Batsman',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-017',
      name: 'Axar Patel',
      photo_url: 'https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 30,
      role: 'All-rounder',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-018',
      name: 'Radha Yadav',
      photo_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 24,
      role: 'Bowler',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-019',
      name: 'Yuzvendra Chahal',
      photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 34,
      role: 'Bowler',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-020',
      name: 'Pooja Vastrakar',
      photo_url: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 25,
      role: 'All-rounder',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-021',
      name: 'Rinku Singh',
      photo_url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 27,
      role: 'Batsman',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-022',
      name: 'Arshdeep Singh',
      photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 25,
      role: 'Bowler',
      category: 'Category B',
      base_price: 10,
    },

    // Emerging Talents (Base: 5)
    {
      player_number: 'PLY-023',
      name: 'Yashasvi Jaiswal',
      photo_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 22,
      role: 'Batsman',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-024',
      name: 'Shreyanka Patil',
      photo_url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 22,
      role: 'All-rounder',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-025',
      name: 'Mayank Yadav',
      photo_url: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 22,
      role: 'Bowler',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-026',
      name: 'Titas Sadhu',
      photo_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 20,
      role: 'Bowler',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-027',
      name: 'Tilak Varma',
      photo_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 22,
      role: 'Batsman',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-028',
      name: 'Amanjot Kaur',
      photo_url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 24,
      role: 'All-rounder',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-029',
      name: 'Dhruv Jurel',
      photo_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 23,
      role: 'Wicketkeeper',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-030',
      name: 'Umran Malik',
      photo_url: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 24,
      role: 'Bowler',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-031',
      name: 'Saika Ishaque',
      photo_url: 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 29,
      role: 'Bowler',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-032',
      name: 'Nitish Kumar Reddy',
      photo_url: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 21,
      role: 'All-rounder',
      category: 'Emerging',
      base_price: 5,
    },
    {
      player_number: 'PLY-033',
      name: 'Yastika Bhatia',
      photo_url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&q=80',
      gender: 'Female',
      age: 24,
      role: 'Wicketkeeper',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-034',
      name: 'Washington Sundar',
      photo_url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 25,
      role: 'All-rounder',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-035',
      name: 'Prasidh Krishna',
      photo_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 28,
      role: 'Bowler',
      category: 'Category B',
      base_price: 10,
    },
    {
      player_number: 'PLY-036',
      name: 'Harshit Rana',
      photo_url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=400&h=400&fit=crop&q=80',
      gender: 'Male',
      age: 23,
      role: 'Bowler',
      category: 'Emerging',
      base_price: 5,
    },
  ];

  for (const p of players) {
    const id = `ply-${p.player_number.toLowerCase()}`;
    db.prepare(`
      INSERT INTO players (id, player_number, name, photo_url, gender, age, role, category, base_price, is_active, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
    `).run(id, p.player_number, p.name, p.photo_url, p.gender, p.age, p.role, p.category, p.base_price);
  }

  // 4. Initial Audit Log
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, details)
    VALUES (?, 'usr-admin', 'Vikram Malhotra', 'super_admin', 'SYSTEM_INITIALIZATION', 'Seeded master accounts, 4 teams, and 36 cricket players.')
  `).run(crypto.randomUUID());

  console.log('✓ Initial KPL Auction Database successfully seeded!');
}

// Run seed immediately
seedDatabase();
