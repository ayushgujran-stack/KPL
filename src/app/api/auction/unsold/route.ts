import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { declareUnsold } from '@/lib/auction-service';
import { connection } from 'next/server';

export async function POST() {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only organisers or admin can declare UNSOLD.' }, { status: 403 });
    }

    const state = declareUnsold(user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
