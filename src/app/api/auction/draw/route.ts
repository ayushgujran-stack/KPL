import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { startRandomPlayerDraw } from '@/lib/auction-service';
import { connection } from 'next/server';

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || !['super_admin', 'organiser_1', 'organiser_2'].includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized: Only organisers or admin can trigger random draws.' }, { status: 403 });
    }

    const { category = 'all' } = await req.json().catch(() => ({}));
    const result = startRandomPlayerDraw(category, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
