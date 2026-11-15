import { NextResponse, connection } from 'next/server';
import { db } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/auction-service';
import { adminDb } from '@/lib/firebase-admin';
import {
  getFirestoreUsers,
  createFirestoreUser,
  deleteFirestoreUser,
} from '@/lib/firestore-service';
import crypto from 'crypto';

export async function GET() {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (adminDb) {
      try {
        const users = await getFirestoreUsers();
        return NextResponse.json({ users });
      } catch (err: any) {
        console.warn('Firestore getUsers fallback to SQLite:', err.message);
      }
    }

    const users = db.prepare(`
      SELECT u.id, u.username, u.name, u.role, u.team_id, u.created_at,
             t.name as team_name, t.code as team_code
      FROM users u
      LEFT JOIN teams t ON u.team_id = t.id
      ORDER BY u.role ASC, u.name ASC
    `).all();

    return NextResponse.json({ users });
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

    const { username, password, name, role, team_id } = await req.json();

    if (!username || !password || !name || !role) {
      return NextResponse.json({ error: 'All fields are required' }, { status: 400 });
    }

    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;

    if (adminDb) {
      try {
        const existingSnap = await adminDb.collection('users').where('username', '==', username.toLowerCase()).get();
        if (!existingSnap.empty) {
          return NextResponse.json({ error: 'Username already in use' }, { status: 400 });
        }

        await createFirestoreUser({
          id,
          username: username.toLowerCase(),
          password,
          name,
          role,
          team_id: team_id || null,
        });

        // Mirror to SQLite
        try {
          db.prepare(`
            INSERT INTO users (id, username, password, name, role, team_id)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(id, username.toLowerCase(), password, name, role, team_id || null);

          if (role === 'captain' && team_id) {
            db.prepare(`UPDATE teams SET captain_id = ?, captain_name = ? WHERE id = ?`).run(id, name, team_id);
          }
        } catch (e: any) {
          console.warn('SQLite mirror user create notice:', e.message);
        }

        await logAudit(user.id, user.name, user.role, 'CREATE_USER', `Created user account: ${name} (${role})`);
        return NextResponse.json({ success: true, id });
      } catch (err: any) {
        console.warn('Firestore createUser fallback to SQLite:', err.message);
      }
    }

    const existing = db.prepare(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`).get(username);
    if (existing) {
      return NextResponse.json({ error: 'Username already in use' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO users (id, username, password, name, role, team_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, username, password, name, role, team_id || null);

    // If captain, update team.captain_id
    if (role === 'captain' && team_id) {
      db.prepare(`UPDATE teams SET captain_id = ?, captain_name = ? WHERE id = ?`).run(id, name, team_id);
    }

    await logAudit(user.id, user.name, user.role, 'CREATE_USER', `Created user account: ${name} (${role})`);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 });

    if (id === user.id) {
      return NextResponse.json({ error: 'Cannot delete the currently logged-in Super Admin!' }, { status: 400 });
    }

    let targetUserName = id;
    let targetUserRole = 'user';

    if (adminDb) {
      try {
        const uDoc = await adminDb.collection('users').doc(id).get();
        if (uDoc.exists) {
          const uData = uDoc.data();
          targetUserName = uData?.name || id;
          targetUserRole = uData?.role || 'user';
        }
        await deleteFirestoreUser(id);
      } catch (err: any) {
        console.warn('Firestore deleteUser fallback to SQLite:', err.message);
      }
    }

    try {
      const targetUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
      if (targetUser) {
        targetUserName = targetUser.name;
        targetUserRole = targetUser.role;
      }
      db.prepare(`UPDATE teams SET captain_id = NULL WHERE captain_id = ?`).run(id);
      db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
    } catch (e: any) {
      console.warn('SQLite mirror delete user notice:', e.message);
    }

    await logAudit(user.id, user.name, user.role, 'DELETE_USER', `Deleted user account: ${targetUserName} (${targetUserRole})`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
