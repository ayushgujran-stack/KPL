import { db } from './db';
import { adminDb } from './firebase-admin';
import * as firestoreService from './firestore-service';
import {
  Team,
  Player,
  AuctionEvent,
  Bid,
  AuctionResult,
  User,
  AuditLog,
  TeamRetention,
  AuctionStatus,
  VALID_AUCTION_TRANSITIONS,
} from '@/types';
import crypto from 'crypto';

export interface AuctionStatePayload {
  event: AuctionEvent;
  currentPlayer: Player | null;
  currentBidTeam: Team | null;
  teams: Team[];
  recentBids: (Bid & { team_name: string; team_color: string; team_code: string })[];
  recentResults: (AuctionResult & { player_name: string; player_role: string; team_name?: string; team_color?: string })[];
  latestResult?: (AuctionResult & { player_name: string; team_name?: string; team_color?: string }) | null;
  totalPlayers: number;
  soldCount: number;
  unsoldCount: number;
  retainedCount: number;
  remainingPoolCount: number;
}

export function normalizeAuctionStatus(rawStatus?: string): AuctionStatus {
  if (!rawStatus) return 'NOT_STARTED';
  const upper = rawStatus.toUpperCase();
  if (upper === 'DRAWN' || upper === 'DRAWING' || upper === 'RANDOM_DRAW') return 'RANDOM_DRAW';
  if (upper === 'PLAYER_READY') return 'PLAYER_READY';
  if (upper === 'BIDDING') return 'BIDDING';
  if (upper === 'PAUSED' || upper === 'BIDDING_PAUSED') return 'BIDDING_PAUSED';
  if (upper === 'SOLD' || upper === 'UNSOLD' || upper === 'RESULT_COMPLETED') return 'RESULT_COMPLETED';
  if (upper === 'COMPLETED' || upper === 'AUCTION_COMPLETED') return 'AUCTION_COMPLETED';
  if (Object.keys(VALID_AUCTION_TRANSITIONS).includes(upper)) {
    return upper as AuctionStatus;
  }
  return 'NOT_STARTED';
}

export function validateAuctionTransition(currentStatus: AuctionStatus, newStatus: AuctionStatus) {
  if (currentStatus === newStatus) return; // Idempotent same-state
  const allowed = VALID_AUCTION_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid auction state transition: Cannot transition from ${currentStatus} to ${newStatus}. Allowed next states: ${allowed.join(', ') || 'none'}`
    );
  }
}

export function logAudit(userId: string, userName: string, userRole: string, action: string, details: string) {
  if (adminDb) {
    firestoreService.logFirestoreAudit(userId, userName, userRole, action, details).catch(() => {});
  }
  try {
    const id = crypto.randomUUID();
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, user_role, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, userId, userName, userRole, action, details);
  } catch {}
}

// ---------------------------------------------------------------------------
// 1. Teams with Budgets
// ---------------------------------------------------------------------------
export function localGetTeamsWithBudgets(): Team[] {
  const teams = db.prepare(`SELECT * FROM teams ORDER BY name ASC`).all() as any[];

  return teams.map((team) => {
    const retRow = db.prepare(`
      SELECT COALESCE(SUM(points), 0) as total_retention
      FROM team_retentions
      WHERE team_id = ?
    `).get(team.id) as { total_retention: number };

    const aucRow = db.prepare(`
      SELECT COALESCE(SUM(final_price), 0) as total_auction
      FROM auction_results
      WHERE team_id = ? AND status = 'sold'
    `).get(team.id) as { total_auction: number };

    const countRow = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM (
        SELECT player_id FROM team_retentions WHERE team_id = ?
        UNION
        SELECT player_id FROM auction_results WHERE team_id = ? AND status = 'sold'
      )
    `).get(team.id, team.id) as { cnt: number };

    const retention_spent = retRow.total_retention || 0;
    const auction_spent = aucRow.total_auction || 0;
    const remaining_budget = team.initial_budget - retention_spent - auction_spent;

    return {
      ...team,
      retention_spent,
      auction_spent,
      remaining_budget: Math.max(0, remaining_budget),
      players_count: countRow.cnt || 0,
    };
  });
}

function isFirestoreSystemError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toString().toLowerCase();
  if (['unavailable', 'deadline_exceeded', 'resource_exhausted', 'internal', 'unauthenticated', '14', '4', '8', '13', '16'].includes(code)) {
    return true;
  }
  if (
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('could not connect') ||
    msg.includes('network error') ||
    msg.includes('service unavailable')
  ) {
    return true;
  }
  return false;
}

export async function getTeamsWithBudgets(): Promise<Team[]> {
  if (adminDb) {
    try {
      const fTeams = await firestoreService.getFirestoreTeamsWithBudgets();
      if (fTeams && fTeams.length > 0) return fTeams;
    } catch (err: any) {
      console.warn('Firestore getTeamsWithBudgets fallback to SQLite:', err.message);
    }
  }
  return localGetTeamsWithBudgets();
}

