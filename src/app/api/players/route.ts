import { NextResponse, connection } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/auction-service';
import { DEFAULT_PLAYER_AVATAR } from '@/lib/image-utils';
import { adminDb } from '@/lib/firebase-admin';
import {
  getFirestorePlayers,
  createFirestorePlayer,
  bulkCreateFirestorePlayers,
} from '@/lib/firestore-service';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    await connection();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const gender = searchParams.get('gender') || '';
    const role = searchParams.get('role') || '';
    const status = searchParams.get('status') || '';
    const category = searchParams.get('category') || '';

    if (adminDb) {
      try {
        const players = await getFirestorePlayers({ search, gender, role, status, category });
        return NextResponse.json({ players }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        });
      } catch (err: any) {
        console.warn('Firestore getPlayers fallback to SQLite:', err.message);
      }
    }

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
    return NextResponse.json({ players }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can add players' }, { status: 403 });
    }

    const body = await req.json();

    // Check if bulk upload
    const isBulk = Array.isArray(body) || (body && Array.isArray(body.bulk));
    if (isBulk) {
      const rawList = Array.isArray(body) ? body : (body.bulk || []);

      if (adminDb) {
        try {
          const count = await bulkCreateFirestorePlayers(rawList);
          // Also sync to SQLite
          try {
            const tx = db.transaction((playerList: any[]) => {
              for (const item of playerList) {
                const name = item.name || item['Full Name'] || item['Player Name'] || item['Name'];
                if (!name) continue;
                const number = item.player_number || item['Player ID'] || item['Player Number'] || item['Number'] || `PLY-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 100)}`;
                const photo_url = item.photo_url || item['Photo URL'] || item['Photo'] || DEFAULT_PLAYER_AVATAR;
                const gender = item.gender || item['Gender'] || 'Male';
                const age = item.age || item['Age'] ? Number(item.age || item['Age']) : null;
                const role = item.role || item['Playing Role'] || item['Role'] || 'All-rounder';
                const category = item.category || item['Category'] || 'Category A';
                const base_price = Number(item.base_price || item['Base Price (Pts)'] || item['Base Price']) || 10;
                const contact = item.contact || item['Contact'] || item['Contact / Notes'] || null;

                const id = `ply-${crypto.randomUUID().slice(0, 8)}`;
                db.prepare(`
                  INSERT OR REPLACE INTO players (
                    id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
                `).run(id, number, name, photo_url, gender, age, role, category, base_price, contact);
              }
            });
            tx(rawList);
          } catch (e: any) {
            console.warn('SQLite mirror error in bulk players:', e.message);
          }

          await logAudit(user.id, user.name, user.role, 'BULK_PLAYER_IMPORT', `Imported ${count} players via batch.`);
          return NextResponse.json({ success: true, count });
        } catch (err: any) {
          console.warn('Firestore bulkCreate fallback to SQLite:', err.message);
        }
      }

      const tx = db.transaction((playerList: any[]) => {
        let inserted = 0;
        for (const item of playerList) {
          const name = item.name || item['Full Name'] || item['Player Name'] || item['Name'];
          if (!name) continue;
          const number = item.player_number || item['Player ID'] || item['Player Number'] || item['Number'] || `PLY-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 100)}`;
          const photo_url = item.photo_url || item['Photo URL'] || item['Photo'] || DEFAULT_PLAYER_AVATAR;
          const gender = item.gender || item['Gender'] || 'Male';
          const age = item.age || item['Age'] ? Number(item.age || item['Age']) : null;
          const role = item.role || item['Playing Role'] || item['Role'] || 'All-rounder';
          const category = item.category || item['Category'] || 'Category A';
          const base_price = Number(item.base_price || item['Base Price (Pts)'] || item['Base Price']) || 10;
          const contact = item.contact || item['Contact'] || item['Contact / Notes'] || null;

          const id = `ply-${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(`
            INSERT OR REPLACE INTO players (
              id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
          `).run(id, number, name, photo_url, gender, age, role, category, base_price, contact);
          inserted++;
        }
        return inserted;
      });

      const count = tx(rawList);
      await logAudit(user.id, user.name, user.role, 'BULK_PLAYER_IMPORT', `Imported ${count} players via batch.`);
      return NextResponse.json({ success: true, count });
    }

    // Single player add
    const { player_number, name, photo_url, gender, age, role, category, base_price, contact } = body;

    if (!name || !role) {
      return NextResponse.json({ error: 'Name and Playing Role are required' }, { status: 400 });
    }

    const id = `ply-${crypto.randomUUID().slice(0, 8)}`;
    const finalNumber = player_number || `PLY-${String(Date.now()).slice(-4)}`;

    if (adminDb) {
      try {
        // Check duplicate in Firestore
        const existingSnap = await adminDb.collection('players').where('name', '==', name).get();
        if (!existingSnap.empty) {
          return NextResponse.json({ error: 'A player with this name already exists in the auction.' }, { status: 400 });
        }

        const newPlayer = await createFirestorePlayer({
          id,
          player_number: finalNumber,
          name,
          photo_url: photo_url || DEFAULT_PLAYER_AVATAR,
          gender: gender || 'Male',
          age: age ? Number(age) : null,
          role,
          category: category || 'Category A',
          base_price: Number(base_price) || 10,
          contact: contact || null,
        });

        // Mirror to SQLite
        try {
          db.prepare(`
            INSERT OR REPLACE INTO players (
              id, player_number, name, photo_url, gender, age, role, category, base_price, contact, is_active, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')
          `).run(id, finalNumber, name, photo_url || DEFAULT_PLAYER_AVATAR, gender || 'Male', age ? Number(age) : null, role, category || 'Category A', Number(base_price) || 10, contact || null);
        } catch (e: any) {
          console.warn('SQLite mirror single player notice:', e.message);
        }

        await logAudit(user.id, user.name, user.role, 'ADD_PLAYER', `Added player ${name} (${finalNumber})`);
        return NextResponse.json({ player: newPlayer });
      } catch (err: any) {
        console.warn('Firestore addPlayer fallback to SQLite:', err.message);
      }
    }

    // SQLite fallback
    const existing = db.prepare(`SELECT id FROM players WHERE player_number = ? OR LOWER(name) = LOWER(?)`).get(player_number, name);
    if (existing) {
      return NextResponse.json({ error: 'A player with this number or name already exists in the auction.' }, { status: 400 });
    }

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

    await logAudit(user.id, user.name, user.role, 'ADD_PLAYER', `Added player ${name} (${finalNumber})`);

    const newPlayer = db.prepare(`SELECT * FROM players WHERE id = ?`).get(id);
    return NextResponse.json({ player: newPlayer });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
