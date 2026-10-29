/* AI provider adapters. No remote code or eval; user-supplied endpoints are opt-in. */
(function (root) {
  'use strict';

  const TEMPLATES = [
    { key: 'cyonara', name: 'CyonaraAI API', kind: 'openai', baseUrl: '', model: '' },
    { key: 'cyonara-web', name: 'Cyonara ChatBot Website', kind: 'web', baseUrl: '', model: '' },
    { key: 'openai', name: 'OpenAI', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini' },
    { key: 'deepseek', name: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    { key: 'openrouter', name: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
    { key: 'ollama', name: 'Ollama (local)', kind: 'openai', baseUrl: 'http://localhost:11434/v1', model: '' },
    { key: 'gemini', name: 'Google Gemini', kind: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' },
    { key: 'anthropic', name: 'Anthropic Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-5' },
    { key: 'custom', name: 'Custom AI API', kind: 'openai', baseUrl: '', model: '' },
    { key: 'custom-web', name: 'Any AI Website', kind: 'web', baseUrl: '', model: '' }
  ];

  function validateBaseUrl(input) {
    const url = new URL(String(input || '').trim());
    const loopback = ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
        url.username || url.password || url.search || url.hash) {
      throw new Error('Use an HTTPS API URL (or HTTP localhost/127.0.0.1) without credentials/query/fragment');
    }
    return url.href.replace(/\/+$/, '');
  }

  function permissionOrigin(baseUrl) {
    const url = new URL(validateBaseUrl(baseUrl));
    // Chrome match patterns exclude port numbers.
    return url.protocol + '//' + url.hostname + '/*';
  }

  function endpoint(baseUrl, path) {
    const base = validateBaseUrl(baseUrl);
    return base.endsWith(path) ? base : base + path;
  }

  function makeRequest(provider, prompt) {
    if (!provider || !provider.model) throw new Error('Choose a model in AI Settings');
    const base = provider.baseUrl;
    const key = String(provider.apiKey || '').trim();
    if (provider.kind === 'gemini') {
      if (!key) throw new Error('Gemini API key is required');
      const url = endpoint(base, '/models/' + encodeURIComponent(provider.model) + ':generateContent');
      return { url: url + '?key=' + encodeURIComponent(key),
        options: { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) } };
    }
    if (provider.kind === 'anthropic') {
      if (!key) throw new Error('Anthropic API key is required');
      return { url: endpoint(base, '/messages'),
        options: { method: 'POST', headers: { 'Content-Type': 'application/json',
          'x-api-key': key, 'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: provider.model, max_tokens: 2048,
            messages: [{ role: 'user', content: prompt }] }) } };
    }
    if (provider.kind !== 'openai') throw new Error('Unsupported AI API protocol');
    return { url: endpoint(base, '/chat/completions'),
      options: { method: 'POST', headers: { 'Content-Type': 'application/json',
        ...(key ? { Authorization: 'Bearer ' + key } : {}) },
        body: JSON.stringify({ model: provider.model, messages: [{ role: 'user', content: prompt }] }) } };
  }

  function extractText(kind, data) {
    if (data && data.error) {
      throw new Error(typeof data.error === 'string' ? data.error : (data.error.message || 'AI API error'));
    }
    let out;
    if (kind === 'gemini') out = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    else if (kind === 'anthropic') out = (data?.content || []).filter(p => p.type === 'text').map(p => p.text || '').join('');
    else {
      const content = data?.choices?.[0]?.message?.content;
      out = typeof content === 'string' ? content : Array.isArray(content) ? content.map(p => p.text || '').join('') : '';
    }
    if (!String(out || '').trim()) throw new Error('AI returned an empty response');
    return String(out).trim();
  }

  const api = { TEMPLATES, validateBaseUrl, permissionOrigin, makeRequest, extractText };
  root.AIProviders = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
