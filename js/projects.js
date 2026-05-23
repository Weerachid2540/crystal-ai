'use strict';
// ============================================================
// js/projects.js — Phase-4P-2
// Projects CRUD + Project Detail Modal
// Extracted verbatim from inline script.
// Loads after js/auth.js, before inline <script>.
// Dead code removed: openProjectModal() v1, closeProjectModal() v1,
//   _origCloseProjectModal (all were overridden by hoisting — never executed).
// ============================================================

// ---- PROJECTS ----
async function loadProjects() {
  const grid = document.getElementById('projectGrid');
  // Keep the add-card; clear others
  grid.innerHTML = '<div class="add-project-card" onclick="openProjectModal()"><div class="plus">+</div><div>เพิ่มโปรเจกต์ใหม่</div></div>';
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (error) { toast('โหลดโปรเจกต์ไม่สำเร็จ: ' + error.message, 'error'); return; }
  allProjects = data || [];
  populateStructProjectPicker();   // Phase-2B-3: refresh project dropdown in save bar
  data.forEach(p => {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.onclick = () => openProject(p.id);
    const statusLabel = ({active:'กำลังดำเนินการ', completed:'เสร็จสิ้น', on_hold:'หยุดชั่วคราว', cancelled:'ยกเลิก'})[p.status] || p.status;
    const progress = calcProjectProgress(p);
    card.innerHTML = `
      <div class="pcard-actions" onclick="event.stopPropagation()">
        <button title="แก้ไข" onclick="editProject('${p.id}')">✏</button>
        <button title="ลบ" onclick="deleteProject('${p.id}')">🗑</button>
      </div>
      <div class="code">${escapeHtml(p.code)}</div>
      <div class="pname">${escapeHtml(p.name)}</div>
      <div class="meta">${p.location ? '📍 ' + escapeHtml(p.location) : ''}${p.client ? ' · ' + escapeHtml(p.client) : ''}</div>
      <span class="status-pill ${p.status}">${statusLabel}</span>
      <div class="project-progress-meta"><span>${progress.label}</span><strong>${progress.percent}%</strong></div>
      <div class="project-progress-bar"><div class="project-progress-fill ${progress.tone}" style="width:${progress.percent}%"></div></div>
      <div class="project-task-count">${progress.done} / ${progress.total} tasks</div>
    `;
    grid.appendChild(card);
  });
}

function calcProjectProgress(p) {
  const done = Number(p.tasks_done ?? p.done_tasks ?? p.completed_tasks ?? p.completed_count ?? 0) || 0;
  const total = Number(p.tasks_total ?? p.total_tasks ?? p.task_count ?? p.total_count ?? 0) || 0;
  let percent = Number(p.progress ?? p.progress_percent ?? p.percent_complete);
  if (!Number.isFinite(percent)) {
    if (total > 0) percent = Math.round((done / total) * 100);
    else if (p.status === 'completed') percent = 100;
    else if (p.status === 'cancelled') percent = 0;
    else if (p.start_date && p.end_date) {
      const start = new Date(p.start_date).getTime();
      const end = new Date(p.end_date).getTime();
      const now = Date.now();
      percent = end > start ? Math.round(((now - start) / (end - start)) * 100) : 0;
    } else {
      percent = p.status === 'on_hold' ? 25 : 0;
    }
  }
  percent = Math.max(0, Math.min(100, Math.round(percent)));
  const delayed = p.status === 'on_hold' || p.status === 'cancelled';
  const doneStatus = p.status === 'completed' || percent >= 100;
  return {
    percent,
    done,
    total,
    tone: doneStatus ? 'done' : (delayed ? (p.status === 'on_hold' ? 'hold' : 'delayed') : ''),
    label: doneStatus ? 'Done' : (delayed ? (p.status === 'on_hold' ? 'On Hold' : 'Delayed') : 'On Track')
  };
}

function editProject(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  fillFormMap({
    projModalId: p.id,           projModalCode: p.code || '',
    projModalName: p.name || '', projModalLocation: p.location || '',
    projModalClient: p.client || '', projModalStart: p.start_date || '',
    projModalEnd: p.end_date || '', projModalStatus: p.status || 'active'
  });
  document.getElementById('projectModalTitle').textContent = '✏ แก้ไขโปรเจกต์';
  openModal('projectModal');
}

