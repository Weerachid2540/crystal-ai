'use strict';
// ============================================================
// Crystal AI — utils.js  (Phase-4C extraction)
// Core utility functions — zero external dependencies.
// Loaded first via <script src="js/utils.js"> in index.html.
// All declarations are in global scope (non-module script).
// ============================================================

// FIXED #1: ป้องกัน crash จาก localStorage corrupt
function safeJsonParse(str, fallback) {
  if (str === null || str === undefined || str === '') return fallback;
  try {
    const v = JSON.parse(str);
    return v === null ? fallback : v;
  } catch (e) {
    console.warn('[Crystal] safeJsonParse failed:', e.message);
    return fallback;
  }
}

// Phase-1B: Deep clone helper — ป้องกัน crash ถ้า object มีค่าแปลก
function deepClone(obj) {
  try { return JSON.parse(JSON.stringify(obj)); } catch (e) {
    console.warn('[Crystal] deepClone failed, returning original:', e.message);
    return obj;
  }
}

// Phase-1B: Safe DOM helpers — ป้องกัน null access
function getEl(id) { return document.getElementById(id); }
function getValue(id, fallback = '') {
  const el = document.getElementById(id);
  return el ? el.value : fallback;
}
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// Phase-1D: Form helpers — ลด getElementById().value pattern ซ้ำ
function fillFormMap(map) {
  Object.entries(map).forEach(([id, v]) => setValue(id, v));
}
function clearFormFields(ids) {
  ids.forEach(id => setValue(id, ''));
}

// Phase-1C: Centralized modal helpers — ลด .classList.add/remove('show') ซ้ำ
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[Crystal] openModal: not found —', id); return; }
  el.classList.add('show');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[Crystal] closeModal: not found —', id); return; }
  el.classList.remove('show');
}
function toggleModal(id, show) {
  const el = document.getElementById(id);
  if (!el) { console.warn('[Crystal] toggleModal: not found —', id); return; }
  el.classList.toggle('show', show);
}

// FIXED #2: คืนวันที่แบบ local timezone — ไม่ใช้ toISOString() ที่เป็น UTC
// FIXED v5.1: accept Date/string/number inputs without falling back to today — BUG-6
function localDate(date) {
  const d = date == null ? new Date() : new Date(date);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// FIXED v5.1: local date-time helper for draft metadata — BUG-6 / FEAT-1
function localDateTime(date) {
  const d = date == null ? new Date() : new Date(date);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${localDate(d)} ${hh}:${mm}`;
}

// XSS-safe HTML escape
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// §6 helper — shorthand for trimmed input value
function val(id) { return document.getElementById(id)?.value.trim() || ''; }

// FIXED #23: detect "prepayment credits depleted" + better error categorization
// Runtime deps: tr() from i18n (inline script), escapeHtml() from this file
function friendlyError(err) {
  const msg = err.message || String(err);
  if (msg === 'NO_API_KEY') return escapeHtml(tr('no_key'));
  if (msg === 'REQUEST_BUSY') return escapeHtml(tr('busy'));
  if (msg === 'TIMEOUT') return '⏱ Request timeout — กรุณาลองใหม่';
  if (msg.startsWith('AUTH_FAILED')) return '🔐 API Key ไม่ถูกต้อง — ' + escapeHtml(msg.replace('AUTH_FAILED: ', ''));
  if (msg.startsWith('PAYMENT_REQUIRED') || /prepayment.*deplet|insufficient.*credit|insufficient.*balance/i.test(msg)) {
    const detail = msg.replace(/^PAYMENT_REQUIRED:\s*/, '').replace(/^RATE_LIMIT:\s*/, '');
    return `💳 <strong>เครดิตหมด / ต้องเติมเงิน</strong><br><br>` +
           `<code style="font-size:11px;display:block;background:rgba(0,0,0,0.3);padding:8px;border-radius:5px;white-space:pre-wrap">${escapeHtml(detail)}</code><br>` +
           `<strong>วิธีแก้:</strong><br>` +
           `1. <strong>เปลี่ยนไปใช้ Groq</strong> (ฟรีจริง) — กด ⚙ → Provider → Groq<br>` +
           `2. หรือใช้ <strong>Google account อื่น</strong> สร้าง API Key ใหม่<br>` +
           `3. หรือเติมเงินที่ <a href="https://ai.studio/projects" target="_blank" style="color:var(--accent)">ai.studio/projects</a>`;
  }
  if (msg.startsWith('RATE_LIMIT')) {
    const detail = msg.replace('RATE_LIMIT: ', '');
    const isZeroLimit = /limit:\s*0/i.test(detail);
    let advice;
    if (isZeroLimit) {
      advice = `<strong>⚠️ บัญชี Google ของคุณไม่มี Free Tier เปิดใช้</strong> (limit: 0)<br><br>` +
               `<strong>วิธีแก้:</strong><br>` +
               `1. <strong>เปลี่ยนไปใช้ Groq</strong> (ฟรีจริง) — กด ⚙ → Provider → Groq<br>` +
               `2. หรือสร้าง API Key ใน Project ใหม่ที่ <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:var(--accent)">aistudio.google.com</a> (เลือก "Create API key in new project")<br>` +
               `3. หรือ Enable <strong>Generative Language API</strong> ใน <a href="https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com" target="_blank" style="color:var(--accent)">Cloud Console</a>`;
    } else {
      advice = `<strong>วิธีแก้:</strong><br>` +
               `1. กด ⚙ → เปลี่ยน Model เป็น <code>gemini-2.0-flash</code><br>` +
               `2. รอ 1 นาที แล้วลองใหม่<br>` +
               `3. ถ้ายังไม่ได้ = quota รายวันหมด → รอบ่าย 2-3 โมง (รีเซ็ตเที่ยงคืน Pacific)<br>` +
               `4. หรือเปลี่ยนไปใช้ <strong>Groq</strong> (ฟรี และเร็ว)`;
    }
    return `⚠️ <strong>Rate Limit / Quota Error</strong><br><br>` +
           `<code style="font-size:11px;display:block;background:rgba(0,0,0,0.3);padding:8px;border-radius:5px;white-space:pre-wrap">${escapeHtml(detail)}</code><br>` +
           advice;
  }
  if (msg === 'EMPTY_RESPONSE') return '❌ AI ไม่ตอบกลับ — กรุณาลองใหม่';
  if (msg.startsWith('API_ERROR')) return '❌ ' + escapeHtml(msg.replace('API_ERROR: ', ''));
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return '🌐 เชื่อมต่อ Internet ไม่ได้';
  return '❌ ' + escapeHtml(msg);
}

