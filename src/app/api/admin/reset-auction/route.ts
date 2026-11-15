import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { resetCompleteAuction } from '@/lib/auction-service';

export async function POST(req: Request) {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can perform auction reset' }, { status: 403 });
    }

    const { keepRetention = true, confirmationPhrase } = await req.json();
    const result = await resetCompleteAuction(keepRetention, confirmationPhrase, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
