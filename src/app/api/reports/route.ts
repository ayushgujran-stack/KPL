import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTeamsWithBudgets } from '@/lib/auction-service';

export async function GET() {
  try {
    const teams = getTeamsWithBudgets();

    // Sold players with team details
    const soldPlayers = db.prepare(`
      SELECT p.*, r.final_price, r.status as result_status, r.confirmed_by,
             t.name as team_name, t.code as team_code, t.primary_color as team_color
      FROM auction_results r
      JOIN players p ON r.player_id = p.id
      JOIN teams t ON r.team_id = t.id
      WHERE r.status = 'sold'
      ORDER BY r.created_at DESC
    `).all();

    // Retained players with team details
    const retainedPlayers = db.prepare(`
      SELECT p.*, ret.points as retention_points,
             t.name as team_name, t.code as team_code, t.primary_color as team_color
      FROM team_retentions ret
      JOIN players p ON ret.player_id = p.id
      JOIN teams t ON ret.team_id = t.id
      ORDER BY t.name ASC
    `).all();

    // Unsold players
    const unsoldPlayers = db.prepare(`
      SELECT * FROM players WHERE status = 'unsold' ORDER BY name ASC
    `).all();

    // Available players
    const availablePlayers = db.prepare(`
      SELECT * FROM players WHERE status = 'available' AND is_active = 1 ORDER BY name ASC
    `).all();

    // Complete bids history
    const bidsHistory = db.prepare(`
      SELECT b.*, p.name as player_name, p.role as player_role, p.player_number,
             t.name as team_name, t.code as team_code, t.primary_color as team_color,
             u.name as bidder_name
      FROM bids b
      JOIN players p ON b.player_id = p.id
      JOIN teams t ON b.team_id = t.id
      JOIN users u ON b.bidder_user_id = u.id
      ORDER BY b.timestamp DESC
    `).all();

    // Random draws history
    const drawHistory = db.prepare(`
      SELECT d.*, p.name as player_name, p.player_number, p.role as player_role, p.base_price,
             u.name as drawn_by_name
      FROM random_draws d
      JOIN players p ON d.player_id = p.id
      JOIN users u ON d.drawn_by_user_id = u.id
      ORDER BY d.created_at DESC
    `).all();

    // Analytics: Gender distribution
    const genderStats = db.prepare(`
      SELECT gender, COUNT(*) as count,
             SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_count,
             SUM(CASE WHEN status = 'retained' THEN 1 ELSE 0 END) as retained_count
      FROM players
      WHERE is_active = 1
      GROUP BY gender
    `).all();

    // Analytics: Role distribution
    const roleStats = db.prepare(`
      SELECT role, COUNT(*) as count,
             SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold_count,
             SUM(CASE WHEN status = 'retained' THEN 1 ELSE 0 END) as retained_count
      FROM players
      WHERE is_active = 1
      GROUP BY role
    `).all();

    return NextResponse.json({
      teams,
      soldPlayers,
      retainedPlayers,
      unsoldPlayers,
      availablePlayers,
      bidsHistory,
      drawHistory,
      genderStats,
      roleStats,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