async function saveProject(e) {
  e.preventDefault();
  const btn = document.getElementById('projModalSaveBtn');
  btn.disabled = true;
  const id = document.getElementById('projModalId').value;
  const payload = {
    code: document.getElementById('projModalCode').value.trim(),
    name: document.getElementById('projModalName').value.trim(),
    location: document.getElementById('projModalLocation').value.trim() || null,
    client: document.getElementById('projModalClient').value.trim() || null,
    start_date: document.getElementById('projModalStart').value || null,
    end_date: document.getElementById('projModalEnd').value || null,
    status: document.getElementById('projModalStatus').value,
  };
  let err;
  if (id) {
    ({ error: err } = await sb.from('projects').update(payload).eq('id', id));
  } else {
    payload.created_by = currentUser?.user_id;
    ({ error: err } = await sb.from('projects').insert(payload));
  }
  btn.disabled = false;
  if (err) { toast('บันทึกไม่สำเร็จ: ' + err.message, 'error'); return; }
  toast(id ? 'แก้ไขเรียบร้อย' : 'เพิ่มโปรเจกต์เรียบร้อย', 'success');
  closeProjectModal();
  await loadProjects();
}

async function deleteProject(id) {
  const p = allProjects.find(x => x.id === id);
  if (!p) return;
  if (!confirm('ลบโปรเจกต์ "' + p.code + ' — ' + p.name + '" ?\n(ข้อมูล local ของโปรเจกต์นี้จะยังคงอยู่ใน browser)')) return;
  const { error } = await sb.from('projects').delete().eq('id', id);
  if (error) { toast('ลบไม่สำเร็จ: ' + error.message, 'error'); return; }
  toast('ลบเรียบร้อย', 'success');
  await loadProjects();
}

