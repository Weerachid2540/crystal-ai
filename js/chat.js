'use strict';
// ============================================================
// Crystal AI — chat.js  (Phase-4D-9 extraction)
// Project chat + Dashboard AI chat + rule-based summary intercept
// Depends on: utils.js (safeJsonParse, escapeHtml, setValue, friendlyError,
//               requireProjectContext), markdown.js (renderMarkdown),
//             toast.js (toast), i18n.js (tr, currentLang),
//             api.js (callAPI, getActiveKey, apiInFlight),
//             settings-ui.js (openSettings)
// Runtime deps (resolved at call time, all in inline script):
//   currentProjectId, currentProjectMeta, allProjects,
//   loadBOQ, loadReportTables, loadDrafts, loadWkPhotos,
//   loadSalary, _resetDailyPhotosMemory, loadDailyPhotos,
//   setView, renderDashQuickBtns (called via try/catch in applyLang)
// NOTE: renderWelcome() and renderQuickBtns() must stay global —
//   applyLang() in i18n.js calls them at language-switch time.
// ============================================================

// 5. CHAT (FIXED #12: persist + load + Ctrl+Enter)
// ============================================================
const MAX_HISTORY = 20;        // in-memory & sent to AI
const MAX_HISTORY_STORAGE = 50; // saved in localStorage (load latest)
let chatHistory = [];
let dashboardChatHistory = [];

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

// ============================================================
// DEAD CODE — v5 Dashboard AI block (element IDs removed in v6 redesign)
// dashboardAiMessages / dashboardAiInput do NOT exist in the DOM.
// v6 dashboard chat lives in dashChatMessages + sendDashChat() (line ~8255).
// Phase-3A: renderDashboardWelcome renamed to _dead_v5_renderDashboardWelcome
// to eliminate the JS function-declaration duplicate. DO NOT re-wire to HTML.
// ============================================================

function dashboardOverviewContext() {
  const projects = (allProjects || []).slice(0, 12).map((p, idx) => {
    const code = p.code || p.id || `P${idx + 1}`;
    const name = p.name || 'Untitled';
    const client = p.client ? ` client=${p.client}` : '';
    const location = p.location ? ` location=${p.location}` : '';
    return `- ${code}: ${name}${client}${location}`;
  }).join('\n') || '- ยังไม่มีโปรเจกต์บน Dashboard';
  return `Dashboard overview context:\n${projects}\n\nตอบในฐานะ AI Assistant หน้าหลักของ Crystal Engineering ช่วยสรุปภาพรวม จัดลำดับความสำคัญ และแนะนำ next action ระดับบริษัท ไม่สร้าง Reports แทน project module.`;
}

function _dead_v5_renderDashboardWelcome() {
  const wrap = document.getElementById('dashboardAiMessages');
  if (!wrap || dashboardChatHistory.length) return;
  const time = new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
  wrap.innerHTML = `<div class="msg ai">
    <div class="msg-avatar">C</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">Crystal AI</span><span class="msg-time">${time}</span></div>
      <div class="msg-bubble">สวัสดีครับ ผมอยู่หน้า Home เพื่อช่วยดูภาพรวมโปรเจกต์ทั้งหมด ถามเรื่องสถานะรวม, priority, งานที่ควรตาม หรือ next action ได้เลยครับ</div>
    </div>
  </div>`;
}

function appendDashboardMsg(role, name, text, isRawHtml) {
  const wrap = document.getElementById('dashboardAiMessages');
  if (!wrap) return;
  const time = new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
  const html = isRawHtml ? text : renderMarkdown(text);
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.innerHTML = `<div class="msg-avatar">${role === 'ai' ? 'C' : (currentLang === 'en' ? 'U' : 'ฉ')}</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${escapeHtml(name)}</span><span class="msg-time">${time}</span></div>
      <div class="msg-bubble">${html}</div>
    </div>`;
  wrap.appendChild(d);
  wrap.scrollTop = wrap.scrollHeight;
}

function clearDashboardAI() {
  dashboardChatHistory = [];
  _dead_v5_renderDashboardWelcome();
}

