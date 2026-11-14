import { NextResponse } from 'next/server';
import { COOKIE_NAME } from '@/lib/auth';
import { connection } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.delete(COOKIE_NAME);
  return res;
}