// ---- Project Detail Modal ----
function openProjectModal(projectId) {
  if (projectId === undefined) { return openCreateProject(); }
  currentProjectId = projectId;
  currentProjectMeta = (allProjects || []).find(p => p.id === projectId) || null;
  setView('project');  // BUG-1 FIX: currentView must be 'project' for requireProjectContext
  const m = currentProjectMeta || {};

  // Header
  document.getElementById('pdCode').textContent = m.code || '—';
  document.getElementById('pdName').textContent = m.name || 'Project';
  document.getElementById('pdMeta').textContent = [m.client, m.location].filter(Boolean).join(' · ') || '—';

  // Status badge
  const badge = document.getElementById('pdStatusBadge');
  const statusMap = { active: { label: 'กำลังดำเนินการ', cls: '' }, on_hold: { label: 'หยุดชั่วคราว', cls: 'hold' }, completed: { label: 'เสร็จสิ้น', cls: 'done' } };
  const st = statusMap[m.status] || statusMap.active;
  badge.textContent = st.label;
  badge.className = 'proj-status-badge ' + st.cls;

  // Timeline & KPIs
  const today = new Date(); today.setHours(0,0,0,0);
  const start = m.start_date ? new Date(m.start_date) : null;
  const end   = m.end_date   ? new Date(m.end_date)   : null;
  let pct = 0, daysLeft = '—', elapsed = '—';
  if (start && end && end > start) {
    const total = end - start;
    const done  = Math.min(Math.max(today - start, 0), total);
    pct = Math.round((done / total) * 100);
    const remaining = Math.ceil((end - today) / 86400000);
    daysLeft = remaining > 0 ? remaining + ' วัน' : 'หมดแล้ว';
    const elapsedDays = Math.ceil((today - start) / 86400000);
    elapsed = Math.max(elapsedDays, 0) + ' วัน';
  } else if (start) {
    const elapsedDays = Math.ceil((today - start) / 86400000);
    elapsed = Math.max(elapsedDays, 0) + ' วัน';
  }
  document.getElementById('pdProgressPct').textContent = pct + '%';
  document.getElementById('pdDaysLeft').textContent = daysLeft;
  document.getElementById('pdElapsed').textContent = elapsed;
  document.getElementById('pdStatusKpi').textContent = st.label;

  // Timeline bar
  const fmt = d => d ? d.toLocaleDateString('th-TH',{day:'2-digit',month:'short',year:'2-digit'}) : '—';
  document.getElementById('pdTlStart').textContent = start ? fmt(start) : '—';
  document.getElementById('pdTlEnd').textContent   = end   ? fmt(end)   : '—';
  const fillPct = Math.min(pct, 100);
  document.getElementById('pdTlFill').style.width = fillPct + '%';
  document.getElementById('pdTlToday').style.left  = fillPct + '%';

  // Progress ring (canvas donut)
  requestAnimationFrame(() => {
    const c = document.getElementById('pdProgressRing');
    if (!c) return;
    const ctx = c.getContext('2d');
    const cx = 36, cy = 36, r = 28, lw = 8;
    ctx.clearRect(0, 0, 72, 72);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = lw; ctx.stroke();
    if (pct > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct / 100));
      const g = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      g.addColorStop(0, '#f59e0b'); g.addColorStop(1, '#f97316');
      ctx.strokeStyle = g; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    }
  });

  // Infographic canvas
  requestAnimationFrame(() => _drawProjectInfogfx(pct, fillPct, m));

  // Phase-3C: manual loads removed — crystalProjectOpen event (dispatched below)
  // covers all modules identically via _bindProjectEvents(). openTool() per-tool
  // reloads are kept as refresh-on-focus (not covered by project-open event).
  emitProjectOpen(currentProjectMeta, 'openProjectModal');  // Phase-3B
  openModal('projectDetailModal');
}
function _drawProjectInfogfx(pct, timePct, m) {
  const cv = document.getElementById('pdInfoCanvas');
  if (!cv) return;
  const W = cv.parentElement.clientWidth || 480;
  const H = 220;
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const planned = Math.min(timePct + 10, 100);
  const metrics = [
    { label: 'ระยะเวลา', val: timePct, color: '#f59e0b' },
    { label: 'แผนงาน',   val: planned,  color: '#818cf8' },
    { label: 'ผลงาน',    val: pct,      color: '#34d399' },
  ];
  const PI2 = Math.PI * 2, start = -Math.PI / 2;

  // bg
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1829'); bg.addColorStop(1, '#0a1320');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  function arc(cx, cy, r, lw, a0, a1, color, shadow) {
    ctx.save();
    if (shadow) { ctx.shadowColor = shadow; ctx.shadowBlur = 10; }
    ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1);
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
  }

  // ── LEFT: big donut ──
  const cx = 110, cy = H / 2, R = 72, LW = 14;
  // track
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, PI2);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = LW; ctx.stroke();
  // progress fill
  if (pct > 0) {
    const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    g.addColorStop(0, '#f59e0b'); g.addColorStop(1, '#34d399');
    arc(cx, cy, R, LW, start, start + PI2 * pct / 100, g, 'rgba(245,158,11,0.45)');
  }
  // center %
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif'; ctx.fillText(pct + '%', cx, cy + 5);
  ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fillText('ความคืบหน้า', cx, cy + 22);
  // project name above ring
  const name = m && m.name ? (m.name.length > 16 ? m.name.slice(0,15)+'…' : m.name) : '';
  ctx.font = '600 11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(name, cx, cy - R - 10);

  // ── DIVIDER ──
  ctx.beginPath(); ctx.moveTo(198, 16); ctx.lineTo(198, H - 16);
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();

  // ── RIGHT: 3 mini horizontal metric rows ──
  const rx0 = 216, rowH = (H - 40) / 3, mR = 28, mLW = 7;
  metrics.forEach((mt, i) => {
    const ry = 28 + rowH * i + rowH / 2;
    // mini donut
    ctx.beginPath(); ctx.arc(rx0 + mR, ry, mR, 0, PI2);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = mLW; ctx.stroke();
    if (mt.val > 0) {
      arc(rx0 + mR, ry, mR, mLW, start, start + PI2 * mt.val / 100, mt.color, mt.color + '66');
    }
    // pct inside
    ctx.textAlign = 'center'; ctx.font = 'bold 12px sans-serif'; ctx.fillStyle = mt.color;
    ctx.fillText(mt.val + '%', rx0 + mR, ry + 4);
    // label + bar right of ring
    const bx = rx0 + mR * 2 + 14, bw = W - bx - 20, bh = 6, by = ry - 14;
    ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(mt.label, bx, by + 1);
    // bar track
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by + 7, bw, bh, 3) : ctx.rect(bx, by + 7, bw, bh);
    ctx.fill();
    // bar fill
    if (mt.val > 0) {
      ctx.fillStyle = mt.color;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by + 7, bw * mt.val / 100, bh, 3) : ctx.rect(bx, by + 7, bw * mt.val / 100, bh);
      ctx.fill();
    }
    // pct label end
    ctx.textAlign = 'right'; ctx.font = '10px sans-serif'; ctx.fillStyle = mt.color;
    ctx.fillText(mt.val + '%', W - 8, by + 13);
  });

  // ── status badge bottom-left ──
  const stMap = { active:'กำลังดำเนินการ', on_hold:'หยุดชั่วคราว', completed:'เสร็จสิ้น' };
  const stCol = { active:'#34d399', on_hold:'#fbbf24', completed:'#818cf8' };
  const st = m && m.status; const stC = stCol[st] || '#94a3b8'; const stT = stMap[st] || '—';
  ctx.font = '600 10px sans-serif'; ctx.textAlign = 'left';
  const bw2 = ctx.measureText(stT).width + 16;
  const bx2 = 14, by2 = H - 14;
  ctx.fillStyle = stC + '20';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx2, by2 - 14, bw2, 17, 4) : ctx.rect(bx2, by2 - 14, bw2, 17);
  ctx.fill(); ctx.strokeStyle = stC + '55'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = stC; ctx.fillText(stT, bx2 + 8, by2 - 2);
}

