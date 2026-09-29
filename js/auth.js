// js/auth.js
// Authentication and RBAC (Role-Based Access Control) manager

const isNodeAuth = typeof window === 'undefined';

const Auth = {
  activeRole: 'client',
  currentUser: null,

  init() {
    let savedRole = 'client';
    if (!isNodeAuth && window.localStorage) {
      savedRole = localStorage.getItem('rentcar_active_role') || 'client';
    }
    this.switchRole(savedRole);
  },

  getRole() {
    return this.activeRole;
  },

  getCurrentUser() {
    if (!this.currentUser && typeof DB !== 'undefined' && DB.dbInstance) {
      this.syncUserForRole();
    }
    return this.currentUser;
  },

  syncUserForRole() {
    try {
      const users = DB.query("SELECT * FROM users WHERE role = ? AND status = 'active' LIMIT 1", [this.activeRole]);
      if (users && users.length > 0) {
        this.currentUser = users[0];
      } else {
        // Fallback default user object
        this.currentUser = { id: 1, full_name: 'Foydalanuvchi', role: this.activeRole };
      }
    } catch (e) {
      this.currentUser = { id: 1, full_name: 'Foydalanuvchi', role: this.activeRole };
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

  loginByPhone(phone) {
    if (typeof DB === 'undefined') return false;
    const users = DB.query("SELECT * FROM users WHERE phone = ?", [phone]);
    if (users && users.length > 0) {
      this.currentUser = users[0];
      this.activeRole = users[0].role;
      if (!isNodeAuth && window.localStorage) {
        localStorage.setItem('rentcar_active_role', this.activeRole);
      }
      return true;
    }
    return false;
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
