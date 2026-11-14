import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/auction-service';
import { DEFAULT_PLAYER_AVATAR } from '@/lib/image-utils';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';

    let query = `
      SELECT p.*, t.name as sold_team_name, t.primary_color as sold_team_color
      FROM players p
      LEFT JOIN teams t ON p.sold_to_team_id = t.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.player_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    if (gender) {
      query += ` AND p.gender = ?`;
      params.push(gender);
    }

    if (role) {
      query += ` AND p.role = ?`;
      params.push(role);
    }

    if (status) {
      query += ` AND p.status = ?`;
      params.push(status);
    }

    if (category) {
      query += ` AND p.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY p.player_number ASC`;

    const players = db.prepare(query).all(...params);
    return NextResponse.json({ players });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can add players' }, { status: 403 });
    }

    const body = await req.json();

    // Check if bulk upload
    if (Array.isArray(body)) {
      const tx = db.transaction((playerList: any[]) => {
        let inserted = 0;
        for (const p of playerList) {
          if (!p.name) continue;
          const number = p.player_number || `PLY-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 100)}`;
          const id = `ply-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(`
            INSERT OR REPLACE INTO players (
              id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
          `).run(
            id,
            number,
            p.name,
            p.photo_url || DEFAULT_PLAYER_AVATAR,
            p.gender || 'Male',
            p.age ? Number(p.age) : null,
            p.role || 'All-rounder',
            p.category || 'Category A',
            Number(p.base_price) || 10,
            p.contact || null
          );
          inserted++;
        }
        return inserted;
      });

      const count = tx(body);
      logAudit(user.id, user.name, user.role, 'BULK_PLAYER_IMPORT', `Imported ${count} players via batch.`);
      return NextResponse.json({ success: true, count });
    }

    // Single player add
    const { player_number, name, photo_url, gender, age, role, category, base_price, contact } = body;

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and Playing Role are required' }, { status: 400 });
    }

    // Check duplicate
    const existing = db.prepare(`SELECT id FROM players WHERE player_number = ? OR LOWER(name) = LOWER(?)`).get(player_number, name);
    if (existing) {
      return NextResponse.json({ error: 'A player with this number or name already exists in the auction.' }, { status: 400 });
    }

    const id = `ply-${crypto.randomUUID().slice(0, 8)}`;
    const finalNumber = player_number || `PLY-${String(Date.now()).slice(-4)}`;

    db.prepare(`
      INSERT INTO players (
        id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
    `).run(
      id,
      finalNumber,
      name,
      photo_url || DEFAULT_PLAYER_AVATAR,
      gender || 'Male',
      age ? Number(age) : null,
      role,
      category || 'Category A',
      Number(base_price) || 10,
      contact || null
    );

    logAudit(user.id, user.name, user.role, 'ADD_PLAYER', `Added player ${name} (${finalNumber})`);

    const newPlayer = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
    return NextResponse.json({ player: newPlayer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
