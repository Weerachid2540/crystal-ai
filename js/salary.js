'use strict';
// ============================================================
// Crystal AI — salary.js  (Phase-4K-2 extraction)
// Salary Tracker v2 — Calendar-based personal salary calculator
// Depends on: utils.js (deepClone, safeJsonParse, escapeHtml, openModal, closeModal),
//             toast.js (toast),
//             i18n.js (currentLang)
// Runtime deps (resolved at call time — not at script load):
//   currentUser — inline auth script (requireSalaryAccess guard)
//   switchTab   — sidebar.js (exportSalaryPDF only)
// localStorage keys:
//   crystal_salary_config    — config (baseSalary, sites, otRates, extras, deductions)
//   crystal_salary_calendar  — calendar data { 'YYYY-MM': { day: entry } }
//   crystal_salary           — LEGACY v1 key; cleaned up in loadSalary() migration
// deepClone called at top-level: utils.js loads BEFORE salary.js — safe.
// ============================================================

// ============================================================
// SALARY TRACKER v2 — Calendar-based
// User clicks a date in the calendar, picks sites + optional OT.
// All totals computed automatically from configured rates.
// ============================================================
const SALARY_DEFAULT_CONFIG = {
  baseSalary: 19500,
  sites: [
    { id: 1, name: 'นน', rate: 150 },
    { id: 2, name: 'มีตติ้ง', rate: 300 },
    { id: 3, name: 'บางแวก', rate: 250 },
    { id: 4, name: 'ฮอนด้า', rate: 250 },
    { id: 5, name: 'ท่ามหาราช', rate: 200 }
  ],
  otRates: [
    { id: 11, label: 'OT ปกติ', rate: 600 },
    { id: 12, label: 'OT พิเศษ', rate: 1000 }
  ],
  extras: [
    { id: 21, label: 'เอกสาร', amount: 500 }
  ],
  deductions: [
    { id: 31, label: 'หักประกันสังคม', amount: 875 }
  ]
};
let salaryConfig = deepClone(SALARY_DEFAULT_CONFIG);
let salaryCalendar = {};        // { "2026-04": { "1": { sites:[1], otId:11 } } }
let salaryCurMonth = null;      // { year, month } 0-indexed month
let salaryEditingDay = null;
let salaryIdCtr = 100;
function _salaryGenId() { return ++salaryIdCtr; }
function _fmtMoney(n) {
  const v = Number(n);
  if (!isFinite(v)) return '0';
  return v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function _siteColor(id) {
  const palette = ['#3498db','#27ae60','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#34495e','#16a085','#d35400'];
  return palette[id % palette.length];
}
function _salaryMonthKey(year, monthIdx) { return year + '-' + String(monthIdx + 1).padStart(2, '0'); }
function _salaryMonthLabel(year, monthIdx) {
  const m = currentLang === 'en'
    ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    : ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  const y = currentLang === 'th' ? year + 543 : year;
  return m[monthIdx] + ' ' + y;
}

function requireSalaryAccess() {
  return !!currentUser;
}

function loadSalary() {
  // FIXED v6: Salary is a personal/global module, separate from project reports.
  const cfg = safeJsonParse(localStorage.getItem('crystal_salary_config'), null);
  if (cfg) salaryConfig = cfg;
  // Clean legacy v1 storage (different schema)
  if (localStorage.getItem('crystal_salary')) {
    try { localStorage.removeItem('crystal_salary'); } catch (e) {}
  }
  ['sites','otRates','extras','deductions'].forEach(k => {
    (salaryConfig[k] || []).forEach(item => { if (item.id > salaryIdCtr) salaryIdCtr = item.id; });
  });
  const cal = safeJsonParse(localStorage.getItem('crystal_salary_calendar'), null);
  if (cal) salaryCalendar = cal;
  const now = new Date();
  if (!salaryCurMonth) salaryCurMonth = { year: now.getFullYear(), month: now.getMonth() };
  renderSalaryCalendar();
}
function saveSalaryConfig() { try { localStorage.setItem('crystal_salary_config', JSON.stringify(salaryConfig)); } catch (e) {} }
function saveSalaryCalendar() {
  try { localStorage.setItem('crystal_salary_calendar', JSON.stringify(salaryCalendar)); } catch (e) {}
}

function salaryNavMonth(delta) {
  let m = salaryCurMonth.month + delta, y = salaryCurMonth.year;
  while (m < 0) { m += 12; y--; }
  while (m > 11) { m -= 12; y++; }
  salaryCurMonth = { year: y, month: m };
  renderSalaryCalendar();
}
function salaryGoToday() {
  const now = new Date();
  salaryCurMonth = { year: now.getFullYear(), month: now.getMonth() };
  renderSalaryCalendar();
}

function renderSalaryCalendar() {
  const grid = document.getElementById('salaryCalGrid');
  const label = document.getElementById('salaryMonthLabel');
  if (!grid || !label || !salaryCurMonth) return;
  const { year, month } = salaryCurMonth;
  label.textContent = _salaryMonthLabel(year, month);

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = _salaryMonthKey(year, month);
  const monthData = salaryCalendar[monthKey] || {};
  const now = new Date();
  const isCurMonth = now.getFullYear() === year && now.getMonth() === month;

  grid.innerHTML = '';
  for (let i = 0; i < startWeekday; i++) {
    const c = document.createElement('div');
    c.className = 'salary-day empty';
    grid.appendChild(c);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement('div');
    cell.className = 'salary-day';
    const weekday = new Date(year, month, d).getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    if (isCurMonth && d === now.getDate()) cell.classList.add('today');
    if (isWeekend) cell.classList.add('weekend');
    const entry = monthData[d];
    if (entry && ((entry.sites && entry.sites.length) || entry.otId)) cell.classList.add('has-entry');
    let html = `<div class="salary-day-num${isWeekend ? ' weekend' : ''}">${d}</div>`;
    if (entry) {
      if (entry.sites && entry.sites.length) {
        html += '<div class="salary-day-tags">';
        entry.sites.forEach(sid => {
          const s = salaryConfig.sites.find(x => x.id === sid);
          if (s) html += `<span class="salary-day-tag" style="background:${_siteColor(s.id)};color:#fff">${escapeHtml(s.name)}</span>`;
        });
        html += '</div>';
      }
      if (entry.otId) {
        const ot = salaryConfig.otRates.find(x => x.id === entry.otId);
        if (ot) html += `<div class="salary-day-ot">OT ${_fmtMoney(ot.rate)}</div>`;
      }
    }
    cell.innerHTML = html;
    cell.addEventListener('click', () => openSalaryDayModal(d));
    grid.appendChild(cell);
  }
  recalcSalaryMonth();
}

// ----- Day editor modal -----
function openSalaryDayModal(day) {
  if (!requireSalaryAccess()) return;
  salaryEditingDay = day;
  const { year, month } = salaryCurMonth;
  const monthKey = _salaryMonthKey(year, month);
  const entry = (salaryCalendar[monthKey] && salaryCalendar[monthKey][day]) || { sites: [], otId: null };
  document.getElementById('salaryDayTitle').textContent =
    (currentLang === 'en' ? '' : 'วันที่ ') + day + ' ' + _salaryMonthLabel(year, month);

  const sc = document.getElementById('salaryDaySiteChips');
  sc.innerHTML = '';
  if (!salaryConfig.sites.length) {
    sc.innerHTML = `<div style="color:var(--text3);font-size:12px">${currentLang === 'en' ? 'No sites configured. Open ⚙️ Settings to add some.' : 'ยังไม่มีไซต์ที่ตั้งค่าไว้ กด ⚙️ ตั้งค่า เพื่อเพิ่ม'}</div>`;
  } else {
    salaryConfig.sites.forEach(s => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'salary-chip' + (entry.sites && entry.sites.includes(s.id) ? ' active' : '');
      chip.innerHTML = `${escapeHtml(s.name)}<span class="salary-chip-rate">฿${_fmtMoney(s.rate)}</span>`;
      chip.dataset.siteId = s.id;
      chip.addEventListener('click', () => chip.classList.toggle('active'));
      sc.appendChild(chip);
    });
  }
  const oc = document.getElementById('salaryDayOtChips');
  oc.innerHTML = '';
  const noneChip = document.createElement('button');
  noneChip.type = 'button';
  noneChip.className = 'salary-chip ot' + (!entry.otId ? ' active' : '');
  noneChip.textContent = currentLang === 'en' ? 'No OT' : 'ไม่มี OT';
  noneChip.dataset.otId = '';
  noneChip.addEventListener('click', () => _selectOtChip(noneChip));
  oc.appendChild(noneChip);
  salaryConfig.otRates.forEach(o => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'salary-chip ot' + (entry.otId === o.id ? ' active' : '');
    chip.innerHTML = `${escapeHtml(o.label)}<span class="salary-chip-rate">฿${_fmtMoney(o.rate)}</span>`;
    chip.dataset.otId = o.id;
    chip.addEventListener('click', () => _selectOtChip(chip));
    oc.appendChild(chip);
  });

  openModal('salaryDayModal');
}
function _selectOtChip(chip) {
  chip.parentElement.querySelectorAll('.salary-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
}
function closeSalaryDayModal() {
  closeModal('salaryDayModal');
  salaryEditingDay = null;
}
function saveSalaryDay() {
  if (!requireSalaryAccess()) return;
  if (!salaryEditingDay) return;
  const { year, month } = salaryCurMonth;
  const monthKey = _salaryMonthKey(year, month);
  const sites = [];
  document.querySelectorAll('#salaryDaySiteChips .salary-chip.active').forEach(c => {
    const id = parseInt(c.dataset.siteId);
    if (id) sites.push(id);
  });
  const otActive = document.querySelector('#salaryDayOtChips .salary-chip.active');
  const otId = otActive && otActive.dataset.otId ? parseInt(otActive.dataset.otId) : null;
  if (!salaryCalendar[monthKey]) salaryCalendar[monthKey] = {};
  if (sites.length === 0 && !otId) {
    delete salaryCalendar[monthKey][salaryEditingDay];
    if (Object.keys(salaryCalendar[monthKey]).length === 0) delete salaryCalendar[monthKey];
  } else {
    const travel = sites.reduce((sum, sid) => {
      const site = salaryConfig.sites.find(s => s.id === sid);
      return sum + (parseFloat(site?.rate) || 0);
    }, 0);
    // FIXED v6: Salary entries are personal/global and keep normalized payroll fields.
    salaryCalendar[monthKey][salaryEditingDay] = {
      id: `personal_${monthKey}_${salaryEditingDay}`,
      project_id: 'personal',
      date: `${monthKey}-${String(salaryEditingDay).padStart(2, '0')}`,
      site: sites.map(sid => salaryConfig.sites.find(s => s.id === sid)?.name || String(sid)).join(', '),
      sites,
      otId,
      ot_hours: otId ? 1 : 0,
      travel,
      notes: ''
    };
  }
  saveSalaryCalendar();
  closeSalaryDayModal();
  renderSalaryCalendar();
}
function clearSalaryDay() {
  if (!requireSalaryAccess()) return;
  if (!salaryEditingDay) return;
  const { year, month } = salaryCurMonth;
  const monthKey = _salaryMonthKey(year, month);
  if (salaryCalendar[monthKey]) {
    delete salaryCalendar[monthKey][salaryEditingDay];
    if (Object.keys(salaryCalendar[monthKey]).length === 0) delete salaryCalendar[monthKey];
    saveSalaryCalendar();
  }
  closeSalaryDayModal();
  renderSalaryCalendar();
}

// ----- Settings modal -----
function openSalarySettings() {
  if (!requireSalaryAccess()) return;
  document.getElementById('salarySetBase').value = salaryConfig.baseSalary || '';
  _renderSetList('salarySetSites', salaryConfig.sites, ['name', 'rate'], ['ชื่อไซต์ / Site name', 'อัตรา/วัน']);
  _renderSetList('salarySetOtRates', salaryConfig.otRates, ['label', 'rate'], ['ชื่ออัตรา OT', 'อัตรา/ครั้ง']);
  _renderSetList('salarySetExtras', salaryConfig.extras, ['label', 'amount'], ['ชื่อรายได้', 'จำนวน']);
  _renderSetList('salarySetDeductions', salaryConfig.deductions, ['label', 'amount'], ['ชื่อรายหัก', 'จำนวน']);
  openModal('salarySettingsModal');
}
function closeSalarySettings() { closeModal('salarySettingsModal'); }

function _renderSetList(containerId, items, fields, placeholders) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'salary-set-row';
    row.dataset.itemId = item.id;
    let html = '';
    fields.forEach((f, i) => {
      const isNum = f === 'rate' || f === 'amount';
      const type = isNum ? 'number' : 'text';
      const step = isNum ? ' step="0.01"' : '';
      html += `<input type="${type}"${step} data-field="${f}" value="${escapeHtml(String(item[f] ?? ''))}" placeholder="${escapeHtml(placeholders[i] || '')}">`;
    });
    html += `<button type="button" class="del-row-btn" title="Remove" aria-label="Remove">×</button>`;
    row.innerHTML = html;
    row.querySelector('.del-row-btn').addEventListener('click', () => {
      const arr = (containerId === 'salarySetSites') ? salaryConfig.sites
                : (containerId === 'salarySetOtRates') ? salaryConfig.otRates
                : (containerId === 'salarySetExtras') ? salaryConfig.extras
                : salaryConfig.deductions;
      const idx = arr.findIndex(x => x.id === item.id);
      if (idx >= 0) arr.splice(idx, 1);
      _renderSetList(containerId, arr, fields, placeholders);
    });
    container.appendChild(row);
  });
}

