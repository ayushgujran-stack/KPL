import { NextResponse } from 'next/server';
import { getCurrentUser, COOKIE_NAME } from '@/lib/auth';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
