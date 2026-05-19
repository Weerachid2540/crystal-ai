'use strict';
// ============================================================
// Crystal AI — export-weekly.js  (Phase-4J-2 extraction)
// Weekly Report Export: Excel (ExcelJS) + PDF (jsPDF)
// Depends on: utils.js (requireProjectContext),
//             toast.js (toast),
//             i18n.js (currentLang — indirect, via toast)
// Runtime deps (resolved at call time, all global):
//   collectWeeklyData() — declared in this file
//   wkAct, wkIssue, wkNext, wkTargets — report-tables.js
//   wkPhotos — photos.js
//   _sigStorageKey — signatures.js
//   currentProjectId, currentProjectMeta — inline script
//   requireProjectContext — utils.js
//   window.ExcelJS, window.saveAs — CDN (ExcelJS, FileSaver)
//   window.jspdf — CDN (jsPDF + autoTable)
// ห้ามเรียก export function ตอน file load — resolved at user action only
// ============================================================

// --- Collect ALL weekly data for export ---
function collectWeeklyData() {
  const v = (id) => document.getElementById(id)?.value || '';
  return {
    project_id: currentProjectId || '',
    projectCode: v('wk_proj_code') || (currentProjectMeta?.code || ''),
    projectName: v('wk_proj') || (currentProjectMeta?.name || ''),
    location: currentProjectMeta?.location || '',
    reportNo: v('wk_no'),
    department: v('wk_dept'),
    workType: v('wk_worktype'),
    workDesc: v('wk_workdesc'),
    issueDate: v('wk_issue_date'),
    periodFrom: v('wk_from'),
    periodTo: v('wk_to'),
    reporter: v('wk_reporter'),
    codedBy: (v('wk_codedby') || '').toUpperCase(),
    approver: v('wk_approver'),
    approverSignName: v('sigWkApprover_name'),
    planPct: v('wk_plan_pct'),
    actualPct: v('wk_actual_pct'),
    section1: (typeof wkAct !== 'undefined' ? wkAct : []),
    section2: (typeof wkIssue !== 'undefined' ? wkIssue : []),
    section3: (typeof wkNext !== 'undefined' ? wkNext : []),
    section4: (typeof wkTargets !== 'undefined' ? wkTargets : []),
    photos: wkPhotos.slice(),
    signatureDataUrl: (function() {
      try { return localStorage.getItem(_sigStorageKey('sigWkApprover')) || ''; } catch (e) { return ''; }
    })(),
    logoDataUrl: (function() {
      const el = document.querySelector('.sidebar-logo-img');
      return el ? el.src : '';
    })(),
  };
}

// --- Date helpers ---
function fmtDDMonYY(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
  return String(d.getDate()).padStart(2,'0') + '/' + mo + '/' + String(d.getFullYear()).slice(-2);
}
function fmtDueText(s) {
  if (!s) return '-';
  // Treat string starting with digits + '-' as ISO; otherwise pass through (e.g. "Delayed")
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fmtDDMonYY(s);
  return s;
}
function progressToPct(p) {
  if (p == null || p === '') return '';
  const n = parseFloat(p);
  if (isNaN(n)) return p;
  return (n > 1 ? n : n * 100).toFixed(0) + '%';
}

