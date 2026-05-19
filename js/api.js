'use strict';
// ============================================================
// Crystal AI — api.js  (Phase-4D-3 extraction)
// AI Provider config + unified callAPI()
// Depends on: utils.js (safeJsonParse), i18n.js (tr), storage.js (proxy)
// Runtime deps: currentView, currentProjectId, currentProjectMeta —
//               resolved at call time (declared with let in inline)
// ============================================================

// 2. PROVIDER CONFIG (5 Providers)
// ============================================================

// FIXED #16: max_tokens 2000 → 4000 (รองรับรายงานยาว)
const MAX_TOKENS = 4000;

function openaiCompatible(endpoint, extraHeaders) {
  return {
    buildUrl: () => endpoint,
    buildBody: (system, messages, model) => ({
      model,
      max_tokens: MAX_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages]
    }),
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      ...(extraHeaders || {})
    }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message || data.error.code || 'API error');
      return data.choices?.[0]?.message?.content || '';
    }
  };
}

const PROVIDERS = {
  groq: {
    label: 'Groq', badge: 'FREE',
    helpText: '⚡ Groq เร็วมาก ฟรีตลอด — แนะนำสำหรับใช้งานทั่วไป',
    keyUrl: 'https://console.groq.com/keys', keyUrlText: 'console.groq.com/keys',
    keyPlaceholder: 'gsk_...',
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      ['llama-3.3-70b-versatile', 'Llama 3.3 70B (แนะนำ)'],
      ['llama-3.1-8b-instant', 'Llama 3.1 8B (เร็วสุด)'],
      ['llama3-70b-8192', 'Llama 3 70B'],
      ['gemma2-9b-it', 'Gemma 2 9B']
    ],
    ...openaiCompatible('https://api.groq.com/openai/v1/chat/completions')
  },
  gemini: {
    label: 'Google Gemini', badge: 'FREE',
    helpText: '🆓 Gemini Free Tier — แต่บางบัญชีอาจติด limit:0 (ใช้ Groq แทนได้)',
    keyUrl: 'https://aistudio.google.com/app/apikey', keyUrlText: 'aistudio.google.com',
    keyPlaceholder: 'AIza...',
    defaultModel: 'gemini-2.0-flash',
    models: [
      ['gemini-2.0-flash', 'gemini-2.0-flash (เร็ว, แนะนำ)'],
      ['gemini-2.5-flash', 'gemini-2.5-flash (ใหม่)'],
      ['gemini-1.5-flash', 'gemini-1.5-flash'],
      ['gemini-1.5-pro', 'gemini-1.5-pro (เก่ง, limit ต่ำ)']
    ],
    buildUrl: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
    buildBody: (system, messages) => ({
      contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      systemInstruction: { parts: [{ text: system }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: MAX_TOKENS }
    }),
    buildHeaders: () => ({ 'Content-Type': 'application/json' }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message || 'Gemini error');
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  },
  openrouter: {
    label: 'OpenRouter', badge: 'FREE',
    helpText: '🌐 รวม model ฟรีหลายเจ้า — Llama, DeepSeek, Qwen, Gemini',
    keyUrl: 'https://openrouter.ai/keys', keyUrlText: 'openrouter.ai/keys',
    keyPlaceholder: 'sk-or-...',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    models: [
      ['meta-llama/llama-3.3-70b-instruct:free', 'Llama 3.3 70B (ฟรี)'],
      ['google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash Exp (ฟรี)'],
      ['deepseek/deepseek-chat-v3-0324:free', 'DeepSeek V3 (ฟรี)'],
      ['qwen/qwen-2.5-72b-instruct:free', 'Qwen 2.5 72B (ฟรี)'],
      ['mistralai/mistral-small-3.1-24b-instruct:free', 'Mistral Small 3.1 (ฟรี)']
    ],
    ...openaiCompatible('https://openrouter.ai/api/v1/chat/completions', {
      'HTTP-Referer': location.origin || 'https://crystal-ai.local',
      'X-Title': 'Crystal AI'
    })
  },
  cerebras: {
    label: 'Cerebras', badge: 'FREE',
    helpText: '🚀 เร็วที่สุดในโลก (2,000+ tokens/วินาที) — สมัครฟรี',
    keyUrl: 'https://cloud.cerebras.ai/platform/', keyUrlText: 'cloud.cerebras.ai',
    keyPlaceholder: 'csk-...',
    defaultModel: 'llama-3.3-70b',
    models: [
      ['llama-3.3-70b', 'Llama 3.3 70B (แนะนำ)'],
      ['llama3.1-8b', 'Llama 3.1 8B (เร็วสุด)']
    ],
    ...openaiCompatible('https://api.cerebras.ai/v1/chat/completions')
  },
  anthropic: {
    label: 'Anthropic Claude', badge: 'PAID',
    helpText: '💳 Claude เก่งสุด แต่เสียเงิน (pay-per-use)',
    keyUrl: 'https://console.anthropic.com/settings/keys', keyUrlText: 'console.anthropic.com',
    keyPlaceholder: 'sk-ant-...',
    defaultModel: 'claude-sonnet-4-20250514',
    models: [
      ['claude-sonnet-4-20250514', 'claude-sonnet-4 (แนะนำ)'],
      ['claude-3-5-sonnet-20241022', 'claude-3.5-sonnet'],
      ['claude-3-5-haiku-20241022', 'claude-3.5-haiku (เร็ว, ถูก)']
    ],
    buildUrl: () => 'https://api.anthropic.com/v1/messages',
    buildBody: (system, messages, model) => ({ model, max_tokens: MAX_TOKENS, system, messages }),
    buildHeaders: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    }),
    parseResponse: (data) => {
      if (data.error) throw new Error(data.error.message || 'Anthropic error');
      return data.content?.[0]?.text || '';
    }
  }
};