function addSalarySite() { salaryConfig.sites.push({ id: _salaryGenId(), name: '', rate: 0 }); openSalarySettings(); }
function addSalaryOtRate() { salaryConfig.otRates.push({ id: _salaryGenId(), label: '', rate: 0 }); openSalarySettings(); }
function addSalaryExtra() { salaryConfig.extras.push({ id: _salaryGenId(), label: '', amount: 0 }); openSalarySettings(); }
function addSalaryDeduction() { salaryConfig.deductions.push({ id: _salaryGenId(), label: '', amount: 0 }); openSalarySettings(); }

function saveSalarySettings() {
  if (!requireSalaryAccess()) return;
  salaryConfig.baseSalary = parseFloat(document.getElementById('salarySetBase').value) || 0;
  [['salarySetSites','sites',['name','rate']],
   ['salarySetOtRates','otRates',['label','rate']],
   ['salarySetExtras','extras',['label','amount']],
   ['salarySetDeductions','deductions',['label','amount']]].forEach(([containerId, key, fields]) => {
    const newArr = [];
    document.querySelectorAll('#' + containerId + ' .salary-set-row').forEach(row => {
      const item = { id: parseInt(row.dataset.itemId) };
      fields.forEach(f => {
        const el = row.querySelector('[data-field="' + f + '"]');
        if (!el) return;
        item[f] = (f === 'rate' || f === 'amount') ? (parseFloat(el.value) || 0) : el.value;
      });
      const labelKey = fields[0];
      if (item[labelKey] || item[fields[1]]) newArr.push(item);
    });
    salaryConfig[key] = newArr;
  });
  saveSalaryConfig();
  closeSalarySettings();
  renderSalaryCalendar();
  toast(currentLang === 'en' ? '✓ Settings saved' : '✓ บันทึกการตั้งค่าแล้ว', 'success');
}

