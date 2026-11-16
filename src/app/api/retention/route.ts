import { NextResponse, connection } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { getCurrentUser } from '@/lib/auth';
import { addRetention, removeRetention, updateRetention } from '@/lib/auction-service';

export async function GET(req: Request) {
  try {
    await connection();

    let retentions: any[] = [];

    if (adminDb) {
      try {
        const [retSnap, playersSnap, teamsSnap] = await Promise.all([
          adminDb.collection('team_retentions').get(),
          adminDb.collection('players').get(),
          adminDb.collection('teams').get(),
        ]);

        const playersMap = new Map();
        playersSnap.docs.forEach((d) => playersMap.set(d.id, d.data()));

        const teamsMap = new Map();
        teamsSnap.docs.forEach((d) => teamsMap.set(d.id, d.data()));

        retentions = retSnap.docs.map((d) => {
          const r = d.data();
          const p = playersMap.get(r.player_id) || {};
          const t = teamsMap.get(r.team_id) || {};
          return {
            id: d.id,
            team_id: r.team_id,
            player_id: r.player_id,
            points: Number(r.points),
            created_at: r.created_at,
            player_name: p.name,
            photo_url: p.photo_url,
            gender: p.gender,
            player_role: p.role,
            player_number: p.player_number,
            base_price: p.base_price,
            team_name: t.name,
            team_code: t.code,
            team_color: t.primary_color,
          };
        });

        retentions.sort((a, b) => (a.team_name || '').localeCompare(b.team_name || ''));
      } catch (fErr: any) {
        console.warn('Firestore retention GET fallback to SQLite:', fErr.message);
      }
    }

    // If Firestore yielded no retentions (or threw an error), fall back to SQLite
    if (retentions.length === 0) {
      retentions = db.prepare(`
        SELECT r.*,
               p.name as player_name, p.photo_url, p.gender, p.role as player_role, p.player_number, p.base_price,
               t.name as team_name, t.code as team_code, t.primary_color as team_color
        FROM team_retentions r
        JOIN players p ON r.player_id = p.id
        JOIN teams t ON r.team_id = t.id
        ORDER BY t.name ASC, r.created_at ASC
      `).all();
    }

    return NextResponse.json({ retentions }, {
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
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin and Organisers can manage retention' }, { status: 403 });
    }

    const { team_id, player_id, points } = await req.json();

    if (!team_id || !player_id || typeof points !== 'number' || points <= 0) {
      return NextResponse.json({ error: 'Valid team, player and positive points are required' }, { status: 400 });
    }

    const state = await addRetention(team_id, player_id, points, user);
    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin and Organisers can manage retention' }, { status: 403 });
    }

    const { id, points } = await req.json();

    if (!id || typeof points !== 'number' || points <= 0) {
      return NextResponse.json({ error: 'Retention ID and positive points are required' }, { status: 400 });
    }

    const state = await updateRetention(id, points, user);
    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin and Organisers can remove retention' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Retention ID required' }, { status: 400 });
    }

    const state = await removeRetention(id, user);
    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
