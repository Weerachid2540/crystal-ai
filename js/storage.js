'use strict';
// ============================================================
// Crystal AI — storage.js  (Phase-4D-2 extraction)
// Project-scoped localStorage proxy + Storage namespace
// Depends on: nothing (must load BEFORE inline script that uses localStorage)
// Runtime deps: currentProjectId (declared in inline script with `let`) —
//               read at call time via TDZ-safe try/catch
// ============================================================

// ---- Project-scoped localStorage proxy ----
// Wraps existing modules' localStorage calls so per-project data stays separate,
// but global keys (settings/lang/chat/salary/signatures) remain unscoped.
const SHARED_KEYS = new Set([
  'crystal_lang','crystal_settings',
  'crystal_salary_config','crystal_salary_calendar',
  'crystal_sb_session','crystal_current_project',
  'crystal_struct_draft'   // Phase-2B-2: global draft (not project-scoped)
]);
function _isSharedKey(k) {
  if (!k || !k.startsWith('crystal_')) return false;
  if (SHARED_KEYS.has(k)) return true;
  if (k.startsWith('crystal_sig_')) return true;       // signatures are user-level
  return false;
}
// Phase-4D-2: TDZ-safe access to currentProjectId (declared with `let` in inline script).
// If called before inline script declares currentProjectId, ReferenceError → fall back to null.
function _currentPidSafe() {
  try { return currentProjectId; } catch (e) { return null; }
}
function _scopedKey(k) {
  if (_isSharedKey(k) || !k || !k.startsWith('crystal_')) return k;
  const pid = _currentPidSafe() || 'NOPROJ';
  return k + '__P_' + pid;
}
(function patchStorage() {
  const orig = {
    get: localStorage.getItem.bind(localStorage),
    set: localStorage.setItem.bind(localStorage),
    rem: localStorage.removeItem.bind(localStorage),
  };
  window.__crystalRawStorage = orig;
  localStorage.getItem    = (k) => orig.get(_scopedKey(k));
  localStorage.setItem    = (k, v) => orig.set(_scopedKey(k), v);
  localStorage.removeItem = (k) => orig.rem(_scopedKey(k));
})();

// Phase-2B-3: temporarily swap currentProjectId so proxy scopes to target pid
function withProjectStorage(pid, callback) {
  const prev = currentProjectId;
  currentProjectId = pid;
  try { return callback(); }
  finally { currentProjectId = prev; }
}

// FIXED v5.1: Project-scoped storage helper — BUG-4
// Existing modules use localStorage directly (above proxy handles scoping).
// This Storage namespace is a convenience wrapper for new code.
const Storage = {
  // key format: crystal_{projectId}_{key}; raw storage bypasses proxy double-scoping.
  // FIXED v5.1: stable project/global key API with quota and parse guards — BUG-4
  _key(key, projectId) {
    const pid = projectId || _currentPidSafe() || 'global';
    const clean = String(key || '').replace(/^crystal_/, '');
    return `crystal_${pid}_${clean}`;
  },
  _raw() {
    return window.__crystalRawStorage || {
      get: localStorage.getItem.bind(localStorage),
      set: localStorage.setItem.bind(localStorage),
      rem: localStorage.removeItem.bind(localStorage),
    };
  },
  get(key, projectId) {
    try {
      const raw = this._raw().get(this._key(key, projectId));
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },
  set(key, value, projectId) {
    try {
      this._raw().set(this._key(key, projectId), JSON.stringify(value));
      return true;
    } catch (e) {
      if (e && e.name === 'QuotaExceededError' && typeof toast === 'function') {
        toast('⚠️ พื้นที่เก็บข้อมูลเต็ม', 'error');
      }
      return false;
    }
  },
  remove(key, projectId) {
    this._raw().rem(this._key(key, projectId));
  },
  getGlobal(key) { return this.get(key, 'global'); },
  setGlobal(key, value) { return this.set(key, value, 'global'); },
  removeGlobal(key) { return this.remove(key, 'global'); }
};
