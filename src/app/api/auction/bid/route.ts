import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { placeBid } from '@/lib/auction-service';
import { connection } from 'next/server';

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to bid' }, { status: 401 });
    }

    if (user.role === 'viewer') {
      return NextResponse.json({ error: 'Viewers cannot place bids' }, { status: 403 });
    }

    const { teamId, amount } = await req.json();

    if (!teamId || typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Invalid team or bid amount' }, { status: 400 });
    }

    // Captains can only bid for their assigned team
    if (user.role === 'captain' && user.team_id !== teamId) {
      return NextResponse.json({ error: 'Captains can only place bids for their own team' }, { status: 403 });
    }

    const state = placeBid(teamId, amount, user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