// ---------------------------------------------------------------------------
// 2. Authoritative Auction State
// ---------------------------------------------------------------------------
export function localGetAuctionState(): AuctionStatePayload {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  if (event) {
    event.status = normalizeAuctionStatus(event.status);
  }
  const teams = localGetTeamsWithBudgets();

  let currentPlayer: Player | null = null;
  if (event && event.current_player_id) {
    currentPlayer = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player | null;
  }

  let currentBidTeam: Team | null = null;
  if (event && event.current_bid_team_id) {
    currentBidTeam = teams.find((t) => t.id === event.current_bid_team_id) || null;
  }

  const recentBids = db.prepare(`
    SELECT b.*, t.name as team_name, t.primary_color as team_color, t.code as team_code
    FROM bids b
    JOIN teams t ON b.team_id = t.id
    WHERE b.auction_event_id = 'kpl-2026' AND b.player_id = ?
    ORDER BY b.timestamp DESC, b.amount DESC
    LIMIT 15
  `).all(event?.current_player_id || '') as any[];

  const recentResults = db.prepare(`
    SELECT r.*, p.name as player_name, p.role as player_role, t.name as team_name, t.primary_color as team_color
    FROM auction_results r
    JOIN players p ON r.player_id = p.id
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.auction_event_id = 'kpl-2026'
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all() as any[];

  let latestResult: any = null;
  if (event && event.current_player_id) {
    latestResult = db.prepare(`
      SELECT r.*, t.name as team_name, t.primary_color as team_color, p.name as player_name
      FROM auction_results r
      LEFT JOIN teams t ON r.team_id = t.id
      JOIN players p ON r.player_id = p.id
      WHERE r.player_id = ?
      ORDER BY r.created_at DESC
      LIMIT 1
    `).get(event.current_player_id) || null;
  }

  const totalPlayersRow = db.prepare(`SELECT COUNT(*) as count FROM players WHERE is_active = 1`).get() as { count: number };
  const soldRow = db.prepare(`SELECT COUNT(DISTINCT player_id) as count FROM auction_results WHERE status = 'sold'`).get() as { count: number };
  const unsoldRow = db.prepare(`SELECT COUNT(*) as count FROM players WHERE status = 'unsold' AND is_active = 1`).get() as { count: number };
  const retainedRow = db.prepare(`SELECT COUNT(*) as count FROM team_retentions`).get() as { count: number };

  const totalPlayers = totalPlayersRow.count;
  const soldCount = soldRow.count;
  const unsoldCount = unsoldRow.count;
  const retainedCount = retainedRow.count;
  const remainingPoolCount = Math.max(0, totalPlayers - soldCount - retainedCount);

  return {
    event,
    currentPlayer,
    currentBidTeam,
    teams,
    recentBids,
    recentResults,
    latestResult,
    totalPlayers,
    soldCount,
    unsoldCount,
    retainedCount,
    remainingPoolCount,
  };
}

export async function getAuctionState(): Promise<AuctionStatePayload> {
  if (adminDb) {
    try {
      const fState = await firestoreService.getFirestoreAuctionState();
      if (fState) return fState;
    } catch (err: any) {
      console.warn('Firestore getAuctionState fallback to SQLite:', err.message);
    }
  }
  return localGetAuctionState();
}

// ---------------------------------------------------------------------------
// 3. Random Player Lottery Draw
// ---------------------------------------------------------------------------
export function localStartRandomPlayerDraw(category: string, user: { id: string; name: string; role: string }) {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  if (['PLAYER_READY', 'BIDDING', 'BIDDING_PAUSED'].includes(currentStatus)) {
    throw new Error(`Cannot start a new lottery draw while a player auction is active on the podium (Current Status: ${currentStatus}). Declare SOLD/UNSOLD and finish the round first.`);
  }

  let query = `
    SELECT id, name, photo_url, role, category, base_price, gender, player_number
    FROM players
    WHERE is_active = 1
      AND status NOT IN ('sold', 'retained', 'in_auction')
  `;
  const params: any[] = [];

  if (category === 'male') {
    query += ` AND gender = 'Male'`;
  } else if (category === 'female') {
    query += ` AND gender = 'Female'`;
  }

  const availableCheckQuery = query + ` AND status != 'unsold'`;
  let eligiblePlayers = db.prepare(availableCheckQuery).all(...params) as Player[];

  if (eligiblePlayers.length === 0) {
    eligiblePlayers = db.prepare(query).all(...params) as Player[];
  }

  if (eligiblePlayers.length === 0) {
    throw new Error(`No eligible players remaining for draw category: "${category}"!`);
  }

  const randomIndex = crypto.randomInt(0, eligiblePlayers.length);
  const selectedPlayer = eligiblePlayers[randomIndex];

  const sampleCandidates = [...eligiblePlayers]
    .sort(() => 0.5 - Math.random())
    .slice(0, 15)
    .map((p) => ({ id: p.id, name: p.name, photo_url: p.photo_url, role: p.role, base_price: p.base_price }));

  if (!sampleCandidates.find((c) => c.id === selectedPlayer.id)) {
    sampleCandidates.push({
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      photo_url: selectedPlayer.photo_url,
      role: selectedPlayer.role,
      base_price: selectedPlayer.base_price,
    });
  }

  const drawId = crypto.randomUUID();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO random_draws (id, auction_event_id, player_id, draw_category, drawn_by_user_id, confirmed)
      VALUES (?, 'kpl-2026', ?, ?, ?, 0)
    `).run(drawId, selectedPlayer.id, category, user.id);

    db.prepare(`
      UPDATE auction_events
      SET status = 'RANDOM_DRAW',
          current_player_id = ?,
          current_bid = ?,
          current_bid_team_id = NULL,
          bid_timer = timer_duration,
          draw_category = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run(selectedPlayer.id, selectedPlayer.base_price, category);

    logAudit(
      user.id,
      user.name,
      user.role,
      'RANDOM_DRAW',
      `Randomly drew player #${selectedPlayer.player_number} - ${selectedPlayer.name} (${selectedPlayer.role}) for base price ${selectedPlayer.base_price} pts.`
    );
  });

  tx();

  return {
    drawId,
    selectedPlayer,
    candidates: sampleCandidates,
  };
}

