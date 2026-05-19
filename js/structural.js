'use strict';
// ============================================================
// Crystal AI - structural.js  (Phase-4L-2 extraction)
// Structural Analysis - Beam / Column / Slab / Footing / Continuous Beam
// + AI Vision analysis + Q&A + Save/History + openStructAssistant
// Depends on: utils.js (safeJsonParse, escapeHtml, friendlyError, openModal),
//             toast.js (toast),
//             i18n.js (currentLang),
//             markdown.js (renderMarkdown),
//             storage.js (withProjectStorage),
//             api.js (callAPI, getActiveKey, getActiveModel)
// Runtime deps (resolved at call time):
//   currentProjectId, allProjects - inline auth/projects scripts
//   _activeToolPanel, closeToolModalReturn - inline (used by openStructAssistant)
//   window.jspdf - CDN (used by exportStructResultPDF)
// localStorage keys:
//   crystal_struct_draft    - GLOBAL (shared across projects, raw localStorage)
//   crystal_struct_results  - PROJECT-SCOPED via withProjectStorage proxy
// Extraction order: Band 1 (core+save+QA) | Band 2 (AI vision) | openStructAssistant | Band 3 (cont beam)
// ============================================================

// 12.3 STRUCTURAL ANALYSIS (Beam/Column/Slab/Footing) + Q&A
// Standards (verified in spec, latest enacted):
//   - กฎกระทรวงโครงสร้างอาคาร พ.ศ.2566
//   - กฎกระทรวงฐานราก พ.ศ.2566
//   - มยผ.1101-64 ถึง 1106-64 (วัสดุ/คอนกรีต)
//   - มยผ.1301/1302-61 (แผ่นดินไหว)
//   - มยผ.1311-50 (แรงลม)
// ============================================================

const STRUCT_REF_BUILDING = 'กฎกระทรวงโครงสร้างอาคาร พ.ศ.2566 + มยผ.1101-64';
const STRUCT_REF_FOOTING  = 'กฎกระทรวงฐานราก พ.ศ.2566 + มยผ.1103-64';
const STRUCT_REF_SEISMIC  = 'มยผ.1301/1302-61';

const STRUCT_DISCLAIMER = `⚠️ <strong>ผลการคำนวณนี้เป็นการประมาณเบื้องต้นเท่านั้น</strong> — ต้องให้วิศวกรโยธาที่มีใบอนุญาต (กว.) ตรวจสอบและรับรองแบบก่อนก่อสร้างจริงทุกครั้ง`;

const REBAR_SIZES = [
  { name: 'DB10', d: 10, area: 78.5 },
  { name: 'DB12', d: 12, area: 113.1 },
  { name: 'DB16', d: 16, area: 201.1 },
  { name: 'DB20', d: 20, area: 314.2 },
  { name: 'DB25', d: 25, area: 490.9 },
  { name: 'DB28', d: 28, area: 615.8 },
  { name: 'DB32', d: 32, area: 804.2 },
];

function suggestBars(As_required, maxBars) {
  for (const sz of REBAR_SIZES) {
    const n = Math.max(2, Math.ceil(As_required / sz.area));
    if (!maxBars || n <= maxBars) return { count: n, size: sz.name, area_provided: n * sz.area };
  }
  const sz = REBAR_SIZES[REBAR_SIZES.length - 1];
  return { count: Math.ceil(As_required / sz.area), size: sz.name, area_provided: Math.ceil(As_required / sz.area) * sz.area };
}

// Stirrup design — RB (SR24, fy_s=235 MPa), 2-leg closed stirrups
// Returns { type, Av, s, Vc, phiVc, Vs_req }
function suggestStirrups(Vu_kN, b, d, fc) {
  const fy_s = 235; // SR24
  const Vc = 0.17 * Math.sqrt(fc) * b * d / 1000; // kN
  const phiVc = 0.75 * Vc;
  const Vs_req = Math.max(0, Vu_kN / 0.75 - Vc); // kN
  const s_max = Math.floor(Math.min(d / 2, 600) / 25) * 25;
  const STIRRUP_TYPES = [
    { name: 'RB6', Av: 56.5 },
    { name: 'RB9', Av: 127.2 },
  ];
  for (const st of STIRRUP_TYPES) {
    let s_calc;
    if (Vs_req <= 0) {
      const k = Math.max(0.062 * Math.sqrt(fc), 0.35);
      s_calc = st.Av * fy_s / (k * b);
    } else {
      s_calc = st.Av * fy_s * d / (Vs_req * 1000);
    }
    const s_use = Math.min(Math.floor(s_calc / 25) * 25, s_max);
    if (s_use >= 75) return { type: st.name, Av: st.Av, s: s_use, Vc, phiVc, Vs_req };
  }
  return { type: 'RB9', Av: 127.2, s: 75, Vc, phiVc, Vs_req };
}

function switchStructTab(name, btnEl) {
  document.querySelectorAll('.struct-sub-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.struct-subtab').forEach(t => t.classList.remove('active'));
  const p = document.getElementById('struct-' + name); if (p) p.classList.add('active');
  if (btnEl) btnEl.classList.add('active');
}

function _num(id) { return parseFloat(document.getElementById(id)?.value) || 0; }
function _fmt(n, d) { return (Math.abs(n) >= 1e6 ? n.toExponential(2) : Number(n).toFixed(d ?? 2)); }
function _renderResult(targetId, html, exportTitle) {
  const el = document.getElementById(targetId);
  // Append PDF export button at top of result if a title was given
  const exportBtn = exportTitle
    ? `<div style="display:flex;justify-content:flex-end;margin-bottom:8px"><button class="btn-export pdf" style="padding:6px 12px;font-size:12px" onclick="exportStructResultPDF('${targetId}', ${JSON.stringify(exportTitle)})">📄 Export PDF</button></div>`
    : '';
  el.innerHTML = exportBtn + html;
  el.classList.add('show');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Export a struct result card to PDF using jsPDF (text-based, with auto-table for result rows)
async function exportStructResultPDF(resultId, title) {
  try {
    if (!window.jspdf) throw new Error('jsPDF ยังโหลดไม่เสร็จ');
    const el = document.getElementById(resultId);
    if (!el) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4', orientation:'portrait' });
    const M = 36;
    const W = doc.internal.pageSize.getWidth();
    // Title
    doc.setFontSize(16); doc.setTextColor(31,78,121); doc.setFont(undefined,'bold');
    doc.text('Crystal AI — Structural Analysis', M, M);
    doc.setFontSize(12); doc.setTextColor(0); doc.text(title, M, M + 18);
    doc.setDrawColor(31,78,121); doc.line(M, M + 22, W - M, M + 22);
    let y = M + 36;
    // Render result rows
    const rrs = el.querySelectorAll('.rr');
    const tbl = [];
    rrs.forEach(rr => {
      const lbl = rr.querySelector('.lbl')?.textContent || '';
      const val = rr.querySelector('.val')?.textContent || '';
      tbl.push([lbl, val]);
    });
    if (tbl.length && doc.autoTable) {
      doc.autoTable({
        startY: y, margin: { left: M, right: M },
        head: [['รายการ', 'ค่า']],
        body: tbl,
        styles: { fontSize: 9.5, cellPadding: 4 },
        headStyles: { fillColor: [48, 84, 150], textColor: 255 },
        columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 200, halign: 'right' } }
      });
      y = doc.lastAutoTable.finalY + 14;
    }
    // Verdict
    const verdict = el.querySelector('.verdict');
    if (verdict) {
      const isPass = verdict.classList.contains('pass');
      doc.setFillColor(isPass ? 220 : 255, isPass ? 245 : 220, isPass ? 220 : 220);
      doc.rect(M, y, W - M*2, 22, 'F');
      doc.setTextColor(isPass ? 30 : 150, isPass ? 120 : 30, 30);
      doc.setFont(undefined, 'bold'); doc.setFontSize(11);
      doc.text(verdict.textContent.trim(), M + 8, y + 15);
      doc.setTextColor(0); doc.setFont(undefined, 'normal');
      y += 32;
    }
    // Reference badge
    const ref = el.querySelector('.struct-ref-badge');
    if (ref) {
      doc.setFontSize(9); doc.setTextColor(232, 168, 56);
      doc.text(ref.textContent.trim(), M, y);
      y += 16;
    }
    // Formula steps (if visible OR include anyway)
    const fm = el.querySelector('.formula-steps');
    if (fm && fm.textContent.trim()) {
      if (y > 700) { doc.addPage(); y = M; }
      doc.setTextColor(0); doc.setFontSize(10); doc.setFont(undefined,'bold');
      doc.text('สูตรการคำนวณ (Formula Steps):', M, y); y += 14;
      doc.setFont('courier','normal'); doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(fm.textContent, W - M*2);
      lines.forEach(line => {
        if (y > 780) { doc.addPage(); y = M; }
        doc.text(line, M, y); y += 11;
      });
      doc.setFont(undefined,'normal');
      y += 6;
    }
    // Disclaimer
    if (y > 740) { doc.addPage(); y = M; }
    doc.setDrawColor(248,81,73); doc.setFillColor(255,240,240);
    doc.rect(M, y, W - M*2, 40, 'FD');
    doc.setFontSize(9); doc.setTextColor(150, 30, 30); doc.setFont(undefined,'bold');
    doc.text('⚠ DISCLAIMER', M + 8, y + 14);
    doc.setFont(undefined,'normal'); doc.setTextColor(0);
    doc.text('ผลการคำนวณเป็นการประมาณเบื้องต้น — ต้องให้วิศวกรโยธาที่มีใบอนุญาต (กว.)', M + 8, y + 26);
    doc.text('ตรวจสอบและรับรองแบบก่อนก่อสร้างจริงทุกครั้ง', M + 8, y + 36);
    // Footer
    doc.setFontSize(8); doc.setTextColor(120);
    doc.text('Crystal AI · ' + new Date().toLocaleString('th-TH'), W/2, doc.internal.pageSize.getHeight() - 18, { align:'center' });

    const safe = title.replace(/[^A-Za-z0-9ก-๙_-]/g, '_').slice(0, 40);
    doc.save('Struct_' + safe + '.pdf');
    toast('Export PDF เรียบร้อย ✓', 'success');
  } catch (err) {
    console.error(err);
    toast('Export ผิดพลาด: ' + (err.message || err), 'error');
  }
}

function _verdict(pass, txtPass, txtFail) {
  return `<div class="verdict ${pass ? 'pass' : 'fail'}">${pass ? '✅' : '❌'} ${pass ? txtPass : txtFail}</div>`;
}
function _refBadge(ref) { return `<span class="struct-ref-badge">📖 อ้างอิง: ${ref}</span>`; }
function _formulaBlock(steps) {
  const id = 'fm_' + Math.random().toString(36).slice(2,8);
  return `<button class="formula-toggle" onclick="document.getElementById('${id}').classList.toggle('show')">📐 แสดง/ซ่อนสูตรการคำนวณ</button>
          <div class="formula-steps" id="${id}">${steps}</div>`;
}

