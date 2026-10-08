// js/views/bookingsView.js
// Bookings Management and Handover Inspections View

const isNodeBookings = typeof window === 'undefined';

const BookingsView = {
  currentFilter: 'all',

  updateBookingStatus(bookingId, status) {
    if (typeof DB === 'undefined') return;
    const b = DB.query("SELECT car_id FROM bookings WHERE id = ?", [bookingId]);
    if (!b || b.length === 0) return;
    const carId = b[0].car_id;

    DB.exec("UPDATE bookings SET status = ? WHERE id = ?", [status, bookingId]);

    // Sync car status
    if (status === 'picked_up') {
      DB.exec("UPDATE cars SET status = 'rented' WHERE id = ?", [carId]);
    } else if (status === 'completed' || status === 'cancelled') {
      DB.exec("UPDATE cars SET status = 'available' WHERE id = ?", [carId]);
    }
  },

  recordInspection(data) {
    if (typeof DB === 'undefined') return;
    const userId = (typeof Auth !== 'undefined' && Auth.getCurrentUser()) ? Auth.getCurrentUser().id : 1;

    DB.exec(`
      INSERT INTO handover_inspections (
        booking_id, inspection_type, fuel_level, mileage, damages_note, inspected_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      data.booking_id,
      data.inspection_type || 'pickup',
      parseInt(data.fuel_level) || 100,
      parseInt(data.mileage) || 0,
      data.damages_note || '',
      userId
    ]);

    // Update car mileage if provided
    if (data.mileage) {
      const b = DB.query("SELECT car_id FROM bookings WHERE id = ?", [data.booking_id]);
      if (b && b.length > 0) {
        DB.exec("UPDATE cars SET mileage = ? WHERE id = ?", [parseInt(data.mileage), b[0].car_id]);
      }
    }
  },

  render() {
    if (typeof DB === 'undefined') return '';
    let sql = `
      SELECT b.*, c.make, c.model, c.plate_number, c.mileage as car_mileage, u.full_name, u.phone
      FROM bookings b
      JOIN cars c ON b.car_id = c.id
      JOIN users u ON b.user_id = u.id
    `;
    const params = [];
    if (this.currentFilter !== 'all') {
      sql += " WHERE b.status = ?";
      params.push(this.currentFilter);
    }
    sql += " ORDER BY b.id DESC";

    const bookings = DB.query(sql, params);

    const statuses = [
      { id: 'all', label: 'Barchasi' },
      { id: 'new', label: 'Yangi' },
      { id: 'confirmed', label: 'Tasdiqlangan' },
      { id: 'picked_up', label: 'Mashina berildi' },
      { id: 'completed', label: 'Yakunlandi' },
      { id: 'cancelled', label: 'Bekor qilindi' }
    ];

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Buyurtmalar Boshqaruvi (Bookings)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Kelib tushgan buyurtmalar, statuslar nazorati va topshirish/qabul aktlari</p>
          </div>
          <button class="btn btn-secondary btn-sm" id="btn-export-bookings-excel" style="background: #107c41; color: white; border-color: #107c41;">📊 Excelga Yuklash (.xlsx)</button>
        </div>

        <!-- Filter tabs -->
        <div class="category-filter-bar" style="justify-content: flex-start; margin: 0 0 20px;">
          ${statuses.map(s => `
            <button class="filter-chip ${this.currentFilter === s.id ? 'active' : ''} btn-booking-filter" data-status="${s.id}">
              ${s.label}
            </button>
          `).join('')}
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Kod & Sana</th>
                <th>Mijoz</th>
                <th>Avtomobil</th>
                <th>Muddat (Kun)</th>
                <th>Summa & To'lov</th>
                <th>Holat (Status)</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${bookings.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 30px;">Hozircha buyurtmalar yo'q.</td></tr>
              ` : bookings.map(b => `
                <tr>
                  <td>
                    <strong>${b.booking_code}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${b.created_at || ''}</div>
                  </td>
                  <td>
                    <strong>${b.full_name}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${b.phone}</div>
                  </td>
                  <td>
                    <strong>${b.make} ${b.model}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-muted);">${b.plate_number}</div>
                  </td>
                  <td>
                    ${b.start_date} → ${b.end_date}
                    <div style="font-size: 0.8rem; color: var(--accent-primary); font-weight: 600;">${b.total_days} kun</div>
                  </td>
                  <td>
                    <strong>${(b.total_amount).toLocaleString()}</strong> so'm
                    <div style="font-size: 0.75rem;">
                      <span class="badge badge-${b.payment_status === 'paid' ? 'available' : 'maintenance'}" style="font-size: 0.65rem; padding: 2px 6px;">
                        ${b.payment_method.toUpperCase()} • ${b.payment_status === 'paid' ? "To'langan" : "Kutilmoqda"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-${b.status === 'completed' || b.status === 'picked_up' ? 'available' : (b.status === 'cancelled' ? 'danger' : 'maintenance')}">
                      ${b.status}
                    </span>
                  </td>
                  <td>
                    <div class="data-table-actions">
                      ${b.status === 'new' ? `
                        <button class="btn btn-sm btn-primary btn-action-status" data-id="${b.id}" data-status="confirmed">Tasdiqlash</button>
                        <button class="btn btn-sm btn-danger btn-action-status" data-id="${b.id}" data-status="cancelled">Bekor</button>
                      ` : ''}

                      ${b.status === 'confirmed' ? `
                        <button class="btn btn-sm btn-success btn-open-inspection" data-id="${b.id}" data-type="pickup" data-mileage="${b.car_mileage}">
                          🔑 Topshirish Akti
                        </button>
                      ` : ''}

                      ${b.status === 'picked_up' ? `
                        <button class="btn btn-sm btn-primary btn-open-inspection" data-id="${b.id}" data-type="return" data-mileage="${b.car_mileage}">
                          🏁 Qabul Qilish
                        </button>
                      ` : ''}

                      ${b.status === 'completed' ? `
                        <span style="font-size: 0.8rem; color: var(--accent-emerald);">Yakunlangan ✓</span>
                      ` : ''}

                      ${b.status === 'cancelled' ? `
                        <span style="font-size: 0.8rem; color: var(--accent-rose);">Bekor qilingan</span>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Handover Inspection Modal -->
      <div id="inspection-modal-overlay" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <h2 id="inspection-modal-title">Avtomobil Topshirish / Qabul Akti</h2>
            <button class="modal-close-btn" id="btn-close-inspection-modal">✕</button>
          </div>
          <form id="form-inspection-save">
            <input type="hidden" id="insp-booking-id">
            <input type="hidden" id="insp-type">

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Yoqilg'i darajasi (%) *</label>
                <input type="number" id="insp-fuel" class="form-input" min="0" max="100" value="100" required>
              </div>
              <div class="form-group">
                <label class="form-label">Hozirgi Probeg (km) *</label>
                <input type="number" id="insp-mileage" class="form-input" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Mavjud shikastlanishlar / Qaydlar</label>
              <textarea id="insp-notes" class="form-textarea" rows="3" placeholder="Masalan: Mashina toza, old kapotda mayda tosh tekkan joyi bor..."></textarea>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-insp-modal">Bekor qilish</button>
              <button type="submit" class="btn btn-primary">Aktni Saqlash & Holatni Yangilash</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  initListeners() {
    // Filter tabs
    document.querySelectorAll('.btn-booking-filter').forEach(btn => {
      btn.onclick = () => {
        this.currentFilter = btn.getAttribute('data-status');
        if (window.App) window.App.navigate('bookings');
      };
    });

    // Quick status changes (confirm / cancel)
    document.querySelectorAll('.btn-action-status').forEach(btn => {
      btn.onclick = () => {
        const id = parseInt(btn.getAttribute('data-id'), 10);
        const status = btn.getAttribute('data-status');
        this.updateBookingStatus(id, status);
        if (window.App) {
          window.App.showToast(`Buyurtma holati: ${status}`, "success");
          window.App.navigate('bookings');
        }
      };
    });

    // Open inspection modal
    document.querySelectorAll('.btn-open-inspection').forEach(btn => {
      btn.onclick = () => {
        const bId = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        const mileage = btn.getAttribute('data-mileage') || 0;

        document.getElementById('insp-booking-id').value = bId;
        document.getElementById('insp-type').value = type;
        document.getElementById('insp-mileage').value = mileage;
        document.getElementById('inspection-modal-title').innerText = type === 'pickup' 
          ? "Avtomobilni Topshirish Akti (Pickup)" 
          : "Avtomobilni Qabul Qilish Akti (Return)";
        
        document.getElementById('inspection-modal-overlay').classList.add('active');
      };
    });

    const closeBtn = document.getElementById('btn-close-inspection-modal');
    const cancelBtn = document.getElementById('btn-cancel-insp-modal');
    const closeModal = () => document.getElementById('inspection-modal-overlay').classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Save inspection form
    const form = document.getElementById('form-inspection-save');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const bId = parseInt(document.getElementById('insp-booking-id').value, 10);
        const type = document.getElementById('insp-type').value;
        const fuel = document.getElementById('insp-fuel').value;
        const mileage = document.getElementById('insp-mileage').value;
        const notes = document.getElementById('insp-notes').value.trim();

        this.recordInspection({
          booking_id: bId,
          inspection_type: type,
          fuel_level: fuel,
          mileage: mileage,
          damages_note: notes
        });

        // Advance booking status
        const nextStatus = type === 'pickup' ? 'picked_up' : 'completed';
        this.updateBookingStatus(bId, nextStatus);

        closeModal();
        if (window.App) {
          window.App.showToast("Akt muvaffaqiyatli saqlandi!", "success");
          window.App.navigate('bookings');
        }
      };
    }

    // Excel Export
    const exportBtn = document.getElementById('btn-export-bookings-excel');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportBookings();
          if (window.App) window.App.showToast("Buyurtmalar Excel (.xlsx) fayliga yuklandi!", "success");
        }
      };
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = BookingsView;
}
if (typeof window !== 'undefined') {
  window.BookingsView = BookingsView;
}
