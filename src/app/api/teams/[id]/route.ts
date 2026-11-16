import { NextResponse, connection } from 'next/server';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { getTeamsWithBudgets, logAudit } from '@/lib/auction-service';
import { getCurrentUser } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connection();
    const { id } = await params;
    const teams = await getTeamsWithBudgets();
    const team = teams.find((t) => t.id === id);

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    let squad: any[] = [];

    if (adminDb) {
      try {
        const [retSnap, resultsSnap, playersSnap] = await Promise.all([
          adminDb.collection('team_retentions').where('team_id', '==', id).get(),
          adminDb.collection('auction_results').where('team_id', '==', id).where('status', '==', 'sold').get(),
          adminDb.collection('players').get(),
        ]);

        const playersMap = new Map();
        playersSnap.docs.forEach((d) => playersMap.set(d.id, d.data()));

        const retained = retSnap.docs.map((d) => {
          const r = d.data();
          const p = playersMap.get(r.player_id) || {};
          return {
            ...p,
            id: r.player_id,
            acquisition_price: Number(r.points),
            acquisition_type: 'retained',
          };
        });

        const sold = resultsSnap.docs.map((d) => {
          const a = d.data();
          const p = playersMap.get(a.player_id) || {};
          return {
            ...p,
            id: a.player_id,
            acquisition_price: Number(a.final_price),
            acquisition_type: 'auction',
          };
        });

        squad = [...retained, ...sold];
      } catch (fErr: any) {
        console.warn('Firestore team squad GET notice:', fErr.message);
      }
    }

    // If Firestore yielded no squad records (or threw an error), fall back to SQLite
    if (squad.length === 0) {
      const retainedPlayers = db.prepare(`
        SELECT p.*, r.points as acquisition_price, 'retained' as acquisition_type
        FROM team_retentions r
        JOIN players p ON r.player_id = p.id
        WHERE r.team_id = ?
      `).all(id);

      const soldPlayers = db.prepare(`
        SELECT p.*, a.final_price as acquisition_price, 'auction' as acquisition_type
        FROM auction_results a
        JOIN players p ON a.player_id = p.id
        WHERE a.team_id = ? AND a.status = 'sold'
      `).all(id);

      squad = [...retainedPlayers, ...soldPlayers];
    }

    return NextResponse.json({ team, squad }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can edit teams' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const updateFields: any = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.code !== undefined) updateFields.code = body.code.toUpperCase();
    if (body.logo_url !== undefined) updateFields.logo_url = body.logo_url;
    if (body.primary_color !== undefined) updateFields.primary_color = body.primary_color;
    if (body.secondary_color !== undefined) updateFields.secondary_color = body.secondary_color;
    if (body.captain_name !== undefined) updateFields.captain_name = body.captain_name;
    if (body.initial_budget !== undefined) updateFields.initial_budget = Number(body.initial_budget);

    if (adminDb) {
      try {
        await adminDb.collection('teams').doc(id).update(updateFields);
      } catch (fErr: any) {
        console.warn('Firestore team update notice:', fErr.message);
      }
    }

    try {
      db.prepare(`
        UPDATE teams
        SET name = COALESCE(?, name),
            code = COALESCE(?, code),
            logo_url = COALESCE(?, logo_url),
            primary_color = COALESCE(?, primary_color),
            secondary_color = COALESCE(?, secondary_color),
            captain_name = COALESCE(?, captain_name),
            initial_budget = COALESCE(?, initial_budget)
        WHERE id = ?
      `).run(
        body.name,
        body.code ? body.code.toUpperCase() : null,
        body.logo_url,
        body.primary_color,
        body.secondary_color,
        body.captain_name,
        body.initial_budget !== undefined ? Number(body.initial_budget) : null,
        id
      );
    } catch {}

    logAudit(user.id, user.name, user.role, 'UPDATE_TEAM', `Updated details for team ${id}`);

    const teams = await getTeamsWithBudgets();
    return NextResponse.json({ teams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can delete teams' }, { status: 403 });
    }

    const { id } = await params;

    if (adminDb) {
      try {
        const batch = adminDb.batch();
        // Unlink captains
        const captainsSnap = await adminDb.collection('users').where('team_id', '==', id).get();
        captainsSnap.docs.forEach((d) => batch.update(d.ref, { team_id: null }));

        // Delete retentions
        const retSnap = await adminDb.collection('team_retentions').where('team_id', '==', id).get();
        retSnap.docs.forEach((d) => batch.delete(d.ref));

        // Delete bids
        const bidsSnap = await adminDb.collection('bids').where('team_id', '==', id).get();
        bidsSnap.docs.forEach((d) => batch.delete(d.ref));

        // Delete results
        const resSnap = await adminDb.collection('auction_results').where('team_id', '==', id).get();
        resSnap.docs.forEach((d) => batch.delete(d.ref));

        // Delete team
        batch.delete(adminDb.collection('teams').doc(id));

        await batch.commit();
      } catch (fErr: any) {
        console.warn('Firestore team delete notice:', fErr.message);
      }
    }

    try {
      const tx = db.transaction(() => {
        db.prepare(`UPDATE users SET team_id = NULL WHERE team_id = ?`).run(id);
        db.prepare(`DELETE FROM team_retentions WHERE team_id = ?`).run(id);
        db.prepare(`DELETE FROM bids WHERE team_id = ?`).run(id);
        db.prepare(`DELETE FROM auction_results WHERE team_id = ?`).run(id);
        db.prepare(`DELETE FROM teams WHERE id = ?`).run(id);
      });
      tx();
    } catch {}

    logAudit(user.id, user.name, user.role, 'DELETE_TEAM', `Deleted team ${id}`);

    const teams = await getTeamsWithBudgets();
    return NextResponse.json({ teams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
