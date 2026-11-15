import { NextResponse, connection } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminDb } from '@/lib/firebase-admin';
import { getFirestoreAuditLogs } from '@/lib/firestore-service';

export async function GET() {
  try {
    await connection();
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (adminDb) {
      try {
        const logs = await getFirestoreAuditLogs(100);
        return NextResponse.json({ logs });
      } catch (err: any) {
        console.warn('Firestore getAuditLogs fallback to SQLite:', err.message);
      }
    }

    const logs = db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`).all();
    return NextResponse.json({ logs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
