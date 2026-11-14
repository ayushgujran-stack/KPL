import { NextResponse } from 'next/server';
import { getCurrentUser, COOKIE_NAME } from '@/lib/auth';
import { connection } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