function dashboardQuickPrompt(text) {
  const input = document.getElementById('dashboardAiInput');
  if (!input) return;
  input.value = text;
  sendDashboardAI();
}

async function sendDashboardAI() {
  const input = document.getElementById('dashboardAiInput');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg) return;
  if (!getActiveKey()) {
    toast(tr('no_key'), 'error');
    openSettings();
    return;
  }
  if (apiInFlight) {
    toast(tr('busy'), 'error');
    return;
  }
  input.value = '';
  input.style.height = 'auto';
  appendDashboardMsg('user', currentLang === 'en' ? 'You' : 'คุณ', msg);
  dashboardChatHistory.push({ role: 'user', content: msg });
  dashboardChatHistory = dashboardChatHistory.slice(-MAX_HISTORY);
  const loading = document.createElement('div');
  loading.className = 'msg ai';
  loading.innerHTML = `<div class="msg-avatar">C</div><div class="msg-body"><div class="msg-meta"><span class="msg-name">Crystal AI</span></div><div class="loading show" style="padding:10px 14px"><div class="dot-loader"><span></span><span></span><span></span></div>${escapeHtml(tr('generating'))}</div></div>`;
  document.getElementById('dashboardAiMessages').appendChild(loading);
  try {
    const messages = [
      { role: 'user', content: dashboardOverviewContext() },
      ...dashboardChatHistory
    ];
    const reply = await callAPI(messages);
    dashboardChatHistory.push({ role: 'assistant', content: reply });
    dashboardChatHistory = dashboardChatHistory.slice(-MAX_HISTORY);
    loading.remove();
    appendDashboardMsg('ai', 'Crystal AI', reply);
  } catch (e) {
    loading.remove();
    appendDashboardMsg('ai', 'Crystal AI', friendlyError(e), true);
  }
}

function renderWelcome() {
  const m = document.getElementById('chatMessages');
  const side = document.getElementById('projectAiMessages');
  const time = new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
  // welcome content is from our own i18n object (trusted)
  const html = `<div class="msg ai">
    <div class="msg-avatar">C</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">Crystal AI</span><span class="msg-time">${time}</span></div>
      <div class="msg-bubble">${tr('welcome')}</div>
    </div>
  </div>`;
  m.innerHTML = html;
  if (side) side.innerHTML = html;
}

function renderQuickBtns() {
  const wrap = document.getElementById('quickBtns');
  wrap.innerHTML = '';
  const btns = tr('qbtns');
  if (!Array.isArray(btns)) return;
  btns.forEach(([label, prompt]) => {
    const b = document.createElement('button');
    b.className = 'qbtn';
    b.textContent = label;
    b.onclick = () => quickPrompt(prompt);
    wrap.appendChild(b);
  });
}

function appendMsg(role, name, text, isRawHtml) {
  const m = document.getElementById('chatMessages');
  const time = new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
  // isRawHtml = true: only used by friendlyError() with my own templates + escaped dynamic data
  const html = isRawHtml ? text : renderMarkdown(text);
  const d = document.createElement('div');
  d.className = `msg ${role}`;
  d.innerHTML = `<div class="msg-avatar">${role === 'ai' ? 'C' : (currentLang === 'en' ? 'U' : 'ฉ')}</div>
    <div class="msg-body">
      <div class="msg-meta"><span class="msg-name">${escapeHtml(name)}</span><span class="msg-time">${time}</span></div>
      <div class="msg-bubble">${html}</div>
    </div>`;
  m.appendChild(d);
  const side = document.getElementById('projectAiMessages');
  if (side) side.appendChild(d.cloneNode(true));
  scrollChat();
}

function scrollChat() {
  const m = document.getElementById('chatMessages');
  m.scrollTop = m.scrollHeight;
  const side = document.getElementById('projectAiMessages');
  if (side) side.scrollTop = side.scrollHeight;
}

function updateChatInfo() {
  document.getElementById('chatInfo').textContent = tr('msg_count').replace('{n}', chatHistory.length);
}

