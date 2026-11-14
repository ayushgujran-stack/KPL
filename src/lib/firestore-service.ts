import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import { adminDb } from './firebase-admin';
import { firestore } from './firebase';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from './db';
import { Team, Player, AuctionEvent } from '@/types';

/**
 * Sync all records from the local database into Cloud Firestore.
 * Automatically tries Firebase Admin SDK first; if service account credentials
 * are not provided, it falls back to the Firebase Web Client SDK using the project API key.
 */
export async function seedFirestore() {
  const teams = db.prepare(`SELECT * FROM teams`).all() as any[];
  const players = db.prepare(`SELECT * FROM players`).all() as any[];
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as any;
  const users = db.prepare(`SELECT id, username, name, role, team_id, created_at FROM users`).all() as any[];

  // Method 1: Firebase Admin SDK
  if (adminDb) {
    try {
      const batch = adminDb.batch();

      for (const t of teams) {
        const ref = adminDb.collection('teams').doc(t.id);
        batch.set(ref, {
          ...t,
          initial_budget: Number(t.initial_budget),
          created_at: new Date().toISOString(),
        }, { merge: true });
      }

      for (const p of players) {
        const ref = adminDb.collection('players').doc(p.id);
        batch.set(ref, {
          ...p,
          base_price: Number(p.base_price),
          age: p.age ? Number(p.age) : null,
          is_active: Boolean(p.is_active),
          created_at: new Date().toISOString(),
        }, { merge: true });
      }

      if (event) {
        const ref = adminDb.collection('auction_events').doc('kpl-2026');
        batch.set(ref, {
          ...event,
          initial_budget: Number(event.initial_budget),
          current_bid: Number(event.current_bid),
          bid_timer: Number(event.bid_timer),
          timer_duration: Number(event.timer_duration),
          updated_at: new Date().toISOString(),
        }, { merge: true });
      }

      for (const u of users) {
        const ref = adminDb.collection('users').doc(u.id);
        batch.set(ref, {
          ...u,
          created_at: new Date().toISOString(),
        }, { merge: true });
      }

      await batch.commit();
      return {
        mode: 'admin',
        success: true,
        teamsCount: teams.length,
        playersCount: players.length,
        usersCount: users.length,
      };
    } catch (adminErr: any) {
      console.warn('Admin SDK sync attempted but encountered an error. Falling back to Client SDK...', adminErr.message);
    }
  }

  // Method 2: Firebase Web Client SDK
  const clientBatch = writeBatch(firestore);

  for (const t of teams) {
    const tRef = doc(firestore, 'teams', t.id);
    clientBatch.set(tRef, {
      ...t,
      initial_budget: Number(t.initial_budget),
      created_at: new Date().toISOString(),
    }, { merge: true });
  }

  for (const p of players) {
    const pRef = doc(firestore, 'players', p.id);
    clientBatch.set(pRef, {
      ...p,
      base_price: Number(p.base_price),
      age: p.age ? Number(p.age) : null,
      is_active: Boolean(p.is_active),
      created_at: new Date().toISOString(),
    }, { merge: true });
  }

  if (event) {
    const eRef = doc(firestore, 'auction_events', 'kpl-2026');
    clientBatch.set(eRef, {
      ...event,
      initial_budget: Number(event.initial_budget),
      current_bid: Number(event.current_bid),
      bid_timer: Number(event.bid_timer),
      timer_duration: Number(event.timer_duration),
      updated_at: new Date().toISOString(),
    }, { merge: true });
  }

  for (const u of users) {
    const uRef = doc(firestore, 'users', u.id);
    clientBatch.set(uRef, {
      ...u,
      created_at: new Date().toISOString(),
    }, { merge: true });
  }

  await clientBatch.commit();

  return {
    mode: 'client',
    success: true,
    teamsCount: teams.length,
    playersCount: players.length,
    usersCount: users.length,
  };
}

/**
 * Get auction state from Firestore
 */
export async function getFirestoreAuctionState() {
  if (!adminDb) return null;

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;

  const teamsSnap = await adminDb.collection('teams').get();
  const teams = teamsSnap.docs.map((d: any) => d.data() as Team);

  const playersSnap = await adminDb.collection('players').get();
  const players = playersSnap.docs.map((d: any) => d.data() as Player);

  return { event, teams, players };
}
