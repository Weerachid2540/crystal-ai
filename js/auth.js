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
// FIXED: Supabase auth/login removed — app boots straight into a fixed local
// user (no employee_id lookup, no sign-in). employees/users management still
// reads the `employees` table directly for the directory.
let currentUser = { user_id: null, employee_id: 'ADMIN', full_name: 'ผู้ใช้งาน', role: 'Admin', is_active: true };
let currentView = 'dashboard';   // dashboard | project | personal | users
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

// ---- USER (no login — fixed local identity) ----
function _validateEmpId(s) { return /^STE-\d{3}$/.test(s); }

// FIXED: login screen + Supabase auth removed. The app runs as a single
// fixed local identity; the topbar chip just reflects `currentUser` above.
function _renderUserChip() {
  document.getElementById('userChipId').textContent = currentUser.employee_id;
  document.getElementById('userChipName').textContent = currentUser.full_name;
}

// ---- Bootstrap: no auth gate — go straight into the app ----
async function checkAuthOnLoad() {
  _renderUserChip();
  await goView('dashboard');
}
