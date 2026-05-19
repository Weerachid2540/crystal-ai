'use strict';
// ============================================================
// Crystal AI — photos.js  (Phase-4G extraction)
// Daily Report Photo Attachments + Weekly Report Photos
// Depends on: utils.js (safeJsonParse, escapeHtml),
//             toast.js (toast),
//             i18n.js (currentLang)
// Runtime deps (resolved at call time, all in inline script):
//   openPhotoPreview() — declared in this file (self-reference OK)
//   renderDailyPhotoGrid() — declared in this file
//   renderWkPhotoGrid() — declared in this file
// sidebar.js runtime dep:
//   closePhotoPreview() — declared here, called from sidebar.js ESC handler
// ============================================================

// ============================================================
// DAILY REPORT PHOTO ATTACHMENTS (up to 20 images)
// ============================================================
const MAX_DAILY_IMAGES = 20;
const PHOTO_MAX_DIM = 1280;       // resize longest side to 1280px
const PHOTO_JPEG_QUALITY = 0.85;
const DAILY_PHOTO_KEY = 'crystal_daily_photos';
let dailyImages = [];             // [{ id, dataUrl, name }]
let dailyPhotoIdCounter = 0;

function compressImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Not an image'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Read failed'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Decode failed'));
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        const maxDim = Math.max(w, h);
        if (maxDim > PHOTO_MAX_DIM) {
          const scale = PHOTO_MAX_DIM / maxDim;
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', PHOTO_JPEG_QUALITY));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function handleDailyPhotoUpload(input) {
  const files = Array.from(input.files || []);
  input.value = ''; // reset so same file can re-upload after delete
  if (!files.length) return;
  const available = MAX_DAILY_IMAGES - dailyImages.length;
  if (available <= 0) {
    toast(currentLang === 'en' ? `Max ${MAX_DAILY_IMAGES} photos reached` : `แนบรูปได้สูงสุด ${MAX_DAILY_IMAGES} รูป`, 'error');
    return;
  }
  const toProcess = files.slice(0, available);
  if (files.length > available) {
    toast(currentLang === 'en' ? `Only ${available} more allowed — extra skipped` : `เหลือพื้นที่อีก ${available} รูป รูปเกินถูกข้าม`, 'warning');
  }
  let added = 0;
  for (const file of toProcess) {
    try {
      const dataUrl = await compressImageFile(file);
      dailyImages.push({ id: ++dailyPhotoIdCounter, dataUrl, name: file.name });
      added++;
    } catch (e) {
      toast(currentLang === 'en' ? `Failed: ${file.name}` : `อ่านไฟล์ไม่ได้: ${file.name}`, 'error');
    }
  }
  renderDailyPhotoGrid();
  if (added > 0) {
    saveDailyPhotos();
    toast(currentLang === 'en' ? `✓ Added ${added} photo(s)` : `✓ แนบ ${added} รูปแล้ว`, 'success');
  }
}

function removeDailyPhoto(id) {
  dailyImages = dailyImages.filter(p => p.id !== id);
  renderDailyPhotoGrid();
  saveDailyPhotos();
}

function renderDailyPhotoGrid() {
  const grid = document.getElementById('dailyPhotoGrid');
  const counter = document.getElementById('dailyPhotoCounter');
  const uploader = document.getElementById('dailyPhotoUploader');
  if (!grid) return;
  grid.innerHTML = '';
  dailyImages.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'photo-thumb';
    div.onclick = () => openPhotoPreview(p.dataUrl);
    div.innerHTML = `
      <img src="${p.dataUrl}" alt="${escapeHtml(p.name)}" loading="lazy">
      <span class="photo-thumb-num">#${i + 1}</span>
      <button class="photo-thumb-del" aria-label="Remove">×</button>
    `;
    div.querySelector('.photo-thumb-del').onclick = (e) => {
      e.stopPropagation();
      removeDailyPhoto(p.id);
    };
    grid.appendChild(div);
  });
  if (counter) {
    counter.textContent = `${dailyImages.length}/${MAX_DAILY_IMAGES}`;
    counter.classList.toggle('full', dailyImages.length >= MAX_DAILY_IMAGES);
  }
  if (uploader) {
    uploader.classList.toggle('disabled', dailyImages.length >= MAX_DAILY_IMAGES);
  }
}

