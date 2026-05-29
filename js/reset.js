'use strict';
// ============================================================
// Crystal AI — reset.js  (Phase-4D-5 extraction)
// Reset / Privacy functions
// Depends on: toast.js (toast), i18n.js (tr, currentLang)
// Runtime deps (resolved at call time, declared in inline script):
//   DRAFT_PANELS, chatHistory, renderWelcome(), updateChatInfo()
// ============================================================

// 10. RESET / PRIVACY (FIXED #24)
// ============================================================
// ---- raw (un-proxied) storage access ----
// storage.js patches localStorage.{get,set,remove}Item to auto-append a project
// scope (__P_<pid>) to crystal_ keys. localStorage.key()/length are NOT patched,
// so they return the already-scoped real key names. Removing those via the
// patched removeItem() re-scopes them (double __P_) → deletes nothing. Use the
// original bound methods captured by storage.js (__crystalRawStorage).
function _rawStorage() {
  return window.__crystalRawStorage || {
    get: localStorage.getItem.bind(localStorage),
    set: localStorage.setItem.bind(localStorage),
    rem: localStorage.removeItem.bind(localStorage),
  };
}

function resetDrafts() {
  if (!confirm(tr('confirm_reset_drafts'))) return;
  // FIXED: clear drafts + BOQ across ALL project scopes via raw removal
  // (the scoping proxy previously left other projects' drafts behind).
  const raw = _rawStorage();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && (k.includes('crystal_draft_') || k.startsWith('crystal_boq'))) keys.push(k);
  }
  keys.forEach(k => raw.rem(k));
  toast(currentLang === 'en' ? '✓ All drafts deleted' : '✓ ลบ drafts ทั้งหมดแล้ว', 'success');
  setTimeout(() => location.reload(), 800);
}

function resetChat() {
  if (!confirm(tr('confirm_reset_chat'))) return;
  localStorage.removeItem('crystal_chat');
  chatHistory = [];
  renderWelcome();
  updateChatInfo();
  toast(currentLang === 'en' ? '✓ Chat history deleted' : '✓ ลบประวัติแชทแล้ว', 'success');
}

function resetAll() {
  if (!confirm(tr('confirm_reset_all'))) return;
  // ลบทุก key ที่ขึ้นต้นด้วย crystal_
  // FIXED: remove via raw storage. localStorage.key() returns already-scoped
  // names; the patched removeItem() would re-scope them and delete nothing.
  const raw = _rawStorage();
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('crystal_')) keys.push(k);
  }
  keys.forEach(k => raw.rem(k));
  toast(currentLang === 'en' ? '✓ Reset complete — reloading...' : '✓ Reset เรียบร้อย — กำลังรีโหลด...', 'success');
  setTimeout(() => location.reload(), 1000);
}
