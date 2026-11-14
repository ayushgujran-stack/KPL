import { NextResponse, connection } from 'next/server';
import { db } from '@/lib/db';
import { getTeamsWithBudgets, logAudit } from '@/lib/auction-service';
import { getCurrentUser } from '@/lib/auth';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    await connection();
    const teams = getTeamsWithBudgets();
    return NextResponse.json({ teams }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can add teams' }, { status: 403 });
    }

    const { name, code, logo_url, primary_color, secondary_color, captain_name, initial_budget = 150 } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and Code are required' }, { status: 400 });
    }

    const id = `team-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    db.prepare(`
      INSERT INTO teams (id, name, code, logo_url, primary_color, secondary_color, captain_name, initial_budget)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      code.toUpperCase(),
      logo_url || 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=200&h=200&fit=crop&q=80',
      primary_color || '#1e3a8a',
      secondary_color || '#3b82f6',
      captain_name || 'TBD',
      Number(initial_budget) || 150
    );

    logAudit(user.id, user.name, user.role, 'CREATE_TEAM', `Created team ${name} (${code})`);

    const teams = getTeamsWithBudgets();
    return NextResponse.json({ teams });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
