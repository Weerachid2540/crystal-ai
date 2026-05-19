'use strict';
// ============================================================
// Crystal AI — boq.js  (Phase-4D-8 extraction)
// BOQ / VO table: data model, DOM rendering, save/load, AI generators
// Depends on: utils.js (escapeHtml, safeJsonParse, val, tr via runtime),
//             i18n.js (currentLang), storage.js (localStorage proxy)
// Runtime deps (resolved at call time, all in inline script):
//   runGenerator() — §6 FORM GENERATORS
// NOTE: buildBOQRowEl and updateBOQRow use local `const tr = ...`
//   which shadows the global tr() translation fn inside those functions.
//   This is safe — tr() is never called inside those two functions.
// ============================================================

function generateBOQ() {
  const items = getBOQItems();
  const total = document.getElementById('boqTotal').textContent;
  const prompt = `Generate a ${docType} document for Crystal Engineering Corporation:
Project: ${val('boq_proj') || '-'} | Date: ${val('boq_date')} | Category: ${val('boq_cat')} | ${val('boq_detail') || ''}
Items:
${items || '(no items)'}
Total: ${total} THB
Include header, document number, terms & conditions.`;
  runGenerator({ panelId: 'panel-proc', loadId: 'loadingBOQ', btnId: 'genBOQBtn', areaId: 'resultBOQ', textId: 'resultBOQText', prompt });
}

function generateVO() {
  const prompt = `Generate a Variation Order document for Crystal Engineering Corporation:
Project: ${val('vo_proj') || '-'} | No: ${val('vo_no') || 'VO-XXX'} | Date: ${val('vo_date')} | Type: ${val('vo_type')}
Original Scope: ${val('vo_original') || '-'}
Changes: ${val('vo_change') || '-'}
Impact: ${val('vo_impact') || '-'}
Include purpose, scope, cost breakdown, signature block.`;
  runGenerator({ panelId: 'panel-vo', loadId: 'loadingVO', btnId: 'genVOBtn', areaId: 'resultVO', textId: 'resultVOText', prompt });
}

// ============================================================
// 7. BOQ TABLE (FIXED #6 shadowing, #8 toFixed, #9 negative, #17 focus)
// ============================================================
let docType = 'BOQ';
let boqRows = [];
let boqRowIdCounter = 0;

// FIXED #6: parameter shadowing — use 'type' instead of 't'
function selectDoc(type) {
  docType = type;
  document.querySelectorAll('.doc-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('doc' + type).classList.add('selected');
}

// FIXED #8: format ตัวเลข 2 ทศนิยม + locale
function fmtNum(n) {
  const num = Number(n) || 0;
  return num.toLocaleString(currentLang === 'en' ? 'en-US' : 'th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function addBOQRow(data) {
  const id = ++boqRowIdCounter;
  const row = { id, item: data?.item || '', qty: data?.qty || '', unit: data?.unit || '', price: data?.price || '' };
  boqRows.push(row);
  // FIXED #17: append เฉพาะแถวใหม่ ไม่ re-render ทั้งตาราง = preserve focus
  appendBOQRowToDOM(row, boqRows.length - 1);
  recalcBOQTotal();
  saveBOQ();
}

function delBOQRow(id) {
  boqRows = boqRows.filter(r => r.id !== id);
  renderBOQ();
}

function clearBOQ() {
  if (!confirm(tr('confirm_clear_boq'))) return;
  boqRows = [];
  addBOQRow();
}

// Build single row TR element (extracted for reuse)
function buildBOQRowEl(row, index) {
  const qty = parseFloat(row.qty) || 0;
  const price = parseFloat(row.price) || 0;
  const total = qty * price;
  const tr = document.createElement('tr');
  tr.className = 'boq-row';
  tr.dataset.rowId = row.id;
  tr.innerHTML = `
    <td>${index + 1}</td>
    <td><input value="${escapeHtml(row.item)}" oninput="updateBOQRow(${row.id},'item',this.value)" aria-label="Item"/></td>
    <td><input type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(row.qty)}" oninput="updateBOQRow(${row.id},'qty',this.value)" style="text-align:right" aria-label="Quantity"/></td>
    <td><input value="${escapeHtml(row.unit)}" oninput="updateBOQRow(${row.id},'unit',this.value)" aria-label="Unit"/></td>
    <td><input type="number" min="0" step="any" inputmode="decimal" value="${escapeHtml(row.price)}" oninput="updateBOQRow(${row.id},'price',this.value)" style="text-align:right" aria-label="Unit price"/></td>
    <td class="row-total" style="color:var(--accent);font-family:var(--mono);text-align:right">${fmtNum(total)}</td>
    <td><button class="del-row-btn" onclick="delBOQRow(${row.id})" aria-label="Delete row">×</button></td>
  `;
  return tr;
}

function appendBOQRowToDOM(row, index) {
  const tb = document.getElementById('boqBody');
  tb.appendChild(buildBOQRowEl(row, index));
}

function renderBOQ() {
  const tb = document.getElementById('boqBody');
  tb.innerHTML = '';
  boqRows.forEach((row, i) => tb.appendChild(buildBOQRowEl(row, i)));
  recalcBOQTotal();
  saveBOQ();
}

function updateBOQRow(id, field, value) {
  const r = boqRows.find(x => x.id === id);
  if (!r) return;
  r[field] = value;
  // FIXED #6 (also #C): use dataset.rowId แทน fragile querySelector
  const tr = document.querySelector(`#boqBody tr[data-row-id="${id}"]`);
  if (tr) {
    const qty = parseFloat(r.qty) || 0;
    const price = parseFloat(r.price) || 0;
    const total = qty * price;
    const totalCell = tr.querySelector('.row-total');
    if (totalCell) totalCell.textContent = fmtNum(total);
  }
  recalcBOQTotal();
  saveBOQ();
}

function recalcBOQTotal() {
  const sum = boqRows.reduce((acc, r) => acc + (parseFloat(r.qty) || 0) * (parseFloat(r.price) || 0), 0);
  document.getElementById('boqTotal').textContent = fmtNum(sum);
}

function getBOQItems() {
  return boqRows.filter(r => r.item).map((r, i) =>
    `${i + 1}. ${r.item} | Qty: ${r.qty || 0} ${r.unit || ''} | Unit Price: ${fmtNum(r.price || 0)} THB`
  ).join('\n');
}

function saveBOQ() {
  try { localStorage.setItem('crystal_boq', JSON.stringify(boqRows)); } catch (e) {}
}

function loadBOQ() {
  const saved = safeJsonParse(localStorage.getItem('crystal_boq'), []);
  if (Array.isArray(saved) && saved.length) {
    // validate shape
    boqRows = saved.filter(r => r && typeof r === 'object').map((r, i) => ({
      id: typeof r.id === 'number' ? r.id : (i + 1),
      item: String(r.item || ''),
      qty: String(r.qty || ''),
      unit: String(r.unit || ''),
      price: String(r.price || '')
    }));
    boqRowIdCounter = Math.max(...boqRows.map(r => r.id), 0);
  }
  if (!boqRows.length) addBOQRow();
  else renderBOQ();
}
