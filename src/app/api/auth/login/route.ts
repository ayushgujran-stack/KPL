import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { createSessionCookie, COOKIE_NAME } from '@/lib/auth';
import { User } from '@/types';
import { connection } from 'next/server';

export async function POST(req: Request) {
  try {
    await connection();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    let user: (User & { password: string }) | undefined;

    // Check Cloud Firestore users first
    if (adminDb) {
      try {
        const usersSnap = await adminDb.collection('users').get();
        const matchedDoc = usersSnap.docs.find(
          (d) => (d.data().username || '').toLowerCase() === username.toLowerCase()
        );
        if (matchedDoc) {
          const d = matchedDoc.data();
          user = {
            id: matchedDoc.id,
            username: d.username,
            password: d.password,
            name: d.name,
            role: d.role,
            team_id: d.team_id || null,
            created_at: d.created_at,
          };
        }
      } catch (fErr: any) {
        console.warn('Firestore login check notice:', fErr.message);
      }
    }

    // Fallback to SQLite
    if (!user) {
      user = db.prepare(`
        SELECT id, username, password, name, role, team_id, created_at
        FROM users
        WHERE LOWER(username) = LOWER(?)
      `).get(username) as (User & { password: string }) | undefined;
    }

    if (!user || user.password !== password) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const { password: _, ...userSafe } = user;
    const cookieValue = createSessionCookie(userSafe);

    const res = NextResponse.json({ user: userSafe });
    res.cookies.set({
      name: COOKIE_NAME,
      value: cookieValue,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Login failed' }, { status: 500 });
  }
}
