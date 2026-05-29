'use strict';
// ============================================================
// js/auth.js — Phase-4O-2
// Supabase Init + Global State + Auth Helpers + Auth Flow + Auth Bootstrap
// Extracted verbatim from inline script.
// Loads after js/tool-modal.js, before inline <script>.
// NOTE: All vars are top-level `let` / `const` — classic script, no type="module".
//       All modules (storage.js, chat.js, dashboard.js, etc.) share these globals.
// ============================================================

// ---- Supabase Init ----
const SUPABASE_URL = 'https://ufgrhpwfxkvqsofqrtef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmZ3JocHdmeGt2cXNvZnFydGVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDAyMDYsImV4cCI6MjA5NDU3NjIwNn0.8cBMAClrKjHBaa12XUFwM15I7LBzotMlxGf1kpI30dU';

let sb = null;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage, storageKey: 'crystal_sb_session' }
  });
} catch (e) {
  console.error('Supabase init failed:', e);
}

// ---- App state ----
let currentUser = null;          // { user_id, employee_id, full_name, role, ... }
let currentView = 'auth';        // auth | dashboard | project | personal | users
let currentProjectId = null;     // uuid
let currentProjectMeta = null;   // { id, code, name, ... }
let allProjects = [];
// FIXED v6: canonical app state for project-based routing.
const appState = {
  currentView: 'dashboard',
  currentProjectId: null
};

function syncAppState(view) {
  appState.currentView = view === 'project' ? 'project' : (view === 'personal' ? 'personal' : 'dashboard');
  appState.currentProjectId = view === 'project' ? (currentProjectId || null) : null;
}

// ---- AUTH ----
function _empIdToEmail(empId) { return empId.trim().toLowerCase().replace('-','') + '@crystal.local'; }
function _validateEmpId(s) { return /^STE-\d{3}$/.test(s); }

