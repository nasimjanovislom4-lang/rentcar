// js/views/reportsView.js
// Financial reports, transaction accounting, and SQLite Database backup & restore

const isNodeReports = typeof window === 'undefined';

const ReportsView = {
  getFinancialSummary() {
    if (typeof DB === 'undefined') {
      return { totalIncome: 0, totalExpense: 0, netProfit: 0, transactions: [] };
    }

    const incRes = DB.query("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type = 'income'");
    const expRes = DB.query("SELECT COALESCE(SUM(amount), 0) as s FROM financial_transactions WHERE type = 'expense'");
    const transactions = DB.query("SELECT * FROM financial_transactions ORDER BY id DESC");

    const totalIncome = incRes[0].s;
    const totalExpense = expRes[0].s;
    const netProfit = totalIncome - totalExpense;

    return { totalIncome, totalExpense, netProfit, transactions };
  },

  exportToCsv() {
    const { transactions } = this.getFinancialSummary();
    let csv = "ID,Turi,Kategoriya,Summa,To'lov Usuli,Izoh,Sana\n";
    transactions.forEach(t => {
      const note = (t.note || '').replace(/"/g, '""');
      csv += `${t.id},${t.type},${t.category},${t.amount},${t.payment_method},"${note}",${t.created_at}\n`;
    });
    return csv;
  },

  downloadSqliteBackup() {
    if (typeof DB === 'undefined') return;
    const binary = DB.exportDatabase();
    const blob = new Blob([binary], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rentcar_backup_${new Date().toISOString().split('T')[0]}.sqlite`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async restoreSqliteBackup(binaryData) {
    if (typeof DB === 'undefined') return;
    await DB.importDatabase(binaryData);
  },

  addTransaction(type, category, amount, paymentMethod, note) {
    if (typeof DB === 'undefined') return;
    DB.exec(`
      INSERT INTO financial_transactions (type, category, amount, payment_method, note)
      VALUES (?, ?, ?, ?, ?)
    `, [type, category, parseFloat(amount) || 0, paymentMethod || 'cash', note || '']);
  },

  render() {
    const s = this.getFinancialSummary();

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Moliya va Ma'lumotlar Bazasi (Reports & SQLite)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Tushumlar, xarajatlar balansi, CSV eksport va haqiqiy SQLite bazani saqlash</p>
          </div>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-secondary btn-sm" id="btn-export-csv">📊 CSV Eksport</button>
            <button class="btn btn-primary btn-sm" id="btn-open-expense-modal">- Yangi Xarajat</button>
          </div>
        </div>

        <!-- Financial KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Jami Tushum (Kirim)</span>
              <span class="kpi-value text-emerald">+${(s.totalIncome).toLocaleString()} so'm</span>
            </div>
            <div class="kpi-icon-box icon-emerald">📈</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Jami Xarajat (Chiqim)</span>
              <span class="kpi-value text-rose">-${(s.totalExpense).toLocaleString()} so'm</span>
            </div>
            <div class="kpi-icon-box icon-gold">📉</div>
          </div>

          <div class="kpi-card">
            <div class="kpi-content">
              <span class="kpi-label">Sof Foyda (Balans)</span>
              <span class="kpi-value text-accent">${(s.netProfit).toLocaleString()} so'm</span>
            </div>
            <div class="kpi-icon-box icon-blue">💎</div>
          </div>
        </div>

        <!-- SQLite Database Management Box -->
        <div class="backup-card">
          <div>
            <h3 style="font-size: 1.15rem; margin-bottom: 6px;">💾 SQLite Relyatsion Baza Boshqaruvi</h3>
            <p style="color: var(--text-secondary); font-size: 0.85rem; max-width: 600px;">
              Tizim brauzerda to'liq relyatsion SQLite (sql.js / WASM) orqali ishlaydi. Istalgan vaqtda butun bazani <strong>.sqlite</strong> fayl sifatida yuklab olishingiz yoki avval saqlangan bazani qayta tiklashingiz mumkin.
            </p>
          </div>
          <div style="display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-download-sqlite">
              📥 Bazani Yuklab Olish (.sqlite)
            </button>
            <label class="btn btn-secondary" style="margin: 0; cursor: pointer;">
              📤 Bazani Tiklash (.sqlite)
              <input type="file" id="input-upload-sqlite" accept=".sqlite,.db" style="display: none;">
            </label>
            <button class="btn btn-danger btn-sm" id="btn-reset-db">
              🔄 Dastlabki Holatga Qaytarish
            </button>
          </div>
        </div>

        <!-- Transactions Table -->
        <div class="data-table-container" style="margin-top: 28px;">
          <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="font-size: 1.1rem;">Tranzaksiyalar Tarixi</h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Jami: ${s.transactions.length} ta operatsiya</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Turi</th>
                <th>Kategoriya</th>
                <th>Summa</th>
                <th>To'lov Usuli</th>
                <th>Izoh</th>
                <th>Sana</th>
              </tr>
            </thead>
            <tbody>
              ${s.transactions.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 24px;">Hozircha moliyaviy yozuvlar yo'q.</td></tr>
              ` : s.transactions.map(t => `
                <tr>
                  <td>#${t.id}</td>
                  <td>
                    <span class="badge badge-${t.type === 'income' ? 'available' : 'danger'}">
                      ${t.type === 'income' ? '+ Kirim' : '- Chiqim'}
                    </span>
                  </td>
                  <td><strong>${t.category}</strong></td>
                  <td>
                    <strong class="${t.type === 'income' ? 'text-emerald' : 'text-rose'}">
                      ${t.type === 'income' ? '+' : '-'}${(t.amount).toLocaleString()} so'm
                    </strong>
                  </td>
                  <td><span class="badge badge-available">${t.payment_method.toUpperCase()}</span></td>
                  <td>${t.note || '-'}</td>
                  <td><small style="color: var(--text-muted);">${t.created_at}</small></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add Expense Modal -->
      <div id="expense-modal-overlay" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <h2>Yangi Xarajat Kiritish</h2>
            <button class="modal-close-btn" id="btn-close-expense-modal">✕</button>
          </div>
          <form id="form-expense-save">
            <div class="form-group">
              <label class="form-label">Xarajat kategoriyasi *</label>
              <select id="expense-category" class="form-select" required>
                <option value="tamirlash">Avtomobil ta'mirlash (TO)</option>
                <option value="yonilgi">Yoqilg'i (Benzin / Metan / Zaryad)</option>
                <option value="yuvish">Avtomobil yuvish (Moyka)</option>
                <option value="sugurta">Sug'urta to'lovi</option>
                <option value="xodimlar">Xodimlar maoshi / Bonus</option>
                <option value="boshqa">Boshqa xarajatlar</option>
              </select>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Summasi (so'm) *</label>
                <input type="number" id="expense-amount" class="form-input" placeholder="350000" required>
              </div>
              <div class="form-group">
                <label class="form-label">To'lov usuli</label>
                <select id="expense-payment-method" class="form-select">
                  <option value="cash">Naqd pul</option>
                  <option value="card">Bank kartasi / Korporativ</option>
                  <option value="click">Click</option>
                  <option value="payme">Payme</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Izoh / Tafsilot</label>
              <textarea id="expense-note" class="form-textarea" rows="3" placeholder="Masalan: Tracker avtomobiliga moy almashtirish..."></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-expense-modal">Bekor qilish</button>
              <button type="submit" class="btn btn-primary">Xarajatni Saqlash</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  initListeners() {
    // Download SQLite file
    const downloadBtn = document.getElementById('btn-download-sqlite');
    if (downloadBtn) {
      downloadBtn.onclick = () => {
        this.downloadSqliteBackup();
        if (window.App) window.App.showToast("SQLite ma'lumotlar bazasi yuklab olindi", "success");
      };
    }

    // CSV Export
    const csvBtn = document.getElementById('btn-export-csv');
    if (csvBtn) {
      csvBtn.onclick = () => {
        const csv = this.exportToCsv();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rentcar_moliya_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        if (window.App) window.App.showToast("Moliya hisoboti CSV formatida yuklandi", "success");
      };
    }

    // Upload SQLite restore
    const uploadInput = document.getElementById('input-upload-sqlite');
    if (uploadInput) {
      uploadInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const u8 = new Uint8Array(reader.result);
            await this.restoreSqliteBackup(u8);
            if (window.App) {
              window.App.showToast("Baza muvaffaqiyatli tiklandi!", "success");
              window.App.navigate('reports');
            }
          } catch (err) {
            alert("Xatolik: Yuklangan fayl to'g'ri SQLite 3 formati emas!");
          }
        };
        reader.readAsArrayBuffer(file);
      };
    }

    // Reset DB
    const resetBtn = document.getElementById('btn-reset-db');
    if (resetBtn) {
      resetBtn.onclick = async () => {
        if (confirm("DIQQAT: Barcha kiritilgan ma'lumotlar o'chib, dastlabki holatga qaytadi. Davom etasizmi?")) {
          if (typeof DB !== 'undefined') {
            await DB.resetToDefault();
            if (window.App) {
              window.App.showToast("Baza dastlabki holatga qaytarildi", "warning");
              window.App.navigate('reports');
            }
          }
        }
      };
    }

    // Add expense modal
    const openExpBtn = document.getElementById('btn-open-expense-modal');
    const closeExpBtn = document.getElementById('btn-close-expense-modal');
    const cancelExpBtn = document.getElementById('btn-cancel-expense-modal');
    const closeExpModal = () => document.getElementById('expense-modal-overlay').classList.remove('active');

    if (openExpBtn) {
      openExpBtn.onclick = () => {
        document.getElementById('form-expense-save').reset();
        document.getElementById('expense-modal-overlay').classList.add('active');
      };
    }
    if (closeExpBtn) closeExpBtn.onclick = closeExpModal;
    if (cancelExpBtn) cancelExpBtn.onclick = closeExpModal;

    const expForm = document.getElementById('form-expense-save');
    if (expForm) {
      expForm.onsubmit = (e) => {
        e.preventDefault();
        const cat = document.getElementById('expense-category').value;
        const amt = document.getElementById('expense-amount').value;
        const pay = document.getElementById('expense-payment-method').value;
        const note = document.getElementById('expense-note').value.trim();

        this.addTransaction('expense', cat, amt, pay, note);
        closeExpModal();
        if (window.App) {
          window.App.showToast("Xarajat muvaffaqiyatli kiritildi", "success");
          window.App.navigate('reports');
        }
      };
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = ReportsView;
}
if (typeof window !== 'undefined') {
  window.ReportsView = ReportsView;
}
