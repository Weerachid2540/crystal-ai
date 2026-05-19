'use strict';
// ============================================================
// Crystal AI — settings-ui.js  (Phase-4D-4 extraction)
// Settings modal: open/close/save + provider/model rendering
// Depends on: utils.js (escapeHtml, openModal, closeModal, getEl),
//             toast.js (toast), i18n.js (currentLang),
//             api.js (settings, PROVIDERS, getActiveKey, getActiveModel)
// All DOM access is deferred to function call time (no top-level DOM reads)
// ============================================================

// 8. SETTINGS MODAL
// ============================================================
let editingProvider = settings.provider;

function openSettings() {
  const sel = document.getElementById('providerSelect');
  sel.innerHTML = Object.entries(PROVIDERS).map(([k, p]) =>
    `<option value="${k}">${escapeHtml(p.label)} ${p.badge === 'FREE' ? '🆓' : '💳'}</option>`
  ).join('');
  sel.value = settings.provider;
  editingProvider = settings.provider;
  renderProviderSection(settings.provider);
  openModal('settingsModal');
}

function closeSettings() {
  closeModal('settingsModal');
}

function captureFormToSettings(provider) {
  const keyEl = document.getElementById('providerKey');
  const modelEl = document.getElementById('providerModel');
  if (keyEl) settings.keys[provider] = keyEl.value.trim();
  if (modelEl) settings.models[provider] = modelEl.value;
}

function setProvider(newProvider) {
  if (editingProvider) captureFormToSettings(editingProvider);
  editingProvider = newProvider;
  document.getElementById('providerSelect').value = newProvider;
  renderProviderSection(newProvider);
}

function renderProviderSection(p) {
  const cfg = PROVIDERS[p];
  const currentKey = settings.keys[p] || '';
  const currentModel = settings.models[p] || cfg.defaultModel;
  const badgeColor = cfg.badge === 'FREE' ? 'var(--green)' : 'var(--accent)';
  document.getElementById('providerSection').innerHTML = `
    <div class="field">
      <label>${escapeHtml(cfg.label)} API Key
        <span style="background:${badgeColor};color:#000;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:4px;font-weight:700">${cfg.badge}</span>
        <span class="req">*</span>
      </label>
      <input id="providerKey" type="password" placeholder="${escapeHtml(cfg.keyPlaceholder)}" value="${escapeHtml(currentKey)}" autocomplete="off"/>
      <div class="help-text">
        ${escapeHtml(cfg.helpText)}<br>
        🔑 รับ API Key ที่ <a href="${escapeHtml(cfg.keyUrl)}" target="_blank" rel="noopener">${escapeHtml(cfg.keyUrlText)}</a>
      </div>
    </div>
    <div class="field">
      <label>Model</label>
      <select id="providerModel">
        ${cfg.models.map(([v, l]) =>
          `<option value="${escapeHtml(v)}" ${v === currentModel ? 'selected' : ''}>${escapeHtml(l)}</option>`
        ).join('')}
      </select>
    </div>
  `;
}

function saveSettings() {
  captureFormToSettings(editingProvider);
  settings.provider = editingProvider;
  try { localStorage.setItem('crystal_settings', JSON.stringify(settings)); } catch (e) {}
  updateModelTag();
  updateSettingsBtnStatus();
  toast(currentLang === 'en' ? '✓ Settings saved' : '✓ บันทึกการตั้งค่าแล้ว', 'success');
  closeSettings();
}

function updateModelTag() {
  document.getElementById('modelTag').textContent = `${settings.provider}: ${getActiveModel()}`;
}

function updateSettingsBtnStatus() {
  const btn = document.getElementById('settingsBtn');
  const dot = document.getElementById('statusDot');
  if (!getActiveKey()) {
    btn.classList.add('alert');
    dot.classList.add('warn');
    btn.title = 'API Key not set';
  } else {
    btn.classList.remove('alert');
    dot.classList.remove('warn');
    btn.title = 'Settings';
  }
}

