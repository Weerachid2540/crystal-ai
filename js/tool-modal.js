'use strict';
// ============================================================
// Crystal AI - tool-modal.js  (Phase-4N-3 extraction)
// Tool Modal: hosts legacy panels (BOQ/VO/Daily/Weekly/Monthly/Drawing/Salary)
// by physically moving #panel-* into #toolModalBody and restoring on close.
// Depends on: utils.js (openModal, closeModal),
//             toast.js (toast)
// Runtime deps (resolved at call time, all global):
//   setupAllSignaturePads - signatures.js (canvas resize after panel move)
//   _resetDailyPhotosMemory, loadDailyPhotos, loadWkPhotos - photos.js
//   loadBOQ - boq.js
//   loadReportTables - report-tables.js
//   loadSalary, renderSalaryCalendar, recalcSalaryMonth - salary.js
// CRITICAL - shared with structural.js:
//   _activeToolPanel - mutated by openStructAssistant (structural.js:1180)
//   closeToolModalReturn - called by openStructAssistant (structural.js:1179)
//   Both must remain global - classic-script scope provides this.
// ============================================================

// Tool modal
let _toolModalTitleMap = {
  boq: '🛒 BOQ — Bill of Quantities',
  vo: '📝 Variation Order',
  report: '📋 Daily Report',
  daily: '📋 Daily Report',
  weekly: '📅 Weekly Report',
  monthly: '📊 Monthly Report',
  drawing: '🗂 Drawing / Files',
  salary: '💰 Salary Tracker',
};
let _activeToolPanel = null;
function openTool(tool /*, fromProject*/) {
  const map = { boq: 'panel-proc', vo: 'panel-vo', report: 'panel-report', daily: 'panel-report',
                weekly: 'panel-weekly', monthly: 'panel-monthly', drawing: 'panel-files', salary: 'panel-salary' };
  const panelId = map[tool]; if (!panelId) return;
  const panel = document.getElementById(panelId);
  if (!panel) { toast('Tool ไม่พร้อมใช้งาน', 'error'); return; }
  const body = document.getElementById('toolModalBody');
  // restore previous panel before swapping
  closeToolModalReturn();
  _activeToolPanel = { panel, parent: panel.parentNode, next: panel.nextSibling };
  panel.classList.add('active');
  body.appendChild(panel);
  document.getElementById('toolModalTitle').textContent = _toolModalTitleMap[tool] || tool;
  openModal('toolModal');
  // init signature pads in the moved panel (canvas resize)
  try { setupAllSignaturePads && setupAllSignaturePads(); } catch (e) {}
  // Phase-2C: per-tool data reload (secondary guarantee — primary is in openProjectModal)
  if (tool === 'daily' || tool === 'report') {
    try { _resetDailyPhotosMemory(); loadDailyPhotos(); } catch(e) {}
  }
  if (tool === 'boq')     { try { loadBOQ(); } catch(e) {} }
  if (tool === 'weekly')  { try { loadWkPhotos(); loadReportTables(); } catch(e) {} }
  if (tool === 'monthly') { try { loadReportTables(); } catch(e) {} }
  // for salary: render calendar
  if (tool === 'salary') { try { loadSalary && loadSalary(); renderSalaryCalendar && renderSalaryCalendar(); recalcSalaryMonth && recalcSalaryMonth(); } catch (e) {} }
}
function closeToolModalReturn() {
  if (!_activeToolPanel) return;
  const { panel, parent, next } = _activeToolPanel;
  panel.classList.remove('active');
  if (parent) {
    if (next && next.parentNode === parent) parent.insertBefore(panel, next);
    else parent.appendChild(panel);
  }
  _activeToolPanel = null;
}
function closeToolModal() {
  closeModal('toolModal');
  closeToolModalReturn();
}

// ---- Print fix: panel lives inside .modal-overlay which print CSS hides ----
// Before printing: temporarily restore panel to its original DOM location so
// @media print can see it. After printing: move it back into the tool modal.
window.addEventListener('beforeprint', function() {
  if (!_activeToolPanel) return;
  const { panel, parent, next } = _activeToolPanel;
  panel._printRestored = true;
  if (next && next.parentNode === parent) parent.insertBefore(panel, next);
  else parent.appendChild(panel);
  const overlay = document.getElementById('toolModal');
  if (overlay) overlay.style.visibility = 'hidden';
});
window.addEventListener('afterprint', function() {
  if (!_activeToolPanel || !_activeToolPanel.panel._printRestored) return;
  const body = document.getElementById('toolModalBody');
  if (body) body.appendChild(_activeToolPanel.panel);
  delete _activeToolPanel.panel._printRestored;
  const overlay = document.getElementById('toolModal');
  if (overlay) overlay.style.visibility = '';
});
