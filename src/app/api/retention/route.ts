import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { addRetention, removeRetention } from '@/lib/auction-service';

export async function GET() {
  try {
    const retentions = db.prepare(`
      SELECT r.*,
             p.name as player_name, p.photo_url, p.gender, p.role as player_role, p.player_number,
             t.name as team_name, t.code as team_code, t.primary_color as team_color
      FROM team_retentions r
      JOIN players p ON r.player_id = p.id
      JOIN teams t ON r.team_id = t.id
      ORDER BY t.name ASC, r.created_at ASC
    `).all();

    return NextResponse.json({ retentions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can manage retention' }, { status: 403 });
    }

    const { team_id, player_id, points } = await req.json();

    if (!team_id || !player_id || typeof points !== 'number' || points <= 0) {
      return NextResponse.json({ error: 'Valid team, player and positive points are required' }, { status: 400 });
    }

    const state = addRetention(team_id, player_id, points, user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can remove retention' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Retention ID required' }, { status: 400 });
    }

    const state = removeRetention(id, user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
