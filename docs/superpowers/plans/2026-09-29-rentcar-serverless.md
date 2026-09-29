# RentCar Serverless (HTML/CSS/JS + SQLite WASM) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-grade, serverless car rental platform (RentCar) in HTML, CSS, JavaScript, and client-side SQLite (sql.js / WASM + IndexedDB) based on `TZ.txt`.

**Architecture:** Client-side Single Page Application with modular ES6 views, a custom vanilla CSS design system, and an in-memory SQLite database powered by `sql.js` (WebAssembly) with automatic asynchronous persistence to browser `IndexedDB` and physical `.sqlite` export/import capabilities.

**Tech Stack:** HTML5, Modern CSS3 (Glassmorphism, CSS Custom Properties, Responsive Grid), Vanilla ES6 JavaScript, `sql.js` (SQLite WASM), IndexedDB API.

**Spec:** [docs/superpowers/specs/2026-09-29-rentcar-serverless-design.md](file:///c:/RentCar/docs/superpowers/specs/2026-09-29-rentcar-serverless-design.md)

## Global Constraints

- 100% serverless: No backend server (Node, Python, Go) required to run the application; opens directly via static file server or browser.
- Real SQLite: All relational operations must use `sql.js` SQL queries (`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `JOIN`, constraints).
- Persistence: All state changes must sync to IndexedDB so refreshing or closing the browser preserves the exact state.
- Portability: Users must be able to download the physical `.sqlite` database file and upload a saved `.sqlite` file to restore.
- Responsive & Multilingual Ready: Support screen sizes from mobile (375px) to desktop (1440px+), formatted in Uzbek with currency in UZS.

## Review Focus

1. Double booking on overlapping dates: System must block booking attempts for cars already rented during the requested date range.
2. Blacklisted user booking: If a customer phone/ID is marked as `blacklisted`, booking creation must be rejected with a clear warning.
3. Database corruption on reload: If IndexedDB data is missing or corrupted, system must gracefully fall back to re-initializing schema and seed data.
4. Negative or inverted rental dates: Return date must be strictly equal to or after pickup date; minimum rental is 1 day.
5. Large or invalid `.sqlite` import: File upload must validate that the file is a valid SQLite 3 database header before swapping out the active database.

---

## File Structure

```
c:\RentCar\
├── index.html                  # Single entry point with navbar, views container, modals, toast container
├── css\
│   ├── styles.css              # Design tokens, variables, typography, layout, modals, toasts, utility classes
│   ├── client.css              # Client portal styling (hero search bar, car cards, booking wizard)
│   └── admin.css               # Admin/Manager styling (sidebar, stats cards, data tables, kanban, forms)
├── js\
│   ├── db.js                   # sql.js WASM loader, query/exec helpers, IndexedDB sync, .sqlite export/import
│   ├── schema.js               # DDL table creation and initial Uzbek market car fleet & user seed data
│   ├── auth.js                 # RBAC state (client, manager, admin), active user session, role switcher
│   ├── app.js                  # SPA view router, event dispatchers, notification system
│   ├── views\
│   │   ├── clientView.js       # Car search, filters, car cards, 3-step booking wizard, my bookings
│   │   ├── dashboardView.js    # Real-time fleet metrics, utilization chart, quick stats
│   │   ├── fleetView.js        # Fleet management (add/edit car, status switcher, maintenance alerts)
│   │   ├── bookingsView.js     # Bookings list, status workflow, handover inspection act modal
│   │   ├── crmView.js          # Customer management, rental history, blacklist toggle
│   │   └── reportsView.js      # Financial summary, revenue/expenses, .sqlite backup & CSV export
│   └── vendor\
│       ├── sql-wasm.js         # sql.js WebAssembly loader library
│       └── sql-wasm.wasm       # Compiled SQLite binary
└── tests\
    ├── test_suite.js           # Automated unit/integration tests for DB, booking logic, and RBAC
    └── run_tests.html          # Browser test runner page with visual test reporter
```

---

### Task 1: Vendor Setup & SQLite Database Layer

**Files:**
- Create: `js/vendor/sql-wasm.js`
- Create: `js/vendor/sql-wasm.wasm`
- Create: `js/db.js`
- Create: `js/schema.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Produces:
  - `DB.init(): Promise<void>`
  - `DB.query(sql: string, params?: any[]): Array<Object>`
  - `DB.exec(sql: string, params?: any[]): void`
  - `DB.exportDatabase(): Uint8Array`
  - `DB.importDatabase(data: Uint8Array): Promise<void>`
  - `DB.resetToDefault(): Promise<void>`
  - `SCHEMA.ddl: string`
  - `SCHEMA.seedSql: string`

- [ ] **Step 1: Write the failing test for DB initialization, table creation, and querying**

```javascript
// tests/test_suite.js
async function testDbInitialization() {
  await DB.init();
  const users = DB.query("SELECT * FROM users WHERE role = ?", ['admin']);
  assert(users.length > 0, "Admin user must be seeded in database");
  const cars = DB.query("SELECT * FROM cars");
  assert(cars.length >= 6, "At least 6 initial cars must be seeded");
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node -e "require('./tests/test_suite.js')"`
Expected: FAIL with "DB is not defined" or "file not found"

- [ ] **Step 3: Download/vendor `sql-wasm.js` and `sql-wasm.wasm` into `js/vendor/`**

Fetch standard `sql.js` v1.12.0 WASM assets into `js/vendor/` so the app is completely self-contained.

- [ ] **Step 4: Implement `js/schema.js` with DDL tables and Seed Data**

Define SQL DDL for `users`, `cars`, `bookings`, `handover_inspections`, `financial_transactions` and insert initial cars (Onix, Tracker, Malibu 2, BYD Song Plus EV, Kia K5, Mercedes E-Class) and test users.

- [ ] **Step 5: Implement `js/db.js` with IndexedDB persistence**

Load WASM using `initSqlJs`, check IndexedDB object store `rentcar_db` / `sqlite_file`, initialize schema if empty, persist binary on `exec()`, provide `exportDatabase()` and `importDatabase()`.

- [ ] **Step 6: Run test to verify it passes**

Run test suite in Node/Browser environment.
Expected: PASS with 6 cars and initial users verified.

- [ ] **Step 7: Commit**

```bash
git add js/vendor/ js/db.js js/schema.js tests/test_suite.js
git commit -m "feat: implement SQLite WASM database layer with IndexedDB persistence and seed data"
```

---

### Task 2: Core Design System & CSS Foundation

**Files:**
- Create: `css/styles.css`
- Create: `css/client.css`
- Create: `css/admin.css`

**Interfaces:**
- Produces:
  - CSS Custom Properties (`--bg-primary`, `--bg-surface`, `--text-primary`, `--accent-primary`, `--accent-emerald`, `--border-color`, `--radius-md`, `--shadow-lg`)
  - Utility classes (`.btn`, `.btn-primary`, `.btn-secondary`, `.badge`, `.card`, `.modal-backdrop`, `.toast`)
  - Grid & Flexbox layout primitives

- [ ] **Step 1: Write visual regression / styling test verifying token classes exist**

Verify CSS classes `.btn-primary`, `.badge-available`, `.modal-overlay`, `.card-glass` in `tests/test_suite.js`.

- [ ] **Step 2: Implement `css/styles.css`**

Create modern dark-accented design system with CSS custom properties, Google Inter/Outfit typography, modal backdrop, toast notifications, badges for car categories and booking statuses.

- [ ] **Step 3: Implement `css/client.css`**

Create hero booking widget styles, responsive car catalog grid, feature chips, 3-step booking wizard tabs, payment option selectors.

- [ ] **Step 4: Implement `css/admin.css`**

Create admin sidebar layout, real-time KPI stat cards, data table with action buttons, kanban columns, inspection act signature/photo notes.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css css/client.css css/admin.css
git commit -m "style: create comprehensive CSS design system for client and admin portals"
```

---

### Task 3: Auth & Role Switching Module

**Files:**
- Create: `js/auth.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query(sql, params)`
- Produces:
  - `Auth.getCurrentUser(): Object`
  - `Auth.getRole(): 'client' | 'manager' | 'admin'`
  - `Auth.switchRole(role: string): void`
  - `Auth.loginByPhone(phone: string): boolean`
  - `Auth.isBlacklisted(userId: number): boolean`

- [ ] **Step 1: Write tests for role switching and blacklist checking**

```javascript
function testAuthRoleSwitch() {
  Auth.switchRole('admin');
  assert(Auth.getRole() === 'admin', "Current role should be admin");
  Auth.switchRole('client');
  assert(Auth.getRole() === 'client', "Current role should be client");
}
```

- [ ] **Step 2: Implement `js/auth.js`**

Implement simulated auth state, storing active role in `localStorage` ('active_role'), fetching user profile from SQLite, verifying blacklist status.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/auth.js tests/test_suite.js
git commit -m "feat: implement RBAC auth module with quick role switcher"
```

---

### Task 4: Client View - Fleet Browsing & Search/Filter Widget

**Files:**
- Create: `js/views/clientView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `Auth.getCurrentUser()`
- Produces:
  - `ClientView.render(): string`
  - `ClientView.initListeners(): void`
  - `ClientView.filterCars(criteria: Object): Array<Object>`

- [ ] **Step 1: Write test for car filtering logic**

```javascript
function testCarFiltering() {
  const suvCars = ClientView.filterCars({ category: 'SUV' });
  assert(suvCars.every(c => c.category === 'SUV'), "Filter should only return SUV cars");
  const autoCars = ClientView.filterCars({ transmission: 'Avtomat' });
  assert(autoCars.every(c => c.transmission === 'Avtomat'), "Filter should only return automatic cars");
}
```

- [ ] **Step 2: Implement search widget and catalog rendering in `js/views/clientView.js`**

Implement hero banner search bar (pickup location, return location, start date, end date, car type), filter sidebar/tabs, and dynamic car cards with specs (fuel, gearbox, seats, daily price, deposit).

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/clientView.js tests/test_suite.js
git commit -m "feat: implement client car browsing, search widget and category filters"
```

---

### Task 5: Client View - 3-Step Booking Wizard & Payment Simulation

**Files:**
- Modify: `js/views/clientView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exec()`, `Auth.getCurrentUser()`
- Produces:
  - `ClientView.openBookingModal(carId: number): void`
  - `ClientView.calculateTotal(dailyRate: number, days: number, services: string[]): Object`
  - `ClientView.submitBooking(bookingData: Object): { success: boolean, bookingCode?: string, error?: string }`

- [ ] **Step 1: Write test for booking calculation and conflict prevention**

```javascript
function testBookingConflictPrevention() {
  // Try booking car already rented for overlapping dates
  const res = ClientView.submitBooking({
    car_id: 1,
    start_date: '2026-10-01',
    end_date: '2026-10-05',
    phone: '+998901234567'
  });
  assert(res.success === true, "First booking should succeed");
  const conflictRes = ClientView.submitBooking({
    car_id: 1,
    start_date: '2026-10-03',
    end_date: '2026-10-07',
    phone: '+998912345678'
  });
  assert(conflictRes.success === false, "Overlapping booking must fail with conflict error");
}
```

- [ ] **Step 2: Implement 3-step booking modal in `clientView.js`**

- Step 1: Date picker, duration calculation, optional add-ons (KASKO insurance: +80,000 UZS/day, Child seat: +30,000 UZS/day, GPS: +20,000 UZS/day).
- Step 2: Customer information form (full name, phone, passport/ID, driver's license).
- Step 3: Payment method choice (Click, Payme, Uzum Pay, Cash on pickup). Generates unique booking code (`RC-2026-XXXX`).
- Saves booking in `bookings` table and auto-creates transaction in `financial_transactions`.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/clientView.js tests/test_suite.js
git commit -m "feat: implement 3-step booking wizard with dynamic pricing and conflict validation"
```

---

### Task 6: Client View - "Mening Buyurtmalarim" (My Bookings) & Cancellation

**Files:**
- Modify: `js/views/clientView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exec()`, `Auth.getCurrentUser()`
- Produces:
  - `ClientView.renderMyBookings(phoneOrCode?: string): string`
  - `ClientView.cancelBooking(bookingId: number): boolean`

- [ ] **Step 1: Write test for user bookings lookup and cancellation**

```javascript
function testBookingCancellation() {
  const bookings = DB.query("SELECT id FROM bookings WHERE status = 'new' LIMIT 1");
  if (bookings.length > 0) {
    const success = ClientView.cancelBooking(bookings[0].id);
    assert(success === true, "New booking should be cancellable");
    const updated = DB.query("SELECT status FROM bookings WHERE id = ?", [bookings[0].id]);
    assert(updated[0].status === 'cancelled', "Status must be updated to cancelled");
  }
}
```

- [ ] **Step 2: Implement My Bookings modal/tab and cancellation logic**

Allow client to search active/completed bookings by phone number or booking code, view car details, total price, status badge, and cancel `new` or `confirmed` bookings.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/clientView.js tests/test_suite.js
git commit -m "feat: add customer bookings history and cancellation flow"
```

---

### Task 7: Admin View - Dashboard & Real-Time Fleet Metrics

**Files:**
- Create: `js/views/dashboardView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`
- Produces:
  - `DashboardView.render(): string`
  - `DashboardView.getMetrics(): Object`

- [ ] **Step 1: Write test for dashboard metrics aggregation**

```javascript
function testDashboardMetrics() {
  const metrics = DashboardView.getMetrics();
  assert(metrics.totalCars >= 6, "Total cars should be >= 6");
  assert(typeof metrics.revenue === 'number', "Revenue should be a number");
  assert(Array.isArray(metrics.pendingPickups), "Pending pickups should be an array");
}
```

- [ ] **Step 2: Implement `js/views/dashboardView.js`**

Render summary KPI cards (Total Cars, Available, Rented, In Maintenance, Monthly Revenue, Today's Pickups/Returns), quick status overview, and upcoming return reminders.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/dashboardView.js tests/test_suite.js
git commit -m "feat: implement admin dashboard with real-time fleet and revenue metrics"
```

---

### Task 8: Admin View - Fleet Management (CRUD & Statuses)

**Files:**
- Create: `js/views/fleetView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exec()`
- Produces:
  - `FleetView.render(): string`
  - `FleetView.addCar(carData: Object): number`
  - `FleetView.updateCarStatus(carId: number, status: string): void`
  - `FleetView.deleteCar(carId: number): void`

- [ ] **Step 1: Write test for car addition and status transition**

```javascript
function testFleetCrud() {
  const newId = FleetView.addCar({
    make: 'Chevrolet', model: 'Cobalt', year: 2024,
    category: 'Ekonom', transmission: 'Avtomat', fuel_type: 'Benzin',
    seats: 5, daily_rate: 300000, deposit_amount: 1500000,
    plate_number: '01A999AA', image_url: 'car.jpg'
  });
  assert(newId > 0, "New car should have valid ID");
  FleetView.updateCarStatus(newId, 'maintenance');
  const car = DB.query("SELECT status FROM cars WHERE id = ?", [newId])[0];
  assert(car.status === 'maintenance', "Status should update to maintenance");
}
```

- [ ] **Step 2: Implement `js/views/fleetView.js`**

Table and grid view of all cars, status badge with inline toggle (*Bo'sh, Band, Ta'mirda, Yuvishda*), "Yangi mashina qo'shish" modal form, edit and delete actions, maintenance interval notification.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/fleetView.js tests/test_suite.js
git commit -m "feat: implement fleet management view with car CRUD and status transitions"
```

---

### Task 9: Admin View - Bookings Management & Handover Inspection

**Files:**
- Create: `js/views/bookingsView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exec()`, `Auth.getCurrentUser()`
- Produces:
  - `BookingsView.render(): string`
  - `BookingsView.updateBookingStatus(bookingId: number, status: string): void`
  - `BookingsView.recordInspection(inspectionData: Object): void`

- [ ] **Step 1: Write test for booking workflow and inspection act record**

```javascript
function testBookingWorkflowAndInspection() {
  const b = DB.query("SELECT id, car_id FROM bookings WHERE status = 'new' LIMIT 1")[0];
  BookingsView.updateBookingStatus(b.id, 'confirmed');
  BookingsView.recordInspection({
    booking_id: b.id,
    inspection_type: 'pickup',
    fuel_level: 100,
    mileage: 15400,
    damages_note: 'Old bamperda mayda tirnalgan joyi bor'
  });
  const insp = DB.query("SELECT * FROM handover_inspections WHERE booking_id = ?", [b.id]);
  assert(insp.length > 0, "Handover inspection act should be recorded in SQLite");
}
```

- [ ] **Step 2: Implement `js/views/bookingsView.js`**

Status filter tabs / Kanban board, detailed booking modal with client and car specs, status progression buttons (Confirm -> Handover -> Complete -> Cancel), handover inspection act modal (fuel percentage, mileage, condition notes).

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/bookingsView.js tests/test_suite.js
git commit -m "feat: implement booking management and handover inspection act"
```

---

### Task 10: Admin View - CRM & Blacklist

**Files:**
- Create: `js/views/crmView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exec()`
- Produces:
  - `CrmView.render(): string`
  - `CrmView.toggleBlacklist(userId: number, reason?: string): void`

- [ ] **Step 1: Write test for customer listing and blacklist toggle**

```javascript
function testCrmBlacklist() {
  const user = DB.query("SELECT id, status FROM users WHERE role = 'client' LIMIT 1")[0];
  CrmView.toggleBlacklist(user.id);
  const updated = DB.query("SELECT status FROM users WHERE id = ?", [user.id])[0];
  assert(updated.status === (user.status === 'active' ? 'blacklisted' : 'active'), "Status toggled");
}
```

- [ ] **Step 2: Implement `js/views/crmView.js`**

Customer database table, total bookings, total spent calculation via SQL `JOIN`, passport & driver's license details viewer, Blacklist badge and toggle button.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/crmView.js tests/test_suite.js
git commit -m "feat: implement CRM customer view with rental history and blacklist toggle"
```

---

### Task 11: Admin View - Finance & SQLite Database Export/Import

**Files:**
- Create: `js/views/reportsView.js`
- Test: `tests/test_suite.js`

**Interfaces:**
- Consumes: `DB.query()`, `DB.exportDatabase()`, `DB.importDatabase()`
- Produces:
  - `ReportsView.render(): string`
  - `ReportsView.exportToCsv(): void`
  - `ReportsView.downloadSqliteBackup(): void`
  - `ReportsView.restoreSqliteBackup(file: File): Promise<void>`

- [ ] **Step 1: Write test for financial calculation and SQLite export integrity**

```javascript
function testFinancialSummaryAndExport() {
  const binary = DB.exportDatabase();
  assert(binary instanceof Uint8Array, "Exported DB must be Uint8Array");
  assert(binary.length > 0, "Exported DB must have content");
  // Check SQLite 3 magic header: "SQLite format 3\0"
  const header = String.fromCharCode(...binary.slice(0, 15));
  assert(header === "SQLite format 3", "Must be a valid SQLite 3 database");
}
```

- [ ] **Step 2: Implement `js/views/reportsView.js`**

Financial summary table, income vs expense breakdowns, "Eksport qilish (CSV)", **"Baza zaxirasini yuklab olish (.sqlite)"** button triggering browser file download, and **"Baza zaxirasini tiklash"** file input restoring database.

- [ ] **Step 3: Run test to verify it passes**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add js/views/reportsView.js tests/test_suite.js
git commit -m "feat: implement finance reports and SQLite database export/import"
```

---

### Task 12: Main SPA Shell, Navigation & Router Integration

**Files:**
- Create: `index.html`
- Create: `js/app.js`

**Interfaces:**
- Consumes: All views, `Auth`, `DB`
- Produces:
  - `App.navigate(viewName: string): void`
  - `App.showToast(message: string, type: 'success' | 'error' | 'warning'): void`
  - `App.init(): Promise<void>`

- [ ] **Step 1: Implement `index.html`**

Set up responsive meta tags, SEO title, favicon, navbar with logo, role switcher dropdown (Mijoz / Menejer / Admin), language selector, `#main-content` container, `#modal-container`, `#toast-container`.

- [ ] **Step 2: Implement `js/app.js`**

Initialize SQLite DB, set up client/admin navigation handlers, role switching hook that re-renders views based on RBAC, toast notification trigger.

- [ ] **Step 3: Commit**

```bash
git add index.html js/app.js
git commit -m "feat: assemble main SPA shell, navigation router, and role switching controller"
```

---

### Task 13: End-to-End Automated Test Suite & Browser Verification

**Files:**
- Create: `tests/run_tests.html`
- Modify: `tests/test_suite.js`

**Interfaces:**
- Produces: Complete automated test runner and report

- [ ] **Step 1: Implement `tests/run_tests.html`**

Visual in-browser test runner displaying test status (green/red badges, execution times, error stack traces).

- [ ] **Step 2: Run test suite via local server and verify all tests pass**

Run and verify that all test suites (DB, Schema, Auth, ClientView, Booking, Handover, CRM, Finance, Export) execute with 100% pass rate.

- [ ] **Step 3: Launch browser subagent to verify UI in browser**

Test customer booking flow, switch role to Admin, review dashboard KPIs, add car, approve booking, download `.sqlite` file.

- [ ] **Step 4: Commit**

```bash
git add tests/run_tests.html tests/test_suite.js
git commit -m "test: add automated test runner and verify full system functionality"
```
