import { adminDb } from './firebase-admin';
import { db } from './db';
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
import { AuctionStatePayload, normalizeAuctionStatus, validateAuctionTransition } from './auction-service';
import crypto from 'crypto';

/**
 * Log audit events into Firestore audit_logs collection
 */
export async function logFirestoreAudit(
  userId: string,
  userName: string,
  userRole: string,
  action: string,
  details: string
) {
  if (!adminDb) return;
  const id = crypto.randomUUID();
  try {
    await adminDb.collection('audit_logs').doc(id).set({
      id,
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('Firestore logAudit notice:', err.message);
  }
}

/**
 * Calculate team budgets and player counts from Firestore collections
 */
export async function getFirestoreTeamsWithBudgets(): Promise<Team[]> {
  if (!adminDb) return [];

  const [teamsSnap, retentionsSnap, resultsSnap] = await Promise.all([
    adminDb.collection('teams').get(),
    adminDb.collection('team_retentions').get(),
    adminDb.collection('auction_results').where('status', '==', 'sold').get(),
  ]);

  const teams: Team[] = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
  const retentions: TeamRetention[] = retentionsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TeamRetention));
  const soldResults: AuctionResult[] = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionResult));

  // Sort teams alphabetically by name
  teams.sort((a, b) => a.name.localeCompare(b.name));

  return teams.map((team) => {
    // Retention spent
    const teamRetentions = retentions.filter((r) => r.team_id === team.id);
    const retention_spent = teamRetentions.reduce((sum, r) => sum + (Number(r.points) || 0), 0);

    // Auction spent (only confirmed sold)
    const teamSold = soldResults.filter((r) => r.team_id === team.id);
    const auction_spent = teamSold.reduce((sum, r) => sum + (Number(r.final_price) || 0), 0);

    // Unique player counts (retained + sold)
    const uniquePlayers = new Set<string>();
    teamRetentions.forEach((r) => uniquePlayers.add(r.player_id));
    teamSold.forEach((r) => uniquePlayers.add(r.player_id));

    const initial_budget = Number(team.initial_budget) || 150.0;
    const remaining_budget = Math.max(0, initial_budget - retention_spent - auction_spent);

    return {
      ...team,
      initial_budget,
      retention_spent,
      auction_spent,
      remaining_budget,
      players_count: uniquePlayers.size,
    };
  });
}

/**
 * Get the full authoritative auction state from Cloud Firestore
 */
export async function getFirestoreAuctionState(): Promise<AuctionStatePayload | null> {
  if (!adminDb) return null;

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  if (!eventDoc.exists) {
    return null;
  }

  const rawEvent = eventDoc.data() as any;
  const event: AuctionEvent = {
    ...rawEvent,
    status: normalizeAuctionStatus(rawEvent.status),
    initial_budget: Number(rawEvent.initial_budget) || 150.0,
    current_bid: Number(rawEvent.current_bid) || 0.0,
    bid_timer: Number(rawEvent.bid_timer) || 20,
    timer_duration: Number(rawEvent.timer_duration) || 20,
    draw_category: rawEvent.draw_category || 'all',
  };

  const teams = await getFirestoreTeamsWithBudgets();

  let currentPlayer: Player | null = null;
  if (event.current_player_id) {
    const playerDoc = await adminDb.collection('players').doc(event.current_player_id).get();
    if (playerDoc.exists) {
      currentPlayer = { id: playerDoc.id, ...playerDoc.data() } as Player;
    }
  }

  let currentBidTeam: Team | null = null;
  if (event.current_bid_team_id) {
    currentBidTeam = teams.find((t) => t.id === event.current_bid_team_id) || null;
  }

  // Recent bids for current active player
  let recentBids: (Bid & { team_name: string; team_color: string; team_code: string })[] = [];
  if (event.current_player_id) {
    try {
      const bidsSnap = await adminDb
        .collection('bids')
        .where('auction_event_id', '==', 'kpl-2026')
        .where('player_id', '==', event.current_player_id)
        .get();

      const rawBids = bidsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Bid));
      rawBids.sort((a, b) => {
        const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        return timeDiff !== 0 ? timeDiff : b.amount - a.amount;
      });

      recentBids = rawBids.slice(0, 15).map((b) => {
        const team = teams.find((t) => t.id === b.team_id);
        return {
          ...b,
          team_name: team ? team.name : (b as any).team_name || 'Unknown Team',
          team_color: team ? team.primary_color : (b as any).team_color || '#3b82f6',
          team_code: team ? team.code : (b as any).team_code || 'TBD',
        };
      });
    } catch (err: any) {
      console.warn('Recent bids lookup notice:', err.message);
    }
  }

  // Recent auction results
  let recentResults: (AuctionResult & { player_name: string; player_role: string; team_name?: string; team_color?: string })[] = [];
  try {
    const resultsSnap = await adminDb
      .collection('auction_results')
      .where('auction_event_id', '==', 'kpl-2026')
      .get();

    const rawResults = resultsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionResult));
    rawResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const playersSnap = await adminDb.collection('players').get();
    const playersMap = new Map<string, Player>();
    playersSnap.docs.forEach((d) => playersMap.set(d.id, { id: d.id, ...d.data() } as Player));

    recentResults = rawResults.slice(0, 10).map((r) => {
      const p = playersMap.get(r.player_id);
      const t = r.team_id ? teams.find((tm) => tm.id === r.team_id) : null;
      return {
        ...r,
        player_name: p ? p.name : 'Unknown Player',
        player_role: p ? p.role : 'Cricketer',
        team_name: t ? t.name : undefined,
        team_color: t ? t.primary_color : undefined,
      };
    });
  } catch (err: any) {
    console.warn('Recent results lookup notice:', err.message);
  }

  // Latest result for current player
  let latestResult: any = null;
  if (event.current_player_id) {
    const matched = recentResults.find((r) => r.player_id === event.current_player_id);
    if (matched) {
      latestResult = matched;
    }
  }

  // Aggregate counts
  const allPlayersSnap = await adminDb.collection('players').get();
  const allPlayers = allPlayersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
  const activePlayers = allPlayers.filter((p) => Boolean((p as any).is_active));

  const resultsAllSnap = await adminDb.collection('auction_results').where('status', '==', 'sold').get();
  const soldPlayerIds = new Set(resultsAllSnap.docs.map((d) => d.data().player_id));

  const retentionsSnap = await adminDb.collection('team_retentions').get();
  const retainedCount = retentionsSnap.size;

  const totalPlayers = activePlayers.length;
  const soldCount = soldPlayerIds.size;
  const unsoldCount = activePlayers.filter((p) => p.status === 'unsold').length;
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

/**
 * Start Random Lottery Player Draw in Cloud Firestore
 */
