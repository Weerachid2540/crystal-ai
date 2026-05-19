'use strict';
// ============================================================
// Crystal AI — forms.js  (Phase-4F extraction)
// §6 FORM VALIDATION + GENERATORS
// Core form validation, loading states, result rendering,
// copy/export helpers, AI generator runner, and all report generators.
// Depends on: utils.js (val, escapeHtml, localDate, friendlyError, requireProjectContext),
//             markdown.js (renderMarkdown),
//             toast.js (toast),
//             i18n.js (tr, currentLang),
//             api.js (callAPI, apiInFlight, getActiveKey),
//             settings-ui.js (openSettings)
// Runtime deps (resolved at call time, all in inline script):
//   dailyImages        — declared in DAILY REPORT PHOTO ATTACHMENTS section
//   wkAct, wkIssue, wkNext, wkTargets — declared in WEEKLY TABLE section
//   moAct, moIssue, moNext, moTargets — declared in MONTHLY TABLE section
// ============================================================

function validateForm(panelId) {
  const panel = document.getElementById(panelId);
  let firstErr = null;
  panel.querySelectorAll('[data-required]').forEach(el => {
    const errEl = el.parentElement.querySelector('.field-error');
    if (!el.value.trim()) {
      el.classList.add('error');
      if (errEl) errEl.classList.add('show');
      if (!firstErr) firstErr = el;
    } else {
      el.classList.remove('error');
      if (errEl) errEl.classList.remove('show');
    }
  });
  if (firstErr) {
    firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstErr.focus();
    toast(tr('err_required'), 'error');
    return false;
  }
  return true;
}

// FIXED #7: ลบสถานะ error ทันทีเมื่อ user เริ่มพิมพ์
function setupErrorAutoClear() {
  document.querySelectorAll('[data-required]').forEach(el => {
    el.addEventListener('input', () => {
      if (el.value.trim()) {
        el.classList.remove('error');
        const errEl = el.parentElement.querySelector('.field-error');
        if (errEl) errEl.classList.remove('show');
      }
    });
  });
}

function setLoading(loadId, btnId, show) {
  document.getElementById(loadId).classList.toggle('show', show);
  if (btnId) {
    const b = document.getElementById(btnId);
    if (b) b.disabled = show;
  }
}

function showResult(areaId, textId, text, isRawHtml) {
  const area = document.getElementById(areaId);
  const target = document.getElementById(textId);
  target.innerHTML = isRawHtml ? text : renderMarkdown(text);
  target.dataset.aiGenerated = '1';
  area.classList.add('show');
  setTimeout(() => area.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
}

// FIXED #10: clipboard fallback for Safari/iOS/private mode
function copyResult(textId) {
  const text = document.getElementById(textId).innerText;
  copyText(text).then(() => {
    toast(currentLang === 'en' ? '✓ Copied' : '✓ คัดลอกแล้ว', 'success');
  }).catch(() => {
    toast(currentLang === 'en' ? '❌ Copy failed' : '❌ คัดลอกไม่สำเร็จ', 'error');
  });
}

function copyText(text) {
  // Modern API
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback: deprecated execCommand
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      ta.setAttribute('readonly', '');
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      ok ? resolve() : reject(new Error('execCommand failed'));
    } catch (e) { reject(e); }
  });
}