async function doLogin(e) {
  e && e.preventDefault();
  const empIdRaw = document.getElementById('authEmpId').value.trim().toUpperCase();
  const pw = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmit');
  errEl.classList.remove('show');
  document.getElementById('authEmpId').classList.remove('err');
  document.getElementById('authPassword').classList.remove('err');
  if (!_validateEmpId(empIdRaw)) {
    errEl.textContent = 'รูปแบบรหัสพนักงานไม่ถูกต้อง (ตัวอย่าง: STE-001)';
    errEl.classList.add('show');
    document.getElementById('authEmpId').classList.add('err');
    return;
  }
  btn.disabled = true; btn.textContent = 'กำลังเข้าสู่ระบบ...';
  try {
    const email = _empIdToEmail(empIdRaw);
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    await afterAuth();
  } catch (err) {
    console.error(err);
    errEl.textContent = (err && err.message && err.message.toLowerCase().includes('invalid'))
      ? 'รหัสพนักงานหรือรหัสผ่านไม่ถูกต้อง'
      : ('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || err));
    errEl.classList.add('show');
  } finally {
    btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ';
  }
}

async function doLogout() {
  if (!confirm('ออกจากระบบ?')) return;
  try { await sb.auth.signOut(); } catch (e) {}
  currentUser = null; currentProjectId = null; currentProjectMeta = null;
  setView('auth');
  document.getElementById('userChip').style.display = 'none';
  document.getElementById('usersBtn').style.display = 'none';
  document.getElementById('logoutBtn').style.display = 'none';
  // FIXED: afterAuth() shows v6UsersBtn — hide it on logout too (was left visible).
  const v6u = document.getElementById('v6UsersBtn'); if (v6u) v6u.style.display = 'none';
  document.getElementById('authPassword').value = '';
}

async function afterAuth() {
  // Get session + employee profile
  const { data: { user }, error: uerr } = await sb.auth.getUser();
  if (uerr || !user) { setView('auth'); return; }
  const { data: emp, error: eerr } = await sb.from('employees')
    .select('*').eq('user_id', user.id).maybeSingle();
  if (eerr) { console.error(eerr); toast('ดึงข้อมูลพนักงานไม่สำเร็จ: ' + eerr.message, 'error'); return; }
  if (!emp) {
    toast('บัญชีนี้ยังไม่ได้ผูกกับข้อมูลพนักงาน ติดต่อ admin', 'error');
    await sb.auth.signOut();
    return;
  }
  if (!emp.is_active) {
    toast('บัญชีนี้ถูกปิดการใช้งาน', 'error');
    await sb.auth.signOut();
    return;
  }
  currentUser = emp;
  // Update UI
  const chip = document.getElementById('userChip');
  document.getElementById('userChipId').textContent = emp.employee_id;
  document.getElementById('userChipName').textContent = emp.full_name;
  chip.style.display = '';
  document.getElementById('usersBtn').style.display = '';
  document.getElementById('logoutBtn').style.display = '';
  const v6u = document.getElementById('v6UsersBtn'); if (v6u) v6u.style.display = '';
  // Default to dashboard
  await goView('dashboard');
}

// FIXED v6: Logo fallback — use the real embedded company mark on auth screen.
function initAuthLogo() {
  const authLogo = document.getElementById('authLogo');
  const fallbackLogo = document.querySelector('.logo-icon') || document.querySelector('.sidebar-logo-img');
  if (authLogo) {
    authLogo.alt = 'Crystal Engineering Corporation';
    authLogo.src = './logo.jpg';
    authLogo.onerror = () => {
      if (fallbackLogo?.src && authLogo.src !== fallbackLogo.src) {
        authLogo.src = fallbackLogo.src;
      } else {
        authLogo.style.display = 'none';
      }
    };
    authLogo.style.display = '';
  }
  // bg-auth.png is set via CSS directly — no JS override needed
}

// FIXED v5.1: Auth stability — BUG-3
let _authInitialized = false;
let _authLoading = false;

function clearStaleAuthTokens() {
  // FIXED v5.1: เคลียร์ token ที่ทำให้ loop — BUG-3
  // FIXED: also clear the actual session key (storageKey: 'crystal_sb_session').
  // It is a SHARED_KEY so removeItem() targets it unscoped — previously only the
  // legacy sb-* keys were cleared, so a corrupt session could still loop.
  Object.keys(localStorage)
    .filter(k => k.startsWith('sb-') || k.includes('supabase.auth') || k === 'crystal_sb_session')
    .forEach(k => localStorage.removeItem(k));
}

// ---- Bootstrap: check auth on load ----
async function checkAuthOnLoad() {
  initAuthLogo();
  if (_authLoading) return;
  _authLoading = true;
  if (!sb) {
    document.getElementById('authError').textContent = 'ไม่สามารถเชื่อมต่อ Supabase — ตรวจสอบ network';
    document.getElementById('authError').classList.add('show');
    _authLoading = false;
    _authInitialized = true;
    return;
  }
  try {
    const { data: { session }, error } = await sb.auth.getSession();
    if (error) throw error;
    if (session) {
      await afterAuth();
    } else {
      setView('auth');
    }
  } catch (err) {
    console.error('[Auth] checkAuthOnLoad error:', err);
    clearStaleAuthTokens();
    setView('auth');
  } finally {
    _authLoading = false;
    _authInitialized = true;
  }
}

// FIXED v5.1: onAuthStateChange — รอ init ก่อน — BUG-3
function _setupAuthStateListener() {
  if (!sb || !sb.auth || !sb.auth.onAuthStateChange) return;
  sb.auth.onAuthStateChange(async (event, session) => {
    if (!_authInitialized) return;
    if (event === 'SIGNED_IN' && session) {
      // FIXED v5.1: refresh profile/app state after late sign-in events — BUG-3
      try { await afterAuth(); } catch (err) { console.error('[Auth] SIGNED_IN refresh failed:', err); }
    } else if (event === 'SIGNED_OUT') {
      clearStaleAuthTokens();
      currentUser = null; currentProjectId = null; currentProjectMeta = null;
      setView('auth');
    }
    // TOKEN_REFRESHED → ไม่ต้องทำอะไร
  });
}
