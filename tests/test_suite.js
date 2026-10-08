// tests/test_suite.js
// Automated test suite for RentCar serverless SQLite platform

const isNode = typeof window === 'undefined';
let fs, path, assert;

if (isNode) {
  fs = require('fs');
  path = require('path');
  assert = require('assert');
  global.DB = require('../js/db.js');
  global.Auth = require('../js/auth.js');
  global.ClientView = require('../js/views/clientView.js');
  global.DashboardView = require('../js/views/dashboardView.js');
  global.FleetView = require('../js/views/fleetView.js');
  global.BookingsView = require('../js/views/bookingsView.js');
  global.CrmView = require('../js/views/crmView.js');
  global.ReportsView = require('../js/views/reportsView.js');
  global.App = require('../js/app.js');
} else {
  assert = (cond, msg) => {
    if (!cond) throw new Error(msg || 'Assertion failed');
  };
}

const testResults = [];

async function runTest(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const duration = Date.now() - start;
    testResults.push({ name, status: 'PASS', duration });
    console.log(`✓ PASS: ${name} (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - start;
    testResults.push({ name, status: 'FAIL', duration, error: err.message });
    console.error(`✗ FAIL: ${name} (${duration}ms) - ${err.message}`);
  }
}

async function testDbInitialization() {
  if (typeof DB === 'undefined') {
    throw new Error('DB is not defined');
  }
  await DB.init();
  const users = DB.query("SELECT * FROM users WHERE role = ?", ['admin']);
  assert(users.length > 0, "Admin user must be seeded in database");
  const cars = DB.query("SELECT * FROM cars");
  assert(cars.length >= 6, "At least 6 initial cars must be seeded");
}

async function testLegacyCarImageMigrations() {
  const oldImageUrls = [
    [1, 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'],
    [2, 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80'],
    [3, 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80']
  ];
  oldImageUrls.forEach(([carId, imageUrl]) => {
    DB.exec("UPDATE cars SET image_url = ? WHERE id = ?", [imageUrl, carId]);
  });
  await DB.init(DB.exportDatabase());
  const expectedImages = [
    [1, 'assets/cars/chevrolet-onix-premier.jpg'],
    [2, 'assets/cars/chevrolet-tracker-redline.jpg'],
    [3, 'assets/cars/chevrolet-malibu-2-premier.jpg']
  ];
  expectedImages.forEach(([carId, imageUrl]) => {
    const car = DB.query("SELECT image_url FROM cars WHERE id = ?", [carId])[0];
    assert(car.image_url === imageUrl, `Existing car ${carId} must migrate to its local image`);
  });
}

async function testCarsUseLocalImages() {
  const expectedImages = [
    [1, 'assets/cars/chevrolet-onix-premier.jpg'],
    [2, 'assets/cars/chevrolet-tracker-redline.jpg'],
    [3, 'assets/cars/chevrolet-malibu-2-premier.jpg']
  ];
  expectedImages.forEach(([carId, imageUrl]) => {
    const car = DB.query("SELECT image_url FROM cars WHERE id = ?", [carId])[0];
    const imagePath = path.join(__dirname, '..', imageUrl);
    assert(car.image_url === imageUrl, `Car ${carId} must use its local image asset`);
    assert(fs.existsSync(imagePath), `Image asset must exist for car ${carId}`);
  });
}

async function testCssTokens() {
  if (isNode) {
    const stylesCss = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
    const clientCss = fs.readFileSync(path.join(__dirname, '../css/client.css'), 'utf8');
    const adminCss = fs.readFileSync(path.join(__dirname, '../css/admin.css'), 'utf8');
    assert(stylesCss.includes('--bg-primary'), "styles.css must define --bg-primary");
    assert(stylesCss.includes('.btn-primary'), "styles.css must define .btn-primary");
    assert(stylesCss.includes('.modal-overlay'), "styles.css must define .modal-overlay");
    assert(stylesCss.includes('.toast-container'), "styles.css must define .toast-container");
    assert(clientCss.includes('.hero-search-box'), "client.css must define .hero-search-box");
    assert(clientCss.includes('.car-card'), "client.css must define .car-card");
    assert(adminCss.includes('.admin-sidebar'), "admin.css must define .admin-sidebar");
    assert(adminCss.includes('.kpi-card'), "admin.css must define .kpi-card");
  }
}

async function testAuthRoleSwitch() {
  if (typeof Auth === 'undefined') {
    throw new Error("Auth is not defined");
  }
  Auth.switchRole('admin');
  assert(Auth.getRole() === 'admin', "Current role should be admin");
  Auth.switchRole('client');
  assert(Auth.getRole() === 'client', "Current role should be client");
  
  // Test blacklisted check
  // User 5 Dilshod Raxmatov is blacklisted
  assert(Auth.isBlacklisted(5) === true, "User 5 must be recognized as blacklisted");
  assert(Auth.isBlacklisted(1) === false, "User 1 must not be blacklisted");
}

async function testCarFiltering() {
  if (typeof ClientView === 'undefined') {
    throw new Error("ClientView is not defined");
  }
  const suvCars = ClientView.filterCars({ category: 'SUV' });
  assert(suvCars.length > 0, "Should find at least 1 SUV");
  assert(suvCars.every(c => c.category === 'SUV'), "Filter should only return SUV cars");

  const autoCars = ClientView.filterCars({ transmission: 'Avtomat' });
  assert(autoCars.length > 0, "Should find automatic cars");
  assert(autoCars.every(c => c.transmission === 'Avtomat'), "Filter should only return automatic cars");

  const evCars = ClientView.filterCars({ fuel_type: 'Elektr' });
  assert(evCars.length > 0, "Should find electric cars");
  assert(evCars[0].category === 'Elektromobil', "BYD Song Plus should match");
}

async function testBookingConflictPrevention() {
  if (typeof ClientView === 'undefined') {
    throw new Error("ClientView is not defined");
  }
  // Calculate total: 350000/day * 3 days = 1050000 + KASKO (80000*3=240000) = 1290000
  const calc = ClientView.calculateTotal(350000, 3, ['kasko']);
  assert(calc.days === 3, "Days should be 3");
  assert(calc.totalAmount === 1290000, `Total amount should be 1290000, got ${calc.totalAmount}`);

  // Create a booking
  const res1 = ClientView.submitBooking({
    car_id: 2,
    user_name: 'Test Client',
    phone: '+998901112233',
    passport_no: 'AB1112233',
    license_no: 'CD2223344',
    pickup_location: 'Toshkent Xalqaro Aeroporti',
    return_location: 'Toshkent Xalqaro Aeroporti',
    start_date: '2026-11-01',
    end_date: '2026-11-05',
    services: ['gps'],
    payment_method: 'click'
  });
  assert(res1.success === true, "Booking 1 should succeed: " + res1.error);
  assert(res1.bookingCode && res1.bookingCode.startsWith('RC-'), "Booking code should start with RC-");

  // Overlapping booking for same car should fail
  const res2 = ClientView.submitBooking({
    car_id: 2,
    user_name: 'Another Client',
    phone: '+998909998877',
    start_date: '2026-11-03',
    end_date: '2026-11-07',
    payment_method: 'payme'
  });
  assert(res2.success === false, "Overlapping booking must fail");
  assert(res2.error.includes("band"), "Error should mention car is booked");

  // Booking by blacklisted customer should fail
  const resBlacklist = ClientView.submitBooking({
    car_id: 1,
    phone: '+998971112233', // User 5 is blacklisted
    start_date: '2026-12-01',
    end_date: '2026-12-03',
    payment_method: 'cash'
  });
  assert(resBlacklist.success === false, "Blacklisted customer booking must be rejected");
}

async function testBookingCancellation() {
  if (typeof ClientView === 'undefined') {
    throw new Error("ClientView is not defined");
  }
  const bookings = DB.query("SELECT id FROM bookings WHERE status = 'new' LIMIT 1");
  if (bookings.length > 0) {
    const bId = bookings[0].id;
    const ok = ClientView.cancelBooking(bId);
    assert(ok === true, "Cancellation should succeed");
    const check = DB.query("SELECT status FROM bookings WHERE id = ?", [bId]);
    assert(check[0].status === 'cancelled', "Status must be cancelled");
  }
}

async function testDashboardMetrics() {
  if (typeof DashboardView === 'undefined') {
    throw new Error("DashboardView is not defined");
  }
  const metrics = DashboardView.getMetrics();
  assert(metrics.totalCars >= 6, "Total cars should be >= 6");
  assert(typeof metrics.revenue === 'number', "Revenue should be a number");
  assert(metrics.availableCars >= 1, "There should be available cars");
  assert(Array.isArray(metrics.todayReturns), "todayReturns must be an array");
}

async function testFleetCrud() {
  if (typeof FleetView === 'undefined') {
    throw new Error("FleetView is not defined");
  }
  const newId = FleetView.addCar({
    make: 'Chevrolet',
    model: 'Cobalt Style',
    year: 2024,
    category: 'Ekonom',
    transmission: 'Avtomat',
    fuel_type: 'Benzin',
    seats: 5,
    daily_rate: 320000,
    deposit_amount: 1500000,
    plate_number: '01Z999ZZ',
    image_url: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341',
    features: ['Konditsioner', 'Bluetooth']
  });
  assert(newId > 0, "New car should have valid ID");

  FleetView.updateCarStatus(newId, 'maintenance');
  const car = DB.query("SELECT status FROM cars WHERE id = ?", [newId])[0];
  assert(car.status === 'maintenance', "Status should update to maintenance");

  FleetView.deleteCar(newId);
  const deletedCar = DB.query("SELECT status FROM cars WHERE id = ?", [newId])[0];
  assert(deletedCar.status === 'archived', "Deleted car status should be archived");
}

async function testBookingWorkflowAndInspection() {
  if (typeof BookingsView === 'undefined') {
    throw new Error("BookingsView is not defined");
  }
  // Create a dedicated booking for this test
  const res = ClientView.submitBooking({
    car_id: 3,
    user_name: 'Workflow Client',
    phone: '+998909876543',
    start_date: '2026-11-20',
    end_date: '2026-11-25',
    payment_method: 'click'
  });
  assert(res.success === true, "Should create booking successfully");
  const bId = res.bookingId;

  BookingsView.updateBookingStatus(bId, 'confirmed');
  let check = DB.query("SELECT status FROM bookings WHERE id = ?", [bId])[0];
  assert(check.status === 'confirmed', "Booking status should be confirmed");

  BookingsView.recordInspection({
    booking_id: bId,
    inspection_type: 'pickup',
    fuel_level: 100,
    mileage: 15400,
    damages_note: 'Old bamperda mayda tirnalgan joyi bor'
  });
  const insp = DB.query("SELECT * FROM handover_inspections WHERE booking_id = ? AND inspection_type = 'pickup'", [bId]);
  assert(insp.length > 0, "Handover inspection act should be recorded in SQLite");
  assert(insp[0].fuel_level === 100, "Fuel level should match");
}

async function testCrmBlacklist() {
  if (typeof CrmView === 'undefined') {
    throw new Error("CrmView is not defined");
  }
  const user = DB.query("SELECT id, status FROM users WHERE role = 'client' LIMIT 1")[0];
  const oldStatus = user.status;
  const newStatus = CrmView.toggleBlacklist(user.id);
  assert(newStatus === (oldStatus === 'active' ? 'blacklisted' : 'active'), "Status must be toggled");

  const check = DB.query("SELECT status FROM users WHERE id = ?", [user.id])[0];
  assert(check.status === newStatus, "DB status should match toggled status");

  // Revert
  CrmView.toggleBlacklist(user.id);
}

async function testFinancialSummaryAndExport() {
  if (typeof ReportsView === 'undefined') {
    throw new Error("ReportsView is not defined");
  }
  const summary = ReportsView.getFinancialSummary();
  assert(typeof summary.totalIncome === 'number', "Total income should be number");
  assert(typeof summary.totalExpense === 'number', "Total expense should be number");
  assert(summary.netProfit === summary.totalIncome - summary.totalExpense, "Net profit should equal income - expense");

  const csv = ReportsView.exportToCsv();
  assert(csv.includes("ID,Turi,Kategoriya,Summa"), "CSV should contain proper headers");

  const binary = DB.exportDatabase();
  assert(binary instanceof Uint8Array, "Exported DB must be Uint8Array");
  assert(binary.length > 0, "Exported DB must not be empty");
  const headerStr = String.fromCharCode(...binary.slice(0, 15));
  assert(headerStr === "SQLite format 3", "Must be a valid SQLite 3 database");
}

async function testAppRouter() {
  if (typeof App === 'undefined') {
    throw new Error("App is not defined");
  }
  assert(typeof App.navigate === 'function', "App.navigate must be a function");
  assert(typeof App.showToast === 'function', "App.showToast must be a function");
  assert(typeof App.init === 'function', "App.init must be a function");
}

async function testMercedesRemovedAndVideosMappedByName() {
  const merc = DB.query("SELECT * FROM cars WHERE LOWER(make) LIKE '%mercedes%' OR LOWER(model) LIKE '%mercedes%'");
  assert(merc.length === 0, "Mercedes must be completely removed from cars table");

  assert(ClientView.getCarVideo({ make: 'Chevrolet', model: 'Onix' }).includes('onix.mp4'), "Onix video must match by name");
  assert(ClientView.getCarVideo({ make: 'Chevrolet', model: 'Tracker' }).includes('tracer.mp4'), "Tracker video must match by name");
  assert(ClientView.getCarVideo({ make: 'Chevrolet', model: 'Malibu' }).includes('malibu.mp4'), "Malibu video must match by name");
  assert(ClientView.getCarVideo({ make: 'BYD', model: 'Song Plus Champion' }).includes('chempion.mp4'), "BYD Song Champion video must match by name");
  assert(ClientView.getCarVideo({ make: 'BYD', model: 'Yuan Up' }).toLowerCase().includes('yaun'), "Yuan Up video must match by name");
  assert(ClientView.getCarVideo({ make: 'Lixiang', model: 'L9' }).toLowerCase().includes('li'), "Lixiang L9 video must match by name");
  assert(ClientView.getCarVideo({ make: 'Toyota', model: 'Land Cruiser 200' }).toLowerCase().includes('cruzer'), "Land Cruiser video must match by name");
  assert(ClientView.getCarVideo({ make: 'Chevrolet', model: 'Gentra' }).includes('jentro.mp4'), "Gentra video must match by name");
  assert(ClientView.getCarVideo({ make: 'Zeekr', model: '9X Sport' }).toLowerCase().includes('zeekr'), "Zeekr video must match by name");
}

async function runAll() {
  console.log("=== RentCar Test Suite ===");
  await runTest("testDbInitialization", testDbInitialization);
  await runTest("testLegacyCarImageMigrations", testLegacyCarImageMigrations);
  await runTest("testCarsUseLocalImages", testCarsUseLocalImages);
  await runTest("testCssTokens", testCssTokens);
  await runTest("testAuthRoleSwitch", testAuthRoleSwitch);
  await runTest("testCarFiltering", testCarFiltering);
  await runTest("testBookingConflictPrevention", testBookingConflictPrevention);
  await runTest("testBookingCancellation", testBookingCancellation);
  await runTest("testDashboardMetrics", testDashboardMetrics);
  await runTest("testFleetCrud", testFleetCrud);
  await runTest("testBookingWorkflowAndInspection", testBookingWorkflowAndInspection);
  await runTest("testCrmBlacklist", testCrmBlacklist);
  await runTest("testFinancialSummaryAndExport", testFinancialSummaryAndExport);
  await runTest("testAppRouter", testAppRouter);
  await runTest("testMercedesRemovedAndVideosMappedByName", testMercedesRemovedAndVideosMappedByName);
  
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const total = testResults.length;
  console.log(`\nResults: ${passed}/${total} passed`);
  if (isNode && passed !== total) {
    process.exit(1);
  }
}

if (isNode) {
  runAll();
}

if (typeof module !== 'undefined') {
  module.exports = { runTest, runAll, testResults };
}
