import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { startBidding } from '@/lib/auction-service';

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only organisers or admin can start bidding.' }, { status: 403 });
    }

    const state = startBidding(user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
