import { NextResponse } from 'next/server';
import { getAuctionState } from '@/lib/auction-service';

export async function GET() {
  try {
    const state = getAuctionState();
    return NextResponse.json(state);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
