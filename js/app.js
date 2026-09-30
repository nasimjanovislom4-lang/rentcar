// js/app.js
// Main Application Controller, Router, and UI Orchestrator

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

      this.initRoleSwitcher();
      this.updateNavbar();
      
      const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
      this.navigate(role === 'client' ? 'client' : 'dashboard');

      // Listen to role changes
      if (!isNodeApp && window.addEventListener) {
        window.addEventListener('rentcar:role-changed', (e) => {
          this.handleRoleChange(e.detail.role);
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

  handleRoleChange(newRole) {
    this.updateRoleButtons(newRole);
    this.updateNavbar();
    if (newRole === 'client') {
      this.navigate('client');
    } else {
      this.navigate('dashboard');
    }
    this.showToast(`Rol o'zgartirildi: ${newRole.toUpperCase()}`, 'info');
  },

  initRoleSwitcher() {
    const brandLogo = document.getElementById('brand-logo');
    if (brandLogo) {
      brandLogo.onclick = () => {
        const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
        this.navigate(role === 'client' ? 'client' : 'dashboard');
      };
    }

    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.onclick = () => {
        const role = btn.getAttribute('data-role');
        if (typeof Auth !== 'undefined') {
          Auth.switchRole(role);
        }
      };
    });
  },

  updateRoleButtons(activeRole) {
    document.querySelectorAll('.role-btn').forEach(btn => {
      if (btn.getAttribute('data-role') === activeRole) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
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
          <i data-lucide="users" style="width:15px;height:15px;"></i> Mijozlar (CRM)
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
        this.navigate(view);
      };
    });

    // Re-render Lucide icons
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },

  navigate(viewName) {
    this.currentView = viewName;
    const viewport = document.getElementById('app-viewport');
    if (!viewport) return;

    const role = typeof Auth !== 'undefined' ? Auth.getRole() : 'client';
    this.updateNavbar();

    // 1. Client Views
    if (role === 'client') {
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

    viewport.innerHTML = `
      <div class="admin-layout">
        <!-- Sidebar Navigation -->
        <aside class="admin-sidebar">
          <div class="sidebar-heading">Boshqaruv Tizimi (${role.toUpperCase()})</div>
          
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
            <span>Mijozlar & Blacklist</span>
          </div>

          ${role === 'admin' ? `
            <div class="sidebar-link ${activeSubView === 'reports' ? 'active' : ''}" data-admin-view="reports">
              <span class="link-icon"><i data-lucide="wallet" style="width:17px;height:17px;"></i></span>
              <span>Moliya & SQLite Baza</span>
            </div>
          ` : ''}

          <div style="margin-top: auto; padding-top: 20px; border-top: 1px solid var(--border-color);">
            <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 6px;">
              Tizim holati: <strong class="text-emerald">SQLite WASM Faol</strong>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-sidebar-view-client" style="width: 100%; gap: 6px;">
              <i data-lucide="globe" style="width:14px;height:14px;"></i> Mijoz Saytiga O'tish
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

    // Re-render Lucide icons after DOM update
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const clientBtn = document.getElementById('btn-sidebar-view-client');
    if (clientBtn) {
      clientBtn.onclick = () => {
        if (typeof Auth !== 'undefined') {
          Auth.switchRole('client');
        }
      };
    }
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