// FIXED #14: revoke URL after delay (some browsers need time to start download)
function exportTxt(textId, filename) {
  const text = document.getElementById(textId).innerText;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${localDate()}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function runGenerator({ panelId, loadId, btnId, areaId, textId, prompt }) {
  if (['panel-report','panel-weekly','panel-monthly'].includes(panelId) && !requireProjectContext('Reports')) return;
  if (!validateForm(panelId)) return;
  if (!getActiveKey()) {
    toast(tr('no_key'), 'error');
    openSettings();
    return;
  }
  if (apiInFlight) {
    toast(tr('busy'), 'error');
    return;
  }
  setLoading(loadId, btnId, true);
  try {
    const reply = await callAPI([{ role: 'user', content: prompt }]);
    showResult(areaId, textId, reply);
  } catch (e) {
    showResult(areaId, textId, friendlyError(e), true);
  } finally {
    setLoading(loadId, btnId, false);
  }
}

function generateDailyReport() {
  if (!requireProjectContext('Daily Report')) return;
  const photoNote = dailyImages.length > 0
    ? `\nAttached Photos: ${dailyImages.length} ${currentLang === 'en' ? 'site photo(s)' : 'รูปประกอบหน้างาน'}`
    : '';
  const prompt = `${currentLang === 'en' ? 'Generate a formal daily construction report' : 'สร้างรายงานก่อสร้างรายวันอย่างเป็นทางการ'}:
Project: ${val('rpt_proj') || '-'} | Date: ${val('rpt_date')} | Reporter: ${val('rpt_name') || '-'} | Weather: ${val('rpt_weather')}
Structural: ${val('rpt_str') || '-'}
Architectural: ${val('rpt_arch') || '-'}
MEP: ${val('rpt_mep') || '-'}
Issues: ${val('rpt_issue') || '-'}
Tomorrow Plan: ${val('rpt_plan') || '-'}${photoNote}
Format with clear headings, suitable for management review.`;
  runGenerator({ panelId: 'panel-report', loadId: 'loadingDaily', btnId: 'genDailyBtn', areaId: 'resultDaily', textId: 'resultDailyText', prompt });
}

// ============================================================
// Format table data into prompt-friendly text
// Used by generateWeeklyReport / generateMonthlyReport
// ============================================================
function _formatActRows(rows, withUsed) {
  if (!rows.length) return '(none)';
  return rows.map((r, i) => {
    const parts = [`${i + 1}. ${r.desc || '-'}`];
    if (withUsed && r.used) parts.push(`Used: ${r.used} Mhr`);
    if (r.progress) parts.push(`Progress: ${r.progress}%`);
    if (r.statusIssue) parts.push(`Status Issue: ${r.statusIssue}`);
    if (r.dueDate) parts.push(`Due: ${r.dueDate}`);
    if (r.remark) parts.push(`Remark: ${r.remark}`);
    return parts.join(' | ');
  }).join('\n');
}
function _formatIssueRows(rows) {
  if (!rows.length) return '(none)';
  return rows.map((r, i) => `${i + 1}. ${r.issue || '-'} | Action: ${r.actionBy || '-'} | Due: ${r.dueDate || '-'}`).join('\n');
}
function _formatNextRows(rows) {
  if (!rows.length) return '(none)';
  return rows.map((r, i) => {
    const parts = [`${i + 1}. ${r.desc || '-'}`];
    if (r.progress) parts.push(`Progress: ${r.progress}%`);
    if (r.statusIssue) parts.push(`Status Issue: ${r.statusIssue}`);
    if (r.dueDate) parts.push(`Due: ${r.dueDate}`);
    return parts.join(' | ');
  }).join('\n');
}
function _formatTargetRows(rows) {
  if (!rows.length) return '-';
  return rows.map((r, i) => {
    const parts = [`${i + 1}. ${r.target || '-'}`];
    if (r.statusIssue) parts.push(`Status Issue: ${r.statusIssue}`);
    if (r.dueDate) parts.push(`Due: ${r.dueDate}`);
    return parts.join(' | ');
  }).join('\n');
}

function generateWeeklyReport() {
  if (!requireProjectContext('Weekly Report')) return;
  const lang = currentLang === 'en' ? 'English' : 'Thai';
  const prompt = `Generate a formal Weekly Construction Site Report in ${lang}, formatted to match Crystal Engineering's standard template.

[REPORT HEADER]
Report No.: ${val('wk_no') || '-'}
Project Code: ${val('wk_proj_code') || '-'}
Project Name: ${val('wk_proj') || '-'}
Department: ${val('wk_dept') || '-'}
Work Type: ${val('wk_worktype') || '-'}
Work Description: ${val('wk_workdesc') || '-'}
Period: ${val('wk_from') || '-'} to ${val('wk_to') || '-'}
Reported by: ${val('wk_reporter') || '-'}
Approved by: ${val('wk_approver') || '-'}
Plan: ${val('wk_plan_pct') || 0}% | Actual: ${val('wk_actual_pct') || 0}% | Variance: ${(parseFloat(val('wk_actual_pct'))||0) - (parseFloat(val('wk_plan_pct'))||0)}%

[1. THIS WEEK ACTIVITIES]
${_formatActRows(wkAct, false)}

[2. MAJOR ISSUES & OUTSTANDING]
${_formatIssueRows(wkIssue)}

[3. NEXT WEEK ACTIVITIES]
${_formatNextRows(wkNext)}

[4. CURRENT IMPORTANT TARGETS]
${_formatTargetRows(wkTargets)}

Output a clean formal report with: bolded section headings (1. This Week Activities, 2. Major Issues, 3. Next Week Activities, 4. Current Important Targets), bullet points or numbered lists where appropriate, brief variance analysis (Plan vs Actual), and a polite closing summary suitable for management review.`;
  runGenerator({ panelId: 'panel-weekly', loadId: 'loadingWeekly', btnId: 'genWeeklyBtn', areaId: 'resultWeekly', textId: 'resultWeeklyText', prompt });
}

function generateMonthlyReport() {
  if (!requireProjectContext('Monthly Report')) return;
  const lang = currentLang === 'en' ? 'English' : 'Thai';
  const prompt = `Generate a formal Monthly Construction Site Report in ${lang}, formatted to match Crystal Engineering's standard template, suitable for executives.

[REPORT HEADER]
Report No.: ${val('mo_no') || '-'}
Project Code: ${val('mo_proj_code') || '-'}
Project Name: ${val('mo_proj') || '-'}
Department: ${val('mo_dept') || '-'}
Work Type: ${val('mo_worktype') || '-'}
Work Description: ${val('mo_workdesc') || '-'}
Period: ${val('mo_from') || '-'} to ${val('mo_to') || '-'}
Reported by: ${val('mo_reporter') || '-'}
Approved by: ${val('mo_approver') || '-'}
Cumulative Plan: ${val('mo_plan') || 0}% | Actual: ${val('mo_actual') || 0}% | Variance: ${(parseFloat(val('mo_actual'))||0) - (parseFloat(val('mo_plan'))||0)}%

[1. THIS MONTH ACTIVITIES]
${_formatActRows(moAct, true)}

[2. MAJOR ISSUES & OUTSTANDING]
${_formatIssueRows(moIssue)}

[3. NEXT MONTH ACTIVITIES]
${_formatNextRows(moNext)}

[4. CURRENT IMPORTANT TARGETS]
${_formatTargetRows(moTargets)}

Output a polished monthly report with: an Executive Summary at the top, bolded section headings, bullet points where useful, a Plan-vs-Actual variance analysis with brief commentary, and a concluding outlook for the next month.`;
  runGenerator({ panelId: 'panel-monthly', loadId: 'loadingMonthly', btnId: 'genMonthlyBtn', areaId: 'resultMonthly', textId: 'resultMonthlyText', prompt });
}
