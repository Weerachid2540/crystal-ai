'use strict';
// ============================================================
// Crystal AI — drafts.js  (Phase-4D-7 extraction)
// Auto-save drafts + live report preview
// Depends on: utils.js (safeJsonParse, localDateTime, val, escapeHtml),
//             toast.js (toast), i18n.js (tr)
// Runtime deps (resolved at call time, all in inline script):
//   currentProjectId, currentProjectMeta, showSavedIndicator (self),
//   wkAct, wkIssue, wkNext, wkPhotos, moAct, moIssue, moNext
// ============================================================

// 9. AUTO-SAVE DRAFTS (FIXED #13)
// ============================================================
const DRAFT_PANELS = ['panel-report', 'panel-weekly', 'panel-monthly', 'panel-proc', 'panel-vo'];
const draftDebounce = {};
const DRAFT_DEBOUNCE_MS = 1000;
const DRAFT_AUTOSAVE_MS = 30000;
let draftAutoSaveTimer = null;

function collectPanelData(panelId) {
  const panel = document.getElementById(panelId);
  const data = currentProjectId ? { project_id: currentProjectId } : {};
  if (panelId === 'panel-report') data.type = 'daily';
  if (panelId === 'panel-weekly') data.type = 'weekly';
  if (panelId === 'panel-monthly') data.type = 'monthly';
  panel.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.id) data[el.id] = el.value;
  });
  return data;
}

function restorePanelData(panelId, data) {
  if (!data || typeof data !== 'object') return false;
  let restored = false;
  Object.entries(data).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el && el.tagName !== 'BUTTON') {
      el.value = val;
      if (val) restored = true;
    }
  });
  return restored;
}

function saveDraft(panelId) {
  try {
    const data = collectPanelData(panelId);
    // FIXED v5.1: include savedAt metadata while keeping older restore compatible — FEAT-1
    localStorage.setItem('crystal_draft_' + panelId, JSON.stringify({ data, savedAt: localDateTime() }));
    showSavedIndicator();
  } catch (e) {}
}

function loadDrafts() {
  let any = false;
  DRAFT_PANELS.forEach(pid => {
    const panel = document.getElementById(pid);
    if (!panel) return;
    // Clear all input/select/textarea values first to avoid leaking previous project data
    panel.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.tagName !== 'BUTTON' && el.type !== 'file') {
        el.value = '';
      }
    });
    // Restore draft if it exists
    const draft = safeJsonParse(localStorage.getItem('crystal_draft_' + pid), null);
    const data = draft && draft.data ? draft.data : draft;
    if (data && restorePanelData(pid, data)) any = true;
    // Restore defaults for date fields if still empty after draft restore
    ['rpt_date', 'boq_date', 'vo_date'].forEach(fieldId => {
      const el = document.getElementById(fieldId);
      if (el && el.type === 'date' && !el.value) {
        el.value = localDate();
      }
    });
  });
  if (any) toast(tr('draft_loaded'), 'success');
}

function setupAutoSave() {
  DRAFT_PANELS.forEach(pid => {
    const panel = document.getElementById(pid);
    if (!panel) return;
    panel.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', () => {
        clearTimeout(draftDebounce[pid]);
        draftDebounce[pid] = setTimeout(() => saveDraft(pid), DRAFT_DEBOUNCE_MS);
      });
      el.addEventListener('change', () => saveDraft(pid));
    });
  });
  // FIXED v5.1: periodic autosave every 30 seconds — FEAT-1
  clearInterval(draftAutoSaveTimer);
  draftAutoSaveTimer = setInterval(() => {
    DRAFT_PANELS.forEach(pid => {
      const panel = document.getElementById(pid);
      if (panel) saveDraft(pid);
    });
  }, DRAFT_AUTOSAVE_MS);
  // FIXED v5.1: flush pending drafts on unload — FEAT-1
  window.addEventListener('beforeunload', () => {
    DRAFT_PANELS.forEach(pid => {
      try {
        if (draftDebounce[pid]) { clearTimeout(draftDebounce[pid]); saveDraft(pid); }
      } catch (e) {}
    });
  });
}

// FIXED v6: lightweight live previews for project-scoped report modules.
function setupReportLivePreview() {
  const map = {
    'panel-report': updateDailyPreview,
    'panel-weekly': updateWeeklyPreview,
    'panel-monthly': updateMonthlyPreview
  };
  Object.entries(map).forEach(([pid, fn]) => {
    const panel = document.getElementById(pid);
    if (!panel || panel.__previewBound) return;
    panel.__previewBound = true;
    panel.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', fn);
      el.addEventListener('change', fn);
    });
  });
}

function _setPreview(areaId, textId, html) {
  if (!currentProjectId) return;
  const area = document.getElementById(areaId);
  const text = document.getElementById(textId);
  if (!area || !text) return;
  text.dataset.aiGenerated = '0';
  area.classList.add('show');
  text.innerHTML = html;
}

function updateDailyPreview() {
  _setPreview('resultDaily', 'resultDailyText', `
    <strong>Live Preview · Daily Report</strong><br>
    Project: ${escapeHtml(val('rpt_proj') || currentProjectMeta?.name || '-')}<br>
    Date: ${escapeHtml(val('rpt_date') || '-')} · Reporter: ${escapeHtml(val('rpt_name') || '-')}<br>
    Structural: ${escapeHtml(val('rpt_str') || '-')}<br>
    Issues: ${escapeHtml(val('rpt_issue') || '-')}<br>
    Tomorrow Plan: ${escapeHtml(val('rpt_plan') || '-')}
  `);
}

function updateWeeklyPreview() {
  _setPreview('resultWeekly', 'resultWeeklyText', `
    <strong>Live Preview · Weekly Report</strong><br>
    Report No.: ${escapeHtml(val('wk_no') || '-')}<br>
    Project: ${escapeHtml(val('wk_proj_code') || currentProjectMeta?.code || '-')} · ${escapeHtml(val('wk_proj') || currentProjectMeta?.name || '-')}<br>
    Period: ${escapeHtml(val('wk_from') || '-')} to ${escapeHtml(val('wk_to') || '-')}<br>
    Activities: ${wkAct.length} · Issues: ${wkIssue.length} · Next: ${wkNext.length} · Photos: ${wkPhotos.length}
  `);
}

function updateMonthlyPreview() {
  _setPreview('resultMonthly', 'resultMonthlyText', `
    <strong>Live Preview · Monthly Report</strong><br>
    Report No.: ${escapeHtml(val('mo_no') || '-')}<br>
    Project: ${escapeHtml(val('mo_proj_code') || currentProjectMeta?.code || '-')} · ${escapeHtml(val('mo_proj') || currentProjectMeta?.name || '-')}<br>
    Period: ${escapeHtml(val('mo_period') || val('mo_from') || '-')}<br>
    Activities: ${moAct.length} · Issues: ${moIssue.length} · Next: ${moNext.length}
  `);
}

let saveIndicatorTimer;
function showSavedIndicator() {
  const el = document.getElementById('saveIndicator');
  el.textContent = tr('saved');
  el.classList.add('show');
  clearTimeout(saveIndicatorTimer);
  saveIndicatorTimer = setTimeout(() => el.classList.remove('show'), 1500);
}