export async function startRandomPlayerDraw(category: string, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.startFirestoreRandomPlayerDraw(category, user);
      try {
        const p = res.selectedPlayer;
        if (p) {
          db.prepare(`
            UPDATE auction_events
            SET status = 'RANDOM_DRAW',
                current_player_id = ?,
                current_bid = ?,
                current_bid_team_id = NULL,
                draw_category = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'kpl-2026'
          `).run(p.id, p.base_price, category);
          db.prepare(`UPDATE players SET status = 'in_auction' WHERE id = ?`).run(p.id);
        }
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore startRandomPlayerDraw fallback to SQLite:', err.message);
    }
  }
  return localStartRandomPlayerDraw(category, user);
}

// ---------------------------------------------------------------------------
// 4. Confirm Player for Auction Podium
// ---------------------------------------------------------------------------
export function localConfirmPlayerForAuction(user: { id: string; name: string; role: string }) {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'PLAYER_READY');

  if (!event.current_player_id) {
    throw new Error('No player has been selected in the random draw yet!');
  }

  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE random_draws
      SET confirmed = 1
      WHERE auction_event_id = 'kpl-2026' AND player_id = ?
    `).run(player.id);

    db.prepare(`
      UPDATE players
      SET status = 'in_auction'
      WHERE id = ?
    `).run(player.id);

    db.prepare(`
      UPDATE auction_events
      SET status = 'PLAYER_READY',
          current_bid = ?,
          current_bid_team_id = NULL,
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run(player.base_price);

    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_CONFIRMED',
      `Player #${player.player_number} ${player.name} confirmed for live auction podium. Status: PLAYER_READY.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function confirmPlayerForAuction(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.confirmFirestorePlayer(user);
      try {
        db.prepare(`
          UPDATE auction_events
          SET status = 'PLAYER_READY',
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 'kpl-2026'
        `).run();
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore confirmPlayerForAuction fallback to SQLite:', err.message);
    }
  }
  return localConfirmPlayerForAuction(user);
}

// ---------------------------------------------------------------------------
// 5. Start Bidding & Live Countdown
// ---------------------------------------------------------------------------
export function localStartBidding(user: { id: string; name: string; role: string }) {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'BIDDING');

  if (!event.current_player_id) {
    throw new Error('No player has been confirmed on the auction podium!');
  }

  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE auction_events
      SET status = 'BIDDING',
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'START_BIDDING',
      `Live bidding started for player ${player.name} with opening base price ${player.base_price} pts.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function startBidding(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.startFirestoreBidding(user);
      try {
        db.prepare(`
          UPDATE auction_events
          SET status = 'BIDDING',
              bid_timer = timer_duration,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = 'kpl-2026'
        `).run();
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore startBidding fallback to SQLite:', err.message);
    }
  }
  return localStartBidding(user);
}