function openPhotoPreview(dataUrl) {
  const modal = document.getElementById('photoModal');
  const img = document.getElementById('photoModalImg');
  if (!modal || !img) return;
  img.src = dataUrl;
  modal.classList.add('show');
}

function closePhotoPreview() {
  const modal = document.getElementById('photoModal');
  if (modal) modal.classList.remove('show');
}

function clearDailyPhotos() {
  dailyImages = [];
  dailyPhotoIdCounter = 0;
  renderDailyPhotoGrid();
  try { localStorage.removeItem(DAILY_PHOTO_KEY); } catch(e) {}
}

// Phase-3B: clears in-memory state ONLY — does NOT touch localStorage.
// Use in project-open flows instead of clearDailyPhotos() to avoid deleting photos.
function _resetDailyPhotosMemory() {
  dailyImages = [];
  dailyPhotoIdCounter = 0;
  renderDailyPhotoGrid();
}

function saveDailyPhotos() {
  try {
    localStorage.setItem(DAILY_PHOTO_KEY, JSON.stringify(dailyImages));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      toast(currentLang === 'en' ? '⚠️ Storage full — delete some photos' : '⚠️ พื้นที่เก็บรูปเต็ม — ลบรูปบางส่วนเพื่อประหยัดพื้นที่', 'warning');
    }
  }
}

function loadDailyPhotos() {
  const saved = safeJsonParse(localStorage.getItem(DAILY_PHOTO_KEY), []);
  if (!Array.isArray(saved) || !saved.length) return;
  dailyImages = saved.filter(p => p && p.id && p.dataUrl);
  dailyPhotoIdCounter = dailyImages.reduce((m, p) => Math.max(m, p.id), 0);
  renderDailyPhotoGrid();
}

function setupDailyPhotoDragDrop() {
  const zone = document.getElementById('dailyPhotoUploader');
  if (!zone || zone.__dragInitialized) return;
  zone.__dragInitialized = true;
  ['dragenter', 'dragover'].forEach(ev => {
    zone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
  });
  ['dragleave', 'drop'].forEach(ev => {
    zone.addEventListener(ev, (e) => { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); });
  });
  zone.addEventListener('drop', (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (!files || !files.length) return;
    const fakeInput = { files, value: '' };
    handleDailyPhotoUpload(fakeInput);
  });
}

// ============================================================
// WEEKLY REPORT PHOTOS
// Photo state (project-scoped via localStorage proxy)
// ============================================================
let wkPhotos = [];                 // [{ id, dataUrl, activities, workDesc, gridline, remark }]
let wkPhotoIdCtr = 0;
const WK_PHOTO_KEY = 'crystal_wk_photos';

