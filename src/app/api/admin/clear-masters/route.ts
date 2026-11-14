import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { clearMasterData } from '@/lib/auction-service';
import { connection } from 'next/server';

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can access Data Management' }, { status: 403 });
    }

    const { options, confirmationPhrase } = await req.json();
    const result = clearMasterData(options || {}, confirmationPhrase, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
