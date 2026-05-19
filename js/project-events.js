'use strict';
// ============================================================
// Crystal AI - project-events.js  (Phase-4M-2 extraction)
// Phase-3B Project Context Event System (pub/sub)
// Pure infrastructure layer - no UI, no state, no Supabase.
// Event names (immutable):
//   crystalProjectOpen     - dispatched by openProjectModal(v2) after state set
//   crystalProjectClose    - dispatched by closeProjectModalDetail
//   crystalProjectChanged  - declared but never emitted (latent helper)
// Payload: { id, meta, source, timestamp }
// Runtime deps (resolved at call time, all global from other modules):
//   _resetDailyPhotosMemory, loadDailyPhotos, clearDailyPhotos - photos.js
//   loadBOQ - boq.js
//   loadReportTables - report-tables.js
//   loadDrafts - drafts.js
//   loadWkPhotos - photos.js
//   chatHistory, loadChatHistory, renderWelcome - chat.js
//   populateStructProjectPicker, renderStructHistory - structural.js
// Idempotence: window.__crystalProjectEventsBound guards against double-bind
// ============================================================

// ============================================================
// 12B. PROJECT CONTEXT EVENT SYSTEM (Phase-3B)
// ============================================================
const PROJECT_EVENT_DEBUG = false;

function _pEvtLog(...args) {
  if (PROJECT_EVENT_DEBUG) console.log('[ProjectEvent]', ...args);
}

function emitProjectOpen(meta, source) {
  _pEvtLog('OPEN', meta?.id, '←', source);
  window.dispatchEvent(new CustomEvent('crystalProjectOpen', {
    detail: { id: meta?.id ?? null, meta: meta ?? null, source, timestamp: Date.now() }
  }));
}

function emitProjectClose(source) {
  _pEvtLog('CLOSE', '←', source);
  window.dispatchEvent(new CustomEvent('crystalProjectClose', {
    detail: { id: null, meta: null, source, timestamp: Date.now() }
  }));
}

function emitProjectChanged(meta, source) {
  _pEvtLog('CHANGED', meta?.id, '←', source);
  window.dispatchEvent(new CustomEvent('crystalProjectChanged', {
    detail: { id: meta?.id ?? null, meta: meta ?? null, source, timestamp: Date.now() }
  }));
}

function _bindProjectEvents() {
  if (window.__crystalProjectEventsBound) return;
  window.__crystalProjectEventsBound = true;

  window.addEventListener('crystalProjectOpen', (e) => {
    _pEvtLog('→ loading modules for project', e.detail.id);
    try { _resetDailyPhotosMemory(); loadDailyPhotos(); _pEvtLog('LOAD daily-photos OK'); }
    catch(err) { console.warn('[ProjectEvent] daily-photos:', err.message); }
    try { loadBOQ(); _pEvtLog('LOAD boq OK'); }
    catch(err) { console.warn('[ProjectEvent] boq:', err.message); }
    try { loadReportTables(); loadDrafts(); _pEvtLog('LOAD reports+drafts OK'); }
    catch(err) { console.warn('[ProjectEvent] reports:', err.message); }
    try { loadWkPhotos(); _pEvtLog('LOAD wk-photos OK'); }
    catch(err) { console.warn('[ProjectEvent] wk-photos:', err.message); }
    try { chatHistory = []; if (!loadChatHistory()) renderWelcome(); _pEvtLog('LOAD chat OK'); }
    catch(err) { console.warn('[ProjectEvent] chat:', err.message); }
    try {
      populateStructProjectPicker();
      const hp = document.getElementById('structHistoryPanel');
      if (hp && hp.style.display !== 'none') renderStructHistory();
      _pEvtLog('LOAD struct-picker OK');
    } catch(err) { console.warn('[ProjectEvent] struct-picker:', err.message); }
  });

  window.addEventListener('crystalProjectClose', () => {
    _pEvtLog('→ clearing project UI');
    try { clearDailyPhotos(); _pEvtLog('CLEAR daily-photos OK'); }
    catch(err) { console.warn('[ProjectEvent] clear daily-photos:', err.message); }
  });

  window.addEventListener('crystalProjectChanged', (e) => {
    _pEvtLog('→ project switched to', e.detail.id, '(modules loading via crystalProjectOpen)');
  });
}