// FIXED #12: persist chat to localStorage
function saveChatHistory() {
  try {
    const trimmed = chatHistory.slice(-MAX_HISTORY_STORAGE);
    localStorage.setItem('crystal_chat', JSON.stringify(trimmed));
  } catch (e) { console.warn('saveChatHistory failed', e); }
}

function loadChatHistory() {
  if (!currentProjectId) return false;
  const data = safeJsonParse(localStorage.getItem('crystal_chat'), null);
  if (!Array.isArray(data) || data.length === 0) return false;
  // Validate shape
  const valid = data.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string');
  if (valid.length === 0) return false;
  chatHistory = valid.slice(-MAX_HISTORY);

  const cm = document.getElementById('chatMessages');
  cm.innerHTML = '';
  const side = document.getElementById('projectAiMessages');
  if (side) side.innerHTML = '';
  // render last MAX_HISTORY_STORAGE messages
  valid.forEach(m => {
    const role = m.role === 'user' ? 'user' : 'ai';
    const name = m.role === 'user' ? (currentLang === 'en' ? 'You' : 'คุณ') : 'Crystal AI';
    appendMsg(role, name, m.content);
  });
  updateChatInfo();
  return true;
}

async function sendChat() {
  const inp = document.getElementById('chatInput');
  const msg = inp.value.trim();
  if (!msg) return;

  // ── Feature 7: Rule-based project summary intercept ──
  // If message matches period keywords AND a project is open, render local template (no API)
  const intent = _detectChatIntent(msg);
  if (intent) {
    // Try to auto-switch project if user mentioned a different project's code/name
    const switched = _maybeSwitchProjectFromMsg(msg);
    if (switched) {
      // Phase-4A: _resetDailyPhotosMemory() before loadDailyPhotos() — prevent old
      // project's photos persisting when new project has no saved photos
      try { loadBOQ(); loadReportTables(); loadDrafts(); loadWkPhotos(); loadSalary(); _resetDailyPhotosMemory(); loadDailyPhotos(); } catch(e) {}
      setView('project');
    }
  }
  if (intent && currentProjectMeta) {
    inp.value = '';
    inp.style.height = 'auto';
    appendMsg('user', currentLang === 'en' ? 'You' : 'คุณ', msg);
    chatHistory.push({ role: 'user', content: msg });
    if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
    saveChatHistory();
    const summaryHtml = _renderChatSummary(intent);
    chatHistory.push({ role: 'assistant', content: '[Project summary — ' + intent + ']' });
    saveChatHistory();
    appendMsg('ai', 'Crystal AI', summaryHtml, true);
    updateChatInfo();
    return;
  }

  if (!getActiveKey()) {
    toast(tr('no_key'), 'error');
    openSettings();
    return;
  }

  if (apiInFlight) {
    toast(tr('busy'), 'error');
    return;
  }

  inp.value = '';
  inp.style.height = 'auto';
  appendMsg('user', currentLang === 'en' ? 'You' : 'คุณ', msg);
  chatHistory.push({ role: 'user', content: msg });

  if (chatHistory.length > MAX_HISTORY) chatHistory = chatHistory.slice(-MAX_HISTORY);
  saveChatHistory();

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  const te = document.createElement('div');
  te.className = 'msg ai';
  te.innerHTML = `<div class="msg-avatar">C</div><div class="msg-body"><div class="msg-meta"><span class="msg-name">Crystal AI</span></div><div class="loading show" style="padding:10px 14px"><div class="dot-loader"><span></span><span></span><span></span></div>${escapeHtml(tr('generating'))}</div></div>`;
  document.getElementById('chatMessages').appendChild(te);
  scrollChat();

  try {
    const reply = await callAPI(chatHistory);
    chatHistory.push({ role: 'assistant', content: reply });
    saveChatHistory();
    te.remove();
    appendMsg('ai', 'Crystal AI', reply);
  } catch (e) {
    te.remove();
    appendMsg('ai', 'Crystal AI', friendlyError(e), true);
  } finally {
    sendBtn.disabled = false;
    updateChatInfo();
  }
}

function quickPrompt(text) {
  setValue('chatInput', text);
  sendChat();
}