// §12.5 helper — gate modules to project context
// Runtime deps: currentView, currentProjectId, goView() from inline script; toast() from toast.js
// FIXED regression: also close tool modal before redirecting so user isn't left
// with an open modal whose panel context is stale.
function requireProjectContext(moduleName) {
  if (currentView !== 'project' || !currentProjectId) {
    toast((moduleName || 'This module') + ' ต้องเปิดจากภายในโปรเจกต์เท่านั้น', 'error');
    try { if (typeof closeToolModal === 'function') closeToolModal(); } catch (e) {}
    goView('dashboard');
    return false;
  }
  return true;
}

// ============================================================
// [§ Global Error Boundary — Phase-4Q-3: extracted from inline script]
// FIXED v5.1: Global error boundary — FEAT-2
// Deps: toast() (toast.js) — all calls wrapped in try/catch (safe at parse time)
// NOTE: safeApiCall() removed — confirmed 0 callers (Phase-4Q-1 audit)
// ============================================================
window.onerror = function(msg, src, line, col, err) {
  console.error('[Crystal AI Error]', msg, err);
  if (typeof msg === 'string' && msg.includes('ResizeObserver')) return false;
  try { toast('❌ เกิดข้อผิดพลาด: ' + String(msg).slice(0, 80), 'error'); } catch (e) {}
  return false;
};
window.onunhandledrejection = function(event) {
  const msg = (event && event.reason && event.reason.message) || String(event && event.reason);
  console.error('[Crystal AI Promise Error]', msg);
  try {
    if (/Failed to fetch|NetworkError/i.test(msg)) {
      toast('🌐 เน็ตหลุด กรุณาตรวจสอบการเชื่อมต่อ', 'error');
    } else if (/401|Invalid API key/i.test(msg)) {
      toast('🔑 API Key ไม่ถูกต้อง ตรวจสอบใน Settings', 'error');
    } else if (/429|Rate limit/i.test(msg)) {
      toast('⏱️ ส่งคำขอถี่เกินไป กรุณารอสักครู่', 'error');
    } else {
      toast('❌ ' + String(msg).slice(0, 100), 'error');
    }
  } catch (e) {}
};
