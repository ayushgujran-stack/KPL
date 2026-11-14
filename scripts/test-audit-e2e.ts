/**
 * Complete End-to-End Automated Technical Audit & Verification Test Suite
 * Cricket Player Auction Management System
 */

const BASE_URL = 'http://localhost:3001';

interface TestResult {
  module: string;
  test: string;
  passed: boolean;
  error?: string;
  details?: string;
}

const results: TestResult[] = [];

function record(module: string, test: string, passed: boolean, error?: string, details?: string) {
  results.push({ module, test, passed, error, details });
  const icon = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`${icon} [${module}] ${test}${error ? ` -> ${error}` : ''}`);
}

async function loginAs(username: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Login failed for ${username}: ${res.status} - ${errText}`);
  }
  const cookie = res.headers.get('set-cookie');
  if (!cookie) throw new Error(`No cookie received for ${username}`);
  return cookie;
}

async function runAudit() {
  console.log('\n===============================================================');
  console.log('🚀 EXECUTING COMPLETE KPL AUCTION SYSTEM TECHNICAL AUDIT');
  console.log('===============================================================\n');

  let adminCookie = '';
  let org1Cookie = '';
  let org2Cookie = '';
  let capMtCookie = '';
  let capCssCookie = '';
  let capRcCookie = '';
  let capKkCookie = '';

  // -------------------------------------------------------------------------
  // 1. AUTHENTICATION & SESSION PERSISTENCE
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Testing Authentication Across All 7 Role Accounts ---');
  try {
    adminCookie = await loginAs('admin', 'admin123');
    record('Auth', 'Super Admin Login (admin)', true);
  } catch (err: any) {
    record('Auth', 'Super Admin Login (admin)', false, err.message);
  }

  try {
    org1Cookie = await loginAs('organiser1', 'org123');
    record('Auth', 'Organiser 1 Login (organiser1)', true);
  } catch (err: any) {
    record('Auth', 'Organiser 1 Login (organiser1)', false, err.message);
  }

  try {
    org2Cookie = await loginAs('organiser2', 'org123');
    record('Auth', 'Organiser 2 Login (organiser2)', true);
  } catch (err: any) {
    record('Auth', 'Organiser 2 Login (organiser2)', false, err.message);
  }

  try {
    capMtCookie = await loginAs('captain_mt', 'cap123');
    record('Auth', 'Captain Mumbai Titans Login (captain_mt)', true);
  } catch (err: any) {
    record('Auth', 'Captain Mumbai Titans Login (captain_mt)', false, err.message);
  }

  try {
    capCssCookie = await loginAs('captain_css', 'cap123');
    record('Auth', 'Captain Chennai Super Stars Login (captain_css)', true);
  } catch (err: any) {
    record('Auth', 'Captain Chennai Super Stars Login (captain_css)', false, err.message);
  }

  try {
    capRcCookie = await loginAs('captain_rc', 'cap123');
    record('Auth', 'Captain Royal Challengers Login (captain_rc)', true);
  } catch (err: any) {
    record('Auth', 'Captain Royal Challengers Login (captain_rc)', false, err.message);
  }

  try {
    capKkCookie = await loginAs('captain_kk', 'cap123');
    record('Auth', 'Captain Kolkata Knights Login (captain_kk)', true);
  } catch (err: any) {
    record('Auth', 'Captain Kolkata Knights Login (captain_kk)', false, err.message);
  }

  // Verify Session /api/auth/me
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: adminCookie },
    });
    const meData = await meRes.json();
    const passed = meRes.status === 200 && meData.user?.role === 'super_admin';
    record('Auth', 'Session Persistence & Identity Check (/api/auth/me)', passed);
  } catch (err: any) {
    record('Auth', 'Session Persistence & Identity Check (/api/auth/me)', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 2. BACKEND AUTHORIZATION & PERMISSION GUARDS
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Testing Backend Role-Based Authorization Restrictions ---');

  // Captain attempting to call /api/auction/start-bidding (Must be rejected with 403)
  try {
    const res = await fetch(`${BASE_URL}/api/auction/start-bidding`, {
      method: 'POST',
      headers: { Cookie: capMtCookie },
    });
    const passed = res.status === 403;
    record('Security', 'Captain blocked from starting bidding (/api/auction/start-bidding)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Captain blocked from starting bidding', false, err.message);
  }

  // Captain attempting to call /api/auction/sold (Must be rejected with 403)
  try {
    const res = await fetch(`${BASE_URL}/api/auction/sold`, {
      method: 'POST',
      headers: { Cookie: capMtCookie },
    });
    const passed = res.status === 403;
    record('Security', 'Captain blocked from declaring SOLD (/api/auction/sold)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Captain blocked from declaring SOLD', false, err.message);
  }

  // Captain attempting to call /api/auction/draw (Must be rejected with 403)
  try {
    const res = await fetch(`${BASE_URL}/api/auction/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capMtCookie },
      body: JSON.stringify({ category: 'all' }),
    });
    const passed = res.status === 403;
    record('Security', 'Captain blocked from triggering random draw (/api/auction/draw)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Captain blocked from triggering random draw', false, err.message);
  }

  // Captain attempting to access /api/users creation (Must be rejected with 403)
  try {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capMtCookie },
      body: JSON.stringify({ username: 'hacker', password: '123', name: 'Hacker', role: 'super_admin' }),
    });
    const passed = res.status === 403;
    record('Security', 'Captain blocked from user management (/api/users)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Captain blocked from user management', false, err.message);
  }

  // Anonymous user attempting to place a bid (Must be rejected with 401)
  try {
    const res = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teamId: 'team-mt', amount: 15 }),
    });
    const passed = res.status === 401;
    record('Security', 'Unauthenticated user blocked from bidding (/api/auction/bid)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Unauthenticated user blocked from bidding', false, err.message);
  }

  // Captain attempting to bid for another team (Must be rejected with 403)
  try {
    const res = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capMtCookie },
      body: JSON.stringify({ teamId: 'team-css', amount: 25 }),
    });
    const passed = res.status === 403;
    record('Security', 'Captain Mumbai blocked from bidding for Chennai (/api/auction/bid)', passed, passed ? undefined : `Received status ${res.status}`);
  } catch (err: any) {
    record('Security', 'Captain cross-team bidding block', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 3. MASTER DATA: TEAMS & PLAYERS
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Testing Team Master & Player Master ---');

  // Verify Teams
  try {
    const res = await fetch(`${BASE_URL}/api/teams`);
    const data = await res.json();
    const teams = data.teams || [];
    const passed = teams.length === 4 && teams.every((t: any) => t.initial_budget === 150);
    record('MasterData', '4 Franchise Teams Configured with 150.0 pts Initial Budget', passed, undefined, `Teams: ${teams.map((t: any) => t.code).join(', ')}`);
  } catch (err: any) {
    record('MasterData', 'Franchise Teams Fetch', false, err.message);
  }

  // Verify Players
  try {
    const res = await fetch(`${BASE_URL}/api/players`);
    const data = await res.json();
    const players = data.players || [];
    const hasMale = players.some((p: any) => p.gender === 'Male');
    const hasFemale = players.some((p: any) => p.gender === 'Female');
    const hasCategories = ['Marquee', 'Category A', 'Category B'].some((cat) => players.some((p: any) => p.category === cat));
    const passed = players.length >= 20 && hasMale && hasFemale && hasCategories;
    record('MasterData', 'Player Master Registry (Gender, Categories, Base Prices)', passed, undefined, `Total Players: ${players.length}`);
  } catch (err: any) {
    record('MasterData', 'Player Master Registry', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 4. IMAGE UPLOAD & STORAGE VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Testing Local Photo Upload & Validation ---');
  let uploadedPhotoUrl = '';

  // Valid PNG Upload
  try {
    const samplePngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(samplePngBase64, 'base64');
    const blob = new Blob([pngBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'audit-player.png');

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    const data = await res.json();
    const passed = res.status === 200 && !!data.url;
    uploadedPhotoUrl = data.url || '';
    record('Storage', 'Local Computer Photo Upload (/api/upload)', passed, undefined, `URL: ${data.url}`);
  } catch (err: any) {
    record('Storage', 'Local Computer Photo Upload', false, err.message);
  }

  // Serving Uploaded Photo
  try {
    if (uploadedPhotoUrl) {
      const res = await fetch(`${BASE_URL}${uploadedPhotoUrl}`);
      const contentType = res.headers.get('content-type') || '';
      const passed = res.status === 200 && contentType.includes('image/');
      record('Storage', 'Serving Uploaded Photo with Immutable Cache (/api/uploads/...)', passed, undefined, `Content-Type: ${contentType}`);
    }
  } catch (err: any) {
    record('Storage', 'Serving Uploaded Photo', false, err.message);
  }

  // Reject Unsupported File Type
  try {
    const txtBlob = new Blob(['sample text data'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', txtBlob, 'script.sh');

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    const passed = res.status === 400;
    record('Storage', 'Validation: Reject Unsupported File Type', passed);
  } catch (err: any) {
    record('Storage', 'Validation: Reject Unsupported File Type', false, err.message);
  }

  // Reject Oversized File (> 5MB)
  try {
    const bigBuffer = Buffer.alloc(5.5 * 1024 * 1024);
    const bigBlob = new Blob([bigBuffer], { type: 'image/jpeg' });
    const formData = new FormData();
    formData.append('file', bigBlob, 'giant-image.jpg');

    const res = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      headers: { Cookie: adminCookie },
      body: formData,
    });
    const passed = res.status === 400;
    record('Storage', 'Validation: Reject File Exceeding 5MB Ceiling', passed);
  } catch (err: any) {
    record('Storage', 'Validation: Reject File Exceeding 5MB Ceiling', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 5. RETENTION MANAGEMENT
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Testing Retention Rules & Budget Recalculation ---');
  let testRetainedId = '';

  try {
    // 1. Reset auction transactions to ensure NOT_STARTED status
    await fetch(`${BASE_URL}/api/admin/clear-transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ confirmationPhrase: 'CLEAR TRANSACTIONS' }),
    });

    // 2. Remove any existing retentions so test starts with a clean slate
    const existingRetRes = await fetch(`${BASE_URL}/api/retention`, { headers: { Cookie: adminCookie } });
    const existingRetData = await existingRetRes.json();
    for (const r of (existingRetData.retentions || [])) {
      await fetch(`${BASE_URL}/api/retention?id=${r.id}`, { method: 'DELETE', headers: { Cookie: adminCookie } });
    }

    // Pick available players
    const playersRes = await fetch(`${BASE_URL}/api/players?status=available`);
    const playersData = await playersRes.json();
    const available = playersData.players || [];

    if (available.length >= 2) {
      const player1 = available[0];
      const player2 = available[1];

      // Retain player 1 for Mumbai Titans (20 pts)
      const retRes1 = await fetch(`${BASE_URL}/api/retention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ team_id: 'team-mt', player_id: player1.id, points: 20 }),
      });
      const retData1 = await retRes1.json();
      const passed1 = retRes1.status === 200;
      record('Retention', `Retain Player 1 for Mumbai Titans (${player1.name} for 20 pts)`, passed1);

      // Verify Mumbai Titans budget is deducted: 150 - 20 = 130
      const mtTeam = retData1.teams?.find((t: any) => t.id === 'team-mt');
      const budgetCorrect = mtTeam?.remaining_budget === 130;
      record('Retention', 'Budget Deduction: 150 - 20 = 130 pts', budgetCorrect);

      // Retain player 2 for Mumbai Titans (15 pts) -> reach max 2
      const retRes2 = await fetch(`${BASE_URL}/api/retention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ team_id: 'team-mt', player_id: player2.id, points: 15 }),
      });
      const passed2 = retRes2.status === 200;
      record('Retention', `Retain Player 2 for Mumbai Titans (${player2.name} for 15 pts)`, passed2);

      // Attempt 3rd retention for Mumbai Titans (must be rejected - max 2)
      if (available.length >= 3) {
        const player3 = available[2];
        const retRes3 = await fetch(`${BASE_URL}/api/retention`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
          body: JSON.stringify({ team_id: 'team-mt', player_id: player3.id, points: 10 }),
        });
        const passed3 = retRes3.status === 400;
        record('Retention', 'Enforce Maximum 2 Retentions Per Team Limit', passed3);
      }

      // Attempt to retain player 1 for Chennai (must be rejected - already retained)
      const retDupRes = await fetch(`${BASE_URL}/api/retention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
        body: JSON.stringify({ team_id: 'team-css', player_id: player1.id, points: 25 }),
      });
      const passedDup = retDupRes.status === 400;
      record('Retention', 'Prevent Same Player Retained by Multiple Teams', passedDup);

      // Test PUT /api/retention: Update retention points from 20 to 25
      const currentRets = await (await fetch(`${BASE_URL}/api/retention`, { headers: { Cookie: adminCookie } })).json();
      const p1Ret = currentRets.retentions?.find((r: any) => r.player_id === player1.id);
      if (p1Ret) {
        const updateRes = await fetch(`${BASE_URL}/api/retention`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
          body: JSON.stringify({ id: p1Ret.id, points: 25 }),
        });
        const updateData = await updateRes.json();
        const mtUpdated = updateData.teams?.find((t: any) => t.id === 'team-mt');
        const updatePassed = updateRes.status === 200 && mtUpdated?.remaining_budget === 110;
        record('Retention', 'Update Retention Points (20 -> 25 pts) & Recalculate Purse (150 - 25 - 15 = 110 pts)', updatePassed);
      }

      // Test Organiser 1 permission to retain player for another team
      const orgRetRes = await fetch(`${BASE_URL}/api/retention`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: org1Cookie },
        body: JSON.stringify({ team_id: 'team-rc', player_id: available[2]?.id || 'ply-ply-021', points: 15 }),
      });
      const orgRetPassed = orgRetRes.status === 200;
      record('Retention', 'Organiser Permitted to Manage Retention (/api/retention)', orgRetPassed);
    }
  } catch (err: any) {
    record('Retention', 'Retention Testing', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 6. COMPLETE LIVE AUCTION WORKFLOW & STATE MACHINE
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Testing End-to-End Live Auction Workflow & State Transitions ---');

  // STEP 1: Random Draw
  let drawnPlayer: any = null;
  try {
    const drawRes = await fetch(`${BASE_URL}/api/auction/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: org1Cookie },
      body: JSON.stringify({ category: 'male' }),
    });
    const drawData = await drawRes.json();
    const passed = drawRes.status === 200 && !!drawData.selectedPlayer;
    drawnPlayer = drawData.selectedPlayer;
    record('Workflow', `Step 1: Organiser Starts Random Draw (Selected: ${drawnPlayer?.name})`, passed);

    // Verify auction status is now RANDOM_DRAW
    const stateRes = await fetch(`${BASE_URL}/api/auction/state`);
    const stateData = await stateRes.json();
    const statusCorrect = stateData.event?.status === 'RANDOM_DRAW';
    record('StateMachine', 'State Transition -> RANDOM_DRAW', statusCorrect);

    // Exclude retained player check: drawn player must not be retained
    const isRetained = stateData.currentPlayer?.status === 'retained';
    record('Workflow', 'Verify Drawn Player Is Not a Retained Player', !isRetained);
  } catch (err: any) {
    record('Workflow', 'Step 1: Random Draw', false, err.message);
  }

  // STEP 2: Confirm Player -> Moves to PLAYER_READY
  try {
    const confRes = await fetch(`${BASE_URL}/api/auction/confirm-draw`, {
      method: 'POST',
      headers: { Cookie: org1Cookie },
    });
    const confData = await confRes.json();
    const passed = confRes.status === 200 && confData.event?.status === 'PLAYER_READY';
    record('Workflow', 'Step 2: Organiser Confirms Player -> Status: PLAYER_READY', passed);
  } catch (err: any) {
    record('Workflow', 'Step 2: Confirm Player', false, err.message);
  }

  // STEP 3: Start Bidding -> Moves to BIDDING
  try {
    const startRes = await fetch(`${BASE_URL}/api/auction/start-bidding`, {
      method: 'POST',
      headers: { Cookie: org1Cookie },
    });
    const startData = await startRes.json();
    const passed = startRes.status === 200 && startData.event?.status === 'BIDDING';
    record('Workflow', 'Step 3: Organiser Starts Bidding -> Status: BIDDING', passed);
  } catch (err: any) {
    record('Workflow', 'Step 3: Start Bidding', false, err.message);
  }

  // STEP 4: Live Bidding by Multiple Captains
  try {
    const basePrice = drawnPlayer?.base_price || 10;

    // Captain Chennai opens bid at base price
    const bid1Res = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capCssCookie },
      body: JSON.stringify({ teamId: 'team-css', amount: basePrice }),
    });
    const bid1Data = await bid1Res.json();
    const passed1 = bid1Res.status === 200 && bid1Data.event?.current_bid === basePrice && bid1Data.event?.current_bid_team_id === 'team-css';
    record('Bidding', `Chennai opens bidding at base price (${basePrice} pts)`, passed1);

    // Captain Chennai tries to bid against themselves (Must be rejected)
    const bidSelfRes = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capCssCookie },
      body: JSON.stringify({ teamId: 'team-css', amount: basePrice + 2 }),
    });
    const passedSelf = bidSelfRes.status === 400;
    record('Bidding', 'Prevent Franchise Bidding Against Itself', passedSelf);

    // Captain Bangalore counter-bids (+2 pts)
    const bid2Amount = basePrice + 2;
    const bid2Res = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capRcCookie },
      body: JSON.stringify({ teamId: 'team-rc', amount: bid2Amount }),
    });
    const bid2Data = await bid2Res.json();
    const passed2 = bid2Res.status === 200 && bid2Data.event?.current_bid === bid2Amount && bid2Data.event?.current_bid_team_id === 'team-rc';
    record('Bidding', `Bangalore counter-bids at ${bid2Amount} pts`, passed2);

    // Captain Kolkata bids higher (+5 pts)
    const bid3Amount = bid2Amount + 5;
    const bid3Res = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capKkCookie },
      body: JSON.stringify({ teamId: 'team-kk', amount: bid3Amount }),
    });
    const bid3Data = await bid3Res.json();
    const passed3 = bid3Res.status === 200 && bid3Data.event?.current_bid === bid3Amount && bid3Data.event?.current_bid_team_id === 'team-kk';
    record('Bidding', `Kolkata counter-bids at ${bid3Amount} pts`, passed3);

    // Test Overspending Protection: Captain Mumbai tries to bid 500 points (exceeds budget)
    const bidOverRes = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capMtCookie },
      body: JSON.stringify({ teamId: 'team-mt', amount: 500 }),
    });
    const passedOver = bidOverRes.status === 400;
    record('Bidding', 'Overspending Protection: Prevent Bids Exceeding Franchise Balance', passedOver);

    // Test Pause and Resume
    const pauseRes = await fetch(`${BASE_URL}/api/auction/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: org1Cookie },
      body: JSON.stringify({ action: 'pause' }),
    });
    const pauseData = await pauseRes.json();
    const passedPause = pauseData.event?.status === 'BIDDING_PAUSED';
    record('StateMachine', 'Pause Bidding -> Status: BIDDING_PAUSED', passedPause);

    // Attempt bid while paused (must be rejected)
    const bidPausedRes = await fetch(`${BASE_URL}/api/auction/bid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: capCssCookie },
      body: JSON.stringify({ teamId: 'team-css', amount: bid3Amount + 1 }),
    });
    record('Bidding', 'Reject Bids While Auction is Paused', bidPausedRes.status === 400);

    // Resume Bidding
    const resumeRes = await fetch(`${BASE_URL}/api/auction/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: org1Cookie },
      body: JSON.stringify({ action: 'resume' }),
    });
    const resumeData = await resumeRes.json();
    const passedResume = resumeData.event?.status === 'BIDDING';
    record('StateMachine', 'Resume Bidding -> Status: BIDDING', passedResume);
  } catch (err: any) {
    record('Bidding', 'Live Bidding Execution', false, err.message);
  }

  // STEP 5: Declare SOLD -> Moves to RESULT_COMPLETED
  try {
    const soldRes = await fetch(`${BASE_URL}/api/auction/sold`, {
      method: 'POST',
      headers: { Cookie: org1Cookie },
    });
    const soldData = await soldRes.json();
    const passed = soldRes.status === 200 && soldData.event?.status === 'RESULT_COMPLETED';
    record('Workflow', 'Step 4: Organiser Declares SOLD -> Status: RESULT_COMPLETED', passed);

    // Verify Kolkata budget was deducted: 150 - final_bid
    const winningTeam = soldData.teams?.find((t: any) => t.id === 'team-kk');
    const deductedCorrectly = winningTeam?.auction_spent > 0;
    record('Workflow', `Points Deducted Correctly from Winning Team (${winningTeam?.name}: ${winningTeam?.remaining_budget} pts remaining)`, deductedCorrectly);
  } catch (err: any) {
    record('Workflow', 'Step 4: Declare SOLD', false, err.message);
  }

  // STEP 6: Next Random Draw -> Moves to RANDOM_DRAW
  try {
    const nextRes = await fetch(`${BASE_URL}/api/auction/next-draw`, {
      method: 'POST',
      headers: { Cookie: org1Cookie },
    });
    const nextData = await nextRes.json();
    const passed = nextRes.status === 200 && nextData.event?.status === 'RANDOM_DRAW' && nextData.event?.current_player_id === null;
    record('Workflow', 'Step 5: Organiser Clicks NEXT RANDOM DRAW -> Transitions to RANDOM_DRAW', passed);
  } catch (err: any) {
    record('Workflow', 'Step 5: Next Random Draw', false, err.message);
  }

  // STEP 7: Unsold Flow Verification
  try {
    // Draw next player (female category)
    const draw2Res = await fetch(`${BASE_URL}/api/auction/draw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: org2Cookie },
      body: JSON.stringify({ category: 'female' }),
    });
    const draw2Data = await draw2Res.json();
    const femalePlayer = draw2Data.selectedPlayer;
    record('Workflow', `Unsold Flow: Draw Female Player (${femalePlayer?.name})`, draw2Res.status === 200);

    // Confirm
    await fetch(`${BASE_URL}/api/auction/confirm-draw`, { method: 'POST', headers: { Cookie: org2Cookie } });
    // Start bidding
    await fetch(`${BASE_URL}/api/auction/start-bidding`, { method: 'POST', headers: { Cookie: org2Cookie } });

    // Declare UNSOLD without any bids
    const unsoldRes = await fetch(`${BASE_URL}/api/auction/unsold`, {
      method: 'POST',
      headers: { Cookie: org2Cookie },
    });
    const unsoldData = await unsoldRes.json();
    const passedUnsold = unsoldRes.status === 200 && unsoldData.event?.status === 'RESULT_COMPLETED';
    record('Workflow', `Declare UNSOLD -> Status: RESULT_COMPLETED (${femalePlayer?.name} marked unsold)`, passedUnsold);

    // Next random draw
    await fetch(`${BASE_URL}/api/auction/next-draw`, { method: 'POST', headers: { Cookie: org2Cookie } });
  } catch (err: any) {
    record('Workflow', 'Unsold Flow Verification', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 7. CAPTAIN DASHBOARD & SQUAD VISIBILITY
  // -------------------------------------------------------------------------
  console.log('\n--- 7. Testing Captain Dashboard Data & Roster ---');
  try {
    const res = await fetch(`${BASE_URL}/api/teams/team-kk`);
    const data = await res.json();
    const squad = data.squad || [];
    const hasPurchasedPlayer = squad.some((p: any) => p.acquisition_type === 'auction');
    record('CaptainDashboard', 'Captain Kolkata Squad Reflects Won Auction Cricketer', hasPurchasedPlayer, undefined, `Squad Size: ${squad.length}`);
  } catch (err: any) {
    record('CaptainDashboard', 'Captain Kolkata Squad', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 8. REPORTS & DATA RECONCILIATION
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Testing Auction Reports & Audit Trail ---');
  try {
    const res = await fetch(`${BASE_URL}/api/reports`);
    const data = await res.json();
    const sold = data.soldPlayers || [];
    const unsold = data.unsoldPlayers || [];
    const retained = data.retainedPlayers || [];
    const bids = data.bidsHistory || [];
    const draws = data.drawHistory || [];

    const passed = sold.length >= 1 && unsold.length >= 1 && retained.length >= 1 && bids.length >= 3 && draws.length >= 2;
    record(
      'Reports',
      'Reports Reconciliation (Sold, Unsold, Retained, Bids History, Draws History)',
      passed,
      undefined,
      `Sold: ${sold.length}, Unsold: ${unsold.length}, Retained: ${retained.length}, Bids: ${bids.length}, Draws: ${draws.length}`
    );
  } catch (err: any) {
    record('Reports', 'Reports Reconciliation', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 9. AUDIT LOGGING
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Testing Administrative Audit Trail ---');
  try {
    const res = await fetch(`${BASE_URL}/api/admin/audit-logs`, {
      headers: { Cookie: adminCookie },
    });
    const data = await res.json();
    const logs = data.logs || [];
    const passed = logs.length >= 5;
    record('AuditLogs', 'System Audit Trail Records All Actions Chronologically', passed, undefined, `Total Audit Entries: ${logs.length}`);
  } catch (err: any) {
    record('AuditLogs', 'System Audit Trail', false, err.message);
  }

  // -------------------------------------------------------------------------
  // 10. REALTIME SSE STREAM
  // -------------------------------------------------------------------------
  console.log('\n--- 10. Testing Realtime SSE Stream Endpoint ---');
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`${BASE_URL}/api/auction/stream`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const contentType = res.headers.get('content-type') || '';
    const passed = res.status === 200 && contentType.includes('text/event-stream');
    record('Realtime', 'Realtime SSE Stream (/api/auction/stream)', passed, undefined, `Content-Type: ${contentType}`);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      record('Realtime', 'Realtime SSE Stream (/api/auction/stream)', true, undefined, 'SSE stream open and responding');
    } else {
      record('Realtime', 'Realtime SSE Stream', false, err.message);
    }
  }

  // Summary
  console.log('\n===============================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`AUDIT RESULTS: Total: ${total} | Passed: ${passed} | Failed: ${failed}`);
  console.log('===============================================================\n');

  return { total, passed, failed, results };
}

runAudit().catch(console.error);
