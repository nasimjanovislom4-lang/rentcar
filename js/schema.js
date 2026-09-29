// js/schema.js
// SQLite DDL Schema and Initial Seed Data for RentCar platform

const SCHEMA = {
  ddl: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      role TEXT CHECK(role IN ('client', 'manager', 'admin')) DEFAULT 'client',
      passport_no TEXT,
      license_no TEXT,
      status TEXT CHECK(status IN ('active', 'blacklisted')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      make TEXT NOT NULL,
      model TEXT NOT NULL,
      year INTEGER NOT NULL,
      category TEXT CHECK(category IN ('Ekonom', 'Biznes', 'SUV', 'Premium', 'Elektromobil')) NOT NULL,
      transmission TEXT CHECK(transmission IN ('Avtomat', 'Mexanika')) NOT NULL,
      fuel_type TEXT CHECK(fuel_type IN ('Benzin', 'Elektr', 'Gibrid', 'Gaz')) NOT NULL,
      seats INTEGER DEFAULT 5,
      daily_rate REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      status TEXT CHECK(status IN ('available', 'rented', 'maintenance', 'washing', 'archived')) DEFAULT 'available',
      mileage INTEGER DEFAULT 0,
      plate_number TEXT UNIQUE NOT NULL,
      image_url TEXT NOT NULL,
      features_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      car_id INTEGER NOT NULL REFERENCES cars(id),
      pickup_location TEXT NOT NULL,
      return_location TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      total_days INTEGER NOT NULL,
      daily_rate REAL NOT NULL,
      additional_services_json TEXT,
      total_amount REAL NOT NULL,
      deposit_amount REAL NOT NULL,
      status TEXT CHECK(status IN ('new', 'confirmed', 'picked_up', 'completed', 'cancelled')) DEFAULT 'new',
      payment_method TEXT CHECK(payment_method IN ('click', 'payme', 'uzum', 'cash', 'card')) NOT NULL,
      payment_status TEXT CHECK(payment_status IN ('paid', 'pending', 'refunded')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS handover_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NOT NULL REFERENCES bookings(id),
      inspection_type TEXT CHECK(inspection_type IN ('pickup', 'return')) NOT NULL,
      fuel_level INTEGER NOT NULL,
      mileage INTEGER NOT NULL,
      damages_note TEXT,
      inspected_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS financial_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id INTEGER NULL REFERENCES bookings(id),
      type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `,

  seedSql: `
    -- Users
    INSERT INTO users (id, full_name, phone, role, passport_no, license_no, status) VALUES
    (1, 'Alisher Komilov', '+998901234567', 'admin', 'AA1234567', 'AB9876543', 'active'),
    (2, 'Rustam Shokirov', '+998907654321', 'manager', 'AB2345678', 'BC8765432', 'active'),
    (3, 'Jasur Bekmirzayev', '+998912345678', 'client', 'AC3456789', 'CD7654321', 'active'),
    (4, 'Sanjar Qodirov', '+998935554433', 'client', 'AD4567890', 'DE6543210', 'active'),
    (5, 'Dilshod Raxmatov', '+998971112233', 'client', 'AE5678901', 'EF5432109', 'blacklisted');

    -- Cars
    INSERT INTO cars (id, make, model, year, category, transmission, fuel_type, seats, daily_rate, deposit_amount, status, mileage, plate_number, image_url, features_json) VALUES
    (1, 'Chevrolet', 'Onix Premier', 2024, 'Ekonom', 'Avtomat', 'Benzin', 5, 350000, 1500000, 'available', 14200, '01A111AA', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', '["Konditsioner", "Sensor ekran", "Bluetooth", "Parktronik"]'),
    (2, 'Chevrolet', 'Tracker Redline', 2023, 'SUV', 'Avtomat', 'Benzin', 5, 450000, 2000000, 'available', 28500, '01B222BB', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', '["Konditsioner", "Panorama lyuk", "Kruiz-kontrol", "Kamera 360"]'),
    (3, 'Chevrolet', 'Malibu 2 Premier', 2023, 'Biznes', 'Avtomat', 'Benzin', 5, 600000, 3000000, 'rented', 35000, '01C333CC', 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80', '["Charm salon", "Ventilyatsiya", "Boose audio", "LED optika"]'),
    (4, 'BYD', 'Song Plus Champion EV', 2024, 'Elektromobil', 'Avtomat', 'Elektr', 5, 750000, 3500000, 'available', 9800, '01E444EE', 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80', '["Elektr yurish 520km", "Avtopilot", "Simsiz quvvatlash", "Tezkor zaryad"]'),
    (5, 'Kia', 'K5 GT-Line', 2023, 'Biznes', 'Avtomat', 'Benzin', 5, 650000, 3000000, 'available', 22100, '01K555KK', 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80', '["Sport rejim", "Panorama tom", "Harman Kardon", "Head-Up Display"]'),
    (6, 'Mercedes-Benz', 'E-Class AMG Line', 2023, 'Premium', 'Avtomat', 'Benzin', 5, 1400000, 5000000, 'maintenance', 19400, '01M777MM', 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=800&q=80', '["VIP servis", "Burmester audio", "Pnevmo-podveska", "Haydovchi bilan/siz"]');

    -- Bookings
    INSERT INTO bookings (id, booking_code, user_id, car_id, pickup_location, return_location, start_date, end_date, total_days, daily_rate, additional_services_json, total_amount, deposit_amount, status, payment_method, payment_status, created_at) VALUES
    (1, 'RC-2026-1001', 3, 3, 'Toshkent Xalqaro Aeroporti', 'Toshkent Xalqaro Aeroporti', '2026-09-28', '2026-10-02', 4, 600000, '["KASKO sug''urta", "GPS navigator"]', 2720000, 3000000, 'picked_up', 'click', 'paid', '2026-09-27 10:15:00'),
    (2, 'RC-2026-1002', 4, 1, 'Markaz (Amir Temur xiyoboni)', 'Markaz (Amir Temur xiyoboni)', '2026-09-20', '2026-09-23', 3, 350000, '["Bolalar o''rindig''i"]', 1140000, 1500000, 'completed', 'payme', 'paid', '2026-09-19 14:20:00');

    -- Handover inspections
    INSERT INTO handover_inspections (id, booking_id, inspection_type, fuel_level, mileage, damages_note, inspected_by) VALUES
    (1, 1, 'pickup', 100, 34950, 'Mashina toza, o''ng orqa eshikda 1 sm nuqta bor', 2),
    (2, 2, 'pickup', 90, 14100, 'Nuqsonsiz topshirildi', 2),
    (3, 2, 'return', 90, 14350, 'Hech qanday yangi shikastlanish yo''q, toza qabul qilindi', 2);

    -- Financial transactions
    INSERT INTO financial_transactions (id, booking_id, type, category, amount, payment_method, note, created_at) VALUES
    (1, 1, 'income', 'ijara_tushumi', 2720000, 'click', 'RC-2026-1001 buyurtmasi uchun ijara to''lovi', '2026-09-27 10:20:00'),
    (2, 2, 'income', 'ijara_tushumi', 1140000, 'payme', 'RC-2026-1002 buyurtmasi uchun ijara to''lovi', '2026-09-19 14:25:00'),
    (3, NULL, 'expense', 'tamirlash', 450000, 'cash', 'Mercedes E-Class moy va filtr almashtirish', '2026-09-25 16:00:00');
  `
};

if (typeof module !== 'undefined') {
  module.exports = SCHEMA;
}
