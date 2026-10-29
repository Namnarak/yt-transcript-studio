'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const AI = require('../lib/ai-providers.js');
test('templates include popular and custom providers', () => {
  for (const name of ['cyonara','openai','deepseek','openrouter','ollama','gemini','anthropic','custom','cyonara-web','custom-web'])
    assert.ok(AI.TEMPLATES.some(t => t.key === name));
});
test('rejects insecure remote HTTP and embedded secrets', () => {
  for (const url of ['http://example.org/v1','https://user:pass@example.org/v1',
    'https://example.org/v1?key=secret','https://example.org/v1#frag'])
    assert.throws(() => AI.validateBaseUrl(url));
  assert.equal(AI.validateBaseUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
});
test('Chrome permissions exclude ports', () => {
  assert.equal(AI.permissionOrigin('http://localhost:11434/v1'), 'http://localhost/*');
  assert.equal(AI.permissionOrigin('https://api.example.org/v1'), 'https://api.example.org/*');
});
test('OpenAI API custom URL, auth, request body', () => {
  const p = AI.makeRequest({kind:'openai',baseUrl:'https://api.example.com/v1',model:'cyonara',apiKey:'secret'}, 'hello');
  assert.equal(p.url, 'https://api.example.com/v1/chat/completions');
  assert.equal(p.options.headers.Authorization, 'Bearer secret');
  assert.equal(JSON.parse(p.options.body).messages[0].content, 'hello');
});
test('Ollama is keyless, and full endpoint does not duplicate path', () => {
  const p = AI.makeRequest({kind:'openai',baseUrl:'http://127.0.0.1:11434/v1',model:'qwen'}, 'hey');
  assert.equal(p.options.headers.Authorization, undefined);
  assert.equal(p.url, 'http://127.0.0.1:11434/v1/chat/completions');
  const q = AI.makeRequest({kind:'openai',baseUrl:'https://api.example.com/chat/completions',model:'x'}, 'hey');
  assert.equal(q.url, 'https://api.example.com/chat/completions');
});
test('Gemini and Claude native protocols', () => {
  const g = AI.makeRequest({kind:'gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-2.5-flash',apiKey:'secret'}, 'hey');
  assert.ok(g.url.includes(':generateContent?key=secret'));
  const c = AI.makeRequest({kind:'anthropic',baseUrl:'https://api.anthropic.com/v1',model:'claude',apiKey:'secret'}, 'hey');
  assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(c.options.headers['anthropic-dangerous-direct-browser-access'], 'true');
});
test('parse AI results and errors', () => {
  assert.equal(AI.extractText('openai',{choices:[{message:{content:'OpenAI'}}]}),'OpenAI');
  assert.equal(AI.extractText('gemini',{candidates:[{content:{parts:[{text:'Gemini'}]}}]}),'Gemini');
  assert.equal(AI.extractText('anthropic',{content:[{type:'text',text:'Claude'}]}),'Claude');
  assert.throws(()=>AI.extractText('openai',{choices:[]}), /empty response/);
  assert.throws(()=>AI.extractText('openai',{error:{message:'bad key'}}), /bad key/);
});
