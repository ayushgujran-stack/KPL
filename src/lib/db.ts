import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { seedDatabase } from './seed';

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT ||
  (process.env.NODE_ENV === 'production' && !fs.existsSync(path.join(process.cwd(), 'data')))
);

let DB_PATH: string;

if (isServerless) {
  DB_PATH = path.join('/tmp', 'kpl.db');
} else {
  const DB_DIR = path.join(process.cwd(), 'data');
  try {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    DB_PATH = path.join(DB_DIR, 'kpl.db');
  } catch (err) {
    console.warn('Could not create DB_DIR, falling back to /tmp:', err);
    DB_PATH = path.join('/tmp', 'kpl.db');
  }
}

// Global database instance caching for Next.js hot reload
const globalForDb = global as unknown as { db?: Database.Database };

export const db: Database.Database =
  globalForDb.db ||
  new Database(DB_PATH, {
    // verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

// Set journal mode & foreign keys
try {
  if (isServerless) {
    db.pragma('journal_mode = MEMORY');
  } else {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
} catch (pragmaErr) {
  console.warn('DB pragma warning:', pragmaErr);
}

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- 'super_admin', 'organiser_1', 'organiser_2', 'captain', 'viewer'
      team_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auction_events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'NOT_STARTED', -- 'NOT_STARTED', 'RANDOM_DRAW', 'PLAYER_READY', 'BIDDING', 'BIDDING_PAUSED', 'RESULT_COMPLETED', 'AUCTION_COMPLETED'
      initial_budget REAL NOT NULL DEFAULT 150.0,
      current_player_id TEXT,
      current_bid REAL NOT NULL DEFAULT 0.0,
      current_bid_team_id TEXT,
      bid_timer INTEGER NOT NULL DEFAULT 20,
      timer_duration INTEGER NOT NULL DEFAULT 20,
      draw_category TEXT NOT NULL DEFAULT 'all',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      logo_url TEXT NOT NULL,
      primary_color TEXT NOT NULL,
      secondary_color TEXT NOT NULL,
      captain_id TEXT,
      captain_name TEXT NOT NULL,
      initial_budget REAL NOT NULL DEFAULT 150.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (captain_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      player_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      photo_url TEXT NOT NULL,
      gender TEXT NOT NULL, -- 'Male', 'Female'
      age INTEGER,
      role TEXT NOT NULL, -- 'Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper'
      category TEXT NOT NULL, -- 'Marquee', 'Category A', 'Category B', 'Emerging'
      base_price REAL NOT NULL,
      contact TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'available', -- 'available', 'retained', 'in_auction', 'sold', 'unsold'
      sold_price REAL,
      sold_to_team_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sold_to_team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS team_retentions (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL,
      player_id TEXT UNIQUE NOT NULL,
      points REAL NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS random_draws (
      id TEXT PRIMARY KEY,
      auction_event_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      draw_category TEXT NOT NULL,
      drawn_by_user_id TEXT NOT NULL,
      confirmed INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bids (
      id TEXT PRIMARY KEY,
      auction_event_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      amount REAL NOT NULL,
      bidder_user_id TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (auction_event_id) REFERENCES auction_events(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
      FOREIGN KEY (bidder_user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS auction_results (
      id TEXT PRIMARY KEY,
      auction_event_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      team_id TEXT,
      final_price REAL NOT NULL,
      status TEXT NOT NULL, -- 'sold', 'unsold'
      confirmed_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auction_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_records (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      created_by TEXT NOT NULL,
      record_counts TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Ensure default auction event exists
  const existingEvent = db.prepare('SELECT id FROM auction_events WHERE id = ?').get('kpl-2026');
  if (!existingEvent) {
    db.prepare(`
      INSERT INTO auction_events (id, name, year, status, initial_budget, current_bid, bid_timer, timer_duration, draw_category)
      VALUES ('kpl-2026', 'Premier Cricket League Auction 2026', 2026, 'NOT_STARTED', 150.0, 0.0, 20, 20, 'all')
    `).run();
  }

  // Authoritative State Machine Migration: normalize legacy lowercase statuses
  try {
    db.exec(`
      UPDATE auction_events SET status = 'NOT_STARTED' WHERE status IN ('not_started', 'NOT_STARTED');
      UPDATE auction_events SET status = 'RANDOM_DRAW' WHERE status IN ('drawn', 'drawing', 'random_draw');
      UPDATE auction_events SET status = 'PLAYER_READY' WHERE status IN ('player_ready');
      UPDATE auction_events SET status = 'BIDDING' WHERE status IN ('bidding');
      UPDATE auction_events SET status = 'BIDDING_PAUSED' WHERE status IN ('paused', 'bidding_paused');
      UPDATE auction_events SET status = 'RESULT_COMPLETED' WHERE status IN ('sold', 'unsold', 'result_completed');
      UPDATE auction_events SET status = 'AUCTION_COMPLETED' WHERE status IN ('completed', 'auction_completed');
    `);
  } catch (migErr) {
    console.warn('Status migration note:', migErr);
  }

  // Ensure default seed data (accounts, teams, players) is loaded
  try {
    const userCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number } | undefined;
    if (!userCount || userCount.cnt === 0) {
      seedDatabase(db);
    }
  } catch (seedErr) {
    console.warn('Auto-seed check notice:', seedErr);
  }
}

// Automatically initialize schema
initDatabase();