export async function startFirestoreRandomPlayerDraw(
  category: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  // Authoritative State Check
  if (['PLAYER_READY', 'BIDDING', 'BIDDING_PAUSED'].includes(currentStatus)) {
    throw new Error(
      `Cannot start a new lottery draw while a player auction is active on the podium (Current Status: ${currentStatus}). Declare SOLD/UNSOLD and finish the round first.`
    );
  }

  // Fetch all players
  const playersSnap = await adminDb.collection('players').get();
  let eligible = playersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Player))
    .filter((p) => Boolean((p as any).is_active) && !['sold', 'retained', 'in_auction'].includes(p.status));

  if (category === 'male') {
    eligible = eligible.filter((p) => p.gender?.toLowerCase() === 'male');
  } else if (category === 'female') {
    eligible = eligible.filter((p) => p.gender?.toLowerCase() === 'female');
  }

  // Do not select unsold players automatically unless all available are exhausted
  const availableOnly = eligible.filter((p) => p.status !== 'unsold');
  if (availableOnly.length > 0) {
    eligible = availableOnly;
  }

  if (eligible.length === 0) {
    throw new Error(`No eligible players remaining for draw category: "${category}"!`);
  }

  // Cryptographically secure random selection with equal probability
  const randomIndex = crypto.randomInt(0, eligible.length);
  const selectedPlayer = eligible[randomIndex];

  // Candidates for animation preview
  const sampleCandidates = [...eligible]
    .sort(() => 0.5 - Math.random())
    .slice(0, 15)
    .map((p) => ({
      id: p.id,
      name: p.name,
      photo_url: p.photo_url,
      role: p.role,
      base_price: Number(p.base_price),
    }));

  if (!sampleCandidates.find((c) => c.id === selectedPlayer.id)) {
    sampleCandidates.push({
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      photo_url: selectedPlayer.photo_url,
      role: selectedPlayer.role,
      base_price: Number(selectedPlayer.base_price),
    });
  }

  const drawId = crypto.randomUUID();
  const batch = adminDb.batch();

  // 1. Record random draw
  batch.set(adminDb.collection('random_draws').doc(drawId), {
    id: drawId,
    auction_event_id: 'kpl-2026',
    player_id: selectedPlayer.id,
    draw_category: category,
    drawn_by_user_id: user.id,
    confirmed: 0,
    created_at: new Date().toISOString(),
  });

  // 2. Transition auction event to RANDOM_DRAW
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    status: 'RANDOM_DRAW',
    current_player_id: selectedPlayer.id,
    current_bid: Number(selectedPlayer.base_price),
    current_bid_team_id: null,
    bid_timer: Number(event?.timer_duration || 20),
    draw_category: category,
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'RANDOM_DRAW',
    `Randomly drew player #${selectedPlayer.player_number} - ${selectedPlayer.name} (${selectedPlayer.role}) for base price ${selectedPlayer.base_price} pts.`
  );

  return {
    drawId,
    selectedPlayer,
    candidates: sampleCandidates,
  };
}

/**
 * Confirm player from random draw to auction podium in Cloud Firestore
 */
export async function confirmFirestorePlayer(user: { id: string; name: string; role: string }) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'PLAYER_READY');

  if (!event.current_player_id) {
    throw new Error('No player has been selected in the random draw yet!');
  }

  const playerDoc = await adminDb.collection('players').doc(event.current_player_id).get();
  if (!playerDoc.exists) {
    throw new Error('Player not found');
  }
  const player = playerDoc.data() as Player;

  const batch = adminDb.batch();

  // 1. Mark player as in_auction
  batch.update(adminDb.collection('players').doc(player.id), {
    status: 'in_auction',
  });

  // 2. Move auction status to PLAYER_READY
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    status: 'PLAYER_READY',
    current_bid: Number(player.base_price),
    current_bid_team_id: null,
    bid_timer: Number(event.timer_duration || 20),
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'PLAYER_CONFIRMED',
    `Player #${player.player_number} ${player.name} confirmed for live auction podium. Status: PLAYER_READY.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Start live countdown & bidding in Cloud Firestore
 */
export async function startFirestoreBidding(user: { id: string; name: string; role: string }) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'BIDDING');

  if (!event.current_player_id) {
    throw new Error('No player has been confirmed on the auction podium!');
  }

  const playerDoc = await adminDb.collection('players').doc(event.current_player_id).get();
  const player = playerDoc.data() as Player;

  await adminDb.collection('auction_events').doc('kpl-2026').update({
    status: 'BIDDING',
    bid_timer: Number(event.timer_duration || 20),
    updated_at: new Date().toISOString(),
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'START_BIDDING',
    `Live bidding started for player ${player.name} with opening base price ${player.base_price} pts.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Atomic live bid placement with concurrency protection in Cloud Firestore
 */
