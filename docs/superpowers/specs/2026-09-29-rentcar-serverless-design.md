# RentCar – Serverless (HTML/CSS/JS + SQLite WASM) Arxitektura va Tizim Dizayni

- **Loyiha nomi:** RentCar – Avtomobillarni ijaraga berish va boshqarish platformasi
- **Sana:** 2026-09-29
- **Holati:** Tasdiqlangan (Approved Design)
- **Arxitektura turi:** Serverless Single Page Application (SPA) with Client-Side SQLite (sql.js / WebAssembly + IndexedDB)

---

## 1. Umumiy Maqsad va Talablar

Ushbu hujjat [TZ.txt](file:///c:/RentCar/TZ.txt) talablariga asoslanib, tashqi backend serverlarisiz (serverless), to'liq brauzerda ishlaydigan zamonaviy va professional avtomobil ijarasi tizimini loyihalashtiradi.

### 1.1. Asosiy maqsadlar
1. **Mijozlar tajribasi:** Avtomobillarni qidirish, saralash, 3 bosqichda tezkor band qilish, to'lov simulyatsiyasi va buyurtmalar tarixini kuzatish.
2. **Kompaniya boshqaruvi (Admin & Menejer):** Real-vaqt dashboard ko'rsatkichlari, avtopark boshqaruvi (Fleet CRUD va holatlar), buyurtmalar kanban doskasi, mijozlar CRM (va qora ro'yxat) hamda moliyaviy hisobotlar.
3. **Rol almashtirgich (RBAC):** Istalgan vaqtda bitta tugma orqali Mijoz, Menejer yoki Administrator roli o'rtasida o'tish imkoniyati.
4. **Haqiqiy relyatsion ma'lumotlar bazasi (SQLite):** SQL.js WebAssembly dvigateli yordamida brauzerda haqiqiy SQLite fayl bilan ishlash, har bir tranzaksiyani avtomatik IndexedDB ga sinxronlash, hamda `.sqlite` zaxira faylini yuklab olish va tiklash.

---

## 2. Tizim Arxitekturasi va Texnologik Stek

