import { db } from './db';
import { Team, Player, AuctionEvent, Bid, AuctionResult, User, AuditLog, TeamRetention, AuctionStatus, VALID_AUCTION_TRANSITIONS } from '@/types';
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
  if (upper === 'DRAWN' || upper === 'DRAWING') return 'RANDOM_DRAW';
  if (upper === 'PAUSED') return 'BIDDING_PAUSED';
  if (upper === 'SOLD' || upper === 'UNSOLD') return 'RESULT_COMPLETED';
  if (upper === 'COMPLETED') return 'AUCTION_COMPLETED';
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
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, details)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, userName, userRole, action, details);
}

export function getTeamsWithBudgets(): Team[] {
  const teams = db.prepare(`SELECT * FROM teams ORDER BY name ASC`).all() as any[];

  return teams.map((team) => {
    // Retention spent
    const retRow = db.prepare(`
      SELECT COALESCE(SUM(points), 0) as total_retention
      FROM team_retentions
      WHERE team_id = ?
    `).get(team.id) as { total_retention: number };

    // Auction spent (only confirmed sold)
    const aucRow = db.prepare(`
      SELECT COALESCE(SUM(final_price), 0) as total_auction
      FROM auction_results
      WHERE team_id = ? AND status = 'sold'
    `).get(team.id) as { total_auction: number };

    // Player counts (retained + sold)
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

export function getAuctionState(): AuctionStatePayload {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  if (event) {
    event.status = normalizeAuctionStatus(event.status);
  }
  const teams = getTeamsWithBudgets();

  let currentPlayer: Player | null = null;
  if (event && event.current_player_id) {
    currentPlayer = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player | null;
  }

  let currentBidTeam: Team | null = null;
  if (event && event.current_bid_team_id) {
    currentBidTeam = teams.find((t) => t.id === event.current_bid_team_id) || null;
  }

  // Recent bids
  const recentBids = db.prepare(`
    SELECT b.*, t.name as team_name, t.primary_color as team_color, t.code as team_code
    FROM bids b
    JOIN teams t ON b.team_id = t.id
    WHERE b.auction_event_id = 'kpl-2026' AND b.player_id = ?
    ORDER BY b.timestamp DESC, b.amount DESC
    LIMIT 15
  `).all(event?.current_player_id || '') as any[];

  // Recent auction results
  const recentResults = db.prepare(`
    SELECT r.*, p.name as player_name, p.role as player_role, t.name as team_name, t.primary_color as team_color
    FROM auction_results r
    JOIN players p ON r.player_id = p.id
    LEFT JOIN teams t ON r.team_id = t.id
    WHERE r.auction_event_id = 'kpl-2026'
    ORDER BY r.created_at DESC
    LIMIT 10
  `).all() as any[];

  // Latest result for current stage
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

  // Counts
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

export function startRandomPlayerDraw(category: string, user: { id: string; name: string; role: string }) {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  // Authoritative State Check: Allow draw only from NOT_STARTED, RANDOM_DRAW, or RESULT_COMPLETED
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

  // Do not select unsold players automatically unless all available are exhausted
  const availableCheckQuery = query + ` AND status != 'unsold'`;
  let eligiblePlayers = db.prepare(availableCheckQuery).all(...params) as Player[];

  if (eligiblePlayers.length === 0) {
    // If no never-drawn players left, check if unsold players exist in this category
    eligiblePlayers = db.prepare(query).all(...params) as Player[];
  }

  if (eligiblePlayers.length === 0) {
    throw new Error(`No eligible players remaining for draw category: "${category}"!`);
  }

  // Secure random selection with equal probability
  const randomIndex = crypto.randomInt(0, eligiblePlayers.length);
  const selectedPlayer = eligiblePlayers[randomIndex];

  // Candidates for animation preview
  const sampleCandidates = [...eligiblePlayers]
    .sort(() => 0.5 - Math.random())
    .slice(0, 15)
    .map((p) => ({ id: p.id, name: p.name, photo_url: p.photo_url, role: p.role, base_price: p.base_price }));

  // Ensure selected player is at the end of the candidate stream
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

  // Atomically update draw & event: Status transitions to RANDOM_DRAW
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

export function confirmPlayerForAuction(user: { id: string; name: string; role: string }) {
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'PLAYER_READY');

  if (!event.current_player_id) {
    throw new Error('No player has been selected in the random draw yet!');
  }

  const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;

  const tx = db.transaction(() => {
    // 1. Mark random draw as confirmed
    db.prepare(`
      UPDATE random_draws
      SET confirmed = 1
      WHERE auction_event_id = 'kpl-2026' AND player_id = ?
    `).run(player.id);

    // 2. Mark player as in_auction
    db.prepare(`
      UPDATE players
      SET status = 'in_auction'
      WHERE id = ?
    `).run(player.id);

    // 3. Move auction status to PLAYER_READY (Step 2 - podium display, countdown NOT ticking yet)
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
  return getAuctionState();
}

export function startBidding(user: { id: string; name: string; role: string }) {
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
  return getAuctionState();
}

export function placeBid(teamId: string, amount: number, user: { id: string; name: string; role: string; team_id?: string | null }) {
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

    // Role-based validation
    if (user.role === 'captain' && user.team_id !== teamId) {
      throw new Error('Captains can only place bids on behalf of their assigned team!');
    }

    // Check team existence
    const team = db.prepare(`SELECT * FROM teams WHERE id = ?`).get(teamId) as Team;
    if (!team) {
      throw new Error('Team not found.');
    }

    // Prevent team from bidding against itself
    if (event.current_bid_team_id === teamId) {
      throw new Error(`${team.name} is already the highest bidder at ${event.current_bid} pts! Cannot bid against yourself.`);
    }

    // Calculate real-time budget
    const teams = getTeamsWithBudgets();
    const teamWithBudget = teams.find((t) => t.id === teamId);
    if (!teamWithBudget) {
      throw new Error('Unable to compute team budget.');
    }

    if (amount > teamWithBudget.remaining_budget) {
      throw new Error(
        `Insufficient points! Bid of ${amount} pts exceeds ${team.name}'s remaining budget of ${teamWithBudget.remaining_budget} pts.`
      );
    }

    // Bid amount validation
    if (!event.current_bid_team_id) {
      // First bid can match or exceed base price
      if (amount < event.current_bid) {
        throw new Error(`First bid must be at least the base price of ${event.current_bid} pts.`);
      }
    } else {
      // Subsequent bids must strictly exceed current bid
      if (amount <= event.current_bid) {
        throw new Error(`Bid amount (${amount} pts) must be strictly higher than current bid of ${event.current_bid} pts!`);
      }
    }

    const bidId = crypto.randomUUID();

    // Record the bid
    db.prepare(`
      INSERT INTO bids (id, auction_event_id, player_id, team_id, amount, bidder_user_id)
      VALUES (?, 'kpl-2026', ?, ?, ?, ?)
    `).run(bidId, event.current_player_id, teamId, amount, user.id);

    // Update auction state & reset timer
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
  return getAuctionState();
}

export function declareSold(user: { id: string; name: string; role: string }) {
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

    // 1. Mark player as sold
    db.prepare(`
      UPDATE players
      SET status = 'sold',
          sold_price = ?,
          sold_to_team_id = ?
      WHERE id = ?
    `).run(event.current_bid, team.id, player.id);

    // 2. Insert into auction_results
    db.prepare(`
      INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
      VALUES (?, 'kpl-2026', ?, ?, ?, 'sold', ?)
    `).run(resultId, player.id, team.id, event.current_bid, user.name);

    // 3. Move auction status to RESULT_COMPLETED (stays stable on podium)
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
  return getAuctionState();
}

export function declareUnsold(user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    validateAuctionTransition(currentStatus, 'RESULT_COMPLETED');

    if (!event.current_player_id) {
      throw new Error('No player currently in auction.');
    }

    const player = db.prepare(`SELECT * FROM players WHERE id = ?`).get(event.current_player_id) as Player;
    const resultId = crypto.randomUUID();

    // 1. Mark player as unsold
    db.prepare(`
      UPDATE players
      SET status = 'unsold',
          sold_price = NULL,
          sold_to_team_id = NULL
      WHERE id = ?
    `).run(player.id);

    // 2. Insert into auction_results
    db.prepare(`
      INSERT INTO auction_results (id, auction_event_id, player_id, team_id, final_price, status, confirmed_by)
      VALUES (?, 'kpl-2026', ?, NULL, 0, 'unsold', ?)
    `).run(resultId, player.id, user.name);

    // 3. Move auction status to RESULT_COMPLETED
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
  return getAuctionState();
}

export function nextRandomDraw(user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as AuctionEvent;
    const currentStatus = normalizeAuctionStatus(event?.status);

    validateAuctionTransition(currentStatus, 'RANDOM_DRAW');

    // Step 5: Organiser manually clears completed auction and moves to RANDOM_DRAW
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
  return getAuctionState();
}

export function reintroducePlayer(playerId: string, user: { id: string; name: string; role: string }) {
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
  return getAuctionState();
}

export function controlAuction(
  action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw',
  payload: any,
  user: { id: string; name: string; role: string }
) {
  if (action === 'start_bidding') {
    return startBidding(user);
  }
  if (action === 'next_random_draw') {
    return nextRandomDraw(user);
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
    }
  });

  tx();
  return getAuctionState();
}

// -------------------------------------------------------------
// RETENTION MANAGEMENT
// -------------------------------------------------------------
export function addRetention(teamId: string, playerId: string, points: number, user: { id: string; name: string; role: string }) {
  const tx = db.transaction(() => {
    const event = db.prepare(`SELECT status FROM auction_events WHERE id = 'kpl-2026'`).get() as { status: string };
    if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
      throw new Error('Retention is locked! Auction has already started or been initialized.');
    }

    // Check max 2 retentions per team
    const currentCount = db.prepare(`SELECT COUNT(*) as cnt FROM team_retentions WHERE team_id = ?`).get(teamId) as { cnt: number };
    if (currentCount.cnt >= 2) {
      throw new Error('A team can retain a maximum of 2 players only!');
    }

    // Check player not already retained
    const existingRet = db.prepare(`SELECT * FROM team_retentions WHERE player_id = ?`).get(playerId);
    if (existingRet) {
      throw new Error('This player is already retained by a team!');
    }

    // Check team budget capacity
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
    logAudit(
      user.id,
      user.name,
      user.role,
      'PLAYER_RETAINED',
      `${team.name} retained ${player.name} for ${points} pts.`
    );
  });

  tx();
  return getAuctionState();
}

export function removeRetention(retentionId: string, user: { id: string; name: string; role: string }) {
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

    logAudit(
      user.id,
      user.name,
      user.role,
      'RETENTION_REMOVED',
      `Removed retention of ${ret.player_name} from ${ret.team_name}.`
    );
  });

  tx();
  return getAuctionState();
}

// -------------------------------------------------------------
// DATA MANAGEMENT & RESET MODULE
// -------------------------------------------------------------

export function clearTransactionData(confirmationPhrase: string, user: { id: string; name: string; role: string }) {
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

    // 1. Delete all bids
    const bidsCount = db.prepare(`SELECT COUNT(*) as cnt FROM bids`).get() as { cnt: number };
    db.prepare(`DELETE FROM bids`).run();

    // 2. Delete all random draws
    const drawsCount = db.prepare(`SELECT COUNT(*) as cnt FROM random_draws`).get() as { cnt: number };
    db.prepare(`DELETE FROM random_draws`).run();

    // 3. Delete auction results
    const resultsCount = db.prepare(`SELECT COUNT(*) as cnt FROM auction_results`).get() as { cnt: number };
    db.prepare(`DELETE FROM auction_results`).run();

    // 4. Reset player statuses:
    // Retained players stay 'retained'
    // All other players reset to 'available'
    db.prepare(`
      UPDATE players
      SET status = 'available',
          sold_price = NULL,
          sold_to_team_id = NULL
      WHERE id NOT IN (SELECT player_id FROM team_retentions)
    `).run();

    // 5. Reset auction event
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

export function resetCompleteAuction(keepRetention: boolean, confirmationPhrase: string, user: { id: string; name: string; role: string }) {
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

export function clearMasterData(
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
    // Stop if auction in bidding
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
      // Safely unlink teams from captain users without deleting captain accounts
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

export function createDatabaseBackup(user: { id: string; name: string; role: string }) {
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
