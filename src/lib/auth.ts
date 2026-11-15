import { cookies } from 'next/headers';
import { db } from './db';
import { adminDb } from './firebase-admin';
import { User, UserRole } from '@/types';

const AUTH_COOKIE = 'kpl_session';

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(AUTH_COOKIE);
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  try {
    const parsed = JSON.parse(sessionCookie.value);
    if (!parsed.id) return null;

    if (adminDb) {
      try {
        const userDoc = await adminDb.collection('users').doc(parsed.id).get();
        if (userDoc.exists) {
          const data = userDoc.data();
          return {
            id: userDoc.id,
            username: data?.username,
            name: data?.name,
            role: data?.role,
            team_id: data?.team_id || null,
            created_at: data?.created_at,
          } as User;
        }
      } catch (fErr: any) {
        console.warn('Firestore user fetch notice:', fErr.message);
      }
    }

    const user = db.prepare(`SELECT id, username, name, role, team_id, created_at FROM users WHERE id = ?`).get(parsed.id) as User | undefined;
    return user || null;
  } catch {
    return null;
  }
}

export function createSessionCookie(user: User): string {
  return JSON.stringify({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    team_id: user.team_id,
  });
}

export const COOKIE_NAME = AUTH_COOKIE;