// =================================================================
// EXCEL EXPORT — pixel-perfect to W2 reference (ExcelJS)
// =================================================================
async function exportWeeklyExcel() {
  if (!requireProjectContext('Weekly Report Export')) return;
  const btn = document.getElementById('wkExcelBtn');
  btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = '⏳ กำลังสร้าง .xlsx...';
  try {
    if (!window.ExcelJS) throw new Error('ExcelJS ยังโหลดไม่เสร็จ ลองอีกครั้ง');
    const data = collectWeeklyData();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Crystal AI'; wb.created = new Date();
    const ws = wb.addWorksheet('Weekly Report', {
      pageSetup: {
        paperSize: 9, orientation: 'portrait', scale: 94,
        horizontalCentered: true, verticalCentered: false,
        margins: { left: 0.236, right: 0.236, top: 0.354, bottom: 0.354, header: 0.315, footer: 0.315 }
      }
    });

    // Column widths (matches reference exactly)
    const colWidths = [5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,5.7,12.9,5.7,5.7,5.7,5.7,5.7,5.7]; // A..P
    colWidths.forEach((w, i) => ws.getColumn(i+1).width = w);

    // ---- Reusable styles ----
    const BORDER_ALL = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    const FONT_BASE = { name: 'TH Sarabun New', size: 11 };
    const FONT_TITLE = { name: 'TH Sarabun New', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    const FONT_REPORT_NO = { name: 'TH Sarabun New', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    const FONT_SECTION_HEAD = { name: 'TH Sarabun New', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    const FILL_TITLE = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF1F4E79' } };
    const FILL_SECTION = { type:'pattern', pattern:'solid', fgColor:{ argb:'FF305496' } };
    const FILL_HEADER_INFO = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFDCE6F1' } };
    const FILL_TABLE_HEAD = { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFCE4D6' } };
    const CENTER = { vertical:'middle', horizontal:'center', wrapText: true };
    const LEFT_M = { vertical:'middle', horizontal:'left', wrapText: true };

    // Helper: merge + set value + style
    const setMerged = (range, value, opts={}) => {
      ws.mergeCells(range);
      const c = ws.getCell(range.split(':')[0]);
      c.value = value;
      if (opts.font) c.font = opts.font;
      if (opts.fill) c.fill = opts.fill;
      if (opts.alignment) c.alignment = opts.alignment;
      if (opts.border) c.border = opts.border;
      if (opts.numFmt) c.numFmt = opts.numFmt;
      return c;
    };
    const setCell = (addr, value, opts={}) => {
      const c = ws.getCell(addr);
      c.value = value;
      if (opts.font) c.font = opts.font;
      if (opts.fill) c.fill = opts.fill;
      if (opts.alignment) c.alignment = opts.alignment;
      if (opts.border) c.border = opts.border;
      if (opts.numFmt) c.numFmt = opts.numFmt;
      return c;
    };
    const applyBorderToRange = (range) => {
      const [start, end] = range.split(':');
      const m = (a) => { const x = a.match(/^([A-Z]+)(\d+)$/); return { c: x[1], r: +x[2] }; };
      const a = m(start), b = m(end);
      const colToNum = (s) => { let n=0; for (const ch of s) n = n*26 + (ch.charCodeAt(0)-64); return n; };
      const numToCol = (n) => { let s=''; while(n>0){ const r=(n-1)%26; s=String.fromCharCode(65+r)+s; n=(n-r-1)/26; } return s; };
      const c1 = colToNum(a.c), c2 = colToNum(b.c);
      for (let r = a.r; r <= b.r; r++) {
        for (let c = c1; c <= c2; c++) {
          ws.getCell(numToCol(c) + r).border = BORDER_ALL;
        }
      }
    };

    // ---- Embed logo & signature ----
    let logoImgId = null, signImgId = null;
    if (data.logoDataUrl && data.logoDataUrl.startsWith('data:image')) {
      const ext = (data.logoDataUrl.match(/data:image\/(jpeg|jpg|png|gif)/i) || [,'png'])[1].toLowerCase();
      logoImgId = wb.addImage({ base64: data.logoDataUrl, extension: ext === 'jpg' ? 'jpeg' : ext });
    }
    if (data.signatureDataUrl && data.signatureDataUrl.startsWith('data:image')) {
      const ext = (data.signatureDataUrl.match(/data:image\/(jpeg|jpg|png|gif)/i) || [,'png'])[1].toLowerCase();
      signImgId = wb.addImage({ base64: data.signatureDataUrl, extension: ext === 'jpg' ? 'jpeg' : ext });
    }

    // =================== PAGE 1: ACTIVITY SUMMARY (rows 1-55) ===================
    const buildPage1Header = (rOffset, includeSignature) => {
      // r1: Project title
      setMerged(`A${rOffset+1}:P${rOffset+1}`,
        `${data.projectCode || ''} : ${data.projectName || ''}${data.location ? ' @' + data.location : ''}`,
        { font: FONT_TITLE, fill: FILL_TITLE, alignment: CENTER });
      ws.getRow(rOffset+1).height = 22;
      // r2: Report No
      setMerged(`A${rOffset+2}:P${rOffset+2}`,
        `WEEKLY REPORT NO. ${data.reportNo || '—'}`,
        { font: FONT_REPORT_NO, fill: FILL_TITLE, alignment: CENTER });
      ws.getRow(rOffset+2).height = 20;
      // r4-6: info table
      // r4: Issue Date | Department
      setCell(`C${rOffset+4}`, 'Report Issue Date', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${rOffset+4}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${rOffset+4}:F${rOffset+4}`, fmtDDMonYY(data.issueDate), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${rOffset+4}`, 'Department', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${rOffset+4}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${rOffset+4}:P${rOffset+4}`, data.department || '', { font: FONT_BASE, alignment: LEFT_M });
      // r5: Period | Reporter
      setCell(`C${rOffset+5}`, 'Period of Report', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${rOffset+5}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${rOffset+5}:F${rOffset+5}`, fmtDDMonYY(data.periodFrom), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`G${rOffset+5}`, 'to', { font: FONT_BASE, alignment: CENTER });
      setMerged(`H${rOffset+5}:I${rOffset+5}`, fmtDDMonYY(data.periodTo), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${rOffset+5}`, 'Reported by', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${rOffset+5}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${rOffset+5}:P${rOffset+5}`, data.reporter || '', { font: FONT_BASE, alignment: LEFT_M });
      // r6: Work Type | Coded by
      setCell(`C${rOffset+6}`, 'Work Type', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${rOffset+6}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${rOffset+6}:K${rOffset+6}`, data.workDesc || data.workType || '', { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${rOffset+6}`, 'Coded by', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${rOffset+6}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${rOffset+6}:P${rOffset+6}`, data.codedBy || '', { font: FONT_BASE, alignment: LEFT_M });
      applyBorderToRange(`C${rOffset+4}:P${rOffset+6}`);
    };
    buildPage1Header(0, true);

    // ---- Section 1 header row (r8) ----
    setMerged('A8:I8', '1. This Week Activities', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: LEFT_M });
    setMerged('J8:J8', '', { fill: FILL_SECTION });
    setMerged('K8:L8', 'Progress', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('M8:N8', 'Status Issue', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('O8:P8', 'Due Date', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    applyBorderToRange('A8:P8');
    // Section 1 rows: r9-18 (max 10)
    let r = 9;
    data.section1.slice(0, 10).forEach((row, i) => {
      setCell(`A${r}`, (i+1) + '.', { font: FONT_BASE, alignment: CENTER });
      setMerged(`B${r}:J${r}`, row.desc || '', { font: FONT_BASE, alignment: LEFT_M });
      setMerged(`K${r}:L${r}`, progressToPct(row.progress), { font: FONT_BASE, alignment: CENTER });
      setMerged(`M${r}:N${r}`, fmtDueText(row.statusIssue), { font: FONT_BASE, alignment: CENTER });
      setMerged(`O${r}:P${r}`, fmtDueText(row.dueDate), { font: FONT_BASE, alignment: CENTER });
      r++;
    });
    // Pad to r18
    while (r <= 18) {
      ws.mergeCells(`B${r}:J${r}`); ws.mergeCells(`K${r}:L${r}`); ws.mergeCells(`M${r}:N${r}`); ws.mergeCells(`O${r}:P${r}`);
      r++;
    }
    applyBorderToRange('A9:P18');

    // ---- Section 2 header (r19) ----
    setMerged('A19:J19', '2. Major issues and Outstanding this week', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: LEFT_M });
    setMerged('K19:M19', 'ACTION BY', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('N19:P19', 'Due Date', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    applyBorderToRange('A19:P19');
    r = 20;
    data.section2.slice(0, 6).forEach((row, i) => {
      setCell(`A${r}`, (i+1) + '.', { font: FONT_BASE, alignment: CENTER });
      setMerged(`B${r}:J${r}`, row.issue || '', { font: FONT_BASE, alignment: LEFT_M });
      setMerged(`K${r}:M${r}`, row.actionBy || '', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${r}:P${r}`, fmtDueText(row.dueDate), { font: FONT_BASE, alignment: CENTER });
      r++;
    });
    while (r <= 25) {
      ws.mergeCells(`B${r}:J${r}`); ws.mergeCells(`K${r}:M${r}`); ws.mergeCells(`N${r}:P${r}`);
      r++;
    }
    applyBorderToRange('A20:P25');

    // ---- Section 3 header (r26) ----
    setMerged('A26:I26', '3. Next Week Activities', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: LEFT_M });
    setMerged('J26:J26', 'Plan use Mhr', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('K26:L26', 'Progress', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('M26:N26', 'Status Issue', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('O26:P26', 'Due Date', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    applyBorderToRange('A26:P26');
    r = 27;
    data.section3.slice(0, 10).forEach((row, i) => {
      setCell(`A${r}`, (i+1) + '.', { font: FONT_BASE, alignment: CENTER });
      setMerged(`B${r}:I${r}`, row.desc || '', { font: FONT_BASE, alignment: LEFT_M });
      setCell(`J${r}`, row.used || '', { font: FONT_BASE, alignment: CENTER });
      setMerged(`K${r}:L${r}`, progressToPct(row.progress), { font: FONT_BASE, alignment: CENTER });
      setMerged(`M${r}:N${r}`, fmtDueText(row.statusIssue), { font: FONT_BASE, alignment: CENTER });
      setMerged(`O${r}:P${r}`, fmtDueText(row.dueDate), { font: FONT_BASE, alignment: CENTER });
      r++;
    });
    while (r <= 36) {
      ws.mergeCells(`B${r}:I${r}`); ws.mergeCells(`K${r}:L${r}`); ws.mergeCells(`M${r}:N${r}`); ws.mergeCells(`O${r}:P${r}`);
      r++;
    }
    applyBorderToRange('A27:P36');

    // ---- Section 4 header (r37) ----
    setMerged('A37:J37', '4. Current Important Targets', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: LEFT_M });
    setMerged('K37:M37', 'Status Issue', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    setMerged('N37:P37', 'Due Date', { font: FONT_SECTION_HEAD, fill: FILL_SECTION, alignment: CENTER });
    applyBorderToRange('A37:P37');
    r = 38;
    data.section4.slice(0, 7).forEach((row, i) => {
      setCell(`A${r}`, (i+1) + '.', { font: FONT_BASE, alignment: CENTER });
      setMerged(`B${r}:J${r}`, row.target || '', { font: FONT_BASE, alignment: LEFT_M });
      setMerged(`K${r}:M${r}`, fmtDueText(row.statusIssue), { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${r}:P${r}`, fmtDueText(row.dueDate), { font: FONT_BASE, alignment: CENTER });
      r++;
    });
    while (r <= 44) {
      ws.mergeCells(`B${r}:J${r}`); ws.mergeCells(`K${r}:M${r}`); ws.mergeCells(`N${r}:P${r}`);
      r++;
    }
    applyBorderToRange('A38:P44');

    // ---- Attachments + Approved by (r45-51) ----
    setMerged('A45:I45', 'File Attachment :', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
    setMerged('L45:P45', 'Approved by', { font:{...FONT_BASE,bold:true}, alignment: CENTER });
    ['1.', '2.', '3.'].forEach((n, i) => {
      setCell(`A${46+i}`, n, { font: FONT_BASE, alignment: LEFT_M });
      setMerged(`B${46+i}:I${46+i}`, '', { font: FONT_BASE, alignment: LEFT_M });
    });
    // Signature image
    if (signImgId !== null) {
      // Anchor signature to roughly L46:P50 area
      ws.addImage(signImgId, {
        tl: { col: 11.3, row: 45.2 },   // L46 area
        ext: { width: 170, height: 75 }
      });
    }
    setMerged('L50:P50', data.approverSignName || data.approver || '', { font: FONT_BASE, alignment: CENTER });
    setMerged('L51:P51', '(Civil Engineer)', { font:{...FONT_BASE,italic:true,color:{argb:'FF555555'}}, alignment: CENTER });

    // ---- Page footer (r55) ----
    setMerged('A55:C55', 'EPC TURNKEY', { font:{...FONT_BASE,bold:true,color:{argb:'FF1F4E79'}}, alignment: LEFT_M });
    setMerged('N55:P55', 'PRIVILEGE SERVICE', { font:{...FONT_BASE,bold:true,color:{argb:'FF1F4E79'}}, alignment: { vertical:'middle', horizontal:'right' } });

    // Logo on page 1 (small, top-right area)
    if (logoImgId !== null) {
      ws.addImage(logoImgId, { tl: { col: 13.5, row: 0.1 }, ext: { width: 50, height: 50 } });
    }

    // Force row heights for table rows (matches reference spacing)
    [1,2].forEach(rn => ws.getRow(rn).height = ws.getRow(rn).height || 20);
    for (let rn = 9; rn <= 18; rn++) ws.getRow(rn).height = 15;
    for (let rn = 20; rn <= 25; rn++) ws.getRow(rn).height = 15;
    for (let rn = 27; rn <= 36; rn++) ws.getRow(rn).height = 15;
    for (let rn = 38; rn <= 44; rn++) ws.getRow(rn).height = 15;

    // =================== PHOTO PAGES ===================
    // FIXED v5.1: 4 photos per page and separate Detailed Activities column — FEAT-6
    // 4 photos per page; each photo block = 11 rows
    // Page N starts at row 57 + (N-2)*57  for N=2,3,4,...
    const photos = data.photos;
    const PHOTOS_PER_PAGE = 4;
    const PAGE_HEIGHT = 57;     // rows per photo page
    const PHOTO_BLOCK_HEIGHT = 11;
    const numPhotoPages = Math.ceil(photos.length / PHOTOS_PER_PAGE);

    for (let pi = 0; pi < numPhotoPages; pi++) {
      const pageBaseRow = 57 + pi * PAGE_HEIGHT;  // 57, 114, 171, ...
      // Page break before this page
      ws.getRow(pageBaseRow).addPageBreak = true;
      // Header for this photo page (rows pageBaseRow..pageBaseRow+5)
      // r57+: Project title + Report no + info block (same as page 1 minus signature)
      // Adjust buildPage1Header to put it at this offset (note: pageBaseRow corresponds to "r1" of the page)
      const ofs = pageBaseRow - 1;
      // Title
      setMerged(`A${ofs+1}:P${ofs+1}`,
        `${data.projectCode || ''} : ${data.projectName || ''}${data.location ? ' @' + data.location : ''}`,
        { font: FONT_TITLE, fill: FILL_TITLE, alignment: CENTER });
      ws.getRow(ofs+1).height = 22;
      setMerged(`A${ofs+2}:P${ofs+2}`,
        `WEEKLY REPORT NO. ${data.reportNo || '—'}`,
        { font: FONT_REPORT_NO, fill: FILL_TITLE, alignment: CENTER });
      ws.getRow(ofs+2).height = 20;
      // Info (rows ofs+4..ofs+6)
      setCell(`C${ofs+4}`, 'Report Issue Date', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${ofs+4}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${ofs+4}:F${ofs+4}`, fmtDDMonYY(data.issueDate), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${ofs+4}`, 'Department', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${ofs+4}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${ofs+4}:P${ofs+4}`, data.department || '', { font: FONT_BASE, alignment: LEFT_M });
      setCell(`C${ofs+5}`, 'Period of Report', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${ofs+5}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${ofs+5}:F${ofs+5}`, fmtDDMonYY(data.periodFrom), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`G${ofs+5}`, 'to', { font: FONT_BASE, alignment: CENTER });
      setMerged(`H${ofs+5}:I${ofs+5}`, fmtDDMonYY(data.periodTo), { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${ofs+5}`, 'Reported by', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${ofs+5}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${ofs+5}:P${ofs+5}`, data.reporter || '', { font: FONT_BASE, alignment: LEFT_M });
      setCell(`C${ofs+6}`, 'Work Type', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`D${ofs+6}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`E${ofs+6}:K${ofs+6}`, data.workDesc || data.workType || '', { font: FONT_BASE, alignment: LEFT_M });
      setCell(`L${ofs+6}`, 'Coded by', { font:{...FONT_BASE,bold:true}, alignment: LEFT_M });
      setCell(`M${ofs+6}`, ':', { font: FONT_BASE, alignment: CENTER });
      setMerged(`N${ofs+6}:P${ofs+6}`, data.codedBy || '', { font: FONT_BASE, alignment: LEFT_M });
      applyBorderToRange(`C${ofs+4}:P${ofs+6}`);

      // Photo table header (ofs+8)
      const thRow = ofs + 8;
      setMerged(`A${thRow}:B${thRow}`, 'Item No.', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      setMerged(`C${thRow}:H${thRow}`, 'Figures (Photo)', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      setMerged(`I${thRow}:J${thRow}`, 'Detailed Activities', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      setMerged(`K${thRow}:L${thRow}`, 'Work Description', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      setMerged(`M${thRow}:N${thRow}`, 'Gridline', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      setMerged(`O${thRow}:P${thRow}`, 'Remark', { font: FONT_SECTION_HEAD, fill: FILL_TABLE_HEAD, alignment: CENTER });
      // Make table head font dark on light bg
      ['A','C','I','K','M','O'].forEach(letter => {
        const c = ws.getCell(letter+thRow);
        c.font = { ...FONT_BASE, bold: true, color: { argb: 'FF000000' } };
        c.fill = FILL_TABLE_HEAD;
      });
      applyBorderToRange(`A${thRow}:P${thRow}`);

      // Photo rows: blocks of 11 rows starting at thRow+1 (= ofs+9)
      const reportNoClean = (data.reportNo || 'W').match(/W-?(\d+)/i)?.[1] || (pi+1);
      const photoStartIdx = pi * PHOTOS_PER_PAGE;
      for (let i = 0; i < PHOTOS_PER_PAGE; i++) {
        const photo = photos[photoStartIdx + i];
        const blockRow = thRow + 1 + i * PHOTO_BLOCK_HEIGHT;  // 9, 18, 27, 36, 45
        const blockEnd = blockRow + PHOTO_BLOCK_HEIGHT - 1;
        const itemNo = `W${String(reportNoClean).padStart(2,'0')}-${photoStartIdx + i + 1}`;

        // Merges per block
        setMerged(`A${blockRow}:B${blockEnd}`, photo ? itemNo : '', { font: {...FONT_BASE, bold: true}, alignment: CENTER });
        setMerged(`C${blockRow}:H${blockEnd}`, '', { fill: { type:'pattern', pattern:'solid', fgColor:{ argb:'FFFAFAFA' } }, alignment: CENTER });
        setMerged(`I${blockRow}:J${blockEnd}`, photo?.activities || '', { font: FONT_BASE, alignment: CENTER });
        setMerged(`K${blockRow}:L${blockEnd}`, photo?.workDesc || '', { font: FONT_BASE, alignment: CENTER });
        setMerged(`M${blockRow}:N${blockEnd}`, photo?.gridline || '', { font: FONT_BASE, alignment: CENTER });
        setMerged(`O${blockRow}:P${blockEnd}`, photo?.remark || '', { font: FONT_BASE, alignment: CENTER });

        // Embed photo in C:I area
        if (photo) {
          try {
            const ext = (photo.dataUrl.match(/data:image\/(jpeg|jpg|png|gif)/i) || [,'jpeg'])[1].toLowerCase();
            const imgId = wb.addImage({ base64: photo.dataUrl, extension: ext === 'jpg' ? 'jpeg' : ext });
            ws.addImage(imgId, {
              tl: { col: 2.1, row: blockRow - 1 + 0.1 },
              br: { col: 8, row: blockEnd - 1 + 0.95 },
              editAs: 'oneCell'
            });
          } catch(e) { console.warn('photo embed failed', e); }
        }

        applyBorderToRange(`A${blockRow}:P${blockEnd}`);

        // Row heights so each page fits 4 photo rows plus header/footer.
        for (let rh = blockRow; rh <= blockEnd; rh++) {
          ws.getRow(rh).height = 14;
        }
      }
      // Footer (ofs+57? actually within page)
      setMerged(`A${ofs+57}:C${ofs+57}`, 'EPC TURNKEY', { font:{...FONT_BASE,bold:true,color:{argb:'FF1F4E79'}}, alignment: LEFT_M });
      setMerged(`N${ofs+57}:P${ofs+57}`, 'PRIVILEGE SERVICE', { font:{...FONT_BASE,bold:true,color:{argb:'FF1F4E79'}}, alignment: { vertical:'middle', horizontal:'right' } });
    }

    // Generate file
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = ((data.projectCode || 'Weekly') + '_' + (data.reportNo || 'Report')).replace(/[^A-Za-z0-9_-]/g, '_');
    if (window.saveAs) window.saveAs(blob, safeName + '.xlsx');
    else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = safeName + '.xlsx';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    toast('Export Excel เรียบร้อย ✓', 'success');
  } catch (err) {
    console.error(err);
    toast('Export ผิดพลาด: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false; btn.textContent = oldTxt;
  }
}

// =================================================================
// PDF EXPORT — jsPDF (close match to reference layout)
// =================================================================
async function exportWeeklyPDF() {
  if (!requireProjectContext('Weekly Report Export')) return;
  const btn = document.getElementById('wkPdfBtn');
  btn.disabled = true; const oldTxt = btn.textContent; btn.textContent = '⏳ กำลังสร้าง PDF...';
  try {
    if (!window.jspdf) throw new Error('jsPDF ยังโหลดไม่เสร็จ');
    const { jsPDF } = window.jspdf;
    const data = collectWeeklyData();
    const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const M = 18; // margin pt (~ 0.25")
    const CONTENT_W = PAGE_W - M*2;

    // Helper to draw header block at top of any page (returns y offset after header)
    const drawPageHeader = () => {
      // Title bar
      doc.setFillColor(31, 78, 121);
      doc.rect(M, M, CONTENT_W, 22, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont(undefined,'bold');
      doc.text(`${data.projectCode || ''} : ${data.projectName || ''}${data.location ? ' @' + data.location : ''}`,
               PAGE_W/2, M + 15, { align: 'center', maxWidth: CONTENT_W - 10 });
      // Report No bar
      doc.rect(M, M + 22, CONTENT_W, 18, 'F');
      doc.setFontSize(10);
      doc.text(`WEEKLY REPORT NO. ${data.reportNo || '—'}`, PAGE_W/2, M + 35, { align: 'center' });
      // Info table
      doc.setTextColor(0,0,0); doc.setFont(undefined, 'normal'); doc.setFontSize(8.5);
      const infoY = M + 46;
      const colA = M + 6, colB = PAGE_W/2 + 10;
      const label = (x,y,txt) => { doc.setFont(undefined,'bold'); doc.text(txt, x, y); doc.setFont(undefined,'normal'); };
      label(colA, infoY,    'Report Issue Date :');  doc.text(fmtDDMonYY(data.issueDate), colA + 95, infoY);
      label(colB, infoY,    'Department :');         doc.text(data.department || '', colB + 60, infoY);
      label(colA, infoY+12, 'Period of Report :');   doc.text(`${fmtDDMonYY(data.periodFrom)}  to  ${fmtDDMonYY(data.periodTo)}`, colA + 95, infoY+12);
      label(colB, infoY+12, 'Reported by :');        doc.text(data.reporter || '', colB + 60, infoY+12);
      label(colA, infoY+24, 'Work Type :');          doc.text(data.workDesc || data.workType || '', colA + 95, infoY+24, { maxWidth: 220 });
      label(colB, infoY+24, 'Coded by :');           doc.text(data.codedBy || '', colB + 60, infoY+24);
      // Border around info
      doc.setDrawColor(100); doc.setLineWidth(0.4);
      doc.rect(M, infoY - 8, CONTENT_W, 38);
      return infoY + 38;
    };

    const drawSectionHead = (y, label, cols) => {
      doc.setFillColor(48, 84, 150);
      doc.rect(M, y, CONTENT_W, 14, 'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont(undefined,'bold');
      doc.text(label, M + 4, y + 10);
      // Right-side column labels
      if (cols && cols.length) {
        const colW = 70;
        let cx = PAGE_W - M - colW * cols.length;
        cols.forEach((c) => {
          doc.text(c, cx + colW/2, y + 10, { align: 'center' });
          cx += colW;
        });
      }
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
      return y + 14;
    };

    const drawFooter = () => {
      doc.setFontSize(8); doc.setTextColor(31,78,121); doc.setFont(undefined,'bold');
      doc.text('EPC TURNKEY', M, PAGE_H - 18);
      doc.text('PRIVILEGE SERVICE', PAGE_W - M, PAGE_H - 18, { align: 'right' });
      doc.setTextColor(0,0,0); doc.setFont(undefined,'normal');
      // Watermark in center
      doc.setFontSize(8); doc.setTextColor(200,200,200);
      doc.text('CRYSTAL ENGINEERING CORPORATION LIMITED · CONFIDENTIAL DOCUMENT', PAGE_W/2, PAGE_H - 8, { align: 'center' });
      doc.setTextColor(0,0,0);
    };

    // ============ PAGE 1 ============
    let y = drawPageHeader();
    y += 4;
    // Section 1
    y = drawSectionHead(y, '1. This Week Activities', ['Progress', 'Status Issue', 'Due Date']);
    doc.autoTable({
      startY: y,
      margin: { left: M, right: M },
      head: [],
      body: data.section1.slice(0, 10).map((r, i) => [
        (i+1)+'.', r.desc || '', progressToPct(r.progress), fmtDueText(r.statusIssue), fmtDueText(r.dueDate)
      ]),
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [100,100,100], lineWidth: 0.3 },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 70, halign: 'center' },
        3: { cellWidth: 70, halign: 'center' },
        4: { cellWidth: 70, halign: 'center' },
      },
      didDrawPage: () => {}
    });
    y = doc.lastAutoTable.finalY + 4;

    // Section 2
    y = drawSectionHead(y, '2. Major issues and Outstanding this week', ['Action By', 'Due Date']);
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, head: [],
      body: data.section2.slice(0, 6).map((r, i) => [
        (i+1)+'.', r.issue || '', r.actionBy || '', fmtDueText(r.dueDate)
      ]),
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [100,100,100], lineWidth: 0.3 },
      columnStyles: { 0:{cellWidth:22,halign:'center'}, 1:{cellWidth:'auto'}, 2:{cellWidth:105,halign:'center'}, 3:{cellWidth:105,halign:'center'} }
    });
    y = doc.lastAutoTable.finalY + 4;

    // Section 3
    y = drawSectionHead(y, '3. Next Week Activities', ['Plan Mhr', 'Progress', 'Status', 'Due']);
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, head: [],
      body: data.section3.slice(0, 10).map((r, i) => [
        (i+1)+'.', r.desc || '', r.used || '', progressToPct(r.progress), fmtDueText(r.statusIssue), fmtDueText(r.dueDate)
      ]),
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [100,100,100], lineWidth: 0.3 },
      columnStyles: { 0:{cellWidth:22,halign:'center'}, 1:{cellWidth:'auto'}, 2:{cellWidth:48,halign:'center'},
                      3:{cellWidth:48,halign:'center'}, 4:{cellWidth:55,halign:'center'}, 5:{cellWidth:55,halign:'center'} }
    });
    y = doc.lastAutoTable.finalY + 4;

    // Section 4
    y = drawSectionHead(y, '4. Current Important Targets', ['Status Issue', 'Due Date']);
    doc.autoTable({
      startY: y, margin: { left: M, right: M }, head: [],
      body: data.section4.slice(0, 7).map((r, i) => [
        (i+1)+'.', r.target || '', fmtDueText(r.statusIssue), fmtDueText(r.dueDate)
      ]),
      styles: { fontSize: 8.5, cellPadding: 3, lineColor: [100,100,100], lineWidth: 0.3 },
      columnStyles: { 0:{cellWidth:22,halign:'center'}, 1:{cellWidth:'auto'}, 2:{cellWidth:105,halign:'center'}, 3:{cellWidth:105,halign:'center'} }
    });
    y = doc.lastAutoTable.finalY + 8;

    // Attachments + signature
    doc.setFontSize(9); doc.setFont(undefined,'bold'); doc.text('File Attachment :', M, y);
    doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
    ['1.', '2.', '3.'].forEach((n,i) => doc.text(n, M, y + 14 + i*12));
    // Approved by box
    const sigX = PAGE_W - M - 180;
    doc.setFont(undefined,'bold'); doc.text('Approved by', sigX + 90, y, { align: 'center' });
    if (data.signatureDataUrl) {
      try { doc.addImage(data.signatureDataUrl, 'PNG', sigX + 30, y + 6, 120, 40); } catch (e) {}
    }
    doc.setDrawColor(100); doc.line(sigX, y + 50, sigX + 180, y + 50);
    doc.setFont(undefined,'normal');
    doc.text(data.approverSignName || data.approver || '', sigX + 90, y + 62, { align: 'center' });
    doc.setFontSize(8); doc.setTextColor(85,85,85);
    doc.text('(Civil Engineer)', sigX + 90, y + 74, { align: 'center' });
    doc.setTextColor(0,0,0);

    drawFooter();

    // ============ PHOTO PAGES ============
    const photos = data.photos;
    // FIXED v5.1: Weekly photo PDF matches 4-photo page structure — FEAT-6
    const PER_PAGE = 4;
    const reportNoClean = (data.reportNo || 'W').match(/W-?(\d+)/i)?.[1] || '1';
    for (let pi = 0; pi < Math.ceil(photos.length / PER_PAGE); pi++) {
      doc.addPage();
      let py = drawPageHeader() + 6;
      // Table header
      doc.setFillColor(252, 228, 214);
      doc.rect(M, py, CONTENT_W, 14, 'F');
      doc.setFontSize(9); doc.setFont(undefined,'bold');
      const hCols = [
        { x: M + 35,  txt: 'Item No.' },
        { x: M + 150, txt: 'Figures (Photo)' },
        { x: M + 315, txt: 'Detailed Activities' },
        { x: M + 410, txt: 'Work Description' },
        { x: M + 470, txt: 'Gridline' },
        { x: M + 530, txt: 'Remark' },
      ];
      hCols.forEach(c => doc.text(c.txt, c.x, py + 9, { align: 'center' }));
      py += 14;
      doc.setFont(undefined,'normal');

      const availH = (PAGE_H - 40) - py; // height available for 4 photos
      const blockH = Math.floor(availH / PER_PAGE);
      for (let i = 0; i < PER_PAGE; i++) {
        const photo = photos[pi*PER_PAGE + i];
        const by = py + i * blockH;
        // Borders for the row
        doc.setDrawColor(100); doc.setLineWidth(0.3);
        doc.rect(M, by, CONTENT_W, blockH);
        // Cell separators
        const xCols = [M + 70, M + 260, M + 370, M + 450, M + 510];
        xCols.forEach(x => doc.line(x, by, x, by + blockH));
        if (!photo) continue;
        // Item No
        doc.setFontSize(9); doc.setFont(undefined,'bold');
        const itemNo = `W${String(reportNoClean).padStart(2,'0')}-${pi*PER_PAGE + i + 1}`;
        doc.text(itemNo, M + 35, by + blockH/2 + 3, { align: 'center' });
        // Photo
        try {
          const photoArea = { x: M + 75, y: by + 4, w: 180, h: blockH - 8 };
          doc.addImage(photo.dataUrl, 'JPEG', photoArea.x, photoArea.y, photoArea.w, photoArea.h, undefined, 'FAST');
        } catch (e) { console.warn('img add failed', e); }
        // Detailed activities / work desc / gridline / remark
        doc.setFont(undefined,'normal'); doc.setFontSize(8.5);
        doc.text(photo.activities || '', M + 315, by + blockH/2 + 3, { align: 'center', maxWidth: 100 });
        doc.text(photo.workDesc || '', M + 410, by + blockH/2 + 3, { align: 'center', maxWidth: 75 });
        doc.text(photo.gridline || '', M + 470, by + blockH/2 + 3, { align: 'center', maxWidth: 70 });
        doc.text(photo.remark   || '', M + 530, by + blockH/2 + 3, { align: 'center', maxWidth: 60 });
      }
      drawFooter();
    }

    const safeName = ((data.projectCode || 'Weekly') + '_' + (data.reportNo || 'Report')).replace(/[^A-Za-z0-9_-]/g, '_');
    doc.save(safeName + '.pdf');
    toast('Export PDF เรียบร้อย ✓', 'success');
  } catch (err) {
    console.error(err);
    toast('Export PDF ผิดพลาด: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false; btn.textContent = oldTxt;
  }
}
