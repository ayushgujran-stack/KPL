import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { clearTransactionData } from '@/lib/auction-service';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can access Data Management' }, { status: 403 });
    }

    const { confirmationPhrase } = await req.json();
    const result = clearTransactionData(confirmationPhrase, user);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
