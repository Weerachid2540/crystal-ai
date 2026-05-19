'use strict';
// ============================================================
// Crystal AI — signatures.js  (Phase-4I extraction)
// Signature Pad — canvas drawing with mouse / touch / stylus
// Stored as PNG dataURL in localStorage; restored on init.
// Depends on: (none — vanilla DOM + localStorage only)
// Runtime deps resolved at call time:
//   clearForm (inline) calls clearSignatureGroup()
//   collectWeeklyData (inline) calls _sigStorageKey()
//   export logic (inline) reads canvas.toDataURL()
//   init() calls setupAllSignaturePads()
// ============================================================

const SIGNATURE_IDS = ['sigDailyApprover', 'sigWkApprover', 'sigMoApprover', 'sigSalaryEmployee'];

function _sigStorageKey(id) { return 'crystal_sig_' + id; }

function initSignaturePad(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const wrap = canvas.parentElement;
  let cssWidth = 0, cssHeight = 0;     // last applied CSS size
  let initialized = false;

  // Re-size canvas backing store to match its rendered CSS size.
  // KEY FIX: when canvas is in a hidden tab on init, getBoundingClientRect()
  // returns 0×0. ResizeObserver fires when it later becomes visible, so we
  // re-run sizing then. Existing pixels are preserved across resizes.
  const setSize = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return; // not visible yet
    const dpr = window.devicePixelRatio || 1;
    const newW = Math.round(rect.width * dpr);
    const newH = Math.round(rect.height * dpr);
    if (canvas.width === newW && canvas.height === newH) return;
    let snapshot = null;
    if (canvas.width > 0 && canvas.height > 0) {
      try { snapshot = canvas.toDataURL('image/png'); } catch (e) {}
    }
    canvas.width = newW;
    canvas.height = newH;
    cssWidth = rect.width;
    cssHeight = rect.height;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0d1b3d';
    if (snapshot) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
      img.src = snapshot;
    } else if (!initialized) {
      // First time becoming visible — restore from localStorage
      const saved = localStorage.getItem(_sigStorageKey(canvasId));
      if (saved) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, cssWidth, cssHeight);
          wrap.classList.add('has-ink');
        };
        img.src = saved;
      }
    }
    initialized = true;
  };
  setSize();

  if (window.ResizeObserver) {
    new ResizeObserver(setSize).observe(canvas);
  }
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(setSize, 200); });

  let drawing = false;
  let lastX = 0, lastY = 0;

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches && e.touches[0];
    const cx = t ? t.clientX : e.clientX;
    const cy = t ? t.clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
  };

  const start = (e) => {
    e.preventDefault();
    setSize(); // ensure canvas dimensions are correct before drawing
    if (canvas.width === 0) return;
    drawing = true;
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    wrap.classList.add('has-ink');
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0d1b3d';
    ctx.fill();
  };

  const move = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  };

  const end = () => {
    if (!drawing) return;
    drawing = false;
    saveSignature(canvasId);
  };

  // Pointer events (covers mouse, touch, stylus on modern browsers)
  if (window.PointerEvent) {
    canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture(e.pointerId); start(e); });
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', end);
  } else {
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', end);
    canvas.addEventListener('touchcancel', end);
  }

  // Name input persistence
  const nameInput = document.getElementById(canvasId + '_name');
  if (nameInput) {
    const savedName = localStorage.getItem(_sigStorageKey(canvasId) + '_name');
    if (savedName) nameInput.value = savedName;
    nameInput.addEventListener('input', () => {
      localStorage.setItem(_sigStorageKey(canvasId) + '_name', nameInput.value);
    });
  }
}

function saveSignature(canvasId) {
  try {
    const canvas = document.getElementById(canvasId);
    if (!canvas || canvas.width === 0) return;
    const dataUrl = canvas.toDataURL('image/png');
    localStorage.setItem(_sigStorageKey(canvasId), dataUrl);
  } catch (e) {}
}

function clearSignature(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  canvas.parentElement.classList.remove('has-ink');
  localStorage.removeItem(_sigStorageKey(canvasId));
}

function clearSignatureGroup(prefixes) {
  prefixes.forEach(id => {
    clearSignature(id);
    const nameInput = document.getElementById(id + '_name');
    if (nameInput) nameInput.value = '';
    localStorage.removeItem(_sigStorageKey(id) + '_name');
  });
}

function setupAllSignaturePads() {
  SIGNATURE_IDS.forEach(initSignaturePad);
}
