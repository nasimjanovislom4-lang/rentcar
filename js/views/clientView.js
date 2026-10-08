// js/views/clientView.js
// Client Portal View: Search, Filtering, Booking Wizard, and My Bookings

const isNodeClientView = typeof window === 'undefined';

const ClientView = {
  activeCategory: 'all',
  searchCriteria: {
    pickup: 'Toshkent Xalqaro Aeroporti',
    returnLoc: 'Toshkent Xalqaro Aeroporti',
    startDate: '',
    endDate: '',
    category: 'all'
  },
  selectedCar: null,
  wizardStep: 1,
  wizardData: {
    days: 3,
    services: [],
    userName: '',
    phone: '',
    passportNo: '',
    licenseNo: '',
    paymentMethod: 'click'
  },

  servicePrices: {
    kasko: { name: "KASKO sug'urta", daily: 80000, desc: "To'liq sug'urta himoyasi (franchizasiz)" },
    child_seat: { name: "Bolalar o'rindig'i", daily: 30000, desc: "0-7 yoshli bolalar uchun xavfsiz o'rindiq" },
    gps: { name: "GPS navigator", daily: 20000, desc: "Oflayn xaritalar va tezlik radarlari bilan" }
  },

  carVideosByName: {
    'onix': 'assets/video/onix.mp4',
    'tracker': 'assets/video/tracer.mp4',
    'tracer': 'assets/video/tracer.mp4',
    'malibu': 'assets/video/malibu.mp4',
    'champion': 'assets/video/BYD chempion.mp4',
    'song': 'assets/video/BYD chempion.mp4',
    'yuan': 'assets/video/yaun up.mp4',
    'yaun': 'assets/video/yaun up.mp4',
    'l9': 'assets/video/li 9.mp4',
    'lixiang': 'assets/video/li 9.mp4',
    'li 9': 'assets/video/li 9.mp4',
    'land cruiser': 'assets/video/land cruzer 200.mp4',
    'cruzer': 'assets/video/land cruzer 200.mp4',
    'gentra': 'assets/video/jentro.mp4',
    'jentro': 'assets/video/jentro.mp4',
    'zeekr': 'assets/video/zeekr 9X.mp4'
  },

  companyCard: {
    number: '8600 5500 1234 9012',
    rawNumber: '8600550012349012',
    holder: 'RENTCAR AVTO MCHJ',
    bank: "O'zmilliybank (NBU)"
  },

  generateSmsText(userName, carName, totalAmount, bookingCode) {
    const formattedAmount = (totalAmount || 0).toLocaleString('ru-RU');
    return `Hurmatli ${userName || 'Mijoz'}! ${carName} uchun ${formattedAmount} so'm to'lovingiz qabul qilindi. Tasdiqlash kodi: ${bookingCode}. Mashinani qabul qilishda ushbu kodni taqdim eting. Tel: +998 71 200-01-01`;
  },

  getCarVideo(car) {
    if (!car) return '';
    if (car.video_url) return this.encodeAsset(car.video_url);

    const name = `${car.make || ''} ${car.model || ''}`.toLowerCase();
    for (const [key, path] of Object.entries(this.carVideosByName)) {
      if (name.includes(key)) {
        return this.encodeAsset(path);
      }
    }
    return '';
  },

  encodeAsset(path) {
    if (!path) return '';
    return path.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  },

  filterCars(criteria = {}) {
    if (typeof DB === 'undefined') return [];
    let sql = "SELECT * FROM cars WHERE status != 'archived'";
    const params = [];

    if (criteria.category && criteria.category !== 'all') {
      sql += " AND category = ?";
      params.push(criteria.category);
    }
    if (criteria.transmission && criteria.transmission !== 'all') {
      sql += " AND transmission = ?";
      params.push(criteria.transmission);
    }
    if (criteria.fuel_type && criteria.fuel_type !== 'all') {
      sql += " AND fuel_type = ?";
      params.push(criteria.fuel_type);
    }
    if (criteria.max_price) {
      sql += " AND daily_rate <= ?";
      params.push(criteria.max_price);
    }
    sql += " ORDER BY daily_rate ASC";
    return DB.query(sql, params);
  },

  calculateTotal(dailyRate, days, services = []) {
    const validDays = Math.max(1, parseInt(days) || 1);
    let serviceDailySum = 0;
    const serviceNames = [];

    services.forEach(s => {
      const key = s.toLowerCase();
      if (this.servicePrices[key]) {
        serviceDailySum += this.servicePrices[key].daily;
        serviceNames.push(this.servicePrices[key].name);
      }
    });

    const carRentalTotal = dailyRate * validDays;
    const servicesTotal = serviceDailySum * validDays;
    const totalAmount = carRentalTotal + servicesTotal;

    return {
      days: validDays,
      dailyRate,
      carRentalTotal,
      servicesTotal,
      totalAmount,
      serviceNames
    };
  },

  checkBookingConflict(carId, startDate, endDate) {
    if (typeof DB === 'undefined') return false;
    const sql = `
      SELECT id, booking_code, start_date, end_date FROM bookings 
      WHERE car_id = ? 
        AND status NOT IN ('cancelled', 'completed')
        AND NOT (end_date < ? OR start_date > ?)
    `;
    const conflicts = DB.query(sql, [carId, startDate, endDate]);
    return conflicts.length > 0;
  },

  submitBooking(data) {
    if (typeof DB === 'undefined') {
      return { success: false, error: 'Database not initialized' };
    }

    // 1. Validate dates
    if (!data.start_date || !data.end_date) {
      return { success: false, error: "Boshlanish va tugash sanasini tanlang" };
    }
    if (data.start_date > data.end_date) {
      return { success: false, error: "Qaytarish sanasi olish sanasidan oldin bo'lishi mumkin emas" };
    }

    // 2. Check blacklist
    if (typeof Auth !== 'undefined' && Auth.isPhoneBlacklisted(data.phone)) {
      return { success: false, error: "Kechirasiz, ushbu mijoz qora ro'yxatda (blacklist) turibdi. Bron qilish taqiqlangan." };
    }

    // 3. Check car availability & conflict
    const carList = DB.query("SELECT * FROM cars WHERE id = ?", [data.car_id]);
    if (!carList || carList.length === 0) {
      return { success: false, error: "Avtomobil topilmadi" };
    }
    const car = carList[0];
    if (car.status === 'maintenance' || car.status === 'archived') {
      return { success: false, error: "Ushbu avtomobil hozirda xizmatda emas (" + car.status + ")" };
    }

    const hasConflict = this.checkBookingConflict(data.car_id, data.start_date, data.end_date);
    if (hasConflict) {
      return { success: false, error: "Kechirasiz, ushbu avtomobil tanlangan muddatda allaqachon band qilingan" };
    }

    // 4. Calculate duration & price
    const sDate = new Date(data.start_date);
    const eDate = new Date(data.end_date);
    const diffTime = Math.abs(eDate - sDate);
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) || 1;

    const calc = this.calculateTotal(car.daily_rate, diffDays, data.services || []);

    // 5. Ensure user exists or create
    let userId = null;
    const existingUsers = DB.query("SELECT id FROM users WHERE phone = ?", [data.phone]);
    if (existingUsers && existingUsers.length > 0) {
      userId = existingUsers[0].id;
      // Update details if provided
      DB.exec("UPDATE users SET full_name = COALESCE(?, full_name), passport_no = COALESCE(?, passport_no), license_no = COALESCE(?, license_no) WHERE id = ?",
        [data.user_name || null, data.passport_no || null, data.license_no || null, userId]);
    } else {
      DB.exec("INSERT INTO users (full_name, phone, role, passport_no, license_no, status) VALUES (?, ?, 'client', ?, ?, 'active')",
        [data.user_name || 'Mijoz', data.phone, data.passport_no || 'AA0000000', data.license_no || 'AB0000000']);
      const lastUser = DB.query("SELECT last_insert_rowid() as id");
      userId = lastUser[0].id;
    }

    // 6. Generate unique booking code
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingCode = `RC-2026-${randomSuffix}`;

    const paymentMethod = data.payment_method || 'click';
    const paymentStatus = ['click', 'payme', 'uzum', 'card'].includes(paymentMethod) ? 'paid' : 'pending';
    const bookingStatus = 'new';

    DB.exec(`
      INSERT INTO bookings (
        booking_code, user_id, car_id, pickup_location, return_location,
        start_date, end_date, total_days, daily_rate, additional_services_json,
        total_amount, deposit_amount, status, payment_method, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      bookingCode, userId, car.id,
      data.pickup_location || 'Toshkent Xalqaro Aeroporti',
      data.return_location || 'Toshkent Xalqaro Aeroporti',
      data.start_date, data.end_date,
      calc.days, car.daily_rate,
      JSON.stringify(calc.serviceNames),
      calc.totalAmount, car.deposit_amount,
      bookingStatus, paymentMethod, paymentStatus
    ]);

    const lastBooking = DB.query("SELECT last_insert_rowid() as id");
    const bookingId = lastBooking[0].id;

    // Log financial income transaction if paid
    if (paymentStatus === 'paid') {
      DB.exec(`
        INSERT INTO financial_transactions (booking_id, type, category, amount, payment_method, note)
        VALUES (?, 'income', 'ijara_tushumi', ?, ?, ?)
      `, [bookingId, calc.totalAmount, paymentMethod, `${bookingCode} ijara to'lovi (${car.make} ${car.model})`]);
    }

    return {
      success: true,
      bookingId,
      bookingCode,
      totalAmount: calc.totalAmount,
      depositAmount: car.deposit_amount
    };
  },

  cancelBooking(bookingId) {
    if (typeof DB === 'undefined') return false;
    const bookings = DB.query("SELECT status FROM bookings WHERE id = ?", [bookingId]);
    if (!bookings || bookings.length === 0) return false;
    const status = bookings[0].status;
    if (['new', 'confirmed'].includes(status)) {
      DB.exec("UPDATE bookings SET status = 'cancelled' WHERE id = ?", [bookingId]);
      return true;
    }
    return false;
  },

  render() {
    const cars = this.filterCars({ category: this.activeCategory });
    const categories = [
      { id: 'all', label: 'Barchasi' },
      { id: 'Ekonom', label: 'Ekonom' },
      { id: 'Biznes', label: 'Biznes' },
      { id: 'SUV', label: 'SUV & Krossover' },
      { id: 'Premium', label: 'Premium' },
      { id: 'Elektromobil', label: 'Elektromobil' }
    ];

    return `
      <div class="client-container">
        <!-- Hero Section -->
        <section class="hero-section">
          <div class="hero-kicker">Premium avtopark • Toshkent</div>
          <h1 class="hero-title">O'zbekistonda Ishonchli va Qulay <span class="text-accent">Avtomobillar Ijarasi</span></h1>
          <p class="hero-subtitle">Eng so'nggi rusumdagi avtomobillarni 3 qadamda onlayn band qiling. Yashirin to'lovlarsiz va tezkor topshirish.</p>

          <div class="hero-search-box">
            <div class="search-field">
              <label>Olish manzili</label>
              <select id="search-pickup" class="form-select">
                <option value="Toshkent Xalqaro Aeroporti">Toshkent Aeroporti (Islom Karimov)</option>
                <option value="Markaz (Amir Temur xiyoboni)">Markaz (Amir Temur xiyoboni)</option>
                <option value="Chilonzor filiali">Chilonzor filiali (Integro)</option>
                <option value="Yunusobod filiali">Yunusobod filiali (Mega Planet)</option>
              </select>
            </div>
            <div class="search-field">
              <label>Olish sanasi</label>
              <input type="date" id="search-start-date" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="search-field">
              <label>Qaytarish sanasi</label>
              <input type="date" id="search-end-date" class="form-input" value="${new Date(Date.now() + 3*86400000).toISOString().split('T')[0]}">
            </div>
            <div class="search-field">
              <label>Avtomobil toifasi</label>
              <select id="search-category" class="form-select">
                <option value="all">Barcha toifalar</option>
                <option value="Ekonom">Ekonom</option>
                <option value="Biznes">Biznes</option>
                <option value="SUV">SUV</option>
                <option value="Premium">Premium</option>
                <option value="Elektromobil">Elektromobil</option>
              </select>
            </div>
            <button id="btn-search-cars" class="btn btn-primary">
              <span>🔍 Avtomobil Qidirish</span>
            </button>
          </div>
        </section>

        <!-- Filter Bar -->
        <div class="catalog-filter-bar">
          <div class="filter-sort-group">
            <span class="filter-label">Narx bo'yicha saralash</span>
            <select id="sort-select" class="filter-select">
              <option value="asc">Arzon → Qimmat</option>
              <option value="desc">Qimmat → Arzon</option>
            </select>
          </div>
          <div class="filter-price-group">
            <span class="filter-label">Narx</span>
            <input type="number" id="price-min" class="filter-price-input" placeholder="min">
            <span class="filter-dash">&mdash;</span>
            <input type="number" id="price-max" class="filter-price-input" placeholder="max">
          </div>
          <div class="filter-actions">
            <button id="btn-apply-filter" class="btn-filter-apply">Filterni qo'llash</button>
            <button id="btn-reset-filter" class="btn-filter-reset">Bekor qilish</button>
          </div>
        </div>
        <div class="category-filter-bar">
          ${categories.map(c => `
            <button class="filter-chip ${this.activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">
              ${c.label}
            </button>
          `).join('')}
        </div>

        <!-- Car Catalog Grid -->
        <div class="car-grid" id="cars-catalog-grid">
          ${cars.length === 0 ? `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
              <h3>Kechirasiz, tanlangan parametrlar bo'yicha avtomobillar topilmadi</h3>
              <p class="text-secondary">Filtrlarni o'zgartirib ko'ring yoki boshqa toifani tanlang.</p>
            </div>
          ` : cars.map(car => this.renderCarCard(car)).join('')}
        </div>

        <!-- My Bookings Tab -->
        <section class="my-bookings-container" id="my-bookings-section" style="display: none;">
          <div class="admin-header-row">
            <h2>Mening Buyurtmalarim</h2>
            <div style="display: flex; gap: 10px;">
              <input type="text" id="my-booking-search-input" class="form-input" placeholder="Telefon yoki buyurtma kodi..." style="width: 250px;">
              <button id="btn-search-my-bookings" class="btn btn-secondary">Izlash</button>
            </div>
          </div>
          <div id="my-bookings-list">
            ${this.renderMyBookings()}
          </div>
        </section>
      </div>

      <!-- Booking Wizard Modal Container -->
      <div id="booking-modal-overlay" class="modal-overlay">
        <div class="modal-box" id="booking-modal-content">
          <!-- Dynamically filled by openBookingModal -->
        </div>
      </div>

      <!-- Car Video Preview Modal -->
      <div id="video-modal-overlay" class="modal-overlay">
        <div class="video-modal-box" id="video-modal-content">
          <!-- Dynamically filled by openVideoModal -->
        </div>
      </div>
    `;
  },

  renderCarCard(car) {
    const isAvail = car.status === 'available';
    const category = car.category || 'Premium';
    const imageSrc = this.encodeAsset(car.image_url);
    const videoSrc = this.getCarVideo(car);
    const isLandscape = `${car.make || ''} ${car.model || ''}`.toLowerCase().includes('zeekr');
    let features = [];
    try {
      features = JSON.parse(car.features_json || '[]').slice(0, 3);
    } catch (err) {
      features = [];
    }

    return `
      <div class="car-card car-card-new" data-car-id="${car.id}">
        <div class="car-img-wrap">
          <img
            src="${imageSrc}"
            alt="${car.make} ${car.model}"
            loading="lazy"
            onerror="this.src='https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80'"
          >
          ${videoSrc ? `
            <video muted loop playsinline preload="none" class="${isLandscape ? 'video-landscape' : ''}" poster="${imageSrc}">
              <source src="${videoSrc}" type="video/mp4">
            </video>
            <span class="car-media-badge" data-car-id="${car.id}">
              <i data-lucide="play" style="width:11px;height:11px;"></i> Video
            </span>
          ` : ''}
          ${!isAvail ? '<div class="car-unavail-overlay"><span>Band</span></div>' : ''}
        </div>
        <div class="car-card-new-body">
          <span class="car-cat-label">${category.toUpperCase()}</span>
          <h3 class="car-title-new">${car.make} ${car.model}</h3>
          <div class="car-meta-row">
            <span class="car-meta-chip">${car.year}</span>
            <span class="car-meta-chip">${car.transmission}</span>
            <span class="car-meta-chip">${car.fuel_type}</span>
            ${features.map(f => `<span class="car-meta-chip">${f}</span>`).join('')}
          </div>
          <div class="car-price-new">${(car.daily_rate).toLocaleString('ru-RU')} <span>UZS / kun</span></div>
          <div class="car-actions-new">
            <a class="btn-telegram-new" href="https://t.me/rentcar_uz" target="_blank">
              <i data-lucide="send" style="width:14px;height:14px;"></i>
              Telegramga yozish
            </a>
            <button class="btn-book-new btn-book-car" data-car-id="${car.id}" ${isAvail ? '' : 'disabled'}>
              ${isAvail ? 'Band qilish' : 'Band'}
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openBookingModal(carId) {
    if (typeof DB === 'undefined') return;
    const cars = DB.query("SELECT * FROM cars WHERE id = ?", [carId]);
    if (!cars || cars.length === 0) return;
    this.selectedCar = cars[0];
    this.wizardStep = 1;

    const startDateEl = document.getElementById('search-start-date');
    const endDateEl = document.getElementById('search-end-date');
    const sDate = startDateEl ? startDateEl.value : new Date().toISOString().split('T')[0];
    const eDate = endDateEl ? endDateEl.value : new Date(Date.now() + 3*86400000).toISOString().split('T')[0];

    const currentUser = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;

    this.wizardData = {
      carId,
      startDate: sDate,
      endDate: eDate,
      services: ['kasko'],
      userName: currentUser ? currentUser.full_name : '',
      phone: currentUser ? currentUser.phone : '+998',
      passportNo: currentUser ? currentUser.passport_no || '' : '',
      licenseNo: currentUser ? currentUser.license_no || '' : '',
      paymentMethod: 'click'
    };

    this.renderBookingModalContent();
    const modal = document.getElementById('booking-modal-overlay');
    if (modal) modal.classList.add('active');
  },

  renderBookingModalContent() {
    const modalBox = document.getElementById('booking-modal-content');
    if (!modalBox || !this.selectedCar) return;

    const car = this.selectedCar;
    const calc = this.calculateTotal(car.daily_rate, this.calculateDays(this.wizardData.startDate, this.wizardData.endDate), this.wizardData.services);

    modalBox.innerHTML = `
      <div class="modal-header">
        <div>
          <h2 style="font-size: 1.35rem; margin-bottom: 4px;">${car.make} ${car.model} (${car.year})</h2>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${car.category} • ${(car.daily_rate).toLocaleString()} so'm/kun</p>
        </div>
        <button class="modal-close-btn" id="btn-close-modal">✕</button>
      </div>

      <!-- Step Navigation -->
      <div class="wizard-steps">
        <div class="wizard-step-item ${this.wizardStep >= 1 ? 'active' : ''}">
          <div class="wizard-step-circle">1</div>
          <span>Sanalar & Xizmatlar</span>
        </div>
        <div class="wizard-step-item ${this.wizardStep >= 2 ? 'active' : ''}">
          <div class="wizard-step-circle">2</div>
          <span>Mijoz Ma'lumotlari</span>
        </div>
        <div class="wizard-step-item ${this.wizardStep >= 3 ? 'active' : ''}">
          <div class="wizard-step-circle">3</div>
          <span>To'lov & Tasdiq</span>
        </div>
      </div>

      <!-- Step 1 -->
      <div class="wizard-step-content ${this.wizardStep === 1 ? '' : 'hidden'}">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div class="form-group">
            <label class="form-label">Olish sanasi</label>
            <input type="date" id="wizard-start-date" class="form-input" value="${this.wizardData.startDate}">
          </div>
          <div class="form-group">
            <label class="form-label">Qaytarish sanasi</label>
            <input type="date" id="wizard-end-date" class="form-input" value="${this.wizardData.endDate}">
          </div>
        </div>

        <h4 style="margin-bottom: 12px; font-size: 0.95rem;">Qo'shimcha Qulayliklar va Xizmatlar</h4>
        
        <div class="addon-card ${this.wizardData.services.includes('kasko') ? 'selected' : ''}" data-service="kasko">
          <div>
            <div style="font-weight: 700;">🛡️ KASKO sug'urta paketi</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Franchizasiz to'liq himoya (tavsiya etiladi)</div>
          </div>
          <div style="font-weight: 700; color: var(--accent-emerald);">+80,000 so'm/kun</div>
        </div>

        <div class="addon-card ${this.wizardData.services.includes('child_seat') ? 'selected' : ''}" data-service="child_seat">
          <div>
            <div style="font-weight: 700;">👶 Bolalar o'rindig'i (Isofix)</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">0-7 yoshli bolalar uchun maxsus xavfsizlik</div>
          </div>
          <div style="font-weight: 700; color: var(--accent-emerald);">+30,000 so'm/kun</div>
        </div>

        <div class="addon-card ${this.wizardData.services.includes('gps') ? 'selected' : ''}" data-service="gps">
          <div>
            <div style="font-weight: 700;">📡 GPS Navigator & Radar-detektor</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Oflayn xarita va tezlik kameralari ogohlantiruvchisi</div>
          </div>
          <div style="font-weight: 700; color: var(--accent-emerald);">+20,000 so'm/kun</div>
        </div>

        <!-- Price Summary Box -->
        <div class="booking-summary-box" style="background: var(--bg-surface); padding: 14px 18px; border-radius: var(--radius-md); margin-top: 18px; border: 1px solid var(--border-color);">
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span>Ijara muddati:</span>
            <span style="font-weight: 700;">${calc.days} kun</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
            <span>Avtomobil ijarasi:</span>
            <span>${(calc.carRentalTotal).toLocaleString()} so'm</span>
          </div>
          ${calc.servicesTotal > 0 ? `
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
              <span>Qo'shimcha xizmatlar:</span>
              <span>+${(calc.servicesTotal).toLocaleString()} so'm</span>
            </div>
          ` : ''}
          <div style="display: flex; justify-content: space-between; font-size: 1.1rem; font-weight: 800; border-top: 1px solid var(--border-color); padding-top: 8px; margin-top: 8px;">
            <span>Jami summa:</span>
            <span class="text-accent">${(calc.totalAmount).toLocaleString()} so'm</span>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 20px;">
          <button class="btn btn-primary" id="btn-wizard-next-1">Davom etish (2-qadam) →</button>
        </div>
      </div>

      <!-- Step 2 -->
      <div class="wizard-step-content ${this.wizardStep === 2 ? '' : 'hidden'}">
        <div class="form-group">
          <label class="form-label">To'liq ism-familiyangiz *</label>
          <input type="text" id="wizard-user-name" class="form-input" placeholder="Masalan: Jasur Bekmirzayev" value="${this.wizardData.userName}">
        </div>

        <div class="form-group">
          <label class="form-label">Telefon raqamingiz *</label>
          <input type="tel" id="wizard-phone" class="form-input" placeholder="+998901234567" value="${this.wizardData.phone}">
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div class="form-group">
            <label class="form-label">Pasport / ID-karta seriyasi *</label>
            <input type="text" id="wizard-passport" class="form-input" placeholder="AA1234567" value="${this.wizardData.passportNo}">
          </div>
          <div class="form-group">
            <label class="form-label">Prava (Guvohnoma) raqami *</label>
            <input type="text" id="wizard-license" class="form-input" placeholder="AB9876543" value="${this.wizardData.licenseNo}">
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 20px;">
          <button class="btn btn-secondary" id="btn-wizard-prev-2">← Ortga</button>
          <button class="btn btn-primary" id="btn-wizard-next-2">To'lovga o'tish (3-qadam) →</button>
        </div>
      </div>

      <!-- Step 3 -->
      <div class="wizard-step-content ${this.wizardStep === 3 ? '' : 'hidden'}">
        <h4 style="margin-bottom: 12px; font-size: 0.95rem;">To'lov usulini tanlang</h4>
        
        <div class="payment-grid">
          <div class="payment-option-card ${this.wizardData.paymentMethod === 'click' ? 'selected' : ''}" data-pay="click">
            <div style="color: #0088cc; font-size: 1.2rem; margin-bottom: 4px;">⚡ Click Up</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Tezkor onlayn to'lov</div>
          </div>
          <div class="payment-option-card ${this.wizardData.paymentMethod === 'payme' ? 'selected' : ''}" data-pay="payme">
            <div style="color: #00cccc; font-size: 1.2rem; margin-bottom: 4px;">💳 Payme</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Kartadan to'lov</div>
          </div>
          <div class="payment-option-card ${this.wizardData.paymentMethod === 'uzum' ? 'selected' : ''}" data-pay="uzum">
            <div style="color: #a855f7; font-size: 1.2rem; margin-bottom: 4px;">🍇 Uzum Pay</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Uzum bank / kartalar</div>
          </div>
          <div class="payment-option-card ${this.wizardData.paymentMethod === 'cash' ? 'selected' : ''}" data-pay="cash">
            <div style="color: var(--accent-gold); font-size: 1.2rem; margin-bottom: 4px;">💵 Joyida Naqd</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">Mashinani qabul qilganda</div>
          </div>
        </div>

        ${this.wizardData.paymentMethod !== 'cash' ? `
          <!-- Virtual Company Payment Card Box -->
          <div class="company-card-box">
            <div class="company-card-top">
              <div class="company-card-chip">
                <span class="chip-graphic">💳</span>
                <span class="card-brand-name">${this.companyCard.bank}</span>
              </div>
              <span class="card-system-badge">UZCARD • HUMO</span>
            </div>

            <div class="company-card-label">Kompaniyaning rasmiy to'lov kartasi:</div>
            <div class="company-card-number-row">
              <span class="company-card-digits" id="company-card-number-display">${this.companyCard.number}</span>
              <button type="button" class="btn-copy-card" id="btn-copy-card" title="Karta raqamidan nusxa olish">
                <span class="copy-icon">📋</span>
                <span class="copy-label">Nusxa olish</span>
              </button>
            </div>

            <div class="company-card-footer">
              <div>
                <div class="card-info-sub">Qabul qiluvchi:</div>
                <div class="card-info-val">${this.companyCard.holder}</div>
              </div>
              <div style="text-align: right;">
                <div class="card-info-sub">To'lov summasi:</div>
                <div class="card-info-val text-emerald">${(calc.totalAmount).toLocaleString('ru-RU')} UZS</div>
              </div>
            </div>

            <div class="payment-instruction-box">
              <div class="instruction-step">1. <strong>Nusxa olish</strong> tugmasini bosing va <strong>${this.wizardData.paymentMethod.toUpperCase()}</strong> ilovangiz orqali to'lovni bajaring.</div>
              <div class="instruction-step">2. To'lovni amalga oshirgach, pastdagi <strong>"To'lov qildim va Tasdiqlash"</strong> tugmasini bosing.</div>
              <div class="instruction-step">3. Tizim to'lovni qayd etib, <strong>summa va tasdiqlash kodi</strong> bilan SMS xabarnoma taqdim etadi.</div>
            </div>
          </div>
        ` : `
          <div class="cash-payment-box">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
              <span style="font-size: 1.8rem;">💵</span>
              <div>
                <div style="font-weight: 700; color: #ffffff; font-size: 1.05rem;">Joyida naqd to'lash</div>
                <div style="font-size: 0.85rem; color: #94a3b8;">Avtomobilni qabul qilib olayotganda kassaga to'lov qilasiz</div>
              </div>
            </div>
            <div style="font-size: 0.95rem; font-weight: 700; color: #34d399; margin-top: 8px;">
              To'lanadigan summa: ${(calc.totalAmount).toLocaleString('ru-RU')} so'm
            </div>
          </div>
        `}

        <div class="deposit-notice-box" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: var(--radius-md); padding: 14px; margin-top: 14px;">
          <div style="font-weight: 700; color: #34d399; margin-bottom: 4px;">To'lov summasi: ${(calc.totalAmount).toLocaleString('ru-RU')} so'm</div>
          <div style="font-size: 0.8rem; color: #cbd5e1;">Garov depoziti (${(car.deposit_amount).toLocaleString('ru-RU')} so'm) avtomobil topshirilayotganda bloklanadi va toza holatda qaytarilganda to'liq bekor qilinadi.</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-top: 24px; gap: 12px;">
          <button class="btn btn-secondary" id="btn-wizard-prev-3">← Ortga</button>
          <button class="btn btn-primary" id="btn-submit-booking">
            ${this.wizardData.paymentMethod === 'cash' ? "✅ Buyurtmani Tasdiqlash" : "✅ To'lov qildim va Tasdiqlash"}
          </button>
        </div>
      </div>
    `;

    this.initWizardListeners();
  },

  calculateDays(start, end) {
    if (!start || !end) return 3;
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil(Math.abs(e - s) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff) || 1;
  },

  initWizardListeners() {
    const closeBtn = document.getElementById('btn-close-modal');
    if (closeBtn) {
      closeBtn.onclick = () => {
        const modal = document.getElementById('booking-modal-overlay');
        if (modal) modal.classList.remove('active');
      };
    }

    // Step 1 Addons toggle
    document.querySelectorAll('.addon-card').forEach(card => {
      card.onclick = () => {
        const service = card.getAttribute('data-service');
        if (this.wizardData.services.includes(service)) {
          this.wizardData.services = this.wizardData.services.filter(s => s !== service);
        } else {
          this.wizardData.services.push(service);
        }
        this.renderBookingModalContent();
      };
    });

    // Step 1 Dates change
    const sDateInput = document.getElementById('wizard-start-date');
    const eDateInput = document.getElementById('wizard-end-date');
    if (sDateInput && eDateInput) {
      const updateDates = () => {
        this.wizardData.startDate = sDateInput.value;
        this.wizardData.endDate = eDateInput.value;
        this.renderBookingModalContent();
      };
      sDateInput.onchange = updateDates;
      eDateInput.onchange = updateDates;
    }

    // Step 1 -> Step 2
    const next1 = document.getElementById('btn-wizard-next-1');
    if (next1) {
      next1.onclick = () => {
        this.wizardStep = 2;
        this.renderBookingModalContent();
      };
    }

    // Step 2 -> Step 1
    const prev2 = document.getElementById('btn-wizard-prev-2');
    if (prev2) {
      prev2.onclick = () => {
        this.wizardStep = 1;
        this.renderBookingModalContent();
      };
    }

    // Step 2 -> Step 3
    const next2 = document.getElementById('btn-wizard-next-2');
    if (next2) {
      next2.onclick = () => {
        const nameEl = document.getElementById('wizard-user-name');
        const phoneEl = document.getElementById('wizard-phone');
        const passEl = document.getElementById('wizard-passport');
        const licEl = document.getElementById('wizard-license');

        if (!nameEl.value.trim() || !phoneEl.value.trim()) {
          if (window.App) window.App.showToast("Iltimos, ism va telefon raqamingizni kiriting", "error");
          return;
        }

        this.wizardData.userName = nameEl.value.trim();
        this.wizardData.phone = phoneEl.value.trim();
        this.wizardData.passportNo = passEl ? passEl.value.trim() : '';
        this.wizardData.licenseNo = licEl ? licEl.value.trim() : '';

        this.wizardStep = 3;
        this.renderBookingModalContent();
      };
    }

    // Step 3 Payment card select
    document.querySelectorAll('.payment-option-card').forEach(pCard => {
      pCard.onclick = () => {
        this.wizardData.paymentMethod = pCard.getAttribute('data-pay');
        this.renderBookingModalContent();
      };
    });

    // Step 3 Copy Card Number button
    const copyCardBtn = document.getElementById('btn-copy-card');
    if (copyCardBtn) {
      copyCardBtn.onclick = async (e) => {
        e.preventDefault();
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(this.companyCard.rawNumber);
          } else if (typeof document !== 'undefined') {
            const tempInput = document.createElement('input');
            tempInput.value = this.companyCard.rawNumber;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
          }
          copyCardBtn.innerHTML = '<span>✓ Nusxalandi!</span>';
          copyCardBtn.classList.add('copied');
          if (window.App) window.App.showToast("Karta raqami nusxalandi: " + this.companyCard.number, "success");
          setTimeout(() => {
            const btn = document.getElementById('btn-copy-card');
            if (btn) {
              btn.innerHTML = '<span class="copy-icon">📋</span><span class="copy-label">Nusxa olish</span>';
              btn.classList.remove('copied');
            }
          }, 2500);
        } catch (err) {
          if (window.App) window.App.showToast("Karta raqami: " + this.companyCard.number, "info");
        }
      };
    }

    // Step 3 -> Step 2
    const prev3 = document.getElementById('btn-wizard-prev-3');
    if (prev3) {
      prev3.onclick = () => {
        this.wizardStep = 2;
        this.renderBookingModalContent();
      };
    }

    // Step 3 Submit
    const submitBtn = document.getElementById('btn-submit-booking');
    if (submitBtn) {
      submitBtn.onclick = () => {
        submitBtn.disabled = true;
        submitBtn.innerText = "Tekshirilmoqda...";

        const result = this.submitBooking({
          car_id: this.selectedCar.id,
          user_name: this.wizardData.userName,
          phone: this.wizardData.phone,
          passport_no: this.wizardData.passportNo,
          license_no: this.wizardData.licenseNo,
          start_date: this.wizardData.startDate,
          end_date: this.wizardData.endDate,
          services: this.wizardData.services,
          payment_method: this.wizardData.paymentMethod
        });

        if (result.success) {
          const smsText = this.generateSmsText(
            this.wizardData.userName,
            `${this.selectedCar.make} ${this.selectedCar.model}`,
            result.totalAmount,
            result.bookingCode
          );

          const modalBox = document.getElementById('booking-modal-content');
          modalBox.innerHTML = `
            <div style="text-align: center; padding: 20px 10px;">
              <div style="font-size: 3.2rem; margin-bottom: 8px;">🎉</div>
              <h2 style="font-size: 1.55rem; color: #34d399; margin-bottom: 6px;">Buyurtma va To'lov Tasdiqlandi!</h2>
              <p style="color: #cbd5e1; font-size: 0.95rem; margin-bottom: 18px;">
                Buyurtma kodingiz: <strong style="color: #ffffff; font-size: 1.25rem;">${result.bookingCode}</strong>
              </p>

              <!-- Realistic SMS Notification Preview Card -->
              <div class="sms-notification-card">
                <div class="sms-header">
                  <div class="sms-sender">
                    <span class="sms-badge-icon">💬</span>
                    <div>
                      <div class="sms-sender-title">SMS Xabarnoma • RentCar.uz</div>
                      <div class="sms-sender-sub">Yuboruvchi: +998 71 200-01-01</div>
                    </div>
                  </div>
                  <span class="sms-time-badge">Hozir</span>
                </div>
                <div class="sms-body">
                  "${smsText}"
                </div>
                <div class="sms-footer">
                  <div class="sms-code-display">
                    <span class="sms-code-label">Tasdiqlash kodi:</span>
                    <strong class="sms-code-val" id="sms-booking-code-val">${result.bookingCode}</strong>
                  </div>
                  <button type="button" class="btn-copy-code" id="btn-copy-booking-code" title="Kodni nusxalash">
                    📋 Kodni nusxalash
                  </button>
                </div>
              </div>

              <!-- Booking summary details -->
              <div class="booking-success-summary" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.12); padding: 16px; border-radius: var(--radius-md); text-align: left; margin: 20px 0 24px; color: #ffffff;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                  <span style="color: #94a3b8;">Avtomobil:</span>
                  <strong style="color: #ffffff;">${this.selectedCar.make} ${this.selectedCar.model} (${this.selectedCar.year})</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                  <span style="color: #94a3b8;">Mijoz:</span>
                  <strong style="color: #ffffff;">${this.wizardData.userName} (${this.wizardData.phone})</strong>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.9rem;">
                  <span style="color: #94a3b8;">Ijara muddati:</span>
                  <span style="color: #ffffff;">${this.wizardData.startDate} — ${this.wizardData.endDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 0.95rem; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 8px;">
                  <span style="color: #94a3b8;">To'langan summa:</span>
                  <strong style="color: #34d399; font-size: 1.15rem;">${(result.totalAmount).toLocaleString('ru-RU')} so'm</strong>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8;">
                  <span>To'lov usuli:</span>
                  <span style="color: #38bdf8; font-weight: 600;">${this.wizardData.paymentMethod.toUpperCase()} (Qabul qilindi ✅)</span>
                </div>
              </div>

              <div style="display: flex; gap: 12px; justify-content: center;">
                <button class="btn btn-primary" id="btn-finish-booking" style="padding: 10px 32px;">Tushunarli</button>
              </div>
            </div>
          `;

          const copyCodeBtn = document.getElementById('btn-copy-booking-code');
          if (copyCodeBtn) {
            copyCodeBtn.onclick = async () => {
              try {
                if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(result.bookingCode);
                } else if (typeof document !== 'undefined') {
                  const tempInput = document.createElement('input');
                  tempInput.value = result.bookingCode;
                  document.body.appendChild(tempInput);
                  tempInput.select();
                  document.execCommand('copy');
                  document.body.removeChild(tempInput);
                }
                copyCodeBtn.innerText = "✓ Kod nusxalandi!";
                if (window.App) window.App.showToast("Tasdiqlash kodi nusxalandi: " + result.bookingCode, "success");
                setTimeout(() => {
                  const btn = document.getElementById('btn-copy-booking-code');
                  if (btn) btn.innerText = "📋 Kodni nusxalash";
                }, 2500);
              } catch (err) {
                if (window.App) window.App.showToast("Kodingiz: " + result.bookingCode, "info");
              }
            };
          }

          document.getElementById('btn-finish-booking').onclick = () => {
            document.getElementById('booking-modal-overlay').classList.remove('active');
            if (window.App) window.App.navigate('client');
          };
          if (window.App) window.App.showToast("To'lov va buyurtma muvaffaqiyatli qabul qilindi!", "success");
        } else {
          submitBtn.disabled = false;
          submitBtn.innerText = "Qayta urinish";
          if (window.App) window.App.showToast(result.error || "Xatolik yuz berdi", "error");
        }
      };
    }
  },

  renderMyBookings(phoneOrCode = '') {
    if (typeof DB === 'undefined') return '';
    let sql = `
      SELECT b.*, c.make, c.model, c.year, c.plate_number, c.image_url, u.full_name, u.phone
      FROM bookings b
      JOIN cars c ON b.car_id = c.id
      JOIN users u ON b.user_id = u.id
    `;
    const params = [];

    if (phoneOrCode && phoneOrCode.trim()) {
      sql += " WHERE b.booking_code LIKE ? OR u.phone LIKE ?";
      params.push(`%${phoneOrCode.trim()}%`, `%${phoneOrCode.trim()}%`);
    }
    sql += " ORDER BY b.id DESC";

    const bookings = DB.query(sql, params);
    if (!bookings || bookings.length === 0) {
      return `<p style="padding: 20px; color: var(--text-muted); text-align: center;">Hech qanday buyurtma topilmadi.</p>`;
    }

    return bookings.map(b => `
      <div class="booking-item-card">
        <div style="display: flex; align-items: center; gap: 16px;">
          <img src="${this.encodeAsset(b.image_url)}" alt="${b.make}" style="width: 70px; height: 50px; object-fit: cover; border-radius: var(--radius-sm);">
          <div>
            <div style="font-weight: 700; font-size: 1.05rem;">${b.make} ${b.model} (${b.year})</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">Kod: <strong>${b.booking_code}</strong> • ${b.start_date} dan ${b.end_date} gacha</div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-weight: 700; font-size: 1.1rem;">${(b.total_amount).toLocaleString()} so'm</div>
          <span class="badge badge-${b.status === 'confirmed' || b.status === 'picked_up' ? 'available' : (b.status === 'cancelled' ? 'danger' : 'maintenance')}">
            ${b.status}
          </span>
        </div>

        ${['new', 'confirmed'].includes(b.status) ? `
          <button class="btn btn-sm btn-danger btn-cancel-booking" data-booking-id="${b.id}">Bekor qilish</button>
        ` : ''}
      </div>
    `).join('');
  },

  initListeners() {
    // Category pills click
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.onclick = () => {
        this.activeCategory = chip.getAttribute('data-cat');
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        const grid = document.getElementById('cars-catalog-grid');
        if (grid) {
          const cars = this.filterCars({ category: this.activeCategory });
          grid.innerHTML = cars.map(car => this.renderCarCard(car)).join('');
          this.initCardButtons();
        }
      };
    });

    // Search button
    const searchBtn = document.getElementById('btn-search-cars');
    if (searchBtn) {
      searchBtn.onclick = () => {
        const catSelect = document.getElementById('search-category');
        this.activeCategory = catSelect ? catSelect.value : 'all';
        const grid = document.getElementById('cars-catalog-grid');
        if (grid) {
          const cars = this.filterCars({ category: this.activeCategory });
          grid.innerHTML = cars.map(car => this.renderCarCard(car)).join('');
          this.initCardButtons();
        }
      };
    }

    this.initCardButtons();
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Filter apply button
    const applyFilter = document.getElementById('btn-apply-filter');
    if (applyFilter) {
      applyFilter.onclick = () => {
        const minEl = document.getElementById('price-min');
        const maxEl = document.getElementById('price-max');
        const sortEl = document.getElementById('sort-select');
        const minPrice = minEl && minEl.value ? parseInt(minEl.value) : null;
        const maxPrice = maxEl && maxEl.value ? parseInt(maxEl.value) : null;
        const sortDir = sortEl ? sortEl.value : 'asc';
        const grid = document.getElementById('cars-catalog-grid');
        if (grid) {
          let cars = this.filterCars({ category: this.activeCategory, max_price: maxPrice });
          if (minPrice) cars = cars.filter(c => c.daily_rate >= minPrice);
          cars = cars.sort((a, b) => sortDir === 'desc' ? b.daily_rate - a.daily_rate : a.daily_rate - b.daily_rate);
          grid.innerHTML = cars.map(car => this.renderCarCard(car)).join('') || '<p style="grid-column:1/-1;text-align:center;padding:40px;color:#666;">Hech narsa topilmadi</p>';
          this.initCardButtons();
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      };
    }

    // Filter reset button
    const resetFilter = document.getElementById('btn-reset-filter');
    if (resetFilter) {
      resetFilter.onclick = () => {
        const minEl = document.getElementById('price-min');
        const maxEl = document.getElementById('price-max');
        const sortEl = document.getElementById('sort-select');
        if (minEl) minEl.value = '';
        if (maxEl) maxEl.value = '';
        if (sortEl) sortEl.value = 'asc';
        const grid = document.getElementById('cars-catalog-grid');
        if (grid) {
          const cars = this.filterCars({ category: this.activeCategory });
          grid.innerHTML = cars.map(car => this.renderCarCard(car)).join('');
          this.initCardButtons();
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      };
    }

    // My Bookings search
    const myBookingsSearchBtn = document.getElementById('btn-search-my-bookings');
    if (myBookingsSearchBtn) {
      myBookingsSearchBtn.onclick = () => {
        const input = document.getElementById('my-booking-search-input');
        const list = document.getElementById('my-bookings-list');
        if (list && input) {
          list.innerHTML = this.renderMyBookings(input.value);
          this.initCancelButtons();
        }
      };
    }
  },

  initCardButtons() {
    document.querySelectorAll('.btn-book-car').forEach(btn => {
      btn.onclick = () => {
        const carId = parseInt(btn.getAttribute('data-car-id'), 10);
        this.openBookingModal(carId);
      };
    });
    this.initCardVideos();
  },

  initCardVideos() {
    document.querySelectorAll('.car-card-new').forEach(card => {
      const video = card.querySelector('video');
      if (!video) return;
      const play = () => {
        card.classList.add('is-playing');
        video.play().catch(() => {});
      };
      const stop = () => {
        card.classList.remove('is-playing');
        video.pause();
        video.currentTime = 0;
      };
      card.addEventListener('mouseenter', play);
      card.addEventListener('mouseleave', stop);
      card.addEventListener('focusin', play);
      card.addEventListener('focusout', stop);

      const badge = card.querySelector('.car-media-badge');
      if (badge) {
        badge.addEventListener('click', (e) => {
          e.stopPropagation();
          const carId = parseInt(card.getAttribute('data-car-id'), 10);
          this.openVideoModal(carId);
        });
      }
    });
  },

  openVideoModal(carId) {
    if (typeof DB === 'undefined') return;
    const cars = DB.query("SELECT * FROM cars WHERE id = ?", [carId]);
    if (!cars || cars.length === 0) return;
    const car = cars[0];
    const videoSrc = this.getCarVideo(car);
    if (!videoSrc) return;

    const overlay = document.getElementById('video-modal-overlay');
    const content = document.getElementById('video-modal-content');
    if (!overlay || !content) return;

    content.innerHTML = `
      <div class="video-modal-header">
        <div>
          <span class="car-cat-label" style="font-size: 0.72rem;">${(car.category || 'Avto').toUpperCase()}</span>
          <h3 style="margin-top: 2px; font-size: 1.25rem;">${car.make} ${car.model} (${car.year})</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted);">${(car.daily_rate).toLocaleString()} UZS / kun</p>
        </div>
        <button class="modal-close-btn" id="btn-close-video-modal">✕</button>
      </div>
      <div class="video-modal-body">
        <video controls autoplay playsinline class="video-modal-player" poster="${this.encodeAsset(car.image_url)}">
          <source src="${videoSrc}" type="video/mp4">
        </video>
      </div>
      <div class="video-modal-footer">
        <button class="btn btn-secondary btn-sm" id="btn-close-video-modal-bottom">Yopish</button>
        <button class="btn btn-primary btn-sm btn-book-from-video" data-car-id="${car.id}">
          <i data-lucide="calendar" style="width:14px;height:14px;"></i> Band qilish
        </button>
      </div>
    `;

    overlay.classList.add('active');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const close = () => {
      const vid = content.querySelector('video');
      if (vid) vid.pause();
      overlay.classList.remove('active');
    };

    const closeBtn = document.getElementById('btn-close-video-modal');
    if (closeBtn) closeBtn.onclick = close;
    const closeBtn2 = document.getElementById('btn-close-video-modal-bottom');
    if (closeBtn2) closeBtn2.onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
    };

    const bookBtn = content.querySelector('.btn-book-from-video');
    if (bookBtn) {
      bookBtn.onclick = () => {
        close();
        this.openBookingModal(car.id);
      };
    }
  },

  initCancelButtons() {
    document.querySelectorAll('.btn-cancel-booking').forEach(btn => {
      btn.onclick = () => {
        const bId = parseInt(btn.getAttribute('data-booking-id'), 10);
        if (confirm("Rostdan ham buyurtmani bekor qilmoqchimisiz?")) {
          const ok = this.cancelBooking(bId);
          if (ok) {
            if (window.App) window.App.showToast("Buyurtma bekor qilindi", "warning");
            const input = document.getElementById('my-booking-search-input');
            const list = document.getElementById('my-bookings-list');
            if (list) list.innerHTML = this.renderMyBookings(input ? input.value : '');
            this.initCancelButtons();
          }
        }
      };
    });
  }
};

if (typeof module !== 'undefined') {
  module.exports = ClientView;
}
if (typeof window !== 'undefined') {
  window.ClientView = ClientView;
}
