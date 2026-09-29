// tests/test_suite.js
// Automated test suite for RentCar serverless SQLite platform

const isNode = typeof window === 'undefined';
let fs, path, assert;

if (isNode) {
  fs = require('fs');
  path = require('path');
  assert = require('assert');
  global.DB = require('../js/db.js');
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

async function runAll() {
  console.log("=== RentCar Test Suite ===");
  await runTest("testDbInitialization", testDbInitialization);
  await runTest("testCssTokens", testCssTokens);
  
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
