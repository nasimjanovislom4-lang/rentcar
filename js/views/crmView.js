// js/views/crmView.js
// CRM: Customer database, rental history, and Blacklist management

const isNodeCrm = typeof window === 'undefined';

const CrmView = {
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
    const customers = DB.query(`
      SELECT u.*,
        COUNT(b.id) as total_bookings,
        COALESCE(SUM(b.total_amount), 0) as total_spent
      FROM users u
      LEFT JOIN bookings b ON u.id = b.user_id AND b.status != 'cancelled'
      WHERE u.role = 'client'
      GROUP BY u.id
      ORDER BY total_spent DESC
    `);

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Mijozlar Bazasi (CRM & Blacklist)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Mijozlar profillari, ijara tarixi va qora ro'yxat nazorati</p>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mijoz Ismi</th>
                <th>Telefon Raqami</th>
                <th>Hujjatlar (Pasport / Prava)</th>
                <th>Buyurtmalar Soni</th>
                <th>Jami Xarid</th>
                <th>Holat (Status)</th>
                <th>Amal</th>
              </tr>
            </thead>
            <tbody>
              ${customers.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 30px;">Hozircha mijozlar yo'q.</td></tr>
              ` : customers.map(u => `
                <tr>
                  <td><strong>${u.full_name}</strong></td>
                  <td>${u.phone}</td>
                  <td>
                    <div style="font-size: 0.8rem;">
                      <span>🪪 Pasport: ${u.passport_no || 'Kiritilmagan'}</span><br>
                      <span>🚗 Prava: ${u.license_no || 'Kiritilmagan'}</span>
                    </div>
                  </td>
                  <td><strong>${u.total_bookings}</strong> ta</td>
                  <td><strong class="text-emerald">${(u.total_spent).toLocaleString()}</strong> so'm</td>
                  <td>
                    <span class="badge badge-${u.status === 'active' ? 'available' : 'danger'}">
                      ${u.status === 'active' ? 'Faol (Active)' : "Qora Ro'yxat"}
                    </span>
                  </td>
                  <td>
                    <button class="btn btn-sm ${u.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-toggle-blacklist" data-user-id="${u.id}" data-current="${u.status}">
                      ${u.status === 'active' ? "🚫 Blacklistga tiqish" : "✅ Ro'yxatdan chiqarish"}
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
    document.querySelectorAll('.btn-toggle-blacklist').forEach(btn => {
      btn.onclick = () => {
        const userId = parseInt(btn.getAttribute('data-user-id'), 10);
        const cur = btn.getAttribute('data-current');
        const confirmMsg = cur === 'active' 
          ? "Rostdan ham ushbu mijozni qora ro'yxatga (blacklist) kiritmoqchimisiz? U yangi buyurtma bera olmaydi."
          : "Ushbu mijozni qora ro'yxatdan chiqarmoqchimisiz?";
        
        if (confirm(confirmMsg)) {
          const newStatus = this.toggleBlacklist(userId);
          if (window.App) {
            window.App.showToast(`Mijoz holati: ${newStatus}`, newStatus === 'active' ? 'success' : 'warning');
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
