import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/auction-service';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
    if (!player) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

    const bids = db.prepare(`
      SELECT b.*, t.name as team_name, t.code as team_code
      FROM bids b
      JOIN teams t ON b.team_id = t.id
      WHERE b.player_id = ?
      ORDER BY b.amount DESC
    `).all(id);

    return NextResponse.json({ player, bids });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can edit players' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const { name, player_number, photo_url, gender, age, role, category, base_price, contact, is_active } = body;

    db.prepare(`
      UPDATE players
      SET name = COALESCE(?, name),
          player_number = COALESCE(?, player_number),
          photo_url = COALESCE(?, photo_url),
          gender = COALESCE(?, gender),
          age = COALESCE(?, age),
          role = COALESCE(?, role),
          category = COALESCE(?, category),
          base_price = COALESCE(?, base_price),
          contact = COALESCE(?, contact),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      name,
      player_number,
      photo_url,
      gender,
      age !== undefined ? Number(age) : null,
      role,
      category,
      base_price !== undefined ? Number(base_price) : null,
      contact,
      is_active !== undefined ? Number(is_active) : null,
      id
    );

    logAudit(user.id, user.name, user.role, 'UPDATE_PLAYER', `Updated player record for ${name || id}`);

    const updated = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
    return NextResponse.json({ player: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can delete players' }, { status: 403 });
    }

    const { id } = await params;

    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM team_retentions WHERE player_id = ?`).run(id);
      db.prepare(`DELETE FROM bids WHERE player_id = ?`).run(id);
      db.prepare(`DELETE FROM random_draws WHERE player_id = ?`).run(id);
      db.prepare(`DELETE FROM auction_results WHERE player_id = ?`).run(id);
      db.prepare(`DELETE FROM players WHERE id = ?`).run(id);
    });
    tx();

    logAudit(user.id, user.name, user.role, 'DELETE_PLAYER', `Deleted player ${id}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
