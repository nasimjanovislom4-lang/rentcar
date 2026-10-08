// js/auth.js
// Authentication and RBAC (Role-Based Access Control) manager

const isNodeAuth = typeof window === 'undefined';

const Auth = {
  activeRole: 'client',
  currentUser: null,

  // RBAC Permission Matrix for Views
  permissions: {
    client: ['client', 'my-bookings'],
    manager: ['client', 'my-bookings', 'dashboard', 'fleet', 'bookings', 'crm'],
    admin: ['client', 'my-bookings', 'dashboard', 'fleet', 'bookings', 'crm', 'reports']
  },

  init() {
    let savedUserId = null;
    let savedRole = 'client';

    if (!isNodeAuth && window.localStorage) {
      savedUserId = localStorage.getItem('rentcar_session_user_id');
      savedRole = localStorage.getItem('rentcar_active_role') || 'client';
    }

    if (savedUserId && typeof DB !== 'undefined' && DB.dbInstance) {
      try {
        const users = DB.query("SELECT * FROM users WHERE id = ? AND status = 'active'", [parseInt(savedUserId, 10)]);
        if (users && users.length > 0) {
          this.currentUser = users[0];
          this.activeRole = users[0].role;
          return;
        }
      } catch (e) {
        console.warn("Session restore error:", e);
      }
    }

    this.activeRole = savedRole;
    this.syncUserForRole();
  },

  getRole() {
    return this.activeRole;
  },

  isAuthenticated() {
    return !!this.currentUser;
  },

  getCurrentUser() {
    if (!this.currentUser && typeof DB !== 'undefined' && DB.dbInstance) {
      this.syncUserForRole();
    }
    return this.currentUser;
  },

  syncUserForRole() {
    try {
      if (typeof DB === 'undefined' || !DB.dbInstance) return;
      const users = DB.query("SELECT * FROM users WHERE role = ? AND status = 'active' LIMIT 1", [this.activeRole]);
      if (users && users.length > 0) {
        this.currentUser = users[0];
      } else {
        this.currentUser = { id: 1, full_name: 'Foydalanuvchi', role: this.activeRole };
      }
    } catch (e) {
      this.currentUser = { id: 1, full_name: 'Foydalanuvchi', role: this.activeRole };
    }
  },

  canAccess(viewName) {
    const allowed = this.permissions[this.activeRole] || this.permissions.client;
    return allowed.includes(viewName);
  },

  login(usernameOrPhone, password) {
    if (typeof DB === 'undefined' || !DB.dbInstance) {
      return { success: false, error: "Ma'lumotlar bazasi initsializatsiya qilinmagan" };
    }

    const cleanInput = (usernameOrPhone || '').trim();
    if (!cleanInput) {
      return { success: false, error: "Login yoki telefon raqamini kiriting" };
    }

    const users = DB.query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER(?) OR phone = ?",
      [cleanInput, cleanInput]
    );

    if (!users || users.length === 0) {
      return { success: false, error: "Bunday foydalanuvchi topilmadi" };
    }

    const user = users[0];

    if (user.status === 'blacklisted') {
      return { success: false, error: "Kechirasiz, ushbu hisob bloklangan (qora ro'yxatda)" };
    }

    // Verify password if user has password set
    if (user.password && user.password !== password) {
      return { success: false, error: "Parol noto'g'ri kiritildi" };
    }

    this.currentUser = user;
    this.activeRole = user.role;

    if (!isNodeAuth && window.localStorage) {
      localStorage.setItem('rentcar_session_user_id', user.id);
      localStorage.setItem('rentcar_active_role', user.role);
    }

    if (!isNodeAuth && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rentcar:role-changed', { detail: { role: user.role } }));
      window.dispatchEvent(new CustomEvent('rentcar:auth-changed', { detail: { user } }));
    }

    return { success: true, user };
  },

  register(data) {
    if (typeof DB === 'undefined' || !DB.dbInstance) {
      return { success: false, error: "Ma'lumotlar bazasi initsializatsiya qilinmagan" };
    }

    const fullName = (data.full_name || '').trim();
    const phone = (data.phone || '').trim();
    const username = (data.username || '').trim().toLowerCase();
    const password = data.password || '123456';

    if (!fullName) return { success: false, error: "Ism-familiyangizni kiriting" };
    if (!phone) return { success: false, error: "Telefon raqamingizni kiriting" };
    if (!username) return { success: false, error: "Foydalanuvchi nomini (login) kiriting" };

    // Check if phone or username exists
    const checkPhone = DB.query("SELECT id FROM users WHERE phone = ?", [phone]);
    if (checkPhone && checkPhone.length > 0) {
      return { success: false, error: "Ushbu telefon raqami allaqachon ro'yxatdan o'tgan" };
    }

    const checkUser = DB.query("SELECT id FROM users WHERE LOWER(username) = LOWER(?)", [username]);
    if (checkUser && checkUser.length > 0) {
      return { success: false, error: "Ushbu login band. Boshqa login tanlang" };
    }

    DB.exec(`
      INSERT INTO users (full_name, phone, username, password, role, passport_no, license_no, status)
      VALUES (?, ?, ?, ?, 'client', ?, ?, 'active')
    `, [
      fullName, phone, username, password,
      data.passport_no || 'AA0000000',
      data.license_no || 'AB0000000'
    ]);

    const last = DB.query("SELECT last_insert_rowid() as id");
    const newId = last[0].id;
    const newUser = DB.query("SELECT * FROM users WHERE id = ?", [newId])[0];

    this.currentUser = newUser;
    this.activeRole = 'client';

    if (!isNodeAuth && window.localStorage) {
      localStorage.setItem('rentcar_session_user_id', newUser.id);
      localStorage.setItem('rentcar_active_role', 'client');
    }

    if (!isNodeAuth && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rentcar:role-changed', { detail: { role: 'client' } }));
      window.dispatchEvent(new CustomEvent('rentcar:auth-changed', { detail: { user: newUser } }));
    }

    return { success: true, user: newUser };
  },

  logout() {
    this.currentUser = null;
    this.activeRole = 'client';

    if (!isNodeAuth && window.localStorage) {
      localStorage.removeItem('rentcar_session_user_id');
      localStorage.setItem('rentcar_active_role', 'client');
    }

    if (!isNodeAuth && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rentcar:role-changed', { detail: { role: 'client' } }));
      window.dispatchEvent(new CustomEvent('rentcar:auth-changed', { detail: { user: null } }));
    }
  },

  switchRole(role) {
    if (!['client', 'manager', 'admin'].includes(role)) {
      console.warn("Invalid role:", role);
      return;
    }
    this.activeRole = role;
    if (!isNodeAuth && window.localStorage) {
      localStorage.setItem('rentcar_active_role', role);
    }
    this.syncUserForRole();

    if (!isNodeAuth && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('rentcar:role-changed', { detail: { role } }));
    }
  },

  isBlacklisted(userId) {
    if (typeof DB === 'undefined') return false;
    const res = DB.query("SELECT status FROM users WHERE id = ?", [userId]);
    return res.length > 0 && res[0].status === 'blacklisted';
  },

  isPhoneBlacklisted(phone) {
    if (typeof DB === 'undefined') return false;
    const res = DB.query("SELECT status FROM users WHERE phone = ?", [phone]);
    return res.length > 0 && res[0].status === 'blacklisted';
  }
};

if (typeof module !== 'undefined') {
  module.exports = Auth;
}
if (typeof window !== 'undefined') {
  window.Auth = Auth;
}