function sendProjectAI() {
  if (!requireProjectContext('AI Assistant')) return;
  const sideInput = document.getElementById('projectAiInput');
  const chatInput = document.getElementById('chatInput');
  if (!sideInput || !chatInput) return;
  chatInput.value = sideInput.value;
  sideInput.value = '';
  sideInput.style.height = 'auto';
  sendChat();
}

function clearChat() {
  if (!confirm(tr('confirm_clear_chat'))) return;
  chatHistory = [];
  localStorage.removeItem('crystal_chat');
  renderWelcome();
  updateChatInfo();
}

// ============================================================
// 12.35 AI CHAT — Rule-based project summary intercept
// (originally embedded in Structural section — belongs to chat)
// ============================================================
// ============================================================
// 12.35 AI CHAT — Rule-based project summary intercept
// Feature 7: keyword → query local DB → template (no API)
// ============================================================
const CHAT_PERIOD_KEYWORDS = {
  daily:   ['วันนี้','today','ประจำวัน','daily','รายวัน'],
  weekly:  ['สัปดาห์','อาทิตย์','weekly','week','รายสัปดาห์'],
  monthly: ['เดือน','monthly','month','รายเดือน'],
  overall: ['ภาพรวม','ทั้งหมด','summary','status','เป็นไง','โดยรวม','overall','สรุป']
};

function _detectChatIntent(msg) {
  const m = (msg || '').toLowerCase();
  for (const [period, kws] of Object.entries(CHAT_PERIOD_KEYWORDS)) {
    if (kws.some(k => m.includes(k.toLowerCase()))) return period;
  }
  return null;
}

// Scan for project-name/code references in message → switch context if found
function _maybeSwitchProjectFromMsg(msg) {
  if (!Array.isArray(allProjects) || !allProjects.length) return null;
  const m = (msg || '').toLowerCase();
  // Try code first (exact), then name substring
  let hit = allProjects.find(p => p.code && m.includes(p.code.toLowerCase()));
  if (!hit) hit = allProjects.find(p => p.name && p.name.toLowerCase().length > 4 && m.includes(p.name.toLowerCase().slice(0, 20)));
  if (hit && hit.id !== currentProjectId) {
    currentProjectId = hit.id;
    currentProjectMeta = hit;
    try { localStorage.setItem('crystal_current_project', hit.id); } catch (e) {}
    return hit;
  }
  return null;
}

// Pull data from currently-scoped localStorage (proxy handles project scoping)
// FIXED v5.1: support draft envelope { data, savedAt } in chat summaries — FEAT-1
function _unwrapDraft(raw) {
  return raw && raw.data ? raw.data : raw;
}
function _loadProjectChatData() {
  return {
    wk:        safeJsonParse(localStorage.getItem('crystal_wk_tables'), null),
    mo:        safeJsonParse(localStorage.getItem('crystal_mo_tables'), null),
    boq:       safeJsonParse(localStorage.getItem('crystal_boq'), []),
    wkPhotos:  safeJsonParse(localStorage.getItem('crystal_wk_photos'), []),
    wkDraft:   _unwrapDraft(safeJsonParse(localStorage.getItem('crystal_draft_panel-weekly'), null)),
    moDraft:   _unwrapDraft(safeJsonParse(localStorage.getItem('crystal_draft_panel-monthly'), null)),
    dailyDraft:_unwrapDraft(safeJsonParse(localStorage.getItem('crystal_draft_panel-report'), null)),
    voDraft:   _unwrapDraft(safeJsonParse(localStorage.getItem('crystal_draft_panel-vo'), null)),
  };
}

