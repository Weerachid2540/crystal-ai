'use strict';
// ============================================================
// Crystal AI - dashboard.js  (Phase-4N-2 extraction)
// View Router + Dashboard Chat + App-State UI helpers
// Depends on: utils.js (openModal/closeModal — indirect via inline),
//             toast.js (toast),
//             i18n.js (currentLang),
//             markdown.js (renderMarkdown),
//             api.js (callAPI, MAX_HISTORY, settings),
//             chat.js (autoResize),
//             utils.js (friendlyError)
// Runtime deps (resolved at call time, all globals from inline):
//   currentUser, currentView, currentProjectId, currentProjectMeta, allProjects
//   syncAppState (inline) - called by setView
//   loadProjects, loadUsers (inline Auth/Projects) - called by goView
//   renderDashboardWelcome (this module) - called by goView
// Cross-module callers:
//   chat.js -> setView('project') on auto project-switch
//   i18n.js applyLang() -> renderDashQuickBtns() on language change
//   sidebar.js switchTab() -> updateProjectContextUI() after tab switch
// ============================================================

function updateProjectContextUI() {
  const p = currentProjectMeta;
  const projectText = p ? `${p.code || p.id} — ${p.name || ''}` : 'No project selected';
  const scopeBadge = document.getElementById('projectScopeBadge');
  if (scopeBadge) scopeBadge.textContent = p ? `project_id: ${currentProjectId}` : 'project_id: —';
  const desc = document.getElementById('projectOverviewDesc');
  if (desc) desc.textContent = p
    ? `${p.name || ''}${p.client ? ' · ' + p.client : ''}${p.location ? ' · ' + p.location : ''}`
    : 'เลือก module จาก sidebar เพื่อเริ่มงานในโปรเจกต์นี้';
  const aiCtx = document.getElementById('projectAiContext');
  if (aiCtx) aiCtx.textContent = 'AI Assistant · ' + projectText;
  document.querySelectorAll('.project-badge').forEach(badge => {
    const label = badge.querySelector('.proj-label');
    const name = badge.querySelector('.proj-name');
    if (!label || !name) return;
    label.textContent = p ? (p.code || 'PROJECT') : 'COMPANY';
    name.textContent = p ? (p.name || 'Untitled project') : 'Crystal Engineering Corp.';
  });
}

// ---- View router ----
function setView(view) {
  if (view === 'structtool' && !currentProjectId) {
    view = 'dashboard';
  }
  currentView = view;
  syncAppState(view);
  document.body.setAttribute('data-view', view);
  // crumb visibility
  const sep = document.getElementById('crumbSep');
  const cur = document.getElementById('crumbCurrent');
  if (view === 'project' && currentProjectMeta) {
    sep.style.display = '';
    cur.style.display = '';
    cur.textContent = '📁 ' + currentProjectMeta.code + ' — ' + currentProjectMeta.name;
  } else if (view === 'personal') {
    sep.style.display = '';
    cur.style.display = '';
    cur.textContent = '👤 ส่วนตัว';
  } else if (view === 'users') {
    sep.style.display = '';
    cur.style.display = '';
    cur.textContent = '👥 จัดการผู้ใช้';
  } else if (view === 'structtool') {
    sep.style.display = '';
    cur.style.display = '';
    cur.textContent = '🏗 Structural Analysis';
  } else {
    sep.style.display = 'none';
    cur.style.display = 'none';
  }
  // dashboard crumb active state
  document.getElementById('crumbDashboard').classList.toggle('active', view === 'dashboard');
  const salaryCrumb = document.getElementById('crumbSalary');
  if (salaryCrumb) salaryCrumb.classList.toggle('active', view === 'personal');
  updateProjectContextUI();
}

async function goView(view) {
  if (view === 'dashboard') {
    currentProjectId = null; currentProjectMeta = null;
    setView('dashboard'); await loadProjects(); renderDashboardWelcome(); return;
  }
  if (view === 'users') { setView('users'); await loadUsers(); return; }
  // v6: project / personal / structtool views removed → use dashboard
  return goView('dashboard');
}