### 2.1. Texnologiyalar
* **Frontend:** Semantic HTML5, Modular Vanilla ES6 JavaScript.
* **Dizayn & Stillar:** Maxsus ishlab chiqilgan Premium CSS3 Dizayn tizimi (CSS variables, responsive flexbox/grid, glassmorphism, zamonaviy mikromatsiyalar, toza shriftlar).
* **Ma'lumotlar bazasi:** `sql.js` (rasmiy SQLite WebAssembly dvigateli) + brauzer `IndexedDB` saqlash qatlami.
* **Dependencies:** Lokal `sql-wasm.js` va `sql-wasm.wasm` (tashqi internetga qaramlik yo'q).

### 2.2. Loyiha fayllar tuzilmasi
```
c:\RentCar\
├── index.html                  # Yagona kirish nuqtasi (SPA struktura)
├── css\
│   ├── styles.css              # Asosiy dizayn tizimi, ranglar, shriftlar, modallar va toastlar
│   ├── client.css              # Mijoz portali stillari (katalog, qidiruv paneli, booking wizard)
│   └── admin.css               # Admin/Menejer portali stillari (sidebar, dashboard, kanban, jadvallar)
├── js\
│   ├── db.js                   # sql.js WASM initsializatsiyasi, IndexedDB persistence, query yordamchilari
│   ├── schema.js               # SQLite DDL jadvallari va O'zbekiston bozoriga xos dastlabki ma'lumotlar (Seed)
│   ├── auth.js                 # RBAC (Mijoz, Menejer, Administrator) holati va seans boshqaruvi
│   ├── app.js                  # Asosiy router, sahifalar almashinuvi, event listeners va toast bildirishnomalar
│   ├── views\
│   │   ├── clientView.js       # Avtomobillar qidiruvi, filtrlar, 3 bosqichli bron qilish va profil
│   │   ├── dashboardView.js    # Boshqaruv paneli (avtopark ko'rsatkichlari, tushumlar, statistikalar)
│   │   ├── fleetView.js        # Avtopark boshqaruvi (avtomobil qo'shish/tahrirlash/o'chirish, TO muddatlari)
│   │   ├── bookingsView.js     # Buyurtmalar kanban doskasi, qabul/topshirish aktlari
│   │   ├── crmView.js          # Mijozlar bazasi, litsenziya/pasport tekshiruvi, Qora ro'yxat
│   │   └── reportsView.js      # Moliyaviy balans, tranzaksiyalar, .sqlite yuklab olish/tiklash, CSV eksport
│   └── vendor\
│       ├── sql-wasm.js         # SQLite WebAssembly loader
│       └── sql-wasm.wasm       # SQLite WebAssembly binary
└── tests\
    └── test_suite.js           # Baza operatsiyalari, bron to'qnashuvlari va biznes logikani avtomatik testlash
```

---

## 3. SQLite Relyatsion Ma'lumotlar Bazasi Sxemasi

### 3.1. `users` jadvali
```sql
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
```

### 3.2. `cars` jadvali
```sql
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
```

### 3.3. `bookings` jadvali
```sql
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
```

### 3.4. `handover_inspections` jadvali
```sql
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
```

### 3.5. `financial_transactions` jadvali
```sql
CREATE TABLE IF NOT EXISTS financial_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER REFERENCES bookings(id),
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_method TEXT NOT NULL,
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 4. Dastlabki Ma'lumotlar (Seed Data)

Tizim quyidagi haqiqiy ma'lumotlar bilan ishga tushadi:
* **Foydalanuvchilar:**
  * Administrator: Alisher Komilov (+998 90 123-45-67, admin)
  * Menejer: Rustam Shokirov (+998 90 765-43-21, manager)
  * Mijoz: Jasur Bekmirzayev (+998 91 234-56-78, client)
* **Avtopark (O'zbekiston bozori uchun mashhur modellar):**
  1. Chevrolet Onix 2024 (Ekonom, Avtomat, Benzin, 350,000 UZS/kun)
  2. Chevrolet Tracker 2023 (SUV, Avtomat, Benzin, 450,000 UZS/kun)
  3. Chevrolet Malibu 2 (Biznes, Avtomat, Benzin, 600,000 UZS/kun)
  4. BYD Song Plus EV 2024 (Elektromobil, Avtomat, Elektr, 750,000 UZS/kun)
  5. Kia K5 2023 (Biznes, Avtomat, Benzin, 650,000 UZS/kun)
  6. Mercedes-Benz E-Class 2023 (Premium, Avtomat, Benzin, 1,400,000 UZS/kun)
* **Buyurtmalar va Moliya:** Tizim birinchi ochilganida dashboard bo'sh ko'rinmasligi uchun bir nechta aktiv va yakunlangan test buyurtmalar hamda moliyaviy tushumlar kiritiladi.

---

## 5. Foydalanuvchi Oqimlari va Funksional Imkoniyatlar

### 5.1. Mijoz Portali (Client Journey)
1. **Qidiruv va Saralash:** Shahar/filial (Toshkent Aeroporti, Chilonzor, Yunusobod, Markaz), olish va qaytarish sanalarini tanlash.
2. **Filtrlar:** Kategoriya (Ekonom, Biznes, SUV, Premium, EV), Uzatma qutisi (Avtomat, Mexanika), Yoqilg'i turi, Narx diapazoni.
3. **Avtomobil kartochkasi:** Avtomobil surati, yili, uzatmasi, o'rindiqlar soni, sutkalik narx va garov depoziti.
4. **3 bosqichli Bron qilish modali (Booking Wizard):**
   * *1-qadam (Parametrlar):* Muddatni tekshirish, qo'shimcha xizmatlarni tanlash (KASKO sug'urta, Bolalar o'rindig'i, GPS navigator). Kunlar va umumiy summa avtomatik qayta hisoblanadi.
   * *2-qadam (Mijoz ma'lumotlari):* Ism, telefon, pasport va prava raqamlari.
   * *3-qadam (To'lov):* To'lov tizimi (Click, Payme, Uzum Pay, Naqd) tanlanadi, simulyatsiya qilingan to'lov amalga oshiriladi va buyurtma tasdiqlanadi.
5. **Mening buyurtmalarim:** Foydalanuvchi buyurtma kodi yoki telefon orqali barcha buyurtmalarini ko'rishi, statusini tekshirishi yoki bekor qilishi mumkin.

### 5.2. Admin & Menejer Portali (Management Flow)
1. **Dashboard:**
   * Jami, Bo'sh, Band va Ta'mirdagi mashinalar soni.
   * Bugungi topshirish va qabul qilishlar ro'yxati.
   * Oylik va umumiy daromad statistikasi.
2. **Avtopark boshqaruvi (Fleet Management):**
   * Yangi mashina qo'shish, tahrirlash, o'chirish.
   * Mashina holatini bir bosishda almashtirish: *Bo'sh*, *Band*, *Ta'mirda*, *Yuvishda*.
   * Probeg va texnik xizmat ko'rsatish (TO) ko'rsatkichlari.
3. **Buyurtmalar boshqaruvi:**
   * Statuslar bo'yicha saralash va boshqarish: Yangi -> Tasdiqlangan -> Mashina berildi -> Yakunlandi -> Bekor qilindi.
   * Avtomobilni topshirish va qabul qilish akti (yoqilg'i foizi, probeg, tirnalgan joylar qaydi).
4. **Mijozlar bazasi (CRM):**
   * Mijozlar ro'yxati, ijaralar soni, jami sarflangan summa.
   * Qora ro'yxat (Blacklist)ga qo'shish yoki undan chiqarish.
5. **Moliya & Baza Eksporti:**
   * Tushumlar va xarajatlar ro'yxati, sof foyda hisobi.
   * **"SQLite bazasini yuklab olish (.sqlite)"** tugmasi — har qanday tashqi SQLite dasturida ochilishi mumkin.
   * **"Baza zaxirasini yuklash"** tugmasi — avval saqlangan `.sqlite` faylni qayta tiklash.
   * CSV formatida hisobotlarni yuklab olish.

---

## 6. Xavfsizlik, Xatoliklarni Boshqarish va Validatsiya

1. **Bron to'qnashuvi himoyasi (Conflict Prevention):** Avtomobil tanlangan sanalar oralig'ida allaqachon band qilingan bo'lsa, tizim buyurtmani rad etadi.
2. **Blacklist filtri:** Qora ro'yxatdagi mijozlar yangi buyurtma bera olmaydi.
3. **Validatsiyalar:** Sana ketma-ketligi (tugash sanasi boshlanish sanasidan keyin bo'lishi), telefon raqami formati va majburiy maydonlar qat'iy tekshiriladi.
4. **Toast xabarlar tizimi:** Barcha muvaffaqiyatli yoki xatolik amallari uchun chiroyli animatsiyali xabarnomalar beriladi.

---

## 7. Testlash Strategiyasi

1. **Avtomatlashtirilgan test moduli (`tests/test_suite.js`):**
   * SQLite sxema jadvallari yaratilishi testi.
   * Dastlabki ma'lumotlar (Seed) mavjudligi testi.
   * Yangi buyurtma yaratish va mablag'lar to'g'ri hisoblanishi testi.
   * Vaqt bo'yicha bron to'qnashuvi aniqlanishi testi.
   * Avtomobil holati o'zgarishi va moliya kiritmasi testi.
   * IndexedDB sinxronizatsiyasi va zaxira nusxa tekshiruvi.
2. **Qo'lda va brauzer orqali testlash:**
   * Brauzerda mijoz sifatida qidiruv va to'liq bron qilish.
   * Admin panelga o'tib, buyurtmani tasdiqlash va topshirish aktini tuzish.
   * Baza faylini eksport qilish.
