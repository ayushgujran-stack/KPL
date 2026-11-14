export type UserRole = 'super_admin' | 'organiser_1' | 'organiser_2' | 'captain' | 'viewer';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  team_id?: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  code: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  captain_id?: string | null;
  captain_name: string;
  initial_budget: number; // default 150
  retention_spent: number;
  auction_spent: number;
  remaining_budget: number;
  players_count: number;
  created_at: string;
}

export type Gender = 'Male' | 'Female';
export type PlayingRole = 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicketkeeper';
export type PlayerStatus = 'available' | 'retained' | 'in_auction' | 'sold' | 'unsold';

export interface Player {
  id: string;
  player_number: string; // e.g. PLY-001
  name: string;
  photo_url: string;
  gender: Gender;
  age?: number | null;
  role: PlayingRole;
  category: string; // Marquee, Gold, Silver, Emerging
  base_price: number;
  contact?: string | null;
  is_active: number; // 1 or 0
  status: PlayerStatus;
  sold_price?: number | null;
  sold_to_team_id?: string | null;
  created_at: string;
}

export interface TeamRetention {
  id: string;
  team_id: string;
  player_id: string;
  points: number;
  created_at: string;
  player?: Player;
  team?: Team;
}

export type AuctionStatus = 'not_started' | 'drawing' | 'drawn' | 'bidding' | 'paused' | 'sold' | 'unsold' | 'completed';

export interface AuctionEvent {
  id: string;
  name: string;
  year: number;
  status: AuctionStatus;
  initial_budget: number;
  current_player_id?: string | null;
  current_bid: number;
  current_bid_team_id?: string | null;
  bid_timer: number; // countdown in seconds
  timer_duration: number; // default countdown length, e.g. 20
  draw_category: string; // 'all' | 'male' | 'female'
  updated_at: string;
}

export interface Bid {
  id: string;
  auction_event_id: string;
  player_id: string;
  team_id: string;
  amount: number;
  bidder_user_id: string;
  timestamp: string;
  team_name?: string;
  team_color?: string;
}

export interface RandomDraw {
  id: string;
  auction_event_id: string;
  player_id: string;
  draw_category: string;
  drawn_by_user_id: string;
  confirmed: number; // 0 or 1
  created_at: string;
  player?: Player;
}

export interface AuctionResult {
  id: string;
  auction_event_id: string;
  player_id: string;
  team_id?: string | null;
  final_price: number;
  status: 'sold' | 'unsold';
  confirmed_by: string;
  created_at: string;
  player?: Player;
  team?: Team;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_name: string;
  user_role: string;
  action: string;
  details: string;
  created_at: string;
}