// ============================================================
// v6: Dashboard chat (Crystal AI Assistant), project tools, Project Modal, Struct AI
// ============================================================
const DASH_QUICK_PROMPTS = [
  { th: '📊 สรุปโครงการ', en: '📊 Summarize project', prompt: 'สรุปสถานะโครงการปัจจุบันทั้งหมด' },
  { th: '📝 ช่วยเขียน Report', en: '📝 Help write report', prompt: 'ช่วยเขียนรายงานประจำสัปดาห์' },
  { th: '🏗 วิเคราะห์ผล', en: '🏗 Analyze structure', prompt: 'อธิบายผลการวิเคราะห์โครงสร้าง' },
  { th: '💰 คำนวณ BOQ', en: '💰 Calculate BOQ', prompt: 'ช่วยตรวจสอบปริมาณงานใน BOQ' },
];
let dashChatHistory = [];

function renderDashQuickBtns() {
  const wrap = document.getElementById('dashQuickBtns');
  if (!wrap) return;
  wrap.innerHTML = '';
  DASH_QUICK_PROMPTS.forEach(q => {
    const b = document.createElement('button');
    b.className = 'qbtn';
    b.textContent = currentLang === 'en' ? q.en : q.th;
    b.onclick = () => {
      const inp = document.getElementById('dashChatInput');
      inp.value = q.prompt; sendDashChat();
    };
    wrap.appendChild(b);
  });
}
function renderDashboardWelcome() {
  const wrap = document.getElementById('dashChatMessages');
  if (!wrap || wrap.dataset.welcomed) return;
  wrap.dataset.welcomed = '1';
  appendDashMsg('ai', currentLang === 'en'
    ? 'Hi! I am Crystal AI. Ask me anything about your projects, reports, or structures.'
    : 'สวัสดีครับ ผม Crystal AI พร้อมช่วยเรื่องโปรเจกต์ รายงาน BOQ หรือคำนวณโครงสร้าง');
  renderDashQuickBtns();
  // model tag
  try {
    const tag = document.getElementById('dashAiModelTag');
    if (tag && typeof settings !== 'undefined') tag.textContent = settings.provider || 'groq';
  } catch (e) {}
}
function appendDashMsg(role, text, isRawHtml) {
  const wrap = document.getElementById('dashChatMessages');
  if (!wrap) return;
  const time = new Date().toLocaleTimeString(currentLang === 'en' ? 'en-US' : 'th-TH', { hour: '2-digit', minute: '2-digit' });
  const html = isRawHtml ? text : renderMarkdown(text);
  const name = role === 'user' ? (currentLang === 'en' ? 'You' : 'คุณ') : 'Crystal AI';
  const avatar = role === 'user' ? '👷' : '✨';
  const d = document.createElement('div');
  d.className = 'msg ' + (role === 'user' ? 'user' : 'ai');
  d.innerHTML = `<div class="msg-avatar">${avatar}</div>
    <div class="msg-body"><div class="msg-meta"><span class="msg-name">${name}</span><span class="msg-time">${time}</span></div>
    <div class="msg-bubble">${html}</div></div>`;
  wrap.appendChild(d);
  wrap.scrollTop = wrap.scrollHeight;
}
function clearDashChat() {
  dashChatHistory = [];
  const wrap = document.getElementById('dashChatMessages');
  if (wrap) { wrap.innerHTML = ''; delete wrap.dataset.welcomed; }
  renderDashboardWelcome();
}
async function sendDashChat() {
  const inp = document.getElementById('dashChatInput');
  if (!inp) return;
  const msg = inp.value.trim();
  if (!msg) return;
  inp.value = ''; autoResize(inp);
  appendDashMsg('user', msg);
  dashChatHistory.push({ role: 'user', content: msg });
  const btn = document.getElementById('dashSendBtn');
  if (btn) btn.disabled = true;
  const loading = document.createElement('div');
  loading.className = 'msg ai';
  loading.innerHTML = `<div class="msg-avatar">✨</div><div class="msg-body"><div class="msg-bubble"><div class="dot-loader"><span></span><span></span><span></span></div></div></div>`;
  document.getElementById('dashChatMessages').appendChild(loading);
  try {
    const reply = await callAPI(dashChatHistory.slice(-MAX_HISTORY));
    loading.remove();
    appendDashMsg('ai', reply);
    dashChatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    loading.remove();
    // FIXED: friendlyError() returns HTML — render as raw HTML (isRawHtml=true),
    // not markdown (which escapes the tags into visible text).
    appendDashMsg('ai', '❌ ' + friendlyError(err), true);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Wire dashboard chat send on Enter
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && document.activeElement && document.activeElement.id === 'dashChatInput') {
    e.preventDefault(); sendDashChat();
  }
});

