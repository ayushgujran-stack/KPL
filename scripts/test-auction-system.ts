import { db } from '../src/lib/db';
import { seedDatabase } from '../src/lib/seed';
import {
  getAuctionState,
  startRandomPlayerDraw,
  confirmPlayerForAuction,
  startBidding,
  placeBid,
  declareSold,
  declareUnsold,
  reintroducePlayer,
  addRetention,
  removeRetention,
  clearTransactionData,
  clearMasterData,
  resetCompleteAuction,
  getTeamsWithBudgets,
  normalizeAuctionStatus,
} from '../src/lib/auction-service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runFullSuite() {
  console.log('\n======================================================');
  console.log('RUNNING FULL CRICKET AUCTION VERIFICATION SUITE');
  console.log('======================================================\n');

  // Test A: Initial Setup
  console.log('--- TEST A: Initial Setup Verification ---');
  seedDatabase();
  const adminUser = { id: 'usr-admin', name: 'Vikram Malhotra', role: 'super_admin' };
  await resetCompleteAuction(false, 'RESET AUCTION', adminUser);

  const users = db.prepare(`SELECT * FROM users`).all() as any[];
  const teams = db.prepare(`SELECT * FROM teams`).all() as any[];
  const players = db.prepare(`SELECT * FROM players`).all() as any[];

  assert(users.length >= 7, 'System has super admin, 2 organisers, and 4 captains');
  assert(teams.length === 4, 'Exactly 4 franchise teams are initialized');
  assert(players.length >= 36, 'Master database contains 36+ cricketers');

  const malePlayers = players.filter((p) => p.gender === 'Male');
  const femalePlayers = players.filter((p) => p.gender === 'Female');
  assert(malePlayers.length > 10 && femalePlayers.length > 10, 'Both Male and Female players are registered');

  // Test B: Retention Management
  console.log('\n--- TEST B: Player Retention Management ---');
  const teamMT = teams.find((t) => t.code === 'MT');
  const teamCSS = teams.find((t) => t.code === 'CSS');

  const availablePlayers = players.filter((p) => p.status === 'available');
  const p1 = availablePlayers[0];
  const p2 = availablePlayers[1];

  // Retain player 1 for 20 points
  await addRetention(teamMT.id, p1.id, 20, adminUser);
  // Retain player 2 for 15 points
  await addRetention(teamMT.id, p2.id, 15, adminUser);

  let updatedTeams = await getTeamsWithBudgets();
  let mtWithBudget = updatedTeams.find((t) => t.id === teamMT.id);
  assert(mtWithBudget.retention_spent === 35, 'Team MT retention spent is exactly 35 points (20 + 15)');
  assert(mtWithBudget.remaining_budget === 115, 'Team MT remaining budget is exactly 115 points (150 - 35)');

  // Verify max 2 retentions enforcement
  try {
    const p3 = availablePlayers[2];
    await addRetention(teamMT.id, p3.id, 10, adminUser);
    assert(false, 'Should have thrown error on 3rd retention');
  } catch (err: any) {
    assert(err.message.includes('maximum of 2 players'), 'Enforces maximum of 2 retained players per team');
  }

  // Verify retained player cannot enter random draw
  const draw1 = await startRandomPlayerDraw('all', adminUser);
  assert(draw1.selectedPlayer.id !== p1.id && draw1.selectedPlayer.id !== p2.id, 'Retained players are excluded from random draw pool');

  // Test C & D: Live Bidding & SOLD Confirmation
  console.log('\n--- TEST C & D: Random Draw, Live Bidding & SOLD Confirmation ---');
  await confirmPlayerForAuction(adminUser);
  await startBidding(adminUser);
  let state = await getAuctionState();
  assert(normalizeAuctionStatus(state.event.status) === 'BIDDING', 'Auction successfully moved to BIDDING status');
  const activePlayer = state.currentPlayer;
  assert(activePlayer !== null, 'Player spotlighted on auction podium');

  const captainMT = { id: 'usr-cap-mt', name: 'Rohit Varma', role: 'captain', team_id: teamMT.id };
  const captainCSS = { id: 'usr-cap-css', name: 'Dhoni Kumar', role: 'captain', team_id: teamCSS.id };

  // 1. First bid by Team CSS
  await placeBid(teamCSS.id, activePlayer.base_price, captainCSS);
  state = await getAuctionState();
  assert(state.event.current_bid === activePlayer.base_price, `Opening bid placed at base price: ${activePlayer.base_price} pts`);
  assert(state.event.current_bid_team_id === teamCSS.id, 'Team CSS is registered as highest bidder');

  // 2. Prevent team from bidding against itself
  try {
    await placeBid(teamCSS.id, activePlayer.base_price + 2, captainCSS);
    assert(false, 'Should prevent team from bidding against itself');
  } catch (err: any) {
    assert(err.message.includes('already the highest bidder'), 'Prevents team from bidding against itself');
  }

  // 3. Team MT outbids Team CSS
  await placeBid(teamMT.id, activePlayer.base_price + 5, captainMT);
  state = await getAuctionState();
  assert(state.event.current_bid === activePlayer.base_price + 5, `Team MT successfully outbids CSS at ${activePlayer.base_price + 5} pts`);
  assert(state.event.current_bid_team_id === teamMT.id, 'Team MT is now highest bidder');

  // 4. Test Insufficient budget validation with Team CSS (which is not current highest bidder)
  try {
    await placeBid(teamCSS.id, 999, captainCSS);
    assert(false, 'Should prevent bid exceeding budget');
  } catch (err: any) {
    assert(err.message.includes('exceeds'), 'Prevents bid exceeding team remaining purse');
  }

  // 5. Declare SOLD
  await declareSold(adminUser);
  state = await getAuctionState();
  assert(normalizeAuctionStatus(state.event.status) === 'RESULT_COMPLETED', 'Auction marked as RESULT_COMPLETED (SOLD)');
  const soldPlayerRecord = db.prepare(`SELECT * FROM players WHERE id = ?`).get(activePlayer.id) as any;
  assert(soldPlayerRecord.status === 'sold', 'Player status updated to SOLD in database');
  assert(soldPlayerRecord.sold_to_team_id === teamMT.id, 'Player assigned to winning franchise Team MT');

  updatedTeams = await getTeamsWithBudgets();
  mtWithBudget = updatedTeams.find((t) => t.id === teamMT.id);
  assert(
    mtWithBudget.remaining_budget === 150 - 35 - (activePlayer.base_price + 5),
    `Purse deducted atomically: Remaining is ${mtWithBudget.remaining_budget} pts`
  );

  // Test UNSOLD & Reintroduction
  console.log('\n--- TEST: UNSOLD Declaration & Reintroduction ---');
  const draw2 = await startRandomPlayerDraw('all', adminUser);
  await confirmPlayerForAuction(adminUser);
  await startBidding(adminUser);
  const stateUnsoldPre = await getAuctionState();
  const unsoldCandidate = stateUnsoldPre.currentPlayer;
  await declareUnsold(adminUser);
  state = await getAuctionState();
  assert(normalizeAuctionStatus(state.event.status) === 'RESULT_COMPLETED', 'Player declared UNSOLD');

  await reintroducePlayer(unsoldCandidate.id, adminUser);
  const reintroduced = db.prepare(`SELECT status FROM players WHERE id = ?`).get(unsoldCandidate.id) as any;
  assert(reintroduced.status === 'available', 'Unsold player reintroduced back into available pool');

  // Test E: Clear Transaction Data
  console.log('\n--- TEST E: Clear Transaction Data ---');
  await clearTransactionData('CLEAR TRANSACTIONS', adminUser);
  state = await getAuctionState();
  assert(normalizeAuctionStatus(state.event.status) === 'NOT_STARTED', 'Auction event reset to NOT STARTED');
  assert(state.recentBids.length === 0, 'All bids cleared');

  // Check that retained players preserved, sold players reset to available
  const resetP1 = db.prepare(`SELECT status FROM players WHERE id = ?`).get(p1.id) as any;
  assert(resetP1.status === 'retained', 'Retained player preserved in retained status');
  const resetSoldPlayer = db.prepare(`SELECT status, sold_to_team_id FROM players WHERE id = ?`).get(activePlayer.id) as any;
  assert(resetSoldPlayer.status === 'available' && resetSoldPlayer.sold_to_team_id === null, 'Auctioned player returned to pool with unlinked team');

  updatedTeams = await getTeamsWithBudgets();
  mtWithBudget = updatedTeams.find((t) => t.id === teamMT.id);
  assert(mtWithBudget.remaining_budget === 115, 'Team MT purse recalculated back to 150 - 35 = 115 pts');

  // Test G: Complete Auction Reset
  console.log('\n--- TEST G: Complete Auction Reset ---');
  await resetCompleteAuction(false, 'RESET AUCTION', adminUser);
  updatedTeams = await getTeamsWithBudgets();
  for (const t of updatedTeams) {
    assert(t.remaining_budget === 150, `${t.name} budget fully reset to 150.0 pts`);
  }
  const retCount = db.prepare(`SELECT COUNT(*) as cnt FROM team_retentions`).get() as any;
  assert(retCount.cnt === 0, 'Retention records cleared on full reset');

  // Verify accounts & masters preserved
  const userCheck = db.prepare(`SELECT COUNT(*) as cnt FROM users`).get() as any;
  const teamCheck = db.prepare(`SELECT COUNT(*) as cnt FROM teams`).get() as any;
  const playerCountCheck = db.prepare(`SELECT COUNT(*) as cnt FROM players`).get() as any;
  assert(userCheck.cnt >= 7, 'All user accounts preserved');
  assert(teamCheck.cnt === 4, 'All 4 team masters preserved');
  assert(playerCountCheck.cnt >= 36, 'All player masters preserved');

  console.log('\n======================================================');
  console.log('✅ ALL VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('======================================================\n');
}

runFullSuite().catch((err) => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