export async function placeFirestoreBid(
  teamId: string,
  amount: number,
  user: { id: string; name: string; role: string; team_id?: string | null }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const bidId = crypto.randomUUID();

  await adminDb.runTransaction(async (transaction) => {
    const eventRef = adminDb!.collection('auction_events').doc('kpl-2026');
    const eventDoc = await transaction.get(eventRef);
    if (!eventDoc.exists) throw new Error('Auction event not found');

    const event = eventDoc.data() as AuctionEvent;
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
    const teamRef = adminDb!.collection('teams').doc(teamId);
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists) {
      throw new Error('Team not found.');
    }
    const team = teamDoc.data() as Team;

    // Prevent team from bidding against itself
    if (event.current_bid_team_id === teamId) {
      throw new Error(`${team.name} is already the highest bidder at ${event.current_bid} pts! Cannot bid against yourself.`);
    }

    // Validate bid amount
    if (!event.current_bid_team_id) {
      // First bid can match or exceed base price
      if (amount < Number(event.current_bid)) {
        throw new Error(`First bid must be at least the base price of ${event.current_bid} pts.`);
      }
    } else {
      // Subsequent bids must strictly exceed current bid
      if (amount <= Number(event.current_bid)) {
        throw new Error(`Bid amount (${amount} pts) must be strictly higher than current bid of ${event.current_bid} pts!`);
      }
    }

    // Calculate real-time team budget
    const retentionsSnap = await adminDb!.collection('team_retentions').where('team_id', '==', teamId).get();
    const retSpent = retentionsSnap.docs.reduce((sum, d) => sum + (Number(d.data().points) || 0), 0);

    const resultsSnap = await adminDb!.collection('auction_results').where('team_id', '==', teamId).where('status', '==', 'sold').get();
    const aucSpent = resultsSnap.docs.reduce((sum, d) => sum + (Number(d.data().final_price) || 0), 0);

    const initialBudget = Number(team.initial_budget) || 150.0;
    const remainingBudget = Math.max(0, initialBudget - retSpent - aucSpent);

    if (amount > remainingBudget) {
      throw new Error(
        `Insufficient points! Bid of ${amount} pts exceeds ${team.name}'s remaining budget of ${remainingBudget} pts.`
      );
    }

    // Record bid in bids collection
    const bidRef = adminDb!.collection('bids').doc(bidId);
    transaction.set(bidRef, {
      id: bidId,
      auction_event_id: 'kpl-2026',
      player_id: event.current_player_id,
      team_id: teamId,
      amount: Number(amount),
      bidder_user_id: user.id,
      timestamp: new Date().toISOString(),
      team_name: team.name,
      team_color: team.primary_color,
      team_code: team.code,
    });

    // Update auction state & reset timer
    transaction.update(eventRef, {
      current_bid: Number(amount),
      current_bid_team_id: teamId,
      bid_timer: Number(event.timer_duration || 20),
      updated_at: new Date().toISOString(),
    });
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'BID_PLACED',
    `Placed bid of ${amount} pts for player.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Declare Player SOLD in Cloud Firestore
 */
export async function declareFirestoreSold(user: { id: string; name: string; role: string }) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'RESULT_COMPLETED');

  if (!event.current_player_id) {
    throw new Error('No player currently in auction.');
  }

  if (!event.current_bid_team_id) {
    throw new Error('Cannot declare SOLD without any bids! Use DECLARE UNSOLD if no team placed a bid.');
  }

  const playerDoc = await adminDb.collection('players').doc(event.current_player_id).get();
  const player = playerDoc.data() as Player;

  const teamDoc = await adminDb.collection('teams').doc(event.current_bid_team_id).get();
  const team = teamDoc.data() as Team;

  const resultId = crypto.randomUUID();
  const batch = adminDb.batch();

  // 1. Mark player as sold
  batch.update(adminDb.collection('players').doc(player.id), {
    status: 'sold',
    sold_price: Number(event.current_bid),
    sold_to_team_id: team.id,
  });

  // 2. Insert into auction_results
  batch.set(adminDb.collection('auction_results').doc(resultId), {
    id: resultId,
    auction_event_id: 'kpl-2026',
    player_id: player.id,
    team_id: team.id,
    final_price: Number(event.current_bid),
    status: 'sold',
    confirmed_by: user.name,
    created_at: new Date().toISOString(),
  });

  // 3. Move auction status to RESULT_COMPLETED
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    status: 'RESULT_COMPLETED',
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'PLAYER_SOLD',
    `SOLD: Player ${player.name} sold to ${team.name} for ${event.current_bid} pts.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Declare Player UNSOLD in Cloud Firestore
 */
export async function declareFirestoreUnsold(user: { id: string; name: string; role: string }) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'RESULT_COMPLETED');

  if (!event.current_player_id) {
    throw new Error('No player currently in auction.');
  }

  const playerDoc = await adminDb.collection('players').doc(event.current_player_id).get();
  const player = playerDoc.data() as Player;

  const resultId = crypto.randomUUID();
  const batch = adminDb.batch();

  // 1. Mark player as unsold
  batch.update(adminDb.collection('players').doc(player.id), {
    status: 'unsold',
    sold_price: null,
    sold_to_team_id: null,
  });

  // 2. Insert into auction_results
  batch.set(adminDb.collection('auction_results').doc(resultId), {
    id: resultId,
    auction_event_id: 'kpl-2026',
    player_id: player.id,
    team_id: null,
    final_price: 0,
    status: 'unsold',
    confirmed_by: user.name,
    created_at: new Date().toISOString(),
  });

  // 3. Move auction status to RESULT_COMPLETED
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    status: 'RESULT_COMPLETED',
    current_bid_team_id: null,
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'PLAYER_UNSOLD',
    `UNSOLD: Player ${player.name} declared unsold at base price ${player.base_price} pts.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Advance to Next Random Draw in Cloud Firestore
 */
export async function nextFirestoreRandomDraw(user: { id: string; name: string; role: string }) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  validateAuctionTransition(currentStatus, 'RANDOM_DRAW');

  await adminDb.collection('auction_events').doc('kpl-2026').update({
    status: 'RANDOM_DRAW',
    current_player_id: null,
    current_bid: 0.0,
    current_bid_team_id: null,
    bid_timer: Number(event.timer_duration || 20),
    updated_at: new Date().toISOString(),
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'NEXT_RANDOM_DRAW',
    `Podium cleared. Transitioned auction to RANDOM_DRAW for next player draw.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Re-introduce Unsold Cricketer into Available Pool
 */
export async function reintroduceFirestorePlayer(
  playerId: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const playerDoc = await adminDb.collection('players').doc(playerId).get();
  if (!playerDoc.exists) throw new Error('Player not found.');
  const player = playerDoc.data() as Player;

  await adminDb.collection('players').doc(playerId).update({
    status: 'available',
    sold_price: null,
    sold_to_team_id: null,
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'PLAYER_REINTRODUCED',
    `Re-introduced unsold player ${player.name} back to available player pool.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Organiser Podium Controls in Cloud Firestore
 */
export async function controlFirestoreAuction(
  action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw' | 'unlock_retention',
  payload: any,
  user: { id: string; name: string; role: string }
) {
  if (action === 'start_bidding') {
    return await startFirestoreBidding(user);
  }
  if (action === 'next_random_draw') {
    return await nextFirestoreRandomDraw(user);
  }

  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  const currentStatus = normalizeAuctionStatus(event?.status);

  if (action === 'pause') {
    validateAuctionTransition(currentStatus, 'BIDDING_PAUSED');
    await adminDb.collection('auction_events').doc('kpl-2026').update({
      status: 'BIDDING_PAUSED',
      updated_at: new Date().toISOString(),
    });
    await logFirestoreAudit(user.id, user.name, user.role, 'AUCTION_PAUSED', 'Live bidding was paused by organiser.');
  } else if (action === 'resume') {
    validateAuctionTransition(currentStatus, 'BIDDING');
    await adminDb.collection('auction_events').doc('kpl-2026').update({
      status: 'BIDDING',
      updated_at: new Date().toISOString(),
    });
    await logFirestoreAudit(user.id, user.name, user.role, 'AUCTION_RESUMED', 'Live bidding resumed by organiser.');
  } else if (action === 'reset_timer') {
    await adminDb.collection('auction_events').doc('kpl-2026').update({
      bid_timer: Number(event.timer_duration || 20),
      updated_at: new Date().toISOString(),
    });
    await logFirestoreAudit(user.id, user.name, user.role, 'TIMER_RESET', `Timer reset to ${event.timer_duration}s.`);
  } else if (action === 'set_timer_duration') {
    const duration = Number(payload.duration) || 20;
    await adminDb.collection('auction_events').doc('kpl-2026').update({
      timer_duration: duration,
      bid_timer: duration,
      updated_at: new Date().toISOString(),
    });
    await logFirestoreAudit(user.id, user.name, user.role, 'TIMER_DURATION_UPDATED', `Default countdown timer set to ${duration}s.`);
  } else if (action === 'unlock_retention') {
    if (['BIDDING'].includes(currentStatus)) {
      throw new Error('Cannot unlock retention while live bidding is in progress. Pause or conclude the round first.');
    }
    await adminDb.collection('auction_events').doc('kpl-2026').update({
      status: 'NOT_STARTED',
      current_player_id: null,
      current_bid: 0,
      current_bid_team_id: null,
      updated_at: new Date().toISOString(),
    });

    // Reset in_auction players back to available
    const inAucSnap = await adminDb.collection('players').where('status', '==', 'in_auction').get();
    const b = adminDb.batch();
    inAucSnap.docs.forEach((d) => b.update(d.ref, { status: 'available' }));
    await b.commit();

    await logFirestoreAudit(user.id, user.name, user.role, 'RETENTION_UNLOCKED', 'Auction returned to NOT_STARTED to allow retention changes.');
  }

  return await getFirestoreAuctionState();
}

/**
 * Player Retention Operations in Cloud Firestore
 */
export async function addFirestoreRetention(
  teamId: string,
  playerId: string,
  points: number,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
    throw new Error('Retention is locked! Auction has already started or been initialized.');
  }

  // Check max 2 retentions per team
  const existingTeamRetSnap = await adminDb.collection('team_retentions').where('team_id', '==', teamId).get();
  if (existingTeamRetSnap.size >= 2) {
    throw new Error('A team can retain a maximum of 2 players only!');
  }

  // Check player not already retained
  const playerRetSnap = await adminDb.collection('team_retentions').where('player_id', '==', playerId).get();
  if (!playerRetSnap.empty) {
    throw new Error('This player is already retained by a team!');
  }

  // Check team budget capacity
  const teamDoc = await adminDb.collection('teams').doc(teamId).get();
  const team = teamDoc.data() as Team;
  const currentRetSpent = existingTeamRetSnap.docs.reduce((sum, d) => sum + (Number(d.data().points) || 0), 0);

  if (currentRetSpent + points > Number(team.initial_budget || 150)) {
    throw new Error(`Retention points (${points} pts) exceed remaining budget (${team.initial_budget - currentRetSpent} pts)!`);
  }

  const retId = crypto.randomUUID();
  const batch = adminDb.batch();

  batch.set(adminDb.collection('team_retentions').doc(retId), {
    id: retId,
    team_id: teamId,
    player_id: playerId,
    points: Number(points),
    created_at: new Date().toISOString(),
  });

  batch.update(adminDb.collection('players').doc(playerId), {
    status: 'retained',
    sold_price: Number(points),
    sold_to_team_id: teamId,
  });

  // Touch auction_events updated_at to immediately trigger real-time onSnapshot on all client dashboards
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  const playerDoc = await adminDb.collection('players').doc(playerId).get();
  const player = playerDoc.data() as Player;

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'PLAYER_RETAINED',
    `${team.name} retained ${player.name} for ${points} pts.`
  );

  return await getFirestoreAuctionState();
}

export async function removeFirestoreRetention(
  retentionId: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
    throw new Error('Retention is locked while auction is active.');
  }

  const retDoc = await adminDb.collection('team_retentions').doc(retentionId).get();
  if (!retDoc.exists) throw new Error('Retention record not found.');
  const ret = retDoc.data() as TeamRetention;

  const batch = adminDb.batch();
  batch.delete(adminDb.collection('team_retentions').doc(retentionId));
  batch.update(adminDb.collection('players').doc(ret.player_id), {
    status: 'available',
    sold_price: null,
    sold_to_team_id: null,
  });
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'RETENTION_REMOVED',
    `Removed retention record ${retentionId}.`
  );

  return await getFirestoreAuctionState();
}

export async function updateFirestoreRetention(
  retentionId: string,
  newPoints: number,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  const eventDoc = await adminDb.collection('auction_events').doc('kpl-2026').get();
  const event = eventDoc.data() as AuctionEvent;
  if (normalizeAuctionStatus(event?.status) !== 'NOT_STARTED') {
    throw new Error('Retention is locked while auction is active.');
  }

  if (typeof newPoints !== 'number' || newPoints <= 0) {
    throw new Error('Points must be a positive number.');
  }

  const retDoc = await adminDb.collection('team_retentions').doc(retentionId).get();
  if (!retDoc.exists) throw new Error('Retention record not found.');
  const ret = retDoc.data() as TeamRetention;

  const teamDoc = await adminDb.collection('teams').doc(ret.team_id).get();
  const team = teamDoc.data() as Team;

  const otherRetSnap = await adminDb.collection('team_retentions').where('team_id', '==', ret.team_id).get();
  const otherSpent = otherRetSnap.docs
    .filter((d) => d.id !== retentionId)
    .reduce((sum, d) => sum + (Number(d.data().points) || 0), 0);

  if (otherSpent + newPoints > Number(team.initial_budget || 150)) {
    throw new Error(`Updated points (${newPoints} pts) exceed remaining budget (${team.initial_budget - otherSpent} pts)!`);
  }

  const batch = adminDb.batch();
  batch.update(adminDb.collection('team_retentions').doc(retentionId), {
    points: Number(newPoints),
  });
  batch.update(adminDb.collection('players').doc(ret.player_id), {
    sold_price: Number(newPoints),
  });
  batch.update(adminDb.collection('auction_events').doc('kpl-2026'), {
    updated_at: new Date().toISOString(),
  });

  await batch.commit();

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'RETENTION_UPDATED',
    `Updated retention points for player ${ret.player_id} (${team.name}) to ${newPoints} pts.`
  );

  return await getFirestoreAuctionState();
}

/**
 * Data Reset & Admin Clearing Operations in Cloud Firestore
 */
export async function clearFirestoreTransactions(
  confirmationPhrase: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can clear transaction data!');
  }

  if (confirmationPhrase !== 'CLEAR TRANSACTIONS') {
    throw new Error('Invalid confirmation phrase. You must type CLEAR TRANSACTIONS exactly.');
  }

  // 1. Delete all bids
  const bidsSnap = await adminDb.collection('bids').get();
  const b1 = adminDb.batch();
  bidsSnap.docs.forEach((d) => b1.delete(d.ref));
  await b1.commit();

  // 2. Delete all random draws
  const drawsSnap = await adminDb.collection('random_draws').get();
  const b2 = adminDb.batch();
  drawsSnap.docs.forEach((d) => b2.delete(d.ref));
  await b2.commit();

  // 3. Delete all auction results
  const resultsSnap = await adminDb.collection('auction_results').get();
  const b3 = adminDb.batch();
  resultsSnap.docs.forEach((d) => b3.delete(d.ref));
  await b3.commit();

  // 4. Reset player statuses: retained stay retained, others reset to available
  const retentionsSnap = await adminDb.collection('team_retentions').get();
  const retainedPlayerIds = new Set(retentionsSnap.docs.map((d) => d.data().player_id));

  const playersSnap = await adminDb.collection('players').get();
  const b4 = adminDb.batch();
  playersSnap.docs.forEach((d) => {
    if (!retainedPlayerIds.has(d.id)) {
      b4.update(d.ref, {
        status: 'available',
        sold_price: null,
        sold_to_team_id: null,
      });
    }
  });
  await b4.commit();

  // 5. Reset auction event
  await adminDb.collection('auction_events').doc('kpl-2026').update({
    status: 'NOT_STARTED',
    current_player_id: null,
    current_bid: 0.0,
    current_bid_team_id: null,
    updated_at: new Date().toISOString(),
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'CLEAR_TRANSACTIONS',
    `Cleared all auction transactions: ${bidsSnap.size} bids, ${drawsSnap.size} draws, ${resultsSnap.size} results deleted.`
  );

  return { success: true, message: 'All auction transactions cleared successfully. Team balances recalculated.' };
}

export async function resetFirestoreAuction(
  keepRetention: boolean,
  confirmationPhrase: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can perform a complete auction reset!');
  }

  if (confirmationPhrase !== 'RESET AUCTION') {
    throw new Error('Invalid confirmation phrase. You must type RESET AUCTION exactly.');
  }

  // Delete transactions
  const [bidsSnap, drawsSnap, resultsSnap] = await Promise.all([
    adminDb.collection('bids').get(),
    adminDb.collection('random_draws').get(),
    adminDb.collection('auction_results').get(),
  ]);

  const b1 = adminDb.batch();
  bidsSnap.docs.forEach((d) => b1.delete(d.ref));
  drawsSnap.docs.forEach((d) => b1.delete(d.ref));
  resultsSnap.docs.forEach((d) => b1.delete(d.ref));
  await b1.commit();

  if (!keepRetention) {
    const retSnap = await adminDb.collection('team_retentions').get();
    const b2 = adminDb.batch();
    retSnap.docs.forEach((d) => b2.delete(d.ref));
    await b2.commit();

    const playersSnap = await adminDb.collection('players').get();
    const b3 = adminDb.batch();
    playersSnap.docs.forEach((d) => {
      b3.update(d.ref, {
        status: 'available',
        sold_price: null,
        sold_to_team_id: null,
      });
    });
    await b3.commit();
  } else {
    const retSnap = await adminDb.collection('team_retentions').get();
    const retainedIds = new Set(retSnap.docs.map((d) => d.data().player_id));

    const playersSnap = await adminDb.collection('players').get();
    const b3 = adminDb.batch();
    playersSnap.docs.forEach((d) => {
      if (!retainedIds.has(d.id)) {
        b3.update(d.ref, {
          status: 'available',
          sold_price: null,
          sold_to_team_id: null,
        });
      }
    });
    await b3.commit();
  }

  await adminDb.collection('auction_events').doc('kpl-2026').update({
    status: 'NOT_STARTED',
    current_player_id: null,
    current_bid: 0.0,
    current_bid_team_id: null,
    updated_at: new Date().toISOString(),
  });

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'RESET_COMPLETE_AUCTION',
    `Complete auction reset executed. Keep retention: ${keepRetention}. Status reset to NOT STARTED.`
  );

  return { success: true, message: 'Complete auction reset completed successfully.' };
}

export async function clearFirestoreMasters(
  options: { players?: boolean; teams?: boolean },
  confirmationPhrase: string,
  user: { id: string; name: string; role: string }
) {
  if (!adminDb) throw new Error('Firestore database is not initialized');

  if (user.role !== 'super_admin') {
    throw new Error('Unauthorized: Only Super Admin can clear master data!');
  }

  if (confirmationPhrase !== 'CLEAR MASTERS') {
    throw new Error('Invalid confirmation phrase. You must type CLEAR MASTERS exactly.');
  }

  const reports: string[] = [];

  if (options.players) {
    const [retSnap, bidsSnap, resultsSnap, drawsSnap, playersSnap] = await Promise.all([
      adminDb.collection('team_retentions').get(),
      adminDb.collection('bids').get(),
      adminDb.collection('auction_results').get(),
      adminDb.collection('random_draws').get(),
      adminDb.collection('players').get(),
    ]);

    const b = adminDb.batch();
    retSnap.docs.forEach((d) => b.delete(d.ref));
    bidsSnap.docs.forEach((d) => b.delete(d.ref));
    resultsSnap.docs.forEach((d) => b.delete(d.ref));
    drawsSnap.docs.forEach((d) => b.delete(d.ref));
    playersSnap.docs.forEach((d) => b.delete(d.ref));
    b.update(adminDb.collection('auction_events').doc('kpl-2026'), {
      current_player_id: null,
      current_bid: 0,
      current_bid_team_id: null,
    });
    await b.commit();
    reports.push(`Cleared ${playersSnap.size} player records`);
  }

  if (options.teams) {
    const [retSnap, bidsSnap, resultsSnap, teamsSnap] = await Promise.all([
      adminDb.collection('team_retentions').get(),
      adminDb.collection('bids').get(),
      adminDb.collection('auction_results').get(),
      adminDb.collection('teams').get(),
    ]);

    const b = adminDb.batch();
    retSnap.docs.forEach((d) => b.delete(d.ref));
    bidsSnap.docs.forEach((d) => b.delete(d.ref));
    resultsSnap.docs.forEach((d) => b.delete(d.ref));
    teamsSnap.docs.forEach((d) => b.delete(d.ref));
    await b.commit();
    reports.push(`Cleared ${teamsSnap.size} team records (preserved user accounts)`);
  }

  await logFirestoreAudit(
    user.id,
    user.name,
    user.role,
    'CLEAR_MASTER_DATA',
    `Clear Master Data executed: ${reports.join(', ')}.`
  );

  return { success: true, message: 'Selected master data cleared safely.' };
}

/**
 * Image storage & retrieval in Cloud Firestore uploaded_media collection
 */
export async function saveUploadedMedia(filename: string, mimeType: string, buffer: Buffer) {
  if (!adminDb) return false;

  const mediaId = `media_${crypto.randomUUID().slice(0, 12)}`;
  await adminDb.collection('uploaded_media').doc(filename).set({
    id: mediaId,
    filename,
    mime_type: mimeType,
    data_base64: buffer.toString('base64'),
    size: buffer.length,
    created_at: new Date().toISOString(),
  });
  return true;
}

export async function getUploadedMedia(filename: string): Promise<{ mime_type: string; buffer: Buffer } | null> {
  if (!adminDb) return null;

  const doc = await adminDb.collection('uploaded_media').doc(filename).get();
  if (!doc.exists) return null;

  const data = doc.data();
  if (!data?.data_base64) return null;

  return {
    mime_type: data.mime_type || 'image/webp',
    buffer: Buffer.from(data.data_base64, 'base64'),
  };
}

/**
 * Complete Full-Database Sync from SQLite to Firestore
 */
export async function seedFirestore() {
  if (!adminDb) {
    throw new Error('Firebase Admin DB is not initialized. Please configure FIREBASE_SERVICE_ACCOUNT_KEY or serviceAccountKey.json.');
  }

  const users = db.prepare(`SELECT id, username, password, name, role, team_id, created_at FROM users`).all() as any[];
  const teams = db.prepare(`SELECT * FROM teams`).all() as any[];
  const players = db.prepare(`SELECT * FROM players`).all() as any[];
  const retentions = db.prepare(`SELECT * FROM team_retentions`).all() as any[];
  const event = db.prepare(`SELECT * FROM auction_events WHERE id = 'kpl-2026'`).get() as any;

  const batch = adminDb.batch();

  // Users (including passwords for auth)
  for (const u of users) {
    const ref = adminDb.collection('users').doc(u.id);
    batch.set(
      ref,
      {
        ...u,
        created_at: u.created_at || new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // Teams
  for (const t of teams) {
    const ref = adminDb.collection('teams').doc(t.id);
    batch.set(
      ref,
      {
        ...t,
        initial_budget: Number(t.initial_budget),
        created_at: t.created_at || new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // Players
  for (const p of players) {
    const ref = adminDb.collection('players').doc(p.id);
    batch.set(
      ref,
      {
        ...p,
        base_price: Number(p.base_price),
        age: p.age ? Number(p.age) : null,
        is_active: Boolean(p.is_active),
        created_at: p.created_at || new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // Team Retentions
  for (const r of retentions) {
    const ref = adminDb.collection('team_retentions').doc(r.id);
    batch.set(
      ref,
      {
        ...r,
        points: Number(r.points),
        created_at: r.created_at || new Date().toISOString(),
      },
      { merge: true }
    );
  }

  // Auction Event
  if (event) {
    const ref = adminDb.collection('auction_events').doc('kpl-2026');
    batch.set(
      ref,
      {
        ...event,
        status: normalizeAuctionStatus(event.status),
        initial_budget: Number(event.initial_budget),
        current_bid: Number(event.current_bid),
        bid_timer: Number(event.bid_timer),
        timer_duration: Number(event.timer_duration),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  await batch.commit();

  return {
    mode: 'admin',
    success: true,
    usersCount: users.length,
    teamsCount: teams.length,
    playersCount: players.length,
    retentionsCount: retentions.length,
  };
}

/**
 * Fetch players from Firestore with optional filters
 */
export async function getFirestorePlayers(filters: {
  search?: string;
  gender?: string;
  role?: string;
  status?: string;
  category?: string;
} = {}): Promise<any[]> {
  if (!adminDb) return [];

  const [playersSnap, teamsSnap] = await Promise.all([
    adminDb.collection('players').get(),
    adminDb.collection('teams').get(),
  ]);

  const teamsMap = new Map<string, Team>();
  teamsSnap.docs.forEach((d) => teamsMap.set(d.id, { id: d.id, ...d.data() } as Team));

  let players = playersSnap.docs.map((d) => {
    const data = d.data();
    const soldTeam = data.sold_to_team_id ? teamsMap.get(data.sold_to_team_id) : null;
    return {
      id: d.id,
      ...data,
      sold_team_name: soldTeam ? soldTeam.name : null,
      sold_team_color: soldTeam ? soldTeam.primary_color : null,
    };
  });

  // Apply filters in memory
  if (filters.search) {
    const s = filters.search.toLowerCase();
    players = players.filter((p: any) =>
      (p.name && p.name.toLowerCase().includes(s)) ||
      (p.player_number && p.player_number.toLowerCase().includes(s))
    );
  }

  if (filters.gender) {
    players = players.filter((p: any) => p.gender === filters.gender);
  }

  if (filters.role) {
    players = players.filter((p: any) => p.role === filters.role);
  }

  if (filters.status) {
    players = players.filter((p: any) => p.status === filters.status);
  }

  if (filters.category) {
    players = players.filter((p: any) => p.category === filters.category);
  }

  // Sort by player_number ASC
  players.sort((a: any, b: any) => {
    const numA = (a.player_number || '').localeCompare(b.player_number || '', undefined, { numeric: true });
    return numA !== 0 ? numA : (a.name || '').localeCompare(b.name || '');
  });

  return players;
}

/**
 * Fetch a single player by ID from Firestore with recent bids
 */
export async function getFirestorePlayerById(id: string): Promise<{ player: any; bids: any[] } | null> {
  if (!adminDb) return null;

  const playerDoc = await adminDb.collection('players').doc(id).get();
  if (!playerDoc.exists) return null;

  const player = { id: playerDoc.id, ...playerDoc.data() };

  const [bidsSnap, teamsSnap] = await Promise.all([
    adminDb.collection('bids').where('player_id', '==', id).get(),
    adminDb.collection('teams').get(),
  ]);

  const teamsMap = new Map<string, Team>();
  teamsSnap.docs.forEach((d) => teamsMap.set(d.id, { id: d.id, ...d.data() } as Team));

  const bids = bidsSnap.docs.map((d) => {
    const data = d.data();
    const team = data.team_id ? teamsMap.get(data.team_id) : null;
    return {
      id: d.id,
      ...data,
      team_name: team ? team.name : 'Unknown Team',
      team_code: team ? team.code : 'TBD',
    };
  });

  bids.sort((a: any, b: any) => (Number(b.amount) || 0) - (Number(a.amount) || 0));

  return { player, bids };
}

/**
 * Create a single player in Firestore
 */
export async function createFirestorePlayer(playerData: any): Promise<any> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const id = playerData.id || `ply-${crypto.randomUUID().slice(0, 8)}`;
  const finalNumber = playerData.player_number || `PLY-${String(Date.now()).slice(-4)}`;

  const playerRecord = {
    id,
    player_number: finalNumber,
    name: playerData.name,
    photo_url: playerData.photo_url || '/images/default-avatar.png',
    gender: playerData.gender || 'Male',
    age: playerData.age ? Number(playerData.age) : null,
    role: playerData.role || 'All-rounder',
    category: playerData.category || 'Category A',
    base_price: Number(playerData.base_price) || 10,
    contact: playerData.contact || null,
    is_active: playerData.is_active !== undefined ? Boolean(playerData.is_active) : true,
    status: playerData.status || 'available',
    sold_price: playerData.sold_price !== undefined ? Number(playerData.sold_price) : null,
    sold_to_team_id: playerData.sold_to_team_id || null,
    created_at: new Date().toISOString(),
  };

  await adminDb.collection('players').doc(id).set(playerRecord, { merge: true });
  return playerRecord;
}

/**
 * Bulk create players in Firestore
 */
export async function bulkCreateFirestorePlayers(playerList: any[]): Promise<number> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const batch = adminDb.batch();
  let count = 0;

  for (const item of playerList) {
    const name = item.name || item['Full Name'] || item['Player Name'] || item['Name'];
    if (!name) continue;

    const id = item.id || `ply-${crypto.randomUUID().slice(0, 8)}`;
    const number = item.player_number || item['Player ID'] || item['Player Number'] || item['Number'] || `PLY-${String(Date.now()).slice(-4)}-${Math.floor(Math.random() * 100)}`;
    const photo_url = item.photo_url || item['Photo URL'] || item['Photo'] || '/images/default-avatar.png';
    const gender = item.gender || item['Gender'] || 'Male';
    const age = item.age || item['Age'] ? Number(item.age || item['Age']) : null;
    const role = item.role || item['Playing Role'] || item['Role'] || 'All-rounder';
    const category = item.category || item['Category'] || 'Category A';
    const base_price = Number(item.base_price || item['Base Price (Pts)'] || item['Base Price']) || 10;
    const contact = item.contact || item['Contact'] || item['Contact / Notes'] || null;

    const playerRecord = {
      id,
      player_number: number,
      name,
      photo_url,
      gender,
      age,
      role,
      category,
      base_price,
      contact,
      is_active: true,
      status: 'available',
      sold_price: null,
      sold_to_team_id: null,
      created_at: new Date().toISOString(),
    };

    batch.set(adminDb.collection('players').doc(id), playerRecord, { merge: true });
    count++;
  }

  if (count > 0) {
    await batch.commit();
  }
  return count;
}

/**
 * Update player record in Firestore
 */
export async function updateFirestorePlayer(id: string, updates: any): Promise<any> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const cleanedUpdates: any = { ...updates };
  if (cleanedUpdates.age !== undefined) cleanedUpdates.age = cleanedUpdates.age ? Number(cleanedUpdates.age) : null;
  if (cleanedUpdates.base_price !== undefined) cleanedUpdates.base_price = cleanedUpdates.base_price ? Number(cleanedUpdates.base_price) : null;
  if (cleanedUpdates.is_active !== undefined) cleanedUpdates.is_active = Boolean(cleanedUpdates.is_active);

  // Remove undefined fields
  Object.keys(cleanedUpdates).forEach((key) => {
    if (cleanedUpdates[key] === undefined) delete cleanedUpdates[key];
  });

  await adminDb.collection('players').doc(id).set(cleanedUpdates, { merge: true });
  const updatedDoc = await adminDb.collection('players').doc(id).get();
  return { id: updatedDoc.id, ...updatedDoc.data() };
}

/**
 * Delete player from Firestore with cascade deletion
 */
export async function deleteFirestorePlayer(id: string): Promise<void> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const batch = adminDb.batch();

  // Delete player doc
  batch.delete(adminDb.collection('players').doc(id));

  // Cascading deletes in team_retentions, bids, random_draws, auction_results
  const [retSnap, bidsSnap, drawsSnap, resSnap] = await Promise.all([
    adminDb.collection('team_retentions').where('player_id', '==', id).get(),
    adminDb.collection('bids').where('player_id', '==', id).get(),
    adminDb.collection('random_draws').where('player_id', '==', id).get(),
    adminDb.collection('auction_results').where('player_id', '==', id).get(),
  ]);

  retSnap.docs.forEach((d) => batch.delete(d.ref));
  bidsSnap.docs.forEach((d) => batch.delete(d.ref));
  drawsSnap.docs.forEach((d) => batch.delete(d.ref));
  resSnap.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}

/**
 * Fetch all users from Firestore (excluding password)
 */
export async function getFirestoreUsers(): Promise<any[]> {
  if (!adminDb) return [];

  const [usersSnap, teamsSnap] = await Promise.all([
    adminDb.collection('users').get(),
    adminDb.collection('teams').get(),
  ]);

  const teamsMap = new Map<string, Team>();
  teamsSnap.docs.forEach((d) => teamsMap.set(d.id, { id: d.id, ...d.data() } as Team));

  const users = usersSnap.docs.map((d) => {
    const data = d.data();
    const team = data.team_id ? teamsMap.get(data.team_id) : null;
    return {
      id: d.id,
      username: data.username,
      name: data.name,
      role: data.role,
      team_id: data.team_id || null,
      created_at: data.created_at || new Date().toISOString(),
      team_name: team ? team.name : null,
      team_code: team ? team.code : null,
    };
  });

  users.sort((a, b) => {
    const roleComp = (a.role || '').localeCompare(b.role || '');
    return roleComp !== 0 ? roleComp : (a.name || '').localeCompare(b.name || '');
  });

  return users;
}

/**
 * Create a new user in Firestore
 */
export async function createFirestoreUser(userData: any): Promise<string> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const id = userData.id || `usr-${crypto.randomUUID().slice(0, 8)}`;
  const userRecord = {
    id,
    username: userData.username,
    password: userData.password,
    name: userData.name,
    role: userData.role,
    team_id: userData.team_id || null,
    created_at: new Date().toISOString(),
  };

  await adminDb.collection('users').doc(id).set(userRecord, { merge: true });

  if (userData.role === 'captain' && userData.team_id) {
    await adminDb.collection('teams').doc(userData.team_id).set(
      {
        captain_id: id,
        captain_name: userData.name,
      },
      { merge: true }
    );
  }

  return id;
}

/**
 * Delete a user from Firestore
 */
export async function deleteFirestoreUser(id: string): Promise<void> {
  if (!adminDb) throw new Error('Firestore not initialized');

  // Check teams where captain_id == id
  const teamsSnap = await adminDb.collection('teams').where('captain_id', '==', id).get();
  const batch = adminDb.batch();

  teamsSnap.docs.forEach((d) => {
    batch.update(d.ref, { captain_id: null });
  });

  batch.delete(adminDb.collection('users').doc(id));
  await batch.commit();
}

/**
 * Aggregate complete reports data from Firestore collections
 */
export async function getFirestoreReportsData(): Promise<any> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const teams = await getFirestoreTeamsWithBudgets();

  const [playersSnap, resultsSnap, retSnap, bidsSnap, drawsSnap, usersSnap] = await Promise.all([
    adminDb.collection('players').get(),
    adminDb.collection('auction_results').get(),
    adminDb.collection('team_retentions').get(),
    adminDb.collection('bids').get(),
    adminDb.collection('random_draws').get(),
    adminDb.collection('users').get(),
  ]);

  const teamsMap = new Map<string, Team>();
  teams.forEach((t) => teamsMap.set(t.id, t));

  const playersMap = new Map<string, Player>();
  playersSnap.docs.forEach((d) => playersMap.set(d.id, { id: d.id, ...d.data() } as Player));

  const usersMap = new Map<string, any>();
  usersSnap.docs.forEach((d) => usersMap.set(d.id, { id: d.id, ...d.data() }));

  // Sold players
  const soldResults = resultsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as AuctionResult))
    .filter((r) => r.status === 'sold')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const soldPlayers = soldResults.map((r) => {
    const p = playersMap.get(r.player_id) || ({} as any);
    const t = r.team_id ? teamsMap.get(r.team_id) : null;
    return {
      ...p,
      final_price: r.final_price,
      result_status: r.status,
      confirmed_by: r.confirmed_by,
      team_name: t ? t.name : null,
      team_code: t ? t.code : null,
      team_color: t ? t.primary_color : null,
    };
  });

  // Retained players
  const retentions = retSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as TeamRetention))
    .sort((a, b) => {
      const tA = a.team_id ? teamsMap.get(a.team_id)?.name || '' : '';
      const tB = b.team_id ? teamsMap.get(b.team_id)?.name || '' : '';
      return tA.localeCompare(tB);
    });

  const retainedPlayers = retentions.map((ret) => {
    const p = playersMap.get(ret.player_id) || ({} as any);
    const t = ret.team_id ? teamsMap.get(ret.team_id) : null;
    return {
      ...p,
      retention_points: ret.points,
      team_name: t ? t.name : null,
      team_code: t ? t.code : null,
      team_color: t ? t.primary_color : null,
    };
  });

  const allPlayers = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));

  // Unsold players
  const unsoldPlayers = allPlayers
    .filter((p) => p.status === 'unsold')
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Available players
  const availablePlayers = allPlayers
    .filter((p) => p.status === 'available' && Boolean((p as any).is_active))
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  // Bids history
  const bids = bidsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as Bid))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const bidsHistory = bids.map((b) => {
    const p = playersMap.get(b.player_id);
    const t = b.team_id ? teamsMap.get(b.team_id) : null;
    const u = b.bidder_user_id ? usersMap.get(b.bidder_user_id) : null;
    return {
      ...b,
      player_name: p ? p.name : 'Unknown Player',
      player_role: p ? p.role : 'Cricketer',
      player_number: p ? p.player_number : '',
      team_name: t ? t.name : 'Unknown Team',
      team_code: t ? t.code : 'TBD',
      team_color: t ? t.primary_color : '#3b82f6',
      bidder_name: u ? u.name : 'Bidder',
    };
  });

  // Random draws history
  const draws = drawsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() } as any))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const drawHistory = draws.map((d) => {
    const p = playersMap.get(d.player_id);
    const u = d.drawn_by_user_id ? usersMap.get(d.drawn_by_user_id) : null;
    return {
      ...d,
      player_name: p ? p.name : 'Unknown Player',
      player_number: p ? p.player_number : '',
      player_role: p ? p.role : 'Cricketer',
      base_price: p ? p.base_price : 10,
      drawn_by_name: u ? u.name : 'Organiser',
    };
  });

  // Analytics: Gender stats
  const activePlayers = allPlayers.filter((p) => Boolean((p as any).is_active));
  const genderMap = new Map<string, { gender: string; count: number; sold_count: number; retained_count: number }>();
  activePlayers.forEach((p) => {
    const g = p.gender || 'Other';
    if (!genderMap.has(g)) {
      genderMap.set(g, { gender: g, count: 0, sold_count: 0, retained_count: 0 });
    }
    const item = genderMap.get(g)!;
    item.count++;
    if (p.status === 'sold') item.sold_count++;
    if (p.status === 'retained') item.retained_count++;
  });
  const genderStats = Array.from(genderMap.values());

  // Analytics: Role stats
  const roleMap = new Map<string, { role: string; count: number; sold_count: number; retained_count: number }>();
  activePlayers.forEach((p) => {
    const r = p.role || 'Other';
    if (!roleMap.has(r)) {
      roleMap.set(r, { role: r, count: 0, sold_count: 0, retained_count: 0 });
    }
    const item = roleMap.get(r)!;
    item.count++;
    if (p.status === 'sold') item.sold_count++;
    if (p.status === 'retained') item.retained_count++;
  });
  const roleStats = Array.from(roleMap.values());

  return {
    teams,
    soldPlayers,
    retainedPlayers,
    unsoldPlayers,
    availablePlayers,
    bidsHistory,
    drawHistory,
    genderStats,
    roleStats,
  };
}

/**
 * Fetch audit logs from Firestore
 */
export async function getFirestoreAuditLogs(limitCount: number = 100): Promise<any[]> {
  if (!adminDb) return [];

  const logsSnap = await adminDb
    .collection('audit_logs')
    .orderBy('created_at', 'desc')
    .limit(limitCount)
    .get();

  return logsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Restore Firestore collections from JSON backup
 */
export async function restoreFirestoreBackup(backupData: any, user: { id: string; name: string; role: string }): Promise<void> {
  if (!adminDb) throw new Error('Firestore not initialized');

  const { teams, players, retentions, results } = backupData.data || {};

  // Delete existing records in transactions collections
  const [bidsSnap, drawsSnap, resSnap, retSnap] = await Promise.all([
    adminDb.collection('bids').get(),
    adminDb.collection('random_draws').get(),
    adminDb.collection('auction_results').get(),
    adminDb.collection('team_retentions').get(),
  ]);

  const deleteBatch = adminDb.batch();
  bidsSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
  drawsSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
  resSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
  retSnap.docs.forEach((d) => deleteBatch.delete(d.ref));
  await deleteBatch.commit();

  // Restore players
  if (Array.isArray(players) && players.length > 0) {
    const pBatch = adminDb.batch();
    for (const p of players) {
      pBatch.set(adminDb.collection('players').doc(p.id), {
        id: p.id,
        player_number: p.player_number,
        name: p.name,
        photo_url: p.photo_url || '/images/default-avatar.png',
        gender: p.gender || 'Male',
        age: p.age ? Number(p.age) : null,
        role: p.role,
        category: p.category,
        base_price: Number(p.base_price) || 10,
        contact: p.contact || null,
        is_active: Boolean(p.is_active),
        status: p.status || 'available',
        sold_price: p.sold_price ? Number(p.sold_price) : null,
        sold_to_team_id: p.sold_to_team_id || null,
      }, { merge: true });
    }
    await pBatch.commit();
  }

  // Restore teams
  if (Array.isArray(teams) && teams.length > 0) {
    const tBatch = adminDb.batch();
    for (const t of teams) {
      tBatch.set(adminDb.collection('teams').doc(t.id), {
        id: t.id,
        name: t.name,
        code: t.code,
        logo_url: t.logo_url || null,
        primary_color: t.primary_color || '#3b82f6',
        secondary_color: t.secondary_color || '#1e3a8a',
        captain_id: t.captain_id || null,
        captain_name: t.captain_name || null,
        initial_budget: Number(t.initial_budget) || 150.0,
      }, { merge: true });
    }
    await tBatch.commit();
  }

  // Restore retentions
  if (Array.isArray(retentions) && retentions.length > 0) {
    const rBatch = adminDb.batch();
    for (const r of retentions) {
      rBatch.set(adminDb.collection('team_retentions').doc(r.id), {
        id: r.id,
        team_id: r.team_id,
        player_id: r.player_id,
        points: Number(r.points),
        created_at: r.created_at || new Date().toISOString(),
      }, { merge: true });
    }
    await rBatch.commit();
  }

  // Restore results
  if (Array.isArray(results) && results.length > 0) {
    const resBatch = adminDb.batch();
    for (const res of results) {
      resBatch.set(adminDb.collection('auction_results').doc(res.id), {
        id: res.id,
        auction_event_id: res.auction_event_id || 'kpl-2026',
        player_id: res.player_id,
        team_id: res.team_id,
        final_price: Number(res.final_price),
        status: res.status,
        confirmed_by: res.confirmed_by,
        created_at: res.created_at || new Date().toISOString(),
      }, { merge: true });
    }
    await resBatch.commit();
  }

  await logFirestoreAudit(user.id, user.name, user.role, 'RESTORE_BACKUP', 'Restored system database from JSON backup snapshot.');
}
