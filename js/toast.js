'use strict';
// ============================================================
// Crystal AI — toast.js  (Phase-4C extraction)
// Toast notification queue — FIXED #20
// Depends on: DOM only (toastContainer element in index.html)
// ============================================================

const MAX_TOASTS = 3;
const TOAST_DURATION = 3000;
let activeToasts = [];

function toast(message, type) {
  const messageStr = String(message);
  // Dedupe: ถ้ามีข้อความเดียวกันอยู่แล้ว ข้ามไป
  if (activeToasts.find(x => x.message === messageStr)) return;
  // Limit: ถ้าเกิน MAX → ลบเก่าสุด
  while (activeToasts.length >= MAX_TOASTS) {
    const oldest = activeToasts.shift();
    if (oldest.el && oldest.el.parentNode) oldest.el.parentNode.removeChild(oldest.el);
    if (oldest.timer1) clearTimeout(oldest.timer1);
    if (oldest.timer2) clearTimeout(oldest.timer2);
  }
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  // Toast supports basic HTML for rich error messages from friendlyError
  el.innerHTML = messageStr;
  c.appendChild(el);
  const entry = { message: messageStr, el };
  activeToasts.push(entry);
  entry.timer1 = setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s';
  }, TOAST_DURATION);
  entry.timer2 = setTimeout(() => {
    if (el.parentNode) el.remove();
    activeToasts = activeToasts.filter(x => x !== entry);
  }, TOAST_DURATION + 400);
}
