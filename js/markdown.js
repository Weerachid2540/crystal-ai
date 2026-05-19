'use strict';
// ============================================================
// Crystal AI — markdown.js  (Phase-4C extraction)
// XSS-safe markdown renderer — FIXED #3: bullet list grouping
// Depends on: utils.js (escapeHtml) — must load after utils.js
// ============================================================

function renderMarkdown(text) {
  let html = escapeHtml(text);

  // Code blocks ```...``` (preserve before other patterns)
  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (_, c) => {
    codeBlocks.push(c.trim());
    return `CB${codeBlocks.length - 1}`;
  });

  // Inline patterns
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // FIXED #3: Process bullet lists line-by-line, group consecutive items into single <ul>
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  for (const line of lines) {
    const m = line.match(/^\s*[-*•]\s+(.+)$/);
    if (m) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + m[1] + '</li>');
    } else {
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line);
    }
  }
  if (inList) out.push('</ul>');

  // Join → convert remaining \n to <br>, then cleanup
  let result = out.join('\n').replace(/\n/g, '<br>');
  result = result.replace(/<br>\s*<ul>/g, '<ul>').replace(/<\/ul>\s*<br>/g, '</ul>');
  result = result.replace(/<\/li><br>/g, '</li>').replace(/<ul><br>/g, '<ul>');

  // Restore code blocks
  result = result.replace(/CB(\d+)/g, (_, i) => `<pre><code>${codeBlocks[i]}</code></pre>`);
  return result;
}
