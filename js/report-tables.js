'use strict';
// ============================================================
// Crystal AI — report-tables.js  (Phase-4H extraction)
// Weekly / Monthly Report Table state, renderers, save/load
// Depends on: utils.js (safeJsonParse, escapeHtml),
//             i18n.js (currentLang)
// Runtime deps (resolved at call time, all in inline script):
//   currentProjectId — declared in inline script (used by saveReportTablesDraft)
//   drafts.js updateWeeklyPreview/updateMonthlyPreview — reference wkAct.length etc. (OK: global)
//   forms.js generateWeeklyReport/generateMonthlyReport — reference wkAct etc. (OK: global)
//   collectWeeklyData (inline) — reads wkAct/wkIssue/wkNext/wkTargets (OK: global)
//   clearForm (inline) — calls renderWkAct() etc. (OK: global)
// ============================================================

// ============================================================
// WEEKLY / MONTHLY REPORT TABLES (based on real Crystal templates)
// State arrays keyed by row id; rendered into <tbody> with per-cell inputs.
// ============================================================
let wkAct = [], wkIssue = [], wkNext = [];
let moAct = [], moIssue = [], moNext = [];
let reportRowIdCounter = 0;
const STATUS_OPTIONS = ['', 'Done', 'In Progress', 'Delayed', 'Pending'];

function _newId() { return ++reportRowIdCounter; }

// Generic row helpers ----------------------------------------------------
function _renderTable(state, tbodyId, columns, updateFn, delFn) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!state.length) {
    tbody.innerHTML = `<tr><td colspan="${columns.length + 2}" class="report-table-empty">${currentLang === 'en' ? 'No rows yet — click "+ Add row" below' : 'ยังไม่มีรายการ — คลิก "+ เพิ่มแถว" ด้านล่าง'}</td></tr>`;
    return;
  }
  state.forEach((row, i) => {
    const tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    const initColor = _rowColorFor(row);
    if (initColor) tr.dataset.status = initColor;
    let html = `<td class="col-num">${i + 1}</td>`;
    columns.forEach(col => {
      const v = row[col.key] || '';
      const cls = col.class ? ` class="${col.class}"` : '';
      if (col.type === 'select') {
        const opts = col.options.map(o => `<option value="${o}" ${v === o ? 'selected' : ''}>${o || '—'}</option>`).join('');
        html += `<td${cls}><select data-field="${col.key}">${opts}</select></td>`;
      } else if (col.type === 'date') {
        html += `<td${cls}><input type="date" data-field="${col.key}" value="${escapeHtml(v)}"></td>`;
      } else if (col.type === 'number') {
        html += `<td${cls}><input type="number" min="0" step="0.5" data-field="${col.key}" value="${escapeHtml(v)}" placeholder="${col.placeholder || ''}"></td>`;
      } else {
        html += `<td${cls}><input type="text" data-field="${col.key}" value="${escapeHtml(v)}" placeholder="${col.placeholder || ''}"></td>`;
      }
    });
    html += `<td class="col-action"><button type="button" class="del-row-btn" title="ลบ" aria-label="Remove">×</button></td>`;
    tr.innerHTML = html;
    tr.querySelectorAll('[data-field]').forEach(el => {
      el.addEventListener('input', e => updateFn(row.id, e.target.dataset.field, e.target.value));
      el.addEventListener('change', e => updateFn(row.id, e.target.dataset.field, e.target.value));
    });
    tr.querySelector('.del-row-btn').addEventListener('click', () => delFn(row.id));
    tbody.appendChild(tr);
  });
}

function _rowColorFor(row) {
  if (row.dueDate && /delayed/i.test(row.dueDate)) return 'Delayed';
  const p = parseFloat(row.progress);
  if (!isNaN(p)) {
    if (p >= 100) return 'Done';
    if (p > 0) return 'In Progress';
  }
  if (row.status) return row.status; // backward-compat for old rows
  return null;
}

function _updateRow(state, id, field, value, renderFn) {
  const row = state.find(r => r.id === id);
  if (!row) return;
  row[field] = value;
  if (field === 'progress' || field === 'dueDate' || field === 'status') {
    const tr = document.querySelector(`tr[data-row-id="${id}"]`);
    if (tr) {
      const c = _rowColorFor(row);
      if (c) tr.dataset.status = c; else delete tr.dataset.status;
    }
  }
  // No re-render: keeps input focus stable
}

