-- =========================================================================
-- CRICKET PLAYER AUCTION MANAGEMENT SYSTEM (KPL)
-- PostgreSQL / Supabase Complete Schema with Row Level Security (RLS)
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('super_admin', 'organiser_1', 'organiser_2', 'captain', 'viewer')),
    team_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. AUCTION EVENTS
CREATE TABLE IF NOT EXISTS auction_events (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'drawing', 'drawn', 'bidding', 'paused', 'sold', 'unsold', 'completed')),
    initial_budget NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    current_player_id UUID,
    current_bid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    current_bid_team_id UUID,
    bid_timer INTEGER NOT NULL DEFAULT 20,
    timer_duration INTEGER NOT NULL DEFAULT 20,
    draw_category TEXT NOT NULL DEFAULT 'all',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TEAMS
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    logo_url TEXT NOT NULL,
    primary_color TEXT NOT NULL,
    secondary_color TEXT NOT NULL,
    captain_id UUID REFERENCES users(id) ON DELETE SET NULL,
    captain_name TEXT NOT NULL,
    initial_budget NUMERIC(10, 2) NOT NULL DEFAULT 150.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD CONSTRAINT fk_user_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL;

-- 4. PLAYERS
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female')),
    age INTEGER,
    role TEXT NOT NULL CHECK (role IN ('Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper')),
    category TEXT NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL,
    contact TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'retained', 'in_auction', 'sold', 'unsold')),
    sold_price NUMERIC(10, 2),
    sold_to_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TEAM RETENTIONS
CREATE TABLE IF NOT EXISTS team_retentions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID UNIQUE NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    points NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. RANDOM DRAWS
CREATE TABLE IF NOT EXISTS random_draws (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_event_id TEXT NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    draw_category TEXT NOT NULL,
    drawn_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. BIDS
CREATE TABLE IF NOT EXISTS bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_event_id TEXT NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    amount NUMERIC(10, 2) NOT NULL,
    bidder_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. AUCTION RESULTS
CREATE TABLE IF NOT EXISTS auction_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_event_id TEXT NOT NULL REFERENCES auction_events(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    final_price NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sold', 'unsold')),
    confirmed_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. BACKUP RECORDS
CREATE TABLE IF NOT EXISTS backup_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename TEXT NOT NULL,
    created_by TEXT NOT NULL,
    record_counts JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_retentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE random_draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Public can read live state & rosters
CREATE POLICY "Public can view auction events" ON auction_events FOR SELECT USING (true);
CREATE POLICY "Public can view teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Public can view bids" ON bids FOR SELECT USING (true);
CREATE POLICY "Public can view auction results" ON auction_results FOR SELECT USING (true);
CREATE POLICY "Public can view team retentions" ON team_retentions FOR SELECT USING (true);
