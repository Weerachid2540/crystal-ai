'use strict';
// ============================================================
// Crystal AI — sidebar.js  (Phase-4D-6 extraction)
// Sidebar / Tab switching / Keyboard shortcuts
// Depends on: utils.js (requireProjectContext),
//             settings-ui.js (closeSettings)
// Runtime deps (all resolved at call time):
//   updateProjectContextUI(), saveDraft(), showSavedIndicator(),
//   closePhotoPreview(), closeSalaryDayModal(), closeSalarySettings(),
//   sendChat() — all declared in inline script
// ============================================================

// 11. SIDEBAR + TABS + KEYBOARD (FIXED #6 shadowing, #21 ESC)
// ============================================================
// FIXED #6: parameter shadowing fix — เปลี่ยน `t` ภายในเป็น `tabEl`
function switchTab(name, sidebarEl) {
  // FIXED v6: all modules except Dashboard/User admin require project context.
  const projectOnly = new Set(['overview','chat','report','weekly','monthly','struct','files','proc','vo']);
  if (projectOnly.has(name) && !requireProjectContext(name)) return;
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(tabEl => tabEl.classList.remove('active'));
  document.querySelectorAll('.sidebar-item').forEach(s => s.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  const tabEl = document.getElementById('tab-' + name);
  if (tabEl) tabEl.classList.add('active');
  if (sidebarEl) sidebarEl.classList.add('active');
  else document.querySelectorAll('.sidebar-item').forEach(s => {
    const onclick = s.getAttribute('onclick') || '';
    const reportGroup = ['report','weekly','monthly'].includes(name) && onclick.includes("'report'");
    if (onclick.includes("'" + name + "'") || reportGroup) s.classList.add('active');
  });
  updateProjectContextUI();
  if (window.innerWidth <= 768) closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('show');
  document.getElementById('sidebarOverlay').classList.toggle('show');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('show');
  document.getElementById('sidebarOverlay').classList.remove('show');
}

// FIXED #21: ESC ปิด modal/sidebar
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // FIXED v5.1: Ctrl/Cmd+S save current panel — FEAT-3
    if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      const activePanel = document.querySelector('.panel.active');
      if (activePanel) {
        const pid = activePanel.id;
        try { if (typeof saveDraft === 'function' && pid) saveDraft(pid); } catch (err) {}
        const saveBtn = activePanel.querySelector('.gen-btn, .btn-primary[data-save]');
        if (saveBtn) saveBtn.click();
        try { showSavedIndicator(); } catch (err) {}
      }
      return;
    }
    // ESC: ปิด modal ก่อน, ถ้าไม่มี modal เปิด → ปิด sidebar
    if (e.key === 'Escape') {
      const photoModal = document.getElementById('photoModal');
      if (photoModal && photoModal.classList.contains('show')) {
        closePhotoPreview();
        return;
      }
      const salaryDay = document.getElementById('salaryDayModal');
      if (salaryDay && salaryDay.classList.contains('show')) {
        closeSalaryDayModal();
        return;
      }
      const salarySet = document.getElementById('salarySettingsModal');
      if (salarySet && salarySet.classList.contains('show')) {
        closeSalarySettings();
        return;
      }
      const modal = document.getElementById('settingsModal');
      if (modal.classList.contains('show')) {
        closeSettings();
        return;
      }
      if (document.getElementById('sidebar').classList.contains('show')) {
        closeSidebar();
        return;
      }
    }
  });

  // FIXED #18: Ctrl/Cmd + Enter ใน chat ส่งข้อความ (Enter ส่งเหมือนเดิม)
  const chatInput = document.getElementById('chatInput');
  if (chatInput) {
    chatInput.addEventListener('keydown', (e) => {
      // Plain Enter = send (Shift+Enter = newline)
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        sendChat();
      }
      // Ctrl+Enter / Cmd+Enter = send (force, even with modifier)
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendChat();
      }
    });
  }
}