function _renderChatSummary(period) {
  if (!currentProjectMeta) {
    return `<div class="chat-summary">
<div class="csum-title">⚠️ ยังไม่ได้เปิดโปรเจกต์</div>
กรุณาเข้าโปรเจกต์ก่อนถามสรุปงาน — คลิก 🏠 Dashboard แล้วเลือกโปรเจกต์ที่ต้องการ
</div>`;
  }

  const d = _loadProjectChatData();
  const projectLabel = `${currentProjectMeta.code} — ${currentProjectMeta.name}`;

  // Helpers
  const renderRows = (rows, fieldName, max=8) => {
    if (!rows || !rows.length) return null;
    return rows.slice(0, max).map((r, i) => {
      const main = r.desc || r.target || r.issue || '-';
      const pct = r.progress != null && r.progress !== '' ? ` (${parseFloat(r.progress) > 1 ? Math.round(parseFloat(r.progress)) : Math.round(parseFloat(r.progress)*100)}%)` : '';
      return `  ${i+1}. ${main}${pct}`;
    }).join('\n');
  };
  const avgProgress = (rows) => {
    if (!rows || !rows.length) return null;
    const vals = rows.map(r => parseFloat(r.progress)).filter(v => !isNaN(v));
    if (!vals.length) return null;
    const avg = vals.reduce((a,b)=>a+b, 0) / vals.length;
    return avg > 1 ? avg : avg * 100;
  };
  const progressBar = (pct) => {
    if (pct == null) return '<em style="color:var(--text3)">— (ไม่มีข้อมูล)</em>';
    return `<span class="csum-bar"><span style="width:${Math.min(100,pct)}%"></span></span> ${pct.toFixed(0)}%`;
  };
  const noDataMsg = (which) =>
    `<em style="color:var(--text3);font-style:italic">ยังไม่มีข้อมูลรีพอร์ตสำหรับ${which} — กรุณาตรวจสอบว่ามีการบันทึกแล้วหรือยัง</em>`;

  let title = '', period_label = '', body = '';

  if (period === 'weekly') {
    title = '📅 สรุปงานสัปดาห์';
    const acts = d.wk?.act || [];
    const issues = d.wk?.issue || [];
    const next = d.wk?.next || [];
    const targets = d.wk?.targets || [];
    const avg = avgProgress(acts);
    const planPct = parseFloat(d.wkDraft?.wk_plan_pct);
    const actualPct = parseFloat(d.wkDraft?.wk_actual_pct);
    period_label = (d.wkDraft?.wk_from && d.wkDraft?.wk_to) ? `${d.wkDraft.wk_from} → ${d.wkDraft.wk_to}` : '(ยังไม่กำหนดช่วง)';
    if (!acts.length && !issues.length && !next.length && !targets.length) {
      body = noDataMsg('สัปดาห์นี้');
    } else {
      body = `<strong>• งานที่ดำเนินการ</strong> (${acts.length}):
${renderRows(acts) || noDataMsg('งานสัปดาห์นี้')}

<strong>• ความคืบหน้า</strong>: ${progressBar(avg)}
<strong>• แผน vs จริง</strong>: ${isNaN(planPct) ? '—' : planPct + '%'} / ${isNaN(actualPct) ? '—' : actualPct + '%'}
<strong>• ปัญหาที่พบ</strong> (${issues.length}):
${renderRows(issues) || '  (ไม่มี)'}

<strong>• แผนสัปดาห์หน้า</strong> (${next.length}):
${renderRows(next) || '  (ยังไม่มี)'}

<strong>• เป้าหมายสำคัญ</strong> (${targets.length}):
${renderRows(targets) || '  (ยังไม่มี)'}

<strong>• รูปประกอบ</strong>: ${d.wkPhotos.length} ภาพ
<strong>• ผู้รายงาน</strong>: ${d.wkDraft?.wk_reporter || '—'}  ·  <strong>Coded by</strong>: ${(d.wkDraft?.wk_codedby || '—').toUpperCase()}`;
    }

  } else if (period === 'monthly') {
    title = '📊 สรุปงานเดือน';
    const acts = d.mo?.act || [];
    const issues = d.mo?.issue || [];
    const avg = avgProgress(acts);
    period_label = (d.moDraft?.mo_period || d.moDraft?.mo_from || '(ยังไม่กำหนดช่วง)');
    if (!acts.length && !issues.length) {
      body = noDataMsg('เดือนนี้');
    } else {
      body = `<strong>• งานที่ดำเนินการ</strong> (${acts.length}):
${renderRows(acts) || '  (ไม่มี)'}

<strong>• ความคืบหน้าเฉลี่ย</strong>: ${progressBar(avg)}
<strong>• ปัญหาที่พบ</strong> (${issues.length}):
${renderRows(issues) || '  (ไม่มี)'}`;
    }

  } else if (period === 'daily') {
    title = '📋 รายวันล่าสุด';
    const daily = d.dailyDraft;
    if (!daily || (!daily.rpt_str && !daily.rpt_arch && !daily.rpt_mep && !daily.rpt_plan)) {
      period_label = '—';
      body = noDataMsg('วันนี้');
    } else {
      period_label = daily.rpt_date || '(ไม่ระบุวันที่)';
      // Combine work-done from STR + ARCH + MEP fields
      const workDone = [daily.rpt_str, daily.rpt_arch, daily.rpt_mep].filter(Boolean).join(' · ') || '-';
      body = `<strong>• งานที่ดำเนินการ</strong>:
  ${workDone}

<strong>• ผู้รายงาน / ทีม</strong>: ${daily.rpt_name || '-'}
<strong>• สภาพอากาศ</strong>: ${daily.rpt_weather || '-'}
<strong>• ปัญหาที่พบ</strong>: ${daily.rpt_issue || '(ไม่มี)'}
<strong>• แผนวันถัดไป</strong>: ${daily.rpt_plan || '(ยังไม่ระบุ)'}
<strong>• คนงาน</strong>: <em style="color:var(--text3)">ฟอร์ม Daily v4 ไม่มีฟิลด์ manpower โดยเฉพาะ — ระบุในช่อง "ผู้รายงาน/ทีม"</em>`;
    }

  } else { // overall
    title = '🏗 ภาพรวมโปรเจกต์';
    period_label = `${currentProjectMeta.status || 'active'}`;
    const wkAcc = d.wk?.act || [];
    const moAcc = d.mo?.act || [];
    const wkAvg = avgProgress(wkAcc);
    const moAvg = avgProgress(moAcc);
    const planPct = parseFloat(d.wkDraft?.wk_plan_pct);
    const actualPct = parseFloat(d.wkDraft?.wk_actual_pct);
    const voInfo = d.voDraft?.vo_no ? `VO-${d.voDraft.vo_no}` + (d.voDraft?.vo_date ? ` (${d.voDraft.vo_date})` : '') : '(ยังไม่มี)';
    body = `<strong>• สถานะ</strong>: ${currentProjectMeta.status || '—'}
<strong>• สถานที่</strong>: ${currentProjectMeta.location || '—'}
<strong>• ลูกค้า</strong>: ${currentProjectMeta.client || '—'}
<strong>• ช่วงโปรเจกต์</strong>: ${currentProjectMeta.start_date || '—'} → ${currentProjectMeta.end_date || '—'}

<strong>• ความคืบหน้า (Weekly)</strong>: ${progressBar(wkAvg)}
<strong>• ความคืบหน้า (Monthly)</strong>: ${progressBar(moAvg)}
<strong>• แผน vs จริง (สัปดาห์ล่าสุด)</strong>: ${isNaN(planPct) ? '—' : planPct + '%'} / ${isNaN(actualPct) ? '—' : actualPct + '%'}

<strong>• Weekly Report</strong>: งาน ${wkAcc.length} · ปัญหา ${(d.wk?.issue||[]).length} · แผนหน้า ${(d.wk?.next||[]).length} · รูป ${d.wkPhotos.length}
<strong>• Monthly Report</strong>: งาน ${moAcc.length} · ปัญหา ${(d.mo?.issue||[]).length}
<strong>• BOQ</strong>: ${d.boq.length} รายการ
<strong>• VO/เพิ่มงาน (ล่าสุด)</strong>: ${voInfo}`;
  }

  return `<div class="chat-summary">
    <div class="csum-title">${title} — ${projectLabel}</div>
    <div style="color:var(--text2);font-size:11px;margin-bottom:6px">ช่วง: ${period_label}</div>
${body}</div>`;
}
