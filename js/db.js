// js/db.js
// SQLite WASM database management and IndexedDB persistence layer

const isNodeEnv = typeof window === 'undefined';

const DB = {
  dbInstance: null,
  SQL: null,
  dbName: 'RentCarDB',
  storeName: 'sqlite_store',
  keyName: 'database_binary',

  async init(customBinary = null) {
    if (this.dbInstance && !customBinary) return;

    // Load SQL.js WASM
    if (!this.SQL) {
      if (isNodeEnv) {
        const initSqlJs = require('./vendor/sql-wasm.js');
        const fs = require('fs');
        const path = require('path');
        const wasmBinary = fs.readFileSync(path.join(__dirname, 'vendor/sql-wasm.wasm'));
        this.SQL = await initSqlJs({ wasmBinary });
      } else {
        if (typeof window.initSqlJs !== 'function') {
          throw new Error('initSqlJs is not loaded in window');
        }
        this.SQL = await window.initSqlJs({
          locateFile: file => `js/vendor/${file}`
        });
      }
    }

    let binary = customBinary;
    if (!binary && !isNodeEnv) {
      binary = await this.loadFromIndexedDB();
    }

    if (binary && binary.length > 0) {
      try {
        this.dbInstance = new this.SQL.Database(binary);
        console.log("SQLite database restored from storage.");
      } catch (err) {
        console.warn("Failed to restore saved database, reinitializing fresh:", err);
        this.dbInstance = new this.SQL.Database();
        this.initSchemaAndSeed();
      }
    } else {
      this.dbInstance = new this.SQL.Database();
      this.initSchemaAndSeed();
    }

    if (this.migrateLegacyCarImages()) {
      await this.persist();
    }
  },

  migrateLegacyCarImages() {
    let migrated = false;

    // 1. Purge Mercedes if present from older database versions
    try {
      this.dbInstance.run("DELETE FROM bookings WHERE car_id IN (SELECT id FROM cars WHERE LOWER(make) LIKE '%mercedes%' OR LOWER(model) LIKE '%mercedes%')");
      this.dbInstance.run("DELETE FROM cars WHERE LOWER(make) LIKE '%mercedes%' OR LOWER(model) LIKE '%mercedes%'");
      if (this.dbInstance.getRowsModified() > 0) migrated = true;
      this.dbInstance.run("UPDATE financial_transactions SET note = 'Chevrolet Tracker moy va filtr almashtirish' WHERE note LIKE '%Mercedes%'");
    } catch (e) {
      console.warn("Purge Mercedes warning:", e);
    }

    // 2. Ensure Gentra and Zeekr exist in fleet
    try {
      const gentra = this.query("SELECT id FROM cars WHERE LOWER(model) LIKE '%gentra%'");
      if (!gentra || gentra.length === 0) {
        this.dbInstance.run(`
          INSERT INTO cars (id, make, model, year, category, transmission, fuel_type, seats, daily_rate, deposit_amount, status, mileage, plate_number, image_url, features_json)
          VALUES (10, 'Chevrolet', 'Gentra Elegant', 2023, 'Ekonom', 'Avtomat', 'Benzin', 5, 300000, 1500000, 'available', 32000, '01G999GG', 'assets/cars/Gentro.jpg', '["Konditsioner", "MagiCar pult", "Gaz/Benzin", "Lyuk"]')
        `);
        migrated = true;
      }
      const zeekr = this.query("SELECT id FROM cars WHERE LOWER(make) LIKE '%zeekr%'");
      if (!zeekr || zeekr.length === 0) {
        this.dbInstance.run(`
          INSERT INTO cars (id, make, model, year, category, transmission, fuel_type, seats, daily_rate, deposit_amount, status, mileage, plate_number, image_url, features_json)
          VALUES (11, 'Zeekr', '9X Sport', 2024, 'Premium', 'Avtomat', 'Elektr', 5, 1200000, 5000000, 'available', 6400, '01Z888ZZ', 'assets/cars/zeekr 9X.jpg', '["Elektr yurish 656km", "Yamaha audio", "Pnevmo-podveska", "0-100 3.8s"]')
        `);
        migrated = true;
      }
    } catch (e) {
      console.warn("Fleet addition warning:", e);
    }

    // 3. Migrate legacy image URLs
    const migrations = [
      { carId: 1, oldUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', newUrl: 'assets/cars/chevrolet-onix-premier.jpg' },
      { carId: 1, oldUrl: 'assets/cars/Chevrolet Onix Premier.jpg', newUrl: 'assets/cars/chevrolet-onix-premier.jpg' },
      { carId: 2, oldUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', newUrl: 'assets/cars/chevrolet-tracker-redline.jpg' },
      { carId: 3, oldUrl: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80', newUrl: 'assets/cars/chevrolet-malibu-2-premier.jpg' },
      { carId: 3, oldUrl: 'assets/cars/Chevrolet Malibu 2 Premier.jpg', newUrl: 'assets/cars/chevrolet-malibu-2-premier.jpg' },
      { carId: 4, oldUrl: 'assets/cars/BYD Song Plus Champion EV.jpg', newUrl: 'assets/cars/byd-song-plus-champion-ev.jpg' },
      { carId: 5, oldUrl: 'assets/cars/Kia K5 GT-Line.jpg', newUrl: 'assets/cars/kia-k5-gt-line.jpg' },
      { carId: 6, oldUrl: 'assets/cars/byd yuan up black.jpg', newUrl: 'assets/cars/byd-yuan-up-black.jpg' },
      { carId: 7, oldUrl: 'assets/cars/Leapmotor C16.jpg', newUrl: 'assets/cars/leapmotor-c16.jpg' },
      { carId: 8, oldUrl: 'assets/cars/Lixiang L9 Max.jpg', newUrl: 'assets/cars/lixiang-l9-max.jpg' },
      { carId: 9, oldUrl: 'assets/cars/Toyota Land Cruiser 200.jpg', newUrl: 'assets/cars/toyota-land-cruiser-200.jpg' }
    ];

    migrations.forEach(({ carId, oldUrl, newUrl }) => {
      this.dbInstance.run(
        "UPDATE cars SET image_url = ? WHERE id = ? AND image_url = ?",
        [newUrl, carId, oldUrl]
      );
      migrated = migrated || this.dbInstance.getRowsModified() > 0;
    });

    return migrated;
  },

  initSchemaAndSeed() {
    const schema = isNodeEnv ? require('./schema.js') : (window.SCHEMA || SCHEMA);
    if (!schema) {
      throw new Error('SCHEMA is not defined');
    }
    this.dbInstance.run(schema.ddl);
    this.dbInstance.run(schema.seedSql);
    this.persist();
  },

  query(sql, params = []) {
    if (!this.dbInstance) throw new Error("Database not initialized. Call DB.init() first.");
    const stmt = this.dbInstance.prepare(sql);
    if (params && params.length > 0) {
      stmt.bind(params);
    }
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  },

  exec(sql, params = []) {
    if (!this.dbInstance) throw new Error("Database not initialized. Call DB.init() first.");
    if (params && params.length > 0) {
      const stmt = this.dbInstance.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
    } else {
      this.dbInstance.run(sql);
    }
    this.persist();
  },

  exportDatabase() {
    if (!this.dbInstance) throw new Error("Database not initialized.");
    return this.dbInstance.export();
  },

  async importDatabase(data) {
    if (!this.SQL) await this.init();
    // Verify SQLite 3 header
    const headerStr = String.fromCharCode(...data.slice(0, 15));
    if (!headerStr.startsWith("SQLite format 3")) {
      throw new Error("Invalid SQLite 3 database file header");
    }
    this.dbInstance = new this.SQL.Database(data);
    this.migrateLegacyCarImages();
    await this.persist();
  },

  async resetToDefault() {
    this.dbInstance = new this.SQL.Database();
    this.initSchemaAndSeed();
    await this.persist();
  },

  async persist() {
    if (isNodeEnv || !this.dbInstance) return;
    try {
      const binary = this.dbInstance.export();
      await this.saveToIndexedDB(binary);
    } catch (err) {
      console.error("IndexedDB persistence error:", err);
    }
  },

  // IndexedDB helpers
  openIDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveToIndexedDB(binary) {
    const idb = await this.openIDB();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      store.put(binary, this.keyName);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async loadFromIndexedDB() {
    try {
      const idb = await this.openIDB();
      return new Promise((resolve, reject) => {
        const tx = idb.transaction(this.storeName, 'readonly');
        const store = tx.objectStore(this.storeName);
        const req = store.get(this.keyName);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = DB;
}
if (typeof window !== 'undefined') {
  window.DB = DB;
}