function resetSalaryConfigToDefault() {
  if (!confirm(currentLang === 'en' ? 'Reset to example config? Current settings will be lost.' : 'คืนค่าตัวอย่าง? การตั้งค่าปัจจุบันจะหายไป')) return;
  salaryConfig = deepClone(SALARY_DEFAULT_CONFIG);
  saveSalaryConfig();
  openSalarySettings();
  toast(currentLang === 'en' ? '✓ Reset to example' : '✓ คืนค่าตัวอย่างแล้ว', 'success');
}

// ----- Summary calculation -----
function recalcSalaryMonth() {
  if (!salaryCurMonth) return;
  const { year, month } = salaryCurMonth;
  const monthKey = _salaryMonthKey(year, month);
  const monthData = salaryCalendar[monthKey] || {};
  const labelEl = document.getElementById('salarySummaryMonthLabel');
  if (labelEl) labelEl.textContent = (currentLang === 'en' ? 'Summary — ' : 'สรุปเดือน ') + _salaryMonthLabel(year, month);
  // Update print-only period
  const printPeriod = document.getElementById('salaryPrintPeriod');
  if (printPeriod) printPeriod.textContent = (currentLang === 'en' ? 'Period: ' : 'ประจำเดือน: ') + _salaryMonthLabel(year, month);

  const siteCounts = new Map();
  const otCounts = new Map();
  Object.values(monthData).forEach(entry => {
    (entry.sites || []).forEach(sid => siteCounts.set(sid, (siteCounts.get(sid) || 0) + 1));
    if (entry.otId) otCounts.set(entry.otId, (otCounts.get(entry.otId) || 0) + 1);
  });

  const body = document.getElementById('salarySummaryBody');
  if (!body) return;
  let html = '';
  const base = parseFloat(salaryConfig.baseSalary) || 0;
  let total = base;
  html += `<div class="salary-summary-group"><div class="salary-summary-row"><span>💵 ${currentLang === 'en' ? 'Base Salary' : 'เงินเดือนหลัก'}</span><span>${_fmtMoney(base)}</span></div></div>`;

  if (otCounts.size > 0) {
    let otTotal = 0;
    html += `<div class="salary-summary-group"><div class="salary-summary-row income"><span>⏰ OT</span><span></span></div>`;
    otCounts.forEach((cnt, otId) => {
      const ot = salaryConfig.otRates.find(x => x.id === otId);
      if (!ot) return;
      const sub = (ot.rate || 0) * cnt;
      otTotal += sub;
      html += `<div class="salary-summary-row indent income"><span>${escapeHtml(ot.label)} ${cnt} ${currentLang === 'en' ? 'days' : 'วัน'} × ${_fmtMoney(ot.rate)}</span><span>+${_fmtMoney(sub)}</span></div>`;
    });
    html += `<div class="salary-summary-row income"><span style="padding-left:16px;font-weight:600">${currentLang === 'en' ? 'OT total' : 'รวม OT'}</span><span>+${_fmtMoney(otTotal)}</span></div></div>`;
    total += otTotal;
  }

  if (siteCounts.size > 0) {
    let travelTotal = 0;
    html += `<div class="salary-summary-group"><div class="salary-summary-row income"><span>📍 ${currentLang === 'en' ? 'Travel allowance' : 'ค่าเดินทาง'}</span><span></span></div>`;
    salaryConfig.sites.forEach(s => {
      const cnt = siteCounts.get(s.id) || 0;
      if (!cnt) return;
      const sub = (s.rate || 0) * cnt;
      travelTotal += sub;
      html += `<div class="salary-summary-row indent income"><span>${escapeHtml(s.name)} ${cnt} ${currentLang === 'en' ? 'days' : 'วัน'} × ${_fmtMoney(s.rate)}</span><span>+${_fmtMoney(sub)}</span></div>`;
    });
    html += `<div class="salary-summary-row income"><span style="padding-left:16px;font-weight:600">${currentLang === 'en' ? 'Travel total' : 'รวมค่าเดินทาง'}</span><span>+${_fmtMoney(travelTotal)}</span></div></div>`;
    total += travelTotal;
  }

  if (salaryConfig.extras && salaryConfig.extras.length) {
    let group = '';
    salaryConfig.extras.forEach(e => {
      const amt = parseFloat(e.amount) || 0;
      if (!amt || !e.label) return;
      group += `<div class="salary-summary-row income"><span>➕ ${escapeHtml(e.label)}</span><span>+${_fmtMoney(amt)}</span></div>`;
      total += amt;
    });
    if (group) html += `<div class="salary-summary-group">${group}</div>`;
  }

  if (salaryConfig.deductions && salaryConfig.deductions.length) {
    let group = '';
    salaryConfig.deductions.forEach(d => {
      const amt = parseFloat(d.amount) || 0;
      if (!amt || !d.label) return;
      group += `<div class="salary-summary-row deduction"><span>➖ ${escapeHtml(d.label)}</span><span>−${_fmtMoney(amt)}</span></div>`;
      total -= amt;
    });
    if (group) html += `<div class="salary-summary-group">${group}</div>`;
  }

  body.innerHTML = html;
  document.getElementById('salaryGrandTotal').textContent = _fmtMoney(total);
}

function clearSalaryMonth() {
  if (!requireSalaryAccess()) return;
  const { year, month } = salaryCurMonth;
  const monthKey = _salaryMonthKey(year, month);
  if (!confirm(currentLang === 'en' ? `Clear all entries for ${_salaryMonthLabel(year, month)}?` : `ล้างข้อมูลทั้งหมดของเดือน ${_salaryMonthLabel(year, month)}?`)) return;
  delete salaryCalendar[monthKey];
  saveSalaryCalendar();
  renderSalaryCalendar();
}

function exportSalaryPDF() {
  if (!requireSalaryAccess()) return;
  // FIXED v6.11.6: use openTool (not switchTab) so _activeToolPanel = salary panel.
  // switchTab only adds .active class; beforeprint needs _activeToolPanel set
  // to know which panel to move to _crystalPrintHost. Without this, if user
  // was previously viewing another tool (e.g. Users), that tool's panel would
  // be moved instead of salary, printing the wrong content.
  openTool('salary');
  setTimeout(() => {
    toast(currentLang === 'en' ? 'Tip: choose "Save as PDF" in the print dialog' : 'เคล็ดลับ: เลือก "Save as PDF" ในกล่อง Print', 'info');
    window.print();
  }, 250);
}
