// js/views/crmView.js
// CRM: Customer database, rental history, and Blacklist management for Managers & Admins

const isNodeCrm = typeof window === 'undefined';

const CrmView = {
  currentFilter: 'all',

  toggleBlacklist(userId) {
    if (typeof DB === 'undefined') return 'active';
    const users = DB.query("SELECT status FROM users WHERE id = ?", [userId]);
    if (!users || users.length === 0) return 'active';
    const newStatus = users[0].status === 'active' ? 'blacklisted' : 'active';
    DB.exec("UPDATE users SET status = ? WHERE id = ?", [newStatus, userId]);
    return newStatus;
  },

  render() {
    if (typeof DB === 'undefined') return '';
    let sql = `
      SELECT u.*,
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id AND b.status != 'cancelled'
      WHERE u.role = 'client'
      GROUP BY u.id
      ORDER BY u.id DESC
    `;

    const customers = DB.query(sql);

    // Apply client-side filter
    const filteredCustomers = customers.filter(u => {
      if (this.currentFilter === 'new') return u.total_bookings === 0;
      if (this.currentFilter === 'active') return u.status === 'active' && u.total_bookings > 0;
      if (this.currentFilter === 'blacklisted') return u.status === 'blacklisted';
      return true;
    });

    const filterOptions = [
      { id: 'all', label: `Barchasi (${customers.length})` },
      { id: 'new', label: `Yangi Ro'yxatdan O'tganlar (${customers.filter(c => c.total_bookings === 0).length})` },
      { id: 'active', label: `Faol Mijozlar (${customers.filter(c => c.status === 'active' && c.total_bookings > 0).length})` },
      { id: 'blacklisted', label: `Qora Ro'yxatdagilar (${customers.filter(c => c.status === 'blacklisted').length})` }
    ];

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Mijozlar Bazasi (CRM & Yangi Mijozlar)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Mijozlar profillari, yangi ro'yxatdan o'tganlar va qora ro'yxat nazorati</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-export-crm-excel" style="background: #107c41; color: white; border-color: #107c41; font-weight: 700;">
              📊 Mijozlar Ro'yxatini Excelga Yuklash (.xlsx)
            </button>
          </div>
        </div>

        <!-- Filter tabs -->
        <div class="category-filter-bar" style="justify-content: flex-start; margin: 0 0 20px; flex-wrap: wrap; gap: 8px;">
          ${filterOptions.map(f => `
            <button class="filter-chip ${this.currentFilter === f.id ? 'active' : ''} btn-crm-filter" data-filter="${f.id}">
              ${f.label}
            </button>
          `).join('')}
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mijoz & Login</th>
                <th>Telefon Raqami</th>
                <th>Ro'yxatdan O'tgan Vaqti</th>
                <th>Hujjatlar (Pasport / Prava)</th>
                <th>Buyurtmalar</th>
                <th>Holat (Status)</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              ${filteredCustomers.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-muted);">Ushbu toifada hech qanday mijoz topilmadi.</td></tr>
              ` : filteredCustomers.map(u => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div>
                        <strong>${u.full_name}</strong>
                        <div style="font-size: 0.75rem; color: #94a3b8;">
                          Login: <span style="color: var(--accent-gold); font-family: monospace;">${u.username || 'avto'}</span>
                          ${u.total_bookings === 0 ? '<span class="badge" style="background: rgba(16, 185, 129, 0.2); color: #34d399; margin-left: 6px; font-size: 0.65rem;">YANGI MIJOZ</span>' : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td><strong>${u.phone}</strong></td>
                  <td>
                    <span style="font-size: 0.85rem; color: #cbd5e1;">${u.created_at ? u.created_at.split(' ')[0] : 'Yaqinda'}</span>
                  </td>
                  <td>
                    <div style="font-size: 0.8rem;">
                      <span>🪪 Pasport: ${u.passport_no || 'Kiritilmagan'}</span><br>
                      <span>🚗 Prava: ${u.license_no || 'Kiritilmagan'}</span>
                    </div>
                  </td>
                  <td>
                    <div><strong>${u.total_bookings}</strong> ta ijara</div>
                    <div style="font-size: 0.8rem; color: var(--accent-emerald); font-weight: 700;">${(u.total_spent).toLocaleString()} so'm</div>
                  </td>
                  <td>
                    <span class="badge badge-${u.status === 'active' ? 'available' : 'danger'}">
                      ${u.status === 'active' ? 'Faol (Active)' : "Qora Ro'yxat"}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-toggle-blacklist" data-user-id="${u.id}" data-current="${u.status}">
                      ${u.status === 'active' ? "🚫 Blacklist" : "✅ Faollashtirish"}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  initListeners() {
    // Excel Export
    const exportBtn = document.getElementById('btn-export-crm-excel');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportCrm();
          if (window.App) window.App.showToast("Mijozlar ro'yxati Excel (.xlsx) fayliga yuklandi!", "success");
        }
      };
    }

    // Filter Buttons
    document.querySelectorAll('.btn-crm-filter').forEach(btn => {
      btn.onclick = () => {
        this.currentFilter = btn.getAttribute('data-filter') || 'all';
        if (window.App) window.App.navigate('crm');
      };
    });

    // Toggle Blacklist
    document.querySelectorAll('.btn-toggle-blacklist').forEach(btn => {
      btn.onclick = () => {
        const userId = parseInt(btn.getAttribute('data-user-id'), 10);
        const cur = btn.getAttribute('data-current');
        const confirmMsg = cur === 'active' 
          ? "Ushbu mijozni qora ro'yxatga (blacklist) kiritmoqchimisiz? U yangi buyurtma bera olmaydi."
          : "Ushbu mijozni qora ro'yxatdan chiqarmoqchimisiz?";
        
        if (confirm(confirmMsg)) {
          const newStatus = this.toggleBlacklist(userId);
          if (window.App) {
            window.App.showToast(`Mijoz holati yangilandi: ${newStatus}`, newStatus === 'active' ? 'success' : 'warning');
            window.App.navigate('crm');
          }
        }
      };
    });
  }
};

if (typeof module !== 'undefined') {
  module.exports = CrmView;
}
if (typeof window !== 'undefined') {
  window.CrmView = CrmView;
}