function resetStructForm(type) {
  const defaults = {
    beam:    { bm_b:200, bm_h:400, bm_L:4.0, bm_w:15, bm_fc:24, bm_fy:400 },
    column:  { cl_b:300, cl_h:300, cl_Lu:3.0, cl_Pu:1500, cl_fc:24, cl_fy:400 },
    slab:    { sl_Lx:4.0, sl_Ly:4.0, sl_t:120, sl_wD:2.4, sl_wL:2.0, sl_fc:24, sl_fy:400 },
    footing: { ft_P:800, ft_qa:100, ft_Df:1.5, ft_cx:300, ft_cy:300, ft_t:400, ft_fc:24, ft_fy:400, ft_g:18 },
  };
  Object.entries(defaults[type] || {}).forEach(([k,v]) => { const el = document.getElementById(k); if (el) el.value = v; });
  const resultId = ({beam:'bm_result',column:'cl_result',slab:'sl_result',footing:'ft_result'})[type];
  if (resultId) document.getElementById(resultId).classList.remove('show');
}

// -------- BEAM --------
// FIXED v5.1: Structural diagram engine — FEAT-5
const StructDiagram = {
  drawFBD(canvas, beam) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const margin = 60, beamY = H / 2, beamLen = W - margin * 2;
    // Beam body
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(margin, beamY - 8, beamLen, 16);
    ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5;
    ctx.strokeRect(margin, beamY - 8, beamLen, 16);
    // Supports
    (beam.supports || []).forEach(sup => {
      const x = margin + (sup.pos / beam.length) * beamLen;
      this._drawSupport(ctx, x, beamY + 8, sup.type);
    });
    // Loads
    (beam.loads || []).forEach(load => {
      const x1 = margin + (load.pos / beam.length) * beamLen;
      if (load.type === 'point') {
        this._drawPointLoad(ctx, x1, beamY - 8, load.value);
      } else if (load.type === 'udl') {
        const x2 = margin + ((load.posEnd ?? beam.length) / beam.length) * beamLen;
        this._drawUDL(ctx, x1, x2, beamY - 8, load.value);
      }
    });
    // Length label
    ctx.fillStyle = '#9ca3af'; ctx.font = '11px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`L = ${beam.length} m`, W / 2, H - 10);
    ctx.textAlign = 'left';
  },
  drawSFD(canvas, shearData) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const m = { top: 28, bottom: 28, left: 60, right: 20 };
    const plotW = W - m.left - m.right, plotH = H - m.top - m.bottom;
    const midY = m.top + plotH / 2;
    // Baseline
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(m.left, midY); ctx.lineTo(W - m.right, midY); ctx.stroke();
    ctx.setLineDash([]);
    if (!shearData || !shearData.length) return;
    const maxV = Math.max(...shearData.map(d => Math.abs(d.v)), 1);
    const scale = (plotH / 2) / maxV;
    const xEnd = shearData[shearData.length - 1].x;
    // Fill
    ctx.fillStyle = 'rgba(245,158,11,0.18)';
    ctx.beginPath(); ctx.moveTo(m.left, midY);
    shearData.forEach(d => {
      const x = m.left + (d.x / xEnd) * plotW;
      const y = midY - d.v * scale;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W - m.right, midY); ctx.closePath(); ctx.fill();
    // Line
    ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2;
    ctx.beginPath();
    shearData.forEach((d, i) => {
      const x = m.left + (d.x / xEnd) * plotW;
      const y = midY - d.v * scale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Title + max
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 11px Sarabun';
    ctx.fillText('Shear Force (kN)', m.left, m.top - 8);
    ctx.font = 'bold 11px IBM Plex Mono';
    ctx.fillText(`Vmax = ${maxV.toFixed(2)} kN`, W - m.right - 130, m.top - 8);
  },
  drawBMD(canvas, momentData) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const m = { top: 28, bottom: 28, left: 60, right: 20 };
    const plotW = W - m.left - m.right, plotH = H - m.top - m.bottom;
    const baseY = m.top + 4;
    if (!momentData || !momentData.length) return;
    const maxM = Math.max(...momentData.map(d => Math.abs(d.m)), 1);
    const scale = (plotH - 8) / maxM;
    const xEnd = momentData[momentData.length - 1].x;
    // Baseline at top
    ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(m.left, baseY); ctx.lineTo(W - m.right, baseY); ctx.stroke();
    ctx.setLineDash([]);
    // Fill (sagging positive → curve hangs downward)
    ctx.fillStyle = 'rgba(88,166,255,0.18)';
    ctx.beginPath(); ctx.moveTo(m.left, baseY);
    momentData.forEach(d => {
      const x = m.left + (d.x / xEnd) * plotW;
      const y = baseY + Math.abs(d.m) * scale;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(W - m.right, baseY); ctx.closePath(); ctx.fill();
    // Line
    ctx.strokeStyle = '#58a6ff'; ctx.lineWidth = 2;
    ctx.beginPath();
    momentData.forEach((d, i) => {
      const x = m.left + (d.x / xEnd) * plotW;
      const y = baseY + Math.abs(d.m) * scale;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Max moment label
    const maxPt = momentData.reduce((a, b) => Math.abs(a.m) > Math.abs(b.m) ? a : b);
    const mx = m.left + (maxPt.x / xEnd) * plotW;
    const my = baseY + Math.abs(maxPt.m) * scale;
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath(); ctx.arc(mx, my, 3, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 11px IBM Plex Mono';
    ctx.fillText(`Mmax = ${maxPt.m.toFixed(2)} kN·m`, Math.min(mx + 6, W - m.right - 140), my + 14);
    ctx.font = 'bold 11px Sarabun';
    ctx.fillText('Bending Moment (kN·m)', m.left, m.top - 8);
  },
  calcSimplySupported_UDL(L, w) {
    const RA = (w * L) / 2, RB = RA;
    const n = 50, shear = [], moment = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      const V = RA - w * x;
      const M = RA * x - (w * x * x) / 2;
      shear.push({ x, v: V });
      moment.push({ x, m: M });
    }
    return { RA, RB, shear, moment, Mmax: (w * L * L) / 8 };
  },
  calcSimplySupported_PointLoad(L, P, a) {
    const b = L - a;
    const RA = (P * b) / L, RB = (P * a) / L;
    const n = 50, shear = [], moment = [];
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * L;
      let V = RA, M = RA * x;
      if (x > a) { V = RA - P; M = RA * x - P * (x - a); }
      shear.push({ x, v: V });
      moment.push({ x, m: M });
    }
    return { RA, RB, shear, moment, Mmax: (RA * a * b) / L };
  },
  _drawSupport(ctx, x, y, type) {
    ctx.strokeStyle = '#9ca3af'; ctx.fillStyle = '#2a3f5f'; ctx.lineWidth = 2;
    if (type === 'pin') {
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x - 12, y + 20); ctx.lineTo(x + 12, y + 20);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      // hatching
      ctx.beginPath();
      for (let i = -14; i <= 14; i += 6) {
        ctx.moveTo(x + i, y + 20); ctx.lineTo(x + i - 4, y + 26);
      }
      ctx.stroke();
    } else if (type === 'roller') {
      ctx.beginPath(); ctx.arc(x, y + 12, 8, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 14, y + 22); ctx.lineTo(x + 14, y + 22); ctx.stroke();
    } else if (type === 'fixed') {
      ctx.fillRect(x - 4, y, 8, 24);
    }
  },
  _drawPointLoad(ctx, x, y, value) {
    ctx.strokeStyle = '#ef4444'; ctx.fillStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 50); ctx.lineTo(x, y); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x - 6, y - 12); ctx.lineTo(x + 6, y - 12);
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 11px IBM Plex Mono';
    ctx.fillText(`${value} kN`, x + 8, y - 30);
  },
  _drawUDL(ctx, x1, x2, y, value) {
    ctx.fillStyle = 'rgba(16,185,129,0.18)';
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5;
    ctx.fillRect(x1, y - 36, x2 - x1, 36);
    ctx.strokeRect(x1, y - 36, x2 - x1, 36);
    // arrows
    ctx.fillStyle = '#10b981';
    const step = Math.max(20, (x2 - x1) / 8);
    for (let xi = x1 + 8; xi < x2 - 4; xi += step) {
      ctx.beginPath();
      ctx.moveTo(xi, y); ctx.lineTo(xi - 4, y - 8); ctx.lineTo(xi + 4, y - 8);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(xi, y - 8); ctx.lineTo(xi, y - 34);
      ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.font = '10px IBM Plex Mono';
    ctx.fillText(`w = ${value} kN/m`, (x1 + x2) / 2 - 28, y - 42);
  }
};

function calcBeam() {
  const b = _num('bm_b'), h = _num('bm_h'), L = _num('bm_L'), w = _num('bm_w'),
        fc = _num('bm_fc'), fy = _num('bm_fy');
  if (!b || !h || !L || !w || !fc || !fy) { toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  const d = h - 40;
  const Mmax = w * L * L / 8;   // kN·m (กลางช่วง)
  const Vmax = w * L / 2;       // kN (ที่จุดรองรับ)
  const rho_min = Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy);

  // ── เหล็กยืนล่าง (Bottom — Tension) ──
  const Ru_bot = (Mmax * 1e6) / (b * d * d);
  const in_bot = 1 - 2 * Ru_bot / (0.85 * fc);
  const rho_bot = in_bot <= 0 ? NaN : (0.85 * fc / fy) * (1 - Math.sqrt(in_bot));
  const rho_bot_use = isNaN(rho_bot) ? rho_min : Math.max(rho_bot, rho_min);
  const As_bot = rho_bot_use * b * d;
  const bars_bot = suggestBars(As_bot, 6);

  // ── เหล็กยืนบน (Top — ρ_min สำหรับ simply supported) ──
  const As_top = rho_min * b * d;
  const bars_top = suggestBars(As_top, 4);

  // ── เหล็กปลอก (Stirrups) ──
  const st = suggestStirrups(Vmax, b, d, fc);

  // ── Deflection ──
  const Ec = 4700 * Math.sqrt(fc);
  const I  = b * Math.pow(h, 3) / 12;
  const delta = (5 * w * Math.pow(L * 1000, 4)) / (384 * Ec * I);
  const delta_lim = L * 1000 / 360;
  const deflOK = delta <= delta_lim;
  const secOK  = !isNaN(rho_bot);

  const html = `
    <h3>📊 ผลการคำนวณ — คาน (Simply Supported UDL)</h3>
    <div class="result-rows">
      <div class="rr"><span class="lbl">Effective depth d</span><span class="val">${_fmt(d,0)} mm</span></div>
      <div class="rr"><span class="lbl">Mmax (กลางช่วง)</span><span class="val">${_fmt(Mmax)} kN·m</span></div>
      <div class="rr"><span class="lbl">Vmax (ที่จุดรองรับ)</span><span class="val">${_fmt(Vmax)} kN</span></div>
      <div class="rr"><span class="lbl">ρ_min</span><span class="val">${_fmt(rho_min,5)}</span></div>

      <div class="rr section-hd"><span>🔩 เหล็กยืนล่าง — Bottom Steel (Tension)</span></div>
      <div class="rr"><span class="lbl">Ru</span><span class="val">${_fmt(Ru_bot,3)} MPa</span></div>
      <div class="rr"><span class="lbl">ρ (คำนวณ)</span><span class="val">${isNaN(rho_bot) ? 'Ru เกินขีดจำกัด' : _fmt(rho_bot,5)}</span></div>
      <div class="rr"><span class="lbl">As_bot required</span><span class="val">${_fmt(As_bot,1)} mm²</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กยืนล่าง</span><span class="val pass">${bars_bot.count}-${bars_bot.size} (As=${_fmt(bars_bot.area_provided,0)} mm²)</span></div>

      <div class="rr section-hd"><span>🔩 เหล็กยืนบน — Top Steel (Compression / ρ_min)</span></div>
      <div class="rr"><span class="lbl">As_top required</span><span class="val">${_fmt(As_top,1)} mm²</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กยืนบน</span><span class="val">${bars_top.count}-${bars_top.size} (As=${_fmt(bars_top.area_provided,0)} mm²)</span></div>

      <div class="rr section-hd"><span>🔗 เหล็กปลอก — Stirrups (RB, SR24)</span></div>
      <div class="rr"><span class="lbl">Vc</span><span class="val">${_fmt(st.Vc,2)} kN</span></div>
      <div class="rr"><span class="lbl">φVc</span><span class="val">${_fmt(st.phiVc,2)} kN</span></div>
      <div class="rr"><span class="lbl">Vs required</span><span class="val">${_fmt(st.Vs_req,2)} kN</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กปลอก</span><span class="val pass">${st.type}@${st.s} mm (2 ขา, Av=${_fmt(st.Av,1)} mm²)</span></div>

      <div class="rr section-hd"><span>📐 Deflection</span></div>
      <div class="rr"><span class="lbl">Δ</span><span class="val ${deflOK?'pass':'fail'}">${_fmt(delta,2)} mm</span></div>
      <div class="rr"><span class="lbl">Δ allowable (L/360)</span><span class="val">${_fmt(delta_lim,2)} mm</span></div>
    </div>
    ${_verdict(secOK && deflOK,
      'หน้าตัด + deflection ผ่าน',
      !secOK ? 'Ru เกินขีดจำกัด — ขยาย b หรือ h' : 'Deflection เกิน L/360 — เพิ่มความสูง h')}
    ${_refBadge(STRUCT_REF_BUILDING)}
    ${_formulaBlock(`d = h−40 = ${_fmt(d,0)} mm
Mmax = wL²/8 = ${_fmt(Mmax)} kN·m   Vmax = wL/2 = ${_fmt(Vmax)} kN
── Bottom Steel ──
Ru = Mu×10⁶/(b·d²) = ${_fmt(Ru_bot,3)} MPa
ρ = (0.85f'c/fy)[1−√(1−2Ru/0.85f'c)] = ${isNaN(rho_bot)?'—':_fmt(rho_bot,5)}
As_bot = ${_fmt(As_bot,1)} mm²  →  ${bars_bot.count}-${bars_bot.size}
── Top Steel ──
As_top = ρ_min×b×d = ${_fmt(As_top,1)} mm²  →  ${bars_top.count}-${bars_top.size}
── Stirrups (fy_s=235 MPa) ──
Vc = 0.17√f'c·b·d/1000 = ${_fmt(st.Vc,2)} kN   φVc = ${_fmt(st.phiVc,2)} kN
Vs = Vu/φ−Vc = ${_fmt(st.Vs_req,2)} kN
s = Av·fy_s·d/Vs = ${st.s} mm  (s_max=min(d/2,600)=${_fmt(Math.min(d/2,600),0)} mm)
── Deflection ──
Δ = 5wL⁴/(384EI) = ${_fmt(delta,2)} mm  ≤  L/360 = ${_fmt(delta_lim,2)} mm`)}
    <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  _renderResult('bm_result', html, `Beam ${b}x${h}mm L=${L}m`);
  try {
    const result = StructDiagram.calcSimplySupported_UDL(L, w);
    const beam = {
      length: L,
      supports: [{ pos: 0, type: 'pin' }, { pos: L, type: 'roller' }],
      loads: [{ type: 'udl', pos: 0, posEnd: L, value: w }]
    };
    StructDiagram.drawFBD(document.getElementById('bm_fbd'), beam);
    StructDiagram.drawSFD(document.getElementById('bm_sfd'), result.shear);
    StructDiagram.drawBMD(document.getElementById('bm_bmd'), result.moment);
    document.getElementById('bm_diagrams').classList.add('show');
  } catch (e) { console.error('[FEAT-5] diagram error:', e); }
  _trackStructCalc('beam', `Beam ${b}×${h}mm L=${L}m`, `b=${b}, h=${h}, L=${L}m, w=${w}kN/m, fc=${fc}, fy=${fy}`);
}

// -------- COLUMN --------
function calcColumn() {
  const b = _num('cl_b'), h = _num('cl_h'), Lu = _num('cl_Lu'), Pu = _num('cl_Pu'),
        fc = _num('cl_fc'), fy = _num('cl_fy'),
        type = getValue('cl_type', 'tied');
  if (!b || !h || !Lu || !Pu || !fc || !fy) { toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  const Ag = b * h;                                          // mm²
  const r = 0.3 * h;                                         // radius of gyration
  const slenderness = (1.0 * Lu * 1000) / r;
  const isShort = slenderness <= 22;
  const Ast = 0.02 * Ag;                                     // 2% default
  const Ast_min = 0.01 * Ag, Ast_max = 0.08 * Ag;
  const phi = type === 'spiral' ? 0.75 : 0.65;
  const phiPn_N = phi * 0.80 * (0.85 * fc * (Ag - Ast) + fy * Ast); // N
  const phiPn = phiPn_N / 1000;                              // kN
  const capacityOK = phiPn >= Pu;
  // Suggest main bars
  const mainBars = suggestBars(Ast, 12);
  const tieSpacing = Math.min(16 * 20, 48 * 9, b);           // mm — basic rule (16d, 48ds, b)
  const html = `
    <h3>📊 ผลการคำนวณ — เสา ${type === 'spiral' ? '(Spiral)' : '(Tied)'}</h3>
    <div class="result-rows">
      <div class="rr"><span class="lbl">Ag (พื้นที่หน้าตัด)</span><span class="val">${_fmt(Ag,0)} mm²</span></div>
      <div class="rr"><span class="lbl">r = 0.3h</span><span class="val">${_fmt(r,1)} mm</span></div>
      <div class="rr"><span class="lbl">Slenderness kLu/r</span><span class="val ${isShort?'pass':'fail'}">${_fmt(slenderness,1)} ${isShort?'(สั้น)':'(ยาว ⚠)'}</span></div>
      <div class="rr"><span class="lbl">Ast (2% default)</span><span class="val">${_fmt(Ast,0)} mm²</span></div>
      <div class="rr"><span class="lbl">Ast_min / max (1% / 8%)</span><span class="val">${_fmt(Ast_min,0)} / ${_fmt(Ast_max,0)}</span></div>
      <div class="rr"><span class="lbl">φ</span><span class="val">${phi}</span></div>
      <div class="rr"><span class="lbl">φPn (capacity)</span><span class="val ${capacityOK?'pass':'fail'}">${_fmt(phiPn,1)} kN</span></div>
      <div class="rr"><span class="lbl">Pu (ที่ออกแบบ)</span><span class="val">${_fmt(Pu,1)} kN</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กยืน</span><span class="val">${mainBars.count}-${mainBars.size}</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กปลอก</span><span class="val">RB9@${_fmt(tieSpacing,0)} mm</span></div>
    </div>
    ${_verdict(capacityOK && isShort,
       'หน้าตัดผ่าน (capacity ≥ Pu, slenderness ≤ 22)',
       !isShort ? 'Slenderness > 22 — เป็นเสายาว ต้องพิจารณา 2nd-order effects' : 'Capacity ไม่พอ — ขยายหน้าตัดหรือเพิ่ม Ast')}
    ${_refBadge(STRUCT_REF_BUILDING)}
    ${_formulaBlock(`Ag = b × h = ${b} × ${h} = ${_fmt(Ag,0)} mm²
r = 0.3h = 0.3 × ${h} = ${_fmt(r,1)} mm
Slenderness = kLu/r = 1.0 × ${Lu*1000} / ${_fmt(r,1)} = ${_fmt(slenderness,1)}  → ${isShort?'short':'slender'}
Ast = 0.02 × Ag = ${_fmt(Ast,0)} mm²  (อยู่ระหว่าง 1%–8% ของ Ag ✓)
φ = ${phi}  (${type})
φPn = φ × 0.80 × [0.85·f'c·(Ag − Ast) + fy·Ast]
    = ${phi} × 0.80 × [0.85×${fc}×(${Ag}−${_fmt(Ast,0)}) + ${fy}×${_fmt(Ast,0)}]
    = ${_fmt(phiPn,1)} kN

Pu = ${_fmt(Pu,1)} kN   →   φPn / Pu = ${_fmt(phiPn/Pu,2)} (ต้อง ≥ 1.0)`)}
    <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  _renderResult('cl_result', html, `Column ${b}x${h}mm Pu=${Pu}kN`);
  _trackStructCalc('column', `Column ${b}×${h}mm Pu=${Pu}kN`, `b=${b}, h=${h}, Lu=${Lu}m, Pu=${Pu}kN, fc=${fc}, fy=${fy}`);
}

