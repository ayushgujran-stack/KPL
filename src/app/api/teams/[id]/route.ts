import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTeamsWithBudgets, logAudit } from '@/lib/auction-service';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const teams = getTeamsWithBudgets();
    const team = teams.find((t) => t.id === id);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    // Get squad: retained + sold
    const retainedPlayers = db.prepare(`
      SELECT p.*, r.points as acquisition_price, 'retained' as acquisition_type
      FROM team_retentions r
      JOIN players p ON r.player_id = p.id
      WHERE r.team_id = ?
    `).all(id);

    const soldPlayers = db.prepare(`
      SELECT p.*, a.final_price as acquisition_price, 'auction' as acquisition_type
      FROM auction_results a
      JOIN players p ON a.player_id = p.id
      WHERE a.team_id = ? AND a.status = 'sold'
    `).all(id);

    const squad = [...retainedPlayers, ...soldPlayers];

    return NextResponse.json({ team, squad });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can edit teams' }, { status: 403 });
    }

    const { id } = await params;
    const { name, code, logo_url, primary_color, secondary_color, captain_name, initial_budget } = await req.json();

    db.prepare(`
      UPDATE teams
      SET name = COALESCE(?, name),
          code = COALESCE(?, code),
          logo_url = COALESCE(?, logo_url),
          primary_color = COALESCE(?, primary_color),
          secondary_color = COALESCE(?, secondary_color),
          captain_name = COALESCE(?, captain_name),
          initial_budget = COALESCE(?, initial_budget)
      WHERE id = ?
    `).run(
      name,
      code ? code.toUpperCase() : null,
      logo_url,
      primary_color,
      secondary_color,
      captain_name,
      initial_budget !== undefined ? Number(initial_budget) : null,
      id
    );

    logAudit(user.id, user.name, user.role, 'UPDATE_TEAM', `Updated details for team ${id}`);

    const teams = getTeamsWithBudgets();
    return NextResponse.json({ teams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can delete teams' }, { status: 403 });
    }

    const { id } = await params;

    const tx = db.transaction(() => {
      // Unlink captains safely
      db.prepare(`UPDATE users SET team_id = NULL WHERE team_id = ?`).run(id);
      db.prepare(`DELETE FROM team_retentions WHERE team_id = ?`).run(id);
      db.prepare(`DELETE FROM bids WHERE team_id = ?`).run(id);
      db.prepare(`DELETE FROM auction_results WHERE team_id = ?`).run(id);
      db.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
    });
    tx();

    logAudit(user.id, user.name, user.role, 'DELETE_TEAM', `Deleted team ${id}`);
    const teams = getTeamsWithBudgets();
    return NextResponse.json({ teams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