function editCurrentProject() {
  if (!currentProjectId) return;
  closeProjectModalDetail();
  const p = currentProjectMeta || {};
  fillFormMap({
    projModalId: currentProjectId,   projModalCode: p.code || '',
    projModalName: p.name || '',     projModalLocation: p.location || '',
    projModalClient: p.client || '', projModalStart: p.start_date || '',
    projModalEnd: p.end_date || '',  projModalStatus: p.status || 'active'
  });
  document.getElementById('projectModalTitle').textContent = '✏️ แก้ไขโปรเจกต์';
  openModal('projectModal');
}
function closeProjectModalDetail() {
  emitProjectClose('closeProjectModalDetail');  // Phase-3B
  closeModal('projectDetailModal');
  currentProjectId = null; currentProjectMeta = null;
  setView('dashboard');  // BUG-1 FIX: restore currentView when leaving project
}
function switchProjTab(tab, btn) {
  // stub — kept for legacy compatibility
}

// Legacy alias: existing code calls openProjectModal() with no args to add a project,
// and closeProjectModal() refers to the add/edit modal. Keep both behaviors working.
function openCreateProject() {
  // open the add/edit project modal (already in DOM as #projectModal)
  fillFormMap({
    projModalId:'', projModalCode:'', projModalName:'',
    projModalLocation:'', projModalClient:'',
    projModalStart:'', projModalEnd:'', projModalStatus:'active'
  });
  document.getElementById('projectModalTitle').textContent = '📁 เพิ่มโปรเจกต์';
  openModal('projectModal');
}
// NOTE (Phase-3A → Phase-4P-2): v1 openProjectModal() and v1 closeProjectModal()
// were dead code (overridden by function hoisting — never executed at runtime).
// _origCloseProjectModal was also dead (captured v2, not v1, due to hoisting).
// All three removed during Phase-4P-2 extraction.
function closeProjectModal() {
  closeModal('projectModal');
  closeProjectModalDetail();
}

// Override openProject(id) to use the new detail modal instead of switching view.
function openProject(id) {
  openProjectModal(id);
}

function scrollToCard(cardId) {
  const el = document.getElementById(cardId);
  if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