// -------- SLAB --------
function calcSlab() {
  const Lx = _num('sl_Lx'), Ly = _num('sl_Ly'), t = _num('sl_t'),
        wD = _num('sl_wD'), wL = _num('sl_wL'),
        fc = _num('sl_fc'), fy = _num('sl_fy'),
        userType = getValue('sl_type', 'auto');
  if (!Lx || !Ly || !t || !fc || !fy) { toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  const ratio = Ly / Lx;
  const slabType = userType === 'auto' ? (ratio > 2 ? 'oneway' : 'twoway') : userType;
  const wu = 1.2 * wD + 1.6 * wL;                          // kN/m²
  const d = t - 20;                                        // mm — cover 20
  let html;
  if (slabType === 'oneway') {
    const t_min = Lx * 1000 / 20;                          // mm
    const Mu = wu * Lx * Lx / 8;                           // kN·m / m
    const As = (Mu * 1e6) / (0.90 * fy * 0.9 * d);         // mm²/m
    const As_min = 0.0018 * 1000 * t;                       // mm²/m
    const As_use = Math.max(As, As_min);
    const spacing = Math.min(3 * t, 450);
    // Bar choice: DB10 area 78.5 mm² → spacing = 78.5 / (As_use/1000)
    const sp_DB10 = Math.round(1000 * 78.5 / As_use / 10) * 10;
    const sp_DB12 = Math.round(1000 * 113.1 / As_use / 10) * 10;
    html = `
      <h3>📊 ผลการคำนวณ — พื้น One-Way (ratio ${_fmt(ratio,2)})</h3>
      <div class="result-rows">
        <div class="rr"><span class="lbl">wu = 1.2D + 1.6L</span><span class="val">${_fmt(wu,2)} kN/m²</span></div>
        <div class="rr"><span class="lbl">t_min (L/20)</span><span class="val ${t>=t_min?'pass':'fail'}">${_fmt(t_min,0)} mm (ใช้ ${t})</span></div>
        <div class="rr"><span class="lbl">d (= t − 20)</span><span class="val">${_fmt(d,0)} mm</span></div>
        <div class="rr"><span class="lbl">Mu (ต่อ 1 m)</span><span class="val">${_fmt(Mu,2)} kN·m/m</span></div>
        <div class="rr"><span class="lbl">As required</span><span class="val">${_fmt(As,0)} mm²/m</span></div>
        <div class="rr"><span class="lbl">As_min (0.18% × 1000 × t)</span><span class="val">${_fmt(As_min,0)} mm²/m</span></div>
        <div class="rr"><span class="lbl">As ใช้</span><span class="val">${_fmt(As_use,0)} mm²/m</span></div>
        <div class="rr"><span class="lbl">Spacing สูงสุด (3t หรือ 450)</span><span class="val">${_fmt(spacing,0)} mm</span></div>
        <div class="rr"><span class="lbl">เลือก DB10</span><span class="val">@ ${Math.min(sp_DB10, spacing)} mm</span></div>
        <div class="rr"><span class="lbl">เลือก DB12</span><span class="val">@ ${Math.min(sp_DB12, spacing)} mm</span></div>
      </div>
      ${_verdict(t >= t_min, 'ความหนาผ่านขั้นต่ำ', 'ความหนาไม่ผ่าน — เพิ่มเป็น ≥ '+_fmt(t_min,0)+' mm')}
      ${_refBadge(STRUCT_REF_BUILDING)}
      ${_formulaBlock(`Ly/Lx = ${Ly}/${Lx} = ${_fmt(ratio,2)} → ${ratio>2?'One-Way (>2)':'Two-Way (≤2)'}
wu = 1.2wD + 1.6wL = 1.2×${wD} + 1.6×${wL} = ${_fmt(wu,2)} kN/m²
t_min = L/20 = ${Lx*1000}/20 = ${_fmt(t_min,0)} mm
Mu = wu·Lx²/8 = ${_fmt(wu,2)}·${Lx}²/8 = ${_fmt(Mu,2)} kN·m/m
As = Mu/(0.90·fy·0.9d) = ${_fmt(Mu,2)}×10⁶/(0.90×${fy}×0.9×${d}) = ${_fmt(As,0)} mm²/m
As_min = 0.0018·1000·t = 0.0018·1000·${t} = ${_fmt(As_min,0)} mm²/m
Spacing ≤ min(3t, 450) = min(${3*t}, 450) = ${_fmt(spacing,0)} mm`)}
      <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  } else {
    // Two-way — simple coefficient method (วสท. approximate)
    const t_min = (Lx + Ly) * 1000 / 180;
    // Approximate Ca, Cb for simply supported all sides (Method 1 simplification)
    const m = Lx / Ly;
    const Ca = 0.048 + 0.025 * (1 - m);   // empirical approximation
    const Cb = 0.048 * m * m;             // simplified
    const Mux = Ca * wu * Lx * Lx;        // kN·m/m
    const Muy = Cb * wu * Lx * Lx;
    const Asx = (Mux * 1e6) / (0.90 * fy * 0.9 * d);
    const Asy = (Muy * 1e6) / (0.90 * fy * 0.9 * d);
    const As_min = 0.0018 * 1000 * t;
    const Asx_use = Math.max(Asx, As_min), Asy_use = Math.max(Asy, As_min);
    const spacing = Math.min(3 * t, 450);
    html = `
      <h3>📊 ผลการคำนวณ — พื้น Two-Way (ratio ${_fmt(ratio,2)})</h3>
      <div class="result-rows">
        <div class="rr"><span class="lbl">wu</span><span class="val">${_fmt(wu,2)} kN/m²</span></div>
        <div class="rr"><span class="lbl">t_min ((Lx+Ly)/180)</span><span class="val ${t>=t_min?'pass':'fail'}">${_fmt(t_min,0)} mm (ใช้ ${t})</span></div>
        <div class="rr"><span class="lbl">m = Lx/Ly</span><span class="val">${_fmt(m,3)}</span></div>
        <div class="rr"><span class="lbl">Ca (สัมประสิทธิ์ x)</span><span class="val">${_fmt(Ca,4)}</span></div>
        <div class="rr"><span class="lbl">Cb (สัมประสิทธิ์ y)</span><span class="val">${_fmt(Cb,4)}</span></div>
        <div class="rr"><span class="lbl">Mux (ทิศ short)</span><span class="val">${_fmt(Mux,2)} kN·m/m</span></div>
        <div class="rr"><span class="lbl">Muy (ทิศ long)</span><span class="val">${_fmt(Muy,2)} kN·m/m</span></div>
        <div class="rr"><span class="lbl">Asx (ทิศ short)</span><span class="val">${_fmt(Asx_use,0)} mm²/m</span></div>
        <div class="rr"><span class="lbl">Asy (ทิศ long)</span><span class="val">${_fmt(Asy_use,0)} mm²/m</span></div>
        <div class="rr"><span class="lbl">เลือก DB10 short</span><span class="val">@ ${Math.min(Math.round(1000*78.5/Asx_use/10)*10, spacing)} mm</span></div>
        <div class="rr"><span class="lbl">เลือก DB10 long</span><span class="val">@ ${Math.min(Math.round(1000*78.5/Asy_use/10)*10, spacing)} mm</span></div>
      </div>
      ${_verdict(t >= t_min, 'ความหนาผ่านขั้นต่ำ', 'ความหนาไม่ผ่าน — เพิ่มเป็น ≥ '+_fmt(t_min,0)+' mm')}
      ${_refBadge(STRUCT_REF_BUILDING)}
      ${_formulaBlock(`Ly/Lx = ${_fmt(ratio,2)} → Two-Way (≤ 2)
wu = 1.2wD + 1.6wL = ${_fmt(wu,2)} kN/m²
t_min = (Lx+Ly)/180 = (${Lx*1000}+${Ly*1000})/180 = ${_fmt(t_min,0)} mm
Ca = ${_fmt(Ca,4)},  Cb = ${_fmt(Cb,4)}  (สัมประสิทธิ์ moment โดยประมาณ)
Mux = Ca·wu·Lx² = ${_fmt(Mux,2)} kN·m/m
Muy = Cb·wu·Lx² = ${_fmt(Muy,2)} kN·m/m
Asx = Mux/(0.90·fy·0.9d) = ${_fmt(Asx,0)} mm²/m
Asy = Muy/(0.90·fy·0.9d) = ${_fmt(Asy,0)} mm²/m`)}
      <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  }
  _renderResult('sl_result', html, `Slab ${Lx}x${Ly}m t=${t}mm`);
  _trackStructCalc('slab', `Slab ${Lx}×${Ly}m t=${t}mm`, `Lx=${Lx}, Ly=${Ly}, t=${t}, wD=${wD}, wL=${wL}, fc=${fc}, fy=${fy}`);
}

// -------- FOOTING --------
function calcFooting() {
  const P = _num('ft_P'), qa = _num('ft_qa'), Df = _num('ft_Df'),
        cx = _num('ft_cx'), cy = _num('ft_cy'), t = _num('ft_t'),
        fc = _num('ft_fc'), fy = _num('ft_fy'), gs = _num('ft_g');
  if (!P || !qa || !Df || !cx || !cy || !t || !fc || !fy) { toast('กรุณากรอกข้อมูลให้ครบ', 'error'); return; }
  const q_net = qa - gs * Df;                          // kN/m²
  if (q_net <= 0) { toast('q_allow < γ·Df → ไม่มี net pressure', 'error'); return; }
  const A_req = P / q_net;                             // m²
  const B_raw = Math.sqrt(A_req);
  const B = Math.ceil(B_raw / 0.05) * 0.05;            // round up to 0.05m
  const Pu = 1.5 * P;                                  // kN (factored)
  const qu = Pu / (B * B);                             // kN/m²
  const d = t - 75;                                    // mm (cover ~75)
  // Bending at column face (cantilever)
  const Mu = qu * B * Math.pow((B - cx/1000)/2, 2) / 2;  // kN·m/m
  // One-way shear at d from column face
  const Vu_oneway = qu * B * ((B - cx/1000)/2 - d/1000);
  const phiVc_oneway = (0.75 * 0.17 * Math.sqrt(fc) * B * 1000 * d) / 1000;  // kN
  const oneWayOK = phiVc_oneway >= Vu_oneway;
  // Punching shear
  const bo = 4 * (cx + d);                              // mm
  const phiVc_p = (0.75 * 0.33 * Math.sqrt(fc) * bo * d) / 1000;  // kN
  const Vu_p = qu * (B*B - Math.pow((cx + d)/1000, 2));
  const punchOK = phiVc_p >= Vu_p;
  // Steel
  const As = (Mu * 1e6) / (0.90 * fy * 0.9 * d);       // mm²/m
  const As_min = 0.0018 * B * 1000 * t;                // total (mm²)
  const As_per_m = As;
  // Bar suggestion
  const sp_DB16 = Math.round(1000 * 201.1 / As_per_m / 10) * 10;
  const sp_DB20 = Math.round(1000 * 314.2 / As_per_m / 10) * 10;
  const allOK = oneWayOK && punchOK;
  const html = `
    <h3>📊 ผลการคำนวณ — ฐานราก ${_fmt(B,2)}×${_fmt(B,2)} m</h3>
    <div class="result-rows">
      <div class="rr"><span class="lbl">q_net = q_allow − γ·Df</span><span class="val">${_fmt(q_net,1)} kN/m²</span></div>
      <div class="rr"><span class="lbl">A required</span><span class="val">${_fmt(A_req,2)} m²</span></div>
      <div class="rr"><span class="lbl">B (ขนาดฐาน)</span><span class="val">${_fmt(B,2)} × ${_fmt(B,2)} m</span></div>
      <div class="rr"><span class="lbl">Pu (1.5P)</span><span class="val">${_fmt(Pu,1)} kN</span></div>
      <div class="rr"><span class="lbl">qu (ดิน)</span><span class="val">${_fmt(qu,1)} kN/m²</span></div>
      <div class="rr"><span class="lbl">d (= t − 75)</span><span class="val">${_fmt(d,0)} mm</span></div>
      <div class="rr"><span class="lbl">Mu (ที่หน้าเสา)</span><span class="val">${_fmt(Mu,2)} kN·m/m</span></div>
      <div class="rr"><span class="lbl">One-Way Shear Vu</span><span class="val">${_fmt(Vu_oneway,1)} kN</span></div>
      <div class="rr"><span class="lbl">φVc one-way</span><span class="val ${oneWayOK?'pass':'fail'}">${_fmt(phiVc_oneway,1)} kN</span></div>
      <div class="rr"><span class="lbl">Punching Vu</span><span class="val">${_fmt(Vu_p,1)} kN</span></div>
      <div class="rr"><span class="lbl">φVc punching</span><span class="val ${punchOK?'pass':'fail'}">${_fmt(phiVc_p,1)} kN</span></div>
      <div class="rr"><span class="lbl">As required</span><span class="val">${_fmt(As_per_m,0)} mm²/m</span></div>
      <div class="rr"><span class="lbl">เลือก DB16</span><span class="val">@ ${sp_DB16} mm</span></div>
      <div class="rr"><span class="lbl">เลือก DB20</span><span class="val">@ ${sp_DB20} mm</span></div>
    </div>
    ${_verdict(allOK,
       'แรงเฉือนผ่านทั้ง one-way และ punching',
       !oneWayOK ? 'One-way shear ไม่ผ่าน — เพิ่ม t หรือ B' : 'Punching shear ไม่ผ่าน — เพิ่ม t')}
    ${_refBadge(STRUCT_REF_FOOTING)}
    ${_formulaBlock(`q_net = q_allow − γ·Df = ${qa} − ${gs}×${Df} = ${_fmt(q_net,1)} kN/m²
A_req = P/q_net = ${P}/${_fmt(q_net,1)} = ${_fmt(A_req,2)} m²
B = √A_req ปัด 0.05 ขึ้น = ${_fmt(B,2)} m
Pu = 1.5P = ${_fmt(Pu,1)} kN,  qu = Pu/B² = ${_fmt(qu,1)} kN/m²
d = t − 75 = ${t} − 75 = ${d} mm

Bending: Mu = qu·B·((B−cx)/2)²/2 = ${_fmt(Mu,2)} kN·m/m
One-way Shear ที่ระยะ d:
  Vu = qu·B·((B−cx)/2 − d) = ${_fmt(Vu_oneway,1)} kN
  φVc = 0.75·0.17·√f'c·B·d = ${_fmt(phiVc_oneway,1)} kN  → ${oneWayOK?'PASS':'FAIL'}
Punching Shear:
  bo = 4·(cx + d) = ${bo} mm
  φVc_p = 0.75·0.33·√f'c·bo·d = ${_fmt(phiVc_p,1)} kN
  Vu_p = qu·(B² − (cx+d)²) = ${_fmt(Vu_p,1)} kN  → ${punchOK?'PASS':'FAIL'}

As = Mu/(0.90·fy·0.9d) = ${_fmt(As_per_m,0)} mm²/m`)}
    <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  _renderResult('ft_result', html, `Footing P=${P}kN B=${_fmt(B,2)}m`);
  _trackStructCalc('footing', `Footing P=${P}kN B=${_fmt(B,2)}m`, `P=${P}, qa=${qa}, Df=${Df}, cx=${cx}, t=${t}, fc=${fc}, fy=${fy}`);
}

// ============================================================
// Phase-2B-2: STRUCTURAL SAVE SYSTEM
// ============================================================
const STRUCT_DRAFT_KEY   = 'crystal_struct_draft';   // SHARED_KEY — global
const STRUCT_RESULTS_KEY = 'crystal_struct_results'; // project-scoped via proxy
const STRUCT_HISTORY_MAX = 10;

const _STRUCT_RESULT_IDS = {
  beam: 'bm_result', column: 'cl_result',
  slab: 'sl_result', footing: 'ft_result', cont_beam: 'cb_result'
};
const _STRUCT_TAB_MAP = {
  beam: 'beam', column: 'column', slab: 'slab', footing: 'footing', cont_beam: 'beam', ai: 'ai'
};
const _STRUCT_TYPE_LABEL = {
  beam: 'Beam', column: 'Column', slab: 'Slab', footing: 'Footing', cont_beam: 'คานต่อเนื่อง', ai: 'AI'
};

let _lastStructCalc  = null;
let _structHistItems = [];   // cache for history list (avoids large onclick attrs)

// [withProjectStorage() — Phase-4D-2: extracted to js/storage.js]

// Phase-2B-3: read selected project from picker, fall back to currentProjectId
function _getStructPickerPid() {
  const sel = document.getElementById('structProjectPicker');
  return (sel && sel.value) ? sel.value : (currentProjectId || '');
}

// Phase-2B-3: find project name by id from allProjects array
function _getProjectName(pid) {
  if (!pid) return '';
  const p = (allProjects || []).find(x => String(x.id) === String(pid));
  return p ? (p.name || p.code || pid) : pid;
}

// Phase-2B-3: populate project picker dropdown from allProjects
function populateStructProjectPicker() {
  const sel = document.getElementById('structProjectPicker');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">— เลือก Project —</option>';
  (allProjects || []).forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = (p.code ? p.code + ' · ' : '') + (p.name || p.id);
    sel.appendChild(opt);
  });
  // Restore previous pick, or default to currentProjectId
  if (prev && sel.querySelector(`option[value="${prev}"]`)) {
    sel.value = prev;
  } else if (currentProjectId && sel.querySelector(`option[value="${currentProjectId}"]`)) {
    sel.value = currentProjectId;
  }
}

function _trackStructCalc(type, title, input_summary) {
  const rid = _STRUCT_RESULT_IDS[type];
  const result_html = rid ? (document.getElementById(rid)?.innerHTML || '') : '';
  _lastStructCalc = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type, title, input_summary, result_html,
    created_at: new Date().toISOString()
  };
  populateStructProjectPicker();  // refresh options each time a calc runs
  const bar = document.getElementById('structSaveBar');
  if (bar) bar.style.display = '';
}

function saveStructDraft() {
  if (!_lastStructCalc) { toast('ยังไม่มีผลคำนวณ', 'error'); return; }
  try {
    // Use raw storage so draft bypasses project-scoping (already in SHARED_KEYS, but belt+suspenders)
    const raw = window.__crystalRawStorage || { set: localStorage.setItem.bind(localStorage) };
    raw.set(STRUCT_DRAFT_KEY, JSON.stringify(_lastStructCalc));
    toast('✓ บันทึก Draft แล้ว (Global)', 'success');
  } catch (e) {
    toast('บันทึกไม่ได้: ' + (e.message || e), 'error');
  }
}

function loadStructDraft() {
  try {
    const raw = window.__crystalRawStorage || { get: localStorage.getItem.bind(localStorage) };
    return safeJsonParse(raw.get(STRUCT_DRAFT_KEY), null);
  } catch (e) { return null; }
}

function clearStructDraft() {
  try {
    const raw = window.__crystalRawStorage || { rem: localStorage.removeItem.bind(localStorage) };
    (raw.rem || raw.remove || (() => {}))(STRUCT_DRAFT_KEY);
  } catch (e) {}
}

// Phase-2B-3: save to any picker-selected project, not just currentProjectId
function saveStructToProject() {
  if (!_lastStructCalc) { toast('ยังไม่มีผลคำนวณ', 'error'); return; }
  const pid = _getStructPickerPid();
  if (!pid) {
    toast('กรุณาเลือก Project จาก dropdown หรือใช้ "Draft" บันทึกชั่วคราว', 'warning');
    return;
  }
  try {
    withProjectStorage(pid, () => {
      const existing = safeJsonParse(localStorage.getItem(STRUCT_RESULTS_KEY), []);
      const filtered  = existing.filter(r => r.id !== _lastStructCalc.id);
      filtered.unshift(_lastStructCalc);
      localStorage.setItem(STRUCT_RESULTS_KEY, JSON.stringify(filtered.slice(0, STRUCT_HISTORY_MAX)));
    });
    toast(`✓ บันทึกเข้าโปรเจกต์ "${escapeHtml(_getProjectName(pid))}" แล้ว`, 'success');
  } catch (e) {
    if (e?.name === 'QuotaExceededError') {
      toast('⚠️ พื้นที่เต็ม — ลบ History บางรายการก่อน', 'warning');
    } else {
      toast('บันทึกไม่ได้: ' + (e.message || e), 'error');
    }
  }
}

// Phase-2B-3: read history from picker-selected project
function _loadStructHistory() {
  const pid = _getStructPickerPid();
  if (!pid) return [];
  return withProjectStorage(pid, () =>
    safeJsonParse(localStorage.getItem(STRUCT_RESULTS_KEY), [])
  );
}

function deleteStructResult(id) {
  const pid = _getStructPickerPid();
  if (!pid) return;
  withProjectStorage(pid, () => {
    const updated = safeJsonParse(localStorage.getItem(STRUCT_RESULTS_KEY), []).filter(r => r.id !== id);
    try { localStorage.setItem(STRUCT_RESULTS_KEY, JSON.stringify(updated)); } catch (e) {}
  });
  renderStructHistory();
  toast('ลบแล้ว', 'success');
}

function restoreStructResult(idx) {
  const item = _structHistItems[idx];
  if (!item) return;
  // Switch to the correct subtab
  const tabKey = _STRUCT_TAB_MAP[item.type] || 'beam';
  const tabBtn = document.querySelector(`#dashStructSubtabs .struct-subtab[onclick*="'${tabKey}'"]`);
  switchDashStruct(tabKey, tabBtn);
  // For cont_beam, also switch beam sub-type
  if (item.type === 'cont_beam') {
    const contPanel = document.getElementById('btype-cont');
    const s1Panel   = document.getElementById('btype-s1');
    if (contPanel) contPanel.style.display = '';
    if (s1Panel)   s1Panel.style.display = 'none';
  }
  // Restore result HTML
  const rid = _STRUCT_RESULT_IDS[item.type];
  if (rid) {
    const el = document.getElementById(rid);
    if (el) {
      el.innerHTML = item.result_html;
      el.classList.add('show');
      setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
    }
  }
  _lastStructCalc = item;
  const bar = document.getElementById('structSaveBar');
  if (bar) bar.style.display = '';
  toast(`✓ โหลด "${item.title}" แล้ว`, 'success');
}

function toggleStructHistory() {
  const panel = document.getElementById('structHistoryPanel');
  if (!panel) return;
  if (panel.style.display === 'none') {
    renderStructHistory();
    panel.style.display = '';
  } else {
    panel.style.display = 'none';
  }
}

// Phase-2B-3: history reads from picker-selected project
function renderStructHistory() {
  const panel = document.getElementById('structHistoryPanel');
  if (!panel) return;
  const pid = _getStructPickerPid();
  if (!pid) {
    panel.innerHTML = '<div style="color:var(--text-muted);font-size:12px;padding:6px 0">กรุณาเลือก Project จาก dropdown ก่อนดู History</div>';
    return;
  }
  _structHistItems = _loadStructHistory();
  const pName = _getProjectName(pid);
  if (!_structHistItems.length) {
    panel.innerHTML = `<div style="color:var(--text-muted);font-size:12px;padding:6px 0">ยังไม่มีประวัติใน "${escapeHtml(pName)}" — กด "Save to Project" เพื่อบันทึก</div>`;
    return;
  }
  const rows = _structHistItems.map((item, idx) => {
    const d = new Date(item.created_at);
    const dateStr = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
      + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const typeLabel = _STRUCT_TYPE_LABEL[item.type] || item.type;
    return `<div class="struct-hist-item">
      <span class="struct-hist-title">${escapeHtml(typeLabel)}: ${escapeHtml(item.title)}</span>
      <span class="struct-hist-meta">${dateStr}</span>
      <div class="struct-hist-actions">
        <button class="ghost-btn sm" onclick="restoreStructResult(${idx})">โหลด</button>
        <button class="ghost-btn sm" style="color:var(--red)" onclick="deleteStructResult('${escapeHtml(item.id)}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
  panel.innerHTML = `<div style="font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:6px">
    ประวัติใน "${escapeHtml(pName)}" (${_structHistItems.length}/${STRUCT_HISTORY_MAX})
  </div>${rows}`;
}

// -------- Q&A LIBRARY --------
const STRUCT_QA = [
  { kw: ['คาน','beam','span','deflection','เหล็กคาน'],
    title: 'คาน (Beam)',
    body: `• <strong>ความสูงคานโดยประมาณ</strong> = L/12 ถึง L/15
• <strong>ความกว้างคาน</strong> = 0.4–0.6 × ความสูง
• <strong>เหล็กล่างขั้นต่ำ</strong>: 2-DB12
• <strong>ระยะหุ้มคอนกรีต</strong>: 40 mm (ภายนอก), 25 mm (ภายใน)
• <strong>Deflection</strong> ≤ L/360 (live load) หรือ L/240 (total)`,
    ref: STRUCT_REF_BUILDING },

  { kw: ['เสา','column','slender','buckling','ขนาดเสา'],
    title: 'เสา (Column)',
    body: `• <strong>อาคาร 1-2 ชั้น</strong>: ขนาดขั้นต่ำ 20×20 cm
• <strong>อาคาร 3-4 ชั้น</strong>: 25×25 cm ขึ้นไป
• <strong>เหล็กยืน</strong>: 1–4% ของพื้นที่หน้าตัด (max 8%)
• <strong>เหล็กปลอก spacing</strong> ≤ 16d (db ของเหล็กยืน) หรือ 48×ขนาดปลอก หรือ b ของเสา
• <strong>Short column</strong> เมื่อ kLu/r ≤ 22`,
    ref: STRUCT_REF_BUILDING },

  { kw: ['พื้น','slab','ความหนา','two-way','one-way','two way','one way'],
    title: 'พื้น (Slab)',
    body: `• <strong>พื้นทางเดียว (One-Way)</strong>: t_min = L/20 (Ly/Lx > 2)
• <strong>พื้นสองทาง (Two-Way)</strong>: t_min = (Lx+Ly)/180 (Ly/Lx ≤ 2)
• <strong>เหล็กขั้นต่ำ</strong>: 0.18% ของหน้าตัด (≈ DB10@250 หรือ RB9@200)
• <strong>Spacing</strong> ≤ min(3t, 450 mm)
• <strong>Cover</strong>: 20 mm (พื้นปกติ)`,
    ref: STRUCT_REF_BUILDING },

  { kw: ['ฐานราก','footing','เสาเข็ม','pile','ดิน','foundation'],
    title: 'ฐานราก (Footing)',
    body: `• <strong>ความลึกขั้นต่ำ</strong> ≥ 1.0 m (จากระดับดินเดิม)
• <strong>กรุงเทพฯ ดินทั่วไป</strong>: q_allow ≈ 50–100 kN/m²
• <strong>ดินแข็ง</strong>: q_allow ≥ 200 kN/m²
• <strong>อาคาร ≥ 3 ชั้น หรือดินอ่อน</strong> → ใช้เสาเข็ม
• <strong>Cover คอนกรีต</strong>: 75 mm (สัมผัสดิน)
• <strong>ความหนาฐาน</strong>: ไม่น้อยกว่า 150 mm`,
    ref: STRUCT_REF_FOOTING },

  { kw: ['load','น้ำหนัก','live load','dead load','บรรทุก','live','dead'],
    title: 'น้ำหนักบรรทุก (Live Load)',
    body: `<strong>น้ำหนักบรรทุกจร (Live Load) ตามประเภทอาคาร:</strong>
• ที่พักอาศัย: <strong>200 kgf/m²</strong> (1.96 kN/m²)
• สำนักงาน: <strong>250 kgf/m²</strong> (2.45 kN/m²)
• ที่จอดรถ: <strong>400 kgf/m²</strong> (3.92 kN/m²)
• ห้องประชุม/ร้านอาหาร: <strong>400 kgf/m²</strong>
• โรงงาน/คลังสินค้า: <strong>500–1,000 kgf/m²</strong>
• บันได: <strong>300 kgf/m²</strong>
• หลังคา (เข้าได้): <strong>100 kgf/m²</strong>`,
    ref: STRUCT_REF_BUILDING },

  { kw: ['แผ่นดินไหว','seismic','earthquake','wind','ลม'],
    title: 'แผ่นดินไหว / แรงลม',
    body: `• <strong>แผ่นดินไหว</strong>: มาตรฐาน มยผ.1301/1302-61
• <strong>พื้นที่เสี่ยงสูง</strong>: ภาคเหนือ (เชียงราย/แม่ฮ่องสอน), ภาคตะวันตก (กาญจนบุรี)
• <strong>กรุงเทพฯ</strong>: ความเสี่ยงปานกลาง (เนื่องจากดินอ่อน → amplification)
• <strong>แรงลม</strong>: มาตรฐาน มยผ.1311-50
• <strong>อาคารสูง > 23 m</strong> ต้องตรวจสอบแรงลมโดยละเอียด`,
    ref: STRUCT_REF_SEISMIC + ' + มยผ.1311-50' },
];

function askQaQuick(q) { document.getElementById('qa_input').value = q; askStructQa(); }

function askStructQa() {
  const q = (document.getElementById('qa_input').value || '').trim().toLowerCase();
  if (!q) { toast('พิมพ์คำถามก่อน', 'error'); return; }
  // Find all entries with any keyword match
  const matches = STRUCT_QA.filter(e => e.kw.some(k => q.includes(k.toLowerCase())));
  let html;
  if (!matches.length) {
    html = `<h3>🤔 ยังหาคำตอบไม่เจอ</h3>
      <p style="color:var(--text2);font-size:13px;line-height:1.7">ลองใช้คำสำคัญ เช่น: <strong>คาน, เสา, พื้น, ฐานราก, load, แผ่นดินไหว</strong></p>
      <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  } else {
    html = `<h3>💬 คำตอบจากฐานความรู้</h3>` +
      matches.map(m => `
        <div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--accent)">
          <div style="font-weight:600;color:var(--accent);margin-bottom:6px">${m.title}</div>
          <div style="font-size:12.5px;line-height:1.8;white-space:pre-wrap">${m.body}</div>
          ${_refBadge(m.ref)}
        </div>`).join('') +
      `<div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  }
  _renderResult('qa_result', html);
}

function dashboardStructQuick(q) {
  const input = document.getElementById('dashboardQaInput');
  if (!input) return;
  input.value = q;
  askDashboardStruct();
}

function askDashboardStruct() {
  const input = document.getElementById('dashboardQaInput');
  const result = document.getElementById('dashboardQaResult');
  if (!input || !result) return;
  const q = (input.value || '').trim().toLowerCase();
  if (!q) { toast('พิมพ์คำถามก่อน', 'error'); return; }
  const matches = STRUCT_QA.filter(e => e.kw.some(k => q.includes(k.toLowerCase())));
  let html;
  if (!matches.length) {
    html = `<h3>🤔 ยังหาคำตอบไม่เจอ</h3>
      <p style="color:var(--text2);font-size:13px;line-height:1.7">ลองใช้คำสำคัญ เช่น <strong>คาน, เสา, พื้น, ฐานราก, load, แผ่นดินไหว</strong></p>
      <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  } else {
    html = `<h3>💬 Structural Assistant</h3>` +
      matches.map(m => `
        <div style="margin-top:10px;padding:10px;background:var(--surface2);border-radius:6px;border-left:3px solid var(--accent)">
          <div style="font-weight:600;color:var(--accent);margin-bottom:6px">${m.title}</div>
          <div style="font-size:12.5px;line-height:1.8;white-space:pre-wrap">${m.body}</div>
          ${_refBadge(m.ref)}
        </div>`).join('') +
      `<div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  }
  _renderResult('dashboardQaResult', html);
}


// Struct subtabs (dashboard)
function switchDashStruct(tab, btn) {
  document.querySelectorAll('#dashStructCard .dash-struct-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#dashStructSubtabs .struct-subtab').forEach(b => b.classList.remove('active'));
  const p = document.getElementById('dashStruct-' + tab);
  if (p) p.classList.add('active');
  if (btn) btn.classList.add('active');
}
function previewStructImg(input) {
  const preview = document.getElementById('structImgPreview');
  preview.innerHTML = '';
  const f = input.files && input.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image(); img.src = e.target.result; preview.appendChild(img);
    preview._dataUrl = e.target.result;
  };
  reader.readAsDataURL(f);
}
async function analyzeStructWithAI() {
  const text = (document.getElementById('structAiInput').value || '').trim();
  const preview = document.getElementById('structImgPreview');
  const imgDataUrl = preview && preview._dataUrl;
  if (!text && !imgDataUrl) { toast('กรุณาใส่รายละเอียดหรืออัปโหลดรูป', 'error'); return; }
  const loading = document.getElementById('loadingStructAi');
  loading.classList.add('show');
  const resultArea = document.getElementById('structAiResult');
  const target = document.getElementById('structAiResultText');
  resultArea.classList.remove('show'); target.innerHTML = '';
  try {
    let reply;
    const prov = settings.provider;
    if (imgDataUrl && prov === 'gemini') {
      reply = await _visionGemini(imgDataUrl, text);
    } else if (imgDataUrl && prov === 'anthropic') {
      reply = await _visionAnthropic(imgDataUrl, text);
    } else if (imgDataUrl && prov === 'openrouter') {
      reply = await _visionOpenRouter(imgDataUrl, text);
    } else {
      if (imgDataUrl) toast('⚠️ ' + (prov === 'groq' ? 'Groq' : 'Cerebras') + ' ไม่รองรับรูปภาพ — ส่งเฉพาะข้อความ', 'warn');
      const prompt = `วิเคราะห์โครงสร้างทางวิศวกรรมต่อไปนี้แบบมืออาชีพ (ACI / วสท.):\n${text || '(ไม่มีรายละเอียด)'}`;
      reply = await callAPI([{ role: 'user', content: prompt }]);
    }
    target.innerHTML = renderMarkdown(reply);
    resultArea.classList.add('show');
  } catch (err) {
    target.innerHTML = '❌ ' + escapeHtml(friendlyError(err));
    resultArea.classList.add('show');
  } finally {
    loading.classList.remove('show');
  }
}

const _STRUCT_SYSTEM = 'คุณเป็น AI วิศวกรโครงสร้างผู้เชี่ยวชาญ วิเคราะห์ตามมาตรฐาน ACI / วสท. แสดงขั้นตอนคำนวณ ตอบเป็นภาษาไทย';
const _STRUCT_PROMPT = (text) => `วิเคราะห์โครงสร้างทางวิศวกรรมในรูปภาพนี้แบบละเอียด${text ? ':\n' + text : ' — ระบุประเภทโครงสร้าง, แรงกระทำ, Reaction, ค่า Max Shear และ Max Moment'}`;

async function _visionGemini(dataUrl, text) {
  const key = settings.keys.gemini || '';
  if (!key) throw new Error('ไม่มี Gemini API Key — กรุณาตั้งค่าใน ⚙');
  const [header, b64] = dataUrl.split(',');
  const mimeType = header.match(/data:([^;]+)/)[1] || 'image/png';
  const model = settings.models.gemini || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: _STRUCT_PROMPT(text) }, { inlineData: { mimeType, data: b64 } }] }],
      systemInstruction: { parts: [{ text: _STRUCT_SYSTEM }] },
      generationConfig: { temperature: 0.4, maxOutputTokens: 4096 }
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Gemini vision error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function _visionAnthropic(dataUrl, text) {
  const key = settings.keys.anthropic || '';
  if (!key) throw new Error('ไม่มี Anthropic API Key — กรุณาตั้งค่าใน ⚙');
  const [header, b64] = dataUrl.split(',');
  const mediaType = (header.match(/data:([^;]+)/)[1] || 'image/png');
  const model = settings.models.anthropic || 'claude-sonnet-4-20250514';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({
      model, max_tokens: 4096, system: _STRUCT_SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
        { type: 'text', text: _STRUCT_PROMPT(text) }
      ]}]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic vision error');
  return data.content?.[0]?.text || '';
}

async function _visionOpenRouter(dataUrl, text) {
  const key = settings.keys.openrouter || '';
  if (!key) throw new Error('ไม่มี OpenRouter API Key — กรุณาตั้งค่าใน ⚙');
  const model = settings.models.openrouter || 'meta-llama/llama-3.2-90b-vision-instruct:free';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'HTTP-Referer': location.origin || 'https://crystal-ai.local', 'X-Title': 'Crystal AI' },
    body: JSON.stringify({
      model, max_tokens: 4096,
      messages: [
        { role: 'system', content: _STRUCT_SYSTEM },
        { role: 'user', content: [{ type: 'text', text: _STRUCT_PROMPT(text) }, { type: 'image_url', image_url: { url: dataUrl } }] }
      ]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || 'OpenRouter vision error');
  return data.choices?.[0]?.message?.content || '';
}


function openStructAssistant() {
  const card = document.getElementById('dashStructCard');
  const body = document.getElementById('toolModalBody');
  if (!card || !body) return;
  closeToolModalReturn();
  _activeToolPanel = { panel: card, parent: card.parentNode, next: card.nextSibling };
  body.appendChild(card);
  document.getElementById('toolModalTitle').textContent = 'Structural analysis AI Assistant';
  openModal('toolModal');
}


// ─── Beam type switcher ───
let _beamSpanCount = 1;
function switchBeamType(type, btn) {
  document.querySelectorAll('#beamTypeTabs .beam-ttab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.btype-panel').forEach(p => { p.style.display='none'; p.classList.remove('active'); });
  if (type === 's1') {
    _beamSpanCount = 1;
    const p = document.getElementById('btype-s1');
    p.style.display='block'; p.classList.add('active');
  } else {
    _beamSpanCount = parseInt(type.replace('c',''));
    const p = document.getElementById('btype-cont');
    p.style.display='block'; p.classList.add('active');
    _renderContSpanInputs(_beamSpanCount);
    document.getElementById('cb_result').innerHTML = '';
    document.getElementById('cb_diagrams').classList.remove('show');
  }
}

function _renderContSpanInputs(n) {
  const box = document.getElementById('cb_span_inputs');
  let html = `<div style="padding:8px 16px 4px;font-size:12px;color:var(--text2);font-weight:700">รายละเอียดแต่ละช่วงคาน</div>`;
  for (let i = 1; i <= n; i++) {
    html += `<div class="span-inputs-row">
      <span class="span-label">ช่วงที่ ${i}</span>
      <div class="field"><label>L${i} (m)</label><input id="cb_L${i}" type="number" value="4" step="0.5" min="0.5"></div>
      <div class="field"><label>w${i} (kN/m)</label><input id="cb_w${i}" type="number" value="20" step="1" min="0"></div>
    </div>`;
  }
  box.innerHTML = html;
}

function resetContBeam() {
  _renderContSpanInputs(_beamSpanCount);
  document.getElementById('cb_result').innerHTML = '';
  document.getElementById('cb_diagrams').classList.remove('show');
  const cvF = document.getElementById('cb_fbd');
  const cvS = document.getElementById('cb_sfd');
  const cvB = document.getElementById('cb_bmd');
  if (cvF) cvF.getContext('2d').clearRect(0,0,cvF.width,cvF.height);
  if (cvS) cvS.getContext('2d').clearRect(0,0,cvS.width,cvS.height);
  if (cvB) cvB.getContext('2d').clearRect(0,0,cvB.width,cvB.height);
}

// ─── Three-Moment Equation (Clapeyron) ───
// Returns support moments M[0..n] where M[0]=M[n]=0 (simply supported ends)
function _threeMonumentEq(spans) {
  const n = spans.length;
  if (n === 0) return [0];
  const M = new Array(n + 1).fill(0); // M[0]=M[n]=0
  if (n === 1) return M;

  // Build tridiagonal system for interior moments M[1]..M[n-1]
  const size = n - 1;
  const a = new Array(size).fill(0); // sub-diagonal
  const b2 = new Array(size).fill(0); // main diagonal
  const c = new Array(size).fill(0); // super-diagonal
  const d = new Array(size).fill(0); // RHS

  for (let i = 0; i < size; i++) {
    const k = i + 1; // interior support index
    const Lk_1 = spans[k-1].L; // span left of support k
    const Lk   = spans[k].L;   // span right of support k
    const wk_1 = spans[k-1].w;
    const wk   = spans[k].w;
    b2[i] = 2 * (Lk_1 + Lk);
    if (i > 0)      a[i] = Lk_1;
    if (i < size-1) c[i] = Lk;
    d[i] = -(wk_1 * Lk_1 * Lk_1 * Lk_1 + wk * Lk * Lk * Lk) / 4;
  }

  // Thomas algorithm (forward sweep + back substitution)
  const c2 = c.slice(); const d2 = d.slice();
  for (let i = 1; i < size; i++) {
    const m = a[i] / b2[i-1];
    b2[i] -= m * c2[i-1];
    d2[i] -= m * d2[i-1];
  }
  const x = new Array(size).fill(0);
  x[size-1] = d2[size-1] / b2[size-1];
  for (let i = size-2; i >= 0; i--) {
    x[i] = (d2[i] - c2[i] * x[i+1]) / b2[i];
  }
  for (let i = 0; i < size; i++) M[i+1] = x[i];
  return M; // M[0..n]
}

function calcContBeam() {
  const n = _beamSpanCount;
  const b = parseFloat(document.getElementById('cb_b').value) || 300;
  const h = parseFloat(document.getElementById('cb_h').value) || 500;
  const fc = parseFloat(document.getElementById('cb_fc').value) || 24;
  const fy = parseFloat(document.getElementById('cb_fy').value) || 400;
  const spans = [];
  for (let i = 1; i <= n; i++) {
    const L = parseFloat(document.getElementById('cb_L'+i).value);
    const w = parseFloat(document.getElementById('cb_w'+i).value);
    if (!L || !w || L <= 0 || w < 0) { toast('กรุณากรอกข้อมูล L และ w ให้ครบทุกช่วง', 'error'); return; }
    spans.push({ L, w });
  }

  const M = _threeMonumentEq(spans);
  const d = h - 40;
  const rho_min = Math.max(0.25 * Math.sqrt(fc) / fy, 1.4 / fy);

  // Reactions
  const R = new Array(n+1).fill(0);
  for (let k = 0; k < n; k++) {
    const { L, w } = spans[k];
    const Rleft  = w*L/2 + (M[k] - M[k+1])/L;
    const Rright = w*L/2 + (M[k+1] - M[k])/L;
    R[k] += Rleft; R[k+1] += Rright;
  }

  // ── เหล็กยืนล่าง — Bottom Steel (M⁺ กลางแต่ละช่วง) ──
  const botResults = spans.map(({ L, w }, k) => {
    const Rleft = w*L/2 + (M[k] - M[k+1])/L;
    const xp = Rleft / w;
    let Mpos = (xp > 0 && xp < L) ? M[k] + Rleft*xp - w*xp*xp/2 : 0;
    Mpos = Math.max(0, Mpos);
    const Ru = Mpos > 0 ? (Mpos * 1e6) / (b * d * d) : 0;
    const ins = 1 - 2*Ru/(0.85*fc);
    const rho = (Mpos > 0 && ins > 0) ? (0.85*fc/fy)*(1-Math.sqrt(ins)) : NaN;
    const rho_use = (isNaN(rho) || rho < rho_min) ? rho_min : rho;
    const As = rho_use * b * d;
    return { k, Mpos, Ru, As, bars: suggestBars(As, 6) };
  });

  // ── เหล็กยืนบน — Top Steel (M⁻ ที่จุดรองรับภายใน) ──
  const topResults = M.map((Mneg, i) => {
    const Mu = Math.max(0, -Mneg);
    const Ru = Mu > 0 ? (Mu * 1e6) / (b * d * d) : 0;
    const ins = 1 - 2*Ru/(0.85*fc);
    const rho = (Mu > 0 && ins > 0) ? (0.85*fc/fy)*(1-Math.sqrt(ins)) : NaN;
    const rho_use = (isNaN(rho) || rho < rho_min) ? rho_min : rho;
    const As = rho_use * b * d;
    return { i, Mneg, Mu, As, bars: suggestBars(As, 6) };
  });

  // ── เหล็กปลอก — Stirrups (จาก Vmax) ──
  const Vmax = Math.max(...R.map(Math.abs));
  const st = suggestStirrups(Vmax, b, d, fc);

  const secOK = botResults.every(s => s.Mpos === 0 || !isNaN(s.Ru))
             && topResults.filter(s => s.Mu > 0.01).every(s => s.Ru < 0.85*fc/2);

  const supportRow = M.map((m,i) =>
    `<div class="rr"><span class="lbl">M จุดรองรับ ${i} (${i===0||i===n?'ปลาย':'ภายใน'})</span><span class="val ${m < -0.01?'fail':''}">${m.toFixed(2)} kN·m</span></div>`).join('');
  const reactionRow = R.map((r,i) =>
    `<div class="rr"><span class="lbl">R จุดรองรับ ${i}</span><span class="val">${r.toFixed(2)} kN</span></div>`).join('');
  const botRows = botResults.map(s =>
    `<div class="rr"><span class="lbl">M⁺ ช่วงที่ ${s.k+1}</span><span class="val pass">${s.Mpos.toFixed(2)} kN·m</span></div>
     <div class="rr"><span class="lbl">แนะนำเหล็กล่าง ช่วงที่ ${s.k+1}</span><span class="val pass">${s.bars.count}-${s.bars.size} (As=${s.As.toFixed(0)} mm²)</span></div>`).join('');
  const topRows = topResults.filter(s => s.Mu > 0.01).map(s =>
    `<div class="rr"><span class="lbl">M⁻ จุดรองรับ ${s.i}</span><span class="val fail">${s.Mneg.toFixed(2)} kN·m</span></div>
     <div class="rr"><span class="lbl">แนะนำเหล็กบน จุด ${s.i}</span><span class="val">${s.bars.count}-${s.bars.size} (As=${s.As.toFixed(0)} mm²)</span></div>`).join('');

  const html = `
    <h3>📊 คานต่อเนื่อง ${n} ช่วง</h3>
    <div class="result-rows">
      ${supportRow}
      <div class="rr sep"></div>
      ${reactionRow}
      <div class="rr sep"></div>
      <div class="rr section-hd"><span>🔩 เหล็กยืนล่าง — Bottom Steel (M⁺ กลางช่วง)</span></div>
      ${botRows}
      <div class="rr section-hd"><span>🔩 เหล็กยืนบน — Top Steel (M⁻ จุดรองรับ)</span></div>
      ${topRows || `<div class="rr"><span class="lbl">ไม่มี M⁻</span><span class="val">ใช้ ρ_min ทุกจุด</span></div>`}
      <div class="rr section-hd"><span>🔗 เหล็กปลอก — Stirrups (RB, SR24, ออกแบบจาก Vmax)</span></div>
      <div class="rr"><span class="lbl">Vmax</span><span class="val">${Vmax.toFixed(2)} kN</span></div>
      <div class="rr"><span class="lbl">Vc / φVc</span><span class="val">${_fmt(st.Vc,2)} / ${_fmt(st.phiVc,2)} kN</span></div>
      <div class="rr"><span class="lbl">Vs required</span><span class="val">${_fmt(st.Vs_req,2)} kN</span></div>
      <div class="rr"><span class="lbl">แนะนำเหล็กปลอก</span><span class="val pass">${st.type}@${st.s} mm (2 ขา, Av=${_fmt(st.Av,1)} mm²)</span></div>
    </div>
    ${_verdict(secOK, 'หน้าตัดผ่าน ACI', 'หน้าตัดเล็กไป — ขยาย b หรือ h')}
    ${_refBadge(STRUCT_REF_BUILDING)}
    <div class="struct-disclaimer">${STRUCT_DISCLAIMER}</div>`;
  _renderResult('cb_result', html, `Cont.Beam ${n} spans`);

  // Draw FBD + SFD + BMD
  try {
    _drawContBeamFBD(document.getElementById('cb_fbd'), spans, M, R);
    _drawContBeamSFD(document.getElementById('cb_sfd'), spans, M, R);
    _drawContBeamBMD(document.getElementById('cb_bmd'), spans, M, R);
    document.getElementById('cb_diagrams').classList.add('show');
  } catch(e) { console.error('cont beam diagram error', e); }
  _trackStructCalc('cont_beam', `คานต่อเนื่อง ${n} ช่วง ${b}×${h}mm`, `n=${n}, b=${b}, h=${h}, fc=${fc}, fy=${fy}`);
}

function _drawContBeamFBD(canvas, spans, M, R) {
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const n = spans.length;
  const totalL = spans.reduce((s, sp) => s + sp.L, 0);
  const PAD = { l: 40, r: 40, t: 20, b: 50 };
  const PW = W - PAD.l - PAD.r;
  const beamY = PAD.t + 70; // beam centerline y

  // helper: global x → canvas x
  const cx = xG => PAD.l + (xG / totalL) * PW;

  // accumulate span starts
  const starts = [0];
  spans.forEach(sp => starts.push(starts[starts.length - 1] + sp.L));

  // ── UDL blocks per span ──
  spans.forEach((sp, k) => {
    const x1 = cx(starts[k]), x2 = cx(starts[k + 1]);
    const udlH = 36;
    ctx.fillStyle = 'rgba(16,185,129,0.15)';
    ctx.fillRect(x1, beamY - 8 - udlH, x2 - x1, udlH);
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1;
    ctx.strokeRect(x1, beamY - 8 - udlH, x2 - x1, udlH);
    // downward arrows inside UDL
    ctx.fillStyle = '#10b981';
    const step = Math.max(18, (x2 - x1) / 7);
    for (let xi = x1 + 10; xi < x2 - 6; xi += step) {
      ctx.beginPath();
      ctx.moveTo(xi, beamY - 8); ctx.lineTo(xi - 4, beamY - 16); ctx.lineTo(xi + 4, beamY - 16);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(xi, beamY - 16); ctx.lineTo(xi, beamY - 8 - udlH + 2);
      ctx.stroke();
    }
    // w label above block
    ctx.font = '10px IBM Plex Mono'; ctx.fillStyle = '#10b981'; ctx.textAlign = 'center';
    ctx.fillText(`w${k+1}=${sp.w} kN/m`, (x1+x2)/2, beamY - 8 - udlH - 4);
  });

  // ── Beam body ──
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(PAD.l, beamY - 8, PW, 16);
  ctx.strokeStyle = '#d97706'; ctx.lineWidth = 1.5;
  ctx.strokeRect(PAD.l, beamY - 8, PW, 16);

  // ── Span length dimension lines ──
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  spans.forEach((sp, k) => {
    const x1 = cx(starts[k]), x2 = cx(starts[k+1]);
    const dimY = beamY + 28;
    ctx.beginPath(); ctx.moveTo(x1, dimY); ctx.lineTo(x2, dimY); ctx.stroke();
    // tick marks
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(x1, dimY-4); ctx.lineTo(x1, dimY+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x2, dimY-4); ctx.lineTo(x2, dimY+4); ctx.stroke();
    ctx.setLineDash([3,3]);
    ctx.fillStyle = '#9ca3af'; ctx.font = '10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(`L${k+1}=${sp.L}m`, (x1+x2)/2, dimY + 12);
  });
  ctx.setLineDash([]);

  // ── Supports & reactions ──
  R.forEach((r, i) => {
    const xG = starts[i];
    const xC = cx(xG);
    // support symbol (pin for all in continuous beam)
    ctx.strokeStyle = '#9ca3af'; ctx.fillStyle = '#2a3f5f'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(xC, beamY + 8); ctx.lineTo(xC - 10, beamY + 24); ctx.lineTo(xC + 10, beamY + 24);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // hatch
    ctx.strokeStyle = '#6b7280'; ctx.lineWidth = 1;
    for (let d = -12; d <= 12; d += 5) {
      ctx.beginPath(); ctx.moveTo(xC + d, beamY + 24); ctx.lineTo(xC + d - 3, beamY + 29); ctx.stroke();
    }
    // reaction arrow (upward)
    const arrowH = 38;
    ctx.strokeStyle = '#ef4444'; ctx.fillStyle = '#ef4444'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(xC, beamY + 24 + arrowH); ctx.lineTo(xC, beamY + 24 + 4); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xC, beamY + 8); ctx.lineTo(xC - 5, beamY + 16); ctx.lineTo(xC + 5, beamY + 16);
    ctx.closePath(); ctx.fill();
    // reaction value label
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 10px IBM Plex Mono'; ctx.textAlign = 'center';
    ctx.fillText(`R${i}=${r.toFixed(1)}`, xC, beamY + 24 + arrowH + 11);
  });

  // ── Title ──
  ctx.fillStyle = '#9ca3af'; ctx.font = 'bold 11px Sarabun'; ctx.textAlign = 'left';
  ctx.fillText(`FBD — คานต่อเนื่อง ${n} ช่วง`, PAD.l, PAD.t + 10);
}

function _drawContBeamDiagram(canvas, spans, getY, label, colorPos, colorNeg) {
  if (!canvas) return;
  const W = canvas.width, H = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const STEPS = 40;
  const pts = [];
  const totalL = spans.reduce((s,sp)=>s+sp.L, 0);
  let xOff = 0;
  spans.forEach((sp, k) => {
    for (let i = 0; i <= STEPS; i++) {
      const t = i / STEPS;
      const xLocal = t * sp.L;
      const xGlobal = xOff + xLocal;
      pts.push({ x: xGlobal, y: getY(sp, k, xLocal) });
    }
    xOff += sp.L;
  });

  const maxY = Math.max(...pts.map(p=>Math.abs(p.y)));
  if (maxY === 0) return;

  const PAD = { l:40, r:16, t:20, b:30 };
  const PW = W - PAD.l - PAD.r, PH = H - PAD.t - PAD.b;
  const toX = gx => PAD.l + (gx / totalL) * PW;
  const toY = v  => PAD.t + PH/2 - (v / maxY) * (PH/2 * 0.85);

  ctx.fillStyle = '#0a0f18'; ctx.fillRect(0,0,W,H);

  // zero line
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
  ctx.beginPath(); ctx.moveTo(PAD.l, toY(0)); ctx.lineTo(W-PAD.r, toY(0)); ctx.stroke();
  ctx.setLineDash([]);

  // support verticals
  let xOff2 = 0;
  spans.forEach((sp, k) => {
    if (k === 0) {
      ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(toX(0),PAD.t); ctx.lineTo(toX(0),H-PAD.b); ctx.stroke();
    }
    xOff2 += sp.L;
    ctx.beginPath(); ctx.moveTo(toX(xOff2),PAD.t); ctx.lineTo(toX(xOff2),H-PAD.b); ctx.stroke();
  });

  // fill area
  ctx.beginPath();
  ctx.moveTo(toX(pts[0].x), toY(0));
  pts.forEach(p => ctx.lineTo(toX(p.x), toY(p.y)));
  ctx.lineTo(toX(pts[pts.length-1].x), toY(0));
  ctx.closePath();
  ctx.fillStyle = 'rgba(96,165,250,0.15)'; ctx.fill();

  // line
  ctx.beginPath();
  pts.forEach((p,i) => i===0 ? ctx.moveTo(toX(p.x),toY(p.y)) : ctx.lineTo(toX(p.x),toY(p.y)));
  ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 2; ctx.stroke();

  // max label
  const maxPt = pts.reduce((a,b)=>Math.abs(b.y)>Math.abs(a.y)?b:a);
  ctx.fillStyle='#fff'; ctx.font='bold 11px sans-serif'; ctx.textAlign='center';
  ctx.fillText(maxPt.y.toFixed(1), toX(maxPt.x), toY(maxPt.y) - 6);

  // axis label
  ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.font='10px sans-serif'; ctx.textAlign='left';
  ctx.fillText(label, PAD.l, PAD.t - 4);
}

function _drawContBeamSFD(canvas, spans, M, R) {
  _drawContBeamDiagram(canvas, spans, (sp, k, xLocal) => {
    const Mk = M[k], Mk1 = M[k+1];
    const Rl = sp.w*sp.L/2 + (Mk - Mk1)/sp.L;
    return Rl - sp.w * xLocal; // V(x)
  }, 'V (kN)', '#60a5fa', '#f87171');
}

function _drawContBeamBMD(canvas, spans, M, R) {
  _drawContBeamDiagram(canvas, spans, (sp, k, xLocal) => {
    const Mk = M[k], Mk1 = M[k+1];
    const Rl = sp.w*sp.L/2 + (Mk - Mk1)/sp.L;
    return Mk + Rl*xLocal - sp.w*xLocal*xLocal/2; // M(x)
  }, 'M (kN·m)', '#34d399', '#f59e0b');
}
