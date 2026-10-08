// js/app.js
// Main Application Controller, Router, and RBAC UI Orchestrator

const isNodeApp = typeof window === 'undefined';

const App = {
  currentView: 'client',

  async init() {
    console.log("RentCar App initializing...");
    try {
      if (typeof DB !== 'undefined') {
        await DB.init();
      }
      if (typeof Auth !== 'undefined') {
        Auth.init();
      }

      this.initNavbarBrand();
      this.updateAuthNavbar();
      this.updateNavbar();

      const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
      this.applyRoleTheme(role);

      // Route initial view based on role and auth
      if (typeof Auth !== 'undefined' && Auth.isAuthenticated() && ['admin', 'manager'].includes(role)) {
        this.navigate('dashboard');
      } else {
        this.navigate('client');
      }

      // Listen to auth and role changes
      if (!isNodeApp && window.addEventListener) {
        window.addEventListener('rentcar:role-changed', (e) => {
          this.handleRoleChange(e.detail.role);
        });
        window.addEventListener('rentcar:auth-changed', () => {
          this.updateAuthNavbar();
          this.updateNavbar();
        });
      }

      console.log("RentCar App initialized successfully!");
    } catch (err) {
      console.error("Initialization error:", err);
      const viewport = document.getElementById('app-viewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="text-align: center; padding: 60px 20px; color: var(--accent-rose);">
            <h2>Tizimni yuklashda xatolik yuz berdi</h2>
            <p style="color: var(--text-muted); margin-top: 10px;">${err.message}</p>
          </div>
        `;
      }
    }
  },

  applyRoleTheme(role) {
    if (isNodeApp || !document.body) return;
    document.body.setAttribute('data-role', role || 'client');
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) {
      themeMeta.setAttribute('content', role === 'client' ? '#f6f3ec' : '#0b1220');
    }
  },

  handleRoleChange(newRole) {
    this.applyRoleTheme(newRole);
    this.updateAuthNavbar();
    this.updateNavbar();
  },

  initNavbarBrand() {
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
      brandLogo.onclick = () => {
        const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
        if (['admin', 'manager'].includes(role)) {
          this.navigate('dashboard');
        } else {
          this.navigate('client');
        }
      };
    }

    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('main-nav-links');
    if (navToggle && navLinks) {
      navToggle.onclick = () => {
        navLinks.classList.toggle('open');
      };
    }
  },

  updateAuthNavbar() {
    const authArea = document.getElementById('auth-navbar-area');
    if (!authArea) return;

    const isAuth = typeof Auth !== 'undefined' && Auth.isAuthenticated();
    const user = isAuth ? Auth.getCurrentUser() : null;

    if (isAuth && user) {
      const roleLabel = user.role === 'admin' ? '🛡️ Admin' : (user.role === 'manager' ? '💼 Menejer' : '👤 Mijoz');
      authArea.innerHTML = `
        <div class="user-auth-badge">
          <span class="user-role-pill role-${user.role}">${roleLabel}</span>
          <span class="user-name-text" title="${user.full_name}">${user.full_name}</span>
          <button class="btn-logout-nav" id="btn-navbar-logout" title="Tizimdan chiqish">🚪 Chiqish</button>
        </div>
      `;

      const logoutBtn = document.getElementById('btn-navbar-logout');
      if (logoutBtn) {
        logoutBtn.onclick = () => {
          Auth.logout();
          this.navigate('client');
          this.showToast("Tizimdan muvaffaqiyatli chiqdingiz", "info");
        };
      }
    } else {
      authArea.innerHTML = `
        <button class="btn btn-sm btn-primary" id="btn-open-auth-modal" style="gap: 6px; padding: 7px 16px;">
          <span>🔑</span> Kirish
        </button>
      `;

      const loginBtn = document.getElementById('btn-open-auth-modal');
      if (loginBtn) {
        loginBtn.onclick = () => this.openAuthModal('login');
      }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  openAuthModal(defaultTab = 'login') {
    const overlay = document.getElementById('auth-modal-overlay');
    const content = document.getElementById('auth-modal-content');
    if (!overlay || !content) return;

    let activeTab = defaultTab;

    const renderModal = () => {
      content.innerHTML = `
        <div class="modal-header">
          <div>
            <h2 style="font-size: 1.25rem; margin-bottom: 4px; color: #ffffff;">RentCar Tizimiga Kirish</h2>
            <p style="font-size: 0.8rem; color: #94a3b8; margin: 0;">Rolga asoslangan RBAC xavfsiz boshqaruv</p>
          </div>
          <button class="modal-close-btn" id="btn-close-auth-modal">✕</button>
        </div>

        <div class="auth-tabs-row">
          <button type="button" class="auth-tab-btn ${activeTab === 'login' ? 'active' : ''}" id="tab-btn-login">
            🔑 Kirish
          </button>
          <button type="button" class="auth-tab-btn ${activeTab === 'register' ? 'active' : ''}" id="tab-btn-register">
            📝 Ro'yxatdan o'tish
          </button>
        </div>

        ${activeTab === 'login' ? `
          <!-- Login Form -->
          <form id="form-auth-login">
            <div class="form-group">
              <label class="form-label">Login (Foydalanuvchi nomi yoki Telefon) *</label>
              <input type="text" id="auth-login-user" class="form-input" placeholder="admin, manager yoki +998..." required autocomplete="username">
            </div>

            <div class="form-group">
              <label class="form-label">Parol *</label>
              <input type="password" id="auth-login-pass" class="form-input" placeholder="Parolingizni kiriting" required autocomplete="current-password">
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-auth-login" style="width: 100%; margin-top: 8px; padding: 11px;">
              Tizimga Kirish →
            </button>
          </form>

          <!-- Quick Demo Logins -->
          <div class="auth-demo-box">
            <div class="auth-demo-label">Sinash uchun tezkor kirish (1 bosishda):</div>
            <div class="auth-demo-chips">
              <button type="button" class="btn-demo-chip" data-demo-user="admin" data-demo-pass="admin123">
                <span>🛡️ Admin sifatida</span>
                <span class="chip-creds">admin / admin123</span>
              </button>
              <button type="button" class="btn-demo-chip" data-demo-user="manager" data-demo-pass="manager123">
                <span>💼 Menejer sifatida</span>
                <span class="chip-creds">manager / manager123</span>
              </button>
              <button type="button" class="btn-demo-chip" data-demo-user="client" data-demo-pass="client123">
                <span>👤 Mijoz sifatida</span>
                <span class="chip-creds">client / client123</span>
              </button>
            </div>
          </div>
        ` : `
          <!-- Register Form -->
          <form id="form-auth-register">
            <div class="form-group">
              <label class="form-label">To'liq Ism-Familiyangiz *</label>
              <input type="text" id="auth-reg-name" class="form-input" placeholder="Masalan: Bekzod Rahimov" required>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Login (Username) *</label>
                <input type="text" id="auth-reg-user" class="form-input" placeholder="bekzod_01" required autocomplete="username">
              </div>
              <div class="form-group">
                <label class="form-label">Telefon *</label>
                <input type="tel" id="auth-reg-phone" class="form-input" placeholder="+998901234567" required autocomplete="tel">
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Parol *</label>
              <input type="password" id="auth-reg-pass" class="form-input" placeholder="Yangi parol" required autocomplete="new-password">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <div class="form-group">
                <label class="form-label">Pasport / ID (ixtiyoriy)</label>
                <input type="text" id="auth-reg-passport" class="form-input" placeholder="AA1234567">
              </div>
              <div class="form-group">
                <label class="form-label">Prava raqami (ixtiyoriy)</label>
                <input type="text" id="auth-reg-license" class="form-input" placeholder="AB9876543">
              </div>
            </div>

            <button type="submit" class="btn btn-primary" id="btn-submit-auth-register" style="width: 100%; margin-top: 8px; padding: 11px;">
              Ro'yxatdan O'tish va Kirish →
            </button>
          </form>
        `}
      `;

      // Close modal
      const closeBtn = document.getElementById('btn-close-auth-modal');
      if (closeBtn) closeBtn.onclick = () => this.closeAuthModal();

      // Tab switcher
      const tabLogin = document.getElementById('tab-btn-login');
      const tabRegister = document.getElementById('tab-btn-register');
      if (tabLogin) {
        tabLogin.onclick = () => {
          activeTab = 'login';
          renderModal();
        };
      }
      if (tabRegister) {
        tabRegister.onclick = () => {
          activeTab = 'register';
          renderModal();
        };
      }

      // Demo quick-logins
      document.querySelectorAll('.btn-demo-chip').forEach(btn => {
        btn.onclick = () => {
          const u = btn.getAttribute('data-demo-user');
          const p = btn.getAttribute('data-demo-pass');
          this.executeLogin(u, p);
        };
      });

      // Handle Login submit
      const loginForm = document.getElementById('form-auth-login');
      const loginBtn = document.getElementById('btn-submit-auth-login');

      const handleLogin = (e) => {
        if (e) e.preventDefault();
        const userEl = document.getElementById('auth-login-user');
        const passEl = document.getElementById('auth-login-pass');
        if (!userEl || !passEl) return;
        const u = userEl.value.trim();
        const p = passEl.value;

        if (!u) {
          this.showToast("Iltimos, login yoki telefon raqamingizni kiriting", "warning");
          userEl.focus();
          return;
        }
        if (!p) {
          this.showToast("Iltimos, parolingizni kiriting", "warning");
          passEl.focus();
          return;
        }

        this.executeLogin(u, p);
      };

      if (loginForm) loginForm.onsubmit = handleLogin;
      if (loginBtn) loginBtn.onclick = handleLogin;

      // Handle Register submit
      const regForm = document.getElementById('form-auth-register');
      const regBtn = document.getElementById('btn-submit-auth-register');

      const handleRegister = (e) => {
        if (e) e.preventDefault();
        const nameEl = document.getElementById('auth-reg-name');
        const userEl = document.getElementById('auth-reg-user');
        const phoneEl = document.getElementById('auth-reg-phone');
        const passEl = document.getElementById('auth-reg-pass');
        const passpEl = document.getElementById('auth-reg-passport');
        const licEl = document.getElementById('auth-reg-license');

        if (!nameEl || !userEl || !phoneEl || !passEl) return;

        const name = nameEl.value.trim();
        const username = userEl.value.trim();
        const phone = phoneEl.value.trim();
        const password = passEl.value;
        const passport = passpEl ? passpEl.value.trim() : '';
        const license = licEl ? licEl.value.trim() : '';

        if (!name) {
          this.showToast("Iltimos, to'liq ism-familiyangizni kiriting", "warning");
          nameEl.focus();
          return;
        }
        if (!username) {
          this.showToast("Iltimos, foydalanuvchi nomini (login) kiriting", "warning");
          userEl.focus();
          return;
        }
        if (!phone) {
          this.showToast("Iltimos, telefon raqamingizni kiriting", "warning");
          phoneEl.focus();
          return;
        }
        if (!password) {
          this.showToast("Iltimos, parolingizni kiriting", "warning");
          passEl.focus();
          return;
        }

        const result = Auth.register({
          full_name: name,
          username,
          phone,
          password,
          passport_no: passport,
          license_no: license
        });

        if (result.success) {
          this.closeAuthModal();
          this.navigate('client');
          this.showToast(`Ro'yxatdan o'tish muvaffaqiyatli! Xush kelibsiz, ${result.user.full_name}`, "success");
        } else {
          this.showToast(result.error || "Ro'yxatdan o'tishda xatolik", "error");
        }
      };

      if (regForm) regForm.onsubmit = handleRegister;
      if (regBtn) regBtn.onclick = handleRegister;
    };

    renderModal();
    overlay.classList.add('active');
  },

  executeLogin(username, password) {
    if (typeof Auth === 'undefined') return;
    const res = Auth.login(username, password);

    if (res.success) {
      this.closeAuthModal();
      const user = res.user;

      // Role-based automatic redirection
      if (user.role === 'admin') {
        this.navigate('dashboard');
        this.showToast(`Xush kelibsiz, Admin ${user.full_name}!`, "success");
      } else if (user.role === 'manager') {
        this.navigate('dashboard');
        this.showToast(`Xush kelibsiz, Menejer ${user.full_name}!`, "success");
      } else {
        this.navigate('client');
        this.showToast(`Xush kelibsiz, ${user.full_name}!`, "success");
      }
    } else {
      this.showToast(res.error || "Login yoki parol noto'g'ri", "error");
    }
  },

  closeAuthModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) overlay.classList.remove('active');
  },

  updateNavbar() {
    const navContainer = document.getElementById('main-nav-links');
    if (!navContainer) return;
    const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';

    if (role === 'client') {
      navContainer.innerHTML = `
        <span class="nav-item ${this.currentView === 'client' ? 'active' : ''}" data-nav="client">
          <i data-lucide="layout-grid" style="width:15px;height:15px;"></i> Avtopark Katalogi
        </span>
        <span class="nav-item ${this.currentView === 'my-bookings' ? 'active' : ''}" data-nav="my-bookings">
          <i data-lucide="package" style="width:15px;height:15px;"></i> Mening Buyurtmalarim
        </span>
      `;
    } else {
      navContainer.innerHTML = `
        <span class="nav-item ${this.currentView === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
          <i data-lucide="bar-chart-2" style="width:15px;height:15px;"></i> Dashboard
        </span>
        <span class="nav-item ${this.currentView === 'fleet' ? 'active' : ''}" data-nav="fleet">
          <i data-lucide="car" style="width:15px;height:15px;"></i> Avtopark
        </span>
        <span class="nav-item ${this.currentView === 'bookings' ? 'active' : ''}" data-nav="bookings">
          <i data-lucide="clipboard-list" style="width:15px;height:15px;"></i> Buyurtmalar
        </span>
        <span class="nav-item ${this.currentView === 'crm' ? 'active' : ''}" data-nav="crm">
          <i data-lucide="users" style="width:15px;height:15px;"></i> Mijozlar
        </span>
        ${role === 'admin' ? `
          <span class="nav-item ${this.currentView === 'reports' ? 'active' : ''}" data-nav="reports">
            <i data-lucide="wallet" style="width:15px;height:15px;"></i> Moliya & Baza
          </span>
        ` : ''}
      `;
    }

    navContainer.querySelectorAll('.nav-item').forEach(item => {
      item.onclick = () => {
        const view = item.getAttribute('data-nav');
        navContainer.classList.remove('open');
        this.navigate(view);
      };
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  navigate(viewName) {
    // RBAC Route Guarding
    if (typeof Auth !== 'undefined') {
      const canAccess = Auth.canAccess(viewName);
      if (!canAccess) {
        if (!Auth.isAuthenticated()) {
          this.showToast("Ushbu bo'limga kirish uchun avval tizimga kiring", "warning");
          this.openAuthModal('login');
          return;
        } else {
          this.showToast("Kechirasiz, sizning rolingizda ushbu sahifaga ruxsat yo'q", "error");
          return;
        }
      }
    }

    this.currentView = viewName;
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
    this.applyRoleTheme(role);
    this.updateNavbar();
    this.updateAuthNavbar();

    // 1. Client Views
    if (role === 'client' || viewName === 'client' || viewName === 'my-bookings') {
      if (typeof ClientView === 'undefined') return;

      viewport.innerHTML = ClientView.render();
      ClientView.initListeners();

      if (viewName === 'my-bookings') {
        const mySec = document.getElementById('my-bookings-section');
        if (mySec) {
          mySec.style.display = 'block';
          mySec.scrollIntoView({ behavior: 'smooth' });
        }
      }
      return;
    }

    // 2. Admin & Manager Views (Layout with Sidebar)
    const activeSubView = ['dashboard', 'fleet', 'bookings', 'crm', 'reports'].includes(viewName) 
      ? viewName 
      : 'dashboard';

    let subViewContent = '';
    if (activeSubView === 'dashboard' && typeof DashboardView !== 'undefined') {
      subViewContent = DashboardView.render();
    } else if (activeSubView === 'fleet' && typeof FleetView !== 'undefined') {
      subViewContent = FleetView.render();
    } else if (activeSubView === 'bookings' && typeof BookingsView !== 'undefined') {
      subViewContent = BookingsView.render();
    } else if (activeSubView === 'crm' && typeof CrmView !== 'undefined') {
      subViewContent = CrmView.render();
    } else if (activeSubView === 'reports' && typeof ReportsView !== 'undefined') {
      subViewContent = ReportsView.render();
    }

    const currentUser = (typeof Auth !== 'undefined') ? Auth.getCurrentUser() : null;
    const userName = currentUser ? currentUser.full_name : 'Foydalanuvchi';

    viewport.innerHTML = `
      <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar">
          <div style="padding: 12px 14px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-bottom: 16px; border: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Tizim Foydalanuvchisi</div>
            <div style="font-weight: 800; color: #ffffff; font-size: 0.95rem; margin-top: 2px;">${userName}</div>
            <div style="font-size: 0.75rem; color: ${role === 'admin' ? '#34d399' : '#38bdf8'}; font-weight: 700; margin-top: 2px;">
              ${role === 'admin' ? '🛡️ Administrator' : '💼 Menejer'}
            </div>
          </div>

          <div class="sidebar-heading">Boshqaruv Bo'limlari</div>
          
          <div class="sidebar-link ${activeSubView === 'dashboard' ? 'active' : ''}" data-admin-view="dashboard">
            <span class="link-icon"><i data-lucide="bar-chart-2" style="width:17px;height:17px;"></i></span>
            <span>Dashboard</span>
          </div>

          <div class="sidebar-link ${activeSubView === 'fleet' ? 'active' : ''}" data-admin-view="fleet">
            <span class="link-icon"><i data-lucide="car" style="width:17px;height:17px;"></i></span>
            <span>Avtopark Nazorati</span>
          </div>

          <div class="sidebar-link ${activeSubView === 'bookings' ? 'active' : ''}" data-admin-view="bookings">
            <span class="link-icon"><i data-lucide="clipboard-list" style="width:17px;height:17px;"></i></span>
            <span>Buyurtmalar & Aktlar</span>
          </div>

          <div class="sidebar-link ${activeSubView === 'crm' ? 'active' : ''}" data-admin-view="crm">
            <span class="link-icon"><i data-lucide="users" style="width:17px;height:17px;"></i></span>
            <span>Mijozlar Bazasi</span>
          </div>

          ${role === 'admin' ? `
            <div class="sidebar-link ${activeSubView === 'reports' ? 'active' : ''}" data-admin-view="reports">
              <span class="link-icon"><i data-lucide="wallet" style="width:17px;height:17px;"></i></span>
              <span>Moliya & SQLite Baza</span>
            </div>
          ` : ''}

          <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-color); display: flex; flex-direction: column; gap: 8px;">
            <button class="btn btn-secondary btn-sm" id="btn-sidebar-view-client" style="width: 100%; justify-content: center; gap: 6px;">
              <i data-lucide="globe" style="width:14px;height:14px;"></i> Mijoz Sahifasini Ko'rish
            </button>
            <button class="btn btn-secondary btn-sm" id="btn-sidebar-logout" style="width: 100%; justify-content: center; gap: 6px; color: var(--accent-rose);">
              <span>🚪</span> Tizimdan Chiqish
            </button>
          </div>
        </aside>

        <!-- Main Workspace -->
        <section class="admin-main">
          ${subViewContent}
        </section>
      </div>
    `;

    // Attach sub-view listeners
    if (activeSubView === 'dashboard' && typeof DashboardView !== 'undefined') {
      DashboardView.initListeners();
    } else if (activeSubView === 'fleet' && typeof FleetView !== 'undefined') {
      FleetView.initListeners();
    } else if (activeSubView === 'bookings' && typeof BookingsView !== 'undefined') {
      BookingsView.initListeners();
    } else if (activeSubView === 'crm' && typeof CrmView !== 'undefined') {
      CrmView.initListeners();
    } else if (activeSubView === 'reports' && typeof ReportsView !== 'undefined') {
      ReportsView.initListeners();
    }

    // Sidebar listeners
    document.querySelectorAll('.sidebar-link').forEach(link => {
      link.onclick = () => {
        const v = link.getAttribute('data-admin-view');
        this.navigate(v);
      };
    });

    const clientBtn = document.getElementById('btn-sidebar-view-client');
    if (clientBtn) {
      clientBtn.onclick = () => {
        this.navigate('client');
      };
    }

    const sidebarLogoutBtn = document.getElementById('btn-sidebar-logout');
    if (sidebarLogoutBtn) {
      sidebarLogoutBtn.onclick = () => {
        Auth.logout();
        this.navigate('client');
        this.showToast("Tizimdan chiqdingiz", "info");
      };
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  showToast(message, type = 'info') {
    if (isNodeApp) {
      console.log(`[TOAST ${type.toUpperCase()}]: ${message}`);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
      <span style="font-size: 1.2rem;">${icon}</span>
      <div style="flex-grow: 1;">${message}</div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

if (!isNodeApp && typeof window !== 'undefined') {
  window.App = App;
  window.addEventListener('DOMContentLoaded', () => {
    App.init();
  });
}
if (typeof module !== 'undefined') {
  module.exports = App;
}
