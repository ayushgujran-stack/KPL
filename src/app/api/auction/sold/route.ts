import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { declareSold } from '@/lib/auction-service';
import { connection } from 'next/server';

export async function POST() {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only organisers or admin can declare SOLD.' }, { status: 403 });
    }

    const state = await declareSold(user);
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
