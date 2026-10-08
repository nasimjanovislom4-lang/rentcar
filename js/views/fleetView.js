// js/views/fleetView.js
// Fleet Management View: Add, Edit, Status Transition, and Fleet List

const isNodeFleet = typeof window === 'undefined';

const FleetView = {
  addCar(carData) {
    if (typeof DB === 'undefined') throw new Error("DB not initialized");
    const features = Array.isArray(carData.features) ? JSON.stringify(carData.features) : (carData.features_json || '[]');

    DB.exec(`
      INSERT INTO cars (
        make, model, year, category, transmission, fuel_type,
        seats, daily_rate, deposit_amount, status, mileage,
        plate_number, image_url, features_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      carData.make,
      carData.model,
      parseInt(carData.year) || 2024,
      carData.category || 'Ekonom',
      carData.transmission || 'Avtomat',
      carData.fuel_type || 'Benzin',
      parseInt(carData.seats) || 5,
      parseFloat(carData.daily_rate) || 300000,
      parseFloat(carData.deposit_amount) || 1500000,
      carData.status || 'available',
      parseInt(carData.mileage) || 0,
      carData.plate_number,
      carData.image_url || 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80',
      features
    ]);

    const res = DB.query("SELECT last_insert_rowid() as id");
    return res[0].id;
  },

  updateCarStatus(carId, status) {
    if (typeof DB === 'undefined') return;
    DB.exec("UPDATE cars SET status = ? WHERE id = ?", [status, carId]);
  },

  updateCar(carId, carData) {
    if (typeof DB === 'undefined') return;
    const features = Array.isArray(carData.features) ? JSON.stringify(carData.features) : (carData.features_json || '[]');
    DB.exec(`
      UPDATE cars SET
        make = ?, model = ?, year = ?, category = ?, transmission = ?,
        fuel_type = ?, seats = ?, daily_rate = ?, deposit_amount = ?,
        mileage = ?, plate_number = ?, image_url = ?, features_json = ?
      WHERE id = ?
    `, [
      carData.make, carData.model, parseInt(carData.year), carData.category,
      carData.transmission, carData.fuel_type, parseInt(carData.seats),
      parseFloat(carData.daily_rate), parseFloat(carData.deposit_amount),
      parseInt(carData.mileage), carData.plate_number, carData.image_url,
      features, carId
    ]);
  },

  deleteCar(carId) {
    if (typeof DB === 'undefined') return;
    DB.exec("UPDATE cars SET status = 'archived' WHERE id = ?", [carId]);
  },

  render() {
    if (typeof DB === 'undefined') return '';
    const cars = DB.query("SELECT * FROM cars WHERE status != 'archived' ORDER BY id DESC");

    return `
      <div class="admin-page">
        <div class="admin-header-row">
          <div>
            <h1 class="admin-page-title">Avtopark Boshqaruvi (Fleet)</h1>
            <p style="color: var(--text-muted); font-size: 0.9rem;">Avtomobillar ro'yxati, texnik xizmat ko'rsatish va yangi transport qo'shish</p>
          </div>
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-export-fleet-excel" style="background: #107c41; color: white; border-color: #107c41;">📊 Excelga Yuklash (.xlsx)</button>
            <label class="btn btn-secondary btn-sm" style="cursor: pointer; margin: 0;" title="Excel fayl orqali yangi mashinalar qo'shish">
              📥 Exceldan Qo'shish
              <input type="file" id="fleet-excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;">
            </label>
            <button class="btn btn-secondary btn-sm" id="btn-download-fleet-template" title="Excel namuna shabloni">📄 Namuna Shablon</button>
            <button class="btn btn-primary btn-sm" id="btn-open-add-car-modal">+ Yangi Avtomobil</button>
          </div>
        </div>

        <div class="data-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Rasm & Model</th>
                <th>Davlat Raqami</th>
                <th>Toifa & Uzatma</th>
                <th>Sutkalik Narx</th>
                <th>Probeg</th>
                <th>Holati (Status)</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              ${cars.length === 0 ? `
                <tr><td colspan="7" style="text-align: center; padding: 30px;">Hozircha hech qanday avtomobil yo'q.</td></tr>
              ` : cars.map(c => `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                      <img src="${c.image_url}" alt="${c.make}" style="width: 55px; height: 38px; object-fit: cover; border-radius: var(--radius-sm);" onerror="this.src='https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'">
                      <div>
                        <strong>${c.make} ${c.model}</strong>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${c.year}-yil</div>
                      </div>
                    </div>
                  </td>
                  <td><strong>${c.plate_number}</strong></td>
                  <td>${c.category} • ${c.transmission}</td>
                  <td><strong>${(c.daily_rate).toLocaleString()}</strong> so'm</td>
                  <td>${(c.mileage).toLocaleString()} km</td>
                  <td>
                    <select class="status-pill-select car-status-change" data-car-id="${c.id}">
                      <option value="available" ${c.status === 'available' ? 'selected' : ''}>Bo'sh (Available)</option>
                      <option value="rented" ${c.status === 'rented' ? 'selected' : ''}>Ijarada (Rented)</option>
                      <option value="maintenance" ${c.status === 'maintenance' ? 'selected' : ''}>Ta'mirda (TO)</option>
                      <option value="washing" ${c.status === 'washing' ? 'selected' : ''}>Yuvishda</option>
                    </select>
                  </td>
                  <td>
                    <div class="data-table-actions">
                      <button class="btn btn-sm btn-secondary btn-edit-car" data-car-id="${c.id}">✏️</button>
                      <button class="btn btn-sm btn-danger btn-delete-car" data-car-id="${c.id}">🗑️</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add/Edit Car Modal -->
      <div id="car-modal-overlay" class="modal-overlay">
        <div class="modal-box">
          <div class="modal-header">
            <h2 id="car-modal-title">Yangi Avtomobil Qo'shish</h2>
            <button class="modal-close-btn" id="btn-close-car-modal">✕</button>
          </div>
          <form id="form-car-save">
            <input type="hidden" id="car-form-id" value="">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Marka (Make) *</label>
                <input type="text" id="car-make" class="form-input" placeholder="Chevrolet, BYD, Kia..." required>
              </div>
              <div class="form-group">
                <label class="form-label">Model *</label>
                <input type="text" id="car-model" class="form-input" placeholder="Onix, Tracker, K5..." required>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Ishlab chiqarilgan yili</label>
                <input type="number" id="car-year" class="form-input" value="2024" min="2015" max="2027" required>
              </div>
              <div class="form-group">
                <label class="form-label">Kategoriya</label>
                <select id="car-category" class="form-select">
                  <option value="Ekonom">Ekonom</option>
                  <option value="Biznes">Biznes</option>
                  <option value="SUV">SUV</option>
                  <option value="Premium">Premium</option>
                  <option value="Elektromobil">Elektromobil</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Uzatma qutisi</label>
                <select id="car-transmission" class="form-select">
                  <option value="Avtomat">Avtomat</option>
                  <option value="Mexanika">Mexanika</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Davlat raqami *</label>
                <input type="text" id="car-plate" class="form-input" placeholder="01A777AA" required>
              </div>
              <div class="form-group">
                <label class="form-label">Yoqilg'i turi</label>
                <select id="car-fuel" class="form-select">
                  <option value="Benzin">Benzin</option>
                  <option value="Elektr">Elektr</option>
                  <option value="Gibrid">Gibrid</option>
                  <option value="Gaz">Gaz</option>
                </select>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
              <div class="form-group">
                <label class="form-label">Kunlik ijara narxi (so'm) *</label>
                <input type="number" id="car-daily-rate" class="form-input" placeholder="400000" required>
              </div>
              <div class="form-group">
                <label class="form-label">Garov depoziti (so'm) *</label>
                <input type="number" id="car-deposit" class="form-input" placeholder="2000000" required>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Rasm havolasi (URL)</label>
              <input type="url" id="car-image-url" class="form-input" value="https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80">
            </div>

            <div class="form-group">
              <label class="form-label">Xususiyatlar (vergul bilan)</label>
              <input type="text" id="car-features" class="form-input" placeholder="Konditsioner, 360 kamera, Lyuk">
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" id="btn-cancel-car-modal">Bekor qilish</button>
              <button type="submit" class="btn btn-primary" id="btn-save-car">Saqlash</button>
            </div>
          </form>
        </div>
      </div>
    `;
  },

  initListeners() {
    // Open add modal
    const openBtn = document.getElementById('btn-open-add-car-modal');
    if (openBtn) {
      openBtn.onclick = () => {
        document.getElementById('car-modal-title').innerText = "Yangi Avtomobil Qo'shish";
        document.getElementById('car-form-id').value = '';
        document.getElementById('form-car-save').reset();
        document.getElementById('car-year').value = '2024';
        document.getElementById('car-image-url').value = 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80';
        document.getElementById('car-modal-overlay').classList.add('active');
      };
    }

    const closeBtn = document.getElementById('btn-close-car-modal');
    const cancelBtn = document.getElementById('btn-cancel-car-modal');
    const closeModal = () => document.getElementById('car-modal-overlay').classList.remove('active');
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    // Status change
    document.querySelectorAll('.car-status-change').forEach(sel => {
      sel.onchange = () => {
        const carId = parseInt(sel.getAttribute('data-car-id'), 10);
        this.updateCarStatus(carId, sel.value);
        if (window.App) window.App.showToast("Avtomobil holati o'zgartirildi", "success");
      };
    });

    // Delete car
    document.querySelectorAll('.btn-delete-car').forEach(btn => {
      btn.onclick = () => {
        const carId = parseInt(btn.getAttribute('data-car-id'), 10);
        if (confirm("Ushbu avtomobilni arxivlamoqchimisiz?")) {
          this.deleteCar(carId);
          if (window.App) {
            window.App.showToast("Avtomobil arxivlandi", "warning");
            window.App.navigate('fleet');
          }
        }
      };
    });

    // Edit car
    document.querySelectorAll('.btn-edit-car').forEach(btn => {
      btn.onclick = () => {
        const carId = parseInt(btn.getAttribute('data-car-id'), 10);
        const cars = DB.query("SELECT * FROM cars WHERE id = ?", [carId]);
        if (cars && cars.length > 0) {
          const c = cars[0];
          document.getElementById('car-modal-title').innerText = "Avtomobilni Tahrirlash";
          document.getElementById('car-form-id').value = c.id;
          document.getElementById('car-make').value = c.make;
          document.getElementById('car-model').value = c.model;
          document.getElementById('car-year').value = c.year;
          document.getElementById('car-category').value = c.category;
          document.getElementById('car-transmission').value = c.transmission;
          document.getElementById('car-fuel').value = c.fuel_type;
          document.getElementById('car-plate').value = c.plate_number;
          document.getElementById('car-daily-rate').value = c.daily_rate;
          document.getElementById('car-deposit').value = c.deposit_amount;
          document.getElementById('car-image-url').value = c.image_url;
          try {
            const feats = JSON.parse(c.features_json || '[]');
            document.getElementById('car-features').value = feats.join(', ');
          } catch(e) {
            document.getElementById('car-features').value = '';
          }
          document.getElementById('car-modal-overlay').classList.add('active');
        }
      };
    });

    // Form save
    const form = document.getElementById('form-car-save');
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault();
        const id = document.getElementById('car-form-id').value;
        const featuresStr = document.getElementById('car-features').value;
        const features = featuresStr.split(',').map(s => s.trim()).filter(s => s.length > 0);

        const carData = {
          make: document.getElementById('car-make').value.trim(),
          model: document.getElementById('car-model').value.trim(),
          year: document.getElementById('car-year').value,
          category: document.getElementById('car-category').value,
          transmission: document.getElementById('car-transmission').value,
          fuel_type: document.getElementById('car-fuel').value,
          plate_number: document.getElementById('car-plate').value.trim(),
          daily_rate: document.getElementById('car-daily-rate').value,
          deposit_amount: document.getElementById('car-deposit').value,
          image_url: document.getElementById('car-image-url').value.trim(),
          features
        };

        if (id) {
          this.updateCar(parseInt(id, 10), carData);
          if (window.App) window.App.showToast("Avtomobil ma'lumotlari yangilandi", "success");
        } else {
          this.addCar(carData);
          if (window.App) window.App.showToast("Yangi avtomobil qo'shildi", "success");
        }

        closeModal();
        if (window.App) window.App.navigate('fleet');
      };
    }

    // Excel Export
    const exportBtn = document.getElementById('btn-export-fleet-excel');
    if (exportBtn) {
      exportBtn.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.exportFleet();
          if (window.App) window.App.showToast("Avtopark Excel (.xlsx) fayliga yuklandi!", "success");
        }
      };
    }

    // Excel Template Download
    const templateBtn = document.getElementById('btn-download-fleet-template');
    if (templateBtn) {
      templateBtn.onclick = () => {
        if (typeof ExcelHelper !== 'undefined') {
          ExcelHelper.downloadFleetTemplate();
          if (window.App) window.App.showToast("Namuna Excel shabloni yuklab olindi", "info");
        }
      };
    }

    // Excel Import
    const fileInput = document.getElementById('fleet-excel-file-input');
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
              window.App.navigate('fleet');
            }
          } else {
            if (window.App) window.App.showToast("Xatolik: " + (res.error || "Faylni o'qib bo'lmadi"), "error");
          }
        }
        fileInput.value = '';
      };
    }
  }
};

if (typeof module !== 'undefined') {
  module.exports = FleetView;
}
if (typeof window !== 'undefined') {
  window.FleetView = FleetView;
}
