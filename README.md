# 🏏 Cricket Player Auction Management System (KPL 2026)

A complete, professional, real-time, database-driven web application for conducting cricket tournament player auctions with four teams, four captains, two organizers, male & female cricketers, player retention, automatic random selection, live atomic bidding, budget management, analytical reports, and comprehensive admin data reset safety controls.

---

## 🌟 Key Features

### 1. Four Participating Franchises (150 Points Purse Each)
- **Mumbai Titans (MT)** - Royal Blue (`#2563eb`) | Captain: Rohit Varma
- **Chennai Super Stars (CSS)** - Radiant Gold (`#eab308`) | Captain: Dhoni Kumar
- **Royal Challengers (RC)** - Crimson Red (`#dc2626`) | Captain: Virat Patel
- **Kolkata Knights (KK)** - Imperial Purple (`#7c3aed`) | Captain: Shreyas Iyer
- Real-time budget tracking: `Remaining = Initial (150) - Retention Spent - Auction Spent`.

### 2. Role-Based Access Control (RBAC) & Credentials
The application includes pre-configured credentials for all roles:

| Role | Username | Password | Permissions & Dashboard |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `admin` | `admin123` | Full application control, Master configurations, Reports, Clear Master & Transaction Data, Complete Auction Reset, Backups, and Audit logs. |
| **Lead Organiser** | `organiser1` | `org123` | Start random lottery draw, Confirm selected player, Start/Pause/Resume bidding, Declare SOLD / UNSOLD, Reset timer. |
| **Assistant Organiser** | `organiser2` | `org123` | Assist lead organiser, Monitor bids, View budgets, and Manage authorised podium controls. |
| **Captain (Mumbai)** | `captain_mt` | `cap123` | Captain dashboard, Squad roster, Real-time purse indicator, Live atomic bidding (+1, +2, +5, custom). |
| **Captain (Chennai)** | `captain_css` | `cap123` | Captain dashboard, Live bidding for Chennai Super Stars. |
| **Captain (Bangalore)** | `captain_rc` | `cap123` | Captain dashboard, Live bidding for Royal Challengers. |
| **Captain (Kolkata)** | `captain_kk` | `cap123` | Captain dashboard, Live bidding for Kolkata Knights. |
| **Public Viewer** | *No login needed* | *N/A* | Real-time broadcast and Projector large-screen view. Cannot place bids or modify data. |

---

### 3. Automated Random Player Draw
- Cryptographically fair backend lottery with equal probability across eligible players.
- Filters: **All Players**, **Male Only**, or **Female Only**.
- Excludes retained, sold, and active cricketers automatically.
- Dramatic slot-machine rolling animation that lands smoothly on the backend's selected cricketer.
- Organiser confirms player to move directly to live auction.

---

### 4. Professional IPL-Style Live Auction Arena
- Stadium dark navy background (`#070b14`), golden highlights, broadcast typography.
- Atomic backend bidding engine with concurrency safety:
  * Prevents teams from bidding against themselves.
  * Prevents bids exceeding remaining team purse.
  * Configurable countdown timer with audio/visual pulses.
  * Real-time Server-Sent Events (SSE) stream + polling fallback ensuring 100% synchronized displays on phones, tablets, laptops, and projectors without manual refreshing.
- Confetti celebration explosion when a cricketer is declared **SOLD**.

---

### 5. Large-Screen Projector Display (`/projector`)
- Fullscreen mode tailored for large auditorium TVs, LED walls, and monitors.
- Large legible typography, high-resolution spotlight player card, winning bidder banner, 4 franchise budgets, recent sold results ticker.

---

### 6. Player Retention Management (`/admin/retention`)
- Franchises can retain up to 2 cricketers prior to the auction.
- Retention points are automatically deducted from the franchise's 150 points purse.
- Retained cricketers are locked and strictly excluded from the random draw pool.

---

### 7. Analytical Reports & Exports (`/admin/reports`)
- Comprehensive tournament results.
- Franchise roster statements.
- Male / Female demographic distribution.
- Complete chronological bid history log and random draw history.
- One-click **Excel Export** (`.xlsx`) and print-ready format.

---

### 8. Admin Data Management & Reset Safety (`/admin/settings/data`)
Restricted exclusively to Super Admin with safeguards:
- **A. Clear Master Data:** Selectively purge player or team masters while protecting captain and admin accounts. Requires typing `CLEAR MASTERS`.
- **B. Clear Transaction Data:** Clears bids, draws, and auction results, returns players to available pool, and automatically recalculates franchise purses from retained configuration. Requires typing `CLEAR TRANSACTIONS`.
- **C. Reset Complete Auction:** Resets team budgets to full 150 points, clears bidding and countdown state, with option to keep or clear retentions. Requires typing `RESET AUCTION`.
- **D. Backup & Restore:** Instant JSON database snapshot creation and restore.
- **E. Immutable Audit Logs:** Records every administrative action with timestamp, admin ID, and description.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18+)
- npm

### Installation & Run

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Prime Initial Database:**
   ```bash
   npx tsx src/lib/seed.ts
   ```

3. **Run Automated Test Suite (All 8 Test Categories):**
   ```bash
   npx tsx scripts/test-auction-system.ts
   ```

4. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

5. **Production Build:**
   ```bash
   npm run build
   npm start
   ```

---

## 🗄️ Database Schema & Supabase / PostgreSQL Support
- **Default Local Relational Engine:** SQLite via `better-sqlite3` with WAL mode and foreign key enforcement enabled (`data/kpl.db`). Works zero-setup out of the box on macOS, Windows, and Linux.
- **Supabase / PostgreSQL Deployment:** A production-ready `supabase_schema.sql` is provided in the repository root containing complete PostgreSQL DDL tables, UUID primary keys, foreign key constraints, and Row Level Security (RLS) policies.

---

## 📱 Multi-Device Compatibility
Tested and optimized for:
- Android Phones & iPhones (Mobile-responsive Captain bidding console)
- Tablets & iPads
- Windows, macOS, and Linux laptops
- Auditorium Projectors & TV Displays