// FIXED #1, #4: safeJsonParse + validate provider
let settings = safeJsonParse(localStorage.getItem('crystal_settings'), {});
if (typeof settings !== 'object' || Array.isArray(settings)) settings = {};
settings.keys = (settings.keys && typeof settings.keys === 'object') ? settings.keys : {};
settings.models = (settings.models && typeof settings.models === 'object') ? settings.models : {};

// Migrate old format → new format
if (settings.geminiKey) { settings.keys.gemini = settings.geminiKey; delete settings.geminiKey; }
if (settings.anthropicKey) { settings.keys.anthropic = settings.anthropicKey; delete settings.anthropicKey; }
if (settings.geminiModel) { settings.models.gemini = settings.geminiModel; delete settings.geminiModel; }
if (settings.anthropicModel) { settings.models.anthropic = settings.anthropicModel; delete settings.anthropicModel; }

Object.keys(PROVIDERS).forEach(p => {
  if (!settings.models[p]) settings.models[p] = PROVIDERS[p].defaultModel;
  if (settings.keys[p] === undefined) settings.keys[p] = '';
});
// FIXED #4: ตรวจ provider ก่อนใช้
settings.provider = (settings.provider && PROVIDERS[settings.provider]) ? settings.provider : 'groq';

function getActiveKey() { return settings.keys[settings.provider] || ''; }
function getActiveModel() { return settings.models[settings.provider] || PROVIDERS[settings.provider].defaultModel; }

// ============================================================
// 3. UNIFIED API CALL (FIXED #15: request lock)
// ============================================================
let apiInFlight = false;

async function callAPI(messages, opts = {}) {
  // FIXED #15: Request lock — กัน race condition
  if (apiInFlight) throw new Error('REQUEST_BUSY');

  const key = getActiveKey();
  if (!key) throw new Error('NO_API_KEY');

  const provider = PROVIDERS[settings.provider];
  const model = getActiveModel();
  const projectContext = (currentView === 'project' && currentProjectMeta)
    ? `\n\nCurrent project context:\n- project_id: ${currentProjectId}\n- code: ${currentProjectMeta.code || ''}\n- name: ${currentProjectMeta.name || ''}\n- client: ${currentProjectMeta.client || ''}\n- location: ${currentProjectMeta.location || ''}\nUse this project context for reports, files, and engineering answers. Salary is a personal/global module outside project context.`
    : '\n\nNo project is selected. Use dashboard context for overview questions. Reports require an opened project; Salary is available as a personal module from the main navigation.';
  // FIXED v6: AI always receives project-aware context.
  const system = (opts.system || tr('sys_prompt')) + projectContext;

  apiInFlight = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), opts.timeout || 60000);

  try {
    const res = await fetch(provider.buildUrl(model, key), {
      method: 'POST',
      headers: provider.buildHeaders(key),
      body: JSON.stringify(provider.buildBody(system, messages, model)),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data.error?.message || data.error?.type || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) throw new Error('AUTH_FAILED: ' + errMsg);
      if (res.status === 429) throw new Error('RATE_LIMIT: ' + errMsg);
      if (res.status === 402) throw new Error('PAYMENT_REQUIRED: ' + errMsg);
      throw new Error('API_ERROR: ' + errMsg);
    }

    const text = provider.parseResponse(data);
    if (!text) throw new Error('EMPTY_RESPONSE');
    return text;
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('TIMEOUT');
    throw e;
  } finally {
    apiInFlight = false;
  }
}

