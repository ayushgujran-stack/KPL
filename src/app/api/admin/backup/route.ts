import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createDatabaseBackup, logAudit } from '@/lib/auction-service';
import { db } from '@/lib/db';
import { connection } from 'next/server';

export async function GET() {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const backup = createDatabaseBackup(user);
    return NextResponse.json(backup);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { backupData } = await req.json();
    if (!backupData || !backupData.data) {
      return NextResponse.json({ error: 'Invalid backup file structure' }, { status: 400 });
    }

    const { teams, players, retentions, bids, results } = backupData.data;

    const tx = db.transaction(() => {
      // Clear existing state safely
      db.prepare(`DELETE FROM bids`).run();
      db.prepare(`DELETE FROM random_draws`).run();
      db.prepare(`DELETE FROM auction_results`).run();
      db.prepare(`DELETE FROM team_retentions`).run();

      // Restore players
      if (Array.isArray(players)) {
        db.prepare(`DELETE FROM players`).run();
        for (const p of players) {
          db.prepare(`
            INSERT INTO players (id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status, sold_price, sold_to_team_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(p.id, p.player_number, p.name, p.photo_url, p.gender, p.age, p.role, p.category, p.base_price, p.contact, p.is_active, p.status, p.sold_price, p.sold_to_team_id);
        }
      }

      // Restore teams
      if (Array.isArray(teams)) {
        db.prepare(`DELETE FROM teams`).run();
        for (const t of teams) {
          db.prepare(`
            INSERT INTO teams (id, name, code, logo_url, primary_color, secondary_color, captain_id, captain_name, initial_budget)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(t.id, t.name, t.code, t.logo_url, t.primary_color, t.secondary_color, t.captain_id, t.captain_name, t.initial_budget);
        }
      }

      // Restore retentions
      if (Array.isArray(retentions)) {
        for (const r of retentions) {
          db.prepare(`
            INSERT INTO team_retentions (id, team_id, player_id, points)
            VALUES (?, ?, ?, ?)
          `).run(r.id, r.team_id, r.player_id, r.points);
        }
      }

      // Restore results & bids if present
      if (Array.isArray(results)) {
        for (const res of results) {
          db.prepare(`
            INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(res.id, res.auction_event_id || 'kpl-2026', res.player_id, res.team_id, res.final_price, res.status, res.confirmed_by);
        }
      }

      logAudit(user.id, user.name, user.role, 'RESTORE_BACKUP', 'Restored system database from JSON backup snapshot.');
    });

    tx();
    return NextResponse.json({ success: true, message: 'Database restored successfully from backup.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