function _delRow(state, id, renderFn) {
  const idx = state.findIndex(r => r.id === id);
  if (idx === -1) return;
  state.splice(idx, 1);
  renderFn();
}

// Column definitions -----------------------------------------------------
// Following Crystal Engineering template (J329-W-005):
// Section 1 / 3: Progress (%), Status Issue (date), Due Date (text/date — "Delayed" or completion date)
const ACT_COLS = [
  { key: 'desc', type: 'text', placeholder: 'งาน...' },
  { key: 'progress', type: 'number', placeholder: '%', class: 'col-mhr' },
  { key: 'statusIssue', type: 'date', class: 'col-due' },
  { key: 'dueDate', type: 'text', placeholder: 'Delayed / dd-mmm-yy', class: 'col-due' },
  { key: 'remark', type: 'text', placeholder: '-' }
];
const ACT_COLS_M = [
  { key: 'desc', type: 'text', placeholder: 'งาน...' },
  { key: 'used', type: 'number', placeholder: 'Used', class: 'col-mhr' },
  { key: 'progress', type: 'number', placeholder: '%', class: 'col-mhr' },
  { key: 'statusIssue', type: 'date', class: 'col-due' },
  { key: 'dueDate', type: 'text', placeholder: 'Delayed / dd-mmm-yy', class: 'col-due' },
  { key: 'remark', type: 'text', placeholder: '-' }
];
const ISSUE_COLS = [
  { key: 'issue', type: 'text', placeholder: 'รายละเอียดปัญหา...' },
  { key: 'actionBy', type: 'text', placeholder: 'ผู้รับผิดชอบ', class: 'col-status' },
  { key: 'dueDate', type: 'date', class: 'col-due' }
];
const NEXT_COLS = [
  { key: 'desc', type: 'text', placeholder: 'งาน...' },
  { key: 'progress', type: 'number', placeholder: '%', class: 'col-mhr' },
  { key: 'statusIssue', type: 'date', class: 'col-due' },
  { key: 'dueDate', type: 'text', placeholder: 'Delayed / dd-mmm-yy', class: 'col-due' }
];

// Weekly bindings --------------------------------------------------------
function renderWkAct() { _renderTable(wkAct, 'wkActBody', ACT_COLS,
  (id, f, v) => _updateRow(wkAct, id, f, v, renderWkAct),
  id => _delRow(wkAct, id, renderWkAct)); saveReportTablesDraft('panel-weekly'); }
function renderWkIssue() { _renderTable(wkIssue, 'wkIssueBody', ISSUE_COLS,
  (id, f, v) => _updateRow(wkIssue, id, f, v, renderWkIssue),
  id => _delRow(wkIssue, id, renderWkIssue)); saveReportTablesDraft('panel-weekly'); }
function renderWkNext() { _renderTable(wkNext, 'wkNextBody', NEXT_COLS,
  (id, f, v) => _updateRow(wkNext, id, f, v, renderWkNext),
  id => _delRow(wkNext, id, renderWkNext)); saveReportTablesDraft('panel-weekly'); }

function addWkActRow() { wkAct.push({ id: _newId(), desc: '', progress: '', statusIssue: '', dueDate: '', remark: '' }); renderWkAct(); }
function addWkIssueRow() { wkIssue.push({ id: _newId(), issue: '', actionBy: '', dueDate: '' }); renderWkIssue(); }
function addWkNextRow() { wkNext.push({ id: _newId(), desc: '', progress: '', statusIssue: '', dueDate: '' }); renderWkNext(); }

// Target list (section 4) – Weekly (cols match template image 2)
let wkTargets = [];
const TARGET_COLS = [
  { key: 'target', type: 'text', placeholder: 'เป้าหมายที่ต้องเร่ง...' },
  { key: 'statusIssue', type: 'date', class: 'col-due' },
  { key: 'dueDate', type: 'text', placeholder: 'Delayed / dd-mmm-yy', class: 'col-due' }
];
function renderWkTarget() { _renderTable(wkTargets, 'wkTargetBody', TARGET_COLS,
  (id, f, v) => _updateRow(wkTargets, id, f, v, renderWkTarget),
  id => _delRow(wkTargets, id, renderWkTarget)); saveReportTablesDraft('panel-weekly'); }