function compressImageForWeekly(file) {
  // Reuse the same compress helper as daily but with tighter dims (~800px) to fit more photos
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const max = 900;
        let w = img.width, h = img.height;
        if (Math.max(w, h) > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function addWkPhotos(fileList) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
  for (const f of files) {
    try {
      const dataUrl = await compressImageForWeekly(f);
      wkPhotos.push({
        id: ++wkPhotoIdCtr,
        dataUrl,
        // FIXED v5.1: Weekly photo table includes Detailed Activities column — FEAT-6
        activities: 'ภาพถ่ายบริเวณโดยรอบ',
        workDesc: 'ภาพถ่ายบริเวณโดยรอบ',
        gridline: '-',
        remark: '-'
      });
    } catch (e) { console.error('photo failed', e); }
  }
  saveWkPhotos();
  renderWkPhotoGrid();
}

function removeWkPhoto(id) {
  wkPhotos = wkPhotos.filter(p => p.id !== id);
  saveWkPhotos();
  renderWkPhotoGrid();
}

function updateWkPhoto(id, field, value) {
  const p = wkPhotos.find(x => x.id === id);
  if (p) { p[field] = value; saveWkPhotos(); }
}

function saveWkPhotos() {
  try { localStorage.setItem(WK_PHOTO_KEY, JSON.stringify(wkPhotos)); } catch (e) {
    toast('บันทึกรูปไม่สำเร็จ — อาจเต็ม storage', 'error');
  }
}

function loadWkPhotos() {
  const d = safeJsonParse(localStorage.getItem(WK_PHOTO_KEY), []);
  wkPhotos = Array.isArray(d) ? d : [];
  // FIXED v5.1: migrate older weekly photos into new Detailed Activities column — FEAT-6
  wkPhotos.forEach(p => {
    if (p && p.activities == null) p.activities = p.workDesc || '';
  });
  wkPhotoIdCtr = wkPhotos.reduce((m, p) => Math.max(m, p.id || 0), 0);
  renderWkPhotoGrid();
}

function renderWkPhotoGrid() {
  const grid = document.getElementById('wkPhotoGrid');
  if (!grid) return;
  if (!wkPhotos.length) { grid.innerHTML = ''; return; }
  const reportNo = (document.getElementById('wk_no')?.value || 'W').replace(/[^A-Z0-9-]/ig, '');
  grid.innerHTML = wkPhotos.map((p, idx) => {
    const photoNo = (reportNo || 'W') + '-' + (idx + 1);
    return `
      <div class="wk-photo-card">
        <img class="wk-thumb" src="${p.dataUrl}" onclick="openPhotoPreview('${p.dataUrl}')" alt="${escapeHtml(photoNo)}">
        <div class="wk-fields">
          <div class="wk-label">${escapeHtml(photoNo)} · Detailed Activities</div>
          <input type="text" value="${escapeHtml(p.activities || '')}"
                 oninput="updateWkPhoto(${p.id}, 'activities', this.value)">
          <div class="wk-label">${escapeHtml(photoNo)} · Work Description</div>
          <input type="text" value="${escapeHtml(p.workDesc || '')}"
                 oninput="updateWkPhoto(${p.id}, 'workDesc', this.value)">
          <div class="wk-label">Gridline</div>
          <input type="text" value="${escapeHtml(p.gridline || '')}"
                 oninput="updateWkPhoto(${p.id}, 'gridline', this.value)">
          <div class="wk-label">Remark</div>
          <input type="text" value="${escapeHtml(p.remark || '')}"
                 oninput="updateWkPhoto(${p.id}, 'remark', this.value)">
        </div>
        <div class="wk-actions">
          <span class="wk-photo-no">${escapeHtml(photoNo)}</span>
          <button class="wk-rm" onclick="removeWkPhoto(${p.id})">ลบ</button>
        </div>
      </div>`;
  }).join('');
}

function setupWeeklyPhotoDragDrop() {
  const up = document.getElementById('wkPhotoUploader');
  if (!up || up.__dragInitialized) return;
  up.__dragInitialized = true;
  ['dragenter','dragover'].forEach(e => up.addEventListener(e, ev => { ev.preventDefault(); up.style.borderColor = 'var(--accent)'; }));
  ['dragleave','drop'].forEach(e => up.addEventListener(e, ev => { ev.preventDefault(); up.style.borderColor = ''; }));
  up.addEventListener('drop', ev => { addWkPhotos(ev.dataTransfer.files); });
}

// Re-render photo grid when report-no changes (photo labels reflect it)
function _wkBindReportNoLabelUpdate() {
  const el = document.getElementById('wk_no');
  if (el && !el.__bound) {
    el.__bound = true;
    el.addEventListener('input', renderWkPhotoGrid);
  }
}
