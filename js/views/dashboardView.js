// js/views/dashboardView.js
// Admin & Manager Dashboard: Real-time fleet KPIs and overview

const isNodeDashboard = typeof window === 'undefined';

const DashboardView = {
  getMetrics() {
    if (typeof DB === 'undefined') {
      return { totalCars: 0, availableCars: 0, rentedCars: 0, maintenanceCars: 0, revenue: 0, todayReturns: [], recentBookings: [] };
    }

    const totalCarsRes = DB.query("SELECT COUNT(*) as c FROM cars WHERE status != 'archived'");
    const availableRes = DB.query("SELECT COUNT(*) as c FROM cars WHERE status = 'available'");
    const rentedRes = DB.query("SELECT COUNT(*) as c FROM cars WHERE status = 'rented'");
    const maintRes = DB.query("SELECT COUNT(*) as c FROM cars WHERE status = 'maintenance'");
    const revRes = DB.query("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type = 'income'");
    const todayReturns = DB.query(`
      SELECT b.*, c.make, c.model, c.plate_number, u.full_name, u.phone 
      FROM bookings b 
      JOIN cars c ON b.car_id = c.id 
      JOIN users u ON b.user_id = u.id 
      WHERE b.status = 'picked_up' 
      ORDER BY b.end_date ASC 
      LIMIT 5
    `);
    const recentBookings = DB.query(`
      SELECT b.*, c.make, c.model, c.plate_number, u.full_name 
      FROM bookings b 
      JOIN cars c ON b.car_id = c.id 
      JOIN users u ON b.user_id = u.id 
      ORDER BY b.id DESC 
      LIMIT 5
    `);

    return {
      totalCars: totalCarsRes[0].c,
      availableCars: availableRes[0].c,
      rentedCars: rentedRes[0].c,
      maintenanceCars: maintRes[0].c,
      revenue: revRes[0].s,
      todayReturns,
      recentBookings
    };
  },

  render() {
    const m = this.getMetrics();

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Boshqaruv Paneli (Dashboard)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Avtopark holati, real-vaqt statistikasi va kutilayotgan harakatlar</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" id="btn-export-all-excel" style="background: #107c41; border-color: #107c41;">📊 Excelga Yuklash (.xlsx)</button>
            <button class="btn btn-secondary btn-sm" id="btn-quick-export-db">💾 SQLite Backup</button>
            <button class="btn btn-secondary btn-sm" id="btn-goto-fleet">+ Yangi Mashina</button>
          </div>
        </div>

        <!-- Excel Control Center Hub -->
        <div class="excel-hub-card" style="background: linear-gradient(135deg, rgba(16, 124, 65, 0.18) 0%, rgba(15, 23, 42, 0.65) 100%); border: 1.5px solid rgba(16, 124, 65, 0.45); border-radius: var(--radius-md); padding: 18px 22px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="font-size: 2.2rem; background: #107c41; color: white; width: 50px; height: 50px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 800; box-shadow: 0 4px 14px rgba(16, 124, 65, 0.4);">X</div>
            <div>
              <h3 style="font-size: 1.15rem; margin: 0 0 4px; color: #ffffff;">Excel Boshqaruv Markazi</h3>
              <p style="font-size: 0.85rem; color: #cbd5e1; margin: 0;">Barcha bo'limlar ma'lumotlarini to'g'ridan-to'g'ri Microsoft Excel (.xlsx) formatida yuklab oling yoki Exceldan yangi ma'lumotlarni kiriting</p>
            </div>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-primary btn-sm" id="btn-excel-full-db" style="background: #107c41; border-color: #107c41; font-weight: 700;">📗 To'liq Baza (4 varaqli .xlsx)</button>
            <button class="btn btn-secondary btn-sm" id="btn-excel-fleet">🚗 Avtopark</button>
            <button class="btn btn-secondary btn-sm" id="btn-excel-bookings">📋 Buyurtmalar</button>
            <button class="btn btn-secondary btn-sm" id="btn-excel-finance">💰 Moliya</button>
            <button class="btn btn-secondary btn-sm" id="btn-excel-crm">👥 Mijozlar</button>
            <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0; background: rgba(255, 255, 255, 0.08);" title="Excel fayl orqali yuklash">
              📥 Exceldan Yuklash
              <input type="file" id="dashboard-excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;">
            </label>
          </div>
        </div>

        <!-- KPI Cards Grid -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Jami Avtopark</span>
              <span class="kpi-value">${m.totalCars} ta</span>
            </div>
            <div class="kpi-icon-box icon-blue">🚗</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Hozirda Bo'sh</span>
              <span class="kpi-value text-emerald">${m.availableCars} ta</span>
            </div>
            <div class="kpi-icon-box icon-emerald">✅</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Ijarada (Band)</span>
              <span class="kpi-value text-accent">${m.rentedCars} ta</span>
            </div>
            <div class="kpi-icon-box icon-purple">🔑</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Ta'mirda / TO</span>
              <span class="kpi-value text-gold">${m.maintenanceCars} ta</span>
            </div>
            <div class="kpi-icon-box icon-gold">🛠️</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Umumiy Tushum</span>
              <span class="kpi-value text-emerald">${(m.revenue).toLocaleString()}</span>
            </div>
            <div class="kpi-icon-box icon-emerald">💰</div>
          </div>
        </div>

        <!-- Two Columns: Upcoming Returns & Recent Bookings -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(450px, 1fr)); gap: 24px;">
          <!-- Upcoming Returns -->
          <div class="data-table-container" style="padding: 20px;">
            <h3 style="margin-bottom: 16px; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              <span>⏳</span> Kutilayotgan Qaytishlar (Return Schedule)
            </h3>
            ${m.todayReturns.length === 0 ? `
              <p style="color: var(--text-muted); font-size: 0.9rem;">Bugungi kunda kutilayotgan qaytishlar yo'q.</p>
            ` : `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Avtomobil</th>
                    <th>Mijoz</th>
                    <th>Qaytish Sanasi</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${m.todayReturns.map(r => `
                    <tr>
                      <td><strong>${r.make} ${r.model}</strong><br><small style="color: var(--text-muted);">${r.plate_number}</small></td>
                      <td>${r.full_name}<br><small style="color: var(--text-muted);">${r.phone}</small></td>
                      <td>${r.end_date}</td>
                      <td><span class="badge badge-rented">Ijarada</span></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `}
          </div>

          <!-- Recent Bookings -->
          <div class="data-table-container" style="padding: 20px;">
            <h3 style="margin-bottom: 16px; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
              <span>📋</span> So'nggi Buyurtmalar
            </h3>
            <table class="data-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Mijoz</th>
                  <th>Avtomobil</th>
                  <th>Summa</th>
                  <th>Holat</th>
                </tr>
              </thead>
              <tbody>
                ${m.recentBookings.map(b => `
                  <tr>
                    <td><strong>${b.booking_code}</strong></td>
                    <td>${b.full_name}</td>
                    <td>${b.make} ${b.model}</td>
                    <td>${(b.total_amount).toLocaleString()}</td>
                    <td><span class="badge badge-${b.status === 'completed' || b.status === 'picked_up' ? 'available' : (b.status === 'cancelled' ? 'danger' : 'maintenance')}">${b.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  initListeners() {
    // Excel Exports
    const btnExportAll = document.getElementById('btn-export-all-excel');
    if (btnExportAll) {
      btnExportAll.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportFullDatabase();
          if (window.App) window.App.showToast("To'liq baza Excel (.xlsx) fayliga yuklandi!", "success");
        }
      };
    }

    const btnExcelFullDb = document.getElementById('btn-excel-full-db');
    if (btnExcelFullDb) {
      btnExcelFullDb.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportFullDatabase();
          if (window.App) window.App.showToast("To'liq 4-varaqli Excel kitobi yuklab olindi!", "success");
        }
      };
    }

    const btnExcelFleet = document.getElementById('btn-excel-fleet');
    if (btnExcelFleet) {
      btnExcelFleet.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportFleet();
          if (window.App) window.App.showToast("Avtopark jadvali Excelga yuklandi!", "success");
        }
      };
    }

    const btnExcelBookings = document.getElementById('btn-excel-bookings');
    if (btnExcelBookings) {
      btnExcelBookings.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportBookings();
          if (window.App) window.App.showToast("Buyurtmalar jadvali Excelga yuklandi!", "success");
        }
      };
    }

    const btnExcelFinance = document.getElementById('btn-excel-finance');
    if (btnExcelFinance) {
      btnExcelFinance.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportFinance();
          if (window.App) window.App.showToast("Moliya hisoboti Excelga yuklandi!", "success");
        }
      };
    }

    const btnExcelCrm = document.getElementById('btn-excel-crm');
    if (btnExcelCrm) {
      btnExcelCrm.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportCrm();
          if (window.App) window.App.showToast("Mijozlar bazasi Excelga yuklandi!", "success");
        }
      };
    }

    // Excel Import
    const fileInput = document.getElementById('dashboard-excel-file-input');
    if (fileInput) {
      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (window.App) window.App.showToast("Excel fayli o'qilmoqda...", "info");

        if (typeof ExcelHelper !== 'undefined') {
          const res = await ExcelHelper.importFleetFromExcel(file);
          if (res.success) {
            if (window.App) {
              window.App.showToast(`Muvaffaqiyatli! ${res.count} ta avtomobil bazaga kiritildi/yangilandi`, "success");
              window.App.navigate('dashboard');
            }
          } else {
            if (window.App) window.App.showToast("Xatolik: " + (res.error || "Faylni o'qib bo'lmadi"), "error");
          }
        }
        fileInput.value = '';
      };
    }

    const quickExport = document.getElementById('btn-quick-export-db');
    if (quickExport) {
      quickExport.onclick = () => {
        if (typeof ReportsView !== 'undefined') {
          ReportsView.downloadSqliteBackup();
        } else if (typeof DB !== 'undefined') {
          const binary = DB.exportDatabase();
          const blob = new Blob([binary], { type: 'application/x-sqlite3' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `rentcar_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
          a.click();
        }
      };
    }

    const gotoFleet = document.getElementById('btn-goto-fleet');
    if (gotoFleet) {
      gotoFleet.onclick = () => {
        if (window.App) window.App.navigate('fleet');
      };
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = DashboardView;
}
if (typeof window !== 'undefined') {
  window.DashboardView = DashboardView;
}