// ---------------------------------------------------------------------------
// 6. Place Atomic Bid
// ---------------------------------------------------------------------------
export function localPlaceBid(
  teamId: string,
  amount: number,
  user: { id: string; name: string; role: string; team_id?: string | null }
) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    if (currentStatus !== 'BIDDING') {
      if (currentStatus === 'PLAYER_READY') {
        throw new Error('Bidding has not started yet. Waiting for Organiser to click Start Bidding.');
      } else if (currentStatus === 'BIDDING_PAUSED') {
        throw new Error('Bidding is currently paused by the Organiser.');
      } else if (currentStatus === 'RESULT_COMPLETED') {
        throw new Error('Bidding for this player has ended.');
      } else {
        throw new Error(`Bidding is not open (Current Status: ${currentStatus}).`);
      }
    }

    if (!event.current_player_id) {
      throw new Error('No active player in the auction to bid on.');
    }

    if (user.role === 'captain' && user.team_id !== teamId) {
      throw new Error('Captains can only place bids on behalf of their assigned team!');
    }

    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as Team;
    if (!team) {
      throw new Error('Team not found.');
    }

    if (event.current_bid_team_id === teamId) {
      throw new Error(`${team.name} is already the highest bidder at ${event.current_bid} pts! Cannot bid against yourself.`);
    }

    const teams = localGetTeamsWithBudgets();
    const teamWithBudget = teams.find((t) => t.id === teamId);
    if (!teamWithBudget) {
      throw new Error('Unable to compute team budget.');
    }

    if (amount > teamWithBudget.remaining_budget) {
      throw new Error(
        `Insufficient points! Bid of ${amount} pts exceeds ${team.name}'s remaining budget of ${teamWithBudget.remaining_budget} pts.`
      );
    }

    if (!event.current_bid_team_id) {
      if (amount < event.current_bid) {
        throw new Error(`First bid must be at least the base price of ${event.current_bid} pts.`);
      }
    } else {
      if (amount <= event.current_bid) {
        throw new Error(`Bid amount (${amount} pts) must be strictly higher than current bid of ${event.current_bid} pts!`);
      }
    }

    const bidId = crypto.randomUUID();

    db.prepare(`
      INSERT INTO bids (id, auction_event_id, player_id, team_id, amount, bidder_user_id)
      VALUES (?, 'kpl-2026', ?, ?, ?, ?)
    `).run(bidId, event.current_player_id, teamId, amount, user.id);

    db.prepare(`
      UPDATE auction_events
      SET current_bid = ?,
          current_bid_team_id = ?,
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run(amount, teamId);

    logAudit(
      user.id,
      user.name,
      user.role,
      'BID_PLACED',
      `${team.name} placed bid of ${amount} pts for player.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function placeBid(
  teamId: string,
  amount: number,
  user: { id: string; name: string; role: string; team_id?: string | null }
) {
  if (adminDb) {
    try {
      const res = await firestoreService.placeFirestoreBid(teamId, amount, user);
      try {
        const player = res?.currentPlayer;
        if (player) {
          const bidId = crypto.randomUUID();
          db.prepare(`
            INSERT INTO bids (id, auction_event_id, player_id, team_id, bidder_user_id, amount)
            VALUES (?, 'kpl-2026', ?, ?, ?, ?)
          `).run(bidId, player.id, teamId, user.id, amount);
          db.prepare(`
            UPDATE auction_events
            SET current_bid = ?,
                current_bid_team_id = ?,
                bid_timer = timer_duration,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'kpl-2026'
          `).run(amount, teamId);
        }
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore placeBid fallback to SQLite:', err.message);
    }
  }
  return localPlaceBid(teamId, amount, user);
}

// ---------------------------------------------------------------------------
// 7. Declare SOLD
// ---------------------------------------------------------------------------
export function localDeclareSold(user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    validateAuctionTransition(currentStatus, 'RESULT_COMPLETED');

    if (!event.current_player_id) {
      throw new Error('No player currently in auction.');
    }

    if (!event.current_bid_team_id) {
      throw new Error('Cannot declare SOLD without any bids! Use DECLARE UNSOLD if no team placed a bid.');
    }

    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(event.current_bid_team_id) as Team;
    const resultId = crypto.randomUUID();

    db.prepare(`
      UPDATE players
      SET status = 'sold',
          sold_price = ?,
          sold_to_team_id = ?
      WHERE id = ?
    `).run(event.current_bid, team.id, player.id);

    db.prepare(`
      INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
      VALUES (?, 'kpl-2026', ?, ?, ?, 'sold', ?)
    `).run(resultId, player.id, team.id, event.current_bid, user.name);

    db.prepare(`
      UPDATE auction_events
      SET status = 'RESULT_COMPLETED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_SOLD',
      `SOLD: Player ${player.name} sold to ${team.name} for ${event.current_bid} pts.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function declareSold(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.declareFirestoreSold(user);
      try {
        const event = res?.event;
        const player = res?.currentPlayer;
        const teamId = event?.current_bid_team_id;
        if (player && teamId) {
          const resultId = crypto.randomUUID();
          db.prepare(`
            UPDATE players
            SET status = 'sold',
                sold_price = ?,
                sold_to_team_id = ?
            WHERE id = ?
          `).run(event.current_bid, teamId, player.id);
          db.prepare(`
            INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
            VALUES (?, 'kpl-2026', ?, ?, ?, 'sold', ?)
          `).run(resultId, player.id, teamId, event.current_bid, user.name);
          db.prepare(`
            UPDATE auction_events
            SET status = 'RESULT_COMPLETED',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'kpl-2026'
          `).run();
        }
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore declareSold fallback to SQLite:', err.message);
    }
  }
  return localDeclareSold(user);
}

// ---------------------------------------------------------------------------
// 8. Declare UNSOLD
// ---------------------------------------------------------------------------
export function localDeclareUnsold(user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    validateAuctionTransition(currentStatus, 'RESULT_COMPLETED');

    if (!event.current_player_id) {
      throw new Error('No player currently in auction.');
    }

    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;
    const resultId = crypto.randomUUID();

    db.prepare(`
      UPDATE players
      SET status = 'unsold',
          sold_price = NULL,
          sold_to_team_id = NULL
      WHERE id = ?
    `).run(player.id);

    db.prepare(`
      INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
      VALUES (?, 'kpl-2026', ?, NULL, 0, 'unsold', ?)
    `).run(resultId, player.id, user.name);

    db.prepare(`
      UPDATE auction_events
      SET status = 'RESULT_COMPLETED',
          current_bid_team_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_UNSOLD',
      `UNSOLD: Player ${player.name} declared unsold at base price ${player.base_price} pts.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function declareUnsold(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.declareFirestoreUnsold(user);
      try {
        const player = res?.currentPlayer;
        if (player) {
          const resultId = crypto.randomUUID();
          db.prepare(`
            UPDATE players
            SET status = 'unsold',
                sold_price = NULL,
                sold_to_team_id = NULL
            WHERE id = ?
          `).run(player.id);
          db.prepare(`
            INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
            VALUES (?, 'kpl-2026', ?, NULL, 0, 'unsold', ?)
          `).run(resultId, player.id, user.name);
          db.prepare(`
            UPDATE auction_events
            SET status = 'RESULT_COMPLETED',
                current_bid_team_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = 'kpl-2026'
          `).run();
        }
      } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore declareUnsold fallback to SQLite:', err.message);
    }
  }
  return localDeclareUnsold(user);
}

// ---------------------------------------------------------------------------
// 9. Next Random Draw
// ---------------------------------------------------------------------------
export function localNextRandomDraw(user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    validateAuctionTransition(currentStatus, 'RANDOM_DRAW');

    db.prepare(`
      UPDATE auction_events
      SET status = 'RANDOM_DRAW',
          current_player_id = NULL,
          current_bid = 0.0,
          current_bid_team_id = NULL,
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'NEXT_RANDOM_DRAW',
      `Podium cleared. Transitioned auction to RANDOM_DRAW for next player draw.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function nextRandomDraw(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.nextFirestoreRandomDraw(user);
      try { localNextRandomDraw(user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore nextRandomDraw fallback to SQLite:', err.message);
    }
  }
  return localNextRandomDraw(user);
}

// ---------------------------------------------------------------------------
// 10. Re-introduce Player
// ---------------------------------------------------------------------------
export function localReintroducePlayer(playerId: string, user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(playerId) as Player;
    if (!player) throw new Error('Player not found.');

    db.prepare(`
      UPDATE players
      SET status = 'available',
          sold_price = NULL,
          sold_to_team_id = NULL
      WHERE id = ?
    `).run(playerId);

    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_REINTRODUCED',
      `Re-introduced unsold player ${player.name} back to available player pool.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function reintroducePlayer(playerId: string, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.reintroduceFirestorePlayer(playerId, user);
      try { localReintroducePlayer(playerId, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore reintroducePlayer fallback to SQLite:', err.message);
    }
  }
  return localReintroducePlayer(playerId, user);
}

// ---------------------------------------------------------------------------
// 11. Auction Podium Controls
// ---------------------------------------------------------------------------
export function localControlAuction(
  action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw' | 'unlock_retention',
  payload: any,
  user: { id: string; name: string; role: string }
) {
  if (action === 'start_bidding') {
    return localStartBidding(user);
  }
  if (action === 'next_random_draw') {
    return localNextRandomDraw(user);
  }

  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    if (action === 'pause') {
      validateAuctionTransition(currentStatus, 'BIDDING_PAUSED');
      db.prepare(`UPDATE auction_events SET status = 'BIDDING_PAUSED', updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();
      logAudit(user.id, user.name, user.role, 'AUCTION_PAUSED', 'Live bidding was paused by organiser.');
    } else if (action === 'resume') {
      validateAuctionTransition(currentStatus, 'BIDDING');
      db.prepare(`UPDATE auction_events SET status = 'BIDDING', updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();
      logAudit(user.id, user.name, user.role, 'AUCTION_RESUMED', 'Live bidding resumed by organiser.');
    } else if (action === 'reset_timer') {
      db.prepare(`UPDATE auction_events SET bid_timer = timer_duration, updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();
      logAudit(user.id, user.name, user.role, 'TIMER_RESET', `Timer reset to ${event.timer_duration}s.`);
    } else if (action === 'set_timer_duration') {
      const duration = Number(payload.duration) || 20;
      db.prepare(`UPDATE auction_events SET timer_duration = ?, bid_timer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run(
        duration,
        duration
      );
      logAudit(user.id, user.name, user.role, 'TIMER_DURATION_UPDATED', `Default countdown timer set to ${duration}s.`);
    } else if (action === 'unlock_retention') {
      if (['BIDDING'].includes(currentStatus)) {
        throw new Error('Cannot unlock retention while live bidding is in progress. Pause or conclude the round first.');
      }
      db.prepare(`
        UPDATE auction_events
        SET status = 'NOT_STARTED',
            current_player_id = NULL,
            current_bid = 0,
            current_bid_team_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 'kpl-2026'
      `).run();
      db.prepare(`UPDATE players SET status = 'available' WHERE status = 'in_auction'`).run();
      logAudit(user.id, user.name, user.role, 'RETENTION_UNLOCKED', 'Auction returned to NOT_STARTED to allow retention changes.');
    }
  });

  tx();
  return localGetAuctionState();
}

export async function controlAuction(
  action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw' | 'unlock_retention',
  payload: any,
  user: { id: string; name: string; role: string }
) {
  if (adminDb) {
    try {
      const res = await firestoreService.controlFirestoreAuction(action, payload, user);
      try { localControlAuction(action, payload, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore controlAuction fallback to SQLite:', err.message);
    }
  }
  return localControlAuction(action, payload, user);
}

// ---------------------------------------------------------------------------
// 12. Retention Operations
// ---------------------------------------------------------------------------
export function localAddRetention(teamId: string, playerId: string, points: number, user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
      throw new Error('Retention is locked! Auction has already started or been initialized.');
    }

    const currentCount = db.prepare(`SELECT COUNT(*) as cnt FROM team_retentions WHERE team_id = ?`).get(teamId) as { cnt: number };
    if (currentCount.cnt >= 2) {
      throw new Error('A team can retain a maximum of 2 players only!');
    }

    const existingRet = db.prepare(`SELECT * FROM team_retentions WHERE player_id = ?`).get(playerId);
    if (existingRet) {
      throw new Error('This player is already retained by a team!');
    }

    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as Team;
    const spentRow = db.prepare(`SELECT COALESCE(SUM(points), 0) as spent FROM team_retentions WHERE team_id = ?`).get(teamId) as { spent: number };
    if (spentRow.spent + points > team.initial_budget) {
      throw new Error(`Retention points (${points} pts) exceed remaining budget (${team.initial_budget - spentRow.spent} pts)!`);
    }

    const retId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO team_retentions (id, team_id, player_id, points)
      VALUES (?, ?, ?, ?)
    `).run(retId, teamId, playerId, points);

    db.prepare(`
      UPDATE players
      SET status = 'retained',
          sold_price = ?,
          sold_to_team_id = ?
      WHERE id = ?
    `).run(points, teamId, playerId);

    const player = db.prepare(`SELECT name FROM players WHERE id = ?`).get(playerId) as { name: string };
    db.prepare(`UPDATE auction_events SET updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();
    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_RETAINED',
      `${team.name} retained ${player.name} for ${points} pts.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function addRetention(teamId: string, playerId: string, points: number, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.addFirestoreRetention(teamId, playerId, points, user);
      try { localAddRetention(teamId, playerId, points, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore addRetention fallback to SQLite:', err.message);
    }
  }
  return localAddRetention(teamId, playerId, points, user);
}

export function localRemoveRetention(retentionId: string, user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
      throw new Error('Retention is locked while auction is active.');
    }

    const ret = db.prepare(`
      SELECT r.*, p.name as player_name, t.name as team_name
      FROM team_retentions r
      JOIN players p ON r.player_id = p.id
      JOIN teams t ON r.team_id = t.id
      WHERE r.id = ?
    `).get(retentionId) as any;

    if (!ret) throw new Error('Retention record not found.');

    db.prepare(`DELETE FROM team_retentions WHERE id = ?`).run(retentionId);
    db.prepare(`UPDATE players SET status = 'available', sold_price = NULL, sold_to_team_id = NULL WHERE id = ?`).run(ret.player_id);
    db.prepare(`UPDATE auction_events SET updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'RETENTION_REMOVED',
      `Removed retention of ${ret.player_name} from ${ret.team_name}.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function removeRetention(retentionId: string, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.removeFirestoreRetention(retentionId, user);
      try { localRemoveRetention(retentionId, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore removeRetention fallback to SQLite:', err.message);
    }
  }
  return localRemoveRetention(retentionId, user);
}

export function localUpdateRetention(retentionId: string, newPoints: number, user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
      throw new Error('Retention is locked while auction is active.');
    }

    if (typeof newPoints !== 'number' || newPoints <= 0) {
      throw new Error('Points must be a positive number.');
    }

    const ret = db.prepare(`SELECT * FROM team_retentions WHERE id = ?`).get(retentionId) as any;
    if (!ret) throw new Error('Retention record not found.');

    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(ret.team_id) as Team;
    const otherSpentRow = db.prepare(`
      SELECT COALESCE(SUM(points), 0) as spent FROM team_retentions WHERE team_id = ? AND id != ?
    `).get(ret.team_id, retentionId) as { spent: number };

    if (otherSpentRow.spent + newPoints > team.initial_budget) {
      throw new Error(`Updated points (${newPoints} pts) exceed remaining budget (${team.initial_budget - otherSpentRow.spent} pts)!`);
    }

    db.prepare(`UPDATE team_retentions SET points = ? WHERE id = ?`).run(newPoints, retentionId);
    db.prepare(`UPDATE players SET sold_price = ? WHERE id = ?`).run(newPoints, ret.player_id);
    db.prepare(`UPDATE auction_events SET updated_at = CURRENT_TIMESTAMP WHERE id = 'kpl-2026'`).run();

    const player = db.prepare(`SELECT name FROM players WHERE id = ?`).get(ret.player_id) as { name: string };
    logAudit(
      user.id,
      user.name,
      user.role,
      'RETENTION_UPDATED',
      `Updated retention points for ${player.name} (${team.name}) to ${newPoints} pts.`
    );
  });

  tx();
  return localGetAuctionState();
}

export async function updateRetention(retentionId: string, newPoints: number, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.updateFirestoreRetention(retentionId, newPoints, user);
      try { localUpdateRetention(retentionId, newPoints, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore updateRetention fallback to SQLite:', err.message);
    }
  }
  return localUpdateRetention(retentionId, newPoints, user);
}

// ---------------------------------------------------------------------------
// 13. Data Management & Reset
// ---------------------------------------------------------------------------
export function localClearTransactionData(confirmationPhrase: string, user: { id: string; name: string; role: string }) {
  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can clear transaction data!');
  }

  if (confirmationPhrase !== 'CLEAR TRANSACTIONS') {
    throw new Error('Invalid confirmation phrase. You must type CLEAR TRANSACTIONS exactly.');
  }

  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) === 'BIDDING') {
      throw new Error('Cannot clear transactions while live bidding is active. Pause or close the auction first.');
    }

    const bidsCount = db.prepare(`SELECT COUNT(*) as cnt FROM bids`).get() as { cnt: number };
    db.prepare(`DELETE FROM bids`).run();

    const drawsCount = db.prepare(`SELECT COUNT(*) as cnt FROM random_draws`).get() as { cnt: number };
    db.prepare(`DELETE FROM random_draws`).run();

    const resultsCount = db.prepare(`SELECT COUNT(*) as cnt FROM auction_results`).get() as { cnt: number };
    db.prepare(`DELETE FROM auction_results`).run();

    db.prepare(`
      UPDATE players
      SET status = 'available',
          sold_price = NULL,
          sold_to_team_id = NULL
      WHERE id NOT IN (SELECT player_id FROM team_retentions)
    `).run();

    db.prepare(`
      UPDATE auction_events
      SET status = 'NOT_STARTED',
          current_player_id = NULL,
          current_bid = 0.0,
          current_bid_team_id = NULL,
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'CLEAR_TRANSACTIONS',
      `Cleared all auction transactions: ${bidsCount.cnt} bids, ${drawsCount.cnt} draws, ${resultsCount.cnt} results deleted. Teams recalculated to 150 - retentions.`
    );
  });

  tx();
  return { success: true, message: 'All auction transactions cleared successfully. Team balances recalculated.' };
}

export async function clearTransactionData(confirmationPhrase: string, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.clearFirestoreTransactions(confirmationPhrase, user);
      try { localClearTransactionData(confirmationPhrase, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore clearTransactions fallback to SQLite:', err.message);
    }
  }
  return localClearTransactionData(confirmationPhrase, user);
}

export function localResetCompleteAuction(keepRetention: boolean, confirmationPhrase: string, user: { id: string; name: string; role: string }) {
  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can perform a complete auction reset!');
  }

  if (confirmationPhrase !== 'RESET AUCTION') {
    throw new Error('Invalid confirmation phrase. You must type RESET AUCTION exactly.');
  }

  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) === 'BIDDING') {
      throw new Error('Cannot reset complete auction while bidding is active.');
    }

    db.prepare(`DELETE FROM bids`).run();
    db.prepare(`DELETE FROM random_draws`).run();
    db.prepare(`DELETE FROM auction_results`).run();

    if (!keepRetention) {
      db.prepare(`DELETE FROM team_retentions`).run();
      db.prepare(`
        UPDATE players
        SET status = 'available',
            sold_price = NULL,
            sold_to_team_id = NULL
      `).run();
    } else {
      db.prepare(`
        UPDATE players
        SET status = 'available',
            sold_price = NULL,
            sold_to_team_id = NULL
        WHERE id NOT IN (SELECT player_id FROM team_retentions)
      `).run();
    }

    db.prepare(`
      UPDATE auction_events
      SET status = 'NOT_STARTED',
          current_player_id = NULL,
          current_bid = 0.0,
          current_bid_team_id = NULL,
          bid_timer = timer_duration,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 'kpl-2026'
    `).run();

    logAudit(
      user.id,
      user.name,
      user.role,
      'RESET_COMPLETE_AUCTION',
      `Complete auction reset executed. Keep retention: ${keepRetention}. Status reset to NOT STARTED.`
    );
  });

  tx();
  return { success: true, message: 'Complete auction reset completed successfully.' };
}

export async function resetCompleteAuction(keepRetention: boolean, confirmationPhrase: string, user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const res = await firestoreService.resetFirestoreAuction(keepRetention, confirmationPhrase, user);
      try { localResetCompleteAuction(keepRetention, confirmationPhrase, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore resetCompleteAuction fallback to SQLite:', err.message);
    }
  }
  return localResetCompleteAuction(keepRetention, confirmationPhrase, user);
}

export function localClearMasterData(
  options: { players?: boolean; teams?: boolean; categories?: boolean },
  confirmationPhrase: string,
  user: { id: string; name: string; role: string }
) {
  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can clear master data!');
  }

  if (confirmationPhrase !== 'CLEAR MASTERS') {
    throw new Error('Invalid confirmation phrase. You must type CLEAR MASTERS exactly.');
  }

  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) === 'BIDDING') {
      throw new Error('Cannot clear master records while auction is active.');
    }

    let report: string[] = [];

    if (options.players) {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM players`).get() as { cnt: number };
      db.prepare(`DELETE FROM team_retentions`).run();
      db.prepare(`DELETE FROM bids`).run();
      db.prepare(`DELETE FROM auction_results`).run();
      db.prepare(`DELETE FROM random_draws`).run();
      db.prepare(`DELETE FROM players`).run();
      db.prepare(`UPDATE auction_events SET current_player_id = NULL, current_bid = 0, current_bid_team_id = NULL WHERE id = 'kpl-2026'`).run();
      report.push(`Cleared ${count.cnt} player records`);
    }

    if (options.teams) {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM teams`).get() as { cnt: number };
      db.prepare(`UPDATE users SET team_id = NULL WHERE role = 'captain'`).run();
      db.prepare(`DELETE FROM team_retentions`).run();
      db.prepare(`DELETE FROM bids`).run();
      db.prepare(`DELETE FROM auction_results`).run();
      db.prepare(`DELETE FROM teams`).run();
      report.push(`Cleared ${count.cnt} team records (preserved user accounts)`);
    }

    logAudit(
      user.id,
      user.name,
      user.role,
      'CLEAR_MASTER_DATA',
      `Clear Master Data executed: ${report.join(', ')}.`
    );
  });

  tx();
  return { success: true, message: 'Selected master data cleared safely.' };
}

export async function clearMasterData(
  options: { players?: boolean; teams?: boolean; categories?: boolean },
  confirmationPhrase: string,
  user: { id: string; name: string; role: string }
) {
  if (adminDb) {
    try {
      const res = await firestoreService.clearFirestoreMasters(options, confirmationPhrase, user);
      try { localClearMasterData(options, confirmationPhrase, user); } catch {}
      return res;
    } catch (err: any) {
      if (!isFirestoreSystemError(err)) throw err;
      console.warn('Firestore clearMasterData fallback to SQLite:', err.message);
    }
  }
  return localClearMasterData(options, confirmationPhrase, user);
}

export function localCreateDatabaseBackup(user: { id: string; name: string; role: string }) {
  const users = db.prepare(`SELECT id, username, name, role, team_id, created_at FROM users`).all();
  const teams = db.prepare(`SELECT * FROM teams`).all();
  const players = db.prepare(`SELECT * FROM players`).all();
  const retentions = db.prepare(`SELECT * FROM team_retentions`).all();
  const event = db.prepare(`SELECT * FROM auction_events`).all();
  const bids = db.prepare(`SELECT * FROM bids`).all();
  const results = db.prepare(`SELECT * FROM auction_results`).all();
  const draws = db.prepare(`SELECT * FROM random_draws`).all();

  const backupData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    createdBy: user.name,
    data: {
      users,
      teams,
      players,
      retentions,
      event,
      bids,
      results,
      draws,
    },
    counts: {
      users: users.length,
      teams: teams.length,
      players: players.length,
      retentions: retentions.length,
      bids: bids.length,
      results: results.length,
    },
  };

  const backupId = crypto.randomUUID();
  const filename = `backup_kpl_${Date.now()}.json`;

  db.prepare(`
    INSERT INTO backup_records (id, filename, created_by, record_counts)
    VALUES (?, ?, ?, ?)
  `).run(backupId, filename, user.name, JSON.stringify(backupData.counts));

  logAudit(user.id, user.name, user.role, 'BACKUP_CREATED', `Database snapshot ${filename} created.`);

  return { backupId, filename, backupData };
}

export async function createDatabaseBackup(user: { id: string; name: string; role: string }) {
  if (adminDb) {
    try {
      const [usersSnap, teamsSnap, playersSnap, retSnap, eventSnap, bidsSnap, resultsSnap, drawsSnap] = await Promise.all([
        adminDb.collection('users').get(),
        adminDb.collection('teams').get(),
        adminDb.collection('players').get(),
        adminDb.collection('team_retentions').get(),
        adminDb.collection('auction_events').get(),
        adminDb.collection('bids').get(),
        adminDb.collection('auction_results').get(),
        adminDb.collection('random_draws').get(),
      ]);

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        createdBy: user.name,
        data: {
          users: usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          teams: teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          players: playersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          retentions: retSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          event: eventSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          bids: bidsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          results: resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          draws: drawsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        },
        counts: {
          users: usersSnap.size,
          teams: teamsSnap.size,
          players: playersSnap.size,
          retentions: retSnap.size,
          bids: bidsSnap.size,
          results: resultsSnap.size,
        },
      };

      const backupId = crypto.randomUUID();
      const filename = `backup_kpl_${Date.now()}.json`;

      await adminDb.collection('backup_records').doc(backupId).set({
        id: backupId,
        filename,
        created_by: user.name,
        record_counts: JSON.stringify(backupData.counts),
        created_at: new Date().toISOString(),
      });

      await logAudit(user.id, user.name, user.role, 'BACKUP_CREATED', `Database snapshot ${filename} created.`);

      return { backupId, filename, backupData };
    } catch (err: any) {
      console.warn('Firestore createDatabaseBackup fallback to SQLite:', err.message);
    }
  }
  return localCreateDatabaseBackup(user);
}
