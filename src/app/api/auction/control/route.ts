import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { controlAuction } from '@/lib/auction-service';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { action, payload } = await req.json();
    const state = controlAuction(action, payload, user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
