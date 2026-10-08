// js/excelHelper.js
// Universal Excel (.xlsx & .csv) Export & Import Engine for RentCar Admin

const isNodeExcel = typeof window === 'undefined';

const ExcelHelper = {
  // Check if SheetJS XLSX library is loaded
  isXlsxAvailable() {
    return typeof window !== 'undefined' && typeof window.XLSX !== 'undefined';
  },

  // Generic download helper for Blob / binary
  downloadBlob(blob, filename) {
    if (typeof document === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  // Export array of objects / arrays using SheetJS or fallback CSV with UTF-8 BOM
  exportWorkbook(sheetsData, filename = 'rentcar_data.xlsx') {
    const today = new Date().toISOString().split('T')[0];
    const fullFilename = filename.includes('.xlsx') || filename.includes('.csv') ? filename : `${filename}_${today}.xlsx`;

    if (this.isXlsxAvailable()) {
      const wb = window.XLSX.utils.book_new();

      sheetsData.forEach(({ sheetName, rows, headers }) => {
        let ws;
        if (headers && rows.length > 0 && Array.isArray(rows[0])) {
          ws = window.XLSX.utils.aoa_to_sheet([headers, ...rows]);
        } else if (headers && rows.length > 0 && typeof rows[0] === 'object') {
          ws = window.XLSX.utils.json_to_sheet(rows, { header: headers });
        } else {
          ws = window.XLSX.utils.json_to_sheet(rows);
        }

        // Set auto column width
        const colWidths = (headers || Object.keys(rows[0] || {})).map(h => ({ wch: Math.max(String(h).length + 4, 14) }));
        ws['!cols'] = colWidths;

        window.XLSX.utils.book_append_sheet(wb, ws, sheetName.substring(0, 31));
      });

      window.XLSX.writeFile(wb, fullFilename);
      return true;
    } else {
      // Fallback: CSV with UTF-8 BOM so Microsoft Excel opens it perfectly
      const primarySheet = sheetsData[0];
      if (!primarySheet) return false;

      let csvContent = '\uFEFF'; // UTF-8 BOM for Excel
      if (primarySheet.headers) {
        csvContent += primarySheet.headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(';') + '\r\n';
      }

      primarySheet.rows.forEach(row => {
        const values = Array.isArray(row) ? row : Object.values(row);
        const line = values.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';');
        csvContent += line + '\r\n';
      });

      const csvFilename = fullFilename.replace('.xlsx', '.csv');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      this.downloadBlob(blob, csvFilename);
      return true;
    }
  },

  // 1. Export Fleet (Avtopark)
  exportFleet() {
    if (typeof DB === 'undefined') return;
    const cars = DB.query(`
      SELECT id, make, model, year, plate_number, category, transmission, fuel_type, 
             seats, daily_rate, deposit_amount, mileage, status, features_json
      FROM cars 
      WHERE status != 'archived'
      ORDER BY id ASC
    `);

    const headers = [
      "ID", "Markasi", "Modeli", "Yili", "Davlat Raqami", "Toifasi", 
      "Uzatma Qutisi", "Yoqilg'i Turi", "O'rindiqlar", "Sutkalik Narx (UZS)", 
      "Garov Depoziti (UZS)", "Probeg (km)", "Holati", "Qo'shimcha Xususiyatlar"
    ];

    const rows = cars.map(c => [
      c.id,
      c.make,
      c.model,
      c.year,
      c.plate_number,
      c.category,
      c.transmission,
      c.fuel_type,
      c.seats,
      c.daily_rate,
      c.deposit_amount,
      c.mileage,
      c.status === 'available' ? "Bo'sh (Available)" : (c.status === 'rented' ? "Ijarada (Rented)" : c.status),
      c.features_json || ''
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    this.exportWorkbook([
      { sheetName: 'Avtopark', headers, rows }
    ], `rentcar_avtopark_${dateStr}.xlsx`);
  },

  // 2. Export Bookings (Buyurtmalar)
  exportBookings() {
    if (typeof DB === 'undefined') return;
    const bookings = DB.query(`
      SELECT b.id, b.booking_code, u.full_name, u.phone, u.passport_no,
             c.make, c.model, c.plate_number,
             b.start_date, b.end_date, b.total_days, b.daily_rate,
             b.total_amount, b.deposit_amount, b.status, b.payment_method, b.payment_status,
             b.pickup_location, b.created_at
      FROM bookings b
      JOIN cars c ON b.car_id = c.id
      JOIN users u ON b.user_id = u.id
      ORDER BY b.id DESC
    `);

    const headers = [
      "ID", "Buyurtma Kodi", "Mijoz Ismi", "Telefon", "Pasport",
      "Avtomobil", "Davlat Raqami", "Olish Sanasi", "Qaytarish Sanasi", 
      "Muddat (kun)", "Sutkalik Narx", "Jami Summa (UZS)", "Garov Depoziti", 
      "Buyurtma Holati", "To'lov Usuli", "To'lov Holati", "Topshirish Joyi", "Sana"
    ];

    const rows = bookings.map(b => [
      b.id,
      b.booking_code,
      b.full_name,
      b.phone,
      b.passport_no || '',
      `${b.make} ${b.model}`,
      b.plate_number,
      b.start_date,
      b.end_date,
      b.total_days,
      b.daily_rate,
      b.total_amount,
      b.deposit_amount,
      b.status,
      (b.payment_method || '').toUpperCase(),
      b.payment_status === 'paid' ? "To'langan" : "Kutilmoqda",
      b.pickup_location,
      b.created_at
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    this.exportWorkbook([
      { sheetName: 'Buyurtmalar', headers, rows }
    ], `rentcar_buyurtmalar_${dateStr}.xlsx`);
  },

  // 3. Export Finance & Cashflow (Moliya)
  exportFinance() {
    if (typeof DB === 'undefined') return;
    const transactions = DB.query(`
      SELECT id, booking_id, type, category, amount, payment_method, note, created_at
      FROM financial_transactions
      ORDER BY id DESC
    `);

    const headers = [
      "ID", "Buyurtma ID", "Tranzaksiya Turi", "Kategoriya", 
      "Summa (UZS)", "To'lov Usuli", "Izoh", "Vaqti"
    ];

    const rows = transactions.map(t => [
      t.id,
      t.booking_id || '',
      t.type === 'income' ? 'Kirim (Daromad)' : 'Chiqim (Xarajat)',
      t.category,
      t.amount,
      (t.payment_method || '').toUpperCase(),
      t.note || '',
      t.created_at
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    this.exportWorkbook([
      { sheetName: 'Moliya', headers, rows }
    ], `rentcar_moliya_${dateStr}.xlsx`);
  },

  // 4. Export CRM Clients (Mijozlar)
  exportCrm() {
    if (typeof DB === 'undefined') return;
    const users = DB.query(`
      SELECT u.id, u.full_name, u.username, u.phone, u.role, u.passport_no, u.license_no, u.status, u.created_at,
             COUNT(b.id) as total_bookings,
             COALESCE(SUM(b.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id AND b.status != 'cancelled'
      WHERE u.role = 'client'
      GROUP BY u.id
      ORDER BY u.id DESC
    `);

    const headers = [
      "ID", "Mijoz Ism-Familiyasi", "Login (Username)", "Telefon Raqami", "Ro'yxatdan O'tgan Vaqti",
      "Pasport / ID", "Haydovchilik Guvohnomasi", "Status", "Buyurtmalar Soni", "Jami Ijara Summasi (UZS)"
    ];

    const rows = users.map(u => [
      u.id,
      u.full_name,
      u.username || 'kiritilmagan',
      u.phone,
      u.created_at,
      u.passport_no || 'kiritilmagan',
      u.license_no || 'kiritilmagan',
      u.status === 'active' ? 'Faol (Active)' : "Qora Ro'yxatda (Blacklisted)",
      u.total_bookings,
      u.total_spent
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    this.exportWorkbook([
      { sheetName: 'Yangi_Mijozlar', headers, rows }
    ], `rentcar_mijozlar_${dateStr}.xlsx`);
  },

  // 5. Export Complete Database Workbook (All Sheets in 1 Master Excel File)
  exportFullDatabase() {
    if (typeof DB === 'undefined') return;

    // Sheet 1: Fleet
    const cars = DB.query(`
      SELECT id, make, model, year, plate_number, category, transmission, fuel_type, 
             seats, daily_rate, deposit_amount, mileage, status
      FROM cars WHERE status != 'archived' ORDER BY id ASC
    `);
    const fleetHeaders = [
      "ID", "Markasi", "Modeli", "Yili", "Davlat Raqami", "Toifasi", 
      "Uzatma Qutisi", "Yoqilg'i Turi", "O'rindiqlar", "Sutkalik Narx", "Garov Depoziti", "Probeg", "Holati"
    ];
    const fleetRows = cars.map(c => [
      c.id, c.make, c.model, c.year, c.plate_number, c.category,
      c.transmission, c.fuel_type, c.seats, c.daily_rate, c.deposit_amount, c.mileage, c.status
    ]);

    // Sheet 2: Bookings
    const bookings = DB.query(`
      SELECT b.id, b.booking_code, u.full_name, u.phone, c.make, c.model, c.plate_number,
             b.start_date, b.end_date, b.total_days, b.total_amount, b.status, b.payment_method
      FROM bookings b
      JOIN cars c ON b.car_id = c.id
      JOIN users u ON b.user_id = u.id
      ORDER BY b.id DESC
    `);
    const bookingHeaders = [
      "ID", "Buyurtma Kodi", "Mijoz Ismi", "Telefon", "Avtomobil", "Davlat Raqami",
      "Olish Sanasi", "Qaytarish Sanasi", "Muddat", "Jami Summa", "Holati", "To'lov Usuli"
    ];
    const bookingRows = bookings.map(b => [
      b.id, b.booking_code, b.full_name, b.phone, `${b.make} ${b.model}`, b.plate_number,
      b.start_date, b.end_date, b.total_days, b.total_amount, b.status, b.payment_method
    ]);

    // Sheet 3: Finance
    const trans = DB.query(`SELECT * FROM financial_transactions ORDER BY id DESC`);
    const financeHeaders = ["ID", "Buyurtma ID", "Turi", "Kategoriya", "Summa", "To'lov Usuli", "Izoh", "Sana"];
    const financeRows = trans.map(t => [
      t.id, t.booking_id || '', t.type, t.category, t.amount, t.payment_method, t.note || '', t.created_at
    ]);

    // Sheet 4: Users
    const users = DB.query(`SELECT id, full_name, phone, role, passport_no, license_no, status FROM users`);
    const userHeaders = ["ID", "Ism", "Telefon", "Roli", "Pasport", "Prava", "Status"];
    const userRows = users.map(u => [
      u.id, u.full_name, u.phone, u.role, u.passport_no || '', u.license_no || '', u.status
    ]);

    const dateStr = new Date().toISOString().split('T')[0];
    this.exportWorkbook([
      { sheetName: 'Avtopark', headers: fleetHeaders, rows: fleetRows },
      { sheetName: 'Buyurtmalar', headers: bookingHeaders, rows: bookingRows },
      { sheetName: 'Moliya', headers: financeHeaders, rows: financeRows },
      { sheetName: 'Mijozlar', headers: userHeaders, rows: userRows }
    ], `rentcar_toliq_baza_${dateStr}.xlsx`);
  },

  // 6. Download Blank Fleet Template for Excel Import
  downloadFleetTemplate() {
    const headers = [
      "Markasi", "Modeli", "Yili", "Davlat Raqami", "Toifasi", 
      "Uzatma Qutisi", "Yoqilg'i Turi", "O'rindiqlar", "Sutkalik Narx", 
      "Garov Depoziti", "Probeg", "Rasm Havolasi (URL)"
    ];
    const exampleRows = [
      ["Chevrolet", "Cobalt LTZ", 2024, "01 A 123 AA", "Ekonom", "Avtomat", "Benzin", 5, 320000, 1500000, 15000, "assets/cars/chevrolet-onix-premier.jpg"],
      ["Kia", "K5 GT-Line", 2024, "01 B 777 BB", "Biznes", "Avtomat", "Benzin", 5, 750000, 3000000, 8000, "assets/cars/chevrolet-malibu-2-premier.jpg"]
    ];

    this.exportWorkbook([
      { sheetName: 'Avtopark_Shablon', headers, rows: exampleRows }
    ], `rentcar_avtopark_shablon.xlsx`);
  },

  // 7. Parse & Import Excel File into Database
  async parseExcelFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // Check if file is CSV
      const isCsv = file.name.endsWith('.csv');

      if (isCsv || !this.isXlsxAvailable()) {
        reader.onload = (e) => {
          try {
            const text = e.target.result;
            const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
            if (lines.length < 2) {
              return resolve({ success: false, error: "Faylda ma'lumot yetarli emas" });
            }

            const delimiter = lines[0].includes(';') ? ';' : ',';
            const headers = lines[0].split(delimiter).map(h => h.replace(/^["'\s]+|["'\s]+$/g, ''));
            const data = [];

            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(delimiter).map(v => v.replace(/^["'\s]+|["'\s]+$/g, ''));
              if (values.length > 1) {
                const row = {};
                headers.forEach((h, idx) => {
                  row[h] = values[idx] || '';
                });
                data.push(row);
              }
            }

            resolve({ success: true, data });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsText(file, 'utf-8');
      } else {
        // Use SheetJS XLSX
        reader.onload = (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = window.XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = window.XLSX.utils.sheet_to_json(worksheet);
            resolve({ success: true, data: json });
          } catch (err) {
            reject(err);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    });
  },

  // 8. Import Fleet from parsed Excel rows
  async importFleetFromExcel(file) {
    if (typeof DB === 'undefined') return { success: false, error: 'DB not initialized' };

    try {
      const parsed = await this.parseExcelFile(file);
      if (!parsed.success || !parsed.data || parsed.data.length === 0) {
        return { success: false, error: parsed.error || "Excel fayl bo'sh yoki noto'g'ri formatda" };
      }

      let insertedCount = 0;
      const rows = parsed.data;

      rows.forEach(r => {
        // Map common column names in Uzbek or English
        const make = r['Markasi'] || r['markasi'] || r['Make'] || r['make'] || r['Brand'] || '';
        const model = r['Modeli'] || r['modeli'] || r['Model'] || r['model'] || '';
        if (!make || !model) return;

        const year = parseInt(r['Yili'] || r['yili'] || r['Year'] || r['year']) || 2024;
        const plate = r['Davlat Raqami'] || r['davlat raqami'] || r['Plate'] || r['plate_number'] || `01${Math.floor(100+Math.random()*900)}AA`;
        const category = r['Toifasi'] || r['toifasi'] || r['Category'] || 'Ekonom';
        const transmission = r['Uzatma Qutisi'] || r['Uzatma'] || r['Transmission'] || 'Avtomat';
        const fuel = r['Yoqilg\'i Turi'] || r['Yoqilgi'] || r['Fuel'] || 'Benzin';
        const seats = parseInt(r['O\'rindiqlar'] || r['Seats']) || 5;
        const dailyRate = parseFloat(r['Sutkalik Narx'] || r['Sutkalik Narx (UZS)'] || r['daily_rate'] || r['Price']) || 350000;
        const deposit = parseFloat(r['Garov Depoziti'] || r['deposit_amount'] || r['Deposit']) || 1500000;
        const mileage = parseInt(r['Probeg'] || r['mileage']) || 10000;
        const imageUrl = r['Rasm Havolasi (URL)'] || r['image_url'] || 'assets/cars/chevrolet-onix-premier.jpg';

        // Check if plate already exists
        const exists = DB.query("SELECT id FROM cars WHERE plate_number = ?", [plate]);
        if (exists && exists.length > 0) {
          DB.exec(`
            UPDATE cars SET 
              make = ?, model = ?, year = ?, category = ?, transmission = ?,
              fuel_type = ?, seats = ?, daily_rate = ?, deposit_amount = ?, mileage = ?, image_url = ?
            WHERE plate_number = ?
          `, [make, model, year, category, transmission, fuel, seats, dailyRate, deposit, mileage, imageUrl, plate]);
        } else {
          DB.exec(`
            INSERT INTO cars (
              make, model, year, category, transmission, fuel_type,
              seats, daily_rate, deposit_amount, status, mileage, plate_number, image_url, features_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'available', ?, ?, ?, '[]')
          `, [make, model, year, category, transmission, fuel, seats, dailyRate, deposit, mileage, plate, imageUrl]);
        }
        insertedCount++;
      });

      return { success: true, count: insertedCount };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = ExcelHelper;
}
