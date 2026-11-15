import { NextResponse, connection } from 'next/server';
import { getAuctionState } from '@/lib/auction-service';

export async function GET(req: Request) {
  try {
    await connection();
    const state = await getAuctionState();
    return NextResponse.json(state, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
