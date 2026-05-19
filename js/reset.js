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
function resetDrafts() {
  if (!confirm(tr('confirm_reset_drafts'))) return;
  DRAFT_PANELS.forEach(pid => localStorage.removeItem('crystal_draft_' + pid));
  localStorage.removeItem('crystal_boq');
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
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith('crystal_')) keys.push(k);
  }
  keys.forEach(k => localStorage.removeItem(k));
  toast(currentLang === 'en' ? '✓ Reset complete — reloading...' : '✓ Reset เรียบร้อย — กำลังรีโหลด...', 'success');
  setTimeout(() => location.reload(), 1000);
}