function addWkTargetRow() { wkTargets.push({ id: _newId(), target: '', statusIssue: '', dueDate: '' }); renderWkTarget(); }

// Monthly bindings -------------------------------------------------------
function renderMoAct() { _renderTable(moAct, 'moActBody', ACT_COLS_M,
  (id, f, v) => _updateRow(moAct, id, f, v, renderMoAct),
  id => _delRow(moAct, id, renderMoAct)); saveReportTablesDraft('panel-monthly'); }
function renderMoIssue() { _renderTable(moIssue, 'moIssueBody', ISSUE_COLS,
  (id, f, v) => _updateRow(moIssue, id, f, v, renderMoIssue),
  id => _delRow(moIssue, id, renderMoIssue)); saveReportTablesDraft('panel-monthly'); }
function renderMoNext() { _renderTable(moNext, 'moNextBody', NEXT_COLS,
  (id, f, v) => _updateRow(moNext, id, f, v, renderMoNext),
  id => _delRow(moNext, id, renderMoNext)); saveReportTablesDraft('panel-monthly'); }

function addMoActRow() { moAct.push({ id: _newId(), desc: '', used: '', progress: '', statusIssue: '', dueDate: '', remark: '' }); renderMoAct(); }
function addMoIssueRow() { moIssue.push({ id: _newId(), issue: '', actionBy: '', dueDate: '' }); renderMoIssue(); }
function addMoNextRow() { moNext.push({ id: _newId(), desc: '', progress: '', statusIssue: '', dueDate: '' }); renderMoNext(); }

// Target list (section 4) – Monthly
let moTargets = [];
function renderMoTarget() { _renderTable(moTargets, 'moTargetBody', TARGET_COLS,
  (id, f, v) => _updateRow(moTargets, id, f, v, renderMoTarget),
  id => _delRow(moTargets, id, renderMoTarget)); saveReportTablesDraft('panel-monthly'); }
function addMoTargetRow() { moTargets.push({ id: _newId(), target: '', statusIssue: '', dueDate: '' }); renderMoTarget(); }

// Persist tables in localStorage (separate keys, larger than form drafts)
function saveReportTablesDraft(panelId) {
  try {
    if (panelId === 'panel-weekly') {
      localStorage.setItem('crystal_wk_tables', JSON.stringify({ project_id: currentProjectId, type: 'weekly', act: wkAct, issue: wkIssue, next: wkNext, targets: wkTargets }));
    } else if (panelId === 'panel-monthly') {
      localStorage.setItem('crystal_mo_tables', JSON.stringify({ project_id: currentProjectId, type: 'monthly', act: moAct, issue: moIssue, next: moNext, targets: moTargets }));
    }
  } catch (e) {}
}

function loadReportTables() {
  wkAct = []; wkIssue = []; wkNext = []; wkTargets = [];
  moAct = []; moIssue = []; moNext = []; moTargets = [];
  const wk = safeJsonParse(localStorage.getItem('crystal_wk_tables'), null);
  if (wk) {
    wkAct = wk.act || []; wkIssue = wk.issue || []; wkNext = wk.next || []; wkTargets = wk.targets || [];
    [...wkAct, ...wkIssue, ...wkNext, ...wkTargets].forEach(r => { if (r.id > reportRowIdCounter) reportRowIdCounter = r.id; });
  }
  const mo = safeJsonParse(localStorage.getItem('crystal_mo_tables'), null);
  if (mo) {
    moAct = mo.act || []; moIssue = mo.issue || []; moNext = mo.next || []; moTargets = mo.targets || [];
    [...moAct, ...moIssue, ...moNext, ...moTargets].forEach(r => { if (r.id > reportRowIdCounter) reportRowIdCounter = r.id; });
  }
  renderWkAct(); renderWkIssue(); renderWkNext(); renderWkTarget();
  renderMoAct(); renderMoIssue(); renderMoNext(); renderMoTarget();
}
